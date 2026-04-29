import { motion } from 'framer-motion'
import type { PriceGraph } from '@/lib/amadeus'

interface Props {
    priceGraph: PriceGraph
    searchDate: string  // 'YYYY-MM-DD'
}

const QUALITY_CONFIG = {
    low:     { label: 'Mais barato que o habitual', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '🟢' },
    typical: { label: 'Preço típico',               color: '#ca8a04', bg: '#fefce8', border: '#fde68a', dot: '🟡' },
    high:    { label: 'Mais caro que o habitual',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '🔴' },
}

const BAR_COLOR = {
    low:     '#16a34a',
    typical: '#f59e0b',
    high:    '#dc2626',
}

function fmtDate(iso: string) {
    const [, m, d] = iso.split('-')
    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
    return `${parseInt(d)} ${months[parseInt(m) - 1]}`
}

function fmtBRL(v: number) {
    return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

export function PriceGraphPanel({ priceGraph, searchDate }: Props) {
    const { bars, pageQuality } = priceGraph

    // Determine quality for the searched date: prefer bar data, fall back to pageQuality
    const searchBar = bars.find(b => b.date === searchDate)
    const quality = searchBar?.quality ?? pageQuality ?? 'typical'
    const cfg = QUALITY_CONFIG[quality]

    // Show up to 15 bars centered around the searched date
    const searchIdx = bars.findIndex(b => b.date === searchDate)
    const start = Math.max(0, searchIdx - 7)
    const visibleBars = bars.slice(start, start + 15)

    const maxPrice = Math.max(...visibleBars.map(b => b.price), 1)

    if (bars.length === 0 && !pageQuality) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{
                background: cfg.bg,
                border: `1.5px solid ${cfg.border}`,
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 20,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: visibleBars.length > 0 ? 16 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{cfg.dot}</span>
                    <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: cfg.color }}>{cfg.label}</p>
                        {searchBar && (
                            <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                {fmtDate(searchDate)} · {fmtBRL(searchBar.price)}
                            </p>
                        )}
                    </div>
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>via Google Flights</span>
            </div>

            {/* Mini bar chart */}
            {visibleBars.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
                    {visibleBars.map(bar => {
                        const isSearch = bar.date === searchDate
                        const heightPct = Math.max(0.12, bar.price / maxPrice)
                        return (
                            <div
                                key={bar.date}
                                title={`${fmtDate(bar.date)}: ${fmtBRL(bar.price)}`}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 3,
                                    cursor: 'default',
                                }}
                            >
                                <div style={{
                                    width: '100%',
                                    height: `${Math.round(heightPct * 44)}px`,
                                    borderRadius: '3px 3px 0 0',
                                    background: isSearch ? BAR_COLOR[bar.quality] : `${BAR_COLOR[bar.quality]}66`,
                                    outline: isSearch ? `2px solid ${BAR_COLOR[bar.quality]}` : 'none',
                                    outlineOffset: isSearch ? 1 : 0,
                                    transition: 'height 0.3s ease',
                                }} />
                                {isSearch && (
                                    <div style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: BAR_COLOR[bar.quality],
                                        flexShrink: 0,
                                    }} />
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </motion.div>
    )
}
