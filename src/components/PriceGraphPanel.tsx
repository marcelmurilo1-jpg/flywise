import { motion } from 'framer-motion'
import type { PriceGraph } from '@/lib/amadeus'

interface Props {
    priceGraph: PriceGraph
    searchDate: string  // 'YYYY-MM-DD'
}

const QUALITY_CONFIG = {
    low:     { label: 'Mais barato que o habitual', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dotColor: '#16a34a' },
    typical: { label: 'Preço típico',               color: '#ca8a04', bg: '#fefce8', border: '#fde68a', dotColor: '#ca8a04' },
    high:    { label: 'Mais caro que o habitual',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dotColor: '#dc2626' },
}

export function PriceGraphPanel({ priceGraph, searchDate: _ }: Props) {
    const { pageQuality } = priceGraph

    if (!pageQuality) return null

    const cfg = QUALITY_CONFIG[pageQuality]

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{
                background: cfg.bg,
                border: `1.5px solid ${cfg.border}`,
                borderRadius: 16,
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: cfg.dotColor, flexShrink: 0,
                }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</p>
            </div>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>via Google Flights</span>
        </motion.div>
    )
}
