import { Router } from 'express';
import pLimit from 'p-limit';
import { supabase } from '../lib/supabase.js';
import { fetchSeatsAeroAPI, mapSeatsAeroItem, SEATS_AERO_API_KEY } from '../lib/seatsAero.js';

const router = Router();

// Rota de busca via API oficial do Seats.aero
router.post('/api/search-flights', async (req, res) => {
    const { origem, destino, data_ida, data_volta, user_id } = req.body;
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
        const promessas = [fetchSeatsAeroAPI(origem, destino, data_ida, data_ida, user_id)];
        if (data_volta) promessas.push(fetchSeatsAeroAPI(destino, origem, data_volta, data_volta, user_id));

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
router.post('/api/discover-routes', async (req, res) => {
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

// ─── Booking Link — busca trips de uma disponibilidade específica ─────────────
// GET /api/seats-booking-link?availability_id=xxx
router.get('/api/seats-booking-link', async (req, res) => {
    const { availability_id } = req.query;
    if (!availability_id) return res.status(400).json({ error: 'availability_id obrigatório' });
    if (!SEATS_AERO_API_KEY) return res.status(503).json({ error: 'API Key não configurada' });

    try {
        const apiRes = await fetch(
            `${(await import('../lib/seatsAero.js')).SEATS_AERO_BASE}/trips?availability_id=${availability_id}`,
            {
                headers: { 'Partner-Authorization': SEATS_AERO_API_KEY, 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000),
            }
        );
        if (!apiRes.ok) {
            console.warn(`[Seats] trips API status ${apiRes.status} para availability_id=${availability_id}`);
            return res.status(apiRes.status).json({ error: `Seats.aero retornou ${apiRes.status}` });
        }
        const data = await apiRes.json();
        console.log('[Seats] trips raw:', JSON.stringify(data).slice(0, 600));

        // Extrai booking links do primeiro trip
        const trips = data.data ?? data.trips ?? (Array.isArray(data) ? data : []);
        const firstTrip = trips[0] ?? null;
        const links = firstTrip?.BookingLinks ?? firstTrip?.booking_links ?? [];
        const primary = links.find(l => l.primary || l.Primary) ?? links[0] ?? null;
        const bookingLink = primary?.link ?? primary?.Link ?? primary?.URL ?? primary?.url ?? null;

        res.json({ bookingLink, allLinks: links });
    } catch (err) {
        console.error('[Seats] trips error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
