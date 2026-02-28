import { useState } from 'react'
import { Plane, Clock, ArrowRight, Zap, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ResultadoVoo } from '@/lib/supabase'
import { StrategyPanel } from '@/components/StrategyPanel'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SearchInfo { origem: string; destino: string; data_ida: string; passageiros: number }
interface FlightResultsGroupedProps {
    flights: ResultadoVoo[]
    buscaId: number
    searchInfo?: SearchInfo
    onNewSearch: () => void
}

const AIRLINE_COLORS: Record<string, string> = { LATAM: '#DC2626', GOL: '#EA580C', Azul: '#1D4ED8' }
const AIRLINE_PROGRAMS: Record<string, string> = { LATAM: 'LATAM Pass', GOL: 'Smiles', Azul: 'TudoAzul' }

function formatTime(iso?: string) {
    if (!iso) return '--:--'
    // parseISO treats datetime strings without timezone as LOCAL time (correct for airport local times)
    try { return format(parseISO(iso), 'HH:mm') } catch { return '--:--' }
}
function formatDur(m?: number) {
    if (!m) return ''
    return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}min` : ''}`
}
function getStopCodes(flight: ResultadoVoo): string {
    const segs = (flight.segmentos as any[])
    if (!segs || segs.length <= 1) return ''
    return segs.slice(0, -1).map((s: any) => s.destino ?? s.arrival?.iataCode ?? '').filter(Boolean).join(' · ')
}
function groupByAirline(flights: ResultadoVoo[]) {
    const g: Record<string, { cash?: ResultadoVoo; miles?: ResultadoVoo }> = {}
    for (const f of flights) {
        const k = f.companhia ?? 'Desconhecida'
        if (!g[k]) g[k] = {}
        if (f.preco_brl && !f.preco_milhas) g[k].cash = f
        else if (f.preco_milhas) g[k].miles = f
    }
    return g
}

