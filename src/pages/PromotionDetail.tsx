import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Tag, AlertCircle } from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Header } from '@/components/Header'
import { supabase, type Promocao } from '@/lib/supabase'
import { sanitizePromoHtml } from '@/lib/sanitizePromoHtml'

const CATEGORIA_LABEL: Record<NonNullable<Promocao['categoria']>, { label: string; bg: string; fg: string }> = {
    milhas:    { label: 'Milhas',    bg: '#EEF2F8', fg: '#2A60C2' },
    passagens: { label: 'Passagens', bg: '#E0F2FE', fg: '#0369A1' },
    compras:   { label: 'Compras',   bg: '#FEF3C7', fg: '#B45309' },
    noticias:  { label: 'Notícias',  bg: '#F1F5F9', fg: '#475569' },
}

const SUBCATEGORIA_LABEL: Record<NonNullable<Promocao['subcategoria']>, { label: string; bg: string; fg: string }> = {
    transferencia: { label: 'Transferência', bg: '#EDE9FE', fg: '#6D28D9' },
    clube:         { label: 'Clube',         bg: '#FEF3C7', fg: '#B45309' },
    acumulo:       { label: 'Acúmulo',       bg: '#DCFCE7', fg: '#15803D' },
}

export default function PromotionDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [promo, setPromo] = useState<Promocao | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            if (!id) { setNotFound(true); setLoading(false); return }
            const numericId = Number(id)
            if (!Number.isFinite(numericId)) { setNotFound(true); setLoading(false); return }
            const { data, error } = await supabase
                .from('vw_promocoes_ativas').select('*')
                .eq('id', numericId).maybeSingle()
            if (cancelled) return
            if (error || !data) { setNotFound(true) }
            else setPromo(data as Promocao)
            setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [id])

    const sanitized = useMemo(() => sanitizePromoHtml(promo?.conteudo), [promo?.conteudo])

    const expiresIsToday = promo?.valid_until ? isToday(parseISO(promo.valid_until)) : false
    const expiresText = promo?.valid_until
        ? expiresIsToday
            ? `Termina hoje às ${format(parseISO(promo.valid_until), 'HH:mm')}`
            : `Válido até ${format(parseISO(promo.valid_until), "dd 'de' MMMM", { locale: ptBR })}`
        : null

    const categoriaTag = promo?.categoria ? CATEGORIA_LABEL[promo.categoria] : null
    const subcategoriaTag = promo?.subcategoria ? SUBCATEGORIA_LABEL[promo.subcategoria] : null

    return (
        <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
            <Header variant="app" />

            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 80px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: '999px', cursor: 'pointer',
                        background: 'transparent', border: '1px solid #E2EAF5',
                        color: '#475569', fontSize: '13px', fontWeight: 600,
                        fontFamily: 'inherit', marginBottom: '24px',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#CBD5E1' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#E2EAF5' }}
                >
                    <ArrowLeft size={14} /> Voltar
                </button>

                {loading && (
                    <div style={{
                        background: '#fff', borderRadius: '20px', padding: '32px',
                        border: '1px solid #E2EAF5', display: 'flex', flexDirection: 'column', gap: '14px',
                    }}>
                        <div className="skeleton" style={{ height: '14px', width: '30%' }} />
                        <div className="skeleton" style={{ height: '28px', width: '85%' }} />
                        <div className="skeleton" style={{ height: '14px', width: '40%' }} />
                        <div className="skeleton" style={{ height: '200px', width: '100%', marginTop: '12px' }} />
                    </div>
                )}

                {!loading && notFound && (
                    <div style={{
                        background: '#fff', borderRadius: '20px', padding: '40px',
                        border: '1px solid #E2EAF5', textAlign: 'center', color: '#64748B',
                    }}>
                        <AlertCircle size={28} style={{ marginBottom: '10px', opacity: 0.5 }} />
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#0E2A55', marginBottom: '6px' }}>
                            Promoção não encontrada
                        </p>
                        <p style={{ fontSize: '13px' }}>
                            Pode ter expirado ou sido removida.{' '}
                            <Link to="/promotions" style={{ color: '#2A60C2', fontWeight: 600 }}>
                                Ver promoções ativas
                            </Link>
                        </p>
                    </div>
                )}

                {!loading && promo && (
                    <motion.article
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            background: '#fff', borderRadius: '20px', padding: '32px',
                            border: '1px solid #E2EAF5',
                            boxShadow: '0 4px 20px rgba(14,42,85,0.06)',
                            fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                            <div style={{
                                width: '34px', height: '34px', borderRadius: '9px', background: '#EEF2F8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Tag size={16} color="#2A60C2" />
                            </div>
                            {categoriaTag && (
                                <span style={{
                                    fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                                    background: categoriaTag.bg, color: categoriaTag.fg,
                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                }}>
                                    {categoriaTag.label}
                                </span>
                            )}
                            {subcategoriaTag && (
                                <span style={{
                                    fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                                    background: subcategoriaTag.bg, color: subcategoriaTag.fg,
                                }}>
                                    {subcategoriaTag.label}
                                </span>
                            )}
                            {(promo.programas_tags ?? []).map(tag => (
                                <span key={tag} style={{
                                    fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px',
                                    background: '#EEF2F8', color: '#2A60C2',
                                }}>{tag}</span>
                            ))}
                        </div>

                        <h1 style={{
                            fontSize: '28px', fontWeight: 800, color: '#0E2A55',
                            lineHeight: 1.25, letterSpacing: '-0.02em', marginBottom: '14px',
                        }}>
                            {promo.titulo ?? 'Promoção'}
                        </h1>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
                            {promo.created_at && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: '#64748B', fontWeight: 500 }}>
                                    <Calendar size={13} />
                                    {format(parseISO(promo.created_at), "dd 'de' MMMM", { locale: ptBR })}
                                </span>
                            )}
                            {expiresText && (
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    fontSize: '12.5px', fontWeight: 600,
                                    color: expiresIsToday ? '#DC2626' : '#059669',
                                    background: expiresIsToday ? '#FEF2F2' : '#ECFDF5',
                                    padding: '3px 10px', borderRadius: '999px',
                                }}>
                                    <Clock size={12} />{expiresText}
                                </span>
                            )}
                            {promo.preco_clube && (
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    fontSize: '12.5px', fontWeight: 600, color: '#B45309',
                                    background: '#FEF3C7', padding: '3px 10px', borderRadius: '999px',
                                }}>
                                    Clube · R$ {promo.preco_clube.toFixed(2)}/mês
                                    {promo.bonus_pct ? ` · ${promo.bonus_pct}% OFF` : ''}
                                </span>
                            )}
                        </div>

                        <style>{`
                            .promo-html-body { color: #334155; font-size: 16px; line-height: 1.85; }
                            .promo-html-body p { margin: 0 0 18px; }
                            .promo-html-body h1, .promo-html-body h2, .promo-html-body h3,
                            .promo-html-body h4, .promo-html-body h5 {
                                color: #0E2A55; font-weight: 800; line-height: 1.3;
                                letter-spacing: -0.02em; margin: 28px 0 12px;
                            }
                            .promo-html-body h2 { font-size: 22px; }
                            .promo-html-body h3 { font-size: 18px; }
                            .promo-html-body strong, .promo-html-body b { font-weight: 700; color: #0E2A55; }
                            .promo-html-body ul, .promo-html-body ol { padding-left: 22px; margin: 0 0 18px; }
                            .promo-html-body li { margin-bottom: 8px; }
                            .promo-html-body img {
                                width: 100%; max-width: 100%; height: auto;
                                border-radius: 14px; margin: 18px 0; display: block;
                            }
                            .promo-html-body blockquote {
                                border-left: 3px solid #2A60C2; margin: 18px 0;
                                padding: 10px 18px; background: #EEF2F8; border-radius: 0 8px 8px 0;
                                color: #334155;
                            }
                            .promo-html-body table { width: 100%; border-collapse: collapse; margin: 18px 0; }
                            .promo-html-body th, .promo-html-body td {
                                padding: 10px 14px; border: 1px solid #E2EAF5; font-size: 14px;
                            }
                            .promo-html-body th { background: #EEF2F8; font-weight: 700; color: #0E2A55; }
                            .promo-html-body hr { border: none; border-top: 1px solid #E2EAF5; margin: 22px 0; }
                        `}</style>

                        {sanitized ? (
                            <div className="promo-html-body" dangerouslySetInnerHTML={{ __html: sanitized }} />
                        ) : (
                            <p style={{ color: '#94A3B8', fontStyle: 'italic' }}>Sem conteúdo disponível.</p>
                        )}
                    </motion.article>
                )}
            </div>
        </div>
    )
}
