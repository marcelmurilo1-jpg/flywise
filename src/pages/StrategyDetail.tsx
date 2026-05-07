import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Header } from '@/components/Header'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { StrategyContent } from '@/components/StrategyContent'
import type { StrategyResult } from '@/lib/llm/buildPrompt'
import type { SeatsContext } from '@/components/StrategyPanel'
import type { Strategy } from '@/lib/supabase'

function parseSeatsContextFromTags(s: Strategy): SeatsContext | undefined {
    const allTags: string[] = s.tags ?? []
    const seatsTag = allTags.find(t => t?.startsWith('seats:'))
    if (!seatsTag) return undefined
    const parts = seatsTag.replace('seats:', '').split(':')
    if (parts.length < 5) return undefined
    const program = parts[2].replace(/_/g, ' ')
    return {
        airlineCode: '',
        airlineName: program,
        origem: parts[0],
        destino: parts[1],
        cabin: parts[3],
        program,
        idaMilhas: parseInt(parts[4]) || 0,
        totalMilhas: parseInt(parts[4]) || 0,
        isRoundTrip: false,
        dataVoo: parts[5] ?? '',
    }
}

export default function StrategyDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [strategy, setStrategy] = useState<Strategy | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        if (!id || !user) return
        const numericId = Number(id)
        if (!Number.isFinite(numericId)) { setNotFound(true); setLoading(false); return }

        supabase
            .from('strategies')
            .select('*')
            .eq('id', numericId)
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data, error }) => {
                if (error || !data) setNotFound(true)
                else setStrategy(data as Strategy)
                setLoading(false)
            })
    }, [id, user])

    const result = strategy?.structured_result as (StrategyResult & { _seatsContext?: SeatsContext }) | null | undefined
    const strategyResult = result ? (() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _seatsContext: _sc, ...rest } = result
        return rest as StrategyResult
    })() : null

    const seatsContext: SeatsContext | undefined = result?._seatsContext ?? (strategy ? parseSeatsContextFromTags(strategy) : undefined)

    const cashPrice = strategy?.preco_cash ?? 0

    return (
        <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Manrope, system-ui, sans-serif' }}>
            <Header variant="app" />

            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 100px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: '999px', cursor: 'pointer',
                        background: 'transparent', border: '1px solid #E2EAF5',
                        color: '#475569', fontSize: '13px', fontWeight: 600,
                        fontFamily: 'inherit', marginBottom: '24px',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                    <ArrowLeft size={14} /> Voltar
                </button>

                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <Loader2 size={32} color="#2A60C2" className="spin" />
                    </div>
                )}

                {!loading && notFound && (
                    <div style={{ background: '#fff', borderRadius: '20px', padding: '40px', border: '1px solid #E2EAF5', textAlign: 'center', color: '#64748B' }}>
                        <AlertCircle size={28} style={{ marginBottom: '10px', opacity: 0.5 }} />
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#0E2A55', marginBottom: '6px' }}>Estratégia não encontrada</p>
                        <p style={{ fontSize: '13px' }}>Pode ter sido removida.</p>
                    </div>
                )}

                {!loading && strategy && strategyResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ background: '#fff', borderRadius: '20px', padding: '28px', border: '1px solid #E2EAF5', boxShadow: '0 4px 20px rgba(14,42,85,0.06)' }}
                    >
                        {/* Page title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #F1F5F9' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 18 }}>⚡</span>
                            </div>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: '#0E2A55' }}>Estratégia com Milhas</div>
                                {strategy.created_at && (
                                    <div style={{ fontSize: 12, color: '#94A3B8' }}>
                                        Gerada em {new Date(strategy.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <StrategyContent
                            strategy={strategyResult}
                            seatsContext={seatsContext}
                            cashPrice={cashPrice}
                            userId={user?.id}
                        />
                    </motion.div>
                )}
            </div>
        </div>
    )
}
