-- Remove campos específicos de Stripe + AbacatePay do user_profiles.
-- Esses gateways foram removidos do código (ver routes/payments.js que
-- segura o stub do próximo provider). Quando a próxima gateway exigir
-- guardar customer_id/subscription_id, criar uma migration nova com nomes
-- genéricos (ex: payment_customer_id, payment_subscription_id).

DROP INDEX IF EXISTS user_profiles_stripe_customer_id_idx;
DROP INDEX IF EXISTS user_profiles_stripe_subscription_id_idx;

ALTER TABLE user_profiles
    DROP COLUMN IF EXISTS stripe_customer_id,
    DROP COLUMN IF EXISTS stripe_subscription_id,
    DROP COLUMN IF EXISTS payment_provider;
