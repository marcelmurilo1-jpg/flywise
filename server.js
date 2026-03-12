import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chromium as chromiumExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import pLimit from 'p-limit';

chromiumExtra.use(StealthPlugin());
import { createClient } from '@supabase/supabase-js';

// Carrega variáveis do ambiente (tenta .env.local e .env globalmente)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializa o cliente Supabase do backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Servidor Express rodando sem chaves completas do Supabase. Verifique seu arquivo .env.local");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ─── Seats.aero Official Partner API ─────────────────────────────────────────
const SEATS_AERO_API_KEY = process.env.SEATS_AERO_API_KEY;
const SEATS_AERO_BASE = 'https://seats.aero/partnerapi';

async function fetchSeatsAeroAPI(origin, destination, date) {
    if (!SEATS_AERO_API_KEY) {
        throw new Error('SEATS_AERO_API_KEY não configurada. Adicione ao .env.local');
    }
    const params = new URLSearchParams({
        origin_airport: origin.toUpperCase(),
        destination_airport: destination.toUpperCase(),
        start_date: date,
        end_date: date,
        take: '50',
    });
    const res = await fetch(`${SEATS_AERO_BASE}/search?${params}`, {
        headers: {
            'Partner-Authorization': SEATS_AERO_API_KEY,
            'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(20000),
    });
    if (res.status === 429) throw new Error('Rate limit da API Seats.aero atingido. Aguarde alguns segundos.');
    if (res.status === 401) throw new Error('API Key do Seats.aero inválida ou sem permissão.');
    if (!res.ok) throw new Error(`Seats.aero API respondeu com status ${res.status}`);
    const data = await res.json();
    console.log('[Seats.aero] Resposta completa:', JSON.stringify(data).slice(0, 500));
    return data.data ?? [];
}

function mapSeatsAeroItem(item, tipo = 'ida') {
    const origin = item.Route?.OriginAirport ?? '';
    const dest   = item.Route?.DestinationAirport ?? '';

    const parseMiles = (v) => {
        if (!v || v === '' || v === '0') return null;
        const n = parseInt(String(v).replace(/,/g, ''), 10);
        return isNaN(n) || n === 0 ? null : n;
    };

    const economy      = item.YAvailable ? parseMiles(item.YMileageCost) : null;
    const premEconomy  = item.WAvailable ? parseMiles(item.WMileageCost) : null;
    const business     = item.JAvailable ? parseMiles(item.JMileageCost) : null;
    const first        = item.FAvailable ? parseMiles(item.FMileageCost) : null;

    const bestMiles = economy ?? premEconomy ?? business ?? first;
    const bestCabin = economy != null ? 'Economy'
        : premEconomy != null ? 'Premium Economy'
        : business    != null ? 'Business' : 'First';

    // Pega companhia principal da cabine disponível
    const mainAirline = [item.YAirlines, item.WAirlines, item.JAirlines, item.FAirlines]
        .filter(Boolean)[0]?.split(',')[0]?.trim() ?? item.Source ?? '';

    // Voo direto: qualquer cabine tem YDirect/JDirect etc.
    const isDirect = item.YDirect || item.WDirect || item.JDirect || item.FDirect;

    // Detalhes de segmentos (disponíveis em algumas fontes via AvailabilityTrips)
    let partida = null, chegada = null, duracaoMin = null, escalas = [];
    const trips = item.AvailabilityTrips ?? [];
    if (trips.length > 0) {
        const segs = trips[0]?.Segments ?? [];
        if (segs.length > 0) {
            partida  = segs[0]?.DepartureDateTime ?? segs[0]?.departure_datetime ?? null;
            chegada  = segs[segs.length - 1]?.ArrivalDateTime ?? segs[segs.length - 1]?.arrival_datetime ?? null;
            escalas  = segs.slice(0, -1).map(s => s.DestinationAirport ?? s.destination ?? '').filter(Boolean);
            if (partida && chegada) {
                const diffMs = new Date(chegada) - new Date(partida);
                if (diffMs > 0) duracaoMin = Math.round(diffMs / 60000);
            }
        }
    }

    return {
        companhiaAerea: mainAirline,
        rota: `${origin} → ${dest}`,
        origem: origin,
        destino: dest,
        paradas: isDirect ? 0 : Math.max(escalas.length, 1),
        escalas,
        dataVoo: item.Date ?? '',
        partida,
        chegada,
        duracaoMin,
        precoMilhas: bestMiles,
        cabineEncontrada: bestMiles != null ? bestCabin : null,
        economy,
        premiumEconomy: premEconomy,
        business,
        first,
        taxas: '0',
        tipo,
        source: item.Source ?? '',
        remainingSeats: {
            economy:       item.YRemainingSeats ?? 0,
            premiumEconomy: item.WRemainingSeats ?? 0,
            business:      item.JRemainingSeats ?? 0,
            first:         item.FRemainingSeats ?? 0,
        },
    };
}

// Rota de busca via API oficial do Seats.aero
app.post('/api/search-flights', async (req, res) => {
    console.log('[Express] 📥 Nova requisição em /api/search-flights (API oficial)');
    const { origem, destino, data_ida, data_volta } = req.body;

    if (!origem || !destino || !data_ida) {
        return res.status(400).json({ error: 'Origem, destino e data_ida são obrigatórios' });
    }

    try {
        const TTL_MS = 10 * 60 * 1000; // 10 minutos

        // ── 1. Checa cache Supabase ────────────────────────────────────────────
        if (supabase) {
            const ttlLimit = new Date(Date.now() - TTL_MS).toISOString();
            const { data: cached } = await supabase
                .from('seatsaero_searches')
                .select('dados, criado_em')
                .eq('origem', origem.toUpperCase())
                .eq('destino', destino.toUpperCase())
                .gte('criado_em', ttlLimit)
                .order('criado_em', { ascending: false })
                .limit(1)
                .single();

            if (cached?.dados) {
                const voosCached = cached.dados.filter(v => !data_volta ? v.tipo === 'ida' : true);
                console.log(`[Express] Cache hit: ${voosCached.length} voos.`);
                return res.json({ origem, destino, total: voosCached.length, voos: voosCached, source: 'cache' });
            }
            console.log('[Express] Cache miss — chamando API Seats.aero.');
        }

        // ── 2. Busca na API em paralelo (ida + volta) ─────────────────────────
        const promessas = [fetchSeatsAeroAPI(origem, destino, data_ida)];
        if (data_volta) promessas.push(fetchSeatsAeroAPI(destino, origem, data_volta));

        const [itemsIda, itemsVolta = []] = await Promise.all(promessas);
        const resultadosFinais = [
            ...itemsIda.map(item => mapSeatsAeroItem(item, 'ida')),
            ...itemsVolta.map(item => mapSeatsAeroItem(item, 'volta')),
        ];

        console.log(`[Express] Seats.aero API: ${resultadosFinais.length} disponibilidades.`);

        // ── 3. Salva no cache Supabase ─────────────────────────────────────────
        if (supabase && resultadosFinais.length > 0) {
            const ttlLimit = new Date(Date.now() - TTL_MS).toISOString();
            await supabase.from('seatsaero_searches').delete()
                .eq('origem', origem.toUpperCase()).eq('destino', destino.toUpperCase())
                .lt('criado_em', ttlLimit);
            const { error: insertErr } = await supabase.from('seatsaero_searches')
                .insert([{ origem: origem.toUpperCase(), destino: destino.toUpperCase(), dados: resultadosFinais }]);
            if (insertErr) console.error('[Express] Erro ao salvar cache:', insertErr.message);
            else console.log(`[Express] Cache salvo: ${resultadosFinais.length} voos.`);
        }

        res.json({ origem, destino, total: resultadosFinais.length, voos: resultadosFinais, source: 'api' });

    } catch (err) {
        console.error('[Express] Erro em /api/search-flights:', err.message);
        res.status(500).json({ error: err.message || 'Erro ao buscar voos do Seats.aero' });
    }
});

// ─── Amadeus Proxy (apenas aeroportos) ───────────────────────────────────────
const AMADEUS_BASE = 'https://test.api.amadeus.com';
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID || process.env.VITE_AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET || process.env.VITE_AMADEUS_CLIENT_SECRET;

let _amadeusToken = null;
let _amadeusTokenExpires = 0;

async function getAmadeusToken() {
    const now = Date.now();
    if (_amadeusToken && _amadeusTokenExpires > now + 60_000) return _amadeusToken;
    if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) {
        throw new Error('Credenciais Amadeus nao configuradas no servidor.');
    }
    const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: AMADEUS_CLIENT_ID,
            client_secret: AMADEUS_CLIENT_SECRET,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error_description ?? 'Falha ao autenticar com Amadeus');
    }
    const data = await res.json();
    _amadeusToken = data.access_token;
    _amadeusTokenExpires = now + data.expires_in * 1000;
    return _amadeusToken;
}

