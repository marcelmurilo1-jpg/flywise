import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronDown, ChevronUp, Info, ArrowRight, Zap, AlertTriangle,
    CheckCircle2, ExternalLink, Trophy, Tag, ArrowRightLeft, RefreshCw,
} from 'lucide-react'
import {
    CREDIT_CARDS, MILES_CLUBS, ROUTE_CATEGORIES, LIVELO_AIRLINE_PARTNERS,
    ACTIVE_PROMOTIONS,
    computeMiles, findPromotion, getClubTierBonus, rateCPM,
    type TransferPartner, type TransferPromotion,
} from '@/lib/transferData'

const PROGRAM_COLORS: Record<string, string> = {
    'Smiles': '#FF6B00',
    'LATAM Pass': '#E3000F',
    'TudoAzul': '#003DA5',
    'Livelo': '#8B5CF6',
}

function fmt(n: number) { return n.toLocaleString('pt-BR') }

interface Props {
    activeClubs: string[]
    activeClubTiers: Record<string, string>   // clubId → tier name saved in wallet
}

export default function TransferSimulator({ activeClubs, activeClubTiers }: Props) {
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
    const [points, setPoints] = useState<string>('')
    const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
    const [selectedClubTier, setSelectedClubTier] = useState<string | null>(null)   // selected in sim
    const [expandedRules, setExpandedRules] = useState(false)
    const [expandedClubInfo, setExpandedClubInfo] = useState(false)
    const [liveloTarget, setLiveloTarget] = useState<string | null>(null)
    const [livePromos, setLivePromos] = useState<TransferPromotion[] | null>(null)
    const [viewClass, setViewClass] = useState<'economy' | 'business'>('economy')
    // Live award prices from Seats.aero weekly sync: { category_id → { economy_avg, business_avg, updated_at } }
    const [liveAwardPrices, setLiveAwardPrices] = useState<Record<string, { economy_avg: number | null; business_avg: number | null; updated_at: string }>>({})
    const [awardPricesDate, setAwardPricesDate] = useState<string | null>(null)

    // Fetch live promotions + award prices on mount
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
    useEffect(() => {
        fetch(`${apiBase}/api/transfer-promotions`)
            .then(r => r.json())
            .then(d => { if (Array.isArray(d.promotions) && d.promotions.length > 0) setLivePromos(d.promotions) })
            .catch(() => {})

        fetch(`${apiBase}/api/award-prices`)
            .then(r => r.json())
            .then(d => {
                if (Array.isArray(d.data) && d.data.length > 0) {
                    const map: Record<string, { economy_avg: number | null; business_avg: number | null; updated_at: string }> = {}
                    for (const row of d.data) {
                        map[row.category] = { economy_avg: row.economy_avg, business_avg: row.business_avg, updated_at: row.updated_at }
                    }
                    setLiveAwardPrices(map)
                    if (d.lastUpdated) setAwardPricesDate(d.lastUpdated)
                }
            })
            .catch(() => {})
    }, [])

    const promotions = livePromos ?? ACTIVE_PROMOTIONS

    const card = CREDIT_CARDS.find(c => c.id === selectedCardId) ?? null
    const partner = card?.partners.find(p => p.program === selectedProgram) ?? null
    const pointsNum = parseInt(points.replace(/\D/g, '')) || 0
    const promo = card && selectedProgram ? findPromotion(card.id, selectedProgram, promotions) : null
    const isLivelo = selectedProgram === 'Livelo'

    // Find the club relevant to selected program
    const relevantClub = promo?.clubRequired
        ? MILES_CLUBS.find(c => c.id === promo.clubRequired)
        : null
    const clubHasTiers = (relevantClub?.tiers?.length ?? 0) > 0

    // When program changes, pre-select tier from wallet saved tiers
    useEffect(() => {
        if (!promo?.clubRequired) {
            setSelectedClubTier(null)
            return
        }
        const savedTier = activeClubTiers[promo.clubRequired] ?? null
        // Only pre-select if user actually has the club active
        setSelectedClubTier(activeClubs.includes(promo.clubRequired) ? savedTier : null)
    }, [selectedProgram, promo?.clubRequired]) // eslint-disable-line react-hooks/exhaustive-deps

    // For Livelo hub: compute Livelo miles then show airline sub-step
    const liveloMiles = isLivelo && partner && pointsNum > 0
        ? computeMiles(pointsNum, partner.tiers[0].ratio, partner.tiers[0].bonusPercent)
        : 0

    function getBestTier(p: TransferPartner) {
        const tierResult = p.tiers.find(t => t.clubId === null || activeClubs.includes(t.clubId))
            ?? p.tiers[p.tiers.length - 1]
        return tierResult
    }

    // Compute effective bonus considering selected club tier
    function getEffectiveBonus(): number {
        if (!promo) return activeTier?.bonusPercent ?? 0
        const userHasClub = promo.clubRequired ? activeClubs.includes(promo.clubRequired) : false
        if (!userHasClub) return promo.bonusPercent
        return getClubTierBonus(promo, selectedClubTier)
    }

    const activeTier = partner ? getBestTier(partner) : null
    const effectiveBonus = getEffectiveBonus()
    const milesResult = activeTier && pointsNum > 0 && !isLivelo
        ? computeMiles(pointsNum, activeTier.ratio, effectiveBonus)
        : 0

    // Missing tiers (clubs user doesn't have that would give more)
    const missingTiers = partner?.tiers.filter(
        t => t.clubId !== null && !activeClubs.includes(t.clubId) && t.bonusPercent > (activeTier?.bonusPercent ?? 0)
    ) ?? []

    const programColor = selectedProgram ? (PROGRAM_COLORS[selectedProgram] ?? '#0E2A55') : '#0E2A55'

    // Livelo → airline final miles
    const livPartner = LIVELO_AIRLINE_PARTNERS.find(lp => lp.program === liveloTarget)
    const liveloFinalMiles = liveloMiles > 0 && livPartner
        ? Math.floor(liveloMiles / livPartner.ratio)
        : 0
    const finalProgram = isLivelo ? (liveloTarget ?? null) : selectedProgram
    const finalMiles = isLivelo ? liveloFinalMiles : milesResult
    const finalColor = finalProgram ? (PROGRAM_COLORS[finalProgram] ?? '#0E2A55') : programColor

    function formatPointsInput(val: string) {
        const n = parseInt(val.replace(/\D/g, '')) || 0
        return n === 0 ? '' : n.toLocaleString('pt-BR')
    }

    function onSelectCard(id: string) {
        setSelectedCardId(id)
        setSelectedProgram(null)
        setPoints('')
        setExpandedRules(false)
        setSelectedClubTier(null)
        setLiveloTarget(null)
    }

    function onSelectProgram(prog: string) {
        setSelectedProgram(prog)
        setExpandedRules(false)
        setExpandedClubInfo(false)
        setLiveloTarget(null)
        setSelectedClubTier(null)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── Step 1: Cartão ── */}
            <section>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14 }}>
                    1 · Selecione seu cartão
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {CREDIT_CARDS.map(c => {
                        const isSelected = selectedCardId === c.id
                        return (
                            <button
                                key={c.id}
                                onClick={() => onSelectCard(c.id)}
                                style={{
                                    background: isSelected ? `${c.color}18` : 'var(--bg-white)',
                                    border: `2px solid ${isSelected ? c.color : 'var(--border-light)'}`,
                                    borderRadius: 14, padding: '14px 12px',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                    transition: 'all .18s', textAlign: 'center', position: 'relative',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = `${c.color}80` }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-light)' }}
                            >
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{c.initials}</span>
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? c.color : 'var(--text-dark)', lineHeight: 1.3 }}>{c.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{c.currency}</div>
                                {isSelected && (
                                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                                        <CheckCircle2 size={14} color={c.color} />
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </section>

            <AnimatePresence>
                {card && (
                    <motion.div key="steps-2-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                        {/* ── Step 2: Saldo ── */}
                        <section>
                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14 }}>
                                2 · Informe seu saldo em {card.currency}
                            </div>
                            <div style={{ background: 'var(--bg-white)', border: '1.5px solid var(--border-light)', borderRadius: 16, padding: '20px 22px' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formatPointsInput(points)}
                                        onChange={e => setPoints(e.target.value.replace(/\D/g, ''))}
                                        placeholder="0"
                                        style={{
                                            width: '100%', border: '2px solid var(--border-light)',
                                            borderRadius: 12, padding: '14px 18px',
                                            fontSize: 28, fontWeight: 900, color: 'var(--text-dark)',
                                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                                            letterSpacing: '-0.02em', transition: 'border-color .15s',
                                        }}
                                        onFocus={e => e.currentTarget.style.borderColor = card.color}
                                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                                    />
                                    <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                                        {card.currency}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                    {[10000, 25000, 50000, 100000, 250000].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPoints(String(p))}
                                            style={{
                                                background: pointsNum === p ? card.color : 'var(--snow)',
                                                color: pointsNum === p ? '#fff' : 'var(--text-muted)',
                                                border: `1.5px solid ${pointsNum === p ? card.color : 'var(--border-light)'}`,
                                                borderRadius: 8, padding: '5px 12px',
                                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                                fontFamily: 'inherit', transition: 'all .15s',
                                            }}
                                        >
                                            {p >= 1000 ? `${p / 1000}k` : p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* ── Step 3: Programa destino ── */}
                        <section>
                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14 }}>
                                3 · Escolha o programa de destino
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {card.partners.map(p => {
                                    const tier = getBestTier(p)
                                    const localPromo = findPromotion(card.id, p.program, promotions)
                                    const userHasClub = localPromo?.clubRequired ? activeClubs.includes(localPromo.clubRequired) : false
                                    const savedTier = localPromo?.clubRequired ? activeClubTiers[localPromo.clubRequired] ?? null : null
                                    const displayBonus = localPromo
                                        ? userHasClub
                                            ? getClubTierBonus(localPromo, savedTier)
                                            : localPromo.bonusPercent
                                        : tier.bonusPercent
                                    const miles = pointsNum > 0 ? computeMiles(pointsNum, tier.ratio, displayBonus) : null
                                    const progColor = PROGRAM_COLORS[p.program] ?? '#0E2A55'
                                    const isSelected = selectedProgram === p.program
                                    const hasBetterWithClub = localPromo?.clubRequired && !activeClubs.includes(localPromo.clubRequired)
                                        && localPromo.clubBonusPercent > localPromo.bonusPercent

                                    return (
                                        <div key={p.program}>
                                            <button
                                                onClick={() => onSelectProgram(p.program)}
                                                style={{
                                                    width: '100%',
                                                    background: isSelected ? `${progColor}0e` : 'var(--bg-white)',
                                                    border: `2px solid ${isSelected ? progColor : 'var(--border-light)'}`,
                                                    borderRadius: 14, padding: '16px 18px',
                                                    cursor: 'pointer', fontFamily: 'inherit',
                                                    display: 'flex', alignItems: 'center', gap: 14,
                                                    transition: 'all .18s', textAlign: 'left',
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = `${progColor}50` }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-light)' }}
                                            >
                                                <div style={{ width: 40, height: 40, borderRadius: 10, background: progColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>
                                                        {p.program.split(/[\s&]+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{p.program}</span>
                                                        {p.program === 'Livelo' && (
                                                            <span style={{ background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 800, color: '#5B21B6', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                <ArrowRightLeft size={9} /> HUB → aéreas
                                                            </span>
                                                        )}
                                                        {localPromo && p.program !== 'Livelo' && displayBonus > 0 && (
                                                            <span style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 800, color: '#92400E', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                <Zap size={9} /> +{displayBonus}% bônus
                                                            </span>
                                                        )}
                                                        {hasBetterWithClub && (
                                                            <span style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                <Tag size={9} /> Clube = +{localPromo!.clubBonusPercent}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {p.program === 'Livelo'
                                                            ? `${tier.ratio}:1 → depois transfira para Smiles, LATAM ou Azul`
                                                            : `Taxa ${tier.ratio.toLocaleString('pt-BR')}:1${displayBonus > 0 ? ` +${displayBonus}% bônus` : ''}`
                                                        }
                                                    </div>
                                                </div>
                                                {miles !== null && (
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ fontSize: 20, fontWeight: 900, color: progColor, letterSpacing: '-0.02em' }}>{fmt(miles)}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                                                            {p.program === 'Livelo' ? 'pts Livelo' : 'milhas'}
                                                        </div>
                                                    </div>
                                                )}
                                            </button>

                                            {/* ── Club Plan Dropdown (aparece ao selecionar o programa) ── */}
                                            <AnimatePresence>
                                                {isSelected && localPromo?.clubRequired && clubHasTiers && relevantClub?.tiers && (
                                                    <motion.div
                                                        key={`tier-drop-${p.program}`}
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div style={{ background: `${progColor}06`, border: `1.5px solid ${progColor}30`, borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '14px 18px' }}>
                                                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                                                                Qual seu plano do {relevantClub.name}?
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                {/* Option: no club */}
                                                                <button
                                                                    onClick={() => setSelectedClubTier(null)}
                                                                    style={{
                                                                        background: selectedClubTier === null ? '#FEF2F2' : 'var(--snow)',
                                                                        border: `1.5px solid ${selectedClubTier === null ? '#FECACA' : 'var(--border-light)'}`,
                                                                        borderRadius: 10, padding: '10px 14px',
                                                                        cursor: 'pointer', fontFamily: 'inherit',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        transition: 'all .15s',
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <div style={{ fontSize: 12, fontWeight: 700, color: selectedClubTier === null ? '#DC2626' : 'var(--text-dark)' }}>
                                                                            Não tenho {relevantClub.name}
                                                                        </div>
                                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                                            Bônus: {localPromo.bonusPercent}%
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontSize: 14, fontWeight: 900, color: '#DC2626' }}>
                                                                        {pointsNum > 0 ? `${fmt(computeMiles(pointsNum, 1.0, localPromo.bonusPercent))} mi` : ''}
                                                                    </div>
                                                                </button>
                                                                {/* Club tier options */}
                                                                {relevantClub.tiers!.map(t => {
                                                                    const tierBonus = localPromo.clubTierBonuses[t.name] ?? localPromo.clubBonusPercent
                                                                    const isThisTier = selectedClubTier === t.name
                                                                    return (
                                                                        <button
                                                                            key={t.name}
                                                                            onClick={() => setSelectedClubTier(t.name)}
                                                                            style={{
                                                                                background: isThisTier ? `${progColor}12` : 'var(--snow)',
                                                                                border: `1.5px solid ${isThisTier ? progColor : 'var(--border-light)'}`,
                                                                                borderRadius: 10, padding: '10px 14px',
                                                                                cursor: 'pointer', fontFamily: 'inherit',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                                transition: 'all .15s',
                                                                            }}
                                                                        >
                                                                            <div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                    <span style={{ fontSize: 12, fontWeight: 700, color: isThisTier ? progColor : 'var(--text-dark)' }}>{t.name}</span>
                                                                                    {isThisTier && <CheckCircle2 size={12} color={progColor} />}
                                                                                </div>
                                                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                                                    {t.monthlyFee} · Bônus: {tierBonus}%
                                                                                    {!activeClubs.includes(localPromo.clubRequired!) && (
                                                                                        <span style={{ color: '#F59E0B', marginLeft: 6 }}>· você não tem este clube</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ fontSize: 14, fontWeight: 900, color: isThisTier ? progColor : 'var(--text-muted)' }}>
                                                                                {pointsNum > 0 ? `${fmt(computeMiles(pointsNum, 1.0, tierBonus))} mi` : ''}
                                                                            </div>
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <Info size={10} />
                                                                Bônus por plano variam por campanha — confirme na página oficial antes de transferir
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>

                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Livelo: selecionar aérea destino ── */}
            <AnimatePresence>
                {isLivelo && liveloMiles > 0 && (
                    <motion.div key="livelo-hub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div style={{ background: '#F5F3FF', border: '1.5px solid #C4B5FD', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <ArrowRightLeft size={16} color="#7C3AED" />
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6' }}>
                                    Livelo como HUB: você terá <b>{fmt(liveloMiles)} pts Livelo</b> — escolha para qual aérea transferir (1:1, mín. 15.000 pts):
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {LIVELO_AIRLINE_PARTNERS.map(lp => {
                                    const c = PROGRAM_COLORS[lp.program] ?? '#0E2A55'
                                    const enough = liveloMiles >= lp.minPoints
                                    const selected = liveloTarget === lp.program
                                    return (
                                        <button
                                            key={lp.program}
                                            onClick={() => enough && setLiveloTarget(lp.program)}
                                            disabled={!enough}
                                            style={{
                                                background: selected ? `${c}18` : '#fff',
                                                border: `2px solid ${selected ? c : '#E2EAF5'}`,
                                                borderRadius: 12, padding: '10px 16px',
                                                cursor: enough ? 'pointer' : 'not-allowed',
                                                opacity: enough ? 1 : 0.45,
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                fontFamily: 'inherit', transition: 'all .15s',
                                            }}
                                        >
                                            <div style={{ width: 28, height: 28, borderRadius: 7, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: 10, fontWeight: 900, color: '#fff' }}>
                                                    {lp.program.split(/[\s&]+/).map(w => w[0]).join('').slice(0, 2)}
                                                </span>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: selected ? c : 'var(--text-dark)' }}>{lp.program}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                    {enough
                                                        ? `= ${fmt(Math.floor(liveloMiles / lp.ratio))} milhas`
                                                        : `Mín. ${fmt(lp.minPoints)} pts`}
                                                </div>
                                            </div>
                                            {selected && <CheckCircle2 size={14} color={c} />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Resultado detalhado ── */}
            <AnimatePresence>
                {partner && activeTier && ((isLivelo && liveloTarget) || (!isLivelo && milesResult > 0)) && (
                    <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                        {/* Resultado principal */}
                        <div style={{ background: `linear-gradient(135deg, ${finalColor}15, ${finalColor}08)`, border: `2px solid ${finalColor}30`, borderRadius: 20, padding: '24px 26px', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
                                        Você receberá em {finalProgram ?? selectedProgram}
                                        {isLivelo && <span style={{ color: '#8B5CF6', marginLeft: 8 }}>via Livelo</span>}
                                    </div>
                                    <div style={{ fontSize: 48, fontWeight: 900, color: finalColor, letterSpacing: '-0.03em', lineHeight: 1 }}>
                                        {fmt(finalMiles)}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                                        milhas · {isLivelo
                                            ? `${fmt(liveloMiles)} pts Livelo → ${fmt(finalMiles)} mi ${finalProgram}`
                                            : selectedClubTier
                                                ? `${selectedClubTier} (+${effectiveBonus}% bônus)`
                                                : activeTier.label}
                                    </div>
                                </div>
                                {pointsNum > 0 && (
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>VOCÊ TRANSFERE</div>
                                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-dark)' }}>{fmt(pointsNum)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card?.currency}</div>
                                    </div>
                                )}
                            </div>

                            {!isLivelo && pointsNum > 0 && (
                                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${finalColor}20`, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Taxa base', value: `${fmt(Math.floor(pointsNum / activeTier.ratio))} mi` },
                                        ...(effectiveBonus > 0 ? [{ label: `Bônus +${effectiveBonus}%`, value: `+${fmt(finalMiles - Math.floor(pointsNum / activeTier.ratio))} mi` }] : []),
                                        { label: 'Tempo', value: partner.transferTime },
                                        { label: 'Mín.', value: partner.minPointsLabel },
                                    ].map(item => (
                                        <div key={item.label}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: effectiveBonus > 0 && item.label.includes('Bônus') ? '#16A34A' : 'var(--text-dark)' }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Aviso cadastro obrigatório */}
                        {promo && (
                            <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10 }}>
                                <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                                    <b>⚠️ Cadastro obrigatório!</b> Registre-se na página da promoção <b>antes</b> de transferir. Sem cadastro = sem bônus, sem exceções.{' '}
                                    <a href={promo.registrationUrl ?? partner.url} target="_blank" rel="noopener noreferrer" style={{ color: '#B45309', fontWeight: 700 }}>Ir para a página →</a>
                                </div>
                            </div>
                        )}

                        {/* Clube faltando */}
                        {missingTiers.length > 0 && (() => {
                            const best = missingTiers[0]
                            const club = MILES_CLUBS.find(c => c.id === best.clubId)
                            const promoClubBonus = promo?.clubRequired === best.clubId ? promo.clubBonusPercent : best.bonusPercent
                            const bestWithClub = pointsNum > 0 ? computeMiles(pointsNum, best.ratio, promoClubBonus) : 0
                            const extraMiles = bestWithClub - (isLivelo ? liveloMiles : milesResult)
                            if (extraMiles <= 0) return null
                            return (
                                <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10 }}>
                                    <Tag size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                                        Com <b>{club?.name ?? 'clube'}</b> você receberia{' '}
                                        <b style={{ color: '#D97706' }}>{fmt(bestWithClub)} milhas</b>
                                        {' '}(+{fmt(extraMiles)}).{' '}
                                        Ative na seção <b>"Meus Clubes"</b> ao lado.
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Promoção ativa */}
                        {promo && !isLivelo && (
                            <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 14, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10 }}>
                                <Trophy size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div style={{ fontSize: 12, color: '#14532D', lineHeight: 1.6 }}>
                                    <b style={{ color: '#16A34A' }}>Campanha periódica:</b>{' '}{promo.description}<br />
                                    <span style={{ color: '#16803D', fontWeight: 600 }}>Última confirmação: {promo.lastConfirmed}</span>
                                    {' · '}
                                    <span style={{ color: '#15803D' }}>{promo.validUntil}</span>
                                    {livePromos && (
                                        <span style={{ marginLeft: 8, fontSize: 10, color: '#16A34A', fontWeight: 600 }}>· atualizado via API</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Regras de transferência */}
                        <div style={{ background: 'var(--bg-white)', border: '1.5px solid var(--border-light)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                            <button
                                onClick={() => setExpandedRules(!expandedRules)}
                                style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
                                    <Info size={15} color="var(--blue-medium)" />
                                    Regras de transferência e bônus por plano
                                </div>
                                {expandedRules ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                            </button>
                            <AnimatePresence>
                                {expandedRules && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                                        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                                            {/* Tier-specific bonuses from promo */}
                                            {promo && relevantClub?.tiers && (
                                                <>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                                                        Bônus por plano em campanhas
                                                    </div>
                                                    {/* No-club row */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--snow)', border: '1px solid var(--border-light)', borderRadius: 10 }}>
                                                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #CBD5E1', flexShrink: 0 }} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>Sem clube</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bônus: {promo.bonusPercent}%</div>
                                                        </div>
                                                        {pointsNum > 0 && <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-muted)' }}>{fmt(computeMiles(pointsNum, 1.0, promo.bonusPercent))} mi</div>}
                                                    </div>
                                                    {/* Club tier rows */}
                                                    {relevantClub.tiers.map(t => {
                                                        const tierBonus = promo.clubTierBonuses[t.name] ?? promo.clubBonusPercent
                                                        const userHasThis = activeClubs.includes(promo.clubRequired!)
                                                        const isSelectedTier = selectedClubTier === t.name
                                                        return (
                                                            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isSelectedTier ? '#F0FDF4' : 'var(--snow)', border: `1px solid ${isSelectedTier ? '#86EFAC' : 'var(--border-light)'}`, borderRadius: 10 }}>
                                                                {isSelectedTier ? <CheckCircle2 size={14} color="#16A34A" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #CBD5E1', flexShrink: 0 }} />}
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>
                                                                        {t.name}
                                                                        {isSelectedTier && <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 600, marginLeft: 6 }}>✓ Selecionado</span>}
                                                                        {!userHasThis && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>· você não tem</span>}
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                                        {t.monthlyFee} · Bônus: <b style={{ color: '#16A34A' }}>{tierBonus}%</b>
                                                                    </div>
                                                                </div>
                                                                {pointsNum > 0 && (
                                                                    <div style={{ fontSize: 14, fontWeight: 900, color: isSelectedTier ? '#16A34A' : 'var(--text-muted)' }}>
                                                                        {fmt(computeMiles(pointsNum, 1.0, tierBonus))} mi
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                        <Info size={10} />
                                                        Bônus por plano variam em cada campanha. Confirme na página oficial antes de transferir.
                                                    </div>
                                                </>
                                            )}

                                            {/* Club plan details expandable */}
                                            {relevantClub?.tiers && (
                                                <>
                                                    <button
                                                        onClick={() => setExpandedClubInfo(!expandedClubInfo)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--blue-medium)', padding: '4px 0', marginTop: 4 }}
                                                    >
                                                        {expandedClubInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                        Detalhes dos planos do {relevantClub.name}
                                                    </button>
                                                    <AnimatePresence>
                                                        {expandedClubInfo && (
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                                                                    {relevantClub.tiers.map(t => (
                                                                        <div key={t.name} style={{ padding: '8px 12px', background: 'var(--snow)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                                                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>{t.name}</div>
                                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, marginTop: 2, flexWrap: 'wrap' }}>
                                                                                <span>{t.monthlyFee}</span>
                                                                                <span style={{ color: '#16A34A', fontWeight: 600 }}>{t.bonusLabel}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    <a href={relevantClub.signupUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--blue-medium)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                                        <ExternalLink size={11} /> Assinar {relevantClub.name} (oficial)
                                                                    </a>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </>
                                            )}

                                            {promo && (
                                                <>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>
                                                        Regras da campanha
                                                    </div>
                                                    {promo.rules.map((rule, i) => (
                                                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-body)', lineHeight: 1.55 }}>
                                                            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>•</span>
                                                            {rule}
                                                        </div>
                                                    ))}
                                                </>
                                            )}

                                            <a href={partner.url} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--blue-medium)', textDecoration: 'none' }}>
                                                <ExternalLink size={13} /> Página oficial de transferência
                                            </a>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* O que consigo com essas milhas? */}
                        {finalMiles > 0 && finalProgram && (
                            <div>
                                {/* Header com toggle e disclaimer */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                                            O que você consegue
                                        </div>
                                        {/* Toggle econômica / executiva */}
                                        <div style={{ display: 'flex', background: 'var(--snow)', border: '1.5px solid var(--border-light)', borderRadius: 8, padding: 2, gap: 2 }}>
                                            {(['economy', 'business'] as const).map(cls => (
                                                <button
                                                    key={cls}
                                                    onClick={() => setViewClass(cls)}
                                                    style={{
                                                        padding: '4px 12px', borderRadius: 6, border: 'none',
                                                        background: viewClass === cls ? finalColor : 'transparent',
                                                        color: viewClass === cls ? '#fff' : 'var(--text-muted)',
                                                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                        fontFamily: 'inherit', transition: 'all .15s',
                                                    }}
                                                >
                                                    {cls === 'economy' ? '✈ Econômica' : '💺 Executiva'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Disclaimer */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F8FAFC', border: '1px solid var(--border-light)', borderRadius: 8, padding: '4px 10px' }}>
                                        <Info size={11} color="var(--text-muted)" />
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                                            {Object.keys(liveAwardPrices).length > 0
                                                ? `Seats.aero ${awardPricesDate ? new Date(awardPricesDate).toLocaleDateString('pt-BR') : ''} · preços médios reais`
                                                : 'Preços médios estimados · atualiza semanalmente'}
                                        </span>
                                        <RefreshCw size={10} color="var(--text-muted)" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                    {ROUTE_CATEGORIES
                                        .filter(r => r.programs.includes(finalProgram))
                                        .map(r => {
                                            // Prefer live Seats.aero data, fallback to hardcoded
                                            const liveData = liveAwardPrices[r.id]
                                            const ecoMiles = (liveData?.economy_avg ?? r.economy) || r.economy
                                            const bizMiles = (liveData?.business_avg ?? r.business) || r.business
                                            const isLiveData = !!liveData?.economy_avg

                                            const showMiles = viewClass === 'economy' ? ecoMiles : bizMiles
                                            const canAfford = finalMiles >= showMiles
                                            const missing = Math.max(0, showMiles - finalMiles)
                                            const cpm = r.cashBRL > 0 && ecoMiles > 0 ? (r.cashBRL / ecoMiles) * 100 : 0
                                            const cpmInfo = rateCPM(cpm)
                                            const activeColor = viewClass === 'business' ? '#16A34A' : finalColor
                                            return (
                                                <div key={r.id} style={{ background: canAfford ? 'var(--bg-white)' : 'var(--snow)', border: `1.5px solid ${canAfford ? `${activeColor}40` : 'var(--border-light)'}`, borderRadius: 14, padding: '14px 16px', opacity: canAfford ? 1 : 0.75 }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 20 }}>{r.icon}</span>
                                                            <div>
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>{r.label}</div>
                                                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.example}</div>
                                                            </div>
                                                        </div>
                                                        {isLiveData && (
                                                            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 5, padding: '2px 6px', fontSize: 9, fontWeight: 800, color: '#15803D', flexShrink: 0 }}>
                                                                REAL
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Econômica e Executiva side by side */}
                                                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                                        {/* Econômica */}
                                                        <button
                                                            onClick={() => setViewClass('economy')}
                                                            style={{
                                                                flex: 1, borderRadius: 8, padding: '6px 8px',
                                                                background: viewClass === 'economy' && canAfford ? `${finalColor}12` : viewClass === 'economy' ? '#FEF2F2' : 'var(--snow)',
                                                                border: `1.5px solid ${viewClass === 'economy' ? (canAfford ? finalColor : '#FECACA') : 'var(--border-light)'}`,
                                                                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                                                transition: 'all .15s',
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>✈ Econômica</div>
                                                            <div style={{ fontSize: 13, fontWeight: 900, color: viewClass === 'economy' ? (canAfford ? finalColor : '#DC2626') : 'var(--text-muted)' }}>
                                                                {fmt(ecoMiles)} mi
                                                            </div>
                                                        </button>
                                                        {/* Executiva */}
                                                        <button
                                                            onClick={() => setViewClass('business')}
                                                            style={{
                                                                flex: 1, borderRadius: 8, padding: '6px 8px',
                                                                background: viewClass === 'business' && finalMiles >= bizMiles ? '#F0FDF4' : viewClass === 'business' ? '#FEF2F2' : 'var(--snow)',
                                                                border: `1.5px solid ${viewClass === 'business' ? (finalMiles >= bizMiles ? '#86EFAC' : '#FECACA') : 'var(--border-light)'}`,
                                                                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                                                transition: 'all .15s',
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>💺 Executiva</div>
                                                            <div style={{ fontSize: 13, fontWeight: 900, color: viewClass === 'business' ? (finalMiles >= bizMiles ? '#16A34A' : '#DC2626') : 'var(--text-muted)' }}>
                                                                {bizMiles ? `${fmt(bizMiles)} mi` : '—'}
                                                            </div>
                                                        </button>
                                                    </div>

                                                    {/* Status da classe selecionada */}
                                                    {canAfford ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: activeColor }}>
                                                            <CheckCircle2 size={12} />
                                                            Você tem milhas suficientes!
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                                                            Faltam {fmt(missing)} mi para {viewClass === 'economy' ? 'econômica' : 'executiva'}
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>vs R$ {fmt(r.cashBRL)} em dinheiro</div>
                                                        <div style={{ fontSize: 10, fontWeight: 800, color: cpmInfo.color, background: `${cpmInfo.color}15`, borderRadius: 4, padding: '2px 6px' }}>
                                                            R$ {cpm.toFixed(2)}/mi
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>

                                <a
                                    href={isLivelo ? 'https://www.livelo.com.br' : partner?.url ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: '14px 24px', background: `linear-gradient(135deg, ${finalColor}, ${finalColor}cc)`, color: '#fff', borderRadius: 14, textDecoration: 'none', fontSize: 14, fontWeight: 800, boxShadow: `0 6px 24px ${finalColor}35` }}
                                >
                                    {isLivelo ? `Transferir para Livelo → ${liveloTarget}` : `Transferir pontos para ${finalProgram}`}
                                    <ArrowRight size={16} />
                                </a>
                            </div>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
