import { Router } from 'express';
import { doScrape, doScrapeReturn, gfCacheSet, gfCacheKey, GF_CACHE_TTL_MS, _gfCache, _gfInflight } from '../scraper/googleFlights.js';

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

// GET /api/amadeus/return-flights — raspa voos de volta com preço combinado real (igual Google Flights)
// Reabre a página TFS round-trip, clica no voo de ida selecionado e coleta os voos de volta
router.get('/api/amadeus/return-flights', async (req, res) => {
    const { outboundOrigin, outboundDest, outboundDate, returnDate, outboundDeparture } = req.query;

    if (!outboundOrigin || !outboundDest || !outboundDate || !returnDate || !outboundDeparture) {
        return res.status(400).json({ errors: [{ detail: 'outboundOrigin, outboundDest, outboundDate, returnDate e outboundDeparture são obrigatórios.' }] });
    }

    const cacheKey = `return|${outboundOrigin}|${outboundDest}|${outboundDate}|${returnDate}|${outboundDeparture}`;

    const cached = _gfCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[GFlights] Return cache hit (${outboundOrigin}→${outboundDest} @${outboundDeparture})`);
        return res.json({ data: cached.data, meta: { count: cached.data.length, source: 'cache' } });
    }

    if (_gfInflight.has(cacheKey)) {
        try {
            const { outbound } = await _gfInflight.get(cacheKey);
            return res.json({ data: outbound, meta: { count: outbound.length, source: 'dedup' } });
        } catch (err) {
            return res.status(500).json({ errors: [{ detail: err.message }] });
        }
    }

    console.log(`[GFlights] Buscando volta: ${outboundOrigin}→${outboundDest} @${outboundDeparture}, retorno ${returnDate}`);

    const promise = doScrapeReturn(outboundOrigin, outboundDest, outboundDate, returnDate, outboundDeparture)
        .then(result => {
            if (result.outbound.length > 0) {
                gfCacheSet(cacheKey, { data: result.outbound, expiresAt: Date.now() + GF_CACHE_TTL_MS });
            }
            console.log(`[GFlights] Volta: ${result.outbound.length} opções`);
            return result;
        })
        .finally(() => _gfInflight.delete(cacheKey));

    _gfInflight.set(cacheKey, promise);

    try {
        const { outbound } = await promise;
        res.json({ data: outbound, meta: { count: outbound.length, source: 'google-flights-scraper' } });
    } catch (err) {
        console.error('[GFlights] Erro na busca de volta:', err.message);
        if (err.message === 'BLOCKED') {
            return res.status(503).json({ errors: [{ detail: 'Google Flights bloqueou temporariamente. Tente novamente.' }] });
        }
        res.status(500).json({ errors: [{ detail: err.message }] });
    }
});

export default router;