export function FlightResultsGrouped({ flights, buscaId, searchInfo, onNewSearch }: FlightResultsGroupedProps) {
    const [selFlight, setSelFlight] = useState<ResultadoVoo | null>(null)
    const [panelOpen, setPanelOpen] = useState(false)
    const groups = groupByAirline(flights)

    if (flights.length === 0) return (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <Plane size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ fontSize: '15px', marginBottom: '16px' }}>Nenhum voo encontrado.</p>
            <button onClick={onNewSearch} className="btn btn-primary">Nova busca</button>
        </div>
    )

    return (
        <>
            {/* Header info */}
            <div style={{ marginBottom: '24px' }}>
                {searchInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-faint)', borderRadius: '999px', padding: '6px 14px', boxShadow: 'var(--shadow-xs)' }}>
                            <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>{searchInfo.origem}</span>
                            <ArrowRight size={13} color="var(--text-faint)" />
                            <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>{searchInfo.destino}</span>
                        </div>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {format(parseISO(searchInfo.data_ida + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })} · {searchInfo.passageiros} {searchInfo.passageiros === 1 ? 'Passageiro' : 'Passageiros'}
                        </span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {Object.keys(groups).length} companhias · {flights.length} opções
                    </span>
                    <button onClick={onNewSearch} className="btn btn-ghost btn-sm">← Nova busca</button>
                </div>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(groups).map(([airline, { cash, miles }], idx) => {
                    const color = AIRLINE_COLORS[airline] ?? '#6366f1'
                    const program = AIRLINE_PROGRAMS[airline] ?? airline
                    const hasStrategy = cash?.estrategia_disponivel || miles?.estrategia_disponivel

                    return (
                        <motion.div
                            key={airline}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="card"
                            style={{
                                overflow: 'hidden',
                                borderColor: hasStrategy ? 'rgba(59,130,246,0.2)' : 'var(--border-faint)',
                                boxShadow: hasStrategy ? '0 4px 24px rgba(59,130,246,0.09), var(--shadow-sm)' : 'var(--shadow-sm)',
                            }}
                        >
                            {/* Airline strip */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 20px',
                                backgroundColor: 'var(--bg-subtle)',
                                borderBottom: '1px solid var(--border-faint)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '3px', height: '22px', borderRadius: '2px', background: color }} />
                                    <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>{airline}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>· {program}</span>
                                </div>
                                {hasStrategy && (
                                    <span className="pill pill-blue">
                                        <Zap size={11} /> Estratégia disponível
                                    </span>
                                )}
                            </div>

                            {/* Options */}
                            <div style={{ display: 'grid', gridTemplateColumns: cash && miles ? '1fr 1px 1fr' : '1fr', alignItems: 'stretch' }}>
                                {/* Cash */}
                                {cash && (
                                    <FlightOption
                                        type="cash"
                                        label="Em dinheiro"
                                        labelColor="var(--text-muted)"
                                        departure={formatTime(cash.partida)}
                                        arrival={formatTime(cash.chegada)}
                                        origin={cash.origem ?? '—'}
                                        dest={cash.destino ?? '—'}
                                        duration={formatDur(cash.duracao_min)}
                                        stops={(cash.detalhes as any)?.paradas ?? 0}
                                        stopCodes={getStopCodes(cash)}
                                        priceMain={`R$ ${cash.preco_brl?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                        priceSub="por pessoa"
                                    />
                                )}
                                {cash && miles && <div style={{ width: '1px', background: 'var(--border-faint)' }} />}
                                {/* Miles */}
                                {miles && (
                                    <FlightOption
                                        type="miles"
                                        label="Via milhas"
                                        labelColor="var(--accent-start)"
                                        departure={formatTime(miles.partida)}
                                        arrival={formatTime(miles.chegada)}
                                        origin={miles.origem ?? '—'}
                                        dest={miles.destino ?? '—'}
                                        duration={formatDur(miles.duracao_min)}
                                        stops={(miles.detalhes as any)?.paradas ?? 0}
                                        stopCodes={getStopCodes(miles)}
                                        priceMain={`${miles.preco_milhas?.toLocaleString('pt-BR')} mil.`}
                                        priceSub={miles.taxas_brl ? `+ R$ ${miles.taxas_brl} taxas` : undefined}
                                        cpm={miles.cpm ? `CPM R$ ${miles.cpm.toFixed(2)}/1k` : undefined}
                                        cta
                                        hasStrategy={!!hasStrategy}
                                        onStrategy={() => { setSelFlight(miles); setPanelOpen(true) }}
                                    />
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <StrategyPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                flight={selFlight}
                buscaId={buscaId}
                cashPrice={selFlight?.companhia ? (groups[selFlight.companhia]?.cash?.preco_brl ?? 0) : 0}
            />
        </>
    )
}

interface FlightOptionProps {
    type: 'cash' | 'miles'
    label: string
    labelColor: string
    departure: string
    arrival: string
    origin: string
    dest: string
    duration: string
    stops: number
    stopCodes: string
    priceMain: string
    priceSub?: string
    cpm?: string
    cta?: boolean
    hasStrategy?: boolean
    onStrategy?: () => void
}

function FlightOption({ type, label, labelColor, departure, arrival, origin, dest, duration, stops, stopCodes, priceMain, priceSub, cpm, cta, hasStrategy, onStrategy }: FlightOptionProps) {
    return (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: labelColor }}>{label}</span>

            {/* Route */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{departure}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '3px', fontWeight: 600 }}>{origin}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '11px', marginBottom: '5px' }}>
                        <Clock size={10} /> {duration}
                    </div>
                    <div style={{ position: 'relative', height: '1px', background: 'var(--border-light)' }}>
                        <Plane size={11} style={{ position: 'absolute', right: '-1px', top: '-5px', color: 'var(--text-faint)' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>
                        {stops === 0 ? 'Direto' : stops === 1 ? '1 conexão' : `${stops} conexões`}
                        {stopCodes && <span style={{ color: '#94A3B8' }}> · {stopCodes}</span>}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{arrival}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '3px', fontWeight: 600 }}>{dest}</div>
                </div>
            </div>

            {/* Price */}
            <div>
                <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', color: type === 'miles' ? 'var(--accent-start)' : 'var(--text-primary)', lineHeight: 1 }}>
                    {priceMain}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                    {priceSub && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{priceSub}</span>}
                    {cpm && <span className="pill pill-green" style={{ fontSize: '10.5px' }}><TrendingDown size={10} /> {cpm}</span>}
                </div>
            </div>

            {/* CTA */}
            {cta && (
                <button
                    onClick={onStrategy}
                    className={hasStrategy ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    <Zap size={13} /> Gerar Estratégia
                </button>
            )}
        </div>
    )
}
