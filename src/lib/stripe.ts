import { loadStripe, type Stripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
    if (!publishableKey) {
        console.error('[Stripe] VITE_STRIPE_PUBLISHABLE_KEY não configurada')
        return Promise.resolve(null)
    }
    if (!stripePromise) {
        stripePromise = loadStripe(publishableKey)
    }
    return stripePromise
}
