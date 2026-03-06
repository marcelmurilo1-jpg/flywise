import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { buscarVoosSeatsAero } from './scripts/seatsAeroScraper.js';

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

// Rota de busca do scraping
app.post('/api/search-flights', async (req, res) => {
    console.log('[Express] 📥 Nova requisição recebida em /api/search-flights');
    const { origem, destino, data_ida, data_volta } = req.body;

    if (!origem || !destino || !data_ida) {
        return res.status(400).json({ error: 'Origem, destino e data_ida são obrigatórios' });
    }

    try {
        const TTL_MS = 10 * 60 * 1000; // 10 minutos

        // ── 1. Checa cache no Supabase antes de abrir o browser ───────────────
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
                // Filtra pelo tipo (ida/volta) se necessário
                const voosCached = cached.dados.filter(v =>
                    !data_volta
                        ? v.tipo === 'ida'
                        : true
                );
                console.log(`[Express] Cache hit: ${voosCached.length} voos retornados do Supabase sem scraping.`);
                return res.json({ origem, destino, total: voosCached.length, voos: voosCached, source: 'cache' });
            }
            console.log('[Express] Cache miss — iniciando scraping.');
        }

        // ── 2. Scraping em paralelo (ida + volta) ─────────────────────────────
        console.log(`[Express] Raspagem: ${origem} -> ${destino} | ida:${data_ida}${data_volta ? ` volta:${data_volta}` : ''}`);

        const promessas = [buscarVoosSeatsAero(origem, destino, data_ida)];
        if (data_volta) promessas.push(buscarVoosSeatsAero(destino, origem, data_volta));

        const resultadosArray = await Promise.all(promessas);

        // Verifica paywall em qualquer resultado
        for (const r of resultadosArray) {
            if (r?.error === 'NOT_PRO_ACCOUNT') {
                return res.status(401).json({ error: 'Sessão não-Pro detectada. Atualize o arquivo cookies.json.' });
            }
        }

        const resultadosIda = resultadosArray[0] || [];
        const resultadosVolta = resultadosArray[1] || [];
        const resultadosFinais = [
            ...resultadosIda.map(v => ({ ...v, tipo: 'ida' })),
            ...resultadosVolta.map(v => ({ ...v, tipo: 'volta' })),
        ];

        // ── 3. Salva no cache Supabase (limpa expirados + insere novos) ───────
        if (supabase && resultadosFinais.length > 0) {
            const ttlLimit = new Date(Date.now() - TTL_MS).toISOString();

            // Limpa entradas antigas desta rota
            await supabase
                .from('seatsaero_searches')
                .delete()
                .eq('origem', origem.toUpperCase())
                .eq('destino', destino.toUpperCase())
                .lt('criado_em', ttlLimit);

            const { error: insertErr } = await supabase
                .from('seatsaero_searches')
                .insert([{ origem: origem.toUpperCase(), destino: destino.toUpperCase(), dados: resultadosFinais }]);

            if (insertErr) {
                console.error('[Express] Erro ao salvar cache:', insertErr.message);
            } else {
                console.log(`[Express] Cache salvo: ${resultadosFinais.length} voos.`);
            }
        }

        res.json({ origem, destino, total: resultadosFinais.length, voos: resultadosFinais, source: 'scrape' });

    } catch (err) {
        console.error('[Express] Erro na rota /api/search-flights:', err);
        res.status(500).json({ error: 'Erro interno no servidor ao raspar voos do Seats.aero' });
    }
});

// ─── Amadeus Proxy ────────────────────────────────────────────────────────────
// Credenciais ficam APENAS no servidor, nunca expostas no bundle do frontend.
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

app.get('/api/amadeus/flights', async (req, res) => {
    try {
        const token = await getAmadeusToken();
        const params = new URLSearchParams(req.query);
        const r = await fetch(`${AMADEUS_BASE}/v2/shopping/flight-offers?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) console.error('[Amadeus] flights API error:', r.status, JSON.stringify(data).slice(0, 300));
        res.status(r.status).json(data);
    } catch (err) {
        console.error('[Amadeus] flights error:', err.message);
        res.status(500).json({ errors: [{ detail: err.message }] });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`Servidor FlyWise Backend rodando na porta ${PORT}`);
    console.log(`POST http://localhost:${PORT}/api/search-flights`);
    console.log(`GET  http://localhost:${PORT}/api/amadeus/airports`);
    console.log(`GET  http://localhost:${PORT}/api/amadeus/flights`);
    console.log(`======================================================\n`);
});
