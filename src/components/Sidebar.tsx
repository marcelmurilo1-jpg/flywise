import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useState } from 'react'

export interface FilterState {
    sortBy: 'best' | 'price' | 'duration'
    stops: string[]       // 'direct' | '1stop' | '2plus'
    airlines: string[]
    maxPrice: number | null
}

interface SidebarProps {
    filters: FilterState
    setFilters: (f: FilterState) => void
    allAirlines?: string[]
    priceMax?: number
}

const SectionHeader = ({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)',
        padding: '14px 0', cursor: 'pointer', fontFamily: 'inherit',
    }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--graphite)' }}>{label}</span>
        {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
    </button>
)

const FilterPill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
        padding: '5px 11px', borderRadius: 8, border: `1px solid ${active ? '#2A60C2' : 'var(--border-light)'}`,
        background: active ? 'rgba(42,96,194,0.09)' : 'transparent',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        color: active ? '#2A60C2' : 'var(--text-body)',
        cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
)

export function Sidebar({ filters, setFilters, allAirlines = [], priceMax = 0 }: SidebarProps) {
    const [sections, setSections] = useState({ sort: true, stops: true, airlines: true, price: true })
    const toggle = (k: keyof typeof sections) => setSections(s => ({ ...s, [k]: !s[k] }))

    const toggleStop = (val: string) => {
        const next = filters.stops.includes(val)
            ? filters.stops.filter(x => x !== val)
            : [...filters.stops, val]
        setFilters({ ...filters, stops: next })
    }

    const toggleAirline = (a: string) => {
        const next = filters.airlines.includes(a)
            ? filters.airlines.filter(x => x !== a)
            : [...filters.airlines, a]
        setFilters({ ...filters, airlines: next })
    }

    const effectiveMax = filters.maxPrice ?? priceMax

    const hasActiveFilters = filters.stops.length > 0 || filters.airlines.length > 0 || filters.maxPrice !== null || filters.sortBy !== 'best'

    return (
        <aside style={{
            width: '230px', flexShrink: 0, background: '#fff',
            border: '1px solid var(--border-light)', borderRadius: '16px',
            padding: '20px', height: 'fit-content',
            position: 'sticky', top: '80px', boxShadow: 'var(--shadow-xs)',
        }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Filtros
            </p>

            {/* Ordenar por */}
            <SectionHeader label="Ordenar por" open={sections.sort} onToggle={() => toggle('sort')} />
            {sections.sort && (
                <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {([['Melhor estratégia', 'best'], ['Mais econômico', 'price'], ['Mais rápido', 'duration']] as const).map(([label, val]) => (
                        <button key={val} onClick={() => setFilters({ ...filters, sortBy: val })} style={{
                            padding: '7px 12px', borderRadius: '8px',
                            border: `1px solid ${filters.sortBy === val ? '#2A60C2' : 'var(--border-light)'}`,
                            background: filters.sortBy === val ? 'rgba(42,96,194,0.08)' : 'transparent',
                            fontFamily: 'inherit', fontSize: '13px', fontWeight: 500,
                            color: filters.sortBy === val ? '#2A60C2' : 'var(--text-body)',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}>{label}</button>
                    ))}
                </div>
            )}

            {/* Conexões */}
            <SectionHeader label="Conexões" open={sections.stops} onToggle={() => toggle('stops')} />
            {sections.stops && (
                <div style={{ padding: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {([['Direto', 'direct'], ['1 parada', '1stop'], ['2+', '2plus']] as const).map(([label, val]) => (
                        <FilterPill key={val} label={label} active={filters.stops.includes(val)} onClick={() => toggleStop(val)} />
                    ))}
                </div>
            )}

            {/* Companhia aérea */}
            {allAirlines.length > 0 && (
                <>
                    <SectionHeader label="Companhia aérea" open={sections.airlines} onToggle={() => toggle('airlines')} />
                    {sections.airlines && (
                        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {allAirlines.map(a => (
                                <button key={a} onClick={() => toggleAirline(a)} style={{
                                    padding: '6px 10px', borderRadius: 8, textAlign: 'left',
                                    border: `1px solid ${filters.airlines.includes(a) ? '#2A60C2' : 'var(--border-light)'}`,
                                    background: filters.airlines.includes(a) ? 'rgba(42,96,194,0.08)' : 'transparent',
                                    fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                                    color: filters.airlines.includes(a) ? '#2A60C2' : 'var(--text-body)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}>{a}</button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Preço máximo */}
            {priceMax > 0 && (
                <>
                    <SectionHeader label="Preço máximo" open={sections.price} onToggle={() => toggle('price')} />
                    {sections.price && (
                        <div style={{ padding: '10px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>R$ 0</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>
                                    R$ {effectiveMax.toLocaleString('pt-BR')}
                                </span>
                            </div>
                            <input
                                type="range" min={0} max={priceMax} step={50}
                                value={effectiveMax}
                                onChange={e => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                                style={{ width: '100%', accentColor: '#2A60C2' }}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Limpar */}
            {hasActiveFilters && (
                <button
                    onClick={() => setFilters({ sortBy: 'best', stops: [], airlines: [], maxPrice: null })}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '12px', fontFamily: 'inherit', fontWeight: 600 }}
                >
                    <X size={12} /> Limpar filtros
                </button>
            )}
        </aside>
    )
}
