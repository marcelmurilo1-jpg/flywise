import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';

chromium.use(stealth());

// ─── Scraper Principal ────────────────────────────────────────────────────────

/**
 * Raspa voos disponíveis no Seats.aero Pro.
 * @param {string} origem  - IATA de origem (ex: "GRU")
 * @param {string} destino - IATA de destino (ex: "MIA")
 * @param {string} dataVoo - Data no formato YYYY-MM-DD
 * @returns {Promise<Array>} Array de voos estruturados
 */
export async function buscarVoosSeatsAero(origem, destino, dataVoo) {
    const searchUrl = `https://seats.aero/search?origins=${origem}&destinations=${destino}&date=${dataVoo}`;
    let browser;

    try {
        console.log(`[SeatsAero] Iniciando busca: ${origem} → ${destino} | ${dataVoo}`);

        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1440, height: 900 },
            locale: 'en-US',
        });

        // Injeta sessão Pro via cookies
        try {
            const cookiesFile = path.resolve(process.cwd(), 'cookies.json');
            const cookiesData = await fs.readFile(cookiesFile, 'utf-8');
            const cookiesArray = JSON.parse(cookiesData);
            await context.addCookies(cookiesArray);
            console.log('[SeatsAero] Cookies Pro injetados.');
        } catch {
            console.warn('[SeatsAero] cookies.json ausente — acessando sem sessão Pro.');
        }

        const page = await context.newPage();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // ── Cloudflare ────────────────────────────────────────────────────────
        const cfTexts = ['Verify you are human', 'Checking your browser', 'security check', 'Just a moment'];
        let isCloudflare = false;
        for (const text of cfTexts) {
            if (await page.locator(`text="${text}"`).isVisible({ timeout: 2000 }).catch(() => false)) {
                isCloudflare = true;
                break;
            }
        }
        if (isCloudflare) {
            console.log('[SeatsAero] Cloudflare detectado, aguardando até 30s...');
            await page.waitForFunction(
                () => !['Verify you are human', 'Checking your browser', 'Just a moment']
                    .some(t => document.body?.innerText?.includes(t)),
                { timeout: 30000 }
            ).catch(() => console.warn('[SeatsAero] Cloudflare pode ainda estar ativo.'));
        }

        // ── Paywall ───────────────────────────────────────────────────────────
        const paywallTexts = ['Upgrade to Pro', 'Upgrade to PRO', 'Basic search is limited'];
        for (const text of paywallTexts) {
            if (await page.locator(`text="${text}"`).isVisible({ timeout: 2000 }).catch(() => false)) {
                console.error('[SeatsAero] PAYWALL detectado — sessão não-Pro ou expirada.');
                return { error: 'NOT_PRO_ACCOUNT' };
            }
        }
        if (await page.locator('.pro-paywall').isVisible({ timeout: 1000 }).catch(() => false)) {
            console.error('[SeatsAero] PAYWALL CSS detectado.');
            return { error: 'NOT_PRO_ACCOUNT' };
        }

        // ── Aguarda tabela ────────────────────────────────────────────────────
        try {
            await page.waitForSelector('table', { timeout: 15000 });
            // Espera pelo menos uma linha de dados
            await page.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => {});
            // Pausa curta para JS do site terminar de popular as células
            await page.waitForTimeout(1500);
        } catch {
            console.warn('[SeatsAero] Tabela não encontrada dentro do timeout.');
        }

        // ── Extração de dados ─────────────────────────────────────────────────
        const { voos, debug } = await page.evaluate(() => {
            const getT = (el) => (el?.innerText || el?.textContent || '').trim().replace(/\s+/g, ' ');

            const tables = Array.from(document.querySelectorAll('table'));
            // Encontra a tabela principal (tem "Program" ou cabines no cabeçalho)
            const mainTable = tables.find(t => {
                const txt = getT(t.querySelector('thead') ?? t.querySelector('tr'));
                return txt.toLowerCase().includes('program') ||
                    txt.toLowerCase().includes('economy') ||
                    txt.toLowerCase().includes('business') ||
                    txt.toLowerCase().includes('route');
            }) ?? tables[0];

            if (!mainTable) return { voos: [], debug: { tableFound: false, totalTables: tables.length } };

            // ── Lê cabeçalhos (thead ou primeiro tr) para mapear colunas ──────
            let thEls = Array.from(mainTable.querySelectorAll('thead th, thead td'));
            if (thEls.length === 0) {
                // Fallback: use first row of tbody or table itself
                const firstRow = mainTable.querySelector('tr');
                if (firstRow) thEls = Array.from(firstRow.querySelectorAll('th, td'));
            }
            const headers = thEls.map(th => getT(th));

            const normalize = (h) => {
                const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (lower.startsWith('date') || lower === 'flightdate') return 'date';
                if (lower === 'lastseen') return 'lastSeen';
                if (lower.startsWith('program') || lower === 'airline' || lower === 'mileageprogram') return 'program';
                if (lower === 'route' || lower === 'routing' || lower === 'itinerary') return 'route';
                if (lower.startsWith('depart') || lower === 'from' || lower === 'departure') return 'departs';
                if (lower.startsWith('arriv') || lower === 'to' || lower === 'arrival') return 'arrives';
                if (lower.includes('premium')) return 'premiumEconomy';
                if (lower.includes('economy') || lower === 'eco' || lower === 'y' || lower === 'yseats') return 'economy';
                if (lower.includes('business') || lower === 'biz' || lower === 'j' || lower === 'jseats') return 'business';
                if (lower.includes('first') || lower === 'f' || lower === 'fseats') return 'first';
                if (lower.includes('tax') || lower.includes('fee')) return 'taxes';
                return lower;
            };

            const colMap = {};
            headers.forEach((h, i) => { if (h) colMap[normalize(h)] = i; });

            // ── Extrai linhas ──────────────────────────────────────────────────
            const rows = Array.from(mainTable.querySelectorAll('tbody tr'));
            const resultados = [];

            rows.forEach(row => {
                const tds = Array.from(row.querySelectorAll('td'));
                if (tds.length < 3) return;

                const get = (key) => colMap[key] !== undefined ? getT(tds[colMap[key]]) : '';

                const dateVal = get('date') || get('lastSeen');
                const program = get('program');
                const routeText = get('route');
                const departs = get('departs');
                const arrives = get('arrives');
                const econText = get('economy');
                const premText = get('premiumEconomy');
                const bizText = get('business');
                const firstText = get('first');
                const taxesText = get('taxes');

                // Precisa ter pelo menos alguma cabine ou identificação
                if (!program && !routeText && !econText && !bizText && !firstText) return;

                // Mapeia valores de milhas
                const parseMilesInline = (raw) => {
                    if (!raw || raw === '—' || raw === '-' || raw === '') return null;
                    const clean = raw.replace(/,/g, '').trim();
                    if (clean.toLowerCase().endsWith('k')) return Math.round(parseFloat(clean) * 1000);
                    const n = parseInt(clean, 10);
                    return isNaN(n) ? null : n;
                };

                const economy = parseMilesInline(econText);
                const premiumEconomy = parseMilesInline(premText);
                const business = parseMilesInline(bizText);
                const first = parseMilesInline(firstText);

                // Sem nenhuma cabine disponível → pula
                if (economy === null && premiumEconomy === null && business === null && first === null) return;

                // Melhor tarifa disponível (hierarquia: economy → premium → business → first)
                const bestMiles = economy ?? premiumEconomy ?? business ?? first;
                const bestCabin =
                    economy !== null ? 'Economy' :
                    premiumEconomy !== null ? 'Premium Economy' :
                    business !== null ? 'Business' : 'First';

                // Extrai paradas a partir do texto de rota
                const parseRouteInline = (rt) => {
                    if (!rt) return { origem: '', destino: '', paradas: 0, escalas: [] };
                    const parts = rt.split(/→|->|>|\s+-\s+/)
                        .map(p => p.replace(/[^A-Z0-9]/gi, '').trim().toUpperCase())
                        .filter(p => p.length >= 2 && p.length <= 5);
                    if (parts.length < 2) return { origem: parts[0] ?? '', destino: parts[0] ?? '', paradas: 0, escalas: [] };
                    return {
                        origem: parts[0],
                        destino: parts[parts.length - 1],
                        paradas: parts.length - 2,
                        escalas: parts.slice(1, -1),
                    };
                };

                // Se não há coluna de rota, tenta inferir do programa/departs/arrives
                const routeInfo = routeText
                    ? parseRouteInline(routeText)
                    : { origem: departs, destino: arrives, paradas: 0, escalas: [] };

                // Calcula duração se tiver partida e chegada
                const calcDur = (p, c) => {
                    if (!p || !c) return null;
                    const [hP, mP] = p.replace(/[^0-9:]/g, '').split(':').map(Number);
                    const [hC, mC] = c.replace(/[^0-9:]/g, '').split(':').map(Number);
                    if (isNaN(hP) || isNaN(hC)) return null;
                    let min = (hC * 60 + mC) - (hP * 60 + mP);
                    if (min < 0) min += 24 * 60;
                    return min;
                };

                const duracaoMin = calcDur(departs, arrives);

                resultados.push({
                    companhiaAerea: program || 'Desconhecido',
                    rota: routeText || `${routeInfo.origem} → ${routeInfo.destino}`,
                    origem: routeInfo.origem,
                    destino: routeInfo.destino,
                    paradas: routeInfo.paradas,
                    escalas: routeInfo.escalas,
                    dataVoo: dateVal || 'N/A',
                    partida: departs || null,
                    chegada: arrives || null,
                    duracaoMin,
                    precoMilhas: bestMiles,
                    cabineEncontrada: bestCabin,
                    economy,
                    premiumEconomy,
                    business,
                    first,
                    taxas: taxesText || '0',
                });
            });

            return { voos: resultados, debug: { tableFound: true, totalTables: tables.length, headers, colMap, rowCount: rows.length } };
        });

        console.log(`[SeatsAero] Debug:`, JSON.stringify(debug));
        console.log(`[SeatsAero] Concluído: ${voos.length} voos extraídos.`);
        return voos;

    } catch (error) {
        console.error(`[SeatsAero] Erro técnico: ${error.message}`);
        return [];
    } finally {
        if (browser) {
            await browser.close();
            console.log('[SeatsAero] Browser fechado.');
        }
    }
}

// ─── Execução direta via terminal ─────────────────────────────────────────────
import url from 'url';
const isMain = import.meta.url === url.pathToFileURL(process.argv[1]).href;

if (isMain) {
    const [,, org = 'GRU', dst = 'MIA', dt = '2026-04-15'] = process.argv;
    buscarVoosSeatsAero(org, dst, dt).then(dados => {
        console.log('\n=== RESULTADO ===\n');
        console.log(JSON.stringify(dados, null, 2));
    });
}
