import { useState } from 'react'
import { Plane, ArrowRight } from 'lucide-react'
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

// Individual flight leg display (outbound or return)
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
                {/* Departure */}
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text-primary, #0E2A55)' }}>{departure}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 2 }}>{from}</div>
                </div>
                {/* Route line */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{duration}</span>
                    <div style={{ position: 'relative', height: 1, background: '#E2EAF5', width: '100%' }}>
                        <Plane size={11} style={{ position: 'absolute', right: -1, top: -5, color: '#94A3B8' }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>
                        {stopLabel(stops, stopStr)}
                    </span>
                </div>
                {/* Arrival */}
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text-primary, #0E2A55)' }}>{arrival}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 2 }}>{to}</div>
                </div>
            </div>
        </div>
    )
}

export function FlightResultsGrouped({ flights, buscaId, searchInfo, onNewSearch }: FlightResultsGroupedProps) {
    const [selFlight, setSelFlight] = useState<ResultadoVoo | null>(null)
    const [panelOpen, setPanelOpen] = useState(false)
    void setSelFlight // reserved for future strategy panel trigger

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

    // Sort all flights by price
    const sorted = [...flights].sort((a, b) => (a.preco_brl ?? 0) - (b.preco_brl ?? 0))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 16,
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
                        {sorted.length} {sorted.length === 1 ? 'opção encontrada' : 'opções encontradas'} · ordenadas por menor preço
                    </p>
                </div>
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
            </motion.div>

            {/* Flight cards */}
            {sorted.map((flight, idx) => {
                const det = (flight.detalhes as any) ?? {}
                const segsOut = (flight.segmentos as any[]) ?? []
                const segsRet = (det.returnSegmentos as any[]) ?? []
                const hasReturn = !!det.returnPartida

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

                        {/* Return leg (if round-trip) */}
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
