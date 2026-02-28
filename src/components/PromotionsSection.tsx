import React, { useEffect, useState } from 'react'
import { Tag, AlertCircle, X, ExternalLink, Clock, Calendar, Flame } from 'lucide-react'
import { supabase, type Promocao } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'

interface PromotionsSectionProps {
    limit?: number
    /** When true: no tabs, no modal — clicking goes to /auth (landing page) */
    landingMode?: boolean
}

// ─── Promotion Modal ──────────────────────────────────────────────────────────
function PromoModal({ promo, onClose }: { promo: Promocao; onClose: () => void }) {
    const imgs: { src: string; alt: string }[] = (() => {
        try {
            const raw = promo.imagens
            if (!raw) return []
            const list = typeof raw === 'string' ? JSON.parse(raw) : raw
            return Array.isArray(list) ? list.filter((i: any) => i.src) : []
        } catch { return [] }
    })()

    const bodyText = (promo.conteudo ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()

    const expiresText = promo.valid_until
        ? isToday(parseISO(promo.valid_until))
            ? `⏰ Termina hoje às ${format(parseISO(promo.valid_until), 'HH:mm')}`
            : `📅 Válido até ${format(parseISO(promo.valid_until), "dd 'de' MMMM", { locale: ptBR })}`
        : null

    const expiresIsToday = promo.valid_until ? isToday(parseISO(promo.valid_until)) : false

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(8,10,16,0.75)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 24 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#fff', borderRadius: '24px', width: '100%',
                    maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto',
                    boxShadow: '0 32px 80px rgba(14,42,85,0.25)',
                    fontFamily: 'Inter, system-ui, sans-serif',
                }}
            >
                {/* Modal Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '22px 24px 16px', borderBottom: '1px solid #E2EAF5',
                    position: 'sticky', top: 0, background: '#fff', zIndex: 2,
                    borderRadius: '24px 24px 0 0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Tag size={16} color="#2A60C2" />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2A60C2', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Promoção de Milhas
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
                        onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
                    >
                        <X size={15} color="#64748B" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0E2A55', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '12px' }}>
                        {promo.titulo ?? 'Promoção'}
                    </h2>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        {promo.created_at && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                                <Calendar size={13} />
                                {format(parseISO(promo.created_at), "dd 'de' MMMM", { locale: ptBR })}
                            </span>
                        )}
                        {expiresText && (
                            <span style={{
                                display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                                color: expiresIsToday ? '#DC2626' : '#059669',
                                background: expiresIsToday ? '#FEF2F2' : '#ECFDF5',
                                padding: '3px 10px', borderRadius: '999px',
                            }}>
                                <Clock size={12} />{expiresText}
                            </span>
                        )}
                    </div>

                    {imgs.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: imgs.length === 1 ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                            {imgs.slice(0, 4).map((img, i) => (
                                <img key={i} src={img.src} alt={img.alt || ''}
                                    style={{ width: '100%', height: imgs.length === 1 ? '220px' : '140px', objectFit: 'cover', borderRadius: '12px' }}
                                    onError={e => e.currentTarget.style.display = 'none'}
                                />
                            ))}
                        </div>
                    )}

                    {bodyText && (
                        <div style={{ fontSize: '15px', color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                            {bodyText.slice(0, 1600)}{bodyText.length > 1600 && '…'}
                        </div>
                    )}

                    {promo.url && (
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #E2EAF5' }}>
                            <a href={promo.url} target="_blank" rel="noopener noreferrer" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                background: '#2A60C2', color: '#fff', padding: '13px 24px',
                                borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '14px',
                                boxShadow: '0 4px 16px rgba(42,96,194,0.35)', transition: 'background 0.2s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = '#1A4EA8'}
                                onMouseLeave={e => e.currentTarget.style.background = '#2A60C2'}
                            >
                                <ExternalLink size={15} /> Ver promoção completa
                            </a>
                            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
                                Abre no site original (Passageiro de Primeira)
                            </p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Promo Card ───────────────────────────────────────────────────────────────
function PromoCard({ promo, idx, onClick, dark = false }: {
    promo: Promocao; idx: number; onClick: () => void; dark?: boolean
}) {
    const expiringToday = promo.valid_until ? isToday(parseISO(promo.valid_until)) : false

    // Card styles differ for dark (dashboard) vs light (landing) mode
    const cardStyle: React.CSSProperties = dark ? {
        padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        cursor: 'pointer',
        background: '#0f1623',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        transition: 'border-color 0.2s, background 0.2s',
        position: 'relative',
    } : {
        padding: '22px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        cursor: 'pointer',
        background: '#fff',
        border: '1px solid #E2EAF5',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(14,42,85,0.06)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        position: 'relative',
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            whileHover={{ y: -2 }}
            onClick={onClick}
            style={cardStyle}
            onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                if (dark) { el.style.borderColor = 'rgba(74,144,226,0.3)'; el.style.background = '#131c2e' }
                else el.style.boxShadow = '0 8px 28px rgba(14,42,85,0.12)'
            }}
            onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                if (dark) { el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.background = '#0f1623' }
                else el.style.boxShadow = '0 2px 12px rgba(14,42,85,0.06)'
            }}
        >
            {/* "Acaba hoje" badge — only when truly expiring today */}
            {expiringToday && (
                <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: '#FEF2F2', color: '#DC2626',
                    fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                    borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                    <Flame size={10} /> Acaba hoje
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: dark ? 'rgba(74,144,226,0.12)' : '#EEF2F8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Tag size={15} color="#4a90e2" />
                </div>
            </div>

            <h3 style={{
                fontSize: '14px', fontWeight: 700,
                color: dark ? '#e2e8f0' : '#0E2A55',
                lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
                {promo.titulo ?? 'Promoção'}
            </h3>

            {promo.conteudo && (
                <p style={{
                    fontSize: '12.5px',
                    color: dark ? '#64748b' : '#6B7A99',
                    lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                    {promo.conteudo.replace(/<[^>]*>/g, '').slice(0, 130)}
                </p>
            )}

            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: '8px',
                borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E2EAF5',
                marginTop: 'auto',
            }}>
                <span style={{ fontSize: '11px', color: dark ? '#475569' : '#94A3B8' }}>
                    {promo.created_at ? format(parseISO(promo.created_at), 'dd MMM', { locale: ptBR }) : '—'}
                </span>
                {promo.valid_until && (
                    <span style={{
                        fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px',
                        background: expiringToday ? (dark ? 'rgba(220,38,38,0.12)' : '#FEF2F2') : (dark ? 'rgba(5,150,105,0.12)' : '#ECFDF5'),
                        color: expiringToday ? '#DC2626' : '#059669',
                    }}>
                        {expiringToday
                            ? `Hoje ${format(parseISO(promo.valid_until), 'HH:mm')}`
                            : `Até ${format(parseISO(promo.valid_until), 'dd/MM', { locale: ptBR })}`
                        }
                    </span>
                )}
            </div>
        </motion.div>
    )
}

// ─── Date Group Label ─────────────────────────────────────────────────────────
function DateLabel({ label, dark }: { label: string; dark: boolean }) {
    return (
        <div style={{
            gridColumn: '1 / -1',
            display: 'flex', alignItems: 'center', gap: '12px',
            marginTop: '8px', marginBottom: '4px',
        }}>
            <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: dark ? '#475569' : '#94A3B8',
                whiteSpace: 'nowrap',
            }}>
                {label}
            </span>
            <div style={{ flex: 1, height: '1px', background: dark ? 'rgba(255,255,255,0.06)' : '#E2EAF5' }} />
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PromotionsSection({ limit = 6, landingMode = false }: PromotionsSectionProps) {
    const [promos, setPromos] = useState<Promocao[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState<'all' | 'today'>('all')
    const [selectedPromo, setSelectedPromo] = useState<Promocao | null>(null)

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

    const dark = false  // dashboard is now light background — use light cards everywhere
    const todayPromos = promos.filter(p => p.created_at && isToday(parseISO(p.created_at)))
    const displayPromos = activeTab === 'today' ? promos.filter(p => p.valid_until && isToday(parseISO(p.valid_until))) : promos

    // Group promos by date for dashboard mode
    const groupedPromos: { label: string; items: Promocao[] }[] = (() => {
        if (landingMode || displayPromos.length === 0) return []
        const today: Promocao[] = []
        const yesterday: Promocao[] = []
        const older: Promocao[] = []
        for (const p of displayPromos) {
            if (!p.created_at) { older.push(p); continue }
            const d = parseISO(p.created_at)
            if (isToday(d)) today.push(p)
            else if (isYesterday(d)) yesterday.push(p)
            else older.push(p)
        }
        const groups: { label: string; items: Promocao[] }[] = []
        if (today.length) groups.push({ label: 'Hoje', items: today })
        if (yesterday.length) groups.push({ label: 'Ontem', items: yesterday })
        if (older.length) groups.push({ label: 'Anteriores', items: older })
        return groups
    })()

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: '14px',
    }

    if (loading) return (
        <div style={gridStyle}>
            {Array.from({ length: limit > 3 ? 6 : 3 }).map((_, i) => (
                <div key={i} style={{
                    padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px',
                    background: dark ? '#0f1623' : '#fff',
                    border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2EAF5',
                    borderRadius: '14px',
                }}>
                    <div className="skeleton" style={{ height: '18px', width: '75%', background: dark ? 'rgba(255,255,255,0.06)' : undefined }} />
                    <div className="skeleton" style={{ height: '13px', width: '50%', background: dark ? 'rgba(255,255,255,0.04)' : undefined }} />
                    <div className="skeleton" style={{ height: '13px', width: '100%', background: dark ? 'rgba(255,255,255,0.04)' : undefined }} />
                </div>
            ))}
        </div>
    )

    if (error) return (
        <div style={{ display: 'flex', gap: '10px', padding: '18px', background: '#FEF2F2', borderRadius: '12px', color: '#DC2626', fontSize: '13.5px' }}>
            <AlertCircle size={17} /> {error}
        </div>
    )

    if (promos.length === 0) return (
        <div style={{ textAlign: 'center', padding: '48px', color: dark ? '#475569' : '#64748B' }}>
            <Tag size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
            <p>Nenhuma promoção ativa no momento.</p>
            <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>O scraper atualiza a cada hora.</p>
        </div>
    )

    return (
        <>
            {/* Tabs — dashboard mode only */}
            {!landingMode && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    {[
                        { key: 'all', label: `Todas (${promos.length})`, icon: <Tag size={13} /> },
                        { key: 'today', label: `Acaba hoje${todayPromos.length > 0 ? ` (${todayPromos.length})` : ''}`, icon: <Flame size={13} /> },
                    ].map(tab => {
                        const isActive = activeTab === tab.key
                        const isToday = tab.key === 'today'
                        return (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key as 'all' | 'today')}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                                    fontFamily: 'inherit', fontWeight: 600, fontSize: '13px',
                                    transition: 'all 0.18s',
                                    background: isActive ? (isToday ? 'rgba(220,38,38,0.10)' : 'rgba(74,144,226,0.12)') : 'rgba(255,255,255,0.04)',
                                    color: isActive ? (isToday ? '#F87171' : '#4a90e2') : '#475569',
                                    border: isActive
                                        ? (isToday ? '1.5px solid rgba(220,38,38,0.25)' : '1.5px solid rgba(74,144,226,0.25)')
                                        : '1.5px solid transparent',
                                }}
                            >
                                {tab.icon}{tab.label}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* "Acaba hoje" empty state */}
            {activeTab === 'today' && displayPromos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
                    <Flame size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                    <p>Nenhuma promoção expira hoje.</p>
                </div>
            )}

            {/* Landing mode — simple grid, click → /auth */}
            {landingMode && (
                <div style={gridStyle}>
                    {displayPromos.map((promo, idx) => (
                        <Link key={promo.id} to="/auth" style={{ textDecoration: 'none', display: 'block' }}>
                            <PromoCard promo={promo} idx={idx} onClick={() => { }} dark={false} />
                        </Link>
                    ))}
                </div>
            )}

            {/* Dashboard mode — grouped by date */}
            {!landingMode && displayPromos.length > 0 && (
                <div style={gridStyle}>
                    {groupedPromos.map(group => (
                        <React.Fragment key={group.label}>
                            <DateLabel label={group.label} dark={dark} />
                            {group.items.map((promo, idx) => (
                                <PromoCard
                                    key={promo.id}
                                    promo={promo}
                                    idx={idx}
                                    dark={dark}
                                    onClick={() => setSelectedPromo(promo)}
                                />
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {selectedPromo && (
                    <PromoModal promo={selectedPromo} onClose={() => setSelectedPromo(null)} />
                )}
            </AnimatePresence>
        </>
    )
}
