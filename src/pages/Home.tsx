import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { searchFlights } from '@/lib/amadeus'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/Header'
import { AirportInput } from '@/components/AirportInput'
import type { Busca } from '@/lib/supabase'

const STEPS_LIST = ['Salvando busca...', 'Consultando Amadeus...', 'Calculando estratégias...']

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
    const [step, setStep] = useState(-1)
    const [error, setError] = useState('')
    const [recentSearches, setRecentSearches] = useState<Busca[]>([])

    const { user } = useAuth()
    const navigate = useNavigate()
    const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    useEffect(() => () => { stepTimers.current.forEach(clearTimeout) }, [])

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
        if (!originCode || !destCode) return setError('Selecione origem e destino.')
        if (originCode.length !== 3) return setError('Código de origem inválido (ex: GRU).')
        if (destCode.length !== 3) return setError('Código de destino inválido (ex: JFK).')
        if (!dateGo) return setError('Informe a data de ida.')
        if (!user) return setError('Faça login para buscar voos.')
        setLoading(true); setStep(0)
        stepTimers.current.push(setTimeout(() => setStep(1), 900))
        stepTimers.current.push(setTimeout(() => setStep(2), 2400))
        try {
            const { data: buscaData, error: buscaErr } = await supabase.from('buscas').insert({
                user_id: user.id,
                origem: originCode,
                destino: destCode,
                data_ida: dateGo,
                passageiros: pax,
                bagagem: 'sem_bagagem',
                user_miles: {},
            }).select().single()
            if (buscaErr) throw buscaErr

            // Real Amadeus API call
            const offers = await searchFlights({
                origin: originCode,
                destination: destCode,
                departureDate: dateGo,
                adults: pax,
                max: 20,
                returnDate: tripType === 'round-trip' && dateBack ? dateBack : undefined,
            })

            const voosToInsert = offers.map(o => ({
                busca_id: buscaData.id,
                user_id: user.id,
                provider: o.provider,
                companhia: o.companhia,
                preco_brl: o.preco_brl,
                preco_milhas: null,
                taxas_brl: o.taxas_brl,
                cpm: null,
                partida: o.partida,
                chegada: o.chegada,
                origem: o.origem,
                destino: o.destino,
                duracao_min: o.duracao_min,
                cabin_class: o.cabin_class,
                flight_key: o.flight_key,
                estrategia_disponivel: true,
                moeda: 'BRL',
                segmentos: o.segmentos,
                detalhes: { paradas: o.paradas, voo_numero: o.voo_numero, carrierCode: o.carrierCode },
            }))

            if (voosToInsert.length > 0) {
                await supabase.from('resultados_voos').insert(voosToInsert)
            }

            setStep(3)
            await new Promise(r => setTimeout(r, 300))
            navigate(`/resultados?buscaId=${buscaData.id}`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar.')
            setLoading(false); setStep(-1)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Manrope, system-ui, sans-serif' }}>
            <Header variant="app" />

            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center',
                padding: '40px 24px', width: '100%', maxWidth: '840px', margin: '0 auto'
            }}>
                {/* Main Search Widget */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="card"
                    style={{ width: '100%', padding: '32px', borderRadius: '24px', boxShadow: '0 12px 48px rgba(14,42,85,0.08)' }}
                >
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                        {/* Inputs Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: tripType === 'round-trip' ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}>
                            {/* Origin */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff', overflow: 'visible', position: 'relative' }}>
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
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff', overflow: 'visible', position: 'relative' }}>
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
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Ida</label>
                                <input
                                    type="date" value={dateGo} onChange={e => setDateGo(e.target.value)} min={new Date().toISOString().split('T')[0]}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontWeight: 500, color: 'var(--text-dark)', cursor: 'pointer' }}
                                />
                            </div>
                            {/* Return date */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff', opacity: tripType === 'one-way' ? 0.45 : 1 }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Volta</label>
                                <input
                                    type="date" value={dateBack} onChange={e => setDateBack(e.target.value)}
                                    min={dateGo || new Date().toISOString().split('T')[0]}
                                    disabled={tripType === 'one-way'}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontWeight: 500, color: 'var(--text-dark)', cursor: tripType === 'one-way' ? 'not-allowed' : 'pointer' }}
                                />
                            </div>
                            {/* Passengers */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Passageiros</label>
                                <select
                                    value={pax} onChange={e => setPax(Number(e.target.value))}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontWeight: 500, color: 'var(--text-dark)', cursor: 'pointer' }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Passageiro' : 'Passageiros'}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button type="submit" disabled={loading} className="btn" style={{
                            width: '100%', padding: '16px', borderRadius: '14px',
                            background: 'var(--blue-medium)', color: '#fff',
                            fontSize: '16px', fontWeight: 700, letterSpacing: '0.02em',
                            boxShadow: '0 8px 24px rgba(74,144,226,0.3)',
                            opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s'
                        }}>
                            {loading ? <><Loader2 size={18} className="spin" /> Buscando voos...</> : 'Buscar Voos'}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/busca-avancada')}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '14px',
                                background: 'transparent', color: 'var(--blue-medium)',
                                border: '2px solid var(--blue-medium)',
                                fontSize: '16px', fontWeight: 700, letterSpacing: '0.02em',
                                cursor: 'pointer', transition: 'all 0.2s', marginTop: '-8px'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.05)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                            ✨ Busca Inteligente
                        </button>

                        {error && <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', margin: 0 }}>{error}</p>}

                        {/* Loading Steps */}
                        <AnimatePresence>
                            {loading && step >= 0 && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '4px', flexWrap: 'wrap' }}>
                                    {STEPS_LIST.map((s, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: i <= step ? 1 : 0.4 }}>
                                            {i < step ? <CheckCircle size={14} color="var(--green-strat)" /> : i === step ? <Loader2 size={14} color="var(--blue-medium)" className="spin" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--border-mid)' }} />}
                                            <span style={{ fontSize: '12.5px', color: i <= step ? 'var(--text-dark)' : 'var(--text-muted)', fontWeight: i === step ? 600 : 500 }}>{s}</span>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </motion.div>

                {/* Recent AI Insights */}
                {recentSearches.length > 0 && (
                    <div style={{ width: '100%', marginTop: '32px' }}>
                        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '20px' }}>
                            {recentSearches.map((busca, i) => (
                                <motion.div key={busca.id}
                                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + (i * 0.1) }}
                                    onClick={() => navigate(`/resultados?buscaId=${busca.id}`)}
                                    style={{
                                        flex: '1', minWidth: '220px',
                                        background: '#fff', border: '1px solid var(--border-light)', borderRadius: '16px',
                                        padding: '16px 20px', cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(14,42,85,0.04)',
                                        transition: 'transform 0.2s, box-shadow 0.2s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(14,42,85,0.08)' }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,42,85,0.04)' }}
                                >
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Análise Recente</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '0.02em' }}>{busca.origem}</span>
                                        <Plane size={14} color="var(--blue-medium)" />
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '0.02em' }}>{busca.destino}</span>
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
            </main>
        </div>
    )
}
