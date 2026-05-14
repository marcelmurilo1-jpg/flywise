import pLimit from 'p-limit';
import { getBrowser, clearBrowserRef, UA_POOL, TIMEZONE_POOL, pick, randInt, getChromeVersion, getPlatform } from './browser.js';
import { AIRLINE_CODE_MAP, IATA_TO_AIRLINE, normalizeAirline, iataToCity } from './airlineMaps.js';

const scrapeLimit = pLimit(2);

function addDaysToDate(dateStr, days) {
    if (!days) return dateStr;
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

// ── Protobuf helpers (portados de FlightResultsGrouped.tsx) ───────────────────
function _gfVarint(buf, val) {
    while (val > 0x7F) { buf.push((val & 0x7F) | 0x80); val >>>= 7; }
    buf.push(val & 0x7F);
}
function _gfInt(buf, field, val) {
    _gfVarint(buf, (field << 3) | 0);
    _gfVarint(buf, val);
}
function _gfStr(buf, field, str) {
    _gfVarint(buf, (field << 3) | 2);
    _gfVarint(buf, str.length);
    for (let i = 0; i < str.length; i++) buf.push(str.charCodeAt(i));
}
function _gfMsg(buf, field, bytes) {
    _gfVarint(buf, (field << 3) | 2);
    _gfVarint(buf, bytes.length);
    for (let i = 0; i < bytes.length; i++) buf.push(bytes[i]);
}
function _buildGfSegProto(from, date, to) {
    const b = [];
    _gfStr(b, 1, from); _gfStr(b, 2, date); _gfStr(b, 3, to);
    return b;
}
function _buildGfEntity(iata) {
    const b = [];
    _gfInt(b, 1, 1);
    _gfStr(b, 2, iata);
    return b;
}
function _buildGfItinProto(from, date, to) {
    const b = [];
    _gfStr(b, 2, date);
    _gfMsg(b, 4, _buildGfSegProto(from, date, to));
    _gfMsg(b, 13, _buildGfEntity(from));
    _gfMsg(b, 14, _buildGfEntity(to));
    return b;
}

/**
 * Builds a tfs-format Google Flights URL — same format as the frontend "Ver no Google Flights"
 * button. Round-trip searches show combined prices (avoids the two-step wizard triggered by ?q=).
 */
function buildGfTfsUrl(origin, dest, date, returnDate = null, adults = 1) {
    const buf = [];
    _gfInt(buf, 1, 28);
    _gfInt(buf, 2, returnDate ? 2 : 1); // 2 = round-trip, 1 = one-way
    _gfMsg(buf, 3, _buildGfItinProto(origin.toUpperCase(), date, dest.toUpperCase()));
    if (returnDate) {
        _gfMsg(buf, 3, _buildGfItinProto(dest.toUpperCase(), returnDate, origin.toUpperCase()));
    }
    _gfInt(buf, 8, adults);
    _gfInt(buf, 9, 1);
    _gfInt(buf, 14, 1);
    // Node.js: use Buffer instead of btoa(); base64url (no +, /, =)
    const b64 = Buffer.from(buf).toString('base64url');
    return `https://www.google.com/travel/flights?tfs=${b64}&hl=pt-BR&gl=BR&curr=BRL`;
}

async function scrapeOneway(origin, destination, date, returnDate = null) {
    return scrapeLimit(async () => {
        for (let attempt = 1; attempt <= 2; attempt++) {
        let context;
        try {
        const browser = await getBrowser();

        // ── Fase 2: fingerprint rotation ─────────────────────────────────────
        const ua       = pick(UA_POOL);
        const timezone = pick(TIMEZONE_POOL);
        const vw       = randInt(1366, 1920);
        const vh       = randInt(768, 1080);
        const chromeV  = getChromeVersion(ua);
        const platform = getPlatform(ua);
        const isMac    = platform === 'macOS';

        // ── Fase 4: headers HTTP consistentes com o UA ────────────────────────
        const secChUa = `"Chromium";v="${chromeV}", "Google Chrome";v="${chromeV}", "Not-A.Brand";v="99"`;

        context = await browser.newContext({
            viewport: { width: vw, height: vh },
            locale: 'pt-BR',
            timezoneId: timezone,
            userAgent: ua,
            extraHTTPHeaders: {
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': secChUa,
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': `"${platform}"`,
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'Referer': 'https://www.google.com/',
            },
        });
        const page = await context.newPage();

        // Patch complementar (stealth plugin já cobre a maioria, mas reforçamos)
        await page.addInitScript((mac) => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'platform', { get: () => mac ? 'MacIntel' : 'Win32' });
            window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
        }, isMac);

            // tfs URL = same format as "Ver no Google Flights" button on frontend
            // Round-trip tfs → standard list with combined prices (avoids the two-step wizard that ?q= triggers)
            const url = buildGfTfsUrl(origin, destination, date, returnDate);

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 22000 });

            // ── Consent / block page detection ───────────────────────────────────
            let curUrl = page.url();
            let curTitle = await page.title();
            console.log(`[GFlights] ${origin}→${destination}: title="${curTitle}" url=${curUrl}`);

            const isConsentPage = curUrl.includes('consent.google.com') ||
                curTitle.includes('Before you continue') || curTitle.includes('Antes de continuar') ||
                curTitle.includes('Before you') || curTitle.includes('Privacy');
            const isCaptcha = curUrl.includes('/sorry/') || curUrl.includes('recaptcha') ||
                curTitle.toLowerCase().includes('unusual traffic') || curTitle.toLowerCase().includes('captcha');

            if (isCaptcha) {
                console.warn(`[GFlights] ${origin}→${destination}: CAPTCHA/rate-limit detectado — abortando`);
                throw new Error('BLOCKED');
            }

            if (isConsentPage) {
                console.log(`[GFlights] ${origin}→${destination}: consent page — tentando aceitar...`);
                const accepted = await page.locator([
                    '#L2AGLb', 'button:has-text("Accept all")', 'button:has-text("Aceitar tudo")',
                    'button:has-text("I agree")', 'button:has-text("Aceito")',
                    'button:has-text("Agree")', 'form button[type="submit"]:first-of-type',
                ].join(', ')).first().click({ timeout: 6000 }).then(() => true).catch(() => false);

                if (accepted) {
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                    await new Promise(r => setTimeout(r, randInt(800, 1400)));
                    curUrl = page.url();
                    console.log(`[GFlights] ${origin}→${destination}: após consent → ${curUrl}`);
                }

                // Se ainda não chegou na página de voos, navega diretamente
                if (!curUrl.includes('/travel/flights')) {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 22000 });
                    await new Promise(r => setTimeout(r, randInt(1000, 1800)));
                }
            } else {
                // Página normal — tenta aceitar cookies genéricos se existirem
                const cookieClicked = await page.locator('button:has-text("Accept all"), button:has-text("Aceitar tudo"), button[aria-label*="Accept"]')
                    .first().click({ timeout: 3000 }).then(() => true).catch(() => false);
                if (cookieClicked) await new Promise(r => setTimeout(r, randInt(600, 1000)));
            }

            // ── Detect search-form page vs results page ───────────────────────
            // The tfs URL pre-fills the form but may no longer auto-navigate to results.
            // If we land on the form (no flight cards), submit the search.
            const hasFlightsAlready = await page.evaluate(() =>
                [...document.querySelectorAll('div[data-id]')].some(el => {
                    const a = el.querySelector('[aria-label]')?.getAttribute('aria-label') ?? '';
                    return /Reais brasileiros|Voo da |From R\$|From BRL|BRL\s*\d|\bflight\b/i.test(a);
                })
            );

            if (!hasFlightsAlready) {
                console.log(`[GFlights] ${origin}→${destination}: sem cards de voo — tentando submeter formulário`);
                // Try clicking the search button using multiple strategies
                const clicked = await page.locator([
                    'button:has-text("Pesquisar")',
                    'button:has-text("Search")',
                    '[aria-label="Pesquisar"]',
                    '[aria-label="Search"]',
                    'input[type="submit"]',
                    'form button[type="submit"]',
                    'form button',
                ].join(', ')).first().click({ timeout: 5000 }).then(() => true).catch(() => false);

                if (clicked) {
                    console.log(`[GFlights] ${origin}→${destination}: botão de busca clicado`);
                } else {
                    // Fallback: press Enter on the page
                    await page.keyboard.press('Enter').catch(() => null);
                    console.log(`[GFlights] ${origin}→${destination}: Enter pressionado como fallback`);
                }
                await new Promise(r => setTimeout(r, randInt(2000, 3000)));
            }

            // Aguarda os cards de voo aparecerem (div[data-id] com aria-label de voo)
            // Detecta tanto PT ("Reais brasileiros", "Voo da") quanto EN ("From R$", "flight")
            await page.waitForFunction(
                () => [...document.querySelectorAll('div[data-id]')].some(el => {
                    const link = el.querySelector('[aria-label]');
                    const a = link?.getAttribute('aria-label') ?? '';
                    return /Reais brasileiros|Voo da |From R\$|From BRL|BRL\s*\d|\bflight\b/i.test(a);
                }),
                { timeout: 18000 }
            ).catch(() => console.log(`[GFlights] ${origin}→${destination}: timeout aguardando cards de voo`));

            // ── Comportamento humano: movimento de mouse + scroll aleatório ────
            await page.mouse.move(randInt(200, vw - 200), randInt(100, vh / 2));
            await new Promise(r => setTimeout(r, randInt(150, 350)));
            await page.mouse.move(randInt(100, vw - 300), randInt(vh / 3, vh - 200));
            await new Promise(r => setTimeout(r, randInt(100, 250)));
            await page.evaluate((scrollY) => window.scrollBy(0, scrollY), randInt(80, 220));
            await new Promise(r => setTimeout(r, randInt(900, 1800)));

            // Log diagnóstico: quantos div[data-id] e primeiros aria-labels
            const diagInfo = await page.evaluate(() => {
                const divs = [...document.querySelectorAll('div[data-id]')];
                const labels = divs.slice(0, 3).map(el => {
                    const link = el.querySelector('[aria-label]');
                    return (link?.getAttribute('aria-label') ?? '').slice(0, 120);
                });
                return { count: divs.length, labels };
            });
            console.log(`[GFlights] ${origin}→${destination}: div[data-id]=${diagInfo.count}, primeiros aria-labels:`, JSON.stringify(diagInfo.labels));

            const flights = await page.evaluate(({ _origin, _destination, _iataToAirline }) => {
                // Parser bilíngue PT + EN baseado em aria-label do Google Flights
                function to24h(time, ampm) {
                    let [h, m] = time.split(':').map(Number);
                    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
                    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
                    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
                }

                function parseAriaLabel(aria) {
                    if (!aria) return null;

                    // ── Preço ────────────────────────────────────────────────────────────────
                    // PT: "A partir de 2276 Reais brasileiros"
                    // EN: "From R$1,234" or "From BRL 1,234"
                    let preco_brl = 0;
                    const pricePT = aria.match(/(?:A partir de )?(\d[\d\s.]+)\s+Reais\s+brasileiros/i);
                    if (pricePT) preco_brl = parseInt(pricePT[1].replace(/[\s.]/g, ''), 10);
                    if (!preco_brl) {
                        // Handles: "From R$1,234" / "R$ 3.145" (dot=thousands) / "R$ 2 276" (space=thousands)
                        const priceEN = aria.match(/(?:From\s+)?(?:R\$|BRL\s*)([\d][\d,. ]*)/i);
                        if (priceEN) preco_brl = parseInt(priceEN[1].replace(/[,. ]/g, ''), 10) || 0;
                    }
                    if (!preco_brl) return null;

                    // ── Números de voo (extraídos cedo para usar como fallback de companhia) ──
                    const flightNumsEarly = [...aria.matchAll(/\b([A-Z]{1,2})\s*(\d{3,5})\b/g)]
                        .map(m => `${m[1]}${m[2]}`)
                        .filter(n => !/^\d/.test(n))
                        .slice(0, 4);

                    // ── Companhia ────────────────────────────────────────────────────────────
                    // PT: "Voo da LATAM" / "Voo do United" / "Voo das..." / "Voo dos..."
                    // EN: "American Airlines flight with 1 stop"
                    let companhia = '';
                    // PT: [^,.\n] evita capturar além da linha/sentença
                    const airlinePT = aria.match(/Voo d(?:a|o|as|os|e) ([^,.\n]+?)(?:\s+com\s+|\.|,|\n|[Oo]perado|\s*$)/i);
                    if (airlinePT) companhia = airlinePT[1].trim();
                    if (!companhia) {
                        // EN: "American Airlines flight" / "Select LATAM Airlines flight"
                        const airlineEN = aria.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{2,40}?)\s+flight\b/i);
                        if (airlineEN) {
                            let candidate = airlineEN[1].trim();
                            // Strip leading action verbs (e.g. "Select LATAM Airlines" → "LATAM Airlines")
                            candidate = candidate.replace(/^(?:Select|Book|Choose|Departing|Outbound|Return|Returning)\s+/i, '').trim();
                            if (candidate && !/^(nonstop|direct|total|from|your|this|the|a|an|select|book|choose)$/i.test(candidate))
                                companhia = candidate;
                        }
                    }
                    if (!companhia) {
                        // EN alternativo: "flight on/with/by AIRLINE"
                        const flightOn = aria.match(/flight\s+(?:on|with|by)\s+([^,.\n]+?)(?:\.|,|\n|with|$)/i);
                        if (flightOn) companhia = flightOn[1].trim();
                    }
                    if (!companhia) {
                        const operated = aria.match(/(?:[Oo]perado\s+por|[Oo]perated\s+by)\s+([^,.\n]+?)(?:\.|,|\n|$)/);
                        if (operated) companhia = operated[1].trim();
                    }
                    if (!companhia) {
                        if (/múltiplas companhias|multiple airlines/i.test(aria)) companhia = 'Múltiplas companhias';
                    }
                    // Fallback: procura nomes conhecidos em qualquer parte do aria-label
                    if (!companhia) {
                        const knownNames = [
                            'LATAM Airlines','LATAM Brasil','Latam Airlines Brasil','GOL Linhas Aéreas','GOL','Azul Linhas Aéreas','Azul','Azul Conecta',
                            'Avianca','Copa Airlines','American Airlines','United Airlines','Delta Air Lines',
                            'Air France','KLM','Lufthansa','TAP Air Portugal','Iberia','British Airways',
                            'Emirates','Qatar Airways','Turkish Airlines','Swiss','Austrian Airlines','Etihad Airways',
                            'Ethiopian Airlines','Aeromexico','Aeroméxico','Air Europa',
                            'Singapore Airlines','Cathay Pacific','Japan Airlines','ANA','All Nippon Airways',
                            'Alaska Airlines','JetBlue','Virgin Atlantic','ITA Airways',
                            'Aerolíneas Argentinas','Aerolineas Argentinas','Sky Airline','JetSmart',
                            'Air Canada','WestJet','Air Transat','Porter Airlines',
                            'Finnair','SAS','Ryanair','easyJet','Wizz Air',
                            'Vueling','Norwegian','Transavia','Iberia Express','Volotea','Binter Canarias',
                            'Condor','TUI Airways','Aegean Airlines','Air Serbia','SmartWings',
                            'Spirit Airlines','Frontier Airlines','Southwest Airlines','Hawaiian Airlines',
                            'Korean Air','Air China','China Southern','China Eastern',
                            'Thai Airways','Malaysia Airlines','Vistara','IndiGo','SpiceJet',
                            'Asiana Airlines','China Airlines','EVA Air',
                            'Vietnam Airlines','Philippine Airlines','Garuda Indonesia',
                            'Jetstar','Scoot','Peach Aviation','AirAsia','AirAsia X','Cebu Pacific',
                            'flydubai','Air Arabia','EgyptAir','Royal Air Maroc','Saudia','Oman Air',
                            'Gulf Air','Air India','Royal Jordanian','Air Algérie','Air Astana',
                            'VOEPASS','MAP Linhas Aéreas','Norse Atlantic','RwandAir',
                            'Kenya Airways','South African Airways','Pegasus Airlines','SunExpress',
                        ];
                        for (const n of knownNames) {
                            if (aria.toLowerCase().includes(n.toLowerCase())) { companhia = n; break; }
                        }
                    }
                    // Fallback pelo prefixo do número de voo (IATA code → companhia)
                    if (!companhia && flightNumsEarly.length > 0) {
                        const CODE_TO_AIRLINE = _iataToAirline;
                        for (const num of flightNumsEarly) {
                            const code = num.match(/^([A-Z]{1,2})/)?.[1] ?? '';
                            if (CODE_TO_AIRLINE[code]) { companhia = CODE_TO_AIRLINE[code]; break; }
                        }
                    }

                    // ── Paradas ──────────────────────────────────────────────────────────────
                    // PT: "Sem escalas" / "Direto" / "com 1 parada"
                    // EN: "Nonstop" / "1 stop"
                    let paradas = 0; // default 0: se não há indicação explícita de conexão, é direto
                    if (/Sem escalas|Nonstop|\bDireto\b/i.test(aria)) {
                        paradas = 0;
                    } else {
                        const stopsPT = aria.match(/com\s+(\d+)\s+parada/i) || aria.match(/(\d+)\s+escala/i);
                        const stopsEN = aria.match(/(\d+)\s+stop/i);
                        if (stopsPT) paradas = parseInt(stopsPT[1]);
                        else if (stopsEN) paradas = parseInt(stopsEN[1]);
                        // Se menciona "parada" ou "escala" sem número → 1
                        else if (/\bparada\b|\bescala\b|\bstop\b/i.test(aria)) paradas = 1;
                    }

                    // ── Horários ─────────────────────────────────────────────────────────────
                    // PT: "às 05:25 do dia" ou "às 05:25" (sem "do dia")
                    // EN: "8:00 AM" / "3:30 PM"
                    let partida = '';
                    let chegada = '';
                    // Aceita "às HH:MM" com ou sem "do dia" a seguir
                    const timesPT = [...aria.matchAll(/às (\d{1,2}:\d{2})(?:\s+do\s+dia)?/gi)];
                    if (timesPT.length >= 1) partida = timesPT[0][1];
                    if (timesPT.length >= 2) chegada = timesPT[1][1];
                    if (!partida) {
                        const timesEN = [...aria.matchAll(/(\d{1,2}:\d{2})\s*(AM|PM)/gi)];
                        if (timesEN.length >= 1) partida = to24h(timesEN[0][1], timesEN[0][2]);
                        if (timesEN.length >= 2) chegada = to24h(timesEN[1][1], timesEN[1][2]);
                    }
                    // Fallback: HH:MM isolado (sem AM/PM e sem "às") — pega o 1º e 2º par
                    if (!partida) {
                        const timesRaw = [...aria.matchAll(/\b(\d{1,2}:\d{2})\b/g)]
                            .filter(m => !/^\d{4}$/.test(m[1])); // exclui anos
                        if (timesRaw.length >= 1) partida = timesRaw[0][1].padStart(5, '0').replace(/^(\d):/, '0$1:');
                        if (timesRaw.length >= 2) chegada = timesRaw[1][1].padStart(5, '0').replace(/^(\d):/, '0$1:');
                    }

                    // ── Offset de chegada ────────────────────────────────────────────────────
                    // PT: "dia quinta-feira, abril 16" / EN: "Mon, Mar 20"
                    let chegadaOffset = 0;
                    const daysPT = [...aria.matchAll(/dia \w+-feira, \w+ (\d+)|dia \w+, \w+ (\d+)|dia (\d{1,2}) de \w+/gi)];
                    if (daysPT.length >= 2) {
                        const d1 = parseInt(daysPT[0][1] ?? daysPT[0][2] ?? daysPT[0][3] ?? '0');
                        const d2 = parseInt(daysPT[1][1] ?? daysPT[1][2] ?? daysPT[1][3] ?? '0');
                        if (d2 > d1) chegadaOffset = d2 - d1;
                    }
                    if (!chegadaOffset) {
                        const daysEN = [...aria.matchAll(/\w{3},\s*\w{3}\s+(\d{1,2})/g)];
                        if (daysEN.length >= 2) {
                            const d1 = parseInt(daysEN[0][1]);
                            const d2 = parseInt(daysEN[1][1]);
                            if (d2 > d1) chegadaOffset = d2 - d1;
                        }
                    }

                    // ── Duração total ────────────────────────────────────────────────────────
                    // PT: "Duração total: 12h 15 min" / EN: "Total duration 12 hr 15 min"
                    let duracao_min = 0;
                    const durPT = aria.match(/Dura[çc][aã]o\s*(?:total)?[:\s]+(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(?:(\d+)\s*min(?:utos?)?)?/i);
                    if (durPT) duracao_min = parseInt(durPT[1]) * 60 + (durPT[2] ? parseInt(durPT[2]) : 0);
                    if (!duracao_min) {
                        const durEN = aria.match(/Total\s+duration\s+(\d+)\s*hr?s?\s*(?:(\d+)\s*min)?/i);
                        if (durEN) duracao_min = parseInt(durEN[1]) * 60 + (durEN[2] ? parseInt(durEN[2]) : 0);
                    }

                    // ── Cidade de conexão ─────────────────────────────────────────────────────
                    // Prioridade: nome da cidade visível, fallback para código IATA
                    let layoverCity = '';
                    {
                        // Estratégia 1: "em CityName (IATA)" — usa o nome da cidade
                        const cityIataRe = /(?:Parada|Escala|Layover)[^;\n]*?em\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s\-'\.]{1,40}?)\s*\(([A-Z]{3})\)/gi;
                        const foundCities = [];
                        let sm;
                        while ((sm = cityIataRe.exec(aria)) !== null) {
                            const city = sm[1].trim().replace(/\s+/g, ' ');
                            if (city.length >= 2) foundCities.push(city);
                            else foundCities.push(sm[2]);
                        }
                        if (foundCities.length > 0) layoverCity = [...new Set(foundCities)].join(' · ');
                    }
                    // Fallback 1: só o IATA entre parênteses após Parada/Escala/Layover
                    if (!layoverCity) {
                        const iataRe = /(?:Parada|Escala|Layover)[^;\n]*?\(([A-Z]{3})\)/gi;
                        const found = [];
                        let sm;
                        while ((sm = iataRe.exec(aria)) !== null) found.push(sm[1]);
                        if (found.length > 0) layoverCity = [...new Set(found)].join(' · ');
                    }
                    // Fallback 2: "em CityName" sem parênteses
                    if (!layoverCity) {
                        const lm2 = aria.match(/(?:Parada|Escala)[^;\n]*?\bem\s+([A-ZÀ-Ÿa-zà-ÿ][^.,()\n;]{2,35}?)(?=\s*(?:\(|[.;,\n]|$))/i);
                        if (lm2) layoverCity = lm2[1].trim();
                    }
                    if (!layoverCity) {
                        const lm3 = aria.match(/Layover[^;\n]*?\bin\s+([A-Z][^.,()\n;]{2,35}?)(?=\s*(?:\(|[.;,\n]|$))/i);
                        if (lm3) layoverCity = lm3[1].trim();
                    }
                    // Fallback 3: IATAs intermediários em parênteses
                    if (!layoverCity) {
                        const allIata = [...aria.matchAll(/\(([A-Z]{3})\)/g)].map(m => m[1]);
                        if (allIata.length >= 3) {
                            const middle = allIata.slice(1, -1);
                            if (middle.length > 0) layoverCity = [...new Set(middle)].join(' · ');
                        }
                    }

                    // ── Durações de conexão ────────────────────────────────────────────────────
                    // Coleta todos os padrões PT e EN, remove duplicatas
                    const ldRaw = [
                        ...[...aria.matchAll(/Parada\s*\(\s*\d+\s*de\s*\d+\s*\)\s*de\s*(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(?:(\d+)\s*min(?:utos?)?)?/gi)]
                            .map(m => parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0)),
                        ...[...aria.matchAll(/Parada\s+de\s+(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(?:(\d+)\s*min(?:utos?)?)?/gi)]
                            .map(m => parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0)),
                        ...[...aria.matchAll(/Layover\s*\(\s*\d+\s*of\s*\d+\s*\)\s*(\d+)\s*hr?s?\s*(?:(\d+)\s*min)?/gi)]
                            .map(m => parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0)),
                        ...[...aria.matchAll(/Layover\s+(\d+)\s*hr?s?\s*(?:(\d+)\s*min)?/gi)]
                            .map(m => parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0)),
                    ];
                    const layoverDurations = [...new Set(ldRaw.filter(d => d > 0))];

                    // ── Aeronave ─────────────────────────────────────────────────────────────
                    let aeronave = '';
                    const aircraftMatch = aria.match(/(?:Airbus|Boeing|Embraer|ATR|Bombardier)\s+[A-Z]?\d+[-A-Z0-9]*/i);
                    if (aircraftMatch) aeronave = aircraftMatch[0].trim();

                    // ── Cabine ───────────────────────────────────────────────────────────────
                    let cabin = 'economy';
                    if (/[Ee]xecutiv[ao]|[Bb]usiness/i.test(aria)) cabin = 'business';
                    else if (/[Pp]rimeira\s+classe|[Ff]irst\s+class/i.test(aria)) cabin = 'first';
                    else if (/[Pp]remium\s+[Ee]conom|[Pp]remière/i.test(aria)) cabin = 'premium_economy';

                    return {
                        companhia,
                        partida,
                        chegada,
                        chegadaOffset,
                        duracao_min,
                        paradas,
                        layoverCity,
                        layoverDurations,
                        preco_brl,
                        aeronave,
                        cabin,
                        segmentos: [],
                        numeroVoos: flightNumsEarly,
                        aeronaves: aeronave ? [aeronave] : [],
                    };
                }

                // Lista de companhias conhecidas reutilizada nos fallbacks
                const KNOWN_AIRLINES = [
                    'LATAM Airlines','LATAM Brasil','GOL Linhas Aéreas','GOL','Azul Linhas Aéreas','Azul','Azul Conecta',
                    'Avianca','Copa Airlines','American Airlines','United Airlines','Delta Air Lines',
                    'Air France','KLM','Lufthansa','TAP Air Portugal','Iberia','British Airways',
                    'Emirates','Qatar Airways','Turkish Airlines','Swiss','Austrian Airlines',
                    'Ethiopian Airlines','Aeromexico','Aeroméxico','Air Europa','Etihad Airways',
                    'Singapore Airlines','Cathay Pacific','Japan Airlines','ANA','All Nippon Airways',
                    'Alaska Airlines','JetBlue','Virgin Atlantic','ITA Airways',
                    'Aerolíneas Argentinas','Aerolineas Argentinas','Sky Airline','JetSmart',
                    'Air Canada','WestJet','Air Transat','Porter Airlines','Finnair','SAS',
                    'Ryanair','easyJet','Wizz Air','Vueling','Norwegian','Transavia','Volotea',
                    'Iberia Express','Condor','TUI Airways','Aegean Airlines','Binter Canarias',
                    'Spirit Airlines','Frontier Airlines','Southwest Airlines','Hawaiian Airlines',
                    'Korean Air','Air China','China Southern','China Eastern',
                    'Thai Airways','Malaysia Airlines','Asiana Airlines','China Airlines','EVA Air',
                    'Vietnam Airlines','Philippine Airlines','Garuda Indonesia',
                    'Jetstar','Scoot','Peach Aviation','AirAsia','AirAsia X','Cebu Pacific',
                    'IndiGo','SpiceJet','Air India','Vistara',
                    'EgyptAir','Royal Air Maroc','Saudia','Oman Air','Gulf Air',
                    'flydubai','Air Arabia','Royal Jordanian','Air Algérie','Air Astana',
                    'VOEPASS','MAP Linhas Aéreas','Norse Atlantic','RwandAir','Kenya Airways',
                    'South African Airways','Pegasus Airlines','SunExpress','SmartWings',
                ];

                const results = [];
                const divs = [...document.querySelectorAll('div[data-id]')];
                let _divIdx = 0;
                for (const el of divs) {
                    const _curDivIdx = _divIdx++;
                    // Encontra o elemento filho com aria-label de voo (PT ou EN)
                    const links = [...el.querySelectorAll('[aria-label]')];
                    const flightLink = links.find(l => {
                        const a = l.getAttribute('aria-label') ?? '';
                        // Matches PT ("Voo da X", "Selecionar voo") and EN ("From R$", "flight" + price)
                        // Also matches bare "R$ 3.145" (round-trip tfs format without "From" prefix)
                        return /Reais brasileiros|Voo da |Selecionar voo|R\$\s*\d|From R\$|From BRL|BRL\s*\d/i.test(a)
                            || (/\bflight\b/i.test(a) && /R\$|\d+:\d+/i.test(a));
                    });
                    if (!flightLink) continue;

                    const aria = flightLink.getAttribute('aria-label') ?? '';
                    const parsed = parseAriaLabel(aria);
                    if (!parsed || parsed.preco_brl <= 0 || !parsed.partida) continue;

                    // ── Fallback 1: outras aria-labels do card (companhia) ────────────────────
                    if (!parsed.companhia) {
                        for (const l of links) {
                            if (l === flightLink) continue;
                            const oa = l.getAttribute('aria-label') ?? '';
                            if (!oa) continue;
                            const ptM = oa.match(/Voo d(?:a|o|as|os|e) ([^,.]+?)(?:\s+com\s+|\.|,|\s*$)/i);
                            if (ptM) { parsed.companhia = ptM[1].trim(); break; }
                            const enM = oa.match(/\b([A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\s]{2,40}?)\s+flight\b/i);
                            if (enM) {
                                let c = enM[1].trim().replace(/^(?:Select|Book|Choose|Departing|Outbound|Return|Returning)\s+/i, '').trim();
                                if (c && !/^(nonstop|direct|total|from|your|the|a|an|select|book)$/i.test(c)) { parsed.companhia = c; break; }
                            }
                        }
                    }

                    // ── Fallback 2: img[alt] — logotipo da companhia ──────────────────────────
                    if (!parsed.companhia) {
                        const imgs = [...el.querySelectorAll('img[alt]')];
                        for (const img of imgs) {
                            const alt = (img.getAttribute('alt') ?? '').replace(/\s*logo\s*/gi, '').trim();
                            if (!alt || alt.length < 2 || alt.length > 60) continue;
                            for (const n of KNOWN_AIRLINES) {
                                if (alt.toLowerCase().includes(n.toLowerCase())) { parsed.companhia = n; break; }
                            }
                            // Se o alt não bateu na lista mas parece nome de companhia, usa direto
                            if (!parsed.companhia && /[A-Za-z]{3}/.test(alt) && !/^\d/.test(alt)) {
                                parsed.companhia = alt;
                            }
                            if (parsed.companhia) break;
                        }
                    }

                    // ── Fallback 3: texto visível do card (companhia) ─────────────────────────
                    const visText = (el.innerText || el.textContent || '');
                    const visLower = visText.toLowerCase();
                    if (!parsed.companhia && visText) {
                        for (const n of KNOWN_AIRLINES) {
                            if (visLower.includes(n.toLowerCase())) { parsed.companhia = n; break; }
                        }
                    }
                    // ── Fallback 5 (último recurso): extrai da 1ª linha de texto que pareça
                    //    nome de companhia — captura qualquer companhia, mesmo desconhecida ──────
                    if (!parsed.companhia && visText) {
                        // skipLine: rejeita linhas genéricas, numéricas ou rótulos de acessibilidade do Google
                        const skipLine = /^(\d{1,2}:\d{2}|R\$|BRL|\d+\s*h(?:\s*\d+\s*min)?|\d+\s*(parada|conexão|escala|stop|min)|sem\s+escala|nonstop|direto|selec|ver\s+det|\d+\s*de\s*\d+|\d+[.,]\d|companhia\s+a[eé]rea|multiple\s+airlines|múltiplas\s+companhias|airline[s]?|more\s+details|mais\s+detalhes)/i;
                        const lines = visText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length >= 3 && l.length <= 55);
                        for (const line of lines) {
                            if (skipLine.test(line)) continue;
                            if (/^[A-Za-zÀ-ÿ]/.test(line) && /[A-Za-zÀ-ÿ]{2}/.test(line)) {
                                parsed.companhia = line;
                                break;
                            }
                        }
                    }

                    // ── Fallback 4: cidade de conexão pelo texto visível ─────────────────────
                    // Usa _origin/_destination (passados via evaluate args) para excluir origem/destino
                    if (!parsed.layoverCity && parsed.paradas > 0 && visText) {
                        const orig = _origin;
                        const dest = _destination;
                        // 4a. Bullet or dot separator: "GRU · BOG · MIA" → BOG
                        const bulletM = visText.match(/[·•–\|]\s*([A-Z]{3})\b/g);
                        if (bulletM) {
                            const iatas = bulletM.map(m => m.replace(/[·•–\|\s]/g, '')).filter(c => c !== orig && c !== dest);
                            if (iatas.length > 0) parsed.layoverCity = [...new Set(iatas)].join(' · ');
                        }
                        // 4b. "Via BOG" / "via BOG"
                        if (!parsed.layoverCity) {
                            const viaM = visText.match(/\bvia\s+([A-Z]{3})\b/i);
                            if (viaM && viaM[1] !== orig && viaM[1] !== dest) parsed.layoverCity = viaM[1];
                        }
                        // 4c. Row of IATAs — now correctly excludes origin and destination
                        if (!parsed.layoverCity) {
                            const allIataVis = [...visText.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]);
                            const mid = allIataVis.filter(c => c !== orig && c !== dest && /^[A-Z]{3}$/.test(c));
                            if (mid.length > 0) parsed.layoverCity = [...new Set(mid)].slice(0, 2).join(' · ');
                        }
                    }
                    // ── Fallback 5: inner aria-labels de outros elementos do card ────────────
                    if (!parsed.layoverCity && parsed.paradas > 0) {
                        for (const l of links) {
                            if (l === flightLink) continue;
                            const oa = l.getAttribute('aria-label') ?? '';
                            const legIatas = [...oa.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]);
                            const mid = legIatas.filter(c => c !== _origin && c !== _destination);
                            if (mid.length > 0) { parsed.layoverCity = [...new Set(mid)].slice(0, 2).join(' · '); break; }
                        }
                    }

                    parsed._domIdx = _curDivIdx; // store DOM index for expandFlightDetails
                    results.push(parsed);
                    if (results.length >= 15) break;
                }

                return results;
            }, { _origin: origin.toUpperCase(), _destination: destination.toUpperCase(), _iataToAirline: IATA_TO_AIRLINE });

            console.log(`[GFlights] ${origin}→${destination}: ${flights.length} voos encontrados`);
            if (flights.length > 0) {
                flights.forEach((f, i) => console.log(
                    `  [${i}] ${f.companhia || '(sem companhia)'} | R$${f.preco_brl} | ${f.partida}→${f.chegada} | paradas=${f.paradas} | conexao=${f.layoverCity || '-'}`
                ));
            }

            // Extrai o gráfico de preços ANTES de expandir cards (página em estado inicial)
            await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
            await new Promise(r => setTimeout(r, 300));
            const priceGraph = await scrapePriceGraph(page, origin, destination).catch(e => {
                console.log('[GFlights] priceGraph erro:', e.message?.slice(0, 80));
                return null;
            });
            if (priceGraph) console.log(`[GFlights] priceGraph: ${priceGraph.bars?.length ?? 0} barras, pageQuality=${priceGraph.pageQuality}`);
            else console.log('[GFlights] priceGraph: não encontrado (botão não clicou ou sem dados)');

            // Expande voos com conexão para extrair segmentos detalhados
            if (flights.length > 0 && flights.some(f => (f.paradas ?? 0) > 0)) {
                await expandFlightDetails(page, flights).catch(e =>
                    console.log('[GFlights] expandFlightDetails error:', e.message?.slice(0, 80))
                );
            }

            await context.close();
            return { flights, priceGraph };
        } catch (err) {
            if (context) { try { await context.close(); } catch (_) {} }
            const isBrowserDead = /closed|disconnected|Target page|crashed/i.test(err.message ?? '');
            if (isBrowserDead && attempt < 2) {
                console.warn(`[GFlights] ${origin}→${destination} — browser morto (tentativa ${attempt}), reiniciando...`);
                clearBrowserRef();
                continue;
            }
            console.error(`[GFlights] ${origin}→${destination} erro:`, err.message);
            return { flights: [], priceGraph: null };
        }
        } // end for
        return { flights: [], priceGraph: null };
    });
}

