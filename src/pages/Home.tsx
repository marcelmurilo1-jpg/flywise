import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateMockFlights } from '@/lib/mockFlights'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/Header'
import type { Busca } from '@/lib/supabase'

const STEPS_LIST = ['Salvando busca...', 'Gerando cenários...', 'Calculando estratégias...']

export default function Home() {
    const [origin, setOrigin] = useState('')
    const [dest, setDest] = useState('')
    const [dateGo, setDateGo] = useState('')
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
        if (!origin.trim() || !dest.trim()) return setError('Preencha origem e destino.')
        if (!dateGo) return setError('Informe a data de ida.')
        if (!user) return setError('Faça login para buscar voos.')
        setLoading(true); setStep(0)
        stepTimers.current.push(setTimeout(() => setStep(1), 900))
        stepTimers.current.push(setTimeout(() => setStep(2), 1800))
        try {
            const { data: buscaData, error: buscaErr } = await supabase.from('buscas').insert({
                user_id: user.id, origem: origin, destino: dest,
                data_ida: dateGo, passageiros: pax, bagagem: 'sem_bagagem', user_miles: {},
            }).select().single()
            if (buscaErr) throw buscaErr
            const mocks = generateMockFlights(origin, dest, dateGo, pax, {})
            const voosToInsert = mocks.map(m => ({ ...m, busca_id: buscaData.id, user_id: user.id }))
            await supabase.from('resultados_voos').insert(voosToInsert)
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
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Inputs Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            {/* Origin */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Origem</label>
                                <input
                                    type="text" placeholder="GRU" value={origin} maxLength={3}
                                    onChange={e => setOrigin(e.target.value.toUpperCase())}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', fontWeight: 600, color: 'var(--text-dark)' }}
                                />
                            </div>
                            {/* Destination */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Destino</label>
                                <input
                                    type="text" placeholder="JFK" value={dest} maxLength={3}
                                    onChange={e => setDest(e.target.value.toUpperCase())}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', fontWeight: 600, color: 'var(--text-dark)' }}
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
                            {/* Passengers */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Passageiros</label>
                                <select
                                    value={pax} onChange={e => setPax(Number(e.target.value))}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontWeight: 500, color: 'var(--text-dark)', cursor: 'pointer' }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} pax</option>)}
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
