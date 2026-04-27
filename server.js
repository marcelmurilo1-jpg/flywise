import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM ?? 'FlyWise <alertas@flywise.app>';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── PLAYWRIGHT_BROWSERS_PATH DEVE ser definido ANTES do import do playwright ────────────
// Em Railway: /app/.playwright-browsers é instalado no BUILD (baked na imagem Docker).
// Em dev local: deixa o Playwright usar o path padrão (~/.cache/ms-playwright).
// Nunca usar /tmp — ele é limpo a cada restart, forçando reinstalação de 60-90s.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    // Detecta Railway pela existência do path de build — mais confiável que variáveis de env
    const railwayPath = '/app/.playwright-browsers';
    if (fs.existsSync(railwayPath)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = railwayPath;
    }
    // else: dev local — usa path padrão do Playwright (~/.cache/ms-playwright)
}
console.log('[Playwright] PLAYWRIGHT_BROWSERS_PATH:', process.env.PLAYWRIGHT_BROWSERS_PATH ?? '(default)');

// Carrega variáveis do ambiente (tenta .env.local e .env globalmente)
dotenv.config({ path: '.env.local' });
dotenv.config();

// Dynamic import do playwright-extra com stealth APÓS definir o env var
const { chromium: chromiumExtra } = await import('playwright-extra');
const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
chromiumExtra.use(StealthPlugin());

// ─── Chromium: instalação lazy (não bloqueia startup do servidor) ─────────────
// A instalação roda em background após o app.listen(). Requisições ao scraper
// aguardam via chromiumReady antes de tentar lançar o browser.
let _chromiumInstalling = false;

// Verifica se o binário realmente existe em disco (não apenas se o path foi calculado)
function chromiumBinaryExists() {
    try {
        const p = chromiumExtra.executablePath();
        return p && fs.existsSync(p);
    } catch {
        return false;
    }
}

let _chromiumReady = chromiumBinaryExists();
console.log('[Playwright] Chromium binário encontrado:', _chromiumReady, '→', (() => { try { return chromiumExtra.executablePath(); } catch { return 'n/a'; } })());

async function ensureChromium() {
    // Re-checa o disco a cada chamada — o binário pode ter sumido após restart
    if (chromiumBinaryExists()) { _chromiumReady = true; return; }
    _chromiumReady = false;

    if (_chromiumInstalling) {
        while (_chromiumInstalling) await new Promise(r => setTimeout(r, 500));
        return;
    }
    _chromiumInstalling = true;
    try {
        console.log('[Playwright] Instalando Chromium (pode levar ~90s)...');
        const playwrightBin = path.join(__dirname, 'node_modules', '.bin', 'playwright');
        await new Promise((resolve, reject) => {
            const child = spawn(playwrightBin, ['install', 'chromium'], {
                stdio: 'inherit',
                env: { ...process.env },
            });
            child.on('close', code => code === 0 ? resolve() : reject(new Error(`playwright install saiu com código ${code}`)));
            child.on('error', reject);
        });
        _chromiumReady = true;
        console.log('[Playwright] Chromium instalado com sucesso.');
    } catch (e) {
        console.warn('[Playwright] Falha ao instalar Chromium:', e.message);
    } finally {
        _chromiumInstalling = false;
    }
}

// ─── Handlers globais para evitar crash por exceção não capturada ─────────────
process.on('uncaughtException', (err) => {
    console.error('[FATAL] uncaughtException — servidor continua:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] unhandledRejection — servidor continua:', reason);
});

const app = express();
app.use(cors());
app.use(express.json());

// ─── Middleware de autenticação para endpoints admin ──────────────────────────
function requireSyncSecret(req, res, next) {
    if (process.env.NODE_ENV !== 'production') return next();
    const secret = req.headers['x-sync-secret'] ?? '';
    if (!process.env.SYNC_SECRET || secret !== process.env.SYNC_SECRET) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    next();
}

// ─── Health check (Railway monitora este endpoint) ────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

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

async function fetchSeatsAeroAPI(origin, destination, startDate, endDate) {
    if (!SEATS_AERO_API_KEY) {
        throw new Error('SEATS_AERO_API_KEY não configurada. Adicione ao .env.local');
    }
    const params = new URLSearchParams({
        origin_airport: origin.toUpperCase(),
        destination_airport: destination.toUpperCase(),
        start_date: startDate,
        end_date: endDate ?? startDate,
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

const SOURCE_TO_PROGRAM = {
    smiles: 'Smiles', delta: 'SkyMiles', american: 'AAdvantage',
    united: 'MileagePlus', aeroplan: 'Aeroplan', flyingblue: 'Flying Blue',
    lifemiles: 'Lifemiles', virginatlantic: 'Virgin Points', alaska: 'Mileage Plan',
    latam: 'LATAM Pass', azul: 'TudoAzul', emirates: 'Skywards',
    turkish: 'Miles&Smiles', jetblue: 'TrueBlue', iberia: 'Iberia Plus',
    singapore: 'KrisFlyer', qatar: 'Avios (Qatar)', british: 'Avios (BA)',
    avianca: 'Lifemiles', aircanada: 'Aeroplan',
}
function normalizeSourceKey(raw) {
    return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
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
        taxas: (() => {
            const amt = item.TaxAmount ?? item.Taxes ?? null
            const cur = item.TaxCurrency ?? 'USD'
            if (amt && Number(amt) > 0) return `${cur} ${Number(amt) % 1 === 0 ? Number(amt) : Number(amt).toFixed(2)}`
            const trip = (item.AvailabilityTrips ?? [])[0]
            if (trip?.TaxAmount && Number(trip.TaxAmount) > 0) return `${trip.TaxCurrency ?? 'USD'} ${Number(trip.TaxAmount).toFixed(2)}`
            return '0'
        })(),
        tipo,
        source: item.Source ?? '',
        programName: SOURCE_TO_PROGRAM[normalizeSourceKey(item.Source ?? '')] ?? item.Source ?? '',
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
    const { origem, destino, data_ida, data_volta } = req.body;
    console.log(`[Express] /api/search-flights — ${req.body?.origem} → ${req.body?.destino} | SEATS_AERO_API_KEY: ${SEATS_AERO_API_KEY ? '✅' : '❌ AUSENTE'}`)

    if (!SEATS_AERO_API_KEY) {
        console.error('[Express] SEATS_AERO_API_KEY não configurada.')
        return res.status(200).json({
            error: 'API Key do Seats.aero não configurada no servidor. Adicione SEATS_AERO_API_KEY nas variáveis do Railway.',
            voos: [],
        })
    }

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
                .eq('data_ida', data_ida)
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
        const promessas = [fetchSeatsAeroAPI(origem, destino, data_ida, data_ida)];
        if (data_volta) promessas.push(fetchSeatsAeroAPI(destino, origem, data_volta, data_volta));

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
                .eq('origem', origem.toUpperCase()).eq('destino', destino.toUpperCase()).eq('data_ida', data_ida)
                .lt('criado_em', ttlLimit);
            const { error: insertErr } = await supabase.from('seatsaero_searches')
                .insert([{ origem: origem.toUpperCase(), destino: destino.toUpperCase(), data_ida, dados: resultadosFinais }]);
            if (insertErr) console.error('[Express] Erro ao salvar cache:', insertErr.message);
            else console.log(`[Express] Cache salvo: ${resultadosFinais.length} voos.`);
        }

        res.json({ origem, destino, total: resultadosFinais.length, voos: resultadosFinais, source: 'api' });

    } catch (err) {
        console.error('[Express] Erro em /api/search-flights:', err.message);
        res.status(500).json({ error: err.message || 'Erro ao buscar voos do Seats.aero' });
    }
});

// ─── Discover Routes — "Para onde posso voar?" ───────────────────────────────
// POST /api/discover-routes
// Body: { origin: string, destinations: string[], months: string[], cabin: 'economy'|'business' }
// Returns: { routes: RouteResult[] }
app.post('/api/discover-routes', async (req, res) => {
    const { origin, destinations, months, cabin = 'economy' } = req.body ?? {};

    if (!SEATS_AERO_API_KEY) {
        return res.status(200).json({ error: 'SEATS_AERO_API_KEY não configurada.', routes: [] });
    }
    if (!origin || !Array.isArray(destinations) || destinations.length === 0 || !Array.isArray(months) || months.length === 0) {
        return res.status(400).json({ error: 'origin, destinations[] e months[] são obrigatórios' });
    }

    const DISCOVER_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

    function getSampleDates(months) {
        const dates = [];
        for (const m of months) {
            dates.push(`${m}-05`, `${m}-15`, `${m}-25`);
        }
        return dates;
    }

    const sampleDates = getSampleDates(months);
    const discoverLimit = pLimit(3);

    const tasks = destinations.map(destination => discoverLimit(async () => {
        const byProgram = {};

        for (const date of sampleDates) {
            let items = null;
            if (supabase) {
                const ttlLimit = new Date(Date.now() - DISCOVER_TTL_MS).toISOString();
                const { data: cached } = await supabase
                    .from('seatsaero_searches')
                    .select('dados')
                    .eq('origem', origin.toUpperCase())
                    .eq('destino', destination.toUpperCase())
                    .eq('data_ida', date)
                    .gte('criado_em', ttlLimit)
                    .order('criado_em', { ascending: false })
                    .limit(1)
                    .single();
                if (cached?.dados) items = cached.dados;
            }

            if (!items) {
                try {
                    const raw = await fetchSeatsAeroAPI(origin.toUpperCase(), destination.toUpperCase(), date);
                    items = raw.map(i => mapSeatsAeroItem(i, 'ida'));
                    if (supabase && items.length > 0) {
                        await supabase.from('seatsaero_searches').insert([{
                            origem: origin.toUpperCase(),
                            destino: destination.toUpperCase(),
                            data_ida: date,
                            dados: items,
                        }]).then(({ error }) => {
                            if (error && error.code !== '23505')
                                console.warn(`[Discover] Cache write error ${origin}→${destination}:`, error.message);
                        });
                    }
                } catch (e) {
                    console.warn(`[Discover] ${origin}→${destination} ${date}:`, e.message);
                    continue;
                }
            }

            for (const item of (items ?? [])) {
                const src = (item.source ?? 'unknown').toLowerCase();
                if (!byProgram[src]) {
                    byProgram[src] = {
                        source: item.source ?? '',
                        programName: item.programName ?? item.source ?? '',
                        economy_miles: null,
                        business_miles: null,
                        economy_direct: false,
                        business_direct: false,
                        sampleDate: date,
                    };
                }
                const p = byProgram[src];
                if (item.economy != null && (p.economy_miles === null || item.economy < p.economy_miles)) {
                    p.economy_miles = item.economy;
                    p.economy_direct = item.paradas === 0;
                    p.sampleDate = date;
                }
                if (item.business != null && (p.business_miles === null || item.business < p.business_miles)) {
                    p.business_miles = item.business;
                    p.business_direct = item.paradas === 0;
                }
            }
        }

        const results = Object.values(byProgram).filter(p =>
            cabin === 'business' ? p.business_miles != null : p.economy_miles != null
        );

        return results.length > 0 ? { destination, results_by_program: results } : null;
    }));

    const settled = await Promise.all(tasks);
    const routes = settled.filter(Boolean);
    res.json({ routes });
});

// ─── Watchlist CRUD ───────────────────────────────────────────────────────────

// GET /api/watchlist — list user's active watchlist items
app.get('/api/watchlist', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const limit = await getWatchlistLimit(req.userId);
    const { data, error } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', req.userId)
        .eq('active', true)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ items: data ?? [], limit, used: (data ?? []).length });
});

// POST /api/watchlist — create a new watchlist item
app.post('/api/watchlist', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    const limit = await getWatchlistLimit(req.userId);
    if (limit === 0) return res.status(403).json({ error: 'Seu plano não inclui watchlist. Faça upgrade.' });

    const { count } = await supabase
        .from('watchlist_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)
        .eq('active', true);
    if ((count ?? 0) >= limit) {
        return res.status(403).json({ error: `Limite de ${limit} rotas atingido. Exclua uma ou faça upgrade.` });
    }

    const { type, origin, destination, threshold_brl, airline, travel_date,
            threshold_miles, program, cabin, channel } = req.body ?? {};

    if (!type || !['cash', 'miles'].includes(type) || !origin || !destination) {
        return res.status(400).json({ error: 'type deve ser "cash" ou "miles", origin e destination são obrigatórios' });
    }
    if (type === 'cash' && (!threshold_brl || isNaN(Number(threshold_brl)) || Number(threshold_brl) <= 0)) {
        return res.status(400).json({ error: 'threshold_brl deve ser um número positivo' });
    }
    if (type === 'miles' && (!threshold_miles || isNaN(Number(threshold_miles)) || Number(threshold_miles) <= 0)) {
        return res.status(400).json({ error: 'threshold_miles deve ser um número positivo' });
    }

    const { data, error } = await supabase.from('watchlist_items').insert([{
        user_id: req.userId,
        type,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        threshold_brl: threshold_brl ?? null,
        airline: airline ?? null,
        travel_date: travel_date ?? null,
        threshold_miles: threshold_miles ?? null,
        program: program ?? null,
        cabin: cabin ?? null,
        channel: channel ?? 'email',
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ item: data });
});

// PATCH /api/watchlist/:id — update channel or threshold
app.patch('/api/watchlist/:id', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { channel, threshold_brl, threshold_miles } = req.body ?? {};
    const updates = {};
    if (channel) updates.channel = channel;
    if (threshold_brl != null) updates.threshold_brl = threshold_brl;
    if (threshold_miles != null) updates.threshold_miles = threshold_miles;
    const { data, error } = await supabase
        .from('watchlist_items')
        .update(updates)
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ item: data });
});

// DELETE /api/watchlist/:id — soft delete (active = false)
app.delete('/api/watchlist/:id', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { data, error } = await supabase
        .from('watchlist_items')
        .update({ active: false })
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ ok: true });
});

// ─── Watchlist email sender ───────────────────────────────────────────────────
async function fetchPromosParaPrograma(program) {
    if (!program || !supabase) return []
    try {
        const now = new Date().toISOString()
        const { data } = await supabase
            .from('promocoes')
            .select('titulo, subcategoria, bonus_pct, valid_until')
            .or(`valid_until.is.null,valid_until.gt.${now}`)
            .eq('categoria', 'milhas')
            .overlaps('programas_tags', [program])
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(3)
        return data ?? []
    } catch { return [] }
}