app.get('/api/amadeus/airports', async (req, res) => {
    try {
        const token = await getAmadeusToken();
        const params = new URLSearchParams({
            keyword: req.query.keyword ?? '',
            subType: 'AIRPORT',
            'page[limit]': '6',
            sort: 'analytics.travelers.score',
            view: 'LIGHT',
        });
        const r = await fetch(`${AMADEUS_BASE}/v1/reference-data/locations?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) console.error('[Amadeus] airports API error:', r.status, JSON.stringify(data).slice(0, 300));
        res.status(r.status).json(data);
    } catch (err) {
        console.error('[Amadeus] airports error:', err.message);
        res.status(500).json({ errors: [{ detail: err.message }] });
    }
});

// ─── Google Flights Scraper ───────────────────────────────────────────────────
// Navegador compartilhado: criado uma vez, reutilizado em todas as requisições.
const scrapeLimit = pLimit(4); // máx. 4 abas simultâneas
let _browser = null;

async function getBrowser() {
    if (_browser && _browser.isConnected()) return _browser;
    const opts = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
        ],
    };
    if (process.env.PROXY_URL) opts.proxy = { server: process.env.PROXY_URL };
    _browser = await chromiumExtra.launch(opts);
    console.log('[GFlights] Navegador iniciado.');
    return _browser;
}

// Encerra o navegador no shutdown gracioso
process.on('SIGTERM', async () => { if (_browser) await _browser.close(); process.exit(0); });
process.on('SIGINT',  async () => { if (_browser) await _browser.close(); process.exit(0); });

// Adiciona N dias a uma string de data "YYYY-MM-DD"
function addDaysToDate(dateStr, days) {
    if (!days) return dateStr;
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

async function scrapeOneway(origin, destination, date) {
    return scrapeLimit(async () => {
        const browser = await getBrowser();
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            locale: 'pt-BR',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
        });
        const page = await context.newPage();

        try {
            const query = encodeURIComponent(`Flights from ${origin} to ${destination} on ${date} one way`);
            const url = `https://www.google.com/travel/flights?q=${query}&curr=BRL&hl=pt-BR`;

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            await Promise.race([
                page.waitForSelector('li.pIav2d', { timeout: 20000 }),
                page.waitForSelector('ul[role="list"] li', { timeout: 20000 }),
            ]).catch(() => console.log(`[GFlights] ${origin}→${destination}: timeout aguardando seletor`));

            await page.waitForTimeout(2000);

            // Clica nos botões "ver detalhes" via API nativa do Playwright (mais confiável)
            try {
                const expandSelectors = [
                    'button[jsname="sTDI0"]',
                    'button[aria-label*="etalhes"]',
                    'button[aria-label*="Details"]',
                    'button[aria-label*="details"]',
                    '[jsaction*="flight.detail"]',
                ];
                for (const sel of expandSelectors) {
                    const btns = await page.$$(sel);
                    for (const btn of btns) {
                        await btn.click({ force: true }).catch(() => {});
                    }
                    if (btns.length > 0) break; // para no primeiro seletor que encontrar botões
                }
            } catch (_) {}
            await page.waitForTimeout(2000);

            const flights = await page.evaluate(() => {
                const results = [];
                const selectors = ['li.pIav2d', 'li[data-id]', 'ul[jsname] > li'];
                let items = [];
                for (const sel of selectors) {
                    items = [...document.querySelectorAll(sel)];
                    if (items.length > 0) break;
                }

                // Após clicar em "Detalhes", o Google Flights substitui o card compacto pelo
                // formato expandido. O card expandido tem estrutura completamente diferente:
                // - Linha "Partida" (header da UI)
                // - "HH:MM[+N]Nome do Aeroporto (IATA)" — tempo concatenado com aeroporto
                // - "Tempo de viagem: Xh Ymin..." — duração do segmento
                // - "AirlineEconômicaBoeing 787AB 123" — cia+classe+aeronave+nº_voo numa linha
                // - "Parada em [Cidade]: Xh Ymin" — conexão
                // - "R$ X.XXX" — preço
                //
                // Quando NÃO expandido (fallback), formato compacto:
                // "HH:MM" / "–" / "HH:MM[+N]" / "Airline" / "Xh Ymin" / "GRU–LIS" / "Sem escalas" / "R$ X.XXX"

                items.slice(0, 15).forEach((node) => {
                    const lines = (node.innerText ?? '').split('\n').map(l => l.trim()).filter(Boolean);
                    if (lines.length < 3) return;

                    // Detecta formato expandido: alguma linha começa com "HH:MM" seguido imediatamente de letra maiúscula (nome do aeroporto)
                    const timeAirportRx = /^(\d{1,2}:\d{2})(\s*\+(\d+))?([A-Z].*)/;
                    const isExpanded = lines.some(l => timeAirportRx.test(l));

                    let departure = '', arrival = '', arrivalOffset = 0;
                    let durationMin = 0, stops = 0, layoverCity = '';
                    let airlineName = '';
                    const layoverDurations = [];
                    const segments = [];

                    if (isExpanded) {
                        // ─ Formato EXPANDIDO ─
                        // Identifica todas as linhas "HH:MMNome do Aeroporto (IATA)"
                        const timeEntries = [];
                        for (let i = 0; i < lines.length; i++) {
                            const m = lines[i].match(timeAirportRx);
                            if (m) {
                                const iataM = m[4].match(/\(([A-Z]{3})\)/);
                                timeEntries.push({ idx: i, time: m[1], offset: m[3] ? parseInt(m[3]) : 0, iata: iataM ? iataM[1] : '' });
                            }
                        }

                        // Preço
                        const priceLine = lines.find(l => /R\$/.test(l) && /\d/.test(l));
                        const price = priceLine ? parseInt(priceLine.replace(/[^\d]/g, ''), 10) || 0 : 0;

                        // Conexões: "Parada de XhYminCidade (IATA)" ou "Parada em Cidade: Xh Ymin"
                        const layoverLines = lines.filter(l => /^Parada (de|em)\s/i.test(l));
                        // Fallback: usa número de segmentos se não encontrar linhas de conexão explícitas
                        stops = Math.max(layoverLines.length, Math.floor(timeEntries.length / 2) - 1);
                        layoverLines.forEach((ll, li) => {
                            // Duração da conexão
                            const dm = ll.match(/(\d+)h(?:\s*(\d+)\s*min)?/);
                            if (dm) layoverDurations.push(parseInt(dm[1]) * 60 + (dm[2] ? parseInt(dm[2]) : 0));
                            // Cidade de conexão: remove "Parada de/em " e a duração, extrai nome da cidade
                            if (li === 0) {
                                const withoutPrefix = ll.replace(/^Parada (de|em)\s+/i, '');
                                const withoutDuration = withoutPrefix.replace(/\d+h(?:\s*\d+\s*min)?/g, '').trim();
                                layoverCity = withoutDuration.replace(/\s*\([A-Z]{3}\).*$/, '').replace(/:.*$/, '').trim();
                            }
                        });

                        // Horários globais: primeiro e último time-entry
                        if (timeEntries.length >= 2) {
                            departure = timeEntries[0].time;
                            const lastEntry = timeEntries[timeEntries.length - 1];
                            arrival = lastEntry.time;
                            arrivalOffset = lastEntry.offset;
                        }

                        // Segmentos: pares consecutivos de time-entries — (0,1), (2,3), etc.
                        for (let si = 0; si + 1 < timeEntries.length; si += 2) {
                            const dep = timeEntries[si];
                            const arr = timeEntries[si + 1];

                            // Duração do segmento: linha com "Tempo de viagem" ou /\d+h/ entre dep e arr
                            let segDur = 0;
                            for (let li = dep.idx + 1; li < arr.idx; li++) {
                                const dl = lines[li];
                                if (!/R\$/.test(dl)) {
                                    const dm = dl.match(/(\d+)h(?:\s*(\d+)(?:\s*min)?)?/);
                                    if (dm) { segDur = parseInt(dm[1]) * 60 + (dm[2] ? parseInt(dm[2]) : 0); break; }
                                }
                            }
                            durationMin += segDur;

                            // Linha de info do segmento: logo após o arr time-entry (se não for "Parada em")
                            const infoLine = lines[arr.idx + 1] ?? '';
                            const segInfo = /^Parada em /i.test(infoLine) ? '' : infoLine;

                            // Extrai nº de voo (2-3 letras + dígitos no final da linha)
                            const flightNumM = segInfo.match(/([A-Z]{1,3}\s?\d{1,5})$/);
                            // Extrai aeronave (para antes do código do voo)
                            const aircraftRaw = segInfo.match(/(Boeing|Airbus|Embraer|CRJ|ATR)[^\n]*/i);
                            const aircraftM = aircraftRaw ? [aircraftRaw[0].replace(/[A-Z]{1,3}\s?\d{1,5}$/, '').trim()] : null;
                            // Extrai companhia (antes de "Econômica", "Business", "Executiva", "Primeira")
                            const airlineM = segInfo.split(/(Econômica|Business|Executiva|Primeira|Premium Economy)/)[0].trim();

                            if (!airlineName && airlineM) airlineName = airlineM;

                            segments.push({
                                partida: dep.time,
                                chegada: arr.time,
                                origem: dep.iata,
                                destino: arr.iata,
                                duracao_min: segDur,
                                numero: flightNumM ? flightNumM[1] : '',
                                aeronave: aircraftM ? aircraftM[0] : '',
                                companhia_seg: airlineM,
                            });
                        }

                        // Adiciona duração das conexões ao total
                        durationMin += layoverDurations.reduce((a, b) => a + b, 0);

                        results.push({
                            companhia: airlineName,
                            partida: departure,
                            chegada: arrival,
                            chegadaOffset: arrivalOffset,
                            duracao_min: durationMin,
                            paradas: stops,
                            layoverCity,
                            layoverDurations,
                            preco_brl: price,
                            segmentos: segments,
                            numeroVoos: segments.map(s => s.numero).filter(Boolean),
                            aeronaves: segments.map(s => s.aeronave).filter(Boolean),
                        });

                    } else {
                        // ─ Formato COMPACTO (expand não funcionou) ─
                        // "HH:MM" / "–" / "HH:MM[+N]" em linhas separadas
                        const headerLines = lines.slice(0, 12);
                        const parsedTimes = [];
                        for (let i = 0; i < headerLines.length; i++) {
                            const l = headerLines[i];
                            if (/^\d{1,2}:\d{2}$/.test(l)) {
                                const nextLine = (headerLines[i + 1] ?? '').trim();
                                const offset = nextLine.match(/^\+(\d+)$/) ? parseInt(nextLine.slice(1)) : 0;
                                parsedTimes.push({ time: l, offset });
                            } else if (/^\d{1,2}:\d{2}\s*\+\d+$/.test(l)) {
                                const m = l.match(/^(\d{1,2}:\d{2})\s*\+(\d+)$/);
                                if (m) parsedTimes.push({ time: m[1], offset: parseInt(m[2]) });
                            }
                        }
                        if (parsedTimes.length >= 2) {
                            departure = parsedTimes[0].time;
                            arrival = parsedTimes[1].time;
                            arrivalOffset = parsedTimes[1].offset;
                        }

                        const durLine = lines.find(l => /\d+h(\s*\d+\s*min)?/.test(l) && !/R\$/.test(l));
                        if (durLine) {
                            const m = durLine.match(/(\d+)h(?:\s*(\d+)\s*min)?/);
                            if (m) durationMin = parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0);
                        }

                        const stopsLine = lines.find(l => /sem\s*escala|direto|nonstop|\d\s*parada/i.test(l)) ?? '';
                        stops = /sem\s*escala|direto|nonstop/i.test(stopsLine) ? 0
                            : (stopsLine.match(/(\d+)/) ? parseInt(stopsLine.match(/(\d+)/)[1]) : 0);

                        const emMatch = stopsLine.match(/em\s+([A-Za-záéíóú\s]+)/i);
                        if (emMatch) layoverCity = emMatch[1].trim();

                        const routeLine = lines.find(l => /^[A-Z]{3}[–\-][A-Z]{3}/.test(l)) ?? '';
                        if (!layoverCity && routeLine) {
                            const parts = routeLine.split(/[–\-]/);
                            if (parts.length > 2) layoverCity = parts.slice(1, -1).join(', ');
                        }

                        airlineName = lines.find(l =>
                            !/\d{1,2}:\d{2}/.test(l) && !/R\$/.test(l) &&
                            !/^\d+h/.test(l) && !/sem\s*escala|direto|parada|nonstop|partida/i.test(l) &&
                            !/^\+\d/.test(l) && !/^[–\-]$/.test(l) &&
                            !/^[A-Z]{3}[–\-]/.test(l) && !/^\d+\s*kg/.test(l) &&
                            l.length > 2 && l.length < 60
                        ) ?? '';

                        const priceLine = lines.find(l => /R\$/.test(l) && /\d/.test(l));
                        const price = priceLine ? parseInt(priceLine.replace(/[^\d]/g, ''), 10) || 0 : 0;

                        results.push({
                            companhia: airlineName,
                            partida: departure,
                            chegada: arrival,
                            chegadaOffset: arrivalOffset,
                            duracao_min: durationMin,
                            paradas: stops,
                            layoverCity,
                            layoverDurations,
                            preco_brl: price,
                            segmentos: segments,
                            numeroVoos: [],
                            aeronaves: [],
                        });
                    }
                });

                return results;
            });

            await context.close();
            return flights;
        } catch (err) {
            console.error(`[GFlights] ${origin}→${destination} erro:`, err.message);
            await context.close();
            return [];
        }
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
    return {
        id: `gf-${idx}-${Date.now()}`,
        companhia: item.companhia || 'Companhia não identificada',
        carrierCode: (item.companhia ?? '').slice(0, 2).toUpperCase() || 'XX',
        preco_brl: item.preco_brl,
        taxas_brl: 0,
        partida: date + 'T' + normalizeTime(item.partida) + ':00',
        chegada: arrivalDate + 'T' + normalizeTime(item.chegada) + ':00',
        origem: origin.toUpperCase(),
        destino: destination.toUpperCase(),
        duracao_min: item.duracao_min || 0,
        paradas: item.paradas ?? 0,
        cabin_class: 'economy',
        voo_numero: '',
        segmentos: item.segmentos || [],
        layoverCity: item.layoverCity || '',
        layoverDurations: item.layoverDurations || [],
        numeroVoos: item.numeroVoos || [],
        aeronaves: item.aeronaves || [],
        flight_key: `gf-${origin}-${destination}-${date}-${idx}`,
        provider: 'google',
    };
}

// GET /api/amadeus/flights — scraper do Google Flights (ida e volta em paralelo)
app.get('/api/amadeus/flights', async (req, res) => {
    const { originLocationCode: origin, destinationLocationCode: destination, departureDate: date, returnDate } = req.query;

    if (!origin || !destination || !date) {
        return res.status(400).json({ errors: [{ detail: 'origin, destination e departureDate são obrigatórios' }] });
    }

    console.log(`[GFlights] Buscando ${origin}→${destination} em ${date}${returnDate ? ` | volta ${destination}→${origin} em ${returnDate}` : ''}`);

    try {
        // Scrape ida e (se round-trip) volta em paralelo
        const [rawOut, rawIn = []] = await Promise.all([
            scrapeOneway(origin, destination, date),
            returnDate ? scrapeOneway(destination, origin, returnDate) : Promise.resolve([]),
        ]);

        // Outbound: filtra voos sem preço (geralmente resultados inválidos)
        // Inbound: NÃO filtra por preço — em buscas round-trip o Google Flights
        // muitas vezes não mostra preço individual nos cards de volta
        const outbound = rawOut.filter(i => i.preco_brl > 0).map((i, idx) => mapToFlightOffer(i, origin, destination, date, idx));
        const inbound  = rawIn.map((i, idx) => mapToFlightOffer(i, destination, origin, returnDate, idx));

        console.log(`[GFlights] Ida: ${outbound.length} | Volta: ${inbound.length}`);
        res.json({ data: outbound, inbound, meta: { count: outbound.length, source: 'google-flights-scraper' } });
    } catch (err) {
        console.error('[GFlights] Erro:', err.message);
        res.status(500).json({ errors: [{ detail: err.message }] });
    }
});

// ─── AbacatePay Checkout ───────────────────────────────────────────────────────
const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY || 'abc_dev_GwmHy0SnK5CAeB3YWPKckZrx';
const ABACATEPAY_BASE = 'https://api.abacatepay.com/v1';

app.post('/api/checkout', async (req, res) => {
    const { origin, destination, departureDate, returnDate, totalBrl, outboundCompany, returnCompany, customerName, customerEmail, customerTaxId } = req.body;

    if (!totalBrl || totalBrl <= 0) {
        return res.status(400).json({ error: 'totalBrl é obrigatório e deve ser maior que zero' });
    }

    const abHeaders = {
        'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json',
    };

    try {
        // 1. Criar ou recuperar cliente
        const customerPayload = {
            name: customerName || 'FlyWise User',
            email: customerEmail || 'user@flywise.app',
            taxId: customerTaxId || '52998224725', // CPF de teste válido (ambiente dev)
            cellphone: '11999999999',
        };

        const custRes = await fetch(`${ABACATEPAY_BASE}/customer/create`, {
            method: 'POST',
            headers: abHeaders,
            body: JSON.stringify(customerPayload),
            signal: AbortSignal.timeout(15000),
        });
        const custData = await custRes.json();
        console.log('[AbacatePay] Customer:', JSON.stringify(custData).slice(0, 200));

        const customerId = custData.data?.id;
        if (!customerId) {
            console.error('[AbacatePay] Falha ao criar cliente:', custData);
            return res.status(400).json({ error: custData.error || 'Falha ao criar cliente no AbacatePay' });
        }

        // 2. Criar cobrança
        const productName = returnDate
            ? `Passagem Aérea ${origin}→${destination} + ${destination}→${origin}`
            : origin === 'PLANO'
                ? `FlyWise ${destination} — Assinatura`
                : `Passagem Aérea ${origin}→${destination}`;

        const externalId = `flywise-${origin}-${destination}-${Date.now()}`;

        const billingPayload = {
            frequency: 'ONE_TIME',
            methods: ['PIX'],
            customerId,
            products: [{
                externalId,
                name: productName,
                quantity: 1,
                price: Math.round(totalBrl * 100),
            }],
            returnUrl: `${req.headers.origin || 'http://localhost:5173'}/planos`,
            completionUrl: `${req.headers.origin || 'http://localhost:5173'}/planos?pagamento=sucesso`,
            metadata: { origin, destination, departureDate, returnDate, outboundCompany, returnCompany },
        };

        const abRes = await fetch(`${ABACATEPAY_BASE}/billing/create`, {
            method: 'POST',
            headers: abHeaders,
            body: JSON.stringify(billingPayload),
            signal: AbortSignal.timeout(15000),
        });
        const abData = await abRes.json();

        if (!abRes.ok || abData.error) {
            console.error('[AbacatePay] Erro billing:', abData);
            return res.status(abRes.status).json({ error: abData.error || 'Erro ao criar cobrança' });
        }

        console.log(`[AbacatePay] Cobrança criada: ${abData.data?.url}`);
        res.json({ url: abData.data?.url, id: abData.data?.id });
    } catch (err) {
        console.error('[AbacatePay] Exceção:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Localmente: inicia o servidor Express normalmente.
// Na Vercel: o arquivo é importado como módulo serverless — app.listen não é chamado.
if (process.env.VERCEL !== '1') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`Servidor FlyWise Backend rodando na porta ${PORT}`);
        console.log(`POST http://localhost:${PORT}/api/search-flights   (Seats.aero)`);
        console.log(`GET  http://localhost:${PORT}/api/amadeus/airports  (Amadeus)`);
        console.log(`GET  http://localhost:${PORT}/api/amadeus/flights   (Google Flights scraper)`);
        console.log(`======================================================\n`);
    });
}

export default app;