// Converte resultado do scraper para o formato FlightOffer usado no frontend
function normalizeTime(t) {
    if (!t) return '12:00';
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '12:00';
    return m[1].padStart(2, '0') + ':' + m[2];
}

function mapToFlightOffer(item, origin, destination, date, idx) {
    const arrivalDate = addDaysToDate(date, item.chegadaOffset || 0);
    let companhia = normalizeAirline(item.companhia) || '';

    // 1. Código pelo nome normalizado
    let carrierCode = companhia ? (AIRLINE_CODE_MAP[companhia] || '') : '';

    // 2. Fallback: extrai código IATA do prefixo do número de voo (ex: "LA3547" → "LA")
    if (!carrierCode) {
        for (const num of (item.numeroVoos || [])) {
            const code = num.match(/^([A-Z]{2})/)?.[1];
            if (code) { carrierCode = code; break; }
        }
    }

    // 3. Com código mas sem nome: busca no mapa reverso IATA → nome
    if (!companhia && carrierCode && IATA_TO_AIRLINE[carrierCode]) {
        companhia = IATA_TO_AIRLINE[carrierCode];
    }

    // 4. Ainda sem nome: usa o texto bruto ou o próprio código como nome legível
    if (!companhia) companhia = item.companhia?.trim() || carrierCode || 'Companhia aérea';
    if (!carrierCode) carrierCode = '';
    return {
        id: `gf-${idx}-${Date.now()}`,
        companhia,
        carrierCode,
        preco_brl: item.preco_brl,
        taxas_brl: 0,
        partida: date + 'T' + normalizeTime(item.partida) + ':00',
        chegada: arrivalDate + 'T' + normalizeTime(item.chegada) + ':00',
        origem: origin.toUpperCase(),
        destino: destination.toUpperCase(),
        duracao_min: item.duracao_min || 0,
        paradas: item.paradas ?? 0,
        cabin_class: item.cabin ?? 'economy',
        voo_numero: '',
        segmentos: item.segmentos || [],
        layoverCity: iataToCity(item.layoverCity || ''),
        layoverDurations: item.layoverDurations || [],
        numeroVoos: item.numeroVoos || [],
        aeronaves: item.aeronaves || [],
        flight_key: `gf-${origin}-${destination}-${date}-${idx}`,
        provider: 'google',
        isRoundtripTotal: item.is_roundtrip_total || false,
        returnPartida: item.return_partida ?? null,
    };
}