async function sendWatchlistEmail({ toEmail, toName, item, triggeredValue, promosAtivas = [] }) {
    if (!resend) { console.warn('[Watchlist] Resend não configurado.'); return; }

    const isCash = item.type === 'cash';
    const subject = isCash
        ? `✈️ Alerta FlyWise — Preço caiu! ${item.origin}→${item.destination} R$ ${triggeredValue.toLocaleString('pt-BR')}`
        : `✈️ Alerta FlyWise — Preço em milhas Caiu! ${item.origin}→${item.destination} ${item.program} ${triggeredValue.toLocaleString('pt-BR')} milhas`;

    const appUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'https://flywisebr.com';
    const ctaUrl = isCash
        ? `${appUrl}/resultados?orig=${item.origin}&dest=${item.destination}&date=${item.travel_date ?? ''}`
        : `${appUrl}/resultados?orig=${item.origin}&dest=${item.destination}`;

    const priceLabel = isCash
        ? `R$ ${triggeredValue.toLocaleString('pt-BR')}`
        : `${triggeredValue.toLocaleString('pt-BR')} milhas`;
    const limitLabel = isCash
        ? `R$ ${item.threshold_brl.toLocaleString('pt-BR')}`
        : `${item.threshold_miles.toLocaleString('pt-BR')} milhas`;
    const diff = isCash
        ? item.threshold_brl - triggeredValue
        : item.threshold_miles - triggeredValue;
    const diffLabel = isCash
        ? `R$ ${diff.toLocaleString('pt-BR')} abaixo do seu limite`
        : `${diff.toLocaleString('pt-BR')} milhas abaixo do seu limite`;
    const ctaText = isCash ? 'Ver voo agora →' : 'Ver estratégia →';
    const headerEmoji = isCash ? '✈️' : '🎯';
    const headerTitle = isCash ? 'Preço caiu!' : 'Preço em milhas Caiu!';
    const subInfo = isCash
        ? `${item.origin} → ${item.destination}${item.airline ? ` · ${item.airline}` : ''}${item.travel_date ? ` · ${item.travel_date}` : ''}`
        : `${item.origin} → ${item.destination} · ${item.program ?? ''} · ${item.cabin === 'business' ? 'Business' : 'Economy'}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#F7F9FC;margin:0;padding:24px 16px}
  .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 48px rgba(14,42,85,.12)}
  .hdr{background:linear-gradient(135deg,#0E2A55,#2A60C2);padding:28px 32px 24px;text-align:center}
  .logo{font-size:22px;font-weight:900;color:#fff;letter-spacing:-.03em}
  .logo span{color:rgba(255,255,255,.5)}
  .tag{font-size:11px;color:rgba(255,255,255,.6);font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-top:4px}
  .banner{padding:20px 32px 16px;border-bottom:1px solid #E2EAF5}
  .em{font-size:32px;display:block;margin-bottom:8px}
  .ttl{font-size:20px;font-weight:900;color:#0E2A55;letter-spacing:-.02em;margin-bottom:4px}
  .sub{font-size:13px;color:#6B7A99;font-weight:600}
  .card{margin:20px 32px;background:#F7F9FC;border:1.5px solid #E2EAF5;border-radius:14px;padding:18px 20px}
  .rname{font-size:16px;font-weight:900;color:#0E2A55;letter-spacing:-.01em;margin-bottom:4px}
  .rsub{font-size:12px;color:#6B7A99;font-weight:600;margin-bottom:16px}
  .prow{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .pnow{flex:1;background:linear-gradient(135deg,#0E2A55,#2A60C2);border-radius:12px;padding:14px 16px;text-align:center;color:#fff}
  .plbl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.65);margin-bottom:4px}
  .pval{font-size:22px;font-weight:900;letter-spacing:-.02em}
  .arr{font-size:20px;color:#C0CFEA;flex-shrink:0}
  .pwas{flex:1;background:#fff;border:1.5px solid #E2EAF5;border-radius:12px;padding:14px 16px;text-align:center}
  .pwas .plbl{color:#A0AECB}
  .pwas .pval{font-size:18px;font-weight:800;color:#C0CFEA;text-decoration:line-through}
  .sav{margin:0 32px 20px;background:#ECFDF5;border:1.5px solid #6EE7B7;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;color:#065F46}
  .cta{margin:0 32px 20px;text-align:center}
  .btn{display:inline-block;background:linear-gradient(135deg,#2A60C2,#1A4A9C);color:#fff;font-size:14px;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:-.01em}
  .ftr{border-top:1px solid #E2EAF5;padding:16px 32px 20px;text-align:center;font-size:11px;color:#A0AECB;line-height:1.6}
  .ftr a{color:#2A60C2;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="logo">Fly<span>Wise</span></div>
    <div class="tag">${isCash ? 'Alerta de Preço' : 'Alerta de Milhas'}</div>
  </div>
  <div class="banner">
    <span class="em">${headerEmoji}</span>
    <div class="ttl">${headerTitle}</div>
    <div class="sub">Oi ${toName ?? 'viajante'}, o preço que você monitorava caiu!</div>
  </div>
  <div class="card">
    <div class="rname">${item.origin} → ${item.destination}</div>
    <div class="rsub">${subInfo}</div>
    <div class="prow">
      <div class="pnow"><div class="plbl">Agora</div><div class="pval">${priceLabel}</div></div>
      <div class="arr">↓</div>
      <div class="pwas"><div class="plbl">Seu limite</div><div class="pval">${limitLabel}</div></div>
    </div>
  </div>
  <div class="sav">💚 ${diffLabel} — aproveite antes de subir!</div>
  ${promosAtivas.length > 0 ? `
  <div style="margin:0 32px 20px;padding:16px;background:#EDE9FE;border-radius:12px;">
    <div style="font-size:11px;font-weight:700;color:#6D28D9;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">⚡ Promoções ativas para ${item.program ?? ''}</div>
    ${promosAtivas.map(p => `
      <div style="font-size:13px;color:#374151;margin-bottom:4px;">
        ${p.subcategoria === 'transferencia' ? '🔄' : p.subcategoria === 'clube' ? '⭐' : '📍'}
        ${p.titulo}
        ${p.valid_until ? `<span style="font-size:11px;color:#6D28D9;"> · expira ${new Date(p.valid_until).toLocaleDateString('pt-BR')}</span>` : ''}
      </div>
    `).join('')}
  </div>` : ''}
  <div class="cta"><a href="${ctaUrl}" class="btn">${ctaText}</a></div>
  <div class="ftr">
    Você receberá outro aviso em 7 dias se o preço continuar baixo.<br>
    <a href="${appUrl}/configuracoes">Gerenciar alertas</a> · <a href="${appUrl}/configuracoes">Cancelar este alerta</a>
  </div>
</div>
</body>
</html>`;

    try {
        await resend.emails.send({
            from: RESEND_FROM,
            to: toEmail,
            subject,
            html,
        });
        console.log(`[Watchlist] Email enviado para ${toEmail}: ${item.origin}→${item.destination}`);
    } catch (e) {
        console.error('[Watchlist] Erro ao enviar email:', e.message);
    }
}

// POST /api/watchlist/check — triggered daily by GitHub Actions
app.post('/api/watchlist/check', requireSyncSecret, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = new Date();

    // Load all active items
    const { data: items, error: loadErr } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('active', true);

    if (loadErr) return res.status(500).json({ error: loadErr.message });
    if (!items || items.length === 0) return res.json({ checked: 0, triggered: 0 });

    // Load user emails in bulk via admin auth API
    const userIds = [...new Set(items.map(i => i.user_id))];
    let emailMap = {};
    let nameMap = {};
    try {
        const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        for (const u of (users ?? [])) {
            if (userIds.includes(u.id)) {
                emailMap[u.id] = u.email;
                nameMap[u.id] = u.user_metadata?.name ?? u.email?.split('@')[0] ?? 'viajante';
            }
        }
    } catch (e) {
        console.warn('[Watchlist] Não foi possível carregar emails de usuários:', e.message);
    }

    const checkLimit = pLimit(2); // max 2 scrapes in parallel
    let triggered = 0;

    const tasks = items.map(item => checkLimit(async () => {
        try {
            let triggeredValue = null;

            if (item.type === 'cash') {
                const date = item.travel_date ?? (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(15);
                    return d.toISOString().slice(0, 10);
                })();
                const { outbound } = await doScrape(item.origin, item.destination, date, null);
                const candidates = (outbound ?? []).filter(f =>
                    f.preco_brl > 0 && (!item.airline || f.companhia === item.airline)
                );
                if (candidates.length === 0) return;
                const best = Math.min(...candidates.map(f => f.preco_brl));
                if (best < item.threshold_brl) triggeredValue = best;

            } else {
                // miles
                const date = item.travel_date ?? (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(15);
                    return d.toISOString().slice(0, 10);
                })();
                const raw = await fetchSeatsAeroAPI(item.origin, item.destination, date);
                const mapped = raw.map(r => mapSeatsAeroItem(r, 'ida'));
                const cabin = item.cabin === 'business' ? 'business' : 'economy';
                const candidates = mapped.filter(r => {
                    const src = (r.source ?? r.programName ?? '').toLowerCase();
                    const prog = (item.program ?? '').toLowerCase();
                    return (!item.program || src.includes(prog) || prog.includes(src)) && r[cabin] != null;
                });
                if (candidates.length === 0) return;
                const best = Math.min(...candidates.map(r => r[cabin]));
                if (best < item.threshold_miles) triggeredValue = best;
            }

            // Update last_checked_at regardless
            await supabase.from('watchlist_items')
                .update({ last_checked_at: now.toISOString() })
                .eq('id', item.id);

            if (triggeredValue === null) return;

            // Check cooldown
            const lastNotified = item.last_notified_at ? new Date(item.last_notified_at) : null;
            if (lastNotified && (now - lastNotified) < COOLDOWN_MS) {
                console.log(`[Watchlist] Cooldown ativo para item ${item.id}`);
                return;
            }

            // Send email
            const toEmail = emailMap[item.user_id];
            if (toEmail) {
                const promosAtivas = item.program ? await fetchPromosParaPrograma(item.program) : []
                await sendWatchlistEmail({
                    toEmail,
                    toName: nameMap[item.user_id],
                    item,
                    triggeredValue,
                    promosAtivas,
                });
                await supabase.from('watchlist_items')
                    .update({ last_notified_at: now.toISOString() })
                    .eq('id', item.id);
                triggered++;
            }
        } catch (e) {
            console.error(`[Watchlist] Erro ao checar item ${item.id}:`, e.message);
        }
    }));

    await Promise.all(tasks);
    console.log(`[Watchlist] Verificados: ${items.length} | Alertas enviados: ${triggered}`);
    res.json({ checked: items.length, triggered });
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
const scrapeLimit = pLimit(1); // Railway: 1 aba por vez (limite de processos do container)
let _browser = null;

// ── Pool de User-Agents reais do Chrome 129-132 (atualizados para 2026) ───────
const UA_POOL = [
    // Chrome 132 (Jan 2026)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    // Chrome 131 (Nov 2025)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    // Chrome 130 (Out 2025)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    // Chrome 129 (Set 2025)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
];

// Extrai versão major do Chrome a partir do UA (ex: "124")
function getChromeVersion(ua) {
    return ua.match(/Chrome\/(\d+)/)?.[1] ?? '124';
}

// Detecta plataforma a partir do UA para sec-ch-ua-platform
function getPlatform(ua) {
    if (/Macintosh/i.test(ua)) return 'macOS';
    if (/X11|Linux/i.test(ua)) return 'Linux';
    return 'Windows';
}

// ── Pool de timezones ─────────────────────────────────────────────────────────
const TIMEZONE_POOL = [
    'America/Sao_Paulo', 'America/Sao_Paulo', 'America/Sao_Paulo', // peso maior BR
    'America/Recife', 'America/Manaus', 'America/Belem',
    'America/New_York', 'America/Chicago', 'America/Los_Angeles',
    'Europe/Lisbon', 'Europe/Madrid', 'Europe/London',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Resolve o executável do Chromium: tenta playwright-extra primeiro, cai no sistema (apt)
function resolveChromiumPath() {
    try {
        const p = chromiumExtra.executablePath();
        if (p && fs.existsSync(p)) return p;
    } catch (_) {}
    // Fallback: chromium instalado via apt no nixpacks
    for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
        if (fs.existsSync(p)) { console.log('[GFlights] Usando chromium do sistema:', p); return p; }
    }
    throw new Error('Chromium não encontrado. Verifique o build do Railway.');
}

