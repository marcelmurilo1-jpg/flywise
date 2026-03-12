import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronDown, ChevronUp, Info, ArrowRight, Zap, AlertTriangle,
    CheckCircle2, ExternalLink, Trophy, Tag,
} from 'lucide-react'
import {
    CREDIT_CARDS, MILES_CLUBS, ROUTE_CATEGORIES,
    computeMiles, findPromotion, rateCPM,
    type TransferPartner,
} from '@/lib/transferData'

const PROGRAM_COLORS: Record<string, string> = {
    'Smiles': '#FF6B00',
    'LATAM Pass': '#E3000F',
    'TudoAzul': '#003DA5',
    'Livelo': '#8B5CF6',
}

function fmt(n: number) { return n.toLocaleString('pt-BR') }

interface Props {
    activeClubs: string[]  // IDs dos clubes que o usuário tem ativo
}

export default function TransferSimulator({ activeClubs }: Props) {
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
    const [points, setPoints] = useState<string>('')
    const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
    const [expandedRules, setExpandedRules] = useState(false)

    const card = CREDIT_CARDS.find(c => c.id === selectedCardId) ?? null
    const partner = card?.partners.find(p => p.program === selectedProgram) ?? null
    const pointsNum = parseInt(points.replace(/\D/g, '')) || 0
    const promo = card && selectedProgram ? findPromotion(card.id, selectedProgram) : null

    // Best tier considering user's active clubs
    function getBestTier(p: TransferPartner) {
        for (const tier of p.tiers) {
            if (tier.clubId === null || activeClubs.includes(tier.clubId)) return tier
        }
        return p.tiers[p.tiers.length - 1]
    }

    const activeTier = partner ? getBestTier(partner) : null
    const milesResult = activeTier && pointsNum > 0
        ? computeMiles(pointsNum, activeTier.ratio, activeTier.bonusPercent)
        : 0

    // Tiers the user doesn't have (shows what they're missing)
    const missingTiers = partner?.tiers.filter(
        t => t.clubId !== null && !activeClubs.includes(t.clubId) && t.bonusPercent > (activeTier?.bonusPercent ?? 0)
    ) ?? []

    const programColor = selectedProgram ? (PROGRAM_COLORS[selectedProgram] ?? '#0E2A55') : '#0E2A55'

    function formatPointsInput(val: string) {
        const n = parseInt(val.replace(/\D/g, '')) || 0
        return n === 0 ? '' : n.toLocaleString('pt-BR')
    }

    function onSelectCard(id: string) {
        setSelectedCardId(id)
        setSelectedProgram(null)
        setPoints('')
        setExpandedRules(false)
    }

    function onSelectProgram(prog: string) {
        setSelectedProgram(prog)
        setExpandedRules(false)
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
                                    transition: 'all .18s', textAlign: 'center',
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
                                    const miles = pointsNum > 0 ? computeMiles(pointsNum, tier.ratio, tier.bonusPercent) : null
                                    const promo = findPromotion(card.id, p.program)
                                    const progColor = PROGRAM_COLORS[p.program] ?? '#0E2A55'
                                    const isSelected = selectedProgram === p.program
                                    const hasMissingClub = p.tiers[0].clubId !== null && !activeClubs.includes(p.tiers[0].clubId ?? '')

                                    return (
                                        <button
                                            key={p.program}
                                            onClick={() => onSelectProgram(p.program)}
                                            style={{
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
                                                    {promo && (
                                                        <span style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 800, color: '#92400E', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <Zap size={9} /> +{promo.bonusPercent}% bônus
                                                        </span>
                                                    )}
                                                    {hasMissingClub && (
                                                        <span style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <Tag size={9} /> Clube aumenta bônus
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    Taxa: {tier.ratio.toLocaleString('pt-BR')} {card.currency} = 1 milha
                                                    {tier.bonusPercent > 0 && <span style={{ color: '#16A34A', fontWeight: 700 }}> +{tier.bonusPercent}% bônus</span>}
                                                </div>
                                            </div>
                                            {miles !== null && (
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: 20, fontWeight: 900, color: progColor, letterSpacing: '-0.02em' }}>{fmt(miles)}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>milhas</div>
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Resultado detalhado ── */}
            <AnimatePresence>
                {partner && activeTier && (
                    <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                        {/* Resultado principal */}
                        <div style={{ background: `linear-gradient(135deg, ${programColor}15, ${programColor}08)`, border: `2px solid ${programColor}30`, borderRadius: 20, padding: '24px 26px', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
                                        Você receberá em {selectedProgram}
                                    </div>
                                    <div style={{ fontSize: 48, fontWeight: 900, color: programColor, letterSpacing: '-0.03em', lineHeight: 1 }}>
                                        {fmt(milesResult)}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>milhas · {activeTier.label}</div>
                                </div>
                                {pointsNum > 0 && (
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>VOCÊ TRANSFERE</div>
                                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-dark)' }}>{fmt(pointsNum)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card?.currency}</div>
                                    </div>
                                )}
                            </div>

                            {/* Breakdown */}
                            {pointsNum > 0 && (
                                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${programColor}20`, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Taxa base', value: `${fmt(Math.floor(pointsNum / activeTier.ratio))} mi` },
                                        ...(activeTier.bonusPercent > 0 ? [{ label: `Bônus +${activeTier.bonusPercent}%`, value: `+${fmt(milesResult - Math.floor(pointsNum / activeTier.ratio))} mi` }] : []),
                                        { label: 'Tempo', value: partner.transferTime },
                                        { label: 'Mín. pontos', value: fmt(partner.minPoints) },
                                    ].map(item => (
                                        <div key={item.label}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: activeTier.bonusPercent > 0 && item.label.includes('Bônus') ? '#16A34A' : 'var(--text-dark)' }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Aviso de clube faltando */}
                        {missingTiers.length > 0 && (() => {
                            const best = missingTiers[0]
                            const club = MILES_CLUBS.find(c => c.id === best.clubId)
                            const bestWithClub = pointsNum > 0 ? computeMiles(pointsNum, best.ratio, best.bonusPercent) : 0
                            const extraMiles = bestWithClub - milesResult
                            return (
                                <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12 }}>
                                    <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
                                        <b>Com {club?.name ?? 'clube'}</b>, você receberia{' '}
                                        <b style={{ color: '#D97706' }}>{fmt(bestWithClub)} milhas</b>
                                        {' '}({fmt(extraMiles)} a mais).{' '}
                                        <span style={{ color: '#B45309' }}>Ative o clube na seção "Meus Clubes" acima para desbloquear esse bônus.</span>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Promoção ativa */}
                        {promo && (
                            <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12 }}>
                                <Trophy size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div style={{ fontSize: 13, color: '#14532D', lineHeight: 1.6 }}>
                                    <b style={{ color: '#16A34A' }}>Promoção ativa!</b>{' '}
                                    {promo.description}{' · '}
                                    <span style={{ fontWeight: 600 }}>{promo.validUntil}</span>
                                </div>
                            </div>
                        )}

                        {/* Regras de transferência */}
                        {(promo || partner) && (
                            <div style={{ background: 'var(--bg-white)', border: '1.5px solid var(--border-light)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                                <button
                                    onClick={() => setExpandedRules(!expandedRules)}
                                    style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
                                        <Info size={15} color="var(--blue-medium)" />
                                        Regras de transferência
                                    </div>
                                    {expandedRules ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                                </button>
                                <AnimatePresence>
                                    {expandedRules && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {/* Club tiers table */}
                                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                                                    Taxas por nível
                                                </div>
                                                {partner.tiers.map(tier => {
                                                    const club = tier.clubId ? MILES_CLUBS.find(c => c.id === tier.clubId) : null
                                                    const userHas = tier.clubId === null || activeClubs.includes(tier.clubId)
                                                    const exMiles = pointsNum > 0 ? computeMiles(pointsNum, tier.ratio, tier.bonusPercent) : null
                                                    return (
                                                        <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: userHas ? '#F0FDF4' : 'var(--snow)', border: `1px solid ${userHas ? '#86EFAC' : 'var(--border-light)'}`, borderRadius: 10 }}>
                                                            {userHas ? <CheckCircle2 size={14} color="#16A34A" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #CBD5E1' }} />}
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>
                                                                    {club?.name ?? 'Sem clube'}
                                                                    {userHas && <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 600, marginLeft: 6 }}>✓ Ativo</span>}
                                                                </div>
                                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                                    Taxa {tier.ratio.toLocaleString('pt-BR')}:1
                                                                    {tier.bonusPercent > 0 ? ` + ${tier.bonusPercent}% bônus` : ' · sem bônus'}
                                                                </div>
                                                            </div>
                                                            {exMiles !== null && (
                                                                <div style={{ fontSize: 14, fontWeight: 900, color: userHas ? '#16A34A' : 'var(--text-muted)' }}>
                                                                    {fmt(exMiles)} mi
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}

                                                {/* Regras da promoção */}
                                                {promo && (
                                                    <>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>
                                                            Condições da promoção
                                                        </div>
                                                        {promo.rules.map((rule, i) => (
                                                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-body)', lineHeight: 1.55 }}>
                                                                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>•</span>
                                                                {rule}
                                                            </div>
                                                        ))}
                                                    </>
                                                )}

                                                {/* Link oficial */}
                                                <a
                                                    href={partner.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--blue-medium)', textDecoration: 'none' }}
                                                >
                                                    <ExternalLink size={13} /> Ir para a página oficial de transferência
                                                </a>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* O que consigo com essas milhas? */}
                        {milesResult > 0 && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14 }}>
                                    O que você consegue com {fmt(milesResult)} milhas
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                    {ROUTE_CATEGORIES
                                        .filter(r => r.programs.includes(selectedProgram ?? ''))
                                        .map(r => {
                                            const canEco = milesResult >= r.economy
                                            const canBiz = r.business > 0 && milesResult >= r.business
                                            const canAny = canEco || canBiz
                                            const missingEco = Math.max(0, r.economy - milesResult)
                                            const cpm = r.cashBRL > 0 && r.economy > 0 ? (r.cashBRL / r.economy) * 100 : 0
                                            const cpmInfo = rateCPM(cpm)

                                            return (
                                                <div
                                                    key={r.id}
                                                    style={{
                                                        background: canAny ? 'var(--bg-white)' : 'var(--snow)',
                                                        border: `1.5px solid ${canBiz ? '#86EFAC' : canEco ? `${programColor}40` : 'var(--border-light)'}`,
                                                        borderRadius: 14, padding: '14px 16px',
                                                        opacity: canAny ? 1 : 0.7,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                        <span style={{ fontSize: 20 }}>{r.icon}</span>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>{r.label}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.example}</div>
                                                        </div>
                                                    </div>

                                                    {canBiz ? (
                                                        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 800, color: '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <CheckCircle2 size={11} /> Executiva disponível
                                                            </div>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>{fmt(r.business)} mi</div>
                                                        </div>
                                                    ) : canEco ? (
                                                        <div style={{ background: `${programColor}10`, border: `1px solid ${programColor}30`, borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 800, color: programColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <CheckCircle2 size={11} /> Econômica disponível
                                                            </div>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: programColor }}>{fmt(r.economy)} mi</div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>
                                                                Faltam {fmt(missingEco)} mi
                                                            </div>
                                                            <div style={{ fontSize: 11, color: '#EF4444' }}>Para econômica: {fmt(r.economy)} mi</div>
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                            vs R$ {fmt(r.cashBRL)} em dinheiro
                                                        </div>
                                                        <div style={{ fontSize: 10, fontWeight: 800, color: cpmInfo.color, background: `${cpmInfo.color}15`, borderRadius: 4, padding: '2px 6px' }}>
                                                            R$ {cpm.toFixed(2)}/mi
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>

                                {/* CTA transferência */}
                                <a
                                    href={partner.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        marginTop: 20, padding: '14px 24px',
                                        background: `linear-gradient(135deg, ${programColor}, ${programColor}cc)`,
                                        color: '#fff', borderRadius: 14, textDecoration: 'none',
                                        fontSize: 14, fontWeight: 800, boxShadow: `0 6px 24px ${programColor}35`,
                                    }}
                                >
                                    Transferir pontos para {selectedProgram} <ArrowRight size={16} />
                                </a>
                            </div>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
