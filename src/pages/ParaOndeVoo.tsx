// src/pages/ParaOndeVoo.tsx
import { useState, useEffect, useMemo } from 'react'
import { Loader2, MapPin, AlertCircle, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import {
    DESTINATIONS, REGION_LABELS, getDestinationsByRegions,
    type Region, type Destination,
} from '@/lib/discoverDestinations'
import {
    CREDIT_CARDS, ACTIVE_PROMOTIONS,
    computeMiles, findPromotion, getClubTierBonus,
    type TransferPromotion,
} from '@/lib/transferData'

// ─── Types ─────────────────────────────────────────────────────────────────────

type MilesMap = Record<string, number>
type CardPoints = Record<string, number>

interface ProgramResult {
    source: string
    programName: string
    economy_miles: number | null
    business_miles: number | null
    economy_direct: boolean
    business_direct: boolean
    sampleDate: string
}

interface RouteResult {
    destination: string
    results_by_program: ProgramResult[]
}

type ClassifyStatus =
    | { kind: 'direct';   programName: string; miles: number; isDirect: boolean }
    | { kind: 'transfer'; programName: string; miles: number; cardName: string; pointsNeeded: number; bonusPct: number; isDirect: boolean }
    | { kind: 'almost';   programName: string; miles: number; cardName: string | null; pointsNeeded: number | null; userHas: number | null; deficit: number; bonusPct: number | null }
    | { kind: 'far' }

interface ClassifiedRoute {
    destination: Destination
    status: ClassifyStatus
}

// ─── Classification Logic ──────────────────────────────────────────────────────

function classifyProgram(
    miles: number,
    programName: string,
    isDirect: boolean,
    wallet: { milesMap: MilesMap; cardPoints: CardPoints; activeCards: string[]; activeClubs: string[]; activeClubTiers: Record<string, string> },
    promos: TransferPromotion[],
): ClassifyStatus {
    // 1. Direct check
    const directBalance = wallet.milesMap[programName] ?? 0
    if (directBalance >= miles) {
        return { kind: 'direct', programName, miles, isDirect }
    }

    // 2. Transfer check — best available card with a path to this program
    let bestAlmost: Extract<ClassifyStatus, { kind: 'almost' }> | null = null

    for (const cardId of wallet.activeCards) {
        const card = CREDIT_CARDS.find(c => c.id === cardId)
        if (!card) continue
        const partner = card.partners.find(p => p.program === programName)
        if (!partner) continue

        // Find best tier the user qualifies for (tiers are best-first)
        const bestTier = partner.tiers.find(t => t.clubId === null || wallet.activeClubs.includes(t.clubId))
            ?? partner.tiers[partner.tiers.length - 1]

        const promo = findPromotion(cardId, programName, promos)
        const tierName = bestTier.clubId ? (wallet.activeClubTiers[bestTier.clubId] ?? null) : null
        const effectiveBonus = promo ? getClubTierBonus(promo, tierName) : bestTier.bonusPercent

        const userPts = wallet.cardPoints[cardId] ?? 0
        const milesFromUserPts = computeMiles(userPts, bestTier.ratio, effectiveBonus)

        if (milesFromUserPts >= miles) {
            const pointsNeeded = Math.ceil(miles * bestTier.ratio / (1 + effectiveBonus / 100))
            return { kind: 'transfer', programName, miles, cardName: card.name, pointsNeeded, bonusPct: effectiveBonus, isDirect }
        }

        // Almost: how far are they?
        const pointsNeeded = Math.ceil(miles * bestTier.ratio / (1 + effectiveBonus / 100))
        const deficit = pointsNeeded - userPts
        const deficitRatio = pointsNeeded > 0 ? deficit / pointsNeeded : 1

        if (deficitRatio <= 0.40) {
            const candidate: Extract<ClassifyStatus, { kind: 'almost' }> = {
                kind: 'almost', programName, miles, cardName: card.name,
                pointsNeeded, userHas: userPts, deficit, bonusPct: effectiveBonus,
            }
            if (!bestAlmost || deficit < (bestAlmost.deficit ?? Infinity)) bestAlmost = candidate
        }
    }

    // 3. Direct "almost there" (no transfer path works, but user is close on direct miles)
    if (directBalance > 0) {
        const deficit = miles - directBalance
        if (deficit / miles <= 0.40) {
            const candidate: Extract<ClassifyStatus, { kind: 'almost' }> = {
                kind: 'almost', programName, miles,
                cardName: null, pointsNeeded: null, userHas: directBalance, deficit, bonusPct: null,
            }
            if (!bestAlmost || deficit < (bestAlmost.deficit ?? Infinity)) bestAlmost = candidate
        }
    }

    return bestAlmost ?? { kind: 'far' }
}

function classifyRoute(
    route: RouteResult,
    cabin: 'economy' | 'business',
    dest: Destination,
    wallet: { milesMap: MilesMap; cardPoints: CardPoints; activeCards: string[]; activeClubs: string[]; activeClubTiers: Record<string, string> },
    promos: TransferPromotion[],
): ClassifiedRoute | null {
    let best: ClassifyStatus = { kind: 'far' }
    const priority = { direct: 0, transfer: 1, almost: 2, far: 3 }

    for (const prog of route.results_by_program) {
        const miles = cabin === 'business' ? prog.business_miles : prog.economy_miles
        if (!miles) continue
        const isDirect = cabin === 'business' ? prog.business_direct : prog.economy_direct
        const status = classifyProgram(miles, prog.programName, isDirect, wallet, promos)
        if (priority[status.kind] < priority[best.kind]) best = status
    }

    if (best.kind === 'far') return null
    return { destination: dest, status: best }
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
    milesMap: MilesMap
    cardPoints: CardPoints
    activeCards: string[]
    activeClubs: string[]
    activeClubTiers: Record<string, string>
}

export default function ParaOndeVoo({ milesMap, cardPoints, activeCards, activeClubs, activeClubTiers }: Props) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { plan } = usePlan()
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

    const homeIata: string = (user?.user_metadata?.home_airport as string) ?? ''
    const homeLabel: string = (user?.user_metadata?.home_airport_label as string) ?? ''

    const [originIata] = useState(homeIata)
    const [originLabel] = useState(homeLabel)

    const [selectedMonths, setSelectedMonths] = useState<string[]>([])
    const [selectedRegions, setSelectedRegions] = useState<Region[]>([])
    const [cabin, setCabin] = useState<'economy' | 'business'>('economy')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [rawRoutes, setRawRoutes] = useState<RouteResult[]>([])

    const [livePromos, setLivePromos] = useState<TransferPromotion[]>(ACTIVE_PROMOTIONS)
    useEffect(() => {
        fetch(`${apiBase}/api/transfer-promotions`)
            .then(r => r.json())
            .then(d => { if (Array.isArray(d.promotions) && d.promotions.length > 0) setLivePromos(d.promotions) })
            .catch(() => {})
    }, [apiBase])

    const monthOptions = useMemo(() => {
        const now = new Date()
        return Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1)
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
            return { value, label }
        })
    }, [])

    const toggleMonth = (m: string) =>
        setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

    const toggleRegion = (r: Region) =>
        setSelectedRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

    const wallet = { milesMap, cardPoints, activeCards, activeClubs, activeClubTiers }

    const classified = useMemo<ClassifiedRoute[]>(() => {
        return rawRoutes.flatMap(route => {
            const dest = DESTINATIONS.find(d => d.iata === route.destination)
            if (!dest) return []
            const result = classifyRoute(route, cabin, dest, wallet, livePromos)
            return result ? [result] : []
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawRoutes, cabin, milesMap, cardPoints, activeCards, activeClubs, activeClubTiers, livePromos])

    const canFly = classified.filter(r => r.status.kind === 'direct' || r.status.kind === 'transfer')
    const almostThere = classified.filter(r => r.status.kind === 'almost')

    const isFree = plan === 'free'
    const canFlyShow = isFree ? canFly.slice(0, 3) : canFly
    const almostShow = isFree ? almostThere.slice(0, Math.max(0, 5 - canFly.length)) : almostThere

    async function search() {
        if (!originIata) { setError('Defina seu aeroporto de origem nas Configurações.'); return }
        if (selectedMonths.length === 0) { setError('Selecione pelo menos um mês.'); return }
        setError('')
        setLoading(true)
        setRawRoutes([])

        const destinations = getDestinationsByRegions(selectedRegions)
            .map(d => d.iata)
            .filter(iata => iata !== originIata)

        if (destinations.length === 0) { setLoading(false); setError('Selecione uma região.'); return }

        try {
            const res = await fetch(`${apiBase}/api/discover-routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: originIata, destinations, months: selectedMonths, cabin }),
            })
            if (!res.ok) throw new Error(`Erro ${res.status}`)
            const data = await res.json()
            setRawRoutes(data.routes ?? [])
        } catch (e: unknown) {
            setError((e as Error).message ?? 'Erro ao buscar destinos.')
        } finally {
            setLoading(false)
        }
    }

    if (!homeIata) {
        return (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748B' }}>
                <MapPin size={32} style={{ margin: '0 auto 12px', display: 'block', color: '#94A3B8' }} />
                <p style={{ fontWeight: 600, color: '#0E2A55', marginBottom: 8 }}>Aeroporto de origem não configurado</p>
                <p style={{ fontSize: 14, marginBottom: 16 }}>Defina seu aeroporto padrão nas Configurações para usar esta feature.</p>
                <button
                    onClick={() => navigate('/configuracoes')}
                    style={{ background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                    Ir para Configurações →
                </button>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Filter bar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC', borderRadius: 14, padding: 16, border: '1px solid #E2EAF5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#64748B', minWidth: 60 }}>De:</span>
                    <span style={{ fontWeight: 700, color: '#0E2A55', fontSize: 14 }}>{originLabel || originIata}</span>
                </div>

                <div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>Quando?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {monthOptions.map(m => (
                            <button
                                key={m.value}
                                onClick={() => toggleMonth(m.value)}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                                    background: selectedMonths.includes(m.value) ? '#2A60C2' : '#EEF2F8',
                                    color: selectedMonths.includes(m.value) ? '#fff' : '#0E2A55',
                                }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>Para onde?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(Object.keys(REGION_LABELS) as Region[]).map(r => (
                            <button
                                key={r}
                                onClick={() => toggleRegion(r)}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                                    background: selectedRegions.includes(r) ? '#0E2A55' : '#EEF2F8',
                                    color: selectedRegions.includes(r) ? '#fff' : '#0E2A55',
                                }}
                            >
                                {REGION_LABELS[r]}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Cabine:</span>
                    {(['economy', 'business'] as const).map(c => (
                        <button
                            key={c}
                            onClick={() => setCabin(c)}
                            style={{
                                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                                background: cabin === c ? '#7C3AED' : '#EEF2F8',
                                color: cabin === c ? '#fff' : '#0E2A55',
                            }}
                        >
                            {c === 'economy' ? 'Economy' : 'Business'}
                        </button>
                    ))}
                </div>

                <button
                    onClick={search}
                    disabled={loading}
                    style={{
                        background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 12,
                        padding: '12px 0', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                >
                    {loading
                        ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Buscando...</>
                        : '🔍 Buscar destinos'
                    }
                </button>
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444', fontSize: 13 }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {!loading && rawRoutes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {canFlyShow.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 16 }}>✅</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: '#0E2A55' }}>Você pode voar agora</span>
                                <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                                    {canFly.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {canFlyShow.map(r => (
                                    <DiscoverCard
                                        key={r.destination.iata}
                                        route={r}
                                        cabin={cabin}
                                        onStrategy={() => navigate(`/resultados?orig=${originIata}&dest=${r.destination.iata}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {almostShow.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 16 }}>🔜</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: '#0E2A55' }}>Quase lá</span>
                                <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                                    {almostThere.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {almostShow.map(r => (
                                    <DiscoverCard
                                        key={r.destination.iata}
                                        route={r}
                                        cabin={cabin}
                                        onStrategy={() => navigate(`/resultados?orig=${originIata}&dest=${r.destination.iata}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {isFree && (canFly.length > canFlyShow.length || almostThere.length > almostShow.length) && (
                        <div style={{ textAlign: 'center', padding: '20px 16px', background: '#F8FAFC', borderRadius: 14, border: '1.5px dashed #D1E0F5' }}>
                            <Lock size={20} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                            <p style={{ fontWeight: 700, color: '#0E2A55', marginBottom: 4 }}>
                                +{(canFly.length - canFlyShow.length) + (almostThere.length - almostShow.length)} destinos encontrados
                            </p>
                            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Desbloqueie todos os destinos com o plano Essencial</p>
                            <button
                                onClick={() => navigate('/planos')}
                                style={{ background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                            >
                                Ver planos
                            </button>
                        </div>
                    )}

                    {canFly.length === 0 && almostThere.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 14 }}>
                            Nenhum destino alcançável com o saldo atual. Tente adicionar mais milhas ou pontos de cartão na sua carteira.
                        </div>
                    )}
                </div>
            )}

            {!loading && rawRoutes.length === 0 && !error && (
                <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 14 }}>
                    Selecione os filtros e clique em buscar para ver seus destinos.
                </div>
            )}
        </div>
    )
}

// ─── DiscoverCard ──────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('pt-BR') }

function DiscoverCard({ route, cabin, onStrategy }: { route: ClassifiedRoute; cabin: string; onStrategy: () => void }) {
    const { destination: dest, status } = route
    const miles = 'miles' in status ? status.miles : 0

    return (
        <div style={{
            background: '#fff', borderRadius: 14, padding: '14px 16px',
            border: '1.5px solid #E2EAF5', boxShadow: '0 2px 8px rgba(14,42,85,0.06)',
            display: 'flex', flexDirection: 'column', gap: 10,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{dest.emoji}</span>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#0E2A55' }}>{dest.city}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>
                            {'programName' in status ? status.programName : ''} · {cabin === 'economy' ? 'Economy' : 'Business'}
                            {'isDirect' in status && status.isDirect ? ' · Direto' : ''}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0E2A55' }}>{fmt(miles)}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>milhas</div>
                </div>
            </div>

            {status.kind === 'direct' && (
                <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                    ✅ Você tem {fmt(miles)} milhas direto em {status.programName}
                </div>
            )}

            {status.kind === 'transfer' && (
                <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                    💡 Via {status.cardName} (bônus {status.bonusPct}%) → {fmt(status.pointsNeeded)} pts = {fmt(miles)} milhas
                </div>
            )}

            {status.kind === 'almost' && status.cardName && status.pointsNeeded !== null && status.userHas !== null && (
                <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                    🔜 Faltam {fmt(status.deficit)} pts de {status.cardName} (bônus {status.bonusPct ?? 0}%)
                </div>
            )}

            {status.kind === 'almost' && !status.cardName && status.userHas !== null && (
                <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                    🔜 Faltam {fmt(status.deficit)} milhas em {'programName' in status ? status.programName : ''}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {status.kind === 'almost' && (
                    <button
                        onClick={() => window.location.href = '/wallet'}
                        style={{ fontSize: 13, color: '#7C3AED', background: '#F5F3FF', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Ver promoções
                    </button>
                )}
                <button
                    onClick={onStrategy}
                    style={{ fontSize: 13, color: '#fff', background: '#2A60C2', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600 }}
                >
                    Ver estratégia →
                </button>
            </div>
        </div>
    )
}
