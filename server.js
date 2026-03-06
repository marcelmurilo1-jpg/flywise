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
        console.log(`[Express] Iniciando raspagem remota para: ${origem} -> ${destino} (Ida: ${data_ida}${data_volta ? `, Volta: ${data_volta}` : ''})`);

        // Promessas de busca
        const promessas = [];

        // Busca de IDA
        promessas.push(buscarVoosSeatsAero(origem, destino, data_ida));

        // Busca de VOLTA (se houver)
        if (data_volta) {
            promessas.push(buscarVoosSeatsAero(destino, origem, data_volta));
        }

        // Aguarda todas as buscas terminarem em paralelo
        const resultadosArray = await Promise.all(promessas);

        // Se houver erro de conta não-Pro em qualquer uma das buscas
        for (const res of resultadosArray) {
            if (res.error === "NOT_PRO_ACCOUNT") {
                return res.status(401).json({ error: "Sessão não-Pro detectada. Atualize o arquivo cookies.json." });
            }
        }

        // Achata os resultados em um único array (ou você pode querer separar ida e volta no JSON)
        // Por enquanto vamos amontoar tudo ou rotular
        const resultadosIda = resultadosArray[0] || [];
        const resultadosVolta = resultadosArray[1] || [];

        const resultadosFinais = [
            ...resultadosIda.map(v => ({ ...v, tipo: 'ida' })),
            ...resultadosVolta.map(v => ({ ...v, tipo: 'volta' }))
        ];

        // Se temos banco configurado, injeta dados com controle TTL
        if (supabase) {
            console.log('[Express] Gerenciamento de TTL Supabase: Excluindo cache anterior a 10 minutos...');

            // Define a data limite do TTL
            const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();

            // Exclui os registros velhos (Limpeza automática)
            const { error: errorDelete } = await supabase
                .from('seatsaero_searches')
                .delete()
                .lt('criado_em', dezMinutosAtras);

            if (errorDelete) {
                console.warn('[Express] Falha ao excluir cache TTL:', errorDelete.message);
            }

            console.log(`[Express] Salvando ${resultadosFinais.length} novos voos encontrados no banco de dados temporário...`);
            // Salva a nova busca
            const { error: errorInsert } = await supabase
                .from('seatsaero_searches')
                .insert([{
                    origem: origem.toUpperCase(),
                    destino: destino.toUpperCase(),
                    dados: resultadosFinais // Salvando o banco JSON na constraint JSONB
                }]);

            if (errorInsert) {
                console.error('[Express] Erro ao salvar busca no Supabase:', errorInsert.message);
            } else {
                console.log('[Express] ✅ Resultados gravados no Supabase com sucesso!');
            }
        }

        // Retorna os dados capturados para o frontend
        res.json({ origem, destino, total: resultadosFinais.length, voos: resultadosFinais });

    } catch (err) {
        console.error(`[Express] Erro não mapeado na Rota:`, err);
        res.status(500).json({ error: 'Erro interno no servidor ao raspar voos do Seats.aero' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor FlyWise Backend rodando na porta ${PORT}`);
    console.log(`🔗 Endpoint de Raspagem Ativo: POST http://localhost:${PORT}/api/search-flights`);
    console.log(`======================================================\n`);
});
