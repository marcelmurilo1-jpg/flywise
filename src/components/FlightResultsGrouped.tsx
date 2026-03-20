import { useState, useMemo, useEffect } from 'react'
import { Plane, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResultadoVoo } from '@/lib/supabase'
import { StrategyPanel } from '@/components/StrategyPanel'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { airlineMatchesPrograms } from '@/lib/airlineMilesMapping'
import type { FilterState } from '@/components/Sidebar'

interface SearchInfo { origem: string; destino: string; data_ida: string; passageiros: number }
interface FlightResultsGroupedProps {
    flights: ResultadoVoo[]
    inboundFlights?: ResultadoVoo[]
    buscaId: number
    searchInfo?: SearchInfo
    onNewSearch: () => void
    sidebarFilters?: FilterState
    returnDate?: string
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

// ─── Compact card shown after selecting a flight (mirrors miles section) ─────
function SelectedFlightCard({
    flight, label, onChangeSelection,
}: {
    flight: ResultadoVoo; label: string; onChangeSelection?: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const det = (flight.detalhes as any) ?? {}
    const segsOut = (flight.segmentos as any[]) ?? []
    const layoverCity = det.layoverCity || ''
    const connectionStr = layoverCity
        ? `${det.paradas ?? 1} conexão · ${layoverCity}`
        : stopCodes(segsOut)

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: '#fff', border: '2px solid #16A34A', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}
        >
            <div style={{ background: '#16A34A', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} color="#fff" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>{label}</span>
                </div>
                {onChangeSelection && (
                    <button onClick={onChangeSelection}
                        style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>
                        ← Mudar ida
                    </button>
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 4, height: 32, borderRadius: 4, background: '#0E2A55' }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0E2A55' }}>{flight.companhia}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{formatDate(flight.partida)}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'center', minWidth: 44 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{formatTime(flight.partida)}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginTop: 2 }}>{flight.origem}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 80 }}>
                        {!!flight.duracao_min && <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{formatDur(flight.duracao_min)}</span>}
                        <div style={{ position: 'relative', height: 1, background: '#BBF7D0', width: '100%' }}>
                            <Plane size={11} style={{ position: 'absolute', right: -1, top: -5, color: '#16A34A' }} />
                        </div>
                        <span style={{ fontSize: 10, color: (det.paradas ?? 0) === 0 ? '#16A34A' : '#94A3B8', fontWeight: (det.paradas ?? 0) === 0 ? 700 : 400 }}>
                            {stopLabel(det.paradas ?? 0, connectionStr)}
                        </span>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 44 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{formatTime(flight.chegada)}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginTop: 2 }}>{flight.destino}</div>
                    </div>
                </div>
                {(flight.preco_brl ?? 0) > 0 && (
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em' }}>
                        R$ {flight.preco_brl?.toLocaleString('pt-BR')}
                    </div>
                )}
            </div>
            {/* Segment details (expandable) */}
            {expanded && segsOut.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#F8FAFC', borderTop: '1px dashed #E2EAF5' }}>
                    {segsOut.map((seg: any, si: number) => {
                        const segDep = seg.partida?.includes('T') ? seg.partida.slice(11, 16) : (seg.partida?.slice(0, 5) || '')
                        const segArr = seg.chegada?.includes('T') ? seg.chegada.slice(11, 16) : (seg.chegada?.slice(0, 5) || '')
                        const connDur = det.layoverDurations?.[si]
                        return (
                            <div key={si}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                                    <div style={{ minWidth: 40, textAlign: 'right' }}>
                                        {segDep && <div style={{ fontSize: 13, fontWeight: 800, color: '#0E2A55' }}>{segDep}</div>}
                                        {seg.duracao_min > 0 && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 14 }}>{formatDur(seg.duracao_min)}</div>}
                                        {segArr && <div style={{ fontSize: 13, fontWeight: 800, color: '#0E2A55', marginTop: seg.duracao_min > 0 ? 0 : 28 }}>{segArr}</div>}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #16A34A', background: '#fff' }} />
                                        <div style={{ width: 2, flex: 1, background: '#BBF7D0', margin: '3px 0' }} />
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #16A34A', background: '#fff' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55' }}>{seg.origem}</div>
                                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
                                            {[seg.companhia_seg || flight.companhia, seg.numero, seg.aeronave].filter(Boolean).join(' · ')}
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55' }}>{seg.destino}</div>
                                    </div>
                                </div>
                                {si < segsOut.length - 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 4px 58px', borderTop: '1px dashed #E2EAF5', borderBottom: '1px dashed #E2EAF5', margin: '2px 0' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: '#FFF7ED', padding: '2px 8px', borderRadius: 6 }}>
                                            Conexão{layoverCity ? ` em ${layoverCity}` : ''}{connDur ? ` · ${formatDur(connDur)}` : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
            <button
                onClick={() => setExpanded(e => !e)}
                style={{
                    width: '100%', background: 'none', border: 'none', borderTop: '1px solid #F0FDF4',
                    padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    cursor: 'pointer', color: '#16A34A', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                }}
            >
                {expanded ? <><ChevronUp size={12} /> Ocultar detalhes</> : <><ChevronDown size={12} /> Ver detalhes do voo</>}
            </button>
        </motion.div>
    )
}

export function FlightResultsGrouped({ flights, inboundFlights = [], buscaId, searchInfo, onNewSearch, sidebarFilters, returnDate }: FlightResultsGroupedProps) {
    const [selFlight, setSelFlight] = useState<ResultadoVoo | null>(null)
    const [panelOpen, setPanelOpen] = useState(false)
    const [amadPhase, setAmadPhase] = useState<'browsing' | 'ida-sel' | 'confirmed'>('browsing')
    const [amadSel, setAmadSel] = useState<ResultadoVoo | null>(null)
    const [amadReturnSel, setAmadReturnSel] = useState<ResultadoVoo | null>(null)
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
    function toggleExpand(id: string) {
        setExpandedCards(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // Reset selection when flights list changes (new search)
    useEffect(() => {
        setAmadPhase('browsing')
        setAmadSel(null)
    }, [flights])

    // Keep selFlight in sync when flights list is updated with DB-assigned IDs
    useEffect(() => {
        if (!selFlight) return
        const updated = [...flights, ...inboundFlights].find(f =>
            f.origem === selFlight.origem &&
            f.destino === selFlight.destino &&
            f.partida === selFlight.partida &&
            f.companhia === selFlight.companhia &&
            f.id !== selFlight.id
        )
        if (updated) setSelFlight(updated)
    }, [flights, inboundFlights, selFlight])

    // (filtros gerenciados pela Sidebar — sem estado interno duplicado)

    // ── Filtering and Sorting (usa sidebarFilters diretamente) ───────────────
    const sorted = useMemo(() => {
        let base = [...flights]

        // Paradas (fix: usa f.paradas, não det.paradas)
        if (sidebarFilters?.stops && sidebarFilters.stops.length > 0) {
            base = base.filter(f => {
                const stops = (f as any).paradas ?? 0
                if (sidebarFilters.stops.includes('direct') && stops === 0) return true
                if (sidebarFilters.stops.includes('1stop') && stops === 1) return true
                if (sidebarFilters.stops.includes('2plus') && stops >= 2) return true
                return false
            })
        }

        // Companhia aérea
        if (sidebarFilters?.airlines && sidebarFilters.airlines.length > 0) {
            base = base.filter(f => sidebarFilters.airlines.includes(f.companhia ?? ''))
        }

        // Preço máximo
        if (sidebarFilters?.maxPrice !== null && sidebarFilters?.maxPrice !== undefined) {
            base = base.filter(f => (f.preco_brl ?? 0) <= sidebarFilters.maxPrice!)
        }

        // Ordenar
        if (sidebarFilters?.sortBy === 'duration') {
            base.sort((a, b) => (a.duracao_min ?? 0) - (b.duracao_min ?? 0))
        } else {
            base.sort((a, b) => (a.preco_brl ?? 0) - (b.preco_brl ?? 0))
        }

        return base
    }, [flights, sidebarFilters])

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

    const labelMap: Record<string, string> = {
        best: 'melhor custo-benefício',
        price: 'menor preço',
        duration: 'menor duração'
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <style>{`
            @media (max-width: 768px) {
                .fly-card-top {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                    gap: 12px !important;
                }
                .fly-card-right {
                    width: 100% !important;
                    flex-direction: row !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                }
                .fly-card-actions {
                    flex-direction: column !important;
                }
                .fly-card-actions button { width: 100%; }
            }
        `}</style>
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
                        {sorted.length} de {flights.length} {flights.length === 1 ? 'opção' : 'opções'} · ordenadas por {labelMap[sidebarFilters?.sortBy ?? 'best']}
                    </p>
                </div>
            </motion.div>

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
                    <p style={{ fontSize: 13, color: '#94A3B8' }}>
                        Tente remover alguns filtros na barra lateral.
                    </p>
                </div>
            )}

            {/* ── Flight cards ─────────────────────────────────────────────── */}
            {(() => {
                const hasInbound = inboundFlights.length > 0
                const isRoundTrip = !!returnDate || sorted.some(f => !!(f.detalhes as any)?.returnPartida) || hasInbound
                function FlightCard({ flight, idx, isReturn = false }: { flight: ResultadoVoo; idx: number; isReturn?: boolean }) {
                    const det = (flight.detalhes as any) ?? {}
                    const segsOut = (flight.segmentos as any[]) ?? []
                    const segsRet = (det.returnSegmentos as any[]) ?? []
                    const hasReturn = !!det.returnPartida
                    const iata = extractIata(flight.companhia)

                    const showReturn = hasReturn && !hasInbound
                    const cardId = flight.flight_key ?? `${idx}`
                    const isExpanded = expandedCards.has(cardId)
                    const layoverCity = det.layoverCity || ''
                    const connectionStr = layoverCity
                        ? `${det.paradas ?? 1} conexão · ${layoverCity}`
                        : stopCodes(segsOut)

                    return (
                        <motion.div
                            key={cardId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
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
                            <div className="fly-card-top" style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '16px 20px', borderBottom: '1px solid #F1F5F9',
                                background: idx === 0 && sidebarFilters?.sortBy === 'price' ? '#FAFBFF' : '#fff',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 4, height: 32, borderRadius: 4, background: '#0E2A55' }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 15, fontWeight: 700, color: '#0E2A55' }}>{flight.companhia}</span>
                                            {det.voo_numero && <span style={{ fontSize: 11, color: '#94A3B8' }}>{det.voo_numero}</span>}
                                        </div>
                                        {iata && (
                                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                                {['Smiles', 'LATAM Pass', 'TudoAzul', 'Livelo'].filter(p => airlineMatchesPrograms(iata, [p])).map(prog => (
                                                    <span key={prog} style={{ fontSize: 9, fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>{prog}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="fly-card-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#0E2A55', textTransform: 'uppercase', marginBottom: 2 }}>Preço</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', letterSpacing: '-0.01em' }}>
                                                {(flight.preco_brl ?? 0) > 0 ? `R$ ${flight.preco_brl?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}
                                            </div>
                                            <div style={{ fontSize: 9, color: '#94A3B8' }}>{(flight.preco_brl ?? 0) > 0 ? 'preço final' : 'incl. na ida'}</div>
                                        </div>
                                    </div>
                                    <div className="fly-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {isReturn ? (
                                            <button onClick={() => { setAmadReturnSel(flight); setAmadPhase('confirmed') }}
                                                style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                                                Confirmar Volta ✓
                                            </button>
                                        ) : (
                                            <>
                                                {amadPhase === 'browsing' && isRoundTrip && (
                                                    <button onClick={() => { setAmadSel(flight); setAmadPhase('ida-sel') }}
                                                        style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                                                        Selecionar →
                                                    </button>
                                                )}
                                                <button onClick={() => { setSelFlight(flight); setPanelOpen(true) }}
                                                    style={{ background: 'none', color: '#0E2A55', border: '1px solid #CBD5E1', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                                                    Ver Detalhes
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Outbound leg */}
                            <div style={{ padding: '16px 20px', borderBottom: (showReturn || isExpanded) ? '1px dashed #E2EAF5' : 'none' }}>
                                <FlightLeg
                                    label={isReturn ? 'Volta' : 'Ida'}
                                    from={flight.origem ?? ''} to={flight.destino ?? ''}
                                    departure={formatTime(flight.partida)} arrival={formatTime(flight.chegada)}
                                    duration={formatDur(flight.duracao_min)}
                                    stops={det.paradas ?? 0}
                                    stopStr={connectionStr}
                                    dateStr={formatDate(flight.partida)}
                                />
                            </div>

                            {/* Return leg (Amadeus combined) */}
                            {showReturn && (
                                <div style={{ padding: '16px 20px', background: '#FAFBFF', borderBottom: isExpanded ? '1px dashed #E2EAF5' : 'none' }}>
                                    <FlightLeg label="Volta" from={det.returnOrigem ?? ''} to={det.returnDestino ?? ''} departure={formatTime(det.returnPartida)} arrival={formatTime(det.returnChegada)} duration={formatDur(det.returnDuracaoMin)} stops={det.returnParadas ?? 0} stopStr={stopCodes(segsRet)} dateStr={formatDate(det.returnPartida)} />
                                </div>
                            )}

                            {/* Expandable segment details */}
                            {isExpanded && (
                                <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px dashed #E2EAF5' }}>
                                    {segsOut.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                            {segsOut.map((seg: any, si: number) => {
                                                const segDep = seg.partida?.includes('T') ? seg.partida.slice(11, 16) : (seg.partida?.slice(0, 5) || '')
                                                const segArr = seg.chegada?.includes('T') ? seg.chegada.slice(11, 16) : (seg.chegada?.slice(0, 5) || '')
                                                const connDur = det.layoverDurations?.[si]
                                                return (
                                                    <div key={si}>
                                                        {/* Segment row */}
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                                                            {/* Times column */}
                                                            <div style={{ minWidth: 40, textAlign: 'right' }}>
                                                                {segDep && <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55' }}>{segDep}</div>}
                                                                {seg.duracao_min > 0 && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 14 }}>{formatDur(seg.duracao_min)}</div>}
                                                                {segArr && <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55', marginTop: seg.duracao_min > 0 ? 0 : 28 }}>{segArr}</div>}
                                                            </div>
                                                            {/* Line */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2A60C2', background: '#fff' }} />
                                                                <div style={{ width: 2, flex: 1, background: '#E2EAF5', margin: '3px 0' }} />
                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2A60C2', background: '#fff' }} />
                                                            </div>
                                                            {/* Info column */}
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55' }}>{seg.origem}</div>
                                                                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
                                                                    {[seg.companhia_seg || flight.companhia, seg.numero, seg.aeronave].filter(Boolean).join(' · ')}
                                                                </div>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55' }}>{seg.destino}</div>
                                                            </div>
                                                        </div>
                                                        {/* Layover between segments */}
                                                        {si < segsOut.length - 1 && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 6px 58px', borderTop: '1px dashed #E2EAF5', borderBottom: '1px dashed #E2EAF5', margin: '2px 0' }}>
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: '#FFF7ED', padding: '2px 8px', borderRadius: 6 }}>
                                                                    Conexão{layoverCity ? ` em ${layoverCity}` : ''}{connDur ? ` · ${formatDur(connDur)}` : ''}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (det.paradas ?? 0) > 0 ? (
                                        <div style={{ fontSize: 12, color: '#64748B' }}>
                                            {layoverCity
                                                ? <><span style={{ fontWeight: 600 }}>Conexão em</span> {layoverCity}{det.layoverDurations?.[0] ? ` · ${formatDur(det.layoverDurations[0])}` : ''}</>
                                                : `${det.paradas} ${det.paradas === 1 ? 'conexão' : 'conexões'}`
                                            }
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>✓ Voo direto</div>
                                    )}
                                    {/* Flight numbers + aircraft (fallback when no segments extracted) */}
                                    {segsOut.length === 0 && (det.numeroVoos?.length > 0 || det.aeronaves?.length > 0) && (
                                        <div style={{ marginTop: 8, fontSize: 11, color: '#64748B' }}>
                                            {det.numeroVoos?.join(' · ')}{det.aeronaves?.length > 0 ? ` · ${det.aeronaves.join(', ')}` : ''}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Expand/collapse toggle */}
                            <button
                                onClick={() => toggleExpand(cardId)}
                                style={{
                                    width: '100%', background: 'none', border: 'none', borderTop: '1px solid #F1F5F9',
                                    padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                    cursor: 'pointer', color: '#64748B', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                                }}
                            >
                                {isExpanded ? <><ChevronUp size={13} /> Ocultar detalhes</> : <><ChevronDown size={13} /> Ver detalhes do voo</>}
                            </button>

                        </motion.div>
                    )
                }

                return (
                    <>
                        {/* ── Browsing: lista todos os voos de ida ─── */}
                        {amadPhase === 'browsing' && (
                            <AnimatePresence>
                                {sorted.map((flight, idx) => (
                                    <FlightCard key={flight.flight_key ?? idx} flight={flight} idx={idx} />
                                ))}
                            </AnimatePresence>
                        )}

                        {/* ── IDA selecionada — card compacto (estilo milhas) ─── */}
                        {(amadPhase === 'ida-sel' || amadPhase === 'confirmed') && amadSel && (
                            <SelectedFlightCard
                                flight={amadSel}
                                label="IDA SELECIONADA"
                                onChangeSelection={amadPhase === 'ida-sel'
                                    ? () => { setAmadPhase('browsing'); setAmadSel(null); setAmadReturnSel(null) }
                                    : undefined}
                            />
                        )}

                        {/* ── Fase ida-sel: voos de volta ─── */}
                        {amadPhase === 'ida-sel' && hasInbound && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
                                    <div style={{ flex: 1, height: 1, background: '#BBF7D0' }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap' }}>
                                        ✈ Selecione o voo de volta
                                    </span>
                                    <div style={{ flex: 1, height: 1, background: '#BBF7D0' }} />
                                </div>
                                <AnimatePresence>
                                    {inboundFlights.map((flight, idx) => (
                                        <FlightCard key={flight.flight_key ?? `in-${idx}`} flight={flight} idx={idx} isReturn />
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {/* Amadeus combinado: botão confirmar volta */}
                        {amadPhase === 'ida-sel' && amadSel && !!(amadSel.detalhes as any)?.returnPartida && !hasInbound && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                <button onClick={() => setAmadPhase('confirmed')}
                                    style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Confirmar Volta →
                                </button>
                            </div>
                        )}

                        {/* Nenhum voo de volta encontrado */}
                        {amadPhase === 'ida-sel' && isRoundTrip && !hasInbound && !(amadSel && !!(amadSel.detalhes as any)?.returnPartida) && (
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '14px 20px', marginBottom: 12, fontSize: 13, color: '#92400E' }}>
                                Nenhum voo de volta encontrado para a data selecionada. Tente buscar novamente com outra data de volta.
                            </motion.div>
                        )}

                        {/* ── Confirmado: VOLTA + total ─── */}
                        {amadPhase === 'confirmed' && (
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column' }}>
                                {amadReturnSel && (
                                    <SelectedFlightCard flight={amadReturnSel} label="VOLTA CONFIRMADA" />
                                )}
                                <div style={{ background: '#0E2A55', borderRadius: 12, padding: '14px 20px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Total (ida + volta)</span>
                                    <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
                                        R$ {((amadSel?.preco_brl ?? 0) + (amadReturnSel?.preco_brl ?? 0)).toLocaleString('pt-BR')}
                                    </span>
                                </div>
                                <button onClick={() => { setAmadPhase('browsing'); setAmadSel(null); setAmadReturnSel(null) }}
                                    style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
                                    ← Escolher novamente
                                </button>
                            </motion.div>
                        )}
                    </>
                )
            })()}

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
