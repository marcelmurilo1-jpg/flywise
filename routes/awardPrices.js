import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { fetchSeatsAeroAPI, SEATS_AERO_API_KEY } from '../lib/seatsAero.js';
import { requireSyncSecret } from '../middleware/auth.js';

const router = Router();

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

export async function syncAwardPrices() {
    if (!SEATS_AERO_API_KEY || !supabase) {
        console.log('[AwardSync] Skipped — SEATS_AERO_API_KEY ou Supabase não configurado');
        return;
    }
    console.log('[AwardSync] Iniciando sincronização semanal de preços de milhas...');
    const dates = getSampleDates();
    const results = {};

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
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                console.warn(`[AwardSync] Erro ${route.origin}-${route.destination} ${date}: ${e.message}`);
            }
        }
        await new Promise(r => setTimeout(r, 600));
    }

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
router.get('/api/award-prices', async (req, res) => {
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

// POST /api/award-prices/sync — dispara sync manual
router.post('/api/award-prices/sync', requireSyncSecret, async (req, res) => {
    syncAwardPrices().catch(console.error);
    res.json({ message: 'Sincronização iniciada em background' });
});

export default router;
