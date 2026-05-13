import { useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '@/lib/api'

const REASONS = [
    'Preço muito alto',
    'Não uso o suficiente',
    'Prefiro outra ferramenta',
    'Falta de funcionalidades',
    'Outro motivo',
]

const DOWNGRADE_MAP: Record<string, { name: string; price: string }> = {
    elite: { name: 'Pro',       price: 'R$ 49' },
    pro:   { name: 'Essencial', price: 'R$ 19' },
}

interface Props {
    isOpen: boolean
    onClose: () => void
    currentPlan: string
    planExpiresAt: string | null
    onCancelled: () => void
}

export default function CancelPlanModal({ isOpen, onClose, currentPlan, planExpiresAt, onCancelled }: Props) {
    const navigate = useNavigate()
    const [step, setStep]               = useState<1 | 2>(1)
    const [reason, setReason]           = useState('')
    const [reasonDetail, setReasonDetail] = useState('')
    const [loading, setLoading]         = useState(false)
    const [error, setError]             = useState<string | null>(null)

    if (!isOpen) return null

    const planKey       = currentPlan.toLowerCase()
    const downgradeOpt  = DOWNGRADE_MAP[planKey] ?? null
    const showDowngrade = reason === 'Preço muito alto' && downgradeOpt !== null

    const expiresLabel = planExpiresAt
        ? new Date(planExpiresAt).toLocaleDateString('pt-BR')
        : null

    function close() {
        setStep(1); setReason(''); setReasonDetail(''); setError(null)
        onClose()
    }

    function handleNext() {
        if (!reason) return
        setStep(2)
    }

    async function handleConfirm() {
        setLoading(true); setError(null)
        try {
            const res = await fetch(apiUrl('/api/user/cancel-plan'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, reasonDetail: reasonDetail || undefined }),
            })
            const data = await res.json()
            if (!res.ok || data.error) throw new Error(data.error || 'Erro ao cancelar plano')
            onCancelled()
            close()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const overlayStyle: React.CSSProperties = {
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }

    const boxStyle: React.CSSProperties = {
        background: '#fff', borderRadius: 20, padding: '32px 28px',
        maxWidth: 440, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
    }

    const btnPrimary: React.CSSProperties = {
        width: '100%', padding: 12, borderRadius: 10, border: 'none',
        fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    }

    return (
        <div style={overlayStyle} onClick={close}>
            <div style={boxStyle} onClick={e => e.stopPropagation()}>

                <button onClick={close} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                    <X size={18} />
                </button>

                {/* ── STEP 1: Reason ── */}
                {step === 1 && (
                    <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>😢</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', marginBottom: 6 }}>Sentiremos sua falta</div>
                        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>O que está te fazendo cancelar?</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            {REASONS.map(r => (
                                <label key={r} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px',
                                    border: `1.5px solid ${reason === r ? '#0E2A55' : '#E2EAF5'}`,
                                    borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#374151',
                                    background: reason === r ? '#F0F4FA' : '#fff', transition: 'all .15s',
                                }}>
                                    <input type="radio" name="cancel-reason" checked={reason === r}
                                        onChange={() => setReason(r)} style={{ accentColor: '#0E2A55' }} />
                                    {r}
                                </label>
                            ))}
                        </div>

                        {reason === 'Outro motivo' && (
                            <textarea
                                value={reasonDetail} onChange={e => setReasonDetail(e.target.value)}
                                placeholder="Nos conte mais..."
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: 10,
                                    border: '1.5px solid #E2EAF5', fontSize: 13, color: '#374151',
                                    fontFamily: 'inherit', resize: 'vertical', minHeight: 72,
                                    marginBottom: 12, boxSizing: 'border-box',
                                }}
                            />
                        )}

                        <button onClick={handleNext} disabled={!reason} style={{
                            ...btnPrimary,
                            background: reason ? '#0E2A55' : '#E2EAF5',
                            color: reason ? '#fff' : '#94A3B8',
                            cursor: reason ? 'pointer' : 'not-allowed',
                        }}>
                            Próximo →
                        </button>
                    </>
                )}

                {/* ── STEP 2a: Retention offer (downgrade available) ── */}
                {step === 2 && showDowngrade && (
                    <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>💡</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', marginBottom: 6 }}>Que tal um plano menor?</div>
                        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                            Em vez de cancelar, faça downgrade para o <strong>{downgradeOpt!.name}</strong> por apenas{' '}
                            <strong>{downgradeOpt!.price}/mês</strong> e continue aproveitando o FlyWise.
                        </div>

                        <button onClick={() => { close(); navigate('/planos') }} style={{
                            ...btnPrimary, marginBottom: 10,
                            background: 'linear-gradient(135deg,#2A60C2,#7C3AED)', color: '#fff',
                        }}>
                            Ver plano {downgradeOpt!.name} →
                        </button>

                        {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}

                        <button onClick={handleConfirm} disabled={loading} style={{
                            ...btnPrimary,
                            border: '1.5px solid #FECACA', background: '#FEF2F2',
                            color: '#DC2626', fontSize: 13, fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}>
                            {loading ? 'Cancelando...' : 'Cancelar mesmo assim'}
                        </button>
                    </>
                )}

                {/* ── STEP 2b: Direct confirmation ── */}
                {step === 2 && !showDowngrade && (
                    <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', marginBottom: 6 }}>Tem certeza?</div>
                        {expiresLabel && (
                            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                                Seu acesso continua até <strong>{expiresLabel}</strong>. Após essa data você perderá os recursos premium.
                            </div>
                        )}

                        {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={close} style={{
                                flex: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
                                border: '1.5px solid #E2EAF5', background: '#fff',
                                color: '#64748B', cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                Manter plano
                            </button>
                            <button onClick={handleConfirm} disabled={loading} style={{
                                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                                background: loading ? '#94A3B8' : '#DC2626', color: '#fff',
                                fontSize: 13, fontWeight: 700,
                                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            }}>
                                {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    )
}