async function getBrowser() {
    if (_browser && _browser.isConnected()) return _browser;
    // Reset zombie browser before relaunching
    if (_browser) {
        try { await _browser.close(); } catch (_) {}
        _browser = null;
    }
    await ensureChromium(); // tenta instalar se binário sumiu
    const opts = {
        headless: true,
        executablePath: resolveChromiumPath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--renderer-process-limit=1',  // limita a 1 processo renderer sem quebrar a rede
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate',
            '--disable-default-apps',
            '--hide-scrollbars',
            '--mute-audio',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
        ],
    };
    if (process.env.PROXY_URL) opts.proxy = { server: process.env.PROXY_URL };
    _browser = await chromiumExtra.launch(opts);
    // Auto-reset when browser crashes or disconnects
    _browser.on('disconnected', () => {
        console.log('[GFlights] Navegador desconectado — será reiniciado na próxima requisição.');
        _browser = null;
    });
    console.log('[GFlights] Navegador iniciado (stealth ativo).');
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

            // Round-trip URL → Google shows combined prices (outbound + cheapest return)
            // One-way URL   → Google shows individual one-way prices
            const query = returnDate
                ? encodeURIComponent(`Flights from ${origin} to ${destination} on ${date} returning ${returnDate}`)
                : encodeURIComponent(`Flights from ${origin} to ${destination} on ${date} one way`);
            const url = `https://www.google.com/travel/flights?q=${query}&curr=BRL&hl=pt-BR`;

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 22000 });

            // Log diagnóstico: título e URL após navegação
            const pageTitle = await page.title();
            const pageUrl = page.url();
            console.log(`[GFlights] ${origin}→${destination}: title="${pageTitle}" url=${pageUrl}`);

            // Aceita consentimento de cookies do Google (aparece em IPs de servidor)
            const cookieClicked = await page.locator('button:has-text("Accept all"), button:has-text("Aceitar tudo"), button[aria-label*="Accept"], button:has-text("Agree")')
                .first().click({ timeout: 5000 }).then(() => true).catch(() => false);
            if (cookieClicked) {
                console.log(`[GFlights] ${origin}→${destination}: cookie consent clicado, aguardando...`);
                await new Promise(r => setTimeout(r, randInt(800, 1400)));
            }

            // Aguarda os cards de voo aparecerem (div[data-id] com aria-label de voo)
            // Detecta tanto PT ("Reais brasileiros", "Voo da") quanto EN ("From R$", "flight")
            await page.waitForFunction(
                () => [...document.querySelectorAll('div[data-id]')].some(el => {
                    const link = el.querySelector('[aria-label]');
                    const a = link?.getAttribute('aria-label') ?? '';
                    return /Reais brasileiros|Voo da |From R\$|From BRL|BRL\s*\d|\bflight\b/i.test(a);
                }),
                { timeout: 12000 }
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

            const flights = await page.evaluate(() => {
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
                    const pricePT = aria.match(/A partir de (\d[\d\s]*) Reais/i);
                    if (pricePT) preco_brl = parseInt(pricePT[1].replace(/\s/g, ''), 10);
                    if (!preco_brl) {
                        const priceEN = aria.match(/(?:From\s+)?(?:R\$|BRL\s*)(\d[\d,]*)/i);
                        if (priceEN) preco_brl = parseInt(priceEN[1].replace(/,/g, ''), 10);
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
                        // EN: "American Airlines flight" — sem âncora ^
                        const airlineEN = aria.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{2,40}?)\s+flight\b/i);
                        if (airlineEN) {
                            const candidate = airlineEN[1].trim();
                            if (!/^(nonstop|direct|total|from|your|this|the|a|an)$/i.test(candidate))
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
                        const CODE_TO_AIRLINE = IATA_TO_AIRLINE;
                        for (const num of flightNumsEarly) {
                            const code = num.match(/^([A-Z]{1,2})/)?.[1] ?? '';
                            if (CODE_TO_AIRLINE[code]) { companhia = CODE_TO_AIRLINE[code]; break; }
                        }
                    }

                    // ── Paradas ──────────────────────────────────────────────────────────────
                    // PT: "Sem escalas" / "com 1 parada"
                    // EN: "Nonstop" / "1 stop"
                    let paradas = 1;
                    if (/Sem escalas/i.test(aria) || /Nonstop/i.test(aria)) {
                        paradas = 0;
                    } else {
                        const stopsPT = aria.match(/com (\d+) parada/i);
                        const stopsEN = aria.match(/(\d+)\s+stop/i);
                        if (stopsPT) paradas = parseInt(stopsPT[1]);
                        else if (stopsEN) paradas = parseInt(stopsEN[1]);
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
                    // Estratégia 1: IATA em parênteses após Parada/Layover (permite pontos no meio)
                    // Ex: "Parada de 1h 43min. em Miami (MIA)" → "MIA"
                    // Ex: "Parada (1 de 2) de 5h em Brasília (BSB)" → "BSB"
                    let layoverCity = '';
                    {
                        // [^;\n] — permite "." no meio (Google coloca ponto antes da cidade)
                        const iataScanner = /(?:Parada|Escala|Layover)[^;\n]*?\(([A-Z]{3})\)/gi;
                        const found = [];
                        let sm;
                        while ((sm = iataScanner.exec(aria)) !== null) found.push(sm[1]);
                        if (found.length > 0) layoverCity = [...new Set(found)].join(' · ');
                    }

                    // Estratégia 2 (fallback): captura nome de cidade após "em" / "in"
                    let lm;
                    if (!layoverCity) {
                        // PT: "Parada ... em Cidade" — para no abre-paren, vírgula, ponto, newline ou palavra-chave
                        lm = aria.match(/(?:Parada|Escala)[^;\n]*?\bem\s+([A-ZÀ-Ÿa-zà-ÿ][^.,()\n;]{2,35}?)(?=\s*(?:\(|[.;,\n]|$))/i);
                        if (lm) layoverCity = lm[1].trim();
                    }
                    if (!layoverCity) {
                        // EN: "Layover ... in City"
                        lm = aria.match(/Layover[^;\n]*?\bin\s+([A-Z][^.,()\n;]{2,35}?)(?=\s*(?:\(|[.;,\n]|$))/i);
                        if (lm) layoverCity = lm[1].trim();
                    }

                    // Estratégia 3 (last resort): todos os IATAs no aria-label; exclui o de
                    // partida/chegada (1º e último) — o(s) restante(s) são conexões
                    if (!layoverCity) {
                        const allIata = [...aria.matchAll(/\(([A-Z]{3})\)/g)].map(m => m[1]);
                        if (allIata.length >= 3) {
                            // 1º = origem, último = destino, do meio = conexões
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
                        return /Reais brasileiros|Voo da |From R\$|From BRL|BRL\s*\d/i.test(a)
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
                            const enM = oa.match(/\b([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s]{2,40}?)\s+flight\b/i);
                            if (enM) {
                                const c = enM[1].trim();
                                if (!/^(nonstop|direct|total|from|your|the|a|an)$/i.test(c)) { parsed.companhia = c; break; }
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
                        const skipLine = /^(\d{1,2}:\d{2}|R\$|BRL|\d+\s*h(?:\s*\d+\s*min)?|\d+\s*(parada|conexão|escala|stop|min)|sem\s+escala|nonstop|direto|selec|ver\s+det|\d+\s*de\s*\d+|\d+[.,]\d)/i;
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
                    if (!parsed.layoverCity && parsed.paradas > 0 && visText) {
                        const orig = parsed.origem || '';
                        const dest = parsed.destino || '';
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
                        // 4c. Row of IATAs: "GRU BOG MIA" — any uppercase 3-letter word between origin and dest
                        if (!parsed.layoverCity && orig && dest) {
                            const allIataVis = [...visText.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]);
                            const mid = allIataVis.filter(c => c !== orig && c !== dest && /^[A-Z]{3}$/.test(c));
                            if (mid.length > 0) parsed.layoverCity = [...new Set(mid)].slice(0, 2).join(' · ');
                        }
                    }
                    // ── Fallback 5: inner aria-labels de outros elementos do card ────────────
                    if (!parsed.layoverCity && parsed.paradas > 0) {
                        const orig = parsed.origem || '';
                        const dest = parsed.destino || '';
                        for (const l of links) {
                            if (l === flightLink) continue;
                            const oa = l.getAttribute('aria-label') ?? '';
                            // "Voo de Avianca de GRU para BOG" — a leg aria-label naming an intermediate airport
                            const legIatas = [...oa.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]);
                            const mid = legIatas.filter(c => c !== orig && c !== dest);
                            if (mid.length > 0) { parsed.layoverCity = [...new Set(mid)].slice(0, 2).join(' · '); break; }
                        }
                    }

                    parsed._domIdx = _curDivIdx; // store DOM index for expandFlightDetails
                    results.push(parsed);
                    if (results.length >= 15) break;
                }

                return results;
            });

            // Sinaliza que os preços são totais de ida+volta (busca round-trip no Google)
            if (returnDate) {
                flights.forEach(f => { f.is_roundtrip_total = true; });
                console.log(`[GFlights] ${origin}→${destination}: round-trip mode — ${flights.length} voos com preço total ida+volta`);
            }

            // Expande voos com conexão para extrair segmentos detalhados
            if (flights.length > 0 && flights.some(f => (f.paradas ?? 0) > 0)) {
                await expandFlightDetails(page, flights).catch(e =>
                    console.log('[GFlights] expandFlightDetails error:', e.message?.slice(0, 80))
                );
            }

            await context.close();
            return flights;
        } catch (err) {
            if (context) { try { await context.close(); } catch (_) {} }
            const isBrowserDead = /closed|disconnected|Target page|crashed/i.test(err.message ?? '');
            if (isBrowserDead && attempt < 2) {
                console.warn(`[GFlights] ${origin}→${destination} — browser morto (tentativa ${attempt}), reiniciando...`);
                _browser = null;
                continue;
            }
            console.error(`[GFlights] ${origin}→${destination} erro:`, err.message);
            return [];
        }
        } // end for
        return [];
    });
}

// ── Airline name normalization ─────────────────────────────────────────────────
const AIRLINE_NAME_MAP = {
    // LATAM
    'latam': 'LATAM Airlines', 'latam airlines': 'LATAM Airlines',
    'latam airlines brasil': 'LATAM Airlines', 'tam': 'LATAM Airlines', 'tam linhas aéreas': 'LATAM Airlines',
    // GOL
    'gol': 'GOL Linhas Aéreas', 'gol linhas aereas': 'GOL Linhas Aéreas', 'gol linhas aéreas': 'GOL Linhas Aéreas',
    'gol transportes aéreos': 'GOL Linhas Aéreas',
    // Azul
    'azul': 'Azul Linhas Aéreas', 'azul linhas aereas': 'Azul Linhas Aéreas', 'azul linhas aéreas': 'Azul Linhas Aéreas',
    'azul linhas aéreas brasileiras': 'Azul Linhas Aéreas', 'azul brazilian airlines': 'Azul Linhas Aéreas',
    // Copa
    'copa': 'Copa Airlines', 'copa airlines': 'Copa Airlines',
    // Avianca
    'avianca': 'Avianca', 'avianca brasil': 'Avianca',
    // US carriers
    'american': 'American Airlines', 'american airlines': 'American Airlines',
    'united': 'United Airlines', 'united airlines': 'United Airlines',
    'delta': 'Delta Air Lines', 'delta air lines': 'Delta Air Lines', 'delta airlines': 'Delta Air Lines',
    'alaska': 'Alaska Airlines', 'alaska airlines': 'Alaska Airlines',
    'jetblue': 'JetBlue', 'jetblue airways': 'JetBlue',
    'southwest': 'Southwest Airlines', 'southwest airlines': 'Southwest Airlines',
    'spirit': 'Spirit Airlines', 'spirit airlines': 'Spirit Airlines',
    'frontier': 'Frontier Airlines', 'frontier airlines': 'Frontier Airlines',
    // European
    'air france': 'Air France',
    'klm': 'KLM', 'klm royal dutch airlines': 'KLM',
    'lufthansa': 'Lufthansa',
    'tap': 'TAP Air Portugal', 'tap air portugal': 'TAP Air Portugal', 'tap portugal': 'TAP Air Portugal',
    'iberia': 'Iberia', 'iberia express': 'Iberia',
    'british airways': 'British Airways', 'ba': 'British Airways',
    'swiss': 'Swiss', 'swiss international air lines': 'Swiss', 'swiss air lines': 'Swiss',
    'austrian': 'Austrian Airlines', 'austrian airlines': 'Austrian Airlines',
    'sas': 'SAS', 'scandinavian airlines': 'SAS',
    'finnair': 'Finnair',
    'ryanair': 'Ryanair',
    'easyjet': 'easyJet', 'easy jet': 'easyJet',
    'wizzair': 'Wizz Air', 'wizz air': 'Wizz Air',
    'virgin atlantic': 'Virgin Atlantic',
    'ita airways': 'ITA Airways', 'ita': 'ITA Airways', 'alitalia': 'ITA Airways',
    'air europa': 'Air Europa',
    // Middle East
    'emirates': 'Emirates',
    'qatar airways': 'Qatar Airways', 'qatar': 'Qatar Airways',
    'turkish airlines': 'Turkish Airlines', 'turkish': 'Turkish Airlines', 'thy': 'Turkish Airlines',
    // Africa
    'ethiopian': 'Ethiopian Airlines', 'ethiopian airlines': 'Ethiopian Airlines',
    'south african airways': 'South African Airways', 'saa': 'South African Airways',
    'kenya airways': 'Kenya Airways',
    // Americas
    'aeromexico': 'Aeromexico', 'aeroméxico': 'Aeromexico',
    'aerolineas argentinas': 'Aerolíneas Argentinas', 'aerolíneas argentinas': 'Aerolíneas Argentinas',
    'air canada': 'Air Canada',
    'westjet': 'WestJet',
    // Asia-Pacific
    'singapore airlines': 'Singapore Airlines', 'singapore': 'Singapore Airlines',
    'cathay pacific': 'Cathay Pacific', 'cathay': 'Cathay Pacific',
    'japan airlines': 'Japan Airlines', 'jal': 'Japan Airlines',
    'ana': 'ANA', 'all nippon airways': 'ANA',
    'korean air': 'Korean Air',
    'air china': 'Air China',
    'china southern': 'China Southern',
    'china eastern': 'China Eastern',
    'thai airways': 'Thai Airways',
    'malaysia airlines': 'Malaysia Airlines',
    // Europa adicional
    'vueling': 'Vueling', 'vueling airlines': 'Vueling',
    'norwegian': 'Norwegian', 'norwegian air shuttle': 'Norwegian', 'norwegian air': 'Norwegian',
    'transavia': 'Transavia', 'transavia france': 'Transavia',
    'iberia express': 'Iberia Express',
    'condor': 'Condor', 'condor flugdienst': 'Condor',
    'tui airways': 'TUI Airways', 'tui fly': 'TUI Airways', 'tuifly': 'TUI Airways',
    'aegean': 'Aegean Airlines', 'aegean airlines': 'Aegean Airlines',
    'air serbia': 'Air Serbia',
    'pegasus': 'Pegasus Airlines', 'pegasus airlines': 'Pegasus Airlines',
    'sunexpress': 'SunExpress', 'sun express': 'SunExpress',
    'norse atlantic': 'Norse Atlantic', 'norse': 'Norse Atlantic',
    // Oriente Médio / África
    'flydubai': 'flydubai', 'fly dubai': 'flydubai',
    'air arabia': 'Air Arabia',
    'saudia': 'Saudia', 'saudi arabian airlines': 'Saudia',
    'oman air': 'Oman Air',
    'gulf air': 'Gulf Air',
    'egyptair': 'EgyptAir', 'egypt air': 'EgyptAir',
    'royal air maroc': 'Royal Air Maroc', 'ram': 'Royal Air Maroc',
    'royal jordanian': 'Royal Jordanian',
    'air algérie': 'Air Algérie', 'air algerie': 'Air Algérie',
    // Ásia-Pacífico adicional
    'air india': 'Air India',
    'asiana': 'Asiana Airlines', 'asiana airlines': 'Asiana Airlines',
    'china airlines': 'China Airlines',
    'eva air': 'EVA Air',
    'vietnam airlines': 'Vietnam Airlines',
    'philippine airlines': 'Philippine Airlines', 'pal': 'Philippine Airlines',
    'garuda': 'Garuda Indonesia', 'garuda indonesia': 'Garuda Indonesia',
    'air astana': 'Air Astana',
    // Brasil regional
    'voepass': 'VOEPASS', 'passaredo': 'VOEPASS',
    'map linhas aéreas': 'MAP Linhas Aéreas', 'map linhas aereas': 'MAP Linhas Aéreas',
    'azul conecta': 'Azul Conecta',
    'latam brasil': 'LATAM Airlines', 'latam airlines brasil': 'LATAM Airlines',
    // América do Sul
    'sky airline': 'Sky Airline', 'sky': 'Sky Airline',
    'jetsmart': 'JetSmart', 'jetsmart airlines': 'JetSmart',
    // América do Norte / Canadá
    'air transat': 'Air Transat', 'transat': 'Air Transat',
    'porter': 'Porter Airlines', 'porter airlines': 'Porter Airlines',
    'hawaiian': 'Hawaiian Airlines', 'hawaiian airlines': 'Hawaiian Airlines',
    // Europa adicional
    'volotea': 'Volotea', 'binter': 'Binter Canarias', 'binter canarias': 'Binter Canarias',
    'smartwings': 'SmartWings',
    // Oriente Médio
    'etihad': 'Etihad Airways', 'etihad airways': 'Etihad Airways',
    // África
    'rwandair': 'RwandAir', 'rwanda air': 'RwandAir',
    // Ásia-Pacífico adicional
    'jetstar': 'Jetstar', 'jetstar airways': 'Jetstar',
    'scoot': 'Scoot', 'scoot airlines': 'Scoot',
    'peach': 'Peach Aviation', 'peach aviation': 'Peach Aviation',
    'airasia': 'AirAsia', 'air asia': 'AirAsia', 'airasia x': 'AirAsia X',
    'indigo': 'IndiGo', 'spicejet': 'SpiceJet',
    'cebu pacific': 'Cebu Pacific', 'cebu': 'Cebu Pacific',
};

