import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plane, Loader2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateMockFlights } from '@/lib/mockFlights'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/Header'
import { GlobeBackground } from '@/components/GlobeBackground'
import type { Busca } from '@/lib/supabase'

const STEPS_LIST = ['Salvando busca...', 'Gerando cenários...', 'Calculando estratégias...']

// Recent Insights Card - shows past searches
function InsightCard({ busca }: { busca: Busca }) {
    const navigate = useNavigate()
    const airlines = [
        { name: 'LATAM', color: '#DC2626', path: 'M4 4h16l-2 8H6L4 4z' },
        { name: 'GOL', color: '#EA580C', path: 'M12 2L2 7v10l10 5 10-5V7z' },
        { name: 'Azul', color: '#1D4ED8', path: 'M2 12l10-8 10 8-10 8z' },
    ]
    const airline = airlines[Math.floor(Math.random() * airlines.length)]

    return (
        <motion.div
            whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
            onClick={() => navigate(`/resultados?buscaId=${busca.id}`)}
            className="card"
            style={{ padding: '18px 20px', cursor: 'pointer', minWidth: '200px', flex: '1' }}
        >
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Recent AI Insights
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={airline.color}>
                    <path d={airline.path} />
                </svg>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {busca.origem} → {busca.destino}
                </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Cash:</p>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>R$ —</p>
                </div>
                <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Miles +</p>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-start)' }}>Tax: — + —</p>
                </div>
            </div>
        </motion.div>
    )
}

