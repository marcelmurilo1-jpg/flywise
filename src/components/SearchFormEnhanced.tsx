import { useState, useRef, useEffect } from 'react'
import { Search, Plane, ChevronDown, ChevronUp, Loader2, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { generateMockFlights } from '@/lib/mockFlights'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const BANKS = ['Sem preferência', 'Itaú', 'Bradesco', 'Santander', 'Nubank', 'XP', 'BTG']
const STEPS_LIST = ['Salvando busca...', 'Gerando cenários de voo...', 'Calculando estratégias de milhas...']

export function SearchFormEnhanced() {
    const [origin, setOrigin] = useState('')
    const [dest, setDest] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [dateBack, setDateBack] = useState('')
    const [pax, setPax] = useState(1)
    const [baggage, setBaggage] = useState('sem_bagagem')
    const [bank, setBank] = useState(BANKS[0])
    const [showMiles, setShowMiles] = useState(false)
    const [miles, setMiles] = useState({ smiles: '', latam: '', azul: '' })
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(-1)
    const [error, setError] = useState('')
    const { user } = useAuth()
    const navigate = useNavigate()
    const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    useEffect(() => () => { stepTimers.current.forEach(clearTimeout) }, [])

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
                bagagem: baggage, banco: bank !== BANKS[0] ? bank : null, user_miles: userMiles,
            }).select().single()
            if (buscaErr) throw buscaErr

            const mocks = generateMockFlights(origin.toUpperCase(), dest.toUpperCase(), dateGo, pax, userMiles)
            const voosToInsert = mocks.map(m => ({
                ...m, busca_id: buscaData.id, user_id: user.id,
            }))
            const { error: voosErr } = await supabase.from('resultados_voos').insert(voosToInsert)
            if (voosErr) throw voosErr

            await new Promise(r => setTimeout(r, 800))
            setStep(3)
            await new Promise(r => setTimeout(r, 400))
            navigate(`/resultados?buscaId=${buscaData.id}`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar. Tente novamente.')
            setLoading(false); setStep(-1)
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Route row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', borderBottom: '1px solid var(--border-faint)' }}>
                <div style={{ padding: '16px 18px' }}>
                    <label className="input-label">Origem</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plane size={15} color="var(--text-faint)" />
                        <input
                            type="text" placeholder="GRU" value={origin} maxLength={3}
                            onChange={e => setOrigin(e.target.value.toUpperCase())}
                            style={{ border: 'none', outline: 'none', fontSize: '15px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit' }}
                        />
                    </div>
                </div>
                <div style={{ background: 'var(--border-faint)' }} />
                <div style={{ padding: '16px 18px' }}>
                    <label className="input-label">Destino</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plane size={15} color="var(--text-faint)" style={{ transform: 'scaleX(-1)' }} />
                        <input
                            type="text" placeholder="JFK" value={dest} maxLength={3}
                            onChange={e => setDest(e.target.value.toUpperCase())}
                            style={{ border: 'none', outline: 'none', fontSize: '15px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit' }}
                        />
                    </div>
                </div>
            </div>

            {/* Dates row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', borderBottom: '1px solid var(--border-faint)' }}>
                <div style={{ padding: '16px 18px' }}>
                    <label className="input-label">Ida</label>
                    <input type="date" value={dateGo} onChange={e => setDateGo(e.target.value)} min={new Date().toISOString().split('T')[0]}
                        style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }} />
                </div>
                <div style={{ background: 'var(--border-faint)' }} />
                <div style={{ padding: '16px 18px' }}>
                    <label className="input-label">Volta (opcional)</label>
                    <input type="date" value={dateBack} onChange={e => setDateBack(e.target.value)} min={dateGo || new Date().toISOString().split('T')[0]}
                        style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', background: 'transparent', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }} />
                </div>
            </div>

            {/* Options row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border-faint)' }}>
                <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-faint)' }}>
                    <label className="input-label">Passageiros</label>
                    <select value={pax} onChange={e => setPax(Number(e.target.value))} className="input" style={{ padding: '4px 0', border: 'none', boxShadow: 'none', fontWeight: 600, cursor: 'pointer' }}>
                        {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'adulto' : 'adultos'}</option>)}
                    </select>
                </div>
                <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-faint)' }}>
                    <label className="input-label">Bagagem</label>
                    <select value={baggage} onChange={e => setBaggage(e.target.value)} className="input" style={{ padding: '4px 0', border: 'none', boxShadow: 'none', fontWeight: 600, cursor: 'pointer' }}>
                        <option value="sem_bagagem">Sem bagagem</option>
                        <option value="bagagem_mao">Só mão</option>
                        <option value="1_bagagem">1 despachada</option>
                        <option value="2_bagagens">2 despachadas</option>
                    </select>
                </div>
                <div style={{ padding: '14px 18px' }}>
                    <label className="input-label">Banco / Cartão</label>
                    <select value={bank} onChange={e => setBank(e.target.value)} className="input" style={{ padding: '4px 0', border: 'none', boxShadow: 'none', fontWeight: 600, cursor: 'pointer' }}>
                        {BANKS.map(b => <option key={b}>{b}</option>)}
                    </select>
                </div>
            </div>

            {/* Miles toggle */}
            <button type="button" onClick={() => setShowMiles(!showMiles)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-faint)', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-start)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    + Adicionar saldo de milhas
                </span>
                {showMiles ? <ChevronUp size={14} color="var(--accent-start)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
            </button>

            <AnimatePresence>
                {showMiles && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-faint)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '14px 18px', gap: '12px' }}>
                            {[['smiles', 'Smiles (GOL)'], ['latam', 'LATAM Pass'], ['azul', 'TudoAzul']].map(([k, label]) => (
                                <div key={k}>
                                    <label className="input-label">{label}</label>
                                    <input type="number" placeholder="0" min="0" value={miles[k as keyof typeof miles]}
                                        onChange={e => setMiles(prev => ({ ...prev, [k]: e.target.value }))}
                                        className="input" style={{ padding: '8px 12px', fontSize: '14px' }} />
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error */}
            {error && (
                <div style={{ padding: '10px 18px', background: 'var(--red-bg)', borderBottom: '1px solid rgba(239,68,68,0.15)', color: 'var(--red)', fontSize: '13px', fontWeight: 600 }}>{error}</div>
            )}

            {/* Loading steps */}
            <AnimatePresence>
                {loading && step >= 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ padding: '14px 18px', background: 'var(--accent-soft)', borderBottom: '1px solid rgba(59,130,246,0.1)' }}>
                        {STEPS_LIST.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: i < 2 ? '6px' : 0, opacity: i <= step ? 1 : 0.35, transition: 'opacity 0.3s' }}>
                                {i < step ? <CheckCircle size={13} color="var(--green)" /> : i === step ? <Loader2 size={13} color="var(--accent-start)" className="spin" /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid var(--text-faint)' }} />}
                                <span style={{ fontSize: '12px', color: i <= step ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === step ? 600 : 400 }}>{s}</span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Submit */}
            <div style={{ padding: '16px 18px' }}>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '14.5px' }}>
                    {loading ? <><Loader2 size={16} className="spin" /> Buscando...</> : <><Search size={16} /> Buscar e Comparar</>}
                </button>
            </div>
        </form>
    )
}
