import { useState, useEffect } from 'react'
import { Zap, TrendingDown, ArrowRight, AlertTriangle, Tag, ChevronDown, ChevronUp, TrendingUp, Coins, ExternalLink, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { StrategyResult, ProgramComparison } from '@/lib/llm/buildPrompt'
import type { SeatsContext } from '@/components/StrategyPanel'

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
    EI: 'Aer Lingus',
}

const CABIN_COLOR: Record<string, string> = {
    Economy: '#2A60C2', 'Premium Economy': '#7C3AED',
    Business: '#0E2A55', First: '#92400E',
}

function buildGfUrl(origem: string, destino: string, data: string, retData?: string): string {
    // TFS protobuf builder (same as scraper/FlightResultsGrouped)
    function varint(buf: number[], v: number) { while (v > 0x7F) { buf.push((v & 0x7F) | 0x80); v >>>= 7 } buf.push(v & 0x7F) }
    function gfInt(buf: number[], f: number, v: number) { varint(buf, (f << 3) | 0); varint(buf, v) }
    function gfStr(buf: number[], f: number, s: string) { varint(buf, (f << 3) | 2); varint(buf, s.length); for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i)) }
    function gfMsg(buf: number[], f: number, b: number[]) { varint(buf, (f << 3) | 2); varint(buf, b.length); for (let i = 0; i < b.length; i++) buf.push(b[i]) }
    function itin(from: string, date: string, to: string) { const b: number[] = []; gfStr(b, 2, date); const seg: number[] = []; gfStr(seg, 1, from); gfStr(seg, 2, date); gfStr(seg, 3, to); gfMsg(b, 4, seg); const e1: number[] = []; gfInt(e1, 1, 1); gfStr(e1, 2, from); gfMsg(b, 13, e1); const e2: number[] = []; gfInt(e2, 1, 1); gfStr(e2, 2, to); gfMsg(b, 14, e2); return b }
    try {
        const buf: number[] = []
        gfInt(buf, 1, 28)
        gfInt(buf, 2, retData ? 2 : 1)
        gfMsg(buf, 3, itin(origem.toUpperCase(), data, destino.toUpperCase()))
        if (retData) gfMsg(buf, 3, itin(destino.toUpperCase(), retData, origem.toUpperCase()))
        gfInt(buf, 8, 1); gfInt(buf, 9, 1); gfInt(buf, 14, 1)
        let str = ''; for (let i = 0; i < buf.length; i++) str += String.fromCharCode(buf[i])
        const b64 = btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
        return `https://www.google.com/travel/flights?tfs=${b64}&hl=pt-BR&gl=BR&curr=BRL`
    } catch {
        const q = `Flights from ${origem} to ${destino} on ${data}${retData ? ` returning ${retData}` : ''}`
        return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&curr=BRL`
    }
}

function extractUrls(text: string): string[] {
    const raw = text.match(/https?:\/\/[^\s\)\,\!\?'"]+/g) ?? []
    return raw.map(u => u.replace(/[.,]+$/, '')).filter(u => u.length > 10)
}

function fmtDur(min?: number | null): string | null {
    if (!min) return null
    return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`
}

function stopLabel(n?: number, escalas?: string[]): string {
    if (!n || n === 0) return 'Direto'
    const via = escalas?.length ? ` via ${escalas.join(', ')}` : ''
    return `${n} ${n === 1 ? 'conexão' : 'conexões'}${via}`
}

// ── FlightMiniCard ──────────────────────────────────────────────────────────────

interface FlightMiniCardProps {
    airlineCode?: string
    airlineName: string
    program: string
    cabin: string
    origem: string
    destino: string
    data: string
    milhas: number
    taxas?: string
    partida?: string
    chegada?: string
    paradas?: number
    escalas?: string[]
    duracaoMin?: number
    label?: string
}

