-- Migration: tabela de custos operacionais (acesso apenas via service_role)

CREATE TABLE admin_costs (
  id         SERIAL PRIMARY KEY,
  month      DATE        NOT NULL,   -- primeiro dia do mês (ex: 2026-03-01)
  service    TEXT        NOT NULL,   -- 'Vercel', 'Railway', 'Supabase', etc.
  category   TEXT        NOT NULL,   -- 'Infraestrutura' | 'APIs' | 'Pagamentos' | 'Marketing' | 'Outros'
  amount_brl NUMERIC(10,2) NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_costs ENABLE ROW LEVEL SECURITY;

-- Bloqueia acesso direto pelo client (anon/authenticated)
-- Todo acesso é feito via backend com service_role, que ignora RLS
CREATE POLICY "deny_direct_access" ON admin_costs
  FOR ALL USING (false);