const AIRLINE_CODE_MAP = {
    'LATAM Airlines': 'LA', 'GOL Linhas Aéreas': 'G3', 'Azul Linhas Aéreas': 'AD',
    'Copa Airlines': 'CM', 'Avianca': 'AV',
    'American Airlines': 'AA', 'United Airlines': 'UA', 'Delta Air Lines': 'DL',
    'Air France': 'AF', 'KLM': 'KL', 'Lufthansa': 'LH',
    'TAP Air Portugal': 'TP', 'Iberia': 'IB', 'British Airways': 'BA',
    'Emirates': 'EK', 'Qatar Airways': 'QR', 'Turkish Airlines': 'TK',
    'Swiss': 'LX', 'Austrian Airlines': 'OS', 'Ethiopian Airlines': 'ET',
    'Aeromexico': 'AM', 'Air Europa': 'UX',
    'Singapore Airlines': 'SQ', 'Cathay Pacific': 'CX',
    'Japan Airlines': 'JL', 'ANA': 'NH',
    'Alaska Airlines': 'AS', 'JetBlue': 'B6', 'Virgin Atlantic': 'VS',
    'ITA Airways': 'AZ', 'Aerolíneas Argentinas': 'AR',
    'Wizz Air': 'W6', 'Ryanair': 'FR', 'easyJet': 'U2',
    'SAS': 'SK', 'Finnair': 'AY', 'WestJet': 'WS',
    'Air Canada': 'AC', 'Southwest Airlines': 'WN',
    'Spirit Airlines': 'NK', 'Frontier Airlines': 'F9',
    'South African Airways': 'SA', 'Kenya Airways': 'KQ',
    'Korean Air': 'KE', 'Air China': 'CA',
    'China Southern': 'CZ', 'China Eastern': 'MU',
    'Thai Airways': 'TG', 'Malaysia Airlines': 'MH',
    'Vueling': 'VY', 'Norwegian': 'DY', 'Transavia': 'HV',
    'Iberia Express': 'I2', 'flydubai': 'FZ', 'Air Arabia': 'G9',
    'Condor': 'DE', 'TUI Airways': 'BY', 'Aegean Airlines': 'A3',
    'Air Serbia': 'JU', 'EgyptAir': 'MS', 'Royal Air Maroc': 'AT',
    'Saudia': 'SV', 'Oman Air': 'WY', 'Gulf Air': 'GF',
    'Air India': 'AI', 'Asiana Airlines': 'OZ', 'China Airlines': 'CI',
    'EVA Air': 'BR', 'Vietnam Airlines': 'VN', 'Philippine Airlines': 'PR',
    'Garuda Indonesia': 'GA', 'Royal Jordanian': 'RJ', 'Air Algérie': 'AH',
    'Air Astana': 'KC', 'Pegasus Airlines': 'PC', 'SunExpress': 'XQ',
    'Etihad Airways': 'EY', 'IndiGo': '6E', 'SpiceJet': 'SG',
    'RwandAir': 'WB', 'Jetstar': 'JQ', 'Scoot': 'TR', 'Peach Aviation': 'MM',
    'AirAsia': 'AK', 'AirAsia X': 'D7', 'Cebu Pacific': '5J',
    'Volotea': 'V7', 'Binter Canarias': 'NT', 'SmartWings': 'QS',
    'Norse Atlantic': 'NO', 'VOEPASS': 'ZP', 'MAP Linhas Aéreas': '8I',
    'Sky Airline': 'H2', 'JetSmart': 'JA', 'Air Transat': 'TS',
    'Porter Airlines': 'PD', 'Jetstar': 'JQ', 'Scoot': 'TR',
    'Peach Aviation': 'MM', 'AirAsia': 'AK', 'Cebu Pacific': '5J',
    'Volotea': 'V7', 'Binter Canarias': 'NT', 'SmartWings': 'QS',
    'RwandAir': 'WB', 'IndiGo': '6E', 'SpiceJet': 'SG',
    'Hawaiian Airlines': 'HA', 'Sun Country Airlines': 'SY',
    'Azul Conecta': 'QW',
    'Múltiplas companhias': 'XX',
};

// Mapa reverso: código IATA → nome canônico da companhia
const IATA_TO_AIRLINE = {
    'LA': 'LATAM Airlines', 'JJ': 'LATAM Airlines',
    'G3': 'GOL Linhas Aéreas', 'AD': 'Azul Linhas Aéreas', 'QW': 'Azul Conecta',
    'ZP': 'VOEPASS', '8I': 'MAP Linhas Aéreas',
    'CM': 'Copa Airlines', 'AV': 'Avianca',
    'AA': 'American Airlines', 'UA': 'United Airlines', 'DL': 'Delta Air Lines',
    'WN': 'Southwest Airlines', 'B6': 'JetBlue', 'AS': 'Alaska Airlines',
    'NK': 'Spirit Airlines', 'F9': 'Frontier Airlines', 'HA': 'Hawaiian Airlines',
    'SY': 'Sun Country Airlines',
    'AF': 'Air France', 'KL': 'KLM', 'LH': 'Lufthansa',
    'TP': 'TAP Air Portugal', 'IB': 'Iberia', 'BA': 'British Airways',
    'EK': 'Emirates', 'QR': 'Qatar Airways', 'TK': 'Turkish Airlines',
    'LX': 'Swiss', 'OS': 'Austrian Airlines', 'AY': 'Finnair',
    'SK': 'SAS', 'FR': 'Ryanair', 'U2': 'easyJet', 'W6': 'Wizz Air',
    'VY': 'Vueling', 'DY': 'Norwegian', 'HV': 'Transavia', 'TO': 'Transavia France',
    'I2': 'Iberia Express', 'DE': 'Condor', 'BY': 'TUI Airways',
    'A3': 'Aegean Airlines', 'JU': 'Air Serbia', 'OA': 'Olympic Air',
    'PC': 'Pegasus Airlines', 'XQ': 'SunExpress', 'V7': 'Volotea',
    'NT': 'Binter Canarias', 'QS': 'SmartWings', 'NO': 'Norse Atlantic',
    'ET': 'Ethiopian Airlines', 'WB': 'RwandAir', 'KQ': 'Kenya Airways',
    'SA': 'South African Airways',
    'AM': 'Aeromexico', 'UX': 'Air Europa', 'AR': 'Aerolíneas Argentinas',
    'AC': 'Air Canada', 'WS': 'WestJet', 'PD': 'Porter Airlines',
    'TS': 'Air Transat', 'H2': 'Sky Airline', 'JA': 'JetSmart',
    'VS': 'Virgin Atlantic', 'AZ': 'ITA Airways',
    'SQ': 'Singapore Airlines', 'CX': 'Cathay Pacific',
    'JL': 'Japan Airlines', 'NH': 'ANA', 'KE': 'Korean Air',
    'CA': 'Air China', 'CZ': 'China Southern', 'MU': 'China Eastern',
    'TG': 'Thai Airways', 'MH': 'Malaysia Airlines',
    'OZ': 'Asiana Airlines', 'CI': 'China Airlines', 'BR': 'EVA Air',
    'VN': 'Vietnam Airlines', 'PR': 'Philippine Airlines', 'GA': 'Garuda Indonesia',
    'JQ': 'Jetstar', 'TR': 'Scoot', 'MM': 'Peach Aviation',
    'AK': 'AirAsia', 'FD': 'Thai AirAsia', 'QZ': 'AirAsia Indonesia',
    'D7': 'AirAsia X', '5J': 'Cebu Pacific', '3K': 'Jetstar Asia',
    'FZ': 'flydubai', 'G9': 'Air Arabia', 'EY': 'Etihad Airways',
    'MS': 'EgyptAir', 'AT': 'Royal Air Maroc', 'SV': 'Saudia',
    'WY': 'Oman Air', 'GF': 'Gulf Air', 'RJ': 'Royal Jordanian',
    'AH': 'Air Algérie', 'KC': 'Air Astana',
    'AI': 'Air India', '6E': 'IndiGo', 'SG': 'SpiceJet',
    'PS': 'Ukraine International', 'RJ': 'Royal Jordanian',
};

