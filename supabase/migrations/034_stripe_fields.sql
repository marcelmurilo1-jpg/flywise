-- Stripe integration: campos de assinatura recorrente
-- payment_provider distingue entre 'stripe' (cartão) e 'abacatepay' (PIX)
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_provider TEXT
        CHECK (payment_provider IS NULL OR payment_provider IN ('stripe', 'abacatepay'));

CREATE INDEX IF NOT EXISTS user_profiles_stripe_customer_id_idx
    ON user_profiles(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_profiles_stripe_subscription_id_idx
    ON user_profiles(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;
