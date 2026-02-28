import { useState, useMemo } from 'react'
import { Plane, ArrowRight, SlidersHorizontal, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResultadoVoo } from '@/lib/supabase'
import { StrategyPanel } from '@/components/StrategyPanel'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { airlineMatchesPrograms, TOP_PROGRAMS } from '@/lib/airlineMilesMapping'

interface SearchInfo { origem: string; destino: string; data_ida: string; passageiros: number }
interface FlightResultsGroupedProps {
    flights: ResultadoVoo[]
    buscaId: number
    searchInfo?: SearchInfo
    onNewSearch: () => void
}

function formatTime(iso?: string) {
    if (!iso) return '--:--'
    try { return format(parseISO(iso), 'HH:mm') } catch { return '--:--' }
}
function formatDate(iso?: string) {
    if (!iso) return ''
    try { return format(parseISO(iso), "d 'de' MMM", { locale: ptBR }) } catch { return '' }
}
function formatDur(m?: number | null) {
    if (!m) return ''
    return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}min` : ''}`
}
function stopLabel(n?: number | null, codes?: string) {
    if (n === 0) return 'Direto'
    if (n === 1) return codes ? `1 conexão · ${codes}` : '1 conexão'
    if (n && n > 1) return codes ? `${n} conexões · ${codes}` : `${n} conexões`
    return ''
}
function stopCodes(segs: any[]): string {
    if (!segs || segs.length <= 1) return ''
    return segs.slice(0, -1).map((s: any) => s.destino ?? '').filter(Boolean).join(' · ')
}

// Extract airline IATA code from the companhia field (may be "Avianca (AV)" or just "AV")
function extractIata(companhia?: string | null): string {
    if (!companhia) return ''
    // Try match "(XX)" pattern first
    const m = companhia.match(/\(([A-Z]{2,3})\)/)
    if (m) return m[1]
    // Fallback: if it's already a 2-letter code
    if (/^[A-Z]{2}$/.test(companhia.trim())) return companhia.trim()
    return ''
}

// Individual flight leg display
function FlightLeg({
    label, from, to, departure, arrival, duration, stops, stopStr, dateStr,
}: {
    label: string; from: string; to: string; departure: string; arrival: string
    duration: string; stops: number; stopStr: string; dateStr?: string
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>
                    {label}
                </span>
                {dateStr && (
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>· {dateStr}</span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text-primary, #0E2A55)' }}>{departure}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 2 }}>{from}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{duration}</span>
                    <div style={{ position: 'relative', height: 1, background: '#E2EAF5', width: '100%' }}>
                        <Plane size={11} style={{ position: 'absolute', right: -1, top: -5, color: '#94A3B8' }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>
                        {stopLabel(stops, stopStr)}
                    </span>
                </div>
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text-primary, #0E2A55)' }}>{arrival}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 2 }}>{to}</div>
                </div>
            </div>
        </div>
    )
}

// ─── Filter pill button ────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                background: active ? '#0E2A55' : '#F1F5F9',
                color: active ? '#fff' : '#64748B',
                transition: 'all 0.15s',
            }}
        >
            {label}
        </button>
    )
}

