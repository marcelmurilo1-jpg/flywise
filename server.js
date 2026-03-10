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

async function scrapeGoogleFlights(origin, destination, date, returnDate = null) {
    return scrapeLimit(async () => {
        const browser = await getBrowser();
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            locale: 'pt-BR',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
        });
        const page = await context.newPage();

        // Intercepta respostas com dados de voos (JSON com ofertas)
        const captured = [];
        page.on('response', async (response) => {
            const url = response.url();
            if (!url.includes('travel/flights') && !url.includes('tfs=')) return;
            const ct = response.headers()['content-type'] ?? '';
            if (!ct.includes('json')) return;
            try {
                const json = await response.json().catch(() => null);
                if (json) captured.push(json);
            } catch {}
        });

        try {
            const tripParam = returnDate ? '' : '+one+way';
            const returnParam = returnDate ? `+return+${returnDate}` : '';
            const query = encodeURIComponent(`Flights from ${origin} to ${destination} on ${date}${returnParam}${tripParam}`);
            const url = `https://www.google.com/travel/flights?q=${query}&curr=BRL&hl=pt-BR`;

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // Aguarda resultados aparecerem (vários seletores possíveis)
            await Promise.race([
                page.waitForSelector('li.pIav2d', { timeout: 20000 }),
                page.waitForSelector('[data-travelport-identifier]', { timeout: 20000 }),
                page.waitForSelector('ul[role="list"] li', { timeout: 20000 }),
            ]).catch(() => console.log('[GFlights] Timeout aguardando seletor — tentando extrair mesmo assim'));

            // Pequena pausa para garantir que os dados de rede foram capturados
            await page.waitForTimeout(1500);

            // Extrai dados do DOM como fallback
            const domFlights = await page.evaluate(() => {
                const results = [];

                // Seletores em ordem de preferência
                const selectors = ['li.pIav2d', 'li[data-id]', 'ul[jsname] > li'];
                let items = [];
                for (const sel of selectors) {
                    items = [...document.querySelectorAll(sel)];
                    if (items.length > 0) break;
                }

                items.forEach((node, idx) => {
                    const text = node.innerText ?? '';
                    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                    if (lines.length < 4) return;

                    // Preço: linha contendo R$ ou apenas dígitos/vírgula após "R"
                    const priceLine = lines.find(l => /R\$|BRL/.test(l) || /^\d[\d.,]+$/.test(l));
                    const priceRaw = priceLine ? priceLine.replace(/[^\d]/g, '') : '0';
                    const price = parseInt(priceRaw, 10) || 0;

                    // Horários: padrão HH:MM
                    const times = lines.filter(l => /^\d{1,2}:\d{2}$/.test(l));
                    const departure = times[0] ?? '';
                    const arrival   = times[1] ?? '';

                    // Duração: padrão "Xh Ymin" ou "X h Y min"
                    const durationLine = lines.find(l => /\d+\s*h/.test(l) && !/R\$/.test(l));

                    // Companhia aérea: heurística — linha sem números, após os horários
                    const airlineGuess = lines.find(l =>
                        !/\d{1,2}:\d{2}/.test(l) &&
                        !/R\$/.test(l) &&
                        !/\d+\s*h/.test(l) &&
                        l.length > 2 && l.length < 60
                    ) ?? '';

                    // Paradas
                    const stopsLine = lines.find(l => /direto|sem escala|parada|stop/i.test(l)) ?? '';
                    const stops = /direto|sem escala|nonstop/i.test(stopsLine) ? 0 : 1;

                    results.push({
                        idx,
                        companhia: airlineGuess,
                        partida: departure,
                        chegada: arrival,
                        duracao: durationLine ?? '',
                        paradas: stops,
                        preco_brl: price,
                        raw_lines: lines.slice(0, 10),
                    });
                });

                return results;
            });

            await context.close();
            return domFlights;
        } catch (err) {
            console.error('[GFlights] Erro ao fazer scraping:', err.message);
            await context.close();
            return [];
        }
    });
}

// Converte resultado do scraper para o formato FlightOffer usado no frontend
function mapToFlightOffer(item, origin, destination, date, idx) {
    const dateStr = date + 'T' + (item.partida || '00:00') + ':00';
    const arrivalStr = date + 'T' + (item.chegada || '00:00') + ':00';
    return {
        id: `gf-${idx}-${Date.now()}`,
        companhia: item.companhia || 'Companhia não identificada',
        carrierCode: item.companhia?.slice(0, 2).toUpperCase() || 'XX',
        preco_brl: item.preco_brl,
        taxas_brl: 0,
        partida: dateStr,
        chegada: arrivalStr,
        origem: origin.toUpperCase(),
        destino: destination.toUpperCase(),
        duracao_min: 0,
        paradas: item.paradas ?? 0,
        cabin_class: 'economy',
        voo_numero: `${item.companhia?.slice(0, 2).toUpperCase() ?? 'XX'}${idx + 1}`,
        segmentos: [],
        flight_key: `gf-${origin}-${destination}-${date}-${idx}`,
        provider: 'google',
        raw_lines: item.raw_lines,
    };
}

// GET /api/amadeus/flights — agora usa o scraper do Google Flights
app.get('/api/amadeus/flights', async (req, res) => {
    const {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        returnDate,
    } = req.query;

    if (!origin || !destination || !date) {
        return res.status(400).json({ errors: [{ detail: 'origin, destination e departureDate são obrigatórios' }] });
    }

    console.log(`[GFlights] Buscando ${origin} → ${destination} em ${date}${returnDate ? ` (volta: ${returnDate})` : ''}`);

    try {
        const raw = await scrapeGoogleFlights(origin, destination, date, returnDate || null);

        if (raw.length === 0) {
            console.warn('[GFlights] Nenhum voo extraído — possível bloqueio ou mudança de seletor.');
        }

        const offers = raw
            .filter(item => item.preco_brl > 0)
            .map((item, idx) => mapToFlightOffer(item, origin, destination, date, idx));

        console.log(`[GFlights] ${offers.length} voos mapeados.`);
        // Retorna no mesmo formato que o Amadeus para compatibilidade com o frontend
        res.json({ data: offers, meta: { count: offers.length, source: 'google-flights-scraper' } });
    } catch (err) {
        console.error('[GFlights] Erro:', err.message);
        res.status(500).json({ errors: [{ detail: err.message }] });
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
