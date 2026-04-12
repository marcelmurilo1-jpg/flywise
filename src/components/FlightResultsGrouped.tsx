import { useState, useMemo } from 'react'
import { Plane, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResultadoVoo } from '@/lib/supabase'
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
    cashIdaSel?: ResultadoVoo | null
    onSelectCashIda?: (f: ResultadoVoo | null) => void
    cashVoltaSel?: ResultadoVoo | null
    onSelectCashVolta?: (f: ResultadoVoo | null) => void
    onMonitorar?: (flight: ResultadoVoo) => void
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
function extractIata(companhia?: string | null): string {
    if (!companhia) return ''
    const m = companhia.match(/\(([A-Z]{2,3})\)/)
    if (m) return m[1]
    if (/^[A-Z]{2}$/.test(companhia.trim())) return companhia.trim()
    return ''
}

// ── Google Flights tfs protobuf builder ───────────────────────────────────────
// O formato #flt= foi depreciado; Google Flights agora usa ?tfs= (protobuf binário).
// Itinerários de ida e volta são AMBOS codificados como field 3 repetido.

function _gfVarint(buf: number[], val: number) {
    while (val > 0x7F) { buf.push((val & 0x7F) | 0x80); val >>>= 7 }
    buf.push(val & 0x7F)
}
function _gfInt(buf: number[], field: number, val: number) {
    _gfVarint(buf, (field << 3) | 0)
    _gfVarint(buf, val)
}
function _gfStr(buf: number[], field: number, str: string) {
    _gfVarint(buf, (field << 3) | 2)
    _gfVarint(buf, str.length)
    for (let i = 0; i < str.length; i++) buf.push(str.charCodeAt(i))
}
function _gfMsg(buf: number[], field: number, bytes: number[]) {
    _gfVarint(buf, (field << 3) | 2)
    _gfVarint(buf, bytes.length)
    for (let i = 0; i < bytes.length; i++) buf.push(bytes[i])
}

interface _GfSeg { from: string; to: string; date: string; carrier?: string; flightNum?: string }

function _buildGfSegProto(seg: _GfSeg): number[] {
    const b: number[] = []
    _gfStr(b, 1, seg.from); _gfStr(b, 2, seg.date); _gfStr(b, 3, seg.to)
    if (seg.carrier) _gfStr(b, 5, seg.carrier)
    if (seg.flightNum) _gfStr(b, 6, seg.flightNum)
    return b
}

function _buildGfEntity(iata: string): number[] {
    const b: number[] = []
    _gfInt(b, 1, 1) // type = 1 (airport code)
    _gfStr(b, 2, iata)
    return b
}

function _buildGfItinProto(segs: _GfSeg[]): number[] {
    const b: number[] = []
    if (segs[0]) _gfStr(b, 2, segs[0].date)
    for (const seg of segs) _gfMsg(b, 4, _buildGfSegProto(seg))
    // fields 13/14: origin and final-destination airport entities
    if (segs[0]?.from) _gfMsg(b, 13, _buildGfEntity(segs[0].from))
    if (segs.length > 0 && segs[segs.length - 1]?.to) _gfMsg(b, 14, _buildGfEntity(segs[segs.length - 1].to))
    return b
}

function _segsFromOffer(rawSegs: any[], flightNums: string[], from: string, to: string, date: string): _GfSeg[] {
    if (rawSegs.length > 0) {
        return rawSegs.map((s: any, i: number) => {
            const num = s.numero || flightNums[i] || ''
            return {
                from: (s.origem || (i === 0 ? from : '')).toUpperCase(),
                to: (s.destino || (i === rawSegs.length - 1 ? to : '')).toUpperCase(),
                date,
                carrier: num.match(/^([A-Z]{2})/)?.[1],
                flightNum: num.match(/([0-9]+)$/)?.[1],
            }
        }).filter((s: _GfSeg) => s.from && s.to)
    }
    // Sem segmentos detalhados: busca simples origem→destino
    const num = flightNums[0] || ''
    return [{ from, to, date, carrier: num.match(/^([A-Z]{2})/)?.[1], flightNum: num.match(/([0-9]+)$/)?.[1] }]
}

