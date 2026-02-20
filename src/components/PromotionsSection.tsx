import { useEffect, useState } from 'react'
import { ExternalLink, Tag, AlertCircle } from 'lucide-react'
import { supabase, type Promocao } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface PromotionsSectionProps {
    limit?: number
}

export function PromotionsSection({ limit = 6 }: PromotionsSectionProps) {
    const [promos, setPromos] = useState<Promocao[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const load = async () => {
            try {
                const { data, error } = await supabase
                    .from('promocoes').select('*')
                    .order('created_at', { ascending: false }).limit(limit)
                if (error) throw error
                setPromos(data ?? [])
            } catch { setError('Não foi possível carregar.') }
            finally { setLoading(false) }
        }
        load()
    }, [limit])

    if (loading) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
                {Array.from({ length: limit > 3 ? 6 : 3 }).map((_, i) => (
                    <div key={i} className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="skeleton" style={{ height: '18px', width: '75%' }} />
                        <div className="skeleton" style={{ height: '13px', width: '50%' }} />
                        <div className="skeleton" style={{ height: '13px', width: '100%' }} />
                        <div className="skeleton" style={{ height: '13px', width: '65%' }} />
                    </div>
                ))}
            </div>
        )
    }

    if (error) return (
        <div style={{ display: 'flex', gap: '10px', padding: '18px', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', color: 'var(--red)', fontSize: '13.5px' }}>
            <AlertCircle size={17} /> {error}
        </div>
    )

    if (promos.length === 0) return (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Tag size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
            <p>Nenhuma promoção ativa no momento.</p>
            <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>O scraper atualiza a cada hora.</p>
        </div>
    )

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
            {promos.map((promo, idx) => (
                <motion.a
                    key={promo.id}
                    href={promo.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -3 }}
                    className="card"
                    style={{ padding: '22px', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--amber-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Tag size={16} color="var(--amber)" />
                        </div>
                        <ExternalLink size={13} color="var(--text-faint)" />
                    </div>

                    <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {promo.titulo ?? 'Promoção'}
                    </h3>

                    {promo.conteudo && (
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {promo.conteudo.replace(/<[^>]*>/g, '').slice(0, 160)}
                        </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-faint)', marginTop: 'auto' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                            {promo.created_at ? format(new Date(promo.created_at), 'dd MMM', { locale: ptBR }) : '—'}
                        </span>
                        {promo.valid_until && (
                            <span className="pill pill-green" style={{ fontSize: '10.5px' }}>
                                Válido até {format(new Date(promo.valid_until), 'dd/MM', { locale: ptBR })}
                            </span>
                        )}
                    </div>
                </motion.a>
            ))}
        </div>
    )
}
