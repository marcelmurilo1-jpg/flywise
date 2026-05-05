import { Router } from 'express';
import { doScrape, gfCacheSet, gfCacheKey, GF_CACHE_TTL_MS, _gfCache, _gfInflight } from '../scraper/googleFlights.js';

const router = Router();

// GET /api/amadeus/flights — scraper do Google Flights (ida e volta em paralelo)
router.get('/api/amadeus/flights', async (req, res) => {
    const { originLocationCode: origin, destinationLocationCode: destination, departureDate: date, returnDate } = req.query;

    if (!origin || !destination || !date) {
        return res.status(400).json({ errors: [{ detail: 'origin, destination e departureDate são obrigatórios' }] });
    }

    const cacheKey = gfCacheKey(origin, destination, date, returnDate);

    // 1. Cache hit
    const cached = _gfCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[GFlights] Cache hit (${origin}→${destination} ${date}) — ${cached.data.length} voos`);
        return res.json({ data: cached.data, inbound: cached.inbound, priceGraph: cached.priceGraph ?? null, meta: { count: cached.data.length, source: 'cache' } });
    }

    // 2. Deduplicação: se já há um scrape em andamento para esta chave, aguarda ele
    if (_gfInflight.has(cacheKey)) {
        console.log(`[GFlights] Dedup hit (${origin}→${destination} ${date}) — aguardando scrape em andamento`);
        try {
            const { outbound, inbound, priceGraph } = await _gfInflight.get(cacheKey);
            return res.json({ data: outbound, inbound, priceGraph, meta: { count: outbound.length, source: 'dedup' } });
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
                gfCacheSet(cacheKey, { data: outbound, inbound: result.inbound, priceGraph: result.priceGraph, expiresAt: Date.now() + GF_CACHE_TTL_MS });
            }
            console.log(`[GFlights] Ida: ${outbound.length} | Volta: ${result.inbound.length}`);
            return result;
        })
        .finally(() => _gfInflight.delete(cacheKey));

    _gfInflight.set(cacheKey, promise);

    try {
        const { outbound, inbound, priceGraph } = await promise;
        res.json({ data: outbound, inbound, priceGraph, meta: { count: outbound.length, source: 'google-flights-scraper' } });
    } catch (err) {
        console.error('[GFlights] Erro:', err.message);
        if (err.message === 'BLOCKED') {
            return res.status(503).json({ errors: [{ detail: 'Google Flights bloqueou temporariamente o servidor. Tente novamente em alguns minutos.' }] });
        }
        res.status(500).json({ errors: [{ detail: err.message }] });
    }
});

export default router;
