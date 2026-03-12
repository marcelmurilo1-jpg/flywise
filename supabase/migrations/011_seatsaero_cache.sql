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
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seatsaero_searches'
      AND policyname = 'Leitura pública de buscas Seats.aero'
  ) THEN
    CREATE POLICY "Leitura pública de buscas Seats.aero"
      ON public.seatsaero_searches FOR SELECT USING (true);
  END IF;
END $$;

-- Política de Inserção Pública
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seatsaero_searches'
      AND policyname = 'Permitir inserção de buscas'
  ) THEN
    CREATE POLICY "Permitir inserção de buscas"
      ON public.seatsaero_searches FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Política de Deleção
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seatsaero_searches'
      AND policyname = 'Permitir exclusão de buscas'
  ) THEN
    CREATE POLICY "Permitir exclusão de buscas"
      ON public.seatsaero_searches FOR DELETE USING (true);
  END IF;
END $$;

-- Índice para a exclusão rápida (TTL) baseado na data de criação
CREATE INDEX IF NOT EXISTS idx_seatsaero_searches_criado_em 
    ON public.seatsaero_searches(criado_em);

-- Índice de busca por rota (origem + destino)
CREATE INDEX IF NOT EXISTS idx_seatsaero_searches_rota
    ON public.seatsaero_searches(origem, destino);