function normalizeAirline(raw) {
    if (!raw) return '';
    const key = raw.toLowerCase().trim().replace(/\s+/g, ' ');
    return AIRLINE_NAME_MAP[key] || raw.trim();
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
        layoverCity: item.layoverCity || '',
        layoverDurations: item.layoverDurations || [],
        numeroVoos: item.numeroVoos || [],
        aeronaves: item.aeronaves || [],
        flight_key: `gf-${origin}-${destination}-${date}-${idx}`,
        provider: 'google',
        isRoundtripTotal: item.is_roundtrip_total || false,
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

async function doScrape(origin, destination, date, returnDate) {
    // Outbound: round-trip URL quando há returnDate → preços reais ida+volta do Google
    // Inbound: busca one-way separada para mostrar opções de volta
    const rawOut = await scrapeOneway(origin, destination, date, returnDate ?? null);
    const rawIn  = returnDate ? await scrapeOneway(destination, origin, returnDate) : [];
    const outbound = rawOut.filter(i => i.preco_brl > 0).map((i, idx) => mapToFlightOffer(i, origin, destination, date, idx));
    const inbound  = rawIn.map((i, idx) => mapToFlightOffer(i, destination, origin, returnDate, idx));
    return { outbound, inbound };
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

// GET /api/amadeus/flights — scraper do Google Flights (ida e volta em paralelo)
app.get('/api/amadeus/flights', async (req, res) => {
    const { originLocationCode: origin, destinationLocationCode: destination, departureDate: date, returnDate } = req.query;

    if (!origin || !destination || !date) {
        return res.status(400).json({ errors: [{ detail: 'origin, destination e departureDate são obrigatórios' }] });
    }

    const cacheKey = gfCacheKey(origin, destination, date, returnDate);

    // 1. Cache hit
    const cached = _gfCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[GFlights] Cache hit (${origin}→${destination} ${date}) — ${cached.data.length} voos`);
        return res.json({ data: cached.data, inbound: cached.inbound, meta: { count: cached.data.length, source: 'cache' } });
    }

    // 2. Deduplicação: se já há um scrape em andamento para esta chave, aguarda ele
    if (_gfInflight.has(cacheKey)) {
        console.log(`[GFlights] Dedup hit (${origin}→${destination} ${date}) — aguardando scrape em andamento`);
        try {
            const { outbound, inbound } = await _gfInflight.get(cacheKey);
            return res.json({ data: outbound, inbound, meta: { count: outbound.length, source: 'dedup' } });
        } catch (err) {
            return res.status(500).json({ errors: [{ detail: err.message }] });
        }
    }

    // 3. Novo scrape — registra promise no mapa de in-flight
    console.log(`[GFlights] Buscando ${origin}→${destination} em ${date}${returnDate ? ` | volta ${destination}→${origin} em ${returnDate}` : ''}`);

    const promise = doScrape(origin, destination, date, returnDate)
        .then(result => {
            const { outbound } = result;
            if (outbound.length > 0) {
                gfCacheSet(cacheKey, { data: outbound, inbound: result.inbound, expiresAt: Date.now() + GF_CACHE_TTL_MS });
            }
            console.log(`[GFlights] Ida: ${outbound.length} | Volta: ${result.inbound.length}`);
            return result;
        })
        .finally(() => _gfInflight.delete(cacheKey));

    _gfInflight.set(cacheKey, promise);

    try {
        const { outbound, inbound } = await promise;
        res.json({ data: outbound, inbound, meta: { count: outbound.length, source: 'google-flights-scraper' } });
    } catch (err) {
        console.error('[GFlights] Erro:', err.message);
        res.status(500).json({ errors: [{ detail: err.message }] });
    }
});

// ─── AbacatePay Checkout ───────────────────────────────────────────────────────
const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY || 'abc_dev_GwmHy0SnK5CAeB3YWPKckZrx';
const ABACATEPAY_BASE = 'https://api.abacatepay.com/v1';

const ABACATEPAY_PRODUCT_IDS = {
    essencial_mensal: 'prod_YDKXdraxPUfeRsnsZDgMMDCg',
    essencial_anual:  'prod_Qh0AG6G1K14s2amwwDGjrgZ6',
    pro_mensal:       'prod_hMpBPa4bJAs5tPe61kx6P5PP',
    pro_anual:        'prod_Q2L5JHSQspgQ2ESqQrer6qfk',
    elite_mensal:     'prod_xF0RRKduTfm5mbjBfuL3yDx6',
    elite_anual:      'prod_LaAabZfjm0KxAT3exn11EQTr',
};

app.post('/api/checkout', async (req, res) => {
    const { origin, destination, departureDate, returnDate, totalBrl, outboundCompany, returnCompany, customerName, customerEmail, customerTaxId, customerPhone, userId, billingType, returnPath } = req.body;

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
            taxId: customerTaxId || '52998224725',
            cellphone: customerPhone || '11999999999',
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

        const productKey = origin === 'PLANO'
            ? `${destination.toLowerCase()}_${billingType ?? 'mensal'}`
            : null;
        const registeredProductId = productKey ? ABACATEPAY_PRODUCT_IDS[productKey] : null;

        const productEntry = registeredProductId
            ? { externalId: registeredProductId, name: productName, quantity: 1, price: Math.round(totalBrl * 100) }
            : { externalId, name: productName, quantity: 1, price: Math.round(totalBrl * 100) };

        // paymentMethod: 'pix' | 'cartao' | 'ambos' — default: 'pix'
        const methodMap = {
            cartao: ['CARD'],
            ambos:  ['PIX', 'CARD'],
        };
        const methods = methodMap[req.body.paymentMethod] ?? ['PIX'];

        const billingPayload = {
            frequency: 'ONE_TIME',
            methods,
            customerId,
            products: [productEntry],
            returnUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            completionUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            metadata: { origin, destination, departureDate, returnDate, outboundCompany, returnCompany, userId, billingType },
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

        console.log('[AbacatePay] Billing criado:', JSON.stringify(abData).slice(0, 400));

        // Extrair PIX code de possíveis locais na resposta
        const d = abData.data ?? {};
        const responseMethods = d.methods ?? [];
        const pixMethod = responseMethods.find(m => m.method === 'PIX') ?? responseMethods[0] ?? {};
        const pixCode = pixMethod.pixCode ?? pixMethod.brCode ?? d.brCode ?? d.pixCode ?? d.pixCopyPaste ?? null;
        const pixQrCode = pixMethod.pixQrCode ?? pixMethod.qrCodeImage ?? d.qrCodeImage ?? null;

        res.json({
            id: d.id,
            url: d.url,
            pixCode,
            pixQrCode,
            status: d.status ?? 'PENDING',
        });
    } catch (err) {
        console.error('[AbacatePay] Exceção:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/checkout/status/:id — verifica status da cobrança
// AbacatePay v1 não tem GET /billing/:id — usa /billing/list e filtra pelo id
app.get('/api/checkout/status/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const abRes = await fetch(`${ABACATEPAY_BASE}/billing/list`, {
            headers: { 'Authorization': `Bearer ${ABACATEPAY_API_KEY}` },
            signal: AbortSignal.timeout(10000),
        });
        const abData = await abRes.json();
        const billings = Array.isArray(abData.data) ? abData.data : [];
        const billing = billings.find(b => b.id === id) ?? {};
        res.json({ status: billing.status ?? 'PENDING', id: billing.id ?? id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/webhook/abacatepay — recebe notificações de pagamento da AbacatePay
// Configurar no painel AbacatePay: https://app.abacatepay.com → Webhooks → URL: <seu-domínio>/api/webhook/abacatepay
app.post('/api/webhook/abacatepay', async (req, res) => {
    const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
        const received = req.headers['x-webhook-secret'] ?? req.headers['x-abacatepay-secret'] ?? req.headers['authorization']?.replace('Bearer ', '');
        if (received !== webhookSecret) {
            console.warn('[Webhook AbacatePay] Secret inválido — requisição rejeitada');
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const body = req.body ?? {};

    // AbacatePay envia formatos diferentes para PIX e cartão:
    // PIX:    { status, metadata, ... }
    // Cartão: { event: 'checkout.completed', data: { checkout: { status, metadata } } }
    const billing = body.billing ?? body.data?.checkout ?? body.data ?? body;
    const status = billing?.status;
    const metadata = billing?.metadata ?? {};

    console.log('[Webhook AbacatePay] evento recebido:', JSON.stringify({ status, metadata }).slice(0, 300));

    // Só processa pagamentos confirmados
    if (status !== 'PAID' && status !== 'COMPLETED') {
        return res.json({ ok: true, skipped: true });
    }

    const { userId, billingType, origin, destination } = metadata;

    // Só processa cobranças de plano (não passagens)
    if (origin !== 'PLANO' || !userId) {
        return res.json({ ok: true, skipped: true });
    }

    const plan = ['essencial', 'pro', 'elite'].find(p => (destination ?? '').toLowerCase().includes(p));
    if (!plan) {
        console.error('[Webhook AbacatePay] Plano não identificado em destination:', destination);
        return res.status(400).json({ error: 'Plano não identificado' });
    }

    if (!supabase) {
        console.error('[Webhook AbacatePay] Supabase não configurado');
        return res.status(500).json({ error: 'Supabase não configurado' });
    }

    const daysToAdd = billingType === 'anual' ? 365 : 30;
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('user_profiles').upsert({
        id: userId,
        plan,
        plan_expires_at: expiresAt,
        plan_billing: billingType ?? 'mensal',
    });

    if (error) {
        console.error('[Webhook AbacatePay] Erro ao ativar plano:', error);
        return res.status(500).json({ error: error.message });
    }

    console.log(`[Webhook AbacatePay] Plano ${plan} ativado para usuário ${userId}`);
    res.json({ ok: true });
});

// POST /api/checkout/activate — verifica pagamento server-side e ativa o plano
// O frontend chama este endpoint após detectar PAID via polling, evitando
// que o cliente escreva diretamente nos campos de plano do Supabase.
app.post('/api/checkout/activate', async (req, res) => {
    const { billingId, userId } = req.body;
    if (!billingId || !userId) {
        return res.status(400).json({ error: 'billingId e userId são obrigatórios' });
    }

    try {
        // 1. Confirmar status diretamente com AbacatePay (v1 só tem /billing/list)
        const abRes = await fetch(`${ABACATEPAY_BASE}/billing/list`, {
            headers: { 'Authorization': `Bearer ${ABACATEPAY_API_KEY}` },
            signal: AbortSignal.timeout(10000),
        });
        const abData = await abRes.json();
        const billings = Array.isArray(abData.data) ? abData.data : [];
        const d = billings.find(b => b.id === billingId) ?? {};

        if (d.status !== 'PAID' && d.status !== 'COMPLETED') {
            return res.status(402).json({ error: 'Pagamento ainda não confirmado', status: d.status ?? 'NOT_FOUND' });
        }

        // 2. Extrair plano dos metadados gravados na criação da cobrança
        const metadata = d.metadata ?? {};
        const { billingType, origin, destination } = metadata;

        if (origin !== 'PLANO' || !destination) {
            return res.status(400).json({ error: 'Cobrança não é de plano' });
        }

        const plan = ['essencial', 'pro', 'elite'].find(p => destination.toLowerCase().includes(p));
        if (!plan) {
            return res.status(400).json({ error: 'Plano não identificado: ' + destination });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase não configurado no servidor' });
        }

        // 3. Ativar plano via service_role (ignora RLS)
        const daysToAdd = billingType === 'anual' ? 365 : 30;
        const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

        const { error } = await supabase.from('user_profiles').upsert({
            id: userId,
            plan,
            plan_expires_at: expiresAt,
            plan_billing: billingType ?? 'mensal',
        });

        if (error) {
            console.error('[Activate] Erro ao ativar plano:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`[Activate] Plano ${plan} ativado para ${userId}`);
        res.json({ ok: true, plan, plan_expires_at: expiresAt });
    } catch (err) {
        console.error('[Activate] Exceção:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Seats.aero Award Price Sync ─────────────────────────────────────────────
// Roda toda segunda-feira às 04:00 BRT.
// Consulta os dias 1, 15 e 30 dos próximos 2 meses para cada rota de referência.
// Salva os preços médios em milhas na tabela `award_prices_cache` do Supabase.

const REFERENCE_ROUTES = [
    { origin: 'GRU', destination: 'SDU', category: 'dom_short' },
    { origin: 'GRU', destination: 'CGH', category: 'dom_short' },
    { origin: 'GRU', destination: 'SSA', category: 'dom_medium' },
    { origin: 'GRU', destination: 'BSB', category: 'dom_medium' },
    { origin: 'GRU', destination: 'BEL', category: 'dom_long' },
    { origin: 'GRU', destination: 'REC', category: 'dom_long' },
    { origin: 'GRU', destination: 'BOG', category: 'latam_short' },
    { origin: 'GRU', destination: 'SCL', category: 'latam_short' },
    { origin: 'GRU', destination: 'MEX', category: 'latam_medium' },
    { origin: 'GRU', destination: 'CDG', category: 'transatlantic' },
    { origin: 'GRU', destination: 'JFK', category: 'transatlantic' },
    { origin: 'GRU', destination: 'NRT', category: 'longhaul' },
];

function getSampleDates() {
    const dates = [];
    const now = new Date();
    for (let m = 0; m < 2; m++) {
        const base = new Date(now.getFullYear(), now.getMonth() + m + 1, 1);
        for (const day of [1, 15, 28]) {
            const d = new Date(base.getFullYear(), base.getMonth(), day);
            dates.push(d.toISOString().slice(0, 10));
        }
    }
    return dates;
}

async function syncAwardPrices() {
    if (!SEATS_AERO_API_KEY || !supabase) {
        console.log('[AwardSync] Skipped — SEATS_AERO_API_KEY ou Supabase não configurado');
        return;
    }
    console.log('[AwardSync] Iniciando sincronização semanal de preços de milhas...');
    const dates = getSampleDates();
    const results = {};  // { category: { economy: [], business: [] } }

    for (const route of REFERENCE_ROUTES) {
        for (const date of dates) {
            try {
                const data = await fetchSeatsAeroAPI(route.origin, route.destination, date);
                const trips = data.data ?? [];
                for (const trip of trips) {
                    if (!results[route.category]) results[route.category] = { economy: [], business: [] };
                    if (trip.YAvailable && trip.YMileageCost > 0) results[route.category].economy.push(trip.YMileageCost);
                    if (trip.JAvailable && trip.JMileageCost > 0) results[route.category].business.push(trip.JMileageCost);
                }
                await new Promise(r => setTimeout(r, 300)); // rate limit entre datas
            } catch (e) {
                console.warn(`[AwardSync] Erro ${route.origin}-${route.destination} ${date}: ${e.message}`);
            }
        }
        await new Promise(r => setTimeout(r, 600)); // pausa extra entre rotas
    }

    // Calcular médias e salvar no Supabase
    const rows = Object.entries(results).map(([category, { economy, business }]) => ({
        category,
        economy_avg: economy.length ? Math.round(economy.reduce((a, b) => a + b, 0) / economy.length) : null,
        business_avg: business.length ? Math.round(business.reduce((a, b) => a + b, 0) / business.length) : null,
        sample_count: economy.length + business.length,
        updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
        const { error } = await supabase.from('award_prices_cache').upsert(rows, { onConflict: 'category' });
        if (error) console.error('[AwardSync] Erro ao salvar:', error.message);
        else console.log(`[AwardSync] ${rows.length} categorias salvas com sucesso.`);
    } else {
        console.log('[AwardSync] Nenhum dado retornado pelo Seats.aero.');
    }
}

// GET /api/award-prices — retorna preços médios cacheados do Supabase
app.get('/api/award-prices', async (req, res) => {
    if (!supabase) return res.json({ data: [], lastUpdated: null });
    try {
        const { data, error } = await supabase
            .from('award_prices_cache')
            .select('category, economy_avg, business_avg, sample_count, updated_at')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        const lastUpdated = data?.[0]?.updated_at ?? null;
        res.json({ data: data ?? [], lastUpdated });
    } catch (err) {
        res.status(500).json({ error: err.message, data: [], lastUpdated: null });
    }
});

// POST /api/award-prices/sync — dispara sync manual (protegido por header)
app.post('/api/award-prices/sync', requireSyncSecret, async (req, res) => {
    syncAwardPrices().catch(console.error);
    res.json({ message: 'Sincronização iniciada em background' });
});

// ─── Promoções de Transferência ───────────────────────────────────────────────
// Cache em memória com TTL de 12h. A tabela `transfer_promotions` no Supabase
// é a fonte de verdade — atualizada manualmente ou via POST /api/transfer-promotions/update.
// Se a tabela estiver vazia no startup, os dados default são inseridos automaticamente.

let promotionsCache = null;
let promotionsCacheAt = 0;
const PROMOTIONS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12h

// Dados default para seed automático (espelha transferData.ts — atualizar em conjunto)
const DEFAULT_PROMOTIONS_SEED = [
    { card_id: 'iupp_itau', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Itaú → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir — sem cadastro, sem bônus', 'Sem clube: 30%', 'Plano 1.000 mi: 70%', 'Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF', 'Milhas bônus creditadas em até 15 dias'], active: true },
    { card_id: 'nubank_ultravioleta', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Nubank → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir', 'Sem cadastro prévio = sem bônus', 'Mínimo de 2.500 Pontos Nubank por transferência', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'c6_atomos', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — C6 Bank → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'santander_esfera', program: 'Smiles', bonus_percent: 20, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Bônus de 20% permanente + campanhas periódicas para clube', description: '20% permanente para todos (Esfera) + por plano Clube Smiles em campanhas', is_periodic: false, last_confirmed: 'Mar/2026', registration_url: 'https://esfera.com.vc', rules: ['Bônus de 20% é permanente para todos os clientes Santander via Esfera', 'Clube Smiles ativo: bônus extra durante campanhas periódicas', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80% (em campanhas)', 'Para campanhas extras: cadastre-se antes', 'Mínimo: 1.000 pontos Esfera', 'Prazo de crédito: até 5 dias úteis'], active: true },
    { card_id: 'xp_visa', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — XP → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se antes de transferir', 'Mínimo de 1.000 pts XP', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'btg_pactual', program: 'LATAM Pass', bonus_percent: 25, club_bonus_percent: 25, club_tier_bonuses: {}, club_required: null, valid_until: 'Campanha periódica (confirme em latampass.latam.com)', description: '25% de bônus + 1.000 milhas extras na primeira transferência BTG → LATAM Pass', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://latampass.latam.com/pt_br/junte-milhas', rules: ['⚠️ Registre-se na página da promoção antes de transferir', 'Bônus de 25% para todos os clientes BTG', '1.000 milhas extras na primeira transferência do período', 'Milhas bônus creditadas em até 30 dias', 'Validade das milhas bônus: 36 meses'], active: true },
    { card_id: 'inter_black', program: 'TudoAzul', bonus_percent: 80, club_bonus_percent: 130, club_tier_bonuses: { 'Plano 1.000 pts': 103, 'Plano 2.000 pts': 103, 'Plano 5.000 pts': 103, 'Plano 10.000 pts': 103, 'Plano 20.000 pts': 130 }, club_required: 'azul_fidelidade_clube', valid_until: 'Campanha periódica (confirme em tudoazul.voeazul.com.br)', description: '80% para todos; Clube Azul: 103%; 5+ anos assinatura: 130% — Inter → TudoAzul', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.voeazul.com.br/inter-pontos', rules: ['⚠️ Cadastre-se antes de transferir', 'Todos os clientes Inter: 80% de bônus', 'Assinantes do Clube Azul (qualquer plano): 103%', 'Assinantes há 5+ anos (Plano 20.000 pts): 130%', 'Limite: 300.000 pontos bônus por CPF', 'Creditação em até 15 dias úteis', 'Validade dos pontos bônus: 6 meses'], active: true },
    { card_id: 'inter_black', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Inter → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir — sem cadastro, sem bônus', 'Sem clube: 30%', 'Plano 1.000 mi: 70%', 'Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'bradesco_livelo', program: 'Livelo', bonus_percent: 0, club_bonus_percent: 0, club_tier_bonuses: {}, club_required: null, valid_until: 'Transferência padrão (sem campanha ativa no momento)', description: 'Bradesco/BB → Livelo: transferência 1:1, sem bônus atualmente.', is_periodic: false, last_confirmed: 'Mar/2026', registration_url: null, rules: ['Transferência Bradesco/BB → Livelo: taxa 1:1', 'Livelo → Smiles/LATAM/TudoAzul: também 1:1', 'Mínimo de 2.500 pts Bradesco/BB → Livelo', 'Mínimo de 15.000 pts Livelo → aérea', 'Transferência imediata: membros do Clube Livelo', 'Sem bônus de campanha ativo agora — aguarde promoções'], active: true },
    { card_id: 'caixa_uau', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — Caixa → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'btg_pactual', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — BTG → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se antes de transferir', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
];

async function seedPromotionsIfEmpty() {
    if (!supabase) return;
    try {
        const { count } = await supabase
            .from('transfer_promotions')
            .select('id', { count: 'exact', head: true })
            .eq('active', true);
        if (count > 0) {
            console.log(`[Promotions] Supabase já tem ${count} promoções — seed ignorado`);
            return;
        }
        console.log('[Promotions] Supabase vazio — inserindo dados default...');
        const { error } = await supabase
            .from('transfer_promotions')
            .upsert(DEFAULT_PROMOTIONS_SEED, { onConflict: 'card_id,program' });
        if (error) throw error;
        console.log(`[Promotions] Seed concluído: ${DEFAULT_PROMOTIONS_SEED.length} promoções inseridas`);
    } catch (err) {
        console.error('[Promotions] Erro no seed automático:', err.message);
    }
}

async function refreshPromotionsCache() {
    if (!supabase) return;
    try {
        const { data, error } = await supabase
            .from('transfer_promotions')
            .select('*')
            .eq('active', true);
        if (error) throw error;
        if (data && data.length > 0) {
            promotionsCache = data.map(row => ({
                id: row.id,
                cardId: row.card_id,
                program: row.program,
                bonusPercent: row.bonus_percent ?? 0,
                clubBonusPercent: row.club_bonus_percent ?? 0,
                clubTierBonuses: row.club_tier_bonuses ?? {},
                clubRequired: row.club_required ?? null,
                validUntil: row.valid_until ?? '',
                description: row.description ?? '',
                isPeriodic: row.is_periodic ?? true,
                lastConfirmed: row.last_confirmed ?? '',
                rules: row.rules ?? [],
                registrationUrl: row.registration_url ?? undefined,
            }));
            promotionsCacheAt = Date.now();
            console.log(`[Promotions] Cache atualizado: ${promotionsCache.length} promoções`);
        } else {
            // Tabela vazia — tenta seed e re-fetch
            await seedPromotionsIfEmpty();
            const { data: seeded } = await supabase
                .from('transfer_promotions')
                .select('*')
                .eq('active', true);
            if (seeded && seeded.length > 0) {
                promotionsCache = seeded.map(row => ({
                    id: row.id,
                    cardId: row.card_id,
                    program: row.program,
                    bonusPercent: row.bonus_percent ?? 0,
                    clubBonusPercent: row.club_bonus_percent ?? 0,
                    clubTierBonuses: row.club_tier_bonuses ?? {},
                    clubRequired: row.club_required ?? null,
                    validUntil: row.valid_until ?? '',
                    description: row.description ?? '',
                    isPeriodic: row.is_periodic ?? true,
                    lastConfirmed: row.last_confirmed ?? '',
                    rules: row.rules ?? [],
                    registrationUrl: row.registration_url ?? undefined,
                }));
                promotionsCacheAt = Date.now();
                console.log(`[Promotions] Cache após seed: ${promotionsCache.length} promoções`);
            }
        }
    } catch (err) {
        console.error('[Promotions] Erro ao atualizar cache:', err.message);
    }
}

// GET /api/transfer-promotions — retorna promoções de transferência (com cache 12h)
app.get('/api/transfer-promotions', async (req, res) => {
    const stale = Date.now() - promotionsCacheAt > PROMOTIONS_CACHE_TTL;
    if (!promotionsCache || stale) {
        await refreshPromotionsCache();
    }
    res.json({
        promotions: promotionsCache ?? [],
        cachedAt: promotionsCacheAt ? new Date(promotionsCacheAt).toISOString() : null,
    });
});

// POST /api/transfer-promotions/update — força re-fetch do Supabase (protegido por header)
app.post('/api/transfer-promotions/update', requireSyncSecret, async (req, res) => {
    await refreshPromotionsCache();
    res.json({ message: 'Cache de promoções atualizado', count: promotionsCache?.length ?? 0 });
});

// POST /api/admin/sync-promotions — força seed + re-fetch (protegido por x-sync-secret)
app.post('/api/admin/sync-promotions', requireSyncSecret, async (req, res) => {
    const force = req.query.force === 'true' || req.body?.force === true;
    if (force && supabase) {
        // Limpa tabela e re-seed com dados atuais
        await supabase.from('transfer_promotions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('transfer_promotions').insert(DEFAULT_PROMOTIONS_SEED);
        console.log('[Admin] Re-seed forçado concluído');
    } else {
        await seedPromotionsIfEmpty();
    }
    await refreshPromotionsCache();
    res.json({ message: force ? 'Re-seed forçado + cache atualizado' : 'Seed (se vazio) + cache atualizado', count: promotionsCache?.length ?? 0 });
});

// ─── Sync automático do Simulador de Transferência ───────────────────────────
// Scrapa páginas oficiais de TODOS os programas e bancos, envia para Claude API,
// compara com dados atuais no Supabase e atualiza se necessário.
// Disparado pelo GitHub Actions cron diário (8h BRT) via POST /api/admin/sync-transfer-data

// Tenta extrair data explícita de um campo valid_until (texto ou ISO).
// Retorna Date ou null.
function parsePromoDate(validUntil) {
    if (!validUntil) return null;
    const s = validUntil.toLowerCase();

    // "até hoje" / "acaba hoje"
    if (/\b(hoje|today|acaba hoje|até hoje)\b/.test(s)) {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d;
    }

    // ISO: 2026-03-23
    const iso = validUntil.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T23:59:59`);

    // Brasileiro: 23/03/2026
    const br = validUntil.match(/(\d{1,2})\/(\d{2})\/(\d{4})/);
    if (br) return new Date(`${br[3]}-${br[2]}-${br[1].padStart(2, '0')}T23:59:59`);

    // "23 de março de 2026"
    const MONTHS = { janeiro:'01', fevereiro:'02', 'março':'03', marco:'03', abril:'04',
        maio:'05', junho:'06', julho:'07', agosto:'08', setembro:'09',
        outubro:'10', novembro:'11', dezembro:'12' };
    const ext = s.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/);
    if (ext && MONTHS[ext[2]]) {
        return new Date(`${ext[3]}-${MONTHS[ext[2]]}-${ext[1].padStart(2,'0')}T23:59:59`);
    }
    return null;
}

// Verifica promoções com data explícita vencida e zera bonus_percent no Supabase.
async function checkAndExpirePromotions(promotions) {
    if (!promotions?.length) return 0;
    const now = new Date();
    let expired = 0;

    for (const p of promotions) {
        const expiry = parsePromoDate(p.valid_until);
        if (!expiry || now <= expiry) continue;
        if (p.bonus_percent === 0 && p.club_bonus_percent === 0) continue; // já zerado

        console.log(`[TransferSync] Promoção expirada detectada: ${p.card_id}/${p.program} (até ${p.valid_until})`);
        const { error } = await supabase
            .from('transfer_promotions')
            .update({
                bonus_percent: 0,
                club_bonus_percent: 0,
                club_tier_bonuses: {},
                valid_until: `Expirado em ${p.valid_until}`,
                updated_at: now.toISOString(),
            })
            .eq('card_id', p.card_id)
            .eq('program', p.program);

        if (error) console.error(`[TransferSync] Erro ao expirar ${p.card_id}/${p.program}:`, error.message);
        else expired++;
    }
    return expired;
}

const TRANSFER_SOURCES = [
    // Programas aéreos — páginas de transferência de pontos
    { id: 'smiles_transfer', url: 'https://www.smiles.com.br/acumule-milhas/transferencia-de-pontos', label: 'Smiles — Transferência de Pontos' },
    { id: 'smiles_clube', url: 'https://www.smiles.com.br/clube-smiles', label: 'Clube Smiles — Planos e preços' },
    { id: 'tudoazul_transfer', url: 'https://tudoazul.voeazul.com.br/acumule/transferencia-de-pontos', label: 'TudoAzul — Transferência de Pontos' },
    { id: 'clube_azul', url: 'https://www.voeazul.com.br/clube-azul-fidelidade', label: 'Clube Azul Fidelidade — Planos' },
    { id: 'latam_transfer', url: 'https://latampass.latam.com/pt_br/junte-milhas/transfira-pontos', label: 'LATAM Pass — Transferência de Pontos' },
    { id: 'livelo_transfer', url: 'https://www.livelo.com.br/transferencia-de-pontos', label: 'Livelo — Transferência de Pontos' },
    // Bancos/cartões — páginas de parcerias
    { id: 'inter_loop', url: 'https://inter.co/inter-loop', label: 'Inter Loop — Transferências e bônus' },
    { id: 'nubank_rewards', url: 'https://nubank.com.br/rewards', label: 'Nubank Rewards — Parceiros' },
    // RSS blogs de referência (atualizados em horas após novas campanhas)
    { id: 'rss_pprimeira', url: 'https://www.passageirodeprimeira.com.br/feed', label: 'RSS Passageiro de Primeira' },
    { id: 'rss_melhores', url: 'https://www.melhores-destinos.com.br/feed', label: 'RSS Melhores Destinos' },
];

async function scrapeTransferSource(source) {
    try {
        // RSS e páginas simples: fetch direto (sem JS)
        if (source.id.startsWith('rss_') || source.url.includes('feed')) {
            const res = await fetch(source.url, {
                headers: { 'User-Agent': 'FlyWise-Bot/1.0' },
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) return null;
            const text = await res.text();

            // Desencapsula CDATA, decodifica entidades e remove tags XML
            const stripped = text
                .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ');

            // Filtra sentenças com palavras-chave relevantes
            const keywords = ['bônus', 'bonus', 'transferência', 'transfer', 'smiles', 'tudoazul', 'latam', 'livelo', 'inter', 'clube', 'promo'];
            const sentences = stripped.split(/(?<=[.!?])\s+/);
            const relevant = sentences.filter(s => keywords.some(k => s.toLowerCase().includes(k)));
            return { id: source.id, label: source.label, content: relevant.slice(0, 60).join(' ') };
        }

        // Páginas com JS (programas/bancos): reutiliza browser compartilhado via contexto isolado
        await ensureChromium();
        const browser = await getBrowser();
        const context = await browser.newContext({
            locale: 'pt-BR',
            extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
        });
        const page = await context.newPage();
        try {
            await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, randInt(2500, 3500)));

            // Tenta aceitar cookies se aparecer
            try {
                await page.click('button:has-text("Aceitar"), button:has-text("Accept"), button:has-text("Concordo")', { timeout: 3000 });
                await new Promise(r => setTimeout(r, 800));
            } catch (_) {}

            // Extrai texto relevante (sem scripts/estilos)
            const content = await page.evaluate(() => {
                const remove = document.querySelectorAll('script, style, nav, footer, header');
                remove.forEach(el => el.remove());
                return document.body?.innerText?.slice(0, 3000) ?? '';
            });
            return { id: source.id, label: source.label, content };
        } finally {
            await context.close().catch(() => {});
        }
    } catch (err) {
        console.warn(`[TransferSync] Falha ao scraper ${source.id}:`, err.message);
        return null;
    }
}

