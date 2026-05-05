import React, { useEffect, useMemo, useState } from 'react'
import { Tag, AlertCircle, Calendar, Flame, Search, X } from 'lucide-react'
import { supabase, type Promocao } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { sanitizePromoSummary } from '@/lib/sanitizePromoHtml'

interface PromotionsSectionProps {
    limit?: number
    /** When true: no tabs, simpler mode for landing page */
    landingMode?: boolean
}

type Categoria = 'all' | 'milhas' | 'passagens' | 'compras' | 'noticias'
type Subcategoria = 'all' | 'transferencia' | 'clube' | 'acumulo'

// ─── Promo Card ───────────────────────────────────────────────────────────────
function PromoCard({ promo, idx, dark = false }: { promo: Promocao; idx: number; dark?: boolean }) {
    const expiringToday = promo.valid_until ? isToday(parseISO(promo.valid_until)) : false

    const cardStyle: React.CSSProperties = dark ? {
        padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        cursor: 'pointer',
        background: '#0f1623',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        transition: 'border-color 0.2s, background 0.2s',
        position: 'relative',
        height: '100%',
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
        height: '100%',
    }

    const summary = useMemo(() => sanitizePromoSummary(promo.conteudo, 140), [promo.conteudo])

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
            whileHover={{ y: -2 }}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                    background: dark ? 'rgba(74,144,226,0.12)' : '#EEF2F8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Tag size={15} color="#4a90e2" />
                </div>
                {promo.subcategoria === 'clube' && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: '#FEF3C7', color: '#B45309' }}>Clube</span>
                )}
                {promo.subcategoria === 'transferencia' && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: '#EDE9FE', color: '#6D28D9' }}>Transferência</span>
                )}
                {promo.subcategoria === 'acumulo' && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: '#DCFCE7', color: '#15803D' }}>Acúmulo</span>
                )}
                {promo.categoria === 'passagens' && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: '#E0F2FE', color: '#0369A1' }}>Passagem</span>
                )}
                {promo.categoria === 'compras' && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: '#FEF3C7', color: '#B45309' }}>Compras</span>
                )}
                {promo.categoria === 'noticias' && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: '#F1F5F9', color: '#475569' }}>Notícia</span>
                )}
                {(promo.programas_tags ?? []).slice(0, 2).map(tag => (
                    <span key={tag} style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px',
                        background: dark ? 'rgba(74,144,226,0.15)' : '#EEF2F8',
                        color: dark ? '#93C5FD' : '#2A60C2',
                    }}>{tag}</span>
                ))}
            </div>

            <h3 style={{
                fontSize: '14px', fontWeight: 700,
                color: dark ? '#e2e8f0' : '#0E2A55',
                lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
                {promo.titulo ?? 'Promoção'}
            </h3>

            {summary && (
                <p style={{
                    fontSize: '12.5px',
                    color: dark ? '#64748b' : '#6B7A99',
                    lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                    {summary}
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
const CATEGORY_OPTIONS: { key: Categoria; label: string }[] = [
    { key: 'all',       label: 'Todas' },
    { key: 'milhas',    label: '✦ Milhas' },
    { key: 'passagens', label: '✈ Passagens' },
    { key: 'compras',   label: '🛍 Compras' },
    { key: 'noticias',  label: '📰 Notícias' },
]

const SUBCATEGORY_OPTIONS: { key: Subcategoria; label: string }[] = [
    { key: 'all',           label: 'Todas' },
    { key: 'transferencia', label: 'Transferência' },
    { key: 'clube',         label: 'Clube' },
    { key: 'acumulo',       label: 'Acúmulo' },
]

export function PromotionsSection({ limit = 6, landingMode = false }: PromotionsSectionProps) {
    const [promos, setPromos] = useState<Promocao[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState<'all' | 'today'>('all')
    const [activeCategory, setActiveCategory] = useState<Categoria>('all')
    const [activeSubcategory, setActiveSubcategory] = useState<Subcategoria>('all')
    const [activeProgram, setActiveProgram] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        const load = async () => {
            try {
                const fetchLimit = landingMode ? limit : 1000
                const { data, error } = await supabase
                    .from('vw_promocoes_ativas').select('*')
                    .order('created_at', { ascending: false }).limit(fetchLimit)
                if (error) throw error
                setPromos(data ?? [])
            } catch { setError('Não foi possível carregar.') }
            finally { setLoading(false) }
        }
        load()
    }, [limit, landingMode])

    const dark = false
    const todayPromos = promos.filter(p => p.valid_until && isToday(parseISO(p.valid_until)))

    // Programas únicos para chips de filtro (filtrados pela categoria atual)
    const availablePrograms = useMemo(() => {
        const pool = activeCategory === 'all'
            ? promos
            : promos.filter(p => p.categoria === activeCategory)
        return Array.from(new Set(pool.flatMap(p => p.programas_tags ?? []))).sort()
    }, [promos, activeCategory])

    // Counts por categoria — para mostrar números nos botões
    const categoryCounts = useMemo(() => {
        const counts: Record<Categoria, number> = { all: promos.length, milhas: 0, passagens: 0, compras: 0, noticias: 0 }
        for (const p of promos) {
            if (p.categoria && p.categoria in counts) counts[p.categoria as Categoria]++
        }
        return counts
    }, [promos])

    // Filtro combinado
    const filteredPromos = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        return promos.filter(p => {
            if (activeTab === 'today' && !(p.valid_until && isToday(parseISO(p.valid_until)))) return false
            if (activeCategory !== 'all' && p.categoria !== activeCategory) return false
            if (activeCategory === 'milhas' && activeSubcategory !== 'all' && p.subcategoria !== activeSubcategory) return false
            if (activeProgram && !(p.programas_tags ?? []).includes(activeProgram)) return false
            if (q) {
                const hay = `${p.titulo ?? ''} ${p.conteudo ?? ''}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [promos, activeTab, activeCategory, activeSubcategory, activeProgram, searchTerm])

    // Agrupamento por data — só no dashboard mode
    const groupedPromos: { label: string; items: Promocao[] }[] = useMemo(() => {
        if (landingMode || filteredPromos.length === 0) return []
        const today: Promocao[] = []
        const yesterday: Promocao[] = []
        const older: Promocao[] = []
        for (const p of filteredPromos) {
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
    }, [landingMode, filteredPromos])

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: '14px',
    }

    const clearFilters = () => {
        setActiveTab('all')
        setActiveCategory('all')
        setActiveSubcategory('all')
        setActiveProgram(null)
        setSearchTerm('')
    }

    const hasActiveFilters = activeTab !== 'all' || activeCategory !== 'all'
        || activeSubcategory !== 'all' || activeProgram !== null || searchTerm.trim() !== ''

    if (loading) return (
        <div style={gridStyle}>
            {Array.from({ length: limit > 3 ? 6 : 3 }).map((_, i) => (
                <div key={i} style={{
                    padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px',
                    background: '#fff',
                    border: '1px solid #E2EAF5',
                    borderRadius: '14px',
                }}>
                    <div className="skeleton" style={{ height: '18px', width: '75%' }} />
                    <div className="skeleton" style={{ height: '13px', width: '50%' }} />
                    <div className="skeleton" style={{ height: '13px', width: '100%' }} />
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
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748B' }}>
            <Tag size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
            <p>Nenhuma promoção ativa no momento.</p>
            <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>O scraper atualiza a cada algumas horas.</p>
        </div>
    )

    return (
        <>
            {/* Filtros — dashboard mode only */}
            {!landingMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    {/* Busca */}
                    <div style={{ position: 'relative', maxWidth: '420px' }}>
                        <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por título ou conteúdo…"
                            style={{
                                width: '100%', padding: '10px 36px 10px 38px',
                                borderRadius: '10px',
                                border: '1px solid #E2EAF5', background: '#fff',
                                fontFamily: 'inherit', fontSize: '13.5px', color: '#0E2A55',
                                outline: 'none', transition: 'border-color 0.15s',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#2A60C2'}
                            onBlur={e => e.currentTarget.style.borderColor = '#E2EAF5'}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{
                                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#94A3B8',
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Linha 1: tabs de prazo */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: `Todas (${promos.length})`, icon: <Tag size={13} /> },
                            { key: 'today', label: `Acaba hoje${todayPromos.length > 0 ? ` (${todayPromos.length})` : ''}`, icon: <Flame size={13} /> },
                        ].map(tab => {
                            const isActive = activeTab === tab.key
                            const isTodayTab = tab.key === 'today'
                            return (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key as 'all' | 'today')}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                                        fontFamily: 'inherit', fontWeight: 600, fontSize: '13px',
                                        transition: 'all 0.18s',
                                        background: isActive ? (isTodayTab ? 'rgba(220,38,38,0.10)' : 'rgba(74,144,226,0.12)') : 'rgba(255,255,255,0.04)',
                                        color: isActive ? (isTodayTab ? '#F87171' : '#4a90e2') : '#475569',
                                        border: isActive
                                            ? (isTodayTab ? '1.5px solid rgba(220,38,38,0.25)' : '1.5px solid rgba(74,144,226,0.25)')
                                            : '1.5px solid transparent',
                                    }}
                                >
                                    {tab.icon}{tab.label}
                                </button>
                            )
                        })}
                        {hasActiveFilters && (
                            <button onClick={clearFilters}
                                style={{
                                    marginLeft: 'auto',
                                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                    fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                                    background: 'transparent', color: '#64748B',
                                    border: '1px dashed #CBD5E1',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}
                            >
                                <X size={12} /> Limpar filtros
                            </button>
                        )}
                    </div>

                    {/* Linha 2: categoria */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {CATEGORY_OPTIONS.map(opt => {
                            const isActive = activeCategory === opt.key
                            const count = categoryCounts[opt.key]
                            const disabled = opt.key !== 'all' && count === 0
                            return (
                                <button key={opt.key}
                                    onClick={() => {
                                        if (disabled) return
                                        setActiveCategory(opt.key)
                                        setActiveSubcategory('all')
                                        setActiveProgram(null)
                                    }}
                                    disabled={disabled}
                                    style={{
                                        padding: '5px 14px', borderRadius: '999px',
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        opacity: disabled ? 0.4 : 1,
                                        fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                                        background: isActive ? '#0E2A55' : 'transparent',
                                        color: isActive ? '#fff' : '#64748B',
                                        border: isActive ? '1.5px solid #0E2A55' : '1.5px solid #E2EAF5',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {opt.label} {opt.key !== 'all' && <span style={{ opacity: 0.6, fontWeight: 500 }}>({count})</span>}
                                </button>
                            )
                        })}
                    </div>

                    {/* Linha 3: subcategoria — apenas quando milhas */}
                    {activeCategory === 'milhas' && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {SUBCATEGORY_OPTIONS.map(opt => {
                                const isActive = activeSubcategory === opt.key
                                return (
                                    <button key={opt.key} onClick={() => setActiveSubcategory(opt.key)}
                                        style={{
                                            padding: '4px 12px', borderRadius: '999px', cursor: 'pointer',
                                            fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600,
                                            background: isActive ? '#6D28D9' : 'transparent',
                                            color: isActive ? '#fff' : '#64748B',
                                            border: isActive ? '1.5px solid #6D28D9' : '1.5px solid #E2EAF5',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Linha 4: chips de programa */}
                    {availablePrograms.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {[null, ...availablePrograms].map(prog => (
                                <button key={prog ?? '__all'} onClick={() => setActiveProgram(prog)}
                                    style={{
                                        padding: '4px 12px', borderRadius: '999px', cursor: 'pointer',
                                        fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600,
                                        background: activeProgram === prog ? '#2A60C2' : 'transparent',
                                        color: activeProgram === prog ? '#fff' : '#64748B',
                                        border: activeProgram === prog ? '1.5px solid #2A60C2' : '1.5px solid #E2EAF5',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {prog ?? 'Todos os programas'}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Resumo de resultados */}
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
                        {filteredPromos.length} {filteredPromos.length === 1 ? 'resultado' : 'resultados'}
                        {hasActiveFilters ? ' com os filtros aplicados' : ''}
                    </p>
                </div>
            )}

            {/* Empty state com filtros */}
            {!landingMode && filteredPromos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
                    <Calendar size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#0E2A55', marginBottom: '4px' }}>
                        Nenhuma promoção encontrada
                    </p>
                    <p style={{ fontSize: '12.5px' }}>Tente ajustar os filtros ou limpar a busca.</p>
                    {hasActiveFilters && (
                        <button onClick={clearFilters}
                            style={{
                                marginTop: '14px',
                                padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
                                background: '#2A60C2', color: '#fff', border: 'none',
                                fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600,
                            }}
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>
            )}

            {/* Landing mode — grid on desktop, horizontal carousel on mobile */}
            {landingMode && (
                <>
                    <style>{`
                        .promo-landing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }
                        .promo-landing-grid .promo-card-link { display: block; text-decoration: none; color: inherit; }
                        @media (max-width: 768px) {
                            .promo-landing-grid {
                                display: flex !important;
                                overflow-x: auto;
                                scroll-snap-type: x mandatory;
                                scrollbar-width: none;
                                padding-bottom: 8px;
                                -webkit-overflow-scrolling: touch;
                                gap: 12px;
                                padding-right: 16px;
                            }
                            .promo-landing-grid::-webkit-scrollbar { display: none; }
                            .promo-landing-grid .promo-card-link {
                                flex: 0 0 78vw;
                                max-width: 300px;
                                scroll-snap-align: center;
                            }
                        }
                    `}</style>
                    <div className="promo-landing-grid">
                        {promos.slice(0, limit).map((promo, idx) => (
                            <Link key={promo.id} to="/auth" className="promo-card-link">
                                <PromoCard promo={promo} idx={idx} dark={false} />
                            </Link>
                        ))}
                    </div>
                </>
            )}

            {/* Dashboard mode — grouped by date, cada card é um Link */}
            {!landingMode && filteredPromos.length > 0 && (
                <>
                    <style>{`
                        .promo-dashboard-card-link { display: block; text-decoration: none; color: inherit; height: 100%; }
                    `}</style>
                    <div style={gridStyle}>
                        {groupedPromos.map(group => (
                            <React.Fragment key={group.label}>
                                <DateLabel label={group.label} dark={dark} />
                                {group.items.map((promo, idx) => (
                                    <Link key={promo.id} to={`/promotions/${promo.id}`} className="promo-dashboard-card-link">
                                        <PromoCard promo={promo} idx={idx} dark={dark} />
                                    </Link>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </>
            )}
        </>
    )
}