export default function Home() {
    // Search state
    const [origin, setOrigin] = useState('')
    const [dest, setDest] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [pax, setPax] = useState(1)
    const [aiEnabled, setAiEnabled] = useState(true)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [dateBack, setDateBack] = useState('')
    const [baggage, setBaggage] = useState('sem_bagagem')
    const [miles, setMiles] = useState({ smiles: '', latam: '', azul: '' })

    // UI state
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(-1)
    const [error, setError] = useState('')
    const [recentSearches, setRecentSearches] = useState<Busca[]>([])

    const { user } = useAuth()
    const navigate = useNavigate()
    const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    useEffect(() => () => { stepTimers.current.forEach(clearTimeout) }, [])

    // Load recent searches
    useEffect(() => {
        if (!user) return
        supabase
            .from('buscas').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3)
            .then(({ data }) => { if (data) setRecentSearches(data) })
    }, [user])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!origin.trim() || !dest.trim()) return setError('Preencha origem e destino.')
        if (!dateGo) return setError('Informe a data de ida.')
        if (!user) return setError('Faça login para buscar voos.')
        setLoading(true); setStep(0)
        stepTimers.current.push(setTimeout(() => setStep(1), 900))
        stepTimers.current.push(setTimeout(() => setStep(2), 1800))
        try {
            const userMiles: Record<string, number> = {}
            if (miles.smiles) userMiles.smiles = Number(miles.smiles)
            if (miles.latam) userMiles.latam = Number(miles.latam)
            if (miles.azul) userMiles.azul = Number(miles.azul)

            const { data: buscaData, error: buscaErr } = await supabase.from('buscas').insert({
                user_id: user.id, origem: origin.toUpperCase(), destino: dest.toUpperCase(),
                data_ida: dateGo, data_volta: dateBack || null, passageiros: pax,
                bagagem: baggage, user_miles: userMiles,
            }).select().single()
            if (buscaErr) throw buscaErr

            const mocks = generateMockFlights(origin.toUpperCase(), dest.toUpperCase(), dateGo, pax, userMiles)
            const voosToInsert = mocks.map(m => ({ ...m, busca_id: buscaData.id, user_id: user.id }))
            const { error: voosErr } = await supabase.from('resultados_voos').insert(voosToInsert)
            if (voosErr) throw voosErr

            await new Promise(r => setTimeout(r, 600))
            setStep(3)
            await new Promise(r => setTimeout(r, 300))
            navigate(`/resultados?buscaId=${buscaData.id}`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar.')
            setLoading(false); setStep(-1)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f2f4f8', position: 'relative', overflow: 'hidden' }}>
            <Header variant="app" />

            {/* Globe background */}
            <GlobeBackground />

            {/* Main content */}
            <div style={{
                position: 'relative', zIndex: 1,
                maxWidth: '900px', margin: '0 auto',
                padding: '56px 24px 80px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px',
            }}>

                {/* Search card */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                        width: '100%', maxWidth: '760px',
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.8)',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.09)',
                        overflow: 'hidden',
                    }}
                >
                    <form onSubmit={handleSubmit}>
                        {/* Main inputs row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 1fr', borderBottom: '1px solid var(--border-faint)' }}>
                            {/* Origin */}
                            <div style={{ padding: '20px 20px 16px', borderRight: '1px solid var(--border-faint)' }}>
                                <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>Origem</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plane size={14} color="var(--text-faint)" />
                                    <input
                                        type="text" placeholder="Origin" value={origin} maxLength={3}
                                        onChange={e => setOrigin(e.target.value.toUpperCase())}
                                        style={{ border: 'none', outline: 'none', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit', letterSpacing: '0.05em' }}
                                    />
                                </div>
                            </div>

                            {/* Destination */}
                            <div style={{ padding: '20px 20px 16px', borderRight: '1px solid var(--border-faint)' }}>
                                <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>Destino</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plane size={14} color="var(--text-faint)" style={{ transform: 'scaleX(-1)' }} />
                                    <input
                                        type="text" placeholder="Destination" value={dest} maxLength={3}
                                        onChange={e => setDest(e.target.value.toUpperCase())}
                                        style={{ border: 'none', outline: 'none', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit', letterSpacing: '0.05em' }}
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div style={{ padding: '20px 20px 16px', borderRight: '1px solid var(--border-faint)' }}>
                                <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>Datas</label>
                                <input
                                    type="date" value={dateGo} onChange={e => setDateGo(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: dateGo ? 'var(--text-primary)' : 'var(--text-faint)', background: 'transparent', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }}
                                />
                            </div>

                            {/* Passengers */}
                            <div style={{ padding: '20px 20px 16px' }}>
                                <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>Passageiros</label>
                                <select
                                    value={pax} onChange={e => setPax(Number(e.target.value))}
                                    style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'adulto' : 'adultos'}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Bottom: AI toggle + advanced + submit */}
                        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* AI Miles toggle + advanced */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    {/* Toggle switch */}
                                    <div
                                        onClick={() => setAiEnabled(!aiEnabled)}
                                        style={{
                                            width: '44px', height: '24px', borderRadius: '12px',
                                            background: aiEnabled ? 'var(--gradient-accent)' : 'var(--border-medium)',
                                            position: 'relative', transition: 'background 0.2s ease', cursor: 'pointer',
                                            boxShadow: aiEnabled ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                                        }}
                                    >
                                        <div style={{
                                            position: 'absolute', top: '3px',
                                            left: aiEnabled ? '23px' : '3px',
                                            width: '18px', height: '18px', borderRadius: '50%',
                                            background: '#fff', transition: 'left 0.2s ease',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                                        }} />
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        AI Miles Strategy: <span style={{ color: aiEnabled ? 'var(--accent-start)' : 'var(--text-faint)' }}>{aiEnabled ? 'ON' : 'OFF'}</span>
                                    </span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'inherit', padding: '4px 0' }}
                                >
                                    {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    Opções avançadas
                                </button>
                            </div>

                            {/* Advanced options */}
                            <AnimatePresence>
                                {showAdvanced && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', paddingTop: '8px', paddingBottom: '4px', borderTop: '1px solid var(--border-faint)' }}>
                                            <div>
                                                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>Volta</label>
                                                <input type="date" value={dateBack} onChange={e => setDateBack(e.target.value)} min={dateGo}
                                                    style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>Bagagem</label>
                                                <select value={baggage} onChange={e => setBaggage(e.target.value)}
                                                    style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit' }}>
                                                    <option value="sem_bagagem">Sem bagagem</option>
                                                    <option value="bagagem_mao">Só mão</option>
                                                    <option value="1_bagagem">1 despachada</option>
                                                </select>
                                            </div>
                                            {[['smiles', 'Smiles'], ['latam', 'LATAM Pass'], ['azul', 'TudoAzul']].map(([k, label]) => (
                                                <div key={k}>
                                                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>{label}</label>
                                                    <input type="number" placeholder="Saldo" min="0" value={miles[k as keyof typeof miles]}
                                                        onChange={e => setMiles(prev => ({ ...prev, [k]: e.target.value }))}
                                                        style={{ border: 'none', borderBottom: '1px solid var(--border-light)', outline: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit', paddingBottom: '2px' }} />
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Error */}
                            {error && (
                                <div style={{ fontSize: '12.5px', color: 'var(--red)', fontWeight: 600, padding: '6px 0' }}>{error}</div>
                            )}

                            {/* Step loader */}
                            <AnimatePresence>
                                {loading && step >= 0 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        style={{ display: 'flex', gap: '16px', padding: '6px 0' }}>
                                        {STEPS_LIST.map((s, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: i <= step ? 1 : 0.35 }}>
                                                {i < step ? <CheckCircle size={12} color="var(--green)" /> : i === step ? <Loader2 size={12} color="var(--accent-start)" className="spin" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--text-faint)' }} />}
                                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: i === step ? 600 : 400 }}>{s}</span>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Analyze Routes button */}
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%', padding: '14px',
                                    background: 'linear-gradient(135deg, #60a5fa, #3b82f6, #06b6d4)',
                                    border: 'none', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer',
                                    color: '#fff', fontWeight: 700, fontSize: '15px', fontFamily: 'inherit',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                                    transition: 'all 0.18s ease', opacity: loading ? 0.75 : 1,
                                    letterSpacing: '0.01em',
                                }}
                                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(59,130,246,0.5)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(59,130,246,0.35)' }}
                            >
                                {loading
                                    ? <><Loader2 size={16} className="spin" /> Analisando...</>
                                    : <><Search size={16} /> Analyze Routes</>
                                }
                            </button>
                        </div>
                    </form>
                </motion.div>

                {/* Recent AI Insights */}
                {recentSearches.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.4 }}
                        style={{ width: '100%', maxWidth: '760px' }}
                    >
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                            {recentSearches.map(b => (
                                <InsightCard key={b.id} busca={b} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
