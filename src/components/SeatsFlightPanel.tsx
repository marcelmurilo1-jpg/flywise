import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react'
import type { ResultadoVoo } from '@/lib/supabase'
import type { SeatsContext } from '@/components/StrategyPanel'
import type { WatchlistModalProps } from '@/components/WatchlistModal'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeatsFlightData {
    tipo: 'ida' | 'volta'
    companhiaAerea: string
    source: string
    dataVoo: string
    precoMilhas: number
    taxas?: string
    paradas?: number
    escalas?: string[]
    origem: string
    destino: string
    partida?: string
    chegada?: string
    duracaoMin?: number
    cabineEncontrada?: string
    programName?: string
    rota?: string
    economy?: number | null
    premiumEconomy?: number | null
    business?: number | null
    first?: number | null
}

interface SeatsFlightPanelProps {
    seatsFlights: SeatsFlightData[]
    seatsLoading: boolean
    seatsError: string | null
    flights: ResultadoVoo[]
    inboundFlights: ResultadoVoo[]
    cashIdaSel: ResultadoVoo | null
    cashVoltaSel: ResultadoVoo | null
    originIata: string
    destIata: string
    onOpenStrategy: (ctx: SeatsContext, cashPrice: number) => void
    onOpenWatchlist: (data: Omit<WatchlistModalProps, 'open' | 'onClose'>) => void
    onRetry?: () => void
}

// ─── Constants (defined once, outside the component) ─────────────────────────

const AIRLINE_FULL: Record<string, string> = {
    LA: 'LATAM Airlines', JJ: 'LATAM Airlines', G3: 'GOL', AD: 'Azul',
    AA: 'American Airlines', UA: 'United Airlines', DL: 'Delta Air Lines',
    AC: 'Air Canada', WS: 'WestJet', AF: 'Air France', KL: 'KLM',
    LH: 'Lufthansa', LX: 'Swiss', OS: 'Austrian Airlines', SN: 'Brussels Airlines',
    BA: 'British Airways', SK: 'SAS', AZ: 'ITA Airways', TP: 'TAP Portugal',
    IB: 'Iberia', AV: 'Avianca', CM: 'Copa Airlines', AM: 'Aeromexico',
    AR: 'Aerolíneas Argentinas', UX: 'Air Europa', ET: 'Ethiopian Airlines',
    TK: 'Turkish Airlines', EK: 'Emirates', QR: 'Qatar Airways',
    SQ: 'Singapore Airlines', JL: 'Japan Airlines', NH: 'ANA',
    CX: 'Cathay Pacific', MH: 'Malaysia Airlines', B6: 'JetBlue',
    AS: 'Alaska Airlines', WN: 'Southwest', VS: 'Virgin Atlantic',
    EI: 'Aer Lingus', FR: 'Ryanair',
}

const SOURCE_PROGRAM: Record<string, { name: string; color: string; bg: string }> = {
    smiles:         { name: 'Smiles',        color: '#F97316', bg: '#FFF7ED' },
    delta:          { name: 'SkyMiles',       color: '#003DA5', bg: '#EFF6FF' },
    american:       { name: 'AAdvantage',     color: '#B91C1C', bg: '#FEF2F2' },
    united:         { name: 'MileagePlus',    color: '#004B87', bg: '#EFF6FF' },
    aeroplan:       { name: 'Aeroplan',       color: '#CC0000', bg: '#FEF2F2' },
    flyingblue:     { name: 'Flying Blue',    color: '#003087', bg: '#EFF6FF' },
    lifemiles:      { name: 'Lifemiles',      color: '#E63946', bg: '#FEF2F2' },
    virginatlantic: { name: 'Virgin Points',  color: '#E10A0A', bg: '#FEF2F2' },
    alaska:         { name: 'Mileage Plan',   color: '#01426A', bg: '#EFF6FF' },
    latam:          { name: 'LATAM Pass',     color: '#E31837', bg: '#FEF2F2' },
    azul:           { name: 'TudoAzul',       color: '#003DA5', bg: '#EFF6FF' },
    emirates:       { name: 'Skywards',       color: '#C09846', bg: '#FFFBEB' },
    turkish:        { name: 'Miles&Smiles',   color: '#C8102E', bg: '#FEF2F2' },
    jetblue:        { name: 'TrueBlue',       color: '#003876', bg: '#EFF6FF' },
    iberia:         { name: 'Iberia Plus',    color: '#C41E3A', bg: '#FEF2F2' },
    singapore:      { name: 'KrisFlyer',      color: '#1A3C5E', bg: '#EFF6FF' },
    qatar:          { name: 'Avios (Qatar)',   color: '#5C0632', bg: '#FDF2F8' },
    british:        { name: 'Avios (BA)',      color: '#2B5FA5', bg: '#EFF6FF' },
    avianca:        { name: 'Lifemiles',      color: '#E63946', bg: '#FEF2F2' },
}