function FlightMiniCard({ airlineCode, airlineName, program, cabin, origem, destino, data, milhas, taxas, partida, chegada, paradas, escalas, duracaoMin, label }: FlightMiniCardProps) {
    return (
        <div style={{ background: '#fff', border: '2px solid #16A34A', borderRadius: 14, overflow: 'hidden' }}>
            {label && (
                <div style={{ background: '#16A34A', padding: '4px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.06em' }}>{label}</span>
                </div>
            )}
            <div style={{ padding: '12px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {airlineCode && (
                            <img src={`https://pics.avs.io/60/30/${airlineCode}.png`} alt=""
                                style={{ height: 22, objectFit: 'contain' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                loading="lazy" />
                        )}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>{airlineName}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: CABIN_COLOR[cabin] ?? '#0E2A55', color: '#fff' }}>{cabin}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#EEF4FF', color: '#2A60C2', border: '1px solid #C7D9F8' }}>{program}</span>
                            </div>
                            {data && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{data}</div>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#0E2A55' }}>{milhas.toLocaleString('pt-BR')}</div>
                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>pts</div>
                        {taxas && taxas !== '0' && <div style={{ fontSize: 10, color: '#94A3B8' }}>+ {taxas} taxas</div>}
                    </div>
                </div>

                {/* Route timeline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'center', minWidth: 40 }}>
                        {partida && <div style={{ fontSize: 16, fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{partida}</div>}
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginTop: partida ? 2 : 0 }}>{origem}</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {duracaoMin && <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B' }}>{fmtDur(duracaoMin)}</span>}
                        <div style={{ position: 'relative', height: 1, background: '#BBF7D0', width: '100%' }}>
                            <span style={{ position: 'absolute', right: -1, top: -5, fontSize: 10, color: '#16A34A' }}>✈</span>
                        </div>
                        <span style={{ fontSize: 10, color: (paradas ?? 0) === 0 ? '#16A34A' : '#94A3B8', fontWeight: (paradas ?? 0) === 0 ? 700 : 400 }}>
                            {stopLabel(paradas, escalas)}
                        </span>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 40 }}>
                        {chegada && <div style={{ fontSize: 16, fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{chegada}</div>}
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginTop: chegada ? 2 : 0 }}>{destino}</div>
                    </div>
                </div>

                {/* Connections detail */}
                {escalas && escalas.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#64748B' }}>{origem}</span>
                        {escalas.map((esc, i) => (
                            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 10, color: '#94A3B8' }}>→</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#F97316', background: '#FFF7ED', padding: '1px 6px', borderRadius: 4 }}>{esc}</span>
                            </span>
                        ))}
                        <span style={{ fontSize: 10, color: '#94A3B8' }}>→</span>
                        <span style={{ fontSize: 11, color: '#64748B' }}>{destino}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── StrategyContent ─────────────────────────────────────────────────────────────

interface StrategyContentProps {
    strategy: StrategyResult
    seatsContext?: SeatsContext
    cashPrice?: number
    onRegenerate?: () => void
    userId?: string
}

export function StrategyContent({ strategy, seatsContext, cashPrice = 0, onRegenerate, userId }: StrategyContentProps) {
    const [openSteps, setOpenSteps] = useState<Set<number>>(new Set())
    const [rulesOpen, setRulesOpen] = useState(false)
    const [promoOpen, setPromoOpen] = useState(false)
    const [cpmInfoOpen, setCpmInfoOpen] = useState(false)
    const [taxasInfoOpen, setTaxasInfoOpen] = useState(false)
    const [cpmHistorico, setCpmHistorico] = useState<{ avg: number; count: number } | null>(null)

    function toggleStep(i: number) {
        setOpenSteps(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
    }

    useEffect(() => {
        if (!strategy.programa_recomendado || !userId) return
        setCpmHistorico(null)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        supabase
            .from('strategies')
            .select('structured_result')
            .eq('user_id', userId)
            .gte('created_at', thirtyDaysAgo)
            .not('structured_result', 'is', null)
            .limit(20)
            .then(({ data }) => {
                if (!data || data.length === 0) return
                const cpms = data
                    .map(r => {
                        const sr = r.structured_result as Record<string, unknown>
                        return typeof sr?.cpm_resgate === 'number' ? sr.cpm_resgate : null
                    })
                    .filter((v): v is number => v !== null && v > 0)
                if (cpms.length < 2) return
                const avg = cpms.reduce((s, v) => s + v, 0) / cpms.length
                setCpmHistorico({ avg: parseFloat(avg.toFixed(2)), count: cpms.length })
            })
    }, [strategy.programa_recomendado, userId])

    const economyPct = strategy.economia_pct ?? 0
    const milesNeeded = strategy.milhas_necessarias ?? 0
    const taxesBrl = strategy.taxas_estimadas_brl ?? 0
    const custoTotalComMilhas = strategy.custo_total_estrategia
        ?? (strategy.comparacao_programas?.find(p => p.melhor_opcao)?.custo_total_brl)
        ?? taxesBrl

    const idaAirlineName = seatsContext
        ? (seatsContext.airlineCode ? (AIRLINE_FULL[seatsContext.airlineCode] ?? seatsContext.airlineName) : seatsContext.program)
        : ''
    const voltaAirlineName = seatsContext
        ? (seatsContext.voltaAirlineCode ? (AIRLINE_FULL[seatsContext.voltaAirlineCode] ?? seatsContext.voltaAirlineName ?? seatsContext.program) : seatsContext.program)
        : ''

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Voo(s) selecionado(s) ──────────────────────────────────────── */}
            {seatsContext && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Voo selecionado
                    </div>

                    <FlightMiniCard
                        airlineCode={seatsContext.airlineCode || undefined}
                        airlineName={idaAirlineName}
                        program={seatsContext.program}
                        cabin={seatsContext.cabin}
                        origem={seatsContext.origem}
                        destino={seatsContext.destino}
                        data={seatsContext.dataVoo}
                        milhas={seatsContext.idaMilhas}
                        taxas={seatsContext.isRoundTrip ? undefined : seatsContext.taxas}
                        partida={seatsContext.partida}
                        chegada={seatsContext.chegada}
                        paradas={seatsContext.paradas}
                        escalas={seatsContext.escalas}
                        duracaoMin={seatsContext.duracaoMin}
                        label={seatsContext.isRoundTrip ? 'IDA' : undefined}
                    />

                    {seatsContext.isRoundTrip && seatsContext.voltaMilhas && (
                        <FlightMiniCard
                            airlineCode={seatsContext.voltaAirlineCode || seatsContext.airlineCode || undefined}
                            airlineName={voltaAirlineName}
                            program={seatsContext.program}
                            cabin={seatsContext.cabin}
                            origem={seatsContext.destino}
                            destino={seatsContext.origem}
                            data={seatsContext.voltaData ?? ''}
                            milhas={seatsContext.voltaMilhas}
                            taxas={seatsContext.taxas}
                            partida={seatsContext.voltaPartida}
                            chegada={seatsContext.voltaChegada}
                            paradas={seatsContext.voltaParadas}
                            escalas={seatsContext.voltaEscalas}
                            duracaoMin={seatsContext.voltaDuracaoMin}
                            label="VOLTA"
                        />
                    )}

                    {seatsContext.isRoundTrip && seatsContext.voltaMilhas && (
                        <div style={{ background: '#0E2A55', borderRadius: 10, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Total ida + volta</span>
                            <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{seatsContext.totalMilhas.toLocaleString('pt-BR')} pts</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── vale_a_pena: false ─────────────────────────────────────────── */}
            {strategy.vale_a_pena === false && (
                <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', border: '2px solid #FED7AA', borderRadius: 14 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <AlertTriangle size={17} color="#EA580C" />
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#C2410C' }}>Dinheiro é mais vantajoso</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#7C2D12', lineHeight: 1.6, margin: 0 }}>{strategy.motivo}</p>
                    {strategy.cpm_resgate > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: '#FEF3C7', borderRadius: 8, padding: '6px 10px', width: 'fit-content' }}>
                            <TrendingDown size={13} color="#D97706" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>CPM: {strategy.cpm_resgate.toFixed(2)} c/pt — {strategy.cpm_avaliacao}</span>
                        </div>
                    )}
                    {seatsContext && (
                        <a
                            href={buildGfUrl(seatsContext.origem, seatsContext.destino, seatsContext.dataVoo, seatsContext.voltaData)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                marginTop: 14,
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: '#1A73E8', color: '#fff',
                                borderRadius: 10, padding: '9px 16px',
                                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                            }}
                        >
                            <ExternalLink size={13} />
                            Ver voo mais barato no Google Flights
                        </a>
                    )}
                </div>
            )}

            {/* ── CPM badge ─────────────────────────────────────────────────── */}
            {strategy.vale_a_pena !== false && strategy.cpm_resgate > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                            background: strategy.cpm_resgate >= 2.5 ? '#DCFCE7' : strategy.cpm_resgate >= 1.8 ? '#DBEAFE' : '#FEF9C3',
                            border: `1px solid ${strategy.cpm_resgate >= 2.5 ? '#86EFAC' : strategy.cpm_resgate >= 1.8 ? '#93C5FD' : '#FDE047'}`,
                            borderRadius: 20,
                        }}>
                            <TrendingUp size={13} color={strategy.cpm_resgate >= 2.5 ? '#16A34A' : strategy.cpm_resgate >= 1.8 ? '#2563EB' : '#CA8A04'} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: strategy.cpm_resgate >= 2.5 ? '#15803D' : strategy.cpm_resgate >= 1.8 ? '#1D4ED8' : '#A16207' }}>
                                CPM {strategy.cpm_resgate.toFixed(2)} c/pt — {strategy.cpm_avaliacao}
                            </span>
                        </div>
                        <button
                            onClick={() => setCpmInfoOpen(o => !o)}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: '#94A3B8', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
                        >
                            <Info size={13} /> O que é CPM?
                        </button>
                    </div>
                    <AnimatePresence>
                        {cpmInfoOpen && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                                style={{ background: '#F8FAFF', border: '1px solid #C7D9F8', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#0E2A55', lineHeight: 1.7 }}>
                                <strong>CPM (Centavos Por Milha)</strong> mede se o resgate vale a pena.<br />
                                CPM {strategy.cpm_resgate.toFixed(2)} significa que cada milha usada vale R$ 0,0{Math.round(strategy.cpm_resgate * 10)} para você — ou seja, você economizou aproximadamente <strong>R$ {strategy.cpm_resgate.toFixed(2)} a cada 100 milhas</strong> em vez de pagar o voo em dinheiro.<br />
                                <span style={{ color: '#16A34A', fontWeight: 700 }}>≥ 2.0 c/pt = bom resgate</span> · <span style={{ color: '#CA8A04', fontWeight: 700 }}>≥ 1.2 c/pt = razoável</span> · <span style={{ color: '#DC2626', fontWeight: 700 }}>{'< 1.2 c/pt = dinheiro é melhor'}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {cpmHistorico && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10.5px', color: '#64748B' }}>
                            {strategy.cpm_resgate > cpmHistorico.avg
                                ? <TrendingUp size={11} color="#16A34A" />
                                : <TrendingDown size={11} color="#DC2626" />}
                            {strategy.cpm_resgate > cpmHistorico.avg
                                ? `Acima da sua média dos últimos 30 dias (${cpmHistorico.avg.toFixed(2)} c/pt)`
                                : `Abaixo da sua média dos últimos 30 dias (${cpmHistorico.avg.toFixed(2)} c/pt)`}
                        </div>
                    )}
                </div>
            )}

            {/* ── Comparação de programas ────────────────────────────────────── */}
            {(strategy.comparacao_programas ?? []).length > 1 && (
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                        Comparação de programas
                    </div>
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x mandatory' }}>
                        {(strategy.comparacao_programas ?? []).map((prog: ProgramComparison) => {
                            const coveragePct = prog.milhas_necessarias > 0
                                ? Math.min(100, Math.round(prog.total_potencial / prog.milhas_necessarias * 100)) : 100
                            const promoTransfers = prog.transferencias.filter(t => t.promo_bonus_pct > 0)
                            return (
                                <div key={prog.programa} style={{
                                    minWidth: 200, maxWidth: 230, flexShrink: 0, scrollSnapAlign: 'start',
                                    borderRadius: 12,
                                    border: `2px solid ${prog.melhor_opcao ? '#16A34A' : 'var(--border-faint)'}`,
                                    background: prog.melhor_opcao ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'var(--bg-subtle)',
                                    padding: '12px', display: 'flex', flexDirection: 'column', gap: 8,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{prog.programa}</span>
                                        {prog.melhor_opcao && (
                                            <span style={{ fontSize: 9, fontWeight: 700, background: '#16A34A', color: '#fff', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>MELHOR</span>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
                                            {prog.milhas_necessarias.toLocaleString('pt-BR')} pts
                                            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>necessários</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                                            <span>Cobertura</span><span style={{ fontWeight: 700 }}>{coveragePct}%</span>
                                        </div>
                                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${coveragePct}%`, background: prog.deficit === 0 ? '#16A34A' : '#3B82F6', borderRadius: 3 }} />
                                        </div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: prog.deficit === 0 ? '#16A34A' : '#DC2626', marginTop: 3 }}>
                                            {prog.deficit === 0
                                                ? `✓ Em carteira: ${prog.total_potencial.toLocaleString('pt-BR')} pts`
                                                : `Em carteira: ${prog.total_potencial.toLocaleString('pt-BR')} · Faltam: ${prog.deficit.toLocaleString('pt-BR')} pts`}
                                        </div>
                                    </div>
                                    {promoTransfers.slice(0, 2).map(t => (
                                        <div key={t.source} style={{ fontSize: 10, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '3px 7px', color: '#92400E', fontWeight: 600, lineHeight: 1.4 }}>
                                            ★ {t.source}: ×{t.ratio_base} +{t.promo_bonus_pct}% = ×{t.ratio_efetivo.toFixed(1)} efetivo
                                        </div>
                                    ))}
                                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {prog.custo_compra_milhas_brl > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                                <span>Comprar milhas</span>
                                                <span>R$ {prog.custo_compra_milhas_brl.toLocaleString('pt-BR')}</span>
                                            </div>
                                        )}
                                        {prog.promo_compra_ativa && (
                                            <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 700 }}>
                                                ★ Promo: R${prog.custo_efetivo_por_mil}/mil
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                            <span>Taxas estimadas</span>
                                            <span>~R$ {prog.taxas_estimadas_brl.toLocaleString('pt-BR')}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                                            <span style={{ color: 'var(--text-primary)' }}>Total</span>
                                            <span style={{ color: prog.melhor_opcao ? '#16A34A' : 'var(--text-primary)' }}>
                                                R$ {prog.custo_total_brl.toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                        {prog.economia_vs_cash_pct > 0 && (
                                            <div style={{ fontSize: 11, color: '#16A34A', textAlign: 'right', fontWeight: 700 }}>Economia: {prog.economia_vs_cash_pct}%</div>
                                        )}
                                        {prog.economia_vs_cash_pct < 0 && (
                                            <div style={{ fontSize: 10, color: '#DC2626', textAlign: 'right', fontWeight: 700 }}>⚠ {Math.abs(prog.economia_vs_cash_pct)}% mais caro que dinheiro</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Programa recomendado ───────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', background: strategy.vale_a_pena === false ? 'var(--bg-subtle)' : 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', border: `1px solid ${strategy.vale_a_pena === false ? 'var(--border-light)' : '#C7D9F8'}`, borderRadius: 12 }}>
                <Zap size={16} color={strategy.vale_a_pena === false ? 'var(--text-muted)' : '#2A60C2'} />
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: strategy.vale_a_pena === false ? 'var(--text-muted)' : '#2A60C2', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {strategy.vale_a_pena === false ? 'Se ainda quiser usar milhas' : 'Programa recomendado'}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)' }}>{strategy.programa_recomendado}</div>
                    {strategy.alternativa && (
                        <div style={{ fontSize: 11, color: '#64748B' }}>Alternativa: {strategy.alternativa}</div>
                    )}
                </div>
            </div>

            {/* ── C1: Warning when recommended program ≠ selected flight program ── */}
            {seatsContext && strategy.programa_recomendado && strategy.programa_recomendado !== seatsContext.program && (
                <div style={{ display: 'flex', gap: 8, padding: '12px 14px', background: '#FFF7ED', border: '2px solid #FED7AA', borderRadius: 12 }}>
                    <AlertTriangle size={16} color="#EA580C" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#C2410C', marginBottom: 4 }}>
                            Programa diferente do voo selecionado
                        </div>
                        <div style={{ fontSize: 12, color: '#7C2D12', lineHeight: 1.6 }}>
                            O voo que você escolheu está disponível no <strong>{seatsContext.program}</strong>, mas a estratégia recomenda <strong>{strategy.programa_recomendado}</strong> por ter menor custo total. Confirme disponibilidade separadamente no site do {strategy.programa_recomendado} — cada programa tem estoque próprio de assentos prêmio.
                        </div>
                    </div>
                </div>
            )}

            {strategy.vale_a_pena !== false && (
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{strategy.motivo}</p>
            )}

            {/* ── Savings comparison ────────────────────────────────────────── */}
            {cashPrice > 0 && strategy.vale_a_pena !== false && (
                <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '14px', padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                        <TrendingDown size={15} color="var(--green)" />
                        <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '13px' }}>
                            Economia estimada: {economyPct}%{strategy.economia_brl ? ` (~R$ ${strategy.economia_brl.toLocaleString('pt-BR')})` : ''}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '10px' }}>
                        <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Preço cash</div>
                            <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--red)', letterSpacing: '-0.02em' }}>R$ {cashPrice.toLocaleString('pt-BR')}</div>
                        </div>
                        <ArrowRight size={18} color="var(--text-faint)" />
                        <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Custo total com milhas</div>
                            <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.02em' }}>R$ {custoTotalComMilhas.toLocaleString('pt-BR')}</div>
                            {custoTotalComMilhas !== taxesBrl && taxesBrl > 0 && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>taxas: R$ {taxesBrl.toLocaleString('pt-BR')}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Miles stats ───────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Milhas necessárias</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{milesNeeded.toLocaleString('pt-BR')} pts</div>
                    </div>
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Taxas estimadas</span>
                            <button onClick={() => setTaxasInfoOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#94A3B8', display: 'flex' }}>
                                <Info size={11} />
                            </button>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>R$ {taxesBrl.toLocaleString('pt-BR')}</div>
                    </div>
                </div>
                <AnimatePresence>
                    {taxasInfoOpen && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                            style={{ background: '#F8FAFF', border: '1px solid #C7D9F8', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#0E2A55', lineHeight: 1.7 }}>
                            <strong>O que são as taxas?</strong> São cobranças aeroportuárias e de combustível obrigatórias em toda emissão com milhas — mesmo usando milhas para o bilhete, este valor é pago <strong>em dinheiro</strong> no momento da reserva. São diferentes para cada companhia e destino.
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Cobertura ─────────────────────────────────────────────────── */}
            {(strategy.milhas_em_carteira !== undefined || strategy.milhas_faltantes !== undefined) && (
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sua cobertura</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '10px', textAlign: 'center', border: '1px solid var(--border-faint)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Em carteira</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}>{(strategy.milhas_em_carteira ?? 0).toLocaleString('pt-BR')} pts</div>
                        </div>
                        <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '10px', textAlign: 'center', border: '1px solid var(--border-faint)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Faltam</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: (strategy.milhas_faltantes ?? 0) > 0 ? '#DC2626' : '#16A34A' }}>
                                {(strategy.milhas_faltantes ?? 0) > 0 ? `${strategy.milhas_faltantes!.toLocaleString('pt-BR')} pts` : '✓ Coberto'}
                            </div>
                        </div>
                    </div>
                    {strategy.como_completar_faltantes && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <Coins size={14} color="#2A60C2" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{strategy.como_completar_faltantes}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── C2: Expandable promo badge ────────────────────────────────── */}
            {strategy.promocao_ativa && (
                <div style={{ border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, overflow: 'hidden' }}>
                    <button
                        onClick={() => setPromoOpen(o => !o)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', background: 'var(--amber-bg)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tag size={14} color="var(--amber)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600, textAlign: 'left' }}>{strategy.promocao_ativa}</span>
                        </div>
                        {(strategy.regras_promocoes ?? []).length > 0 && (
                            promoOpen ? <ChevronUp size={13} color="#D97706" style={{ flexShrink: 0 }} /> : <ChevronDown size={13} color="#D97706" style={{ flexShrink: 0 }} />
                        )}
                    </button>
                    <AnimatePresence>
                        {promoOpen && (strategy.regras_promocoes ?? []).length > 0 && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                                <div style={{ padding: '10px 14px 12px', background: '#FFFDF0', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px dashed rgba(245,158,11,0.3)' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Regras e condições</div>
                                    {(strategy.regras_promocoes ?? []).map((rule, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
                                            <span style={{ flexShrink: 0, marginTop: 2 }}>•</span>
                                            <span>{rule}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* ── Steps ─────────────────────────────────────────────────────── */}
            <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Plano passo a passo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(strategy.steps ?? []).map((step, i) => {
                        const detail = strategy.step_details?.[i]
                        const isOpen = openSteps.has(i)
                        return (
                            <motion.div key={i}
                                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.08 }}
                                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-faint)', borderRadius: '12px', overflow: 'hidden' }}
                            >
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 14px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-start)', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>{i + 1}</div>
                                    <p style={{ flex: 1, fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0 }}>{step}</p>
                                    {detail && (
                                        <button onClick={() => toggleStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, flexShrink: 0, fontFamily: 'inherit' }}>
                                            {isOpen ? <><ChevronUp size={13} /> Ocultar</> : <><ChevronDown size={13} /> Saiba mais</>}
                                        </button>
                                    )}
                                </div>
                                <AnimatePresence>
                                    {isOpen && detail && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                                            <div style={{ padding: '0 14px 14px 50px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, borderTop: '1px dashed var(--border-faint)' }}>
                                                <div style={{ paddingTop: 10 }}>{detail}</div>
                                                {extractUrls(detail).map(url => (
                                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, marginRight: 8, padding: '6px 12px', background: '#EEF4FF', border: '1px solid #C7D9F8', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#2A60C2', textDecoration: 'none' }}
                                                    >
                                                        <ExternalLink size={11} /> Abrir no site →
                                                    </a>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </div>
            </div>

            {/* ── Aviso ─────────────────────────────────────────────────────── */}
            {strategy.aviso && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
                    <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: '#92400E' }}>{strategy.aviso}</span>
                </div>
            )}

            {/* ── Regras das promoções ──────────────────────────────────────── */}
            {(strategy.regras_promocoes ?? []).length > 0 && (
                <div style={{ border: '1px solid #FDE68A', borderRadius: 12, overflow: 'hidden' }}>
                    <button onClick={() => setRulesOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: '#FFFBEB', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <AlertTriangle size={14} color="#D97706" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Regras e condições das promoções</span>
                        </div>
                        {rulesOpen ? <ChevronUp size={13} color="#D97706" /> : <ChevronDown size={13} color="#D97706" />}
                    </button>
                    <AnimatePresence>
                        {rulesOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                                <div style={{ padding: '10px 14px 14px', background: '#FFFDF0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(strategy.regras_promocoes ?? []).map((rule, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
                                            <span style={{ flexShrink: 0, marginTop: 2 }}>•</span>
                                            <span>{rule}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* ── Regenerate ────────────────────────────────────────────────── */}
            {onRegenerate && (
                <button
                    onClick={onRegenerate}
                    style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: 10, padding: '10px', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                    <Zap size={12} /> Regerar estratégia
                </button>
            )}
            <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: 0 }}>✓ Salva automaticamente no seu histórico</p>
        </div>
    )
}