async function analyzeTransferDataWithClaude(scrapedContents, currentPromotions) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada');

    // Limita JSON atual a campos essenciais para reduzir tokens
    const currentCompact = (currentPromotions ?? []).map(r => ({
        card_id: r.card_id, program: r.program,
        bonus_percent: r.bonus_percent, club_bonus_percent: r.club_bonus_percent,
        club_tier_bonuses: r.club_tier_bonuses, valid_until: r.valid_until,
        is_periodic: r.is_periodic, rules: r.rules,
    }));
    const currentJson = JSON.stringify(currentCompact, null, 1);

    // Limita cada fonte a 2000 chars e o total a 20.000 chars
    const scrapedText = scrapedContents
        .filter(Boolean)
        .map(s => `\n### ${s.label}\n${s.content.slice(0, 2000)}`)
        .join('\n')
        .slice(0, 20000);

    const prompt = `Você é especialista em programas de milhas e fidelidade do Brasil. Analise os dados extraídos das páginas oficiais e blogs abaixo e compare com os dados atuais do banco de dados do FlyWise.

## DADOS ATUAIS NO BANCO (JSON):
${currentJson}

## DADOS EXTRAÍDOS DAS PÁGINAS OFICIAIS:
${scrapedText}

## TAREFA:
Analise cuidadosamente e retorne um JSON com as promoções de transferência atualizadas. Mantenha EXATAMENTE a mesma estrutura dos dados atuais. Para cada promoção, verifique:
1. bonusPercent — bônus para quem não tem clube (%)
2. clubBonusPercent — bônus genérico para assinantes de clube (%)
3. clubTierBonuses — bônus específico por plano do clube (objeto com nomes dos planos como chave)
4. validUntil — validade da promoção. REGRA CRÍTICA:
   - Se encontrar uma data EXPLÍCITA de encerramento (ex: "até 23/03/2026", "válido até 15 de abril de 2026", "encerra em 2026-04-15"), coloque a data no início em formato ISO: "2026-04-15 — Campanha encerrada (confirme em ...)"
   - Se o texto disser "até hoje" ou "encerra hoje", escreva exatamente: "hoje — encerra às 23:59"
   - Se for campanha periódica sem data fixa, mantenha o texto atual
5. rules — array de strings com regras importantes (inclua datas de encerramento quando explícitas)
6. description — descrição resumida
7. isPeriodic — true se é campanha periódica, false se é permanente
8. lastConfirmed — "Mar/2026" (mês atual)

REGRAS IMPORTANTES:
- Se uma informação não foi encontrada nas páginas, mantenha o valor atual do banco
- Se um bônus claramente terminou (data vencida ou site não mostra mais a promoção), ajuste bonusPercent para 0
- Santander Esfera: 20% para Smiles é PERMANENTE (não requer campanha)
- Inter → TudoAzul: 80% base, 103% Clube Azul, 130% para 5+ anos — só altere se encontrar dado contrário EXPLÍCITO
- Clube Smiles tiers: só atualize se encontrar valores EXPLÍCITOS nas páginas oficiais
- NÃO invente dados. Se não encontrou, mantenha o existente.
- NÃO altere card_id, program, club_required
- DATAS: sempre que o site mencionar data de encerramento, extraia no formato YYYY-MM-DD e coloque no início do campo validUntil

Retorne SOMENTE um JSON válido no formato:
{
  "changes_detected": boolean,
  "summary": "resumo em português do que foi verificado e o que mudou",
  "promotions": [ ... array completo com TODAS as promoções, atualizadas ou não ... ]
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            system: 'Responda SOMENTE com JSON válido. Sem markdown, sem blocos de código, sem texto antes ou depois do JSON.',
            messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Anthropic API error: ${res.status} — ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';

    // Extrai JSON da resposta (pode ter texto antes/depois)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude não retornou JSON válido');
    return JSON.parse(jsonMatch[0]);
}

async function syncTransferData() {
    if (!supabase) throw new Error('Supabase não configurado');
    console.log('[TransferSync] Iniciando sync de dados de transferência...');

    const startedAt = new Date().toISOString();
    let validScraped = [];
    let updatedCount = 0;
    let errorMsg = null;

    try {
        // Diagnóstico de env vars
        console.log('[TransferSync] ANTHROPIC_API_KEY configurada:', !!process.env.ANTHROPIC_API_KEY);
        console.log('[TransferSync] SUPABASE_SERVICE_ROLE_KEY configurada:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Busca dados atuais do Supabase
        const { data: current, error: fetchErr } = await supabase
            .from('transfer_promotions')
            .select('*')
            .eq('active', true);
        if (fetchErr) throw new Error(`Supabase fetch: ${fetchErr.message}`);
        console.log(`[TransferSync] ${current?.length ?? 0} promoções no Supabase`);

        // 1b. Expira promoções com data explícita vencida
        const expiredCount = await checkAndExpirePromotions(current ?? []);
        if (expiredCount > 0) console.log(`[TransferSync] ${expiredCount} promoção(ões) expirada(s) e zerada(s)`);

        // 2. Scrape todas as fontes em paralelo (max 3 simultâneos)
        const limiter = pLimit(3);
        const scraped = await Promise.all(
            TRANSFER_SOURCES.map(source => limiter(() => scrapeTransferSource(source)))
        );
        validScraped = scraped.filter(Boolean);
        console.log(`[TransferSync] Scraped ${validScraped.length}/${TRANSFER_SOURCES.length} fontes`);

        // 3. Analisa com Claude
        const analysis = await analyzeTransferDataWithClaude(validScraped, current);
        console.log(`[TransferSync] Claude: changes_detected=${analysis.changes_detected}`);
        console.log(`[TransferSync] Resumo: ${analysis.summary}`);

        // 4. Se há mudanças, atualiza Supabase; insere novas promoções detectadas
        if (analysis.changes_detected && Array.isArray(analysis.promotions)) {
            for (const promo of analysis.promotions) {
                const cardId = promo.card_id ?? promo.cardId;
                const existing = current?.find(r => r.card_id === cardId && r.program === promo.program);

                if (!existing) {
                    // Nova promoção detectada pelo Claude — insere no banco
                    if (!cardId || !promo.program) continue; // skip malformed
                    const newRow = {
                        card_id: cardId,
                        program: promo.program,
                        bonus_percent: promo.bonus_percent ?? promo.bonusPercent ?? 0,
                        club_bonus_percent: promo.club_bonus_percent ?? promo.clubBonusPercent ?? 0,
                        club_tier_bonuses: promo.club_tier_bonuses ?? promo.clubTierBonuses ?? {},
                        valid_until: promo.valid_until ?? promo.validUntil ?? '',
                        description: promo.description ?? '',
                        is_periodic: promo.is_periodic ?? promo.isPeriodic ?? true,
                        last_confirmed: promo.last_confirmed ?? promo.lastConfirmed ?? new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
                        rules: promo.rules ?? [],
                        club_required: promo.club_required ?? promo.clubRequired ?? null,
                        active: true,
                    };
                    const { error: insertErr } = await supabase.from('transfer_promotions').insert(newRow);
                    if (insertErr) {
                        console.error(`[TransferSync] Erro ao inserir ${cardId}→${promo.program}:`, insertErr.message);
                    } else {
                        updatedCount++;
                        console.log(`[TransferSync] Nova promoção inserida: ${cardId}→${promo.program}`);
                    }
                    continue;
                }

                const updates = {
                    bonus_percent: promo.bonus_percent ?? promo.bonusPercent ?? existing.bonus_percent,
                    club_bonus_percent: promo.club_bonus_percent ?? promo.clubBonusPercent ?? existing.club_bonus_percent,
                    club_tier_bonuses: promo.club_tier_bonuses ?? promo.clubTierBonuses ?? existing.club_tier_bonuses,
                    valid_until: promo.valid_until ?? promo.validUntil ?? existing.valid_until,
                    description: promo.description ?? existing.description,
                    is_periodic: promo.is_periodic ?? promo.isPeriodic ?? existing.is_periodic,
                    last_confirmed: promo.last_confirmed ?? promo.lastConfirmed ?? existing.last_confirmed,
                    rules: promo.rules ?? existing.rules,
                    updated_at: new Date().toISOString(),
                };
                const { error: updateErr } = await supabase
                    .from('transfer_promotions').update(updates).eq('id', existing.id);
                if (updateErr) {
                    console.error(`[TransferSync] Erro ao atualizar ${cardId}→${promo.program}:`, updateErr.message);
                } else {
                    updatedCount++;
                }
            }
        }

        // 5. Invalida cache se houve mudanças
        if (analysis.changes_detected) {
            promotionsCacheAt = 0;
            await refreshPromotionsCache();
        }

        console.log(`[TransferSync] Concluído. Atualizadas: ${updatedCount} promoções`);

        // 6. Salva log de sucesso
        const { error: logErr } = await supabase.from('transfer_sync_log').insert({
            synced_at: startedAt,
            sources_scraped: validScraped.length,
            changes_detected: analysis.changes_detected ?? false,
            rows_updated: updatedCount,
            summary: analysis.summary ?? '',
        });
        if (logErr) console.error('[TransferSync] Erro ao salvar log:', logErr.message);

        return { sourcesScraped: validScraped.length, changesDetected: analysis.changes_detected, rowsUpdated: updatedCount, summary: analysis.summary };

    } catch (err) {
        errorMsg = err.message;
        console.error('[TransferSync] ERRO:', errorMsg);

        // Salva log de erro para diagnóstico
        const { error: errLogErr } = await supabase.from('transfer_sync_log').insert({
            synced_at: startedAt,
            sources_scraped: validScraped.length,
            changes_detected: false,
            rows_updated: 0,
            summary: `ERRO: ${errorMsg}`,
        });
        if (errLogErr) console.error('[TransferSync] Falha ao salvar log de erro:', errLogErr.message);

        throw err;
    }
}

// POST /api/admin/sync-transfer-data — dispara sync completo (chamado pelo GitHub Actions)
app.post('/api/admin/sync-transfer-data', requireSyncSecret, async (req, res) => {
    // Roda em background para não segurar a resposta HTTP
    res.json({ message: 'Sync iniciado em background' });
    syncTransferData().catch(err => console.error('[TransferSync] Erro:', err.message));
});

// POST /api/admin/sync-transfer-data-sync — versão síncrona para debug (aguarda resultado)
app.post('/api/admin/sync-transfer-data-sync', requireSyncSecret, async (req, res) => {
    try {
        const result = await syncTransferData();
        res.json({ ok: true, result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message, stack: err.stack?.split('\n').slice(0,5) });
    }
});

// GET /api/admin/test-anthropic — testa a API da Anthropic com prompt mínimo
app.get('/api/admin/test-anthropic', async (_req, res) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });
    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 64, messages: [{ role: 'user', content: 'Diga apenas: OK' }] }),
            signal: AbortSignal.timeout(30000),
        });
        const body = await r.json();
        res.json({ status: r.status, body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/transfer-sync-diag — diagnóstico sem rodar o sync completo
app.get('/api/admin/transfer-sync-diag', async (_req, res) => {
    const diag = {
        anthropic_key_set: !!process.env.ANTHROPIC_API_KEY,
        supabase_service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabase_anon_set: !!process.env.VITE_SUPABASE_ANON_KEY,
        supabase_client: !!supabase,
        chromium_ready: _chromiumReady,
        write_test: null,
        read_test: null,
    };

    if (supabase) {
        // Testa leitura
        const { data: rd, error: re } = await supabase.from('transfer_promotions').select('id').limit(1);
        diag.read_test = re ? `ERRO: ${re.message}` : `OK (${rd?.length ?? 0} rows)`;

        // Testa escrita no log
        const { error: we } = await supabase.from('transfer_sync_log').insert({
            synced_at: new Date().toISOString(),
            sources_scraped: 0,
            changes_detected: false,
            rows_updated: 0,
            summary: 'DIAGNÓSTICO — teste de escrita',
        });
        diag.write_test = we ? `ERRO: ${we.message}` : 'OK';
    }

    res.json(diag);
});

// GET /api/admin/transfer-sync-log — últimas execuções do sync
app.get('/api/admin/transfer-sync-log', requireSyncSecret, async (req, res) => {
    if (!supabase) return res.json({ logs: [] });
    const { data } = await supabase
        .from('transfer_sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(30);
    res.json({ logs: data ?? [] });
});

// ─── Admin API (autenticada por JWT + is_admin) ───────────────────────────────

// Returns how many watchlist slots the user's plan allows
const WATCHLIST_PLAN_LIMITS = { free: 0, essencial: 3, pro: 10, elite: 999, admin: 999 };
async function getWatchlistLimit(userId) {
    if (!supabase) return 0;
    const { data } = await supabase.from('user_profiles').select('plan').eq('id', userId).single();
    const plan = (data?.plan ?? 'free').toLowerCase();
    return WATCHLIST_PLAN_LIMITS[plan] ?? 0;
}

async function requireAdminJWT(req, res, next) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    let userId;

    // Tentativa 1: validação via Supabase Auth API (funciona com service_role key — Railway/prod)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (!authErr && user) {
        userId = user.id;
    } else {
        // Tentativa 2 (fallback dev local): decodifica o payload JWT sem verificar a assinatura.
        // Em produção (Railway), SUPABASE_SERVICE_ROLE_KEY sempre está presente → Tentativa 1 passa.
        try {
            const parts = token.split('.');
            if (parts.length !== 3) throw new Error('JWT malformado');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            if (!payload.sub) throw new Error('JWT sem sub');
            if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
                return res.status(401).json({ error: 'Sessão expirada' });
            }
            userId = payload.sub;
        } catch {
            return res.status(401).json({ error: 'Token inválido' });
        }
    }

    // Consulta is_admin com contexto do usuário para que a RLS reconheça auth.uid()
    // (necessário no fallback em que o cliente usa a anon key sem service_role)
    const queryClient = user ? supabase : createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    const { data: profile, error: profileErr } = await queryClient
        .from('user_profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

    console.log('[AdminAuth] userId:', userId, '| profile:', JSON.stringify(profile), '| err:', profileErr?.message);

    if (!profile?.is_admin) return res.status(403).json({ error: 'Acesso negado' });
    req.adminUserId = userId;
    next();
}

// ─── User JWT middleware (non-admin endpoints) ────────────────────────────────
async function requireUserJWT(req, res, next) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token inválido' });
    req.userId = user.id;
    next();
}

// GET /api/admin/stats — métricas gerais do produto
app.get('/api/admin/stats', requireAdminJWT, async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [usersRes, planCountsRes, strategiesMonthRes, roteiroMonthRes, buscasMonthRes] = await Promise.all([
            supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
            supabase.from('user_profiles').select('plan'),
            supabase.from('strategies').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
            supabase.from('itineraries').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
            supabase.from('buscas').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        ]);

        const planCounts = { free: 0, essencial: 0, pro: 0, elite: 0, admin: 0 };
        for (const row of planCountsRes.data ?? []) {
            const p = row.plan ?? 'free';
            planCounts[p] = (planCounts[p] ?? 0) + 1;
        }

        res.json({
            totalUsers: usersRes.count ?? 0,
            planCounts,
            strategiesThisMonth: strategiesMonthRes.count ?? 0,
            roteiroThisMonth: roteiroMonthRes.count ?? 0,
            buscasThisMonth: buscasMonthRes.count ?? 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/users — lista usuários com info de plano e uso
app.get('/api/admin/users', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const plan = req.query.plan ?? null;
        const search = req.query.search ?? null;
        const page = parseInt(req.query.page ?? '1', 10);
        const pageSize = 20;
        const offset = (page - 1) * pageSize;

        let query = supabase
            .from('user_profiles')
            .select('id, full_name, plan, plan_expires_at, plan_billing, is_admin, updated_at', { count: 'exact' })
            .order('updated_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (plan) query = query.eq('plan', plan);

        const { data, count, error } = await query;
        if (error) throw error;

        // Busca emails via auth.users (service_role apenas)
        const ids = (data ?? []).map(u => u.id);
        let emailMap = {};
        if (ids.length > 0) {
            const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
            for (const au of authUsers?.users ?? []) {
                emailMap[au.id] = au.email;
            }
        }

        // Filtra por search (email ou nome) após buscar — simples, funciona para volumes pequenos
        let users = (data ?? []).map(u => ({ ...u, email: emailMap[u.id] ?? null }));
        if (search) {
            const s = search.toLowerCase();
            users = users.filter(u =>
                u.full_name?.toLowerCase().includes(s) ||
                u.email?.toLowerCase().includes(s)
            );
        }

        res.json({ users, total: count ?? 0, page, pageSize });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/users/:id/plan — alterar plano e/ou expiração
app.patch('/api/admin/users/:id/plan', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { id } = req.params;
    const { plan, plan_expires_at, plan_billing } = req.body;

    const allowed = ['free', 'essencial', 'pro', 'elite', 'admin'];
    if (plan && !allowed.includes(plan)) return res.status(400).json({ error: 'Plano inválido' });

    try {
        const update = {};
        if (plan !== undefined) update.plan = plan;
        if (plan_expires_at !== undefined) update.plan_expires_at = plan_expires_at;
        if (plan_billing !== undefined) update.plan_billing = plan_billing;

        const { error } = await supabase.from('user_profiles').update(update).eq('id', id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/users/:id/toggle-admin — conceder/revogar admin
app.post('/api/admin/users/:id/toggle-admin', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { id } = req.params;
    const { is_admin } = req.body;
    if (typeof is_admin !== 'boolean') return res.status(400).json({ error: 'is_admin deve ser boolean' });

    try {
        const { error } = await supabase.from('user_profiles').update({ is_admin }).eq('id', id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Preços por plano (espelha Planos.tsx) ────────────────────────────────────
const PLAN_PRICES = {
    essencial: { mensal: 19, anual: 12 },
    pro:       { mensal: 39, anual: 25 },
    elite:     { mensal: 69, anual: 45 },
};

// GET /api/admin/revenue — MRR, churn, conversão, alertas de expiração
app.get('/api/admin/revenue', requireAdminJWT, async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, plan, plan_expires_at, plan_billing');

        let mrr = 0;
        let churnCount = 0;
        const expiringUsers = [];

        for (const p of profiles ?? []) {
            const isExpired = p.plan_expires_at && new Date(p.plan_expires_at) < now;
            const isPaid = ['essencial', 'pro', 'elite'].includes(p.plan);
            const prices = PLAN_PRICES[p.plan];

            // MRR: planos ativos e não expirados
            if (isPaid && !isExpired && prices) {
                const monthly = p.plan_billing === 'anual' ? prices.anual : prices.mensal;
                mrr += monthly;
            }

            // Churn: planos que expiraram (eram pagantes, agora inativos)
            if (isPaid && isExpired) churnCount++;

            // Expirando nos próximos 7 dias
            if (p.plan_expires_at && !isExpired && new Date(p.plan_expires_at) <= new Date(in7days) && isPaid) {
                expiringUsers.push({ id: p.id, plan: p.plan, plan_expires_at: p.plan_expires_at });
            }
        }

        // Novos pagantes este mês (assinaram após monthStart)
        const { count: newPaidThisMonth } = await supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .in('plan', ['essencial', 'pro', 'elite'])
            .gte('updated_at', monthStart);

        const total = profiles?.length ?? 0;
        const paid = (profiles ?? []).filter(p => {
            const isExpired = p.plan_expires_at && new Date(p.plan_expires_at) < now;
            return ['essencial', 'pro', 'elite'].includes(p.plan) && !isExpired;
        }).length;

        res.json({
            mrr,
            conversionRate: total > 0 ? ((paid / total) * 100).toFixed(1) : '0',
            paidUsers: paid,
            churnCount,
            newPaidThisMonth: newPaidThisMonth ?? 0,
            expiringIn7Days: expiringUsers,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/engagement — usuários ativos, novos usuários, top destinos, estratégias por dia
app.get('/api/admin/engagement', requireAdminJWT, async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const now = new Date();
        const days30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const days7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();

        // Usuários que fizeram pelo menos 1 busca nos últimos 30 dias
        const { data: activeBuscas } = await supabase
            .from('buscas')
            .select('user_id')
            .gte('created_at', days30ago);
        const activeUsers30d = new Set((activeBuscas ?? []).map(b => b.user_id)).size;

        // Usuários que fizeram busca nos últimos 7 dias
        const { data: activeBuscas7d } = await supabase
            .from('buscas')
            .select('user_id')
            .gte('created_at', days7ago);
        const activeUsers7d = new Set((activeBuscas7d ?? []).map(b => b.user_id)).size;

        // Top 10 destinos (últimos 30 dias)
        const { data: buscas30d } = await supabase
            .from('buscas')
            .select('origem, destino')
            .gte('created_at', days30ago);
        const routeCount = {};
        for (const b of buscas30d ?? []) {
            const key = `${b.origem} → ${b.destino}`;
            routeCount[key] = (routeCount[key] ?? 0) + 1;
        }
        const topRoutes = Object.entries(routeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([route, count]) => ({ route, count }));

        // Estratégias geradas por dia nos últimos 14 dias
        const days14ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: strategies14d } = await supabase
            .from('strategies')
            .select('created_at')
            .gte('created_at', days14ago);
        const stratByDay = {};
        for (const s of strategies14d ?? []) {
            const day = s.created_at.slice(0, 10);
            stratByDay[day] = (stratByDay[day] ?? 0) + 1;
        }
        const strategiesPerDay = Object.entries(stratByDay)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({ date, count }));

        // Pagantes sem uso nos últimos 30 dias
        const { data: paidProfiles } = await supabase
            .from('user_profiles')
            .select('id, plan, plan_expires_at')
            .in('plan', ['essencial', 'pro', 'elite']);
        const activeIds = new Set((activeBuscas ?? []).map(b => b.user_id));
        const paidNow = new Date();
        const inactivePaid = (paidProfiles ?? []).filter(p => {
            const expired = p.plan_expires_at && new Date(p.plan_expires_at) < paidNow;
            return !expired && !activeIds.has(p.id);
        }).length;

        res.json({
            activeUsers30d,
            activeUsers7d,
            inactivePaidUsers: inactivePaid,
            topRoutes,
            strategiesPerDay,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/api-status — verifica saúde das APIs externas
app.get('/api/admin/api-status', requireAdminJWT, async (_req, res) => {
    async function check(name, fn) {
        const start = Date.now();
        try {
            await fn();
            return { name, ok: true, latency: Date.now() - start };
        } catch (e) {
            return { name, ok: false, latency: Date.now() - start, error: e.message };
        }
    }

    const results = await Promise.all([
        check('Supabase', async () => {
            if (!supabase) throw new Error('Client não inicializado');
            const { error } = await supabase.from('user_profiles').select('id').limit(1);
            if (error) throw error;
        }),
        check('Seats.aero', async () => {
            if (!SEATS_AERO_API_KEY) throw new Error('API key não configurada');
            const r = await fetch(`${SEATS_AERO_BASE}/availability?origin_airport=GRU&destination_airport=JFK&cabin=economy&start_date=2025-06-01&end_date=2025-06-30`, {
                headers: { 'Partner-Authorization': SEATS_AERO_API_KEY },
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
        check('Amadeus', async () => {
            const key = process.env.AMADEUS_CLIENT_ID;
            const secret = process.env.AMADEUS_CLIENT_SECRET;
            if (!key || !secret) throw new Error('Credenciais não configuradas');
            const r = await fetch('https://api.amadeus.com/v1/security/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `grant_type=client_credentials&client_id=${key}&client_secret=${secret}`,
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
        check('Anthropic (Claude)', async () => {
            const key = process.env.ANTHROPIC_API_KEY;
            if (!key) throw new Error('API key não configurada');
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 8, messages: [{ role: 'user', content: 'OK' }] }),
                signal: AbortSignal.timeout(15000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
        check('AbacatePay', async () => {
            const key = process.env.ABACATEPAY_API_KEY;
            if (!key) throw new Error('API key não configurada');
            const r = await fetch('https://api.abacatepay.com/v1/billing/list', {
                headers: { Authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
    ]);

    res.json({ checks: results, checkedAt: new Date().toISOString() });
});

// ─── Custos operacionais ──────────────────────────────────────────────────────

// GET /api/admin/costs?month=2026-03 — lista custos de um mês
app.get('/api/admin/costs', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const month = req.query.month ?? new Date().toISOString().slice(0, 7);
        const monthStart = `${month}-01`;
        const [year, mon] = month.split('-').map(Number);
        const nextMonth = mon === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

        const { data, error } = await supabase
            .from('admin_costs')
            .select('*')
            .gte('month', monthStart)
            .lt('month', nextMonth)
            .order('category')
            .order('service');
        if (error) throw error;
        res.json({ costs: data ?? [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/costs/history — totais dos últimos 6 meses
app.get('/api/admin/costs/history', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const { data, error } = await supabase
            .from('admin_costs')
            .select('month, amount_brl')
            .gte('month', sixMonthsAgo.toISOString().slice(0, 10))
            .order('month');
        if (error) throw error;

        const byMonth = {};
        for (const row of data ?? []) {
            const m = row.month.slice(0, 7);
            byMonth[m] = (byMonth[m] ?? 0) + parseFloat(row.amount_brl);
        }
        res.json({ history: Object.entries(byMonth).map(([month, total]) => ({ month, total })) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/costs — adicionar custo
app.post('/api/admin/costs', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { month, service, category, amount_brl, notes } = req.body;
    if (!month || !service || !category || amount_brl == null) {
        return res.status(400).json({ error: 'Campos obrigatórios: month, service, category, amount_brl' });
    }
    try {
        const { data, error } = await supabase
            .from('admin_costs')
            .insert({ month: `${month}-01`, service, category, amount_brl, notes: notes || null })
            .select()
            .single();
        if (error) throw error;
        res.json({ cost: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/costs/:id — remover custo
app.delete('/api/admin/costs/:id', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const { error } = await supabase.from('admin_costs').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Helpers para geração de posts ───────────────────────────────────────────

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildPostSlideHTML(slide, slideHeight = 1350) {
    const BG_MAP = { navy: '#0E2A55', white: '#FFFFFF', snow: '#F7F9FC', vibrant: '#2A60C2' };
    const bg      = BG_MAP[slide.background] ?? '#FFFFFF';
    const isDark  = slide.background === 'navy' || slide.background === 'vibrant';
    const isNavy  = slide.background === 'navy';
    const isLight = !isDark;

    const headlineRaw  = String(slide.headline ?? '');
    const headlineLen  = headlineRaw.replace(/\n/g, '').length;
    const headlineSize = slide.headlineSize > 0
        ? slide.headlineSize
        : headlineLen > 70 ? 58 : headlineLen > 50 ? 68 : headlineLen > 30 ? 78 : 88;
    const headlineHtml = escapeHtml(headlineRaw).replace(/\n/g, '<br>');
    const bodyHtml     = escapeHtml(String(slide.body ?? '')).replace(/\n/g, '<br>');

    const vPad  = slideHeight === 1920 ? 110 : 80;   // vertical padding
    const lPad  = isDark ? 96 : 80;                  // left padding (dark has accent bar)

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@700;800;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: ${slideHeight}px; overflow: hidden; }

body {
    background: ${bg};
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: ${vPad}px 80px ${vPad}px ${lPad}px;
}

/* ─── Barra de acento lateral (slides escuros) ─── */
.accent-bar {
    position: absolute; left: 0; top: ${vPad}px; bottom: ${vPad}px;
    width: 6px;
    background: linear-gradient(180deg, #4A90E2 0%, #2A60C2 60%, rgba(42,96,194,0) 100%);
    border-radius: 0 4px 4px 0;
}

/* ─── Barra de progresso superior (slides claros) ─── */
.progress-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 5px;
    background: linear-gradient(90deg, #2A60C2 0%, #4A90E2 100%);
}

/* ─── Elementos decorativos geométricos ─── */
.deco-ring {
    position: absolute;
    top: ${slideHeight === 1920 ? '-180px' : '-140px'}; right: -140px;
    width: ${slideHeight === 1920 ? '680px' : '580px'};
    height: ${slideHeight === 1920 ? '680px' : '580px'};
    border-radius: 50%;
    border: ${isDark ? '1px solid rgba(74,144,226,0.12)' : '1px solid rgba(42,96,194,0.06)'};
    pointer-events: none;
}
.deco-ring-2 {
    position: absolute;
    top: ${slideHeight === 1920 ? '-80px' : '-60px'}; right: -60px;
    width: ${slideHeight === 1920 ? '420px' : '360px'};
    height: ${slideHeight === 1920 ? '420px' : '360px'};
    border-radius: 50%;
    background: ${isNavy ? 'rgba(74,144,226,0.06)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(42,96,194,0.04)'};
    pointer-events: none;
}
.deco-dot-grid {
    position: absolute; bottom: 120px; right: 80px;
    width: 120px; height: 120px;
    background-image: radial-gradient(circle, ${isDark ? 'rgba(74,144,226,0.25)' : 'rgba(42,96,194,0.12)'} 1.5px, transparent 1.5px);
    background-size: 20px 20px;
    pointer-events: none;
}

/* ─── Tag ─── */
.tag {
    display: inline-flex; align-items: center; gap: 8px;
    margin-bottom: 28px; width: fit-content;
}
.tag-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    background: ${isDark ? '#4A90E2' : '#2A60C2'};
}
.tag-label {
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.13em; text-transform: uppercase;
    color: ${isDark ? '#4A90E2' : '#2A60C2'};
}

/* ─── Headline ─── */
.headline {
    font-family: 'Manrope', sans-serif;
    font-size: ${headlineSize}px; font-weight: 900;
    line-height: 1.04; letter-spacing: -0.028em;
    color: ${isDark ? '#FFFFFF' : '#0E2A55'};
    max-width: 920px;
    ${slide.body ? 'margin-bottom: 32px;' : ''}
}

/* ─── Corpo ─── */
.body {
    font-size: ${slideHeight === 1920 ? '30px' : '27px'};
    font-weight: 400; line-height: 1.72;
    color: ${isDark ? 'rgba(255,255,255,0.70)' : '#2C3E6B'};
    max-width: 900px;
}

/* ─── Swipe hint ─── */
.swipe-hint {
    margin-top: 48px;
    font-size: 17px; font-weight: 600; letter-spacing: 0.07em;
    color: ${isDark ? 'rgba(255,255,255,0.36)' : '#C8D4E8'};
    text-transform: uppercase;
}

/* ─── Footer ─── */
.footer {
    position: absolute;
    bottom: ${slideHeight === 1920 ? '80px' : '52px'};
    left: ${lPad}px; right: 80px;
    display: flex; justify-content: space-between; align-items: center;
}
.logo {
    font-family: 'Manrope', sans-serif;
    font-size: 19px; font-weight: 900; letter-spacing: -0.01em;
    color: ${isDark ? 'rgba(255,255,255,0.85)' : '#0E2A55'};
    display: flex; align-items: center; gap: 7px;
}
.logo-dot {
    width: 9px; height: 9px; border-radius: 50%;
    background: ${isDark ? '#4A90E2' : '#2A60C2'};
}
.handle {
    font-size: 14px; font-weight: 500; letter-spacing: 0.03em;
    color: ${isDark ? 'rgba(255,255,255,0.28)' : '#C8D4E8'};
}
</style>
</head>
<body>
    ${isDark ? '<div class="accent-bar"></div>' : '<div class="progress-bar"></div>'}
    <div class="deco-ring"></div>
    <div class="deco-ring-2"></div>
    <div class="deco-dot-grid"></div>

    ${slide.tag ? `<div class="tag"><div class="tag-dot"></div><div class="tag-label">${escapeHtml(slide.tag)}</div></div>` : ''}
    <div class="headline">${headlineHtml}</div>
    ${slide.body ? `<div class="body">${bodyHtml}</div>` : ''}
    ${slide.swipeHint ? `<div class="swipe-hint">${escapeHtml(slide.swipeHint)}</div>` : ''}

    <div class="footer">
        <div class="logo"><div class="logo-dot"></div>FlyWise</div>
        <div class="handle">@flywisebr</div>
    </div>
</body>
</html>`;
}