const CABIN_COLOR: Record<string, string> = {
    'Economy': '#2A60C2', 'Premium Economy': '#7C3AED',
    'Business': '#0E2A55', 'First': '#92400E',
}

function fmtDur(min?: number | null): string | null {
    if (!min) return null
    return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`
}

function stopLabel(n: number, escalas?: string[]): string {
    if (n === 0) return 'Direto'
    const via = escalas?.length ? ` via ${escalas.join(', ')}` : ''
    return `${n} ${n === 1 ? 'conexão' : 'conexões'}${via}`
}

// ─── bestCash — single source of truth ───────────────────────────────────────

function calcBestCash(
    cashIdaSel: ResultadoVoo | null,
    cashVoltaSel: ResultadoVoo | null,
    flights: ResultadoVoo[],
    inboundFlights: ResultadoVoo[],
    hasVolta: boolean,
): { value: number; label: string } {
    if (cashIdaSel) {
        const det = (cashIdaSel.detalhes as Record<string, unknown>) ?? {}
        if (det.returnPartida || det.isRoundtripTotal) {
            return { value: cashIdaSel.preco_brl ?? 0, label: 'Total selecionado (ida+volta)' }
        }
        const value = (cashIdaSel.preco_brl ?? 0) + (cashVoltaSel ? (cashVoltaSel.preco_brl ?? 0) : 0)
        const label = cashVoltaSel ? 'Total selecionado (ida+volta)' : 'Ida selecionada em dinheiro'
        return { value, label }
    }

    const combined = flights.filter(f => (f.preco_brl ?? 0) > 0 && !!(f.detalhes as Record<string, unknown>)?.returnPartida)
    const outOnly = flights.filter(f => (f.preco_brl ?? 0) > 0)
    const inOnly = inboundFlights.filter(f => (f.preco_brl ?? 0) > 0)

    if (hasVolta && combined.length > 0) {
        return { value: Math.min(...combined.map(f => f.preco_brl!)), label: 'Melhor preço em dinheiro (ida+volta)' }
    }
    if (hasVolta && outOnly.length > 0 && inOnly.length > 0) {
        return {
            value: Math.min(...outOnly.map(f => f.preco_brl!)) + Math.min(...inOnly.map(f => f.preco_brl!)),
            label: 'Melhor preço em dinheiro (ida+volta)',
        }
    }
    return {
        value: outOnly.length > 0 ? Math.min(...outOnly.map(f => f.preco_brl!)) : 0,
        label: 'Melhor preço de ida em dinheiro',
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SeatsFlightPanel({
    seatsFlights, seatsLoading, seatsError,
    flights, inboundFlights, cashIdaSel, cashVoltaSel,
    originIata, destIata,
    onOpenStrategy, onOpenWatchlist, onRetry,
}: SeatsFlightPanelProps) {
    const [phase, setPhase] = useState<'ida' | 'volta' | 'summary'>('ida')
    const [idaSel, setIdaSel] = useState<SeatsFlightData | null>(null)
    const [voltaSel, setVoltaSel] = useState<SeatsFlightData | null>(null)
    const [detailOpen, setDetailOpen] = useState<Set<string>>(new Set())

    // Reset selection when new results arrive
    useEffect(() => {
        setPhase('ida')
        setIdaSel(null)
        setVoltaSel(null)
        setDetailOpen(new Set())
    }, [seatsFlights])

    const idaFlights = seatsFlights.filter(sf => sf.tipo === 'ida')
    const voltaFlights = seatsFlights.filter(sf => sf.tipo === 'volta')

    function toggleDetail(key: string) {
        setDetailOpen(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key) else next.add(key)
            return next
        })
    }

    function handleSelect(sf: SeatsFlightData) {
        if (phase === 'ida') {
            setIdaSel(sf)
            setPhase(voltaFlights.length > 0 ? 'volta' : 'summary')
        } else {
            setVoltaSel(sf)
            setPhase('summary')
        }
    }

    function handleOpenStrategy() {
        if (!idaSel) return
        const best = calcBestCash(cashIdaSel, cashVoltaSel, flights, inboundFlights, !!voltaSel)
        const ctx: SeatsContext = {
            airlineCode: idaSel.companhiaAerea ?? '',
            airlineName: AIRLINE_FULL[idaSel.companhiaAerea ?? ''] ?? idaSel.companhiaAerea ?? '',
            origem: idaSel.origem ?? '',
            destino: idaSel.destino ?? '',
            cabin: idaSel.cabineEncontrada ?? 'Economy',
            program: idaSel.programName || SOURCE_PROGRAM[(idaSel.source ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')]?.name || idaSel.source || '',
            idaMilhas: idaSel.precoMilhas ?? 0,
            voltaMilhas: voltaSel?.precoMilhas,
            totalMilhas: (idaSel.precoMilhas ?? 0) + (voltaSel?.precoMilhas ?? 0),
            isRoundTrip: !!voltaSel,
            dataVoo: idaSel.dataVoo ?? '',
            taxas: idaSel.taxas,
        }
        onOpenStrategy(ctx, isFinite(best.value) ? best.value : 0)
    }

    // ── Loading / error / empty states ────────────────────────────────────────

    if (seatsLoading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Buscando passagens emissíveis por milhas na base Pro (Seats.aero)...</p>
            </div>
        )
    }

    if (seatsError) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', background: '#FFF5F5', borderRadius: '16px', border: '1px solid #FCA5A5' }}>
                <p style={{ color: '#DC2626', fontSize: '13px', fontWeight: 600, marginBottom: 6 }}>⚠️ Busca de milhas indisponível</p>
                <p style={{ color: '#991B1B', fontSize: '12px', lineHeight: 1.6, margin: '0 0 14px' }}>{seatsError}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: '#DC2626', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '8px 16px', fontSize: 12,
                            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        <RefreshCcw size={13} /> Tentar novamente
                    </button>
                )}
            </div>
        )
    }

    if (seatsFlights.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Nenhum voo encontrado no Seats.aero para esta rota.</p>
            </div>
        )
    }

    // ── Summary view ──────────────────────────────────────────────────────────

    if (phase === 'summary') {
        const best = calcBestCash(cashIdaSel, cashVoltaSel, flights, inboundFlights, !!voltaSel)
        const totalMilhas = (idaSel?.precoMilhas ?? 0) + (voltaSel?.precoMilhas ?? 0)

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <CheckCircle2 size={20} color="#16A34A" />
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}>Viagem selecionada</span>
                </div>

                {[idaSel, voltaSel].filter(Boolean).map((sf, i) => {
                    const ac = sf!.companhiaAerea ?? ''
                    return (
                        <div key={i} style={{ background: '#fff', border: '2px solid #16A34A', borderRadius: 16, padding: '14px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {ac && <img src={`https://pics.avs.io/60/30/${ac}.png`} alt="" style={{ height: 24, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} loading="lazy" />}
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0E2A55' }}>{AIRLINE_FULL[ac] ?? ac}</div>
                                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{sf!.tipo === 'ida' ? 'Ida' : 'Volta'} · {sf!.dataVoo} · {sf!.origem} → {sf!.destino}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: (sf!.paradas ?? 0) === 0 ? '#16A34A' : '#64748B', fontWeight: 600, marginBottom: 2 }}>{stopLabel(sf!.paradas ?? 0, sf!.escalas)}</div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0E2A55' }}>{sf!.precoMilhas.toLocaleString('pt-BR')} pts</div>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Total */}
                <div style={{ background: '#0E2A55', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                            {voltaSel ? 'Total ida + volta' : 'Total ida'}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
                            {totalMilhas.toLocaleString('pt-BR')} pts
                        </div>
                        {isFinite(best.value) && best.value > 0 && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                                {best.label}: R$ {best.value.toLocaleString('pt-BR')}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleOpenStrategy}
                        style={{
                            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
                            color: '#fff', border: 'none', borderRadius: 10,
                            padding: '10px 20px', fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 6,
                            boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        ⚡ Gerar Estratégia
                    </button>
                </div>

                <button
                    onClick={() => { setPhase('ida'); setIdaSel(null); setVoltaSel(null) }}
                    style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    ← Escolher novamente
                </button>
            </div>
        )
    }

    // ── Selection view (ida / volta) ──────────────────────────────────────────

    return (
        <>
            {/* Ida selecionada — banner enquanto escolhe a volta */}
            {phase === 'volta' && idaSel && (() => {
                const sf = idaSel
                const ac = sf.companhiaAerea ?? ''
                const prog = SOURCE_PROGRAM[sf.source?.toLowerCase() ?? '']
                const cab = sf.cabineEncontrada ?? 'Economy'
                return (
                    <div style={{ background: '#fff', border: '2px solid #16A34A', borderRadius: 16, overflow: 'hidden' }}>
                        <div style={{ background: '#16A34A', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckCircle2 size={13} color="#fff" />
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>IDA SELECIONADA</span>
                            </div>
                            <button onClick={() => { setPhase('ida'); setIdaSel(null) }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>← Mudar ida</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F0FDF4' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {ac && <img src={`https://pics.avs.io/60/30/${ac}.png`} alt="" style={{ height: 24, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} loading="lazy" />}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>{AIRLINE_FULL[ac] ?? ac}</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: CABIN_COLOR[cab] ?? '#0E2A55', color: '#fff' }}>{cab}</span>
                                        {prog && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: prog.bg, color: prog.color }}>{prog.name}</span>}
                                    </div>
                                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{sf.dataVoo}</span>
                                </div>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 900, color: '#0E2A55' }}>{sf.precoMilhas.toLocaleString('pt-BR')} pts</span>
                        </div>
                        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ textAlign: 'center', minWidth: 40 }}>
                                {sf.partida && <div style={{ fontSize: 16, fontWeight: 800, color: '#0E2A55' }}>{sf.partida}</div>}
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{sf.origem}</div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <div style={{ position: 'relative', height: 1, background: '#BBF7D0', width: '100%' }}>
                                    <span style={{ position: 'absolute', right: -1, top: -5, fontSize: 10, color: '#16A34A' }}>✈</span>
                                </div>
                                <span style={{ fontSize: 9, color: (sf.paradas ?? 0) === 0 ? '#16A34A' : '#94A3B8', fontWeight: (sf.paradas ?? 0) === 0 ? 700 : 400 }}>{stopLabel(sf.paradas ?? 0, sf.escalas)}</span>
                            </div>
                            <div style={{ textAlign: 'center', minWidth: 40 }}>
                                {sf.chegada && <div style={{ fontSize: 16, fontWeight: 800, color: '#0E2A55' }}>{sf.chegada}</div>}
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{sf.destino}</div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {phase === 'volta' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
                    <div style={{ flex: 1, height: '1px', background: '#BBF7D0' }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>✈ Selecione a volta</span>
                    <div style={{ flex: 1, height: '1px', background: '#BBF7D0' }} />
                </div>
            )}

            {/* Flight cards */}
            {(phase === 'ida' ? idaFlights : voltaFlights).map((sf, sfIdx) => {
                const cardKey = `${sf.companhiaAerea}-${sf.source}-${sf.dataVoo}-${sfIdx}`
                const isOpen = detailOpen.has(cardKey)
                const ac = sf.companhiaAerea ?? ''
                const prog = SOURCE_PROGRAM[sf.source?.toLowerCase() ?? '']
                const cab = sf.cabineEncontrada ?? 'Economy'

                return (
                    <motion.div key={cardKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sfIdx * 0.03 }}
                        style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #F0FDF4' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {ac && <img src={`https://pics.avs.io/60/30/${ac}.png`} alt={AIRLINE_FULL[ac] ?? ac} style={{ height: 28, objectFit: 'contain', borderRadius: 4 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} loading="lazy" />}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0E2A55' }}>{AIRLINE_FULL[ac] ?? ac}</span>
                                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: CABIN_COLOR[cab] ?? '#0E2A55', color: '#fff' }}>{cab}</span>
                                        {prog && <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: prog.bg, color: prog.color, border: `1px solid ${prog.color}33` }}>{prog.name}</span>}
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>{sf.dataVoo}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em' }}>{sf.precoMilhas.toLocaleString('pt-BR')} pts</div>
                                    {sf.taxas && sf.taxas !== '0' && <div style={{ fontSize: '11px', color: '#94A3B8' }}>+ {sf.taxas} taxas</div>}
                                </div>
                                <button onClick={() => handleSelect(sf)} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    Selecionar →
                                </button>
                                <button
                                    onClick={() => onOpenWatchlist({
                                        type: 'miles',
                                        origin: originIata || '',
                                        destination: destIata || '',
                                        currentMiles: typeof sf.precoMilhas === 'number' ? sf.precoMilhas : parseInt(String(sf.precoMilhas ?? '0')) || 0,
                                        program: sf.source ?? undefined,
                                        cabin: (sf.cabineEncontrada ?? 'Economy').toLowerCase() === 'business' ? 'business' : 'economy',
                                        travelDate: sf.dataVoo ?? undefined,
                                    })}
                                    style={{ background: '#EDE9FE', color: '#7C3AED', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                    🔔
                                </button>
                            </div>
                        </div>

                        {/* Route timeline */}
                        <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ textAlign: 'center', minWidth: 44 }}>
                                {sf.partida && <div style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{sf.partida}</div>}
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginTop: 2 }}>{sf.origem || sf.rota?.split('→')[0]?.trim()}</div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                {fmtDur(sf.duracaoMin) && <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>{fmtDur(sf.duracaoMin)}</span>}
                                <div style={{ position: 'relative', height: 1, background: '#BBF7D0', width: '100%' }}>
                                    <span style={{ position: 'absolute', right: -1, top: -5, fontSize: 11, color: '#16A34A' }}>✈</span>
                                </div>
                                <span style={{ fontSize: '10px', color: (sf.paradas ?? 0) === 0 ? '#16A34A' : '#94A3B8', fontWeight: (sf.paradas ?? 0) === 0 ? 700 : 400 }}>
                                    {stopLabel(sf.paradas ?? 0, sf.escalas)}
                                </span>
                            </div>
                            <div style={{ textAlign: 'center', minWidth: 44 }}>
                                {sf.chegada && <div style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{sf.chegada}</div>}
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginTop: 2 }}>{sf.destino || sf.rota?.split('→').at(-1)?.trim()}</div>
                            </div>
                            {(sf.economy || sf.premiumEconomy || sf.business || sf.first) && (
                                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                                    {[
                                        { label: 'Eco',  val: sf.economy,        color: '#2A60C2' },
                                        { label: 'Prem', val: sf.premiumEconomy, color: '#7C3AED' },
                                        { label: 'Bus',  val: sf.business,       color: '#0E2A55' },
                                        { label: '1ª',   val: sf.first,          color: '#92400E' },
                                    ].filter(c => c.val != null).map(c => (
                                        <div key={c.label} style={{ textAlign: 'center', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '4px 8px' }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: 'uppercase' }}>{c.label}</div>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: '#0E2A55' }}>{typeof c.val === 'number' ? `${(c.val / 1000).toFixed(0)}k` : c.val}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Details toggle */}
                        <div style={{ padding: '0 20px 10px' }}>
                            <button onClick={() => toggleDetail(cardKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0 }}>
                                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {isOpen ? 'Ocultar detalhes' : 'Ver detalhes do voo'}
                            </button>
                        </div>

                        <AnimatePresence>
                            {isOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                    style={{ overflow: 'hidden', borderTop: '1px solid #F0FDF4', background: '#F8FFF8' }}>
                                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Detalhes do trajeto</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>{sf.origem}</span>
                                            {sf.escalas?.map((esc, i) => (
                                                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#F97316', background: '#FFF7ED', padding: '2px 8px', borderRadius: 6 }}>{esc} (conexão)</span>
                                                </span>
                                            ))}
                                            <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>{sf.destino}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 12, color: '#64748B' }}><strong>Paradas:</strong> {(sf.paradas ?? 0) === 0 ? 'Voo direto ✓' : `${sf.paradas} ${sf.paradas === 1 ? 'conexão' : 'conexões'}`}</span>
                                            {sf.duracaoMin && <span style={{ fontSize: 12, color: '#64748B' }}><strong>Duração:</strong> {fmtDur(sf.duracaoMin)}</span>}
                                            <span style={{ fontSize: 12, color: '#64748B' }}><strong>Programa:</strong> {prog?.name ?? sf.source}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )
            })}
        </>
    )
}
