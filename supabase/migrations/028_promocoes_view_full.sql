-- 028_promocoes_view_full.sql
-- Recria vw_promocoes_ativas explicitando todas as colunas atuais da tabela.
-- A view original (migration 002) usou SELECT * antes da adição de
-- categoria/subcategoria/programas_tags/preco_clube/bonus_pct, e Postgres
-- congela o "*" no momento da criação — por isso a view não expunha esses
-- campos para o frontend.

DROP VIEW IF EXISTS vw_promocoes_ativas;

CREATE VIEW vw_promocoes_ativas AS
SELECT
    id,
    titulo,
    conteudo,
    url,
    fonte,
    valid_until,
    categoria,
    subcategoria,
    programas_tags,
    bonus_pct,
    preco_clube,
    notificado_em,
    created_at,
    updated_at
FROM promocoes
WHERE valid_until IS NULL OR valid_until > NOW();

COMMENT ON VIEW vw_promocoes_ativas IS
    'Promoções ativas (não expiradas). Recriada em 028 para incluir todas as colunas da tabela.';
