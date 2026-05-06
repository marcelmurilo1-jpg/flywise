-- 029_promocoes_ttl_sem_validade.sql
-- Promoções sem valid_until ficam visíveis apenas por 10 dias a partir da criação.
-- Antes: valid_until IS NULL ficava ativo para sempre.

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
WHERE
    valid_until > NOW()
    OR (valid_until IS NULL AND created_at > NOW() - INTERVAL '10 days');

COMMENT ON VIEW vw_promocoes_ativas IS
    'Promoções ativas: com valid_until no futuro, ou sem valid_until criadas nos últimos 10 dias.';
