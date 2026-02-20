import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { supabase, type ResultadoVoo, type Busca } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { FlightResultsGrouped } from '@/components/FlightResultsGrouped'
import { PlaneWindowLoader } from '@/components/PlaneWindowLoader'
import { motion } from 'framer-motion'

export default function Resultados() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const buscaId = parseInt(searchParams.get('buscaId') ?? '0', 10)

    const [flights, setFlights] = useState<ResultadoVoo[]>([])
    const [busca, setBusca] = useState<Busca | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!user || !buscaId) { navigate('/home'); return }
        const MIN_ANIM_MS = 3500 // garante que a animação da janela sempre toca completa
        const load = async () => {
            setLoading(true)
            try {
                const [voosRes, buscaRes] = await Promise.all([
                    // dados reais
                    supabase.from('resultados_voos').select('*').eq('busca_id', buscaId).eq('user_id', user.id).order('companhia'),
                    supabase.from('buscas').select('*').eq('id', buscaId).eq('user_id', user.id).single(),
                    // tempo mínimo garantido para a animação terminar
                    new Promise<void>(r => setTimeout(r, MIN_ANIM_MS)),
                ])
                if (voosRes.error) throw voosRes.error
                if (buscaRes.error) throw buscaRes.error
                setFlights(voosRes.data ?? [])
                setBusca(buscaRes.data)
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Erro ao carregar resultados.')
            } finally { setLoading(false) }
        }
        load()
    }, [user, buscaId, navigate])

    if (loading) return <PlaneWindowLoader />

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
            <Header variant="app" />
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 80px' }}>
                {error ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px', color: 'var(--red)' }}>
                        <AlertCircle size={40} />
                        <p style={{ fontSize: '15px' }}>{error}</p>
                        <button onClick={() => navigate('/home')} className="btn btn-primary">Voltar para busca</button>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <FlightResultsGrouped
                            flights={flights} buscaId={buscaId}
                            searchInfo={busca ? { origem: busca.origem, destino: busca.destino, data_ida: busca.data_ida, passageiros: busca.passageiros } : undefined}
                            onNewSearch={() => navigate('/home')}
                        />
                    </motion.div>
                )}
            </div>
        </div>
    )
}
