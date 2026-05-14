// ─── PaymentProvider (frontend) ──────────────────────────────────────────────
//
// Stub do client que conversa com a gateway de pagamento. Os endpoints
// /api/payments/* respondem 503 enquanto nenhum provider concreto estiver
// plugado em routes/payments.js. Use estas funções a partir das telas de
// checkout para garantir que a UI já fala com o contrato final.

import { apiUrl } from './api'

export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'

export interface CheckoutInput {
    userId: string
    plan: 'essencial' | 'pro' | 'elite'
    billing: 'mensal' | 'anual'
    amountCents: number
    customer: {
        name: string
        email: string
        taxId?: string
        phone?: string
    }
    metadata?: Record<string, unknown>
}

export interface CheckoutResult {
    id: string
    status: PaymentStatus
    /** Token usado pelo SDK do gateway (Stripe-style clientSecret, etc) */
    clientSecret?: string
    /** Código PIX (BR Code) — quando o método for PIX */
    pixCode?: string
    /** Imagem do QR Code em base64 — opcional, depende do gateway */
    qrCodeImg?: string
    /** ISO date — quando o checkout expira (PIX/boleto) */
    expiresAt?: string
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(apiUrl('/api/payments/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? 'Falha ao iniciar pagamento')
    return data as CheckoutResult
}

export async function getCheckoutStatus(id: string): Promise<{ id: string; status: PaymentStatus }> {
    const res = await fetch(apiUrl(`/api/payments/status/${encodeURIComponent(id)}`))
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? 'Falha ao consultar status')
    return data
}

export async function activatePlan(checkoutId: string, userId: string): Promise<{ ok: boolean }> {
    const res = await fetch(apiUrl('/api/payments/activate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId, userId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? 'Falha ao ativar plano')
    return data
}
