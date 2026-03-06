-- Tabela para armazenar temporariamente as buscas do Seats.aero
CREATE TABLE IF NOT EXISTS public.seatsaero_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    origem TEXT NOT NULL,
    destino TEXT NOT NULL,
    dados JSONB NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.seatsaero_searches ENABLE ROW LEVEL SECURITY;

-- Política de Leitura Pública
CREATE POLICY "Leitura pública de buscas Seats.aero"
    ON public.seatsaero_searches
    FOR SELECT
    USING (true);

-- Política de Inserção Pública (Anon/Autenticado dependendo da regra da aplicação, deixado livre para Inserção no lado do Servidor/Service_role ou Auth)
CREATE POLICY "Permitir inserção de buscas"
    ON public.seatsaero_searches
    FOR INSERT
    WITH CHECK (true);

-- Política de Deleção (Usada pelo script do Node para limpar cache TTL)
CREATE POLICY "Permitir exclusão de buscas"
    ON public.seatsaero_searches
    FOR DELETE
    USING (true);

-- Índice para a exclusão rápida (TTL) baseado na data de criação
CREATE INDEX IF NOT EXISTS idx_seatsaero_searches_criado_em 
    ON public.seatsaero_searches(criado_em);

-- Índice de busca por rota (origem + destino)
CREATE INDEX IF NOT EXISTS idx_seatsaero_searches_rota
    ON public.seatsaero_searches(origem, destino);