// ── Cache em memória para Google Flights (TTL 4h, LRU max 300 entradas) ───────
const _gfCache = new Map();    // key → { data, inbound, expiresAt }
const _gfInflight = new Map(); // key → Promise (deduplicação de requests simultâneos)
const GF_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas
const GF_CACHE_MAX = 300;

function gfCacheSet(key, value) {
    // Evicta entrada mais antiga (LRU simples via inserção Map) se limite atingido
    if (_gfCache.size >= GF_CACHE_MAX) {
        _gfCache.delete(_gfCache.keys().next().value);
    }
    _gfCache.set(key, value);
}

function gfCacheKey(origin, dest, date, returnDate) {
    return `${origin}|${dest}|${date}|${returnDate ?? ''}`;
}

// ─── Extração do gráfico de preços do Google Flights ─────────────────────────
async function scrapePriceGraph(page, origin, destination) {
    // Tenta clicar no botão de histórico de preços (vários seletores)
    const clicked = await page.evaluate(() => {
        const allClickable = [...document.querySelectorAll('button, [role="button"], a, [jsaction]')];

        // Strategy 1: texto sobre histórico / preço habitual
        const byText = allClickable.find(el => {
            const t = (el.textContent ?? '') + ' ' + (el.getAttribute('aria-label') ?? '');
            return /hist[oó]rico|price history|preço.{0,30}habitual|típico|typical|trend|ver preço|price graph|gráfico/i.test(t);
        });
        if (byText) { byText.click(); return 'text'; }

        // Strategy 2: botão expandível sobre preços
        const byExpanded = [...document.querySelectorAll('[aria-expanded="false"]')].find(el => {
            const t = (el.textContent ?? '') + ' ' + (el.getAttribute('aria-label') ?? '');
            return /hist[oó]rico|preço|price|típico|typical|calendar|calend/i.test(t);
        });
        if (byExpanded) { byExpanded.click(); return 'expanded'; }

        // Strategy 3: ícone de calendário / gráfico de barras próximo da área de preço
        const calBtn = document.querySelector('[data-ved] svg[viewBox], [aria-label*="calend"], [aria-label*="calendar"], [aria-label*="gráfico"], [aria-label*="graph"]');
        if (calBtn) { const btn = calBtn.closest('button, [role="button"]'); if (btn) { btn.click(); return 'icon'; } }

        return false;
    }).catch(() => false);

    console.log(`[priceGraph] botão clicado=${clicked}`);
    await new Promise(r => setTimeout(r, clicked ? 1200 : 500));

    // Scroll para revelar o gráfico caso não esteja visível
    await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
    await new Promise(r => setTimeout(r, 400));

    // Estratégia extra: clica no campo de data para abrir o calendário de preços
    if (!clicked) {
        const dateClicked = await page.locator([
            '[aria-label*="Data de partida"]',
            '[aria-label*="Departure date"]',
            '[aria-label*="Ida"]',
            'input[placeholder*="Ida"]',
            '[data-field="departureDate"]',
        ].join(', ')).first().click({ timeout: 4000 }).then(() => true).catch(() => false);

        if (dateClicked) {
            console.log('[priceGraph] calendário de datas aberto');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const graph = await page.evaluate(() => {
        const PT_MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        const PT_MONTHS_ABBREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

        function parsePtDate(label) {
            // Full month: "15 de março" / "15 de março de 2026"
            for (let m = 0; m < PT_MONTHS.length; m++) {
                const re = new RegExp(`(\\d{1,2})\\s+de\\s+${PT_MONTHS[m]}(?:\\s+de\\s+(\\d{4}))?`, 'i');
                const match = label.match(re);
                if (match) {
                    const day = parseInt(match[1], 10);
                    const year = match[2] ? parseInt(match[2], 10) : new Date().getFullYear();
                    return `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
            }
            // Abbreviated: "15 mai" / "1 jan" / "15 mai 2026"
            for (let m = 0; m < PT_MONTHS_ABBREV.length; m++) {
                const re = new RegExp(`(\\d{1,2})\\s+${PT_MONTHS_ABBREV[m]}(?:\\s+(\\d{4}))?(?=[^a-z]|$)`, 'i');
                const match = label.match(re);
                if (match) {
                    const day = parseInt(match[1], 10);
                    const year = match[2] ? parseInt(match[2], 10) : new Date().getFullYear();
                    return `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
            }
            return null;
        }

        function parsePrice(label) {
            // Handles: "R$ 2.276", "R$ 2 276", "R$2276", "2.276 Reais", "2 276 Reais"
            // Both dot and space are used as thousands separators in PT-BR
            const m1 = label.match(/R\$\s*([\d][\d\s.]*)/);
            if (m1) return parseInt(m1[1].replace(/[\s.]/g, ''), 10) || 0;
            const m2 = label.match(/([\d][\d\s.]*)\s*Reais/i);
            if (m2) return parseInt(m2[1].replace(/[\s.]/g, ''), 10) || 0;
            return 0;
        }

        function parseQuality(label) {
            if (/mais barato|cheaper|low price|baixo/i.test(label)) return 'low';
            if (/mais caro|higher|expensive|caro/i.test(label)) return 'high';
            return 'typical';
        }

        const EN_MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
        const EN_MONTHS_ABBREV = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

        function parseEnDate(label) {
            const low = label.toLowerCase();
            // "May 15" / "May 15, 2026" / "15 May" / "15 May 2026"
            for (let m = 0; m < EN_MONTHS.length; m++) {
                const abbr = EN_MONTHS_ABBREV[m];
                const full = EN_MONTHS[m];
                for (const mon of [abbr, full]) {
                    let match = low.match(new RegExp(`${mon}\\s+(\\d{1,2})(?:[^\\d]|$)`));
                    if (match) {
                        const year = new Date().getFullYear();
                        return `${year}-${String(m+1).padStart(2,'0')}-${String(parseInt(match[1])).padStart(2,'0')}`;
                    }
                    match = low.match(new RegExp(`(\\d{1,2})\\s+${mon}(?:\\s+(\\d{4}))?(?:[^a-z]|$)`));
                    if (match) {
                        const year = match[2] ? parseInt(match[2]) : new Date().getFullYear();
                        return `${year}-${String(m+1).padStart(2,'0')}-${String(parseInt(match[1])).padStart(2,'0')}`;
                    }
                }
            }
            return null;
        }

        // Tenta múltiplos seletores: barras SVG, buttons, e qualquer elemento com preço+data
        const candidates = [
            ...document.querySelectorAll('g[aria-label]'),
            ...document.querySelectorAll('rect[aria-label]'),
            ...document.querySelectorAll('button[aria-label]'),
            ...document.querySelectorAll('[role="button"][aria-label]'),
            ...document.querySelectorAll('li[aria-label]'),
            ...document.querySelectorAll('td[aria-label]'),
            ...document.querySelectorAll('[data-price][aria-label]'),
        ];

        const bars = [];
        const seenDates = new Set();
        for (const el of candidates) {
            const label = el.getAttribute('aria-label') ?? '';
            if (!label) continue;
            if (!/R\$|Reais/i.test(label)) continue;
            // Aceita datas em PT ou EN
            const hasPtDate = /\d{1,2}\s+(?:de\s+|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i.test(label);
            const hasEnDate = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(label);
            if (!hasPtDate && !hasEnDate) continue;

            const date = parsePtDate(label) || parseEnDate(label);
            const price = parsePrice(label);
            if (!date || !price || seenDates.has(date)) continue;

            seenDates.add(date);
            bars.push({ date, price, quality: parseQuality(label) });
        }

        bars.sort((a, b) => a.date.localeCompare(b.date));

        // Extrai badge de qualidade geral da página (visível sem clicar em botão nenhum)
        // Ex: "Preços típicos para esta rota" / "Preço baixo" / "Currently low prices"
        let pageQuality = null;
        const qualitySelectors = [
            ...document.querySelectorAll('[aria-label]'),
            ...document.querySelectorAll('[role="status"]'),
            ...document.querySelectorAll('[data-flt-ve]'),
            ...document.querySelectorAll('span, div, p'),
        ];
        for (const el of qualitySelectors) {
            const t = ((el.textContent ?? '') + ' ' + (el.getAttribute('aria-label') ?? '')).trim();
            if (t.length < 4 || t.length > 300) continue;
            if (/mais barato|price(s)?\s+low|currently low|preço(s)?\s+(mais\s+)?baixo|low price|cheap/i.test(t)) { pageQuality = 'low'; break; }
            if (/mais caro|price(s)?\s+high|currently high|preço(s)?\s+(mais\s+)?alto|high price|expensive/i.test(t)) { pageQuality = 'high'; break; }
            if (/preço(s)?\s+típico|typical\s+price|preço(s)?\s+normal|preço(s)?\s+usual/i.test(t)) { pageQuality = 'typical'; break; }
        }

        return { bars, pageQuality };
    });

    console.log(`[priceGraph] candidatos escaneados → bars=${graph?.bars?.length ?? 0}, pageQuality=${graph?.pageQuality ?? 'null'}`);
    if (!graph) return null;
    // Return even with 0 bars if we have a pageQuality badge (shows price trend indicator)
    if (graph.bars.length === 0 && !graph.pageQuality) return null;
    return graph;
}

async function doScrape(origin, destination, date, returnDate) {
    if (returnDate) {
        // Round-trip: uma busca combinada com returnDate → Google Flights mostra preço total ida+volta
        // (igual ao que o usuário vê no Google Flights, evita somar dois preços de ida avulsa)
        const rawOut = await scrapeOneway(origin, destination, date, returnDate);
        const outbound = rawOut.flights
            .filter(i => i.preco_brl > 0)
            .map((i, idx) => {
                i.is_roundtrip_total = true;
                i.return_partida = `${returnDate}T00:00:00`;
                return mapToFlightOffer(i, origin, destination, date, idx);
            });
        return { outbound, inbound: [], priceGraph: rawOut.priceGraph ?? null };
    }

    // Ida simples
    const rawOut = await scrapeOneway(origin, destination, date, null);
    const outbound = rawOut.flights
        .filter(i => i.preco_brl > 0)
        .map((i, idx) => mapToFlightOffer(i, origin, destination, date, idx));
    return { outbound, inbound: [], priceGraph: rawOut.priceGraph ?? null };
}

// Expande até MAX_EXPAND voos com conexão para extrair segmentos (limitado para não atrasar a resposta)
const MAX_EXPAND = 6;
async function expandFlightDetails(page, flights) {
    let expanded = 0;
    for (let i = 0; i < flights.length && expanded < MAX_EXPAND; i++) {
        if ((flights[i].paradas ?? 0) === 0) continue;
        expanded++;
        // Use the stored DOM index to find the correct card (fixes off-by-N bug when cards are filtered)
        const domIdx = flights[i]._domIdx ?? i;
        try {
            const cards = await page.$$('div[data-id]');
            if (domIdx >= cards.length) continue;
            const card = cards[domIdx];

            // 1. Prefer [aria-expanded="false"] toggle inside the card
            let clickTarget = await card.$('[aria-expanded="false"]').catch(() => null);

            // 2. Fallback: button with detail-related aria-label
            if (!clickTarget) {
                clickTarget = await card.$([
                    '[aria-label*="mais detalhes"]',
                    '[aria-label*="more details"]',
                    '[aria-label*="detalhes do voo"]',
                    '[aria-label*="flight details"]',
                    '[aria-label*="Ver detalhes"]',
                    '[aria-label*="Expand"]',
                    '[data-expandable]',
                ].join(', ')).catch(() => null);
            }

            // 3. Last resort: click the card row itself
            const clickEl = clickTarget || card;
            await clickEl.click({ timeout: 2000, force: true }).catch(() => null);

            // Wait for expansion: prefer waitForSelector, fall back to fixed delay
            await page.waitForSelector('[aria-expanded="true"], [role="dialog"], [data-fid]', { timeout: 2500 })
                .catch(() => new Promise(r => setTimeout(r, 900)));

            const { dialogText, isDialog } = await page.evaluate((dIdx) => {
                // 1. Modal dialog
                const dialog = document.querySelector('[role="dialog"]');
                if (dialog) {
                    const t = (dialog.innerText || dialog.textContent || '').trim();
                    if (t.length > 50) return { dialogText: t, isDialog: true };
                }
                // 2. data-fid panel
                const fid = document.querySelector('[data-fid]');
                if (fid) {
                    const t = (fid.innerText || fid.textContent || '').trim();
                    if (t.length > 50) return { dialogText: t, isDialog: false };
                }
                // 3. aria-expanded="true" — look for expanded sibling/child content
                for (const el of document.querySelectorAll('[aria-expanded="true"]')) {
                    // Try next sibling element (common accordion pattern)
                    let sib = el.nextElementSibling;
                    while (sib) {
                        const t = (sib.innerText || sib.textContent || '').trim();
                        if (t.length > 50) return { dialogText: t, isDialog: false };
                        sib = sib.nextElementSibling;
                    }
                    // Try parent's next sibling
                    const parentSib = el.parentElement?.nextElementSibling;
                    if (parentSib) {
                        const t = (parentSib.innerText || parentSib.textContent || '').trim();
                        if (t.length > 50) return { dialogText: t, isDialog: false };
                    }
                }
                // 4. Whole card text after expansion (includes segment detail lines)
                const divs = [...document.querySelectorAll('div[data-id]')];
                const card = divs[dIdx];
                if (card) {
                    const t = (card.innerText || card.textContent || '').trim();
                    if (t.length > 80) return { dialogText: t, isDialog: false };
                }
                return { dialogText: '', isDialog: false };
            }, domIdx).catch(() => ({ dialogText: '', isDialog: false }));

            if (dialogText && dialogText.length > 30) {
                const segments = parseSegmentsFromText(dialogText);
                if (segments.length > 0) {
                    flights[i].segmentos = segments;
                    // Preenche layoverCity a partir do IATA da Parada ou destino do 1º segmento
                    if (!flights[i].layoverCity && segments.length > 1) {
                        flights[i].layoverCity = segments[0].layoverCity || segments[0].destino || '';
                    }
                }
                // Tenta extrair pelo menos o IATA da conexão se layoverCity ainda vazio
                if (!flights[i].layoverCity) {
                    // "Parada de 8h 5min\nSão Paulo (GRU)" — multiline
                    const connNext = dialogText.match(/[Pp]arada\s+de[^\n]*\n[^\n]*\(([A-Z]{3})\)/);
                    if (connNext) flights[i].layoverCity = connNext[1];
                }
                if (!flights[i].layoverCity) {
                    // IATA em parênteses na mesma linha que Parada/Layover (permite ponto no meio)
                    const connInline = dialogText.match(/(?:[Pp]arada|[Ll]ayover)[^;\n]*?\(([A-Z]{3})\)/);
                    if (connInline) flights[i].layoverCity = connInline[1];
                }
                if (!flights[i].layoverCity) {
                    // "em Cidade (GRU)" perto de parada
                    const connCity = dialogText.match(/(?:[Pp]arada|[Ll]ayover)[^\n]*\bem\s+[^\n]*?\(([A-Z]{3})\)/);
                    if (connCity) flights[i].layoverCity = connCity[1];
                }
                if (!flights[i].layoverCity) {
                    // Last resort: IATAs em parênteses no diálogo, excluindo origem e destino
                    const origin = (flights[i].origem || '').toUpperCase();
                    const dest = (flights[i].destino || '').toUpperCase();
                    const allParen = [...dialogText.matchAll(/\(([A-Z]{3})\)/g)].map(m => m[1]);
                    const conn = allParen.filter(c => c !== origin && c !== dest);
                    if (conn.length > 0) flights[i].layoverCity = [...new Set(conn)].slice(0, 2).join(' · ');
                }
                // Fallback: derive layoverCity from parsed segments' destinations
                if (!flights[i].layoverCity && flights[i].segmentos?.length > 1) {
                    const origin = (flights[i].origem || '').toUpperCase();
                    const dest = (flights[i].destino || '').toUpperCase();
                    const midIatas = flights[i].segmentos.slice(0, -1)
                        .map(s => (s.destino || s.layoverCity || '').toUpperCase())
                        .filter(c => c && c !== origin && c !== dest);
                    if (midIatas.length > 0) flights[i].layoverCity = [...new Set(midIatas)].join(' · ');
                }
            }

            if (flights[i].layoverCity) flights[i].layoverCity = iataToCity(flights[i].layoverCity);
            console.log(`[GFlights] expand[${i}] domIdx=${domIdx} textLen=${dialogText.length} segs=${flights[i].segmentos?.length ?? 0} layover=${flights[i].layoverCity || '(empty)'}`);
            if (isDialog) await page.keyboard.press('Escape').catch(() => null);
            await new Promise(r => setTimeout(r, randInt(150, 300)));
        } catch (e) {
            console.log(`[GFlights] expand flight ${i} domIdx=${domIdx} error:`, e.message?.slice(0, 80));
        }
    }
    return flights;
}

// Parser de texto do painel expandido → array de segmentos
function parseSegmentsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const segments = [];
    let cur = null;
    let waitingArrival = false;

    for (const line of lines) {
        // Tempo (HH:MM) — o aeroporto pode estar na mesma linha: "21:50Aeroporto...(GRU)"
        // Não exigimos espaço após o tempo; capturamos o IATA do fim da linha separadamente.
        const timeRaw = line.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?(?:\s*[+-]\d+)?/i);
        if (timeRaw) {
            let h = parseInt(timeRaw[1]), m = parseInt(timeRaw[2]);
            if (timeRaw[3]) { // AM/PM → 24h
                const isPM = /pm/i.test(timeRaw[3]);
                h = isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
            }
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            // IATA no fim da linha: "21:50Aeroporto Internacional...(GRU)"
            const endIata = line.match(/\(([A-Z]{3})\)\s*$/)?.[1];
            // IATA inline logo após o tempo: "09:40 GRU"
            const restOfLine = line.slice(timeRaw[0].length).trim();
            const inlineIata = endIata || (/^([A-Z]{3})(?:\s|$)/.exec(restOfLine)?.[1]);
            if (cur && waitingArrival) {
                cur.chegada = timeStr;
                if (inlineIata && !cur.destino) cur.destino = inlineIata;
                waitingArrival = false;
            } else {
                if (cur) segments.push(cur);
                cur = { partida: timeStr, chegada: '', origem: '', destino: '', duracao_min: 0, aeronave: '', numero: '', companhia_seg: '' };
                if (inlineIata) cur.origem = inlineIata;
                waitingArrival = false;
            }
            continue;
        }

        if (!cur) continue;

        // Código IATA 3 letras (linha só com o código)
        const iataMatch = line.match(/^([A-Z]{3})$/);
        if (iataMatch) {
            if (!cur.origem) cur.origem = iataMatch[1];
            else if (!cur.destino) { cur.destino = iataMatch[1]; waitingArrival = true; }
            continue;
        }

        // IATA em nome de aeroporto: "Aeroporto Internacional Santa Genoveva (GYN)"
        const iataParenMatch = line.match(/\(([A-Z]{3})\)\s*$/);
        if (iataParenMatch) {
            if (!cur.origem) cur.origem = iataParenMatch[1];
            else if (!cur.destino) { cur.destino = iataParenMatch[1]; waitingArrival = true; }
            continue;
        }

        // "Tempo de viagem: Xh Ymin" ou "Travel time: Xhr Ymin"
        const durMatch = line.match(/(?:[Tt]empo\s+de\s+viagem|[Tt]ravel\s+time)[:\s]+(\d+)h(?:\s*(\d+)\s*min)?/);
        if (durMatch) {
            cur.duracao_min = parseInt(durMatch[1]) * 60 + (durMatch[2] ? parseInt(durMatch[2]) : 0);
            waitingArrival = true;
            continue;
        }

        // Aeronave (pode estar embutida em linha concatenada: "AviancaEconômicaAirbus A320neoAV 160")
        const aircraftMatch = line.match(/(?:Airbus|Boeing|Embraer|ATR|Bombardier|CRJ|E-?\d{3})\s*[A-Z]?\d+[-A-Z0-9]*/i);
        if (aircraftMatch && !cur.aeronave) { cur.aeronave = aircraftMatch[0].trim(); }

        // Número de voo — linha inteira ("LA 4607") OU embutido no fim ("AviancaEconômicaAirbus A320neoAV 160")
        if (!cur.numero) {
            const flightNumWhole = line.match(/^([A-Z]{1,2})\s*(\d{1,5})$/);
            const flightNumEnd   = line.match(/\b([A-Z]{1,2})\s*(\d{2,5})(?![a-zA-Z0-9])\s*$/);
            const fm = flightNumWhole || flightNumEnd;
            if (fm) cur.numero = `${fm[1]}${fm[2]}`;
        }

        // Cabine (linha inteira ou embutida: "Econômica", "Business", "Executiva")
        if (!cur.cabin_class_seg) {
            const cabinM = line.match(/\b(Econômica\s+Premium|Executiva|Business Class|Business|Primeira\s+Classe|First\s+Class|Econômica|Economy|Premium\s+Economy)\b/i);
            if (cabinM) cur.cabin_class_seg = cabinM[1].trim();
        }

        // Companhia aérea embutida na linha de detalhes do voo
        if (!cur.companhia_seg) {
            const KNOWN_SEG = ['LATAM Airlines','LATAM','GOL Linhas Aéreas','GOL','Azul Linhas Aéreas','Azul','Avianca','Copa Airlines','American Airlines','United Airlines','Delta Air Lines','Air France','KLM','Lufthansa','TAP Air Portugal','Iberia','British Airways','Emirates','Qatar Airways','Turkish Airlines','Aeromexico','Aeroméxico','Ethiopian Airlines','Air Europa','Swiss','Austrian Airlines','ITA Airways','Aerolíneas Argentinas','Sky Airline','JetSmart','Air Canada','Alaska Airlines','JetBlue'];
            for (const a of KNOWN_SEG) {
                if (line.toLowerCase().includes(a.toLowerCase())) { cur.companhia_seg = a; break; }
            }
        }

        // Espaço para as pernas (legroom)
        if (/[Ee]spa[çc]o\s+para\s+as\s+pernas|[Ll]eg\s*room/i.test(line)) {
            cur.legroom = line.replace(/\s*\(\d+\s*cm\)/i, m => ` ${m.trim()}`).trim();
            continue;
        }

        // Amenidades: Wi-Fi, USB, Streaming, Vídeo, Tomada
        if (/Wi-?Fi/i.test(line))                               { (cur.amenities = cur.amenities || []).push(line.trim()); continue; }
        if (/Saída\s+USB|USB\s+(?:port|outlet)/i.test(line))   { (cur.amenities = cur.amenities || []).push('Saída USB'); continue; }
        if (/Streaming/i.test(line))                            { (cur.amenities = cur.amenities || []).push('Streaming'); continue; }
        if (/[Vv]ídeo\s+sob\s+demanda|[Vv]ideo\s+on\s+demand/i.test(line)) { (cur.amenities = cur.amenities || []).push('Vídeo sob demanda'); continue; }
        if (/[Tt]omada\s+no\s+assento|[Pp]ower\s+outlet/i.test(line))      { (cur.amenities = cur.amenities || []).push('Tomada no assento'); continue; }

        // Parada (layover) — fecha o segmento atual; captura IATA da conexão se presente
        if (/[Pp]arada\s+de|[Ll]ayover/i.test(line)) {
            if (cur && cur.partida) {
                const layoverIataM = line.match(/\(([A-Z]{3})\)\s*$/);
                segments.push(cur);
                if (layoverIataM && segments.length > 0) {
                    segments[segments.length - 1].layoverCity = layoverIataM[1];
                }
                cur = null; waitingArrival = false;
            }
        }
    }

    if (cur && cur.partida) segments.push(cur);
    return segments.filter(s => s.partida && (s.origem || s.duracao_min > 0));
}

export {
    doScrape,
    gfCacheSet,
    gfCacheKey,
    GF_CACHE_TTL_MS,
    GF_CACHE_MAX,
    _gfCache,
    _gfInflight,
    buildGfTfsUrl,
};
