import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { Header } from '@/components/Header'
import { AirportInput } from '@/components/AirportInput'
import { DateRangePicker } from '@/components/DateRangePicker'
import { NotificationSurvey } from '@/components/NotificationSurvey'
import { useNotificationSurvey } from '@/hooks/useNotificationSurvey'
import { AircraftReveal } from '@/components/AircraftReveal'
import type { Busca } from '@/lib/supabase'

export default function Home() {
    const [originLabel, setOriginLabel] = useState('')
    const [originIata, setOriginIata] = useState('')
    const [destLabel, setDestLabel] = useState('')
    const [destIata, setDestIata] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [dateBack, setDateBack] = useState('')
    const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('round-trip')
    const [pax, setPax] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [recentSearches, setRecentSearches] = useState<Busca[]>([])

    const { user } = useAuth()
    const navigate = useNavigate()
    const { shouldShow, dismiss } = useNotificationSurvey()

    useEffect(() => {
        if (!user) return
        supabase.from('buscas').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3)
            .then(({ data }) => { if (data) setRecentSearches(data) })
    }, [user])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        const originCode = originIata || originLabel.trim().toUpperCase()
        const destCode = destIata || destLabel.trim().toUpperCase()
        if (!originCode) return setError('Selecione a cidade ou aeroporto de origem.')
        if (!destCode) return setError('Selecione a cidade ou aeroporto de destino.')
        if (originCode.length !== 3) return setError('Selecione um aeroporto válido na origem.')
        if (destCode.length !== 3) return setError('Selecione um aeroporto válido no destino.')
        if (!dateGo) return setError('Informe a data de ida.')
        if (!user) return setError('Faça login para buscar voos.')
        setLoading(true)
        try {
            const insertData: Record<string, unknown> = {
                user_id: user.id,
                origem: originCode,
                destino: destCode,
                data_ida: dateGo,
                passageiros: pax,
                bagagem: 'sem_bagagem',
                user_miles: {},
            }
            if (tripType === 'round-trip' && dateBack) insertData.data_volta = dateBack
            const { data: buscaData, error: buscaErr } = await supabase
                .from('buscas').insert(insertData).select().single()
            if (buscaErr) throw buscaErr
            const retParam = tripType === 'round-trip' && dateBack ? `&ret=${dateBack}` : ''
            navigate(`/resultados?buscaId=${buscaData.id}&orig=${originCode}&dest=${destCode}&date=${dateGo}${retParam}&pax=${pax}`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar.')
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--snow)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Manrope, system-ui, sans-serif',
        }}>
            <style>{`
                @media (max-width: 768px) {
                    .fly-hero-banner { height: 260px !important; }
                    .fly-search-card { margin: -56px 16px 0 !important; padding: 20px !important; border-radius: 16px !important; }
                    .fly-search-grid { grid-template-columns: 1fr !important; }
                    .fly-search-grid > * { grid-column: 1 !important; }
                    .fly-recent-cards { flex-direction: column !important; }
                }
            `}</style>

            <Header variant="app" />

            {/* ── HERO BANNER ────────────────────────────────────────────── */}
            <div style={{ position: 'relative' }}>

                {/* Aircraft reveal — full width hero */}
                <div
                    className="fly-hero-banner"
                    style={{ height: '420px', width: '100%', display: 'block' }}
                >
                    <AircraftReveal />
                </div>

                {/* Search card — floats at the banner/content boundary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="fly-search-card"
                    style={{
                        position: 'relative',
                        margin: '-72px auto 0',
                        width: 'calc(100% - 48px)',
                        maxWidth: '860px',
                        background: '#fff',
                        borderRadius: '24px',
                        padding: '28px 32px',
                        boxShadow: '0 20px 60px rgba(14,42,85,0.18)',
                        border: '1px solid rgba(14,42,85,0.06)',
                        zIndex: 20,
                    }}
                >
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {/* Trip type */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {(['round-trip', 'one-way'] as const).map(t => (
                                <button key={t} type="button" onClick={() => setTripType(t)} style={{
                                    padding: '6px 16px', borderRadius: '999px', cursor: 'pointer',
                                    fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 700,
                                    background: tripType === t ? '#0E2A55' : '#fff',
                                    color: tripType === t ? '#fff' : 'var(--text-muted)',
                                    border: tripType === t ? '1.5px solid #0E2A55' : '1.5px solid var(--border-light)',
                                    transition: 'all 0.15s',
                                }}>
                                    {t === 'round-trip' ? '⇄ Ida e volta' : '→ Só ida'}
                                </button>
                            ))}
                        </div>

                        {/* Inputs */}
                        <div
                            className="fly-search-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: tripType === 'round-trip' ? '1fr 1fr 1fr 1fr auto' : '1fr 1fr auto auto',
                                gap: '12px',
                                alignItems: 'start',
                            }}
                        >
                            {/* Origin */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#FAFBFF', overflow: 'visible', position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Origem</label>
                                <AirportInput
                                    value={originLabel}
                                    iataCode={originIata}
                                    onChange={(label, iata) => { setOriginLabel(label); setOriginIata(iata) }}
                                    placeholder="São Paulo, GRU..."
                                    icon={<Plane size={13} color="var(--text-faint)" style={{ flexShrink: 0 }} />}
                                />
                            </div>

                            {/* Destination */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#FAFBFF', overflow: 'visible', position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Destino</label>
                                <AirportInput
                                    value={destLabel}
                                    iataCode={destIata}
                                    onChange={(label, iata) => { setDestLabel(label); setDestIata(iata) }}
                                    placeholder="Nova York, JFK..."
                                    icon={<Plane size={13} color="var(--text-faint)" style={{ transform: 'scaleX(-1)', flexShrink: 0 }} />}
                                />
                            </div>

                            {/* Dates */}
                            <div className="home-date-span" style={{ gridColumn: tripType === 'round-trip' ? 'span 2' : 'span 1' }}>
                                <DateRangePicker
                                    dateGo={dateGo}
                                    dateBack={dateBack}
                                    tripType={tripType}
                                    onDateGoChange={setDateGo}
                                    onDateBackChange={setDateBack}
                                />
                            </div>

                            {/* Passengers */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#FAFBFF' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Passageiros</label>
                                <select
                                    value={pax} onChange={e => setPax(Number(e.target.value))}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontWeight: 500, color: 'var(--text-dark)', cursor: 'pointer' }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Passageiro' : 'Passageiros'}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="submit" disabled={loading} style={{
                                flex: 1, padding: '14px', borderRadius: '12px',
                                background: 'var(--blue-medium)', color: '#fff',
                                fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em',
                                boxShadow: '0 8px 24px rgba(74,144,226,0.3)',
                                opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                                border: 'none', transition: 'all 0.2s',
                            }}>
                                {loading ? <><Loader2 size={16} className="spin" /> Buscando...</> : 'Buscar Voos'}
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/busca-avancada')}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '12px',
                                    background: 'transparent', color: 'var(--blue-medium)',
                                    border: '1.5px solid var(--blue-medium)',
                                    fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.05)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                                ✨ Busca Inteligente IA
                            </button>
                        </div>

                        {error && <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', margin: 0 }}>{error}</p>}
                    </form>
                </motion.div>
            </div>

            {/* ── WHITE CONTENT AREA ─────────────────────────────────────── */}
            <div style={{ flex: 1, padding: '48px 24px 80px' }}>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '16px' }}>Análises Recentes</p>
                        <div className="fly-recent-cards" style={{ display: 'flex', gap: '16px' }}>
                            {recentSearches.map((busca, i) => (
                                <motion.div
                                    key={busca.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.08 }}
                                    onClick={() => navigate(`/resultados?buscaId=${busca.id}`)}
                                    style={{
                                        flex: '1', minWidth: '200px',
                                        background: '#fff', border: '1px solid var(--border-light)', borderRadius: '16px',
                                        padding: '16px 20px', cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(14,42,85,0.04)',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(14,42,85,0.08)' }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,42,85,0.04)' }}
                                >
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Análise Recente</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>{busca.origem}</span>
                                        <Plane size={14} color="var(--blue-medium)" />
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>{busca.destino}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Dinheiro</p>
                                            <p style={{ fontWeight: 700, color: 'var(--text-dark)' }}>R$ —</p>
                                        </div>
                                        <div style={{ width: '1px', height: '24px', background: 'var(--border-light)' }} />
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Milhas + Taxas</p>
                                            <p style={{ fontWeight: 700, color: 'var(--blue-medium)' }}>— pts + R$ —</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {shouldShow && <NotificationSurvey onClose={dismiss} />}
        </div>
    )
}
