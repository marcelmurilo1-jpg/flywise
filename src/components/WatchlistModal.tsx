import { useState, useEffect } from 'react'
import { X, Bell, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePlan } from '@/hooks/usePlan'
import { useNavigate } from 'react-router-dom'

export interface WatchlistModalProps {
    open: boolean
    onClose: () => void
    type: 'cash' | 'miles'
    origin: string        // IATA e.g. "GRU"
    destination: string   // IATA e.g. "LIS"
    // cash
    currentPriceBrl?: number
    airline?: string
    travelDate?: string
    // miles
    currentMiles?: number
    program?: string
    cabin?: 'economy' | 'business'
}

export function WatchlistModal({
    open, onClose, type,
    origin, destination,
    currentPriceBrl, airline, travelDate,
    currentMiles, program, cabin,
}: WatchlistModalProps) {
    const { plan } = usePlan()
    const navigate = useNavigate()
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

    const [thresholdBrl, setThresholdBrl] = useState(currentPriceBrl ?? 0)
    const [thresholdMiles, setThresholdMiles] = useState(currentMiles ?? 0)
    const [selectedAirline, setSelectedAirline] = useState<string | null>(airline ?? null)
    const [slotsUsed, setSlotsUsed] = useState(0)
    const [slotsLimit, setSlotsLimit] = useState(0)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')

    const isFree = plan === 'free'

    useEffect(() => {
        if (!open) return
        setSaved(false)
        setError('')
        setThresholdBrl(currentPriceBrl ?? 0)
        setThresholdMiles(currentMiles ?? 0)
        setSelectedAirline(airline ?? null)
        // Fetch current usage
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            fetch(`${apiBase}/api/watchlist`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            })
                .then(r => r.json())
                .then(d => { setSlotsUsed(d.used ?? 0); setSlotsLimit(d.limit ?? 0) })
                .catch(() => {})
        })
    }, [open])

    if (!open) return null

    async function save() {
        setSaving(true)
        setError('')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Não autenticado')

            const body: Record<string, unknown> = {
                type,
                origin,
                destination,
                channel: 'email',
            }
            if (type === 'cash') {
                body.threshold_brl = thresholdBrl
                body.airline = selectedAirline ?? null
                body.travel_date = travelDate ?? null
            } else {
                body.threshold_miles = thresholdMiles
                body.program = program ?? null
                body.cabin = cabin ?? 'economy'
            }

            const res = await fetch(`${apiBase}/api/watchlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const d = await res.json()
                throw new Error(d.error ?? `Erro ${res.status}`)
            }
            setSaved(true)
            setTimeout(onClose, 1500)
        } catch (e: unknown) {
            setError((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    const slotsLeft = slotsLimit - slotsUsed

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(14,42,85,0.45)', zIndex: 999, backdropFilter: 'blur(2px)' }}
            />
            {/* Modal */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 1000, width: '100%', maxWidth: 380, borderRadius: 16,
                overflow: 'hidden', boxShadow: '0 20px 80px rgba(14,42,85,0.20)',
            }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#0E2A55,#2A60C2)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Bell size={18} color="#fff" />
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>
                            {type === 'cash' ? 'Monitorar preço' : 'Monitorar milhas'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {slotsLimit > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 9px' }}>
                                {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} restante{slotsLeft !== 1 ? 's' : ''}
                            </span>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 0 }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ background: '#fff', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {isFree ? (
                        /* Free plan teaser */
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <Lock size={28} style={{ color: '#C0CFEA', margin: '0 auto 10px', display: 'block' }} />
                            <p style={{ fontWeight: 700, color: '#0E2A55', fontSize: 14, marginBottom: 6 }}>Watchlist disponível a partir do plano Essencial</p>
                            <p style={{ fontSize: 13, color: '#6B7A99', marginBottom: 16 }}>Monitore até 3 rotas e receba alertas por email quando o preço cair.</p>
                            <button
                                onClick={() => { onClose(); navigate('/planos') }}
                                style={{ background: 'linear-gradient(135deg,#2A60C2,#1A4A9C)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                            >
                                Ver planos →
                            </button>
                        </div>
                    ) : saved ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                            <p style={{ fontWeight: 800, color: '#0E2A55', fontSize: 15 }}>Alerta salvo!</p>
                            <p style={{ fontSize: 13, color: '#6B7A99', marginTop: 4 }}>Vamos te avisar por email quando o preço cair.</p>
                        </div>
                    ) : (
                        <>
                            {/* Route info */}
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55' }}>{origin} → {destination}</div>
                                <div style={{ fontSize: 12, color: '#6B7A99', fontWeight: 600, marginTop: 2 }}>
                                    {type === 'cash'
                                        ? `${airline ?? 'Qualquer companhia'}${travelDate ? ` · ${travelDate}` : ''}`
                                        : `${program ?? ''} · ${cabin === 'business' ? 'Business' : 'Economy'}`
                                    }
                                </div>
                            </div>

                            {/* Threshold */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                    Avisar quando baixar de
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {type === 'cash' && <span style={{ fontWeight: 800, color: '#0E2A55', fontSize: 15 }}>R$</span>}
                                    <input
                                        type="number"
                                        value={type === 'cash' ? thresholdBrl : thresholdMiles}
                                        onChange={e => {
                                            const v = parseInt(e.target.value) || 0
                                            type === 'cash' ? setThresholdBrl(v) : setThresholdMiles(v)
                                        }}
                                        style={{ width: 120, padding: '9px 12px', border: '1.5px solid #E2EAF5', borderRadius: 10, fontSize: 16, fontWeight: 800, color: '#0E2A55', fontFamily: 'inherit', background: '#F7F9FC' }}
                                    />
                                    {type === 'miles' && <span style={{ fontSize: 13, color: '#6B7A99', fontWeight: 600 }}>milhas</span>}
                                    <span style={{ fontSize: 11, color: '#A0AECB', fontWeight: 600 }}>
                                        atual: {type === 'cash' ? `R$ ${(currentPriceBrl ?? 0).toLocaleString('pt-BR')}` : `${(currentMiles ?? 0).toLocaleString('pt-BR')} mi`}
                                    </span>
                                </div>
                            </div>

                            {/* Airline selector (cash only) */}
                            {type === 'cash' && airline && (
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Companhia</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {[airline, null].map(opt => (
                                            <button
                                                key={opt ?? 'any'}
                                                onClick={() => setSelectedAirline(opt)}
                                                style={{
                                                    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                                    border: 'none', cursor: 'pointer',
                                                    background: selectedAirline === opt ? '#0E2A55' : '#EEF2F8',
                                                    color: selectedAirline === opt ? '#fff' : '#6B7A99',
                                                }}
                                            >
                                                {opt ?? 'Qualquer'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Channel */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notificar por</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: '1.5px solid #2A60C2', background: '#EEF6FF', color: '#2A60C2', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>✉️ Email</div>
                                    <div style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: '1.5px solid #E2EAF5', background: '#F7F9FC', color: '#C0CFEA', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>💬 WhatsApp<br /><span style={{ fontSize: 10 }}>em breve</span></div>
                                </div>
                            </div>

                            {/* Error */}
                            {error && <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</div>}

                            {/* Save button */}
                            <button
                                onClick={save}
                                disabled={saving || slotsLeft <= 0}
                                style={{
                                    width: '100%', padding: '13px', background: slotsLeft <= 0 ? '#C0CFEA' : 'linear-gradient(135deg,#2A60C2,#1A4A9C)',
                                    color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800,
                                    cursor: saving || slotsLeft <= 0 ? 'not-allowed' : 'pointer',
                                    boxShadow: slotsLeft <= 0 ? 'none' : '0 4px 20px rgba(42,96,194,0.30)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {saving ? 'Salvando...' : slotsLeft <= 0 ? 'Limite atingido' : 'Salvar alerta'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