function _buildTfsUrl(outSegs: _GfSeg[], retSegs?: _GfSeg[], adults = 1): string {
    const buf: number[] = []
    _gfInt(buf, 1, 28) // field 1 = 28
    _gfInt(buf, 2, 2)  // field 2 = 2
    _gfMsg(buf, 3, _buildGfItinProto(outSegs))
    // Volta: field 3 repetido (não field 4) — padrão do protobuf do Google Flights
    if (retSegs?.length) _gfMsg(buf, 3, _buildGfItinProto(retSegs))
    _gfInt(buf, 8, adults) // número de adultos
    _gfInt(buf, 9, 1)   // required by Google Flights (observed in real URLs)
    _gfInt(buf, 14, 1)  // required by Google Flights (observed in real URLs)
    // Converter para base64url sem spread (evita limite de argumentos)
    let str = ''
    for (let i = 0; i < buf.length; i++) str += String.fromCharCode(buf[i])
    const b64 = btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    return `https://www.google.com/travel/flights?tfs=${b64}&hl=pt-BR&gl=BR&curr=BRL`
}

function buildGoogleFlightsUrl(
    outbound: ResultadoVoo,
    inbound?: ResultadoVoo | null,
    passageiros = 1
): string {
    const o = (outbound.origem ?? '').toUpperCase()
    const d = (outbound.destino ?? '').toUpperCase()
    const date = outbound.partida?.split('T')[0] ?? ''
    if (!o || !d || !date) return 'https://www.google.com/travel/flights?hl=pt-BR'

    const det = (outbound.detalhes as any) ?? {}
    const segsOut = (outbound.segmentos as any[]) ?? []
    const numVoos: string[] = (det.numeroVoos as string[]) ?? []

    const outSegs = _segsFromOffer(segsOut, numVoos, o, d, date)

    // Voo de volta: inbound explícito OU oferta combinada Amadeus
    const returnDate = inbound?.partida?.split('T')[0] ?? det.returnPartida?.split('T')[0]
    let retSegs: _GfSeg[] | undefined
    if (returnDate) {
        const ro = (inbound?.origem ?? det.returnOrigem ?? d as string).toUpperCase()
        const rd = (inbound?.destino ?? det.returnDestino ?? o as string).toUpperCase()
        const retRaw = (inbound?.segmentos as any[]) ?? (det.returnSegmentos as any[]) ?? []
        retSegs = _segsFromOffer(retRaw, [], ro, rd, returnDate)
    }

    return _buildTfsUrl(outSegs, retSegs, passageiros)
}

// ── Individual flight leg ──────────────────────────────────────────────────────
function FlightLeg({
    label, from, to, departure, arrival, duration, stops, stopStr, dateStr,
}: {
    label: string; from: string; to: string; departure: string; arrival: string
    duration: string; stops: number; stopStr: string; dateStr?: string
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>{label}</span>
                {dateStr && <span style={{ fontSize: 10, color: '#94A3B8' }}>· {dateStr}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: '#0E2A55' }}>{departure}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 2 }}>{from}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{duration}</span>
                    <div style={{ position: 'relative', height: 1, background: '#E2EAF5', width: '100%' }}>
                        <Plane size={11} style={{ position: 'absolute', right: -1, top: -5, color: '#94A3B8' }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{stopLabel(stops, stopStr)}</span>
                </div>
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: '#0E2A55' }}>{arrival}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 2 }}>{to}</div>
                </div>
            </div>
        </div>
    )
}