// POST /api/admin/generate-post-content — usa Claude para criar copy estruturado dos slides
app.post('/api/admin/generate-post-content', requireAdminJWT, async (req, res) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada' });

    const { format = 'carrossel', pilar = 'estrategia', topic = '', dayOfWeek } = req.body ?? {};

    const PILARES = {
        estrategia: 'Estratégia — ensina como usar milhas de forma inteligente (CPM, programas, transferências)',
        produto:    'Produto — apresenta uma feature do FlyWise (busca, simulador, IA, roteiros)',
        inspiracao: 'Inspiração — destinos, experiências, motivação para acumular e viajar',
        prova:      'Prova — resultados reais, depoimentos, comparativos, cases de economia',
    };

    const FORMATOS = {
        carrossel: 'Carrossel de feed (5-6 slides): Slide 1 capa Navy com gancho + "arrasta →", slides 2-5 brancos/snow com 1 ideia cada, último slide CTA azul vibrant',
        isolado:   'Post isolado de feed (1 slide): único, fundo Navy ou Snow, headline forte, corpo resumido',
        story:     'Story (1-3 telas sequenciais): urgente, sem caption longo, fundo Navy ou vibrant',
    };

    const system = `Você é o criador de conteúdo do FlyWise — plataforma brasileira de viagens focada em otimização de milhas.

IDENTIDADE DA MARCA:
- Tom: educativo, estratégico, direto. Mais próximo de fintech do que portal de turismo.
- Linguagem: português brasileiro informal-profissional. Sem jargões excessivos.
- Handle: @flywisebr
- Proposta de valor: a IA do FlyWise calcula automaticamente CPM, compara programas e recomenda a melhor estratégia para cada voo.

PRODUTO (para contextualizar o conteúdo):
- Busca voos em BRL em tempo real + disponibilidade de milhas (Seats.aero)
- IA que calcula CPM e recomenda Smiles, LATAM Pass, TudoAzul, Livelo, Aeroplan, Flying Blue etc.
- Simulador de transferências com bonificações ativas
- Gerador de roteiros day-by-day
- Planos: Free / Essencial R$19/mês / Pro R$39/mês / Elite R$69/mês

REGRAS INVIOLÁVEIS:
- Feed: conteúdo evergreen. NUNCA use dados de mercado que mudam (CPM atual, bônus ativos, preços específicos de voos reais).
- Use exemplos numéricos hipotéticos e ilustrativos, deixando claro que são exemplos.
- Stories: podem ter urgência e dados do momento, mas devem ser marcados como efêmeros.
- CTA do último slide de carrossel: sempre "link na bio" — NUNCA um botão ou URL.
- Máximo 3 linhas de texto por slide interno.
- Use \\n para quebras de linha nos campos headline e body.

BACKGROUNDS DISPONÍVEIS:
- "navy": #0E2A55 — para capas e slides de impacto (texto branco)
- "white": #FFFFFF — para slides de conteúdo (texto escuro)
- "snow": #F7F9FC — para slides de conteúdo com variação (texto escuro)
- "vibrant": #2A60C2 — SOMENTE para o último slide de CTA (texto branco)

RETORNE SOMENTE JSON VÁLIDO com esta estrutura exata:
{
  "slides": [
    {
      "background": "navy|white|snow|vibrant",
      "tag": "string ou vazio",
      "headline": "string (\\n para quebra de linha)",
      "headlineSize": 0,
      "body": "string (\\n para quebra de linha) ou vazio",
      "swipeHint": "string ou vazio"
    }
  ],
  "caption": "caption completo com hashtags para o Instagram"
}`;

    const userPrompt = `Crie um ${FORMATOS[format] ?? FORMATOS.carrossel}.

PILAR: ${PILARES[pilar] ?? PILARES.estrategia}
${topic ? `TEMA/ÂNGULO SOLICITADO: ${topic}` : 'TEMA: escolha o mais relevante e acionável para o pilar'}
DIA DA SEMANA: ${dayOfWeek ?? 'Segunda-feira'}

Gere o conteúdo completo seguindo todas as regras de marca.`;

    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 2048,
                system,
                messages: [{ role: 'user', content: userPrompt }],
            }),
            signal: AbortSignal.timeout(45000),
        });

        if (!r.ok) {
            const errBody = await r.text().catch(() => '');
            throw new Error(`Anthropic API error: ${r.status} — ${errBody.slice(0, 200)}`);
        }

        const { content } = await r.json();
        const raw = content?.[0]?.text ?? '';

        // Extrai JSON do texto (pode vir com blocos de código)
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Resposta da IA não contém JSON válido');
        const parsed = JSON.parse(jsonMatch[0]);

        res.json(parsed);
    } catch (err) {
        console.error('[PostContent] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/generate-post — gera slides de Instagram como PNG (retorna base64)
app.post('/api/admin/generate-post', requireAdminJWT, async (req, res) => {
    const { slides, postFormat = 'feed' } = req.body ?? {};
    if (!Array.isArray(slides) || slides.length === 0) {
        return res.status(400).json({ error: 'slides é obrigatório e deve ser um array não-vazio' });
    }
    if (slides.length > 7) {
        return res.status(400).json({ error: 'Máximo de 7 slides por post' });
    }

    const slideHeight = postFormat === 'story' ? 1920 : 1350;

    try {
        await ensureChromium();
        const browser = await getBrowser();
        const context = await browser.newContext({
            viewport: { width: 1080, height: slideHeight },
            deviceScaleFactor: 1,
        });

        const images = [];
        for (let i = 0; i < slides.length; i++) {
            const page = await context.newPage();
            try {
                const html = buildPostSlideHTML(slides[i], slideHeight);
                await page.setContent(html, { waitUntil: 'domcontentloaded' });
                await page.evaluate(() => document.fonts.ready);
                await new Promise(r => setTimeout(r, 150));
                const buffer = await page.screenshot({ type: 'png', fullPage: false });
                images.push({
                    name: `flywise-slide-${String(i + 1).padStart(2, '0')}.png`,
                    data: buffer.toString('base64'),
                });
            } finally {
                await page.close().catch(() => {});
            }
        }

        await context.close().catch(() => {});
        res.json({ images });
    } catch (err) {
        console.error('[PostGen] Erro ao gerar slides:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Localmente: inicia o servidor Express normalmente.
// Na Vercel: o arquivo é importado como módulo serverless — app.listen não é chamado.
if (process.env.VERCEL !== '1') {
    // ── Crons removidos do servidor — agora disparados via GitHub Actions ────────
    // syncAwardPrices  → .github/workflows/sync-award-prices.yml  (toda segunda, 07h UTC)
    // syncTransferData → .github/workflows/sync-transfer-data.yml (diário, 14h UTC)
    // Isso permite ativar Railway Sleep on Idle sem perder nenhuma execução agendada.

    // A cada 5 minutos: fecha browser Playwright ocioso para liberar memória
    setInterval(async () => {
        if (_browser && _browser.isConnected()) {
            try {
                await _browser.close();
                _browser = null;
                console.log('[GFlights] Browser fechado pelo cleanup periódico (memória liberada).');
            } catch (e) {
                console.warn('[GFlights] Erro no cleanup periódico:', e.message);
                _browser = null;
            }
        }
    }, 5 * 60 * 1000);

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`Servidor FlyWise Backend rodando na porta ${PORT}`);
        console.log(`POST http://localhost:${PORT}/api/search-flights   (Seats.aero)`);
        console.log(`GET  http://localhost:${PORT}/api/amadeus/airports  (Amadeus)`);
        console.log(`GET  http://localhost:${PORT}/api/amadeus/flights   (Google Flights scraper)`);
        console.log(`======================================================\n`);
        // Inicia instalação do Chromium em background (não bloqueia o servidor)
        if (!_chromiumReady) ensureChromium();
        // Seed automático de promoções de transferência (se tabela vazia)
        refreshPromotionsCache().catch(console.error);
    });
}

export default app;