export function FlightResultsGrouped({ flights, buscaId, searchInfo, onNewSearch }: FlightResultsGroupedProps) {
    const [selFlight, setSelFlight] = useState<ResultadoVoo | null>(null)
    const [panelOpen, setPanelOpen] = useState(false)
    void setSelFlight

    // ── Filter state ──────────────────────────────────────────────────────────
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [selPrograms, setSelPrograms] = useState<string[]>([])
    const [selStops, setSelStops] = useState<number | null>(null)   // null=all, 0=direct, 1=1stop, 2=2+
    const [selAirlines, setSelAirlines] = useState<string[]>([])
    const [maxPrice, setMaxPrice] = useState<number | null>(null)

    // ── Derived values for filter UI ──────────────────────────────────────────
    const allAirlines = useMemo(() =>
        [...new Set(flights.map(f => f.companhia).filter(Boolean) as string[])].sort()
        , [flights])

    const priceMax = useMemo(() =>
        Math.max(...flights.map(f => f.preco_brl ?? 0), 0)
        , [flights])

    const effectiveMaxPrice = maxPrice ?? priceMax

    const activeFilterCount =
        selPrograms.length +
        (selStops !== null ? 1 : 0) +
        selAirlines.length +
        (maxPrice !== null ? 1 : 0)

    function toggleProgram(p: string) {
        setSelPrograms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
    }
    function toggleAirline(a: string) {
        setSelAirlines(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
    }
    function toggleStop(val: number) {
        setSelStops(prev => prev === val ? null : val)
    }
    function clearFilters() {
        setSelPrograms([]); setSelStops(null); setSelAirlines([]); setMaxPrice(null)
    }

    // ── Filtering logic ───────────────────────────────────────────────────────
    const sorted = useMemo(() => {
        const base = [...flights].sort((a, b) => (a.preco_brl ?? 0) - (b.preco_brl ?? 0))
        return base.filter(f => {
            const det = (f.detalhes as any) ?? {}
            const iata = extractIata(f.companhia)

            // Program filter: use airline→program map
            if (selPrograms.length > 0 && !airlineMatchesPrograms(iata, selPrograms)) return false

            // Stops filter
            if (selStops !== null) {
                const stops = det.paradas ?? 0
                if (selStops === 2 ? stops < 2 : stops !== selStops) return false
            }

            // Airline filter
            if (selAirlines.length > 0 && !selAirlines.includes(f.companhia ?? '')) return false

            // Price filter
            if (effectiveMaxPrice < priceMax && (f.preco_brl ?? 0) > effectiveMaxPrice) return false

            return true
        })
    }, [flights, selPrograms, selStops, selAirlines, effectiveMaxPrice, priceMax])

    if (flights.length === 0) return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
                background: '#fff', border: '1px solid var(--border-light)',
                borderRadius: 16, padding: '60px 40px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                textAlign: 'center',
            }}
        >
            <Plane size={40} color="#CBD5E1" />
            <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--graphite)', marginBottom: 6 }}>
                    Nenhum voo encontrado
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Tente ajustar as datas ou o destino.
                </p>
            </div>
            <button
                onClick={onNewSearch}
                style={{
                    padding: '10px 24px', background: 'var(--blue-medium)', color: '#fff',
                    border: 'none', borderRadius: 10, fontFamily: 'inherit',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
            >
                ← Nova busca
            </button>
        </motion.div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* ── Header ───────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 12,
            }}>
                <div>
                    {searchInfo && (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                            <strong style={{ color: 'var(--text-dark)' }}>{searchInfo.origem}</strong>
                            {' '}→{' '}
                            <strong style={{ color: 'var(--text-dark)' }}>{searchInfo.destino}</strong>
                            {' · '}{formatDate(searchInfo.data_ida)}
                            {' · '}{searchInfo.passageiros} {searchInfo.passageiros === 1 ? 'passageiro' : 'passageiros'}
                        </p>
                    )}
                    <p style={{ fontSize: 12, color: '#94A3B8' }}>
                        {sorted.length} de {flights.length} {flights.length === 1 ? 'opção' : 'opções'} · ordenadas por menor preço
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => setFiltersOpen(o => !o)}
                        style={{
                            background: filtersOpen ? '#0E2A55' : 'none',
                            border: `1px solid ${filtersOpen ? '#0E2A55' : 'var(--border-light)'}`,
                            borderRadius: 10, padding: '7px 14px', fontFamily: 'inherit',
                            fontSize: 12, fontWeight: 600,
                            color: filtersOpen ? '#fff' : 'var(--text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.15s',
                        }}
                    >
                        <SlidersHorizontal size={12} />
                        Filtros
                        {activeFilterCount > 0 && (
                            <span style={{
                                background: filtersOpen ? 'rgba(255,255,255,0.25)' : '#2A60C2',
                                color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800,
                                padding: '0px 6px', minWidth: 16, textAlign: 'center',
                            }}>
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={onNewSearch}
                        style={{
                            background: 'none', border: '1px solid var(--border-light)',
                            borderRadius: 10, padding: '7px 14px', fontFamily: 'inherit',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                        }}
                    >
                        <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Nova busca
                    </button>
                </div>
            </motion.div>

            {/* ── Filter Panel ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {filtersOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden', marginBottom: 12 }}
                    >
                        <div style={{
                            background: '#fff', border: '1px solid #E2EAF5',
                            borderRadius: 14, padding: '16px 20px',
                            display: 'flex', flexDirection: 'column', gap: 16,
                        }}>
                            {/* Row 1: Programs */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                    Programa de milhas
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {TOP_PROGRAMS.map(p => (
                                        <FilterPill
                                            key={p}
                                            label={p}
                                            active={selPrograms.includes(p)}
                                            onClick={() => toggleProgram(p)}
                                        />
                                    ))}
                                </div>
                                {selPrograms.length > 0 && (
                                    <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                                        Mostrando voos emitíveis por: {selPrograms.join(', ')}
                                    </p>
                                )}
                            </div>

                            {/* Row 2: Stops + Airline */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* Stops */}
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                        Paradas
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {[
                                            { val: 0, label: 'Direto' },
                                            { val: 1, label: '1 parada' },
                                            { val: 2, label: '2+' },
                                        ].map(opt => (
                                            <FilterPill
                                                key={opt.val}
                                                label={opt.label}
                                                active={selStops === opt.val}
                                                onClick={() => toggleStop(opt.val)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Airlines */}
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                        Companhia aérea
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {allAirlines.map(a => (
                                            <FilterPill
                                                key={a}
                                                label={a}
                                                active={selAirlines.includes(a)}
                                                onClick={() => toggleAirline(a)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Price slider */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        Preço máximo por pessoa
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>
                                        R$ {effectiveMaxPrice.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={priceMax}
                                    step={50}
                                    value={effectiveMaxPrice}
                                    onChange={e => setMaxPrice(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#2A60C2' }}
                                />
                            </div>

                            {/* Clear */}
                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    style={{
                                        alignSelf: 'flex-start', background: 'none',
                                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                        fontSize: 12, fontWeight: 700, color: '#EF4444',
                                        display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                                    }}
                                >
                                    <X size={12} /> Limpar filtros
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty state after filtering */}
            {sorted.length === 0 && flights.length > 0 && (
                <div style={{
                    textAlign: 'center', padding: '40px 20px',
                    background: '#fff', border: '1px solid #E2EAF5',
                    borderRadius: 14, marginBottom: 12,
                }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0E2A55', marginBottom: 8 }}>
                        Nenhum voo com estes filtros
                    </p>
                    <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>
                        Tente remover alguns filtros para ver mais resultados.
                    </p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        style={{
                            background: '#2A60C2', color: '#fff', border: 'none',
                            borderRadius: 10, padding: '8px 20px', fontFamily: 'inherit',
                            fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        }}
                    >
                        Limpar filtros
                    </button>
                </div>
            )}

            {/* ── Flight cards ─────────────────────────────────────────────── */}
            {sorted.map((flight, idx) => {
                const det = (flight.detalhes as any) ?? {}
                const segsOut = (flight.segmentos as any[]) ?? []
                const segsRet = (det.returnSegmentos as any[]) ?? []
                const hasReturn = !!det.returnPartida
                const iata = extractIata(flight.companhia)

                return (
                    <motion.div
                        key={flight.id ?? idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        style={{
                            background: '#fff',
                            border: '1px solid var(--border-light)',
                            borderRadius: 16,
                            marginBottom: 12,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Top: airline + price */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '14px 20px',
                            borderBottom: '1px solid #F1F5F9',
                            background: idx === 0 ? '#FAFBFF' : '#fff',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 4, height: 28, borderRadius: 4,
                                    background: 'var(--blue-medium, #4A90E2)',
                                }} />
                                <div>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0E2A55' }}>
                                        {flight.companhia}
                                    </span>
                                    {det.voo_numero && (
                                        <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>
                                            {det.voo_numero}
                                        </span>
                                    )}
                                    {/* Program badges for this airline */}
                                    {iata && (
                                        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                                            {['Smiles', 'LATAM Pass', 'TudoAzul', 'Livelo'].filter(p =>
                                                airlineMatchesPrograms(iata, [p])
                                            ).map(prog => (
                                                <span key={prog} style={{
                                                    fontSize: 9, fontWeight: 700, color: '#2A60C2',
                                                    background: '#EEF4FF', padding: '1px 6px', borderRadius: 4,
                                                }}>
                                                    {prog}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {idx === 0 && (
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, color: '#16A34A',
                                        background: '#F0FDF4', padding: '2px 8px', borderRadius: 6,
                                        border: '1px solid #BBF7D0',
                                    }}>
                                        Mais barato
                                    </span>
                                )}
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                                {/* Mock miles preview */}
                                {flight.preco_brl && (
                                    <div style={{
                                        textAlign: 'right', padding: '6px 12px',
                                        background: 'linear-gradient(135deg, #F0F4FF, #E8F0FF)',
                                        borderRadius: 10, border: '1px solid #D4E2FA',
                                    }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#2A60C2', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                                            ✨ Milhas <span style={{ background: '#2A60C2', color: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>estimado</span>
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1E3A7A', letterSpacing: '-0.01em' }}>
                                            ~{(Math.round((flight.preco_brl * 55) / 1000) * 1000).toLocaleString('pt-BR')} pts
                                        </div>
                                        <div style={{ fontSize: 10, color: '#64748B' }}>
                                            + R$ {Math.round(flight.preco_brl * 0.15).toLocaleString('pt-BR')} taxas
                                        </div>
                                    </div>
                                )}
                                {/* Cash price */}
                                <div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0E2A55', letterSpacing: '-0.02em' }}>
                                        R$ {flight.preco_brl?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94A3B8' }}>por pessoa</div>
                                </div>
                            </div>
                        </div>

                        {/* Outbound leg */}
                        <div style={{ padding: '16px 20px', borderBottom: hasReturn ? '1px dashed #E2EAF5' : 'none' }}>
                            <FlightLeg
                                label="Ida"
                                from={flight.origem ?? ''}
                                to={flight.destino ?? ''}
                                departure={formatTime(flight.partida)}
                                arrival={formatTime(flight.chegada)}
                                duration={formatDur(flight.duracao_min)}
                                stops={det.paradas ?? 0}
                                stopStr={stopCodes(segsOut)}
                                dateStr={formatDate(flight.partida)}
                            />
                        </div>

                        {/* Return leg */}
                        {hasReturn && (
                            <div style={{ padding: '16px 20px', background: '#FAFBFF' }}>
                                <FlightLeg
                                    label="Volta"
                                    from={det.returnOrigem ?? ''}
                                    to={det.returnDestino ?? ''}
                                    departure={formatTime(det.returnPartida)}
                                    arrival={formatTime(det.returnChegada)}
                                    duration={formatDur(det.returnDuracaoMin)}
                                    stops={det.returnParadas ?? 0}
                                    stopStr={stopCodes(segsRet)}
                                    dateStr={formatDate(det.returnPartida)}
                                />
                            </div>
                        )}
                    </motion.div>
                )
            })}

            {panelOpen && selFlight && (
                <StrategyPanel
                    open={panelOpen}
                    flight={selFlight}
                    buscaId={buscaId}
                    onClose={() => setPanelOpen(false)}
                />
            )}
        </div>
    )
}