// ── Details panel for expanded card ───────────────────────────────────────────
function FlightDetails({ flight, det, segsOut, layoverCity }: {
    flight: ResultadoVoo; det: any; segsOut: any[]; layoverCity: string
}) {
    // Amadeus: full per-segment data
    if (segsOut.length > 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {segsOut.map((seg: any, si: number) => {
                    const segDep = seg.partida?.includes('T') ? seg.partida.slice(11, 16) : (seg.partida?.slice(0, 5) || '')
                    const segArr = seg.chegada?.includes('T') ? seg.chegada.slice(11, 16) : (seg.chegada?.slice(0, 5) || '')
                    const connDur = det.layoverDurations?.[si]
                    return (
                        <div key={si}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                                <div style={{ minWidth: 40, textAlign: 'right' }}>
                                    {segDep && <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55' }}>{segDep}</div>}
                                    {seg.duracao_min > 0 && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 14 }}>{formatDur(seg.duracao_min)}</div>}
                                    {segArr && <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55', marginTop: seg.duracao_min > 0 ? 0 : 28 }}>{segArr}</div>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2A60C2', background: '#fff' }} />
                                    <div style={{ width: 2, flex: 1, background: '#E2EAF5', margin: '3px 0' }} />
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2A60C2', background: '#fff' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55' }}>{seg.origem}</div>
                                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>
                                        {[seg.companhia_seg || flight.companhia, seg.numero, seg.aeronave].filter(Boolean).join(' · ')}
                                    </div>
                                    {seg.cabin_class_seg && (
                                        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>{seg.cabin_class_seg}</div>
                                    )}
                                    {seg.legroom && (
                                        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>{seg.legroom}</div>
                                    )}
                                    {seg.amenities?.length > 0 && (
                                        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>{seg.amenities.join(' · ')}</div>
                                    )}
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55', marginTop: 4 }}>{seg.destino}</div>
                                </div>
                            </div>
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
        )
    }

    // Google Flights: build timeline from available data
    const dep = formatTime(flight.partida)
    const arr = formatTime(flight.chegada)
    const paradas = det.paradas ?? 0
    const layoverDurs: number[] = det.layoverDurations ?? []
    const flightNums: string[] = det.numeroVoos ?? []
    const aircrafts: string[] = det.aeronaves ?? []

    // Build virtual "points" for the timeline
    // Each layoverCity may be "BOG" or "BOG · MIA" (multi-stop)
    const stopCities = layoverCity ? layoverCity.split(' · ') : Array(paradas).fill('')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Departure */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                <div style={{ minWidth: 40, textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55' }}>{dep}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2A60C2', background: '#fff' }} />
                    <div style={{ width: 2, flex: 1, minHeight: 20, background: '#E2EAF5', margin: '3px 0' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55' }}>{flight.origem}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                        {[flight.companhia, flightNums[0]].filter(Boolean).join(' · ')}
                        {aircrafts[0] && <span style={{ marginLeft: 4 }}>· {aircrafts[0]}</span>}
                    </div>
                    {formatDur(flight.duracao_min) && (
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>Duração total: {formatDur(flight.duracao_min)}</div>
                    )}
                </div>
            </div>

            {/* Layover banners */}
            {stopCities.map((city, si) => (
                <div key={si}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0 5px 58px', borderTop: '1px dashed #E2EAF5', borderBottom: '1px dashed #E2EAF5', margin: '2px 0' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: '#FFF7ED', padding: '2px 8px', borderRadius: 6 }}>
                            {city ? `Conexão em ${city}` : `Conexão ${si + 1}`}{layoverDurs[si] ? ` · ${formatDur(layoverDurs[si])}` : ''}
                        </span>
                    </div>
                    {/* Next leg info between stops */}
                    {si < stopCities.length - 1 && flightNums[si + 1] && (
                        <div style={{ padding: '4px 0 4px 58px', fontSize: 10, color: '#94A3B8' }}>
                            {[flightNums[si + 1], aircrafts[si + 1]].filter(Boolean).join(' · ')}
                        </div>
                    )}
                </div>
            ))}

            {/* Arrival */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                <div style={{ minWidth: 40, textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55' }}>{arr}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2A60C2', background: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0E2A55' }}>{flight.destino}</div>
                    {flightNums.length > 1 && (
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                            {[flightNums[flightNums.length - 1], aircrafts[aircrafts.length - 1]].filter(Boolean).join(' · ')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── FlightCard — module-level component (prevents re-mount flash) ──────────────
interface FlightCardProps {
    flight: ResultadoVoo
    idx: number
    isReturn?: boolean
    isPinned?: boolean
    isExpanded: boolean
    onToggleExpand: () => void
    canSelect: boolean
    isSelected: boolean
    onSelect: () => void
    onClear?: () => void
    hasInboundFlights: boolean
    sortBy?: string
    onMonitorar?: (flight: ResultadoVoo) => void
}

function FlightCard({
    flight, idx, isReturn = false, isPinned = false,
    isExpanded, onToggleExpand,
    canSelect, isSelected, onSelect, onClear,
    hasInboundFlights, sortBy, onMonitorar,
}: FlightCardProps) {
    const det = (flight.detalhes as any) ?? {}
    const segsOut = (flight.segmentos as any[]) ?? []
    const hasReturn = !!det.returnPartida
    const iata = det.carrierCode || extractIata(flight.companhia)
    const showReturn = hasReturn && !hasInboundFlights
    const layoverCity = det.layoverCity || ''
    const connectionStr = layoverCity || stopCodes(segsOut)

    const airlineName = flight.companhia && !flight.companhia.startsWith('Companhia')
        ? flight.companhia
        : (iata && iata !== 'XX' ? iata : 'Companhia aérea')

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ delay: isPinned ? 0 : idx * 0.04 }}
            style={{
                background: '#fff',
                border: (isSelected || isPinned) ? '2px solid #16A34A' : '1px solid var(--border-light)',
                borderRadius: 16,
                marginBottom: 12,
                overflow: 'hidden',
            }}
        >
            {/* Pinned badge */}
            {isPinned && (
                <div style={{ background: '#16A34A', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
                        ✓ {isReturn ? 'VOLTA SELECIONADA' : 'IDA SELECIONADA'}
                    </span>
                    {onClear && (
                        <button onClick={onClear} style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>
                            ← {isReturn ? 'Mudar volta' : 'Mudar ida'}
                        </button>
                    )}
                </div>
            )}

            {/* Top: airline + price */}
            <div className="fly-card-top" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', borderBottom: '1px solid #F1F5F9',
                background: !isPinned && idx === 0 && sortBy === 'price' ? '#FAFBFF' : '#fff',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 4, height: 32, borderRadius: 4, background: '#0E2A55' }} />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#0E2A55' }}>{airlineName}</span>
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
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0E2A55', textTransform: 'uppercase', marginBottom: 2 }}>
                            {det.isRoundtripTotal ? 'Ida + Volta' : 'Preço'}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', letterSpacing: '-0.01em' }}>
                            {(flight.preco_brl ?? 0) > 0 ? `R$ ${flight.preco_brl?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}
                        </div>
                        <div style={{ fontSize: 9, color: '#94A3B8' }}>
                            {det.isRoundtripTotal ? 'total ida+volta' : ((flight.preco_brl ?? 0) > 0 ? 'preço final' : 'incl. na ida')}
                        </div>
                    </div>
                    {canSelect && !isPinned && (flight.preco_brl ?? 0) > 0 && (
                        <button
                            onClick={onSelect}
                            style={{
                                background: isSelected ? '#16A34A' : 'none',
                                color: isSelected ? '#fff' : '#64748B',
                                border: `1px solid ${isSelected ? '#16A34A' : '#CBD5E1'}`,
                                borderRadius: 8, padding: '6px 12px',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
                            }}
                        >
                            {isSelected ? '✓ Selecionado' : isReturn ? 'Selecionar volta' : 'Selecionar ida'}
                        </button>
                    )}
                    {onMonitorar && (flight.preco_brl ?? 0) > 0 && (
                        <button
                            onClick={() => onMonitorar(flight)}
                            style={{
                                background: '#FEF3C7', color: '#D97706', border: 'none', borderRadius: 8,
                                padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                            }}
                        >
                            🔔
                        </button>
                    )}
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

            {/* Return leg (combined Amadeus offer) */}
            {showReturn && (
                <div style={{ padding: '16px 20px', background: '#FAFBFF', borderBottom: isExpanded ? '1px dashed #E2EAF5' : 'none' }}>
                    <FlightLeg
                        label="Volta"
                        from={det.returnOrigem ?? ''} to={det.returnDestino ?? ''}
                        departure={formatTime(det.returnPartida)} arrival={formatTime(det.returnChegada)}
                        duration={formatDur(det.returnDuracaoMin)}
                        stops={det.returnParadas ?? 0}
                        stopStr={stopCodes((det.returnSegmentos as any[]) ?? [])}
                        dateStr={formatDate(det.returnPartida)}
                    />
                </div>
            )}

            {/* Expandable details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px dashed #E2EAF5' }}>
                            <FlightDetails
                                flight={flight}
                                det={det}
                                segsOut={segsOut}
                                layoverCity={layoverCity}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expand toggle */}
            <button
                onClick={onToggleExpand}
                style={{
                    width: '100%', background: 'none', border: 'none', borderTop: '1px solid #F1F5F9',
                    padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    cursor: 'pointer', color: '#64748B', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                }}
            >
                {isExpanded ? <><ChevronUp size={13} /> Ocultar detalhes</> : <><ChevronDown size={13} /> Ver detalhes do voo</>}
            </button>

            {/* Botão Google Flights — apenas busca só-ida (sem volta disponível) */}
            {!hasInboundFlights && (
                <a
                    href={buildGoogleFlightsUrl(flight)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '11px 20px', background: '#1A56DB',
                        fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none',
                        borderTop: '1px solid #1449C4',
                        transition: 'background 0.15s',
                    }}
                >
                    <ExternalLink size={13} /> Buscar no Google Flights
                </a>
            )}
        </motion.div>
    )
}

// ── Main export ────────────────────────────────────────────────────────────────
export function FlightResultsGrouped({
    flights, inboundFlights = [], searchInfo, onNewSearch, sidebarFilters,
    cashIdaSel, onSelectCashIda, cashVoltaSel, onSelectCashVolta, onMonitorar,
}: Omit<FlightResultsGroupedProps, 'buscaId' | 'returnDate'> & { buscaId?: number; returnDate?: string }) {
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

    function toggleExpand(id: string) {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const sorted = useMemo(() => {
        let base = [...flights]
        if (sidebarFilters?.stops && sidebarFilters.stops.length > 0) {
            base = base.filter(f => {
                const stops = (f as any).paradas ?? 0
                if (sidebarFilters.stops.includes('direct') && stops === 0) return true
                if (sidebarFilters.stops.includes('1stop') && stops === 1) return true
                if (sidebarFilters.stops.includes('2plus') && stops >= 2) return true
                return false
            })
        }
        if (sidebarFilters?.airlines && sidebarFilters.airlines.length > 0) {
            base = base.filter(f => sidebarFilters.airlines.includes(f.companhia ?? ''))
        }
        if (sidebarFilters?.maxPrice !== null && sidebarFilters?.maxPrice !== undefined) {
            base = base.filter(f => (f.preco_brl ?? 0) <= sidebarFilters.maxPrice!)
        }
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
            style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 16, padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}
        >
            <Plane size={40} color="#CBD5E1" />
            <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--graphite)', marginBottom: 6 }}>Nenhum voo encontrado</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tente ajustar as datas ou o destino.</p>
            </div>
            <button onClick={onNewSearch} style={{ padding: '10px 24px', background: 'var(--blue-medium)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ← Nova busca
            </button>
        </motion.div>
    )

    const hasInbound = inboundFlights.length > 0
    const canSelect = !!(onSelectCashIda || onSelectCashVolta)

    // Phase logic (only when selection is enabled)
    const cashPhase = !canSelect ? 'display'
        : !cashIdaSel ? 'ida'
        : (hasInbound && !cashVoltaSel) ? 'volta'
        : 'summary'

    const cashTotal = (() => {
        if (!cashIdaSel) return null
        const det = (cashIdaSel.detalhes as any) ?? {}
        // Combined Amadeus offer or Google round-trip total → price already covers both legs
        if (det.returnPartida || det.isRoundtripTotal) return cashIdaSel.preco_brl ?? 0
        return (cashIdaSel.preco_brl ?? 0) + (cashVoltaSel ? (cashVoltaSel.preco_brl ?? 0) : 0)
    })()

    const labelMap: Record<string, string> = { best: 'melhor custo-benefício', price: 'menor preço', duration: 'menor duração' }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <style>{`
                @media (max-width: 768px) {
                    .fly-card-top { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
                    .fly-card-right { width: 100% !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; }
                }
            `}</style>

            {/* Header */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    {searchInfo && (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                            <strong style={{ color: 'var(--text-dark)' }}>{searchInfo.origem}</strong>{' '}→{' '}
                            <strong style={{ color: 'var(--text-dark)' }}>{searchInfo.destino}</strong>
                            {' · '}{formatDate(searchInfo.data_ida)}
                            {' · '}{searchInfo.passageiros} {searchInfo.passageiros === 1 ? 'passageiro' : 'passageiros'}
                        </p>
                    )}
                    <p style={{ fontSize: 12, color: '#94A3B8' }}>
                        {sorted.length} de {flights.length} {flights.length === 1 ? 'opção' : 'opções'} · ordenadas por {labelMap[sidebarFilters?.sortBy ?? 'best']}
                        {cashPhase === 'volta' && <span style={{ color: '#16A34A', fontWeight: 700 }}> · Selecione a volta</span>}
                    </p>
                </div>
            </motion.div>

            {sorted.length === 0 && flights.length > 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', border: '1px solid #E2EAF5', borderRadius: 14, marginBottom: 12 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0E2A55', marginBottom: 8 }}>Nenhum voo com estes filtros</p>
                    <p style={{ fontSize: 13, color: '#94A3B8' }}>Tente remover alguns filtros na barra lateral.</p>
                </div>
            )}

            {/* ── Summary phase ─────────────────────────────────────────────── */}
            {cashPhase === 'summary' && cashIdaSel && (
                <>
                    <div style={{ background: '#0E2A55', borderRadius: 12, padding: '12px 18px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                {cashVoltaSel ? 'Total selecionado (ida + volta)' : 'Ida selecionada'}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>
                                R$ {cashTotal?.toLocaleString('pt-BR')}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                            <a
                                href={buildGoogleFlightsUrl(cashIdaSel, cashVoltaSel, searchInfo?.passageiros ?? 1)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    background: '#1D6AE5', border: 'none', borderRadius: 8,
                                    padding: '6px 12px', fontSize: 11, fontWeight: 700,
                                    color: '#fff', cursor: 'pointer', textDecoration: 'none',
                                }}
                            >
                                <ExternalLink size={11} /> Ver no Google Flights
                            </a>
                            <button
                                onClick={() => { onSelectCashIda?.(null); onSelectCashVolta?.(null) }}
                                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                ← Escolher novamente
                            </button>
                        </div>
                    </div>
                    <FlightCard
                        flight={cashIdaSel} idx={0} isReturn={false} isPinned
                        isExpanded={!!expandedCards[cashIdaSel.flight_key ?? 'sel-ida']}
                        onToggleExpand={() => toggleExpand(cashIdaSel.flight_key ?? 'sel-ida')}
                        canSelect={false} isSelected onSelect={() => {}}
                        onClear={() => { onSelectCashIda?.(null); onSelectCashVolta?.(null) }}
                        hasInboundFlights={hasInbound}
                    />
                    {cashVoltaSel && (
                        <FlightCard
                            flight={cashVoltaSel} idx={1} isReturn isPinned
                            isExpanded={!!expandedCards[cashVoltaSel.flight_key ?? 'sel-volta']}
                            onToggleExpand={() => toggleExpand(cashVoltaSel.flight_key ?? 'sel-volta')}
                            canSelect={false} isSelected onSelect={() => {}}
                            onClear={() => onSelectCashVolta?.(null)}
                            hasInboundFlights={hasInbound}
                        />
                    )}
                </>
            )}

            {/* ── Volta phase: pinned outbound + inbound cards ───────────────── */}
            {cashPhase === 'volta' && cashIdaSel && (
                <>
                    <FlightCard
                        flight={cashIdaSel} idx={0} isReturn={false} isPinned
                        isExpanded={!!expandedCards[cashIdaSel.flight_key ?? 'pin-ida']}
                        onToggleExpand={() => toggleExpand(cashIdaSel.flight_key ?? 'pin-ida')}
                        canSelect={false} isSelected onSelect={() => {}}
                        onClear={() => onSelectCashIda?.(null)}
                        hasInboundFlights={hasInbound}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
                        <div style={{ flex: 1, height: 1, background: '#E2EAF5' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0E2A55', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>✈ Selecione a volta</span>
                        <div style={{ flex: 1, height: 1, background: '#E2EAF5' }} />
                    </div>
                    <AnimatePresence>
                        {inboundFlights.map((flight, idx) => (
                            <FlightCard
                                key={flight.flight_key ?? `in-${idx}`}
                                flight={flight} idx={idx} isReturn isPinned={false}
                                isExpanded={!!expandedCards[flight.flight_key ?? `in-${idx}`]}
                                onToggleExpand={() => toggleExpand(flight.flight_key ?? `in-${idx}`)}
                                canSelect isSelected={cashVoltaSel?.flight_key === flight.flight_key}
                                onSelect={() => onSelectCashVolta?.(cashVoltaSel?.flight_key === flight.flight_key ? null : flight)}
                                hasInboundFlights={hasInbound}
                                onMonitorar={onMonitorar}
                            />
                        ))}
                    </AnimatePresence>
                </>
            )}

            {/* ── Ida phase: all outbound cards ─────────────────────────────── */}
            {(cashPhase === 'ida' || cashPhase === 'display') && (
                <AnimatePresence>
                    {sorted.map((flight, idx) => (
                        <FlightCard
                            key={flight.flight_key ?? idx}
                            flight={flight} idx={idx} isReturn={false} isPinned={false}
                            isExpanded={!!expandedCards[flight.flight_key ?? `${idx}`]}
                            onToggleExpand={() => toggleExpand(flight.flight_key ?? `${idx}`)}
                            canSelect={canSelect}
                            isSelected={cashIdaSel?.flight_key === flight.flight_key}
                            onSelect={() => onSelectCashIda?.(cashIdaSel?.flight_key === flight.flight_key ? null : flight)}
                            hasInboundFlights={hasInbound}
                            sortBy={sidebarFilters?.sortBy}
                            onMonitorar={onMonitorar}
                        />
                    ))}
                </AnimatePresence>
            )}

            {/* ── Display mode: show inbound below outbound (no selection) ──── */}
            {cashPhase === 'display' && hasInbound && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 12px' }}>
                        <div style={{ flex: 1, height: 1, background: '#E2EAF5' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>VOOS DE VOLTA — REFERÊNCIA DE PREÇO</span>
                        <div style={{ flex: 1, height: 1, background: '#E2EAF5' }} />
                    </div>
                    <AnimatePresence>
                        {inboundFlights.map((flight, idx) => (
                            <FlightCard
                                key={flight.flight_key ?? `in-${idx}`}
                                flight={flight} idx={idx} isReturn isPinned={false}
                                isExpanded={!!expandedCards[flight.flight_key ?? `in-${idx}`]}
                                onToggleExpand={() => toggleExpand(flight.flight_key ?? `in-${idx}`)}
                                canSelect={false} isSelected={false} onSelect={() => {}}
                                hasInboundFlights={hasInbound}
                                onMonitorar={onMonitorar}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    )
}
