// Supabase Edge Function: /strategy
// Runtime: Deno (Supabase Functions)
// Deploy: supabase functions deploy strategy
//
// Env vars required (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
//   OPENAI_API_KEY   — your OpenAI key (GPT-4o-mini)
//   SUPABASE_URL     — automatically injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — automatically injected by Supabase

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface FlightRow {
    id: number; companhia: string | null; preco_brl: number | null
    preco_milhas: number | null; taxas_brl: number | null; cpm: number | null
    partida: string | null; chegada: string | null
    origem: string | null; destino: string | null
    duracao_min: number | null; cabin_class: string | null
    segmentos: unknown; detalhes: unknown
}

interface PromoRow {
    titulo: string
    programa: string | null
    tipo: string | null
    bonus_pct: number | null
    parceiro: string | null
    valid_until: string | null
}

interface UserData {
    miles: Record<string, number>
    cards: string[]
    clubs: string[]
    clubTiers: Record<string, string>
}

// ─── Static mappings ──────────────────────────────────────────────────────────

const AIRLINE_PROGRAMS: Record<string, string[]> = {
    'LA': ['LATAM Pass', 'Smiles', 'Livelo'],
    'JJ': ['LATAM Pass', 'Smiles', 'Livelo'],
    'G3': ['Smiles', 'Livelo'],
    'AD': ['TudoAzul', 'Livelo'],
    'AC': ['Smiles', 'Aeroplan', 'Livelo'],
    'AA': ['Smiles', 'AAdvantage', 'Livelo'],
    'UA': ['Smiles', 'MileagePlus', 'Livelo'],
    'DL': ['Smiles', 'SkyMiles', 'Livelo'],
    'TP': ['TAP Miles&Go', 'Smiles', 'Livelo'],
    'AF': ['Flying Blue', 'Smiles', 'Livelo'],
    'KL': ['Flying Blue', 'Smiles', 'Livelo'],
    'LH': ['Miles&More', 'Smiles', 'Livelo'],
    'AV': ['Lifemiles', 'Smiles', 'Livelo'],
    'CM': ['ConnectMiles', 'Smiles', 'Livelo'],
    'TK': ['Miles&Smiles', 'Smiles', 'Livelo'],
    'ET': ['ShebaMiles', 'Smiles'],
}

// Source programs that can transfer INTO each target loyalty program (base ratios, sem promos)
const TRANSFER_BASES: Record<string, Array<{ source: string; ratio: number }>> = {
    'Smiles': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Pontos Itaú', ratio: 1.0 },
        { source: 'Esfera', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.5 },
        { source: 'Diners Club', ratio: 1.5 },
        { source: 'C6 Bank', ratio: 1.0 },
        { source: 'Inter Milhas', ratio: 1.0 },
    ],
    'LATAM Pass': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Pontos Itaú', ratio: 1.0 },
        { source: 'Esfera', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
        { source: 'Diners Club', ratio: 1.0 },
        { source: 'C6 Bank', ratio: 1.0 },
    ],
    'TudoAzul': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Pontos Itaú', ratio: 1.0 },
        { source: 'Esfera', ratio: 1.0 },
        { source: 'C6 Bank', ratio: 1.0 },
        { source: 'Inter Milhas', ratio: 1.0 },
    ],
    'Flying Blue': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'Miles&More': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'Lifemiles': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'TAP Miles&Go': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'Aeroplan': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'AAdvantage': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'MileagePlus': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    // Programas internacionais acessíveis via Livelo (Turkish, Copa, Ethiopian via parcerias)
    'Miles&Smiles': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'ConnectMiles': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'ShebaMiles': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'SkyMiles': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractIata(companhia: string | null): string {
    if (!companhia) return ''
    const m = companhia.match(/\(([A-Z]{2,3})\)/)
    if (m) return m[1]
    if (/^[A-Z]{2,3}$/.test(companhia.trim())) return companhia.trim()
    return ''
}

function formatMins(mins: number | null): string {
    if (!mins) return ''
    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ''}`
}

// Fuzzy balance lookup — handles "Smiles" ↔ "Smiles Clube", "LATAM" ↔ "LATAM Pass" etc.
function findBalance(miles: Record<string, number>, programName: string): number {
    const target = programName.toLowerCase().trim()
    for (const [prog, pts] of Object.entries(miles)) {
        const p = prog.toLowerCase().trim()
        if (p === target) return pts
        const targetFirst = target.split(' ')[0]
        const progFirst = p.split(' ')[0]
        if (targetFirst.length >= 4 && (p.startsWith(targetFirst) || target.startsWith(progFirst))) return pts
    }
    return 0
}

// ─── Flight string ─────────────────────────────────────────────────────────────

function buildFlightString(f: FlightRow, targetProgram: string): string {
    const det = (f.detalhes as Record<string, unknown>) ?? {}
    const iata = extractIata(f.companhia)
    const programs = (AIRLINE_PROGRAMS[iata] ?? ['Livelo']).slice(0, 5).join(', ')
    const lines = [
        `Rota: ${f.origem ?? '?'} → ${f.destino ?? '?'} | ${f.companhia ?? iata} (${iata})`,
        `Preço cash: R$ ${f.preco_brl?.toLocaleString('pt-BR') ?? 'N/A'} | Cabine: ${f.cabin_class ?? 'economy'} | Paradas: ${(det.paradas as number) ?? 0} | Duração: ${formatMins(f.duracao_min)}`,
        `Programas aceitos: ${programs}`,
        `Programa selecionado pelo usuário: ${targetProgram}`,
    ]
    if (f.partida) lines.push(`Ida: ${f.partida.slice(11, 16)} → ${f.chegada?.slice(11, 16) ?? ''}`)
    if (det.returnPartida) lines.push(`Volta: ${(det.returnPartida as string).slice(11, 16)} → ${(det.returnChegada as string | undefined ?? '').slice(11, 16)}`)
    return lines.join('\n')
}

// ─── Promo formatting ─────────────────────────────────────────────────────────

function formatPromoLine(p: PromoRow, i: number): string {
    const tipoLabel = p.tipo === 'bonus_transferencia' ? '[transferência]'
        : p.tipo === 'clube' ? '[clube]'
        : p.tipo === 'boas_vindas' ? '[boas-vindas]'
        : p.tipo === 'milhas_compra' ? '[compra-milhas]'
        : '[promoção]'
    const parts = [`${i + 1}. ${tipoLabel} ${p.programa ?? 'Geral'}`]
    if (p.bonus_pct) parts.push(`+${p.bonus_pct}% bônus`)
    if (p.parceiro) parts.push(`via ${p.parceiro}`)
    parts.push(`— ${String(p.titulo ?? '').slice(0, 80)}`)
    if (p.valid_until) parts.push(`(expira ${new Date(p.valid_until).toLocaleDateString('pt-BR')})`)
    return parts.join(' ')
}

// ─── Fetch promos ─────────────────────────────────────────────────────────────

async function fetchPromos(
    targetProgram: string,
    relatedPrograms: string[],
    sb: ReturnType<typeof createClient>
): Promise<{ promoStr: string; transferPromos: PromoRow[]; purchasePromos: PromoRow[] }> {
    try {
        const now = new Date().toISOString()
        const searchPrograms = Array.from(new Set([targetProgram, ...relatedPrograms])).filter(Boolean).slice(0, 7)

        const { data: allPromos } = await sb.from('promocoes')
            .select('titulo,programa,tipo,bonus_pct,parceiro,valid_until')
            .or('valid_until.is.null,valid_until.gt.' + now)
            .in('programa', searchPrograms.length > 0 ? searchPrograms : ['Smiles', 'LATAM Pass', 'Livelo'])
            .order('bonus_pct', { ascending: false, nullsFirst: false })
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(20)

        const rows: PromoRow[] = allPromos ?? []

        // Transfer promos INTO the target program (for coverage analysis)
        const transferPromos = rows.filter(p =>
            p.tipo === 'bonus_transferencia' &&
            p.programa?.toLowerCase() === targetProgram.toLowerCase()
        )

        // Select best mix: transfers (3) + clubs (1) + purchase (1) + others (1)
        const transfer = rows.filter(p => p.tipo === 'bonus_transferencia').slice(0, 3)
        const clube = rows.filter(p => p.tipo === 'clube' || p.tipo === 'boas_vindas').slice(0, 1)
        const compra = rows.filter(p => p.tipo === 'milhas_compra').slice(0, 1)
        const outros = rows.filter(p =>
            p.tipo !== 'bonus_transferencia' && p.tipo !== 'clube' &&
            p.tipo !== 'boas_vindas' && p.tipo !== 'milhas_compra'
        ).slice(0, 1)

        let selected = [...transfer, ...clube, ...compra, ...outros]

        if (selected.length === 0) {
            const { data: fallback } = await sb.from('promocoes')
                .select('titulo,programa,tipo,bonus_pct,parceiro,valid_until')
                .or('valid_until.is.null,valid_until.gt.' + now)
                .order('bonus_pct', { ascending: false, nullsFirst: false })
                .limit(3)
            selected = fallback ?? []
        }

        const promoStr = selected.length > 0
            ? selected.map(formatPromoLine).join('\n')
            : 'Nenhuma promoção ativa registrada.'

        // Purchase promos for the target program (to calculate cost of buying deficit miles)
        const purchasePromos = rows.filter(p =>
            p.tipo === 'milhas_compra' &&
            p.programa?.toLowerCase() === targetProgram.toLowerCase()
        )

        return { promoStr, transferPromos, purchasePromos }
    } catch {
        return { promoStr: 'Nenhuma promoção disponível.', transferPromos: [], purchasePromos: [] }
    }
}

// ─── Club benefits ────────────────────────────────────────────────────────────

function getClubBenefits(club: string, tier: string | undefined): string {
    const combined = (club + ' ' + (tier ?? '')).toLowerCase()
    if (combined.includes('smiles')) {
        if (combined.includes('diamante')) return '10% desconto nas taxas de embarque + embarque prioritário'
        if (combined.includes('ouro')) return '5% desconto nas taxas de embarque'
        if (combined.includes('prata')) return '3% desconto nas taxas de embarque'
        return 'Clube Smiles ativo (benefícios dependem do tier)'
    }
    if (combined.includes('latam') || combined.includes('fidelidade')) {
        if (combined.includes('black')) return 'Upgrade disponível + embarque prioritário + bagagem extra'
        if (combined.includes('platinum')) return 'Embarque prioritário + bagagem extra'
        if (combined.includes('gold')) return 'Embarque prioritário'
        return 'Membro LATAM Fidelidade'
    }
    if (combined.includes('azul') || combined.includes('tudoazul')) {
        if (combined.includes('diamante')) return 'Embarque prioritário + 50% bônus em acúmulo'
        if (combined.includes('ouro')) return '30% bônus em acúmulo'
        return 'Membro TudoAzul ativo'
    }
    return 'Clube de fidelidade ativo'
}

// ─── Coverage analysis ────────────────────────────────────────────────────────

function buildCoverageSection(
    targetProgram: string,
    neededMiles: number,
    miles: Record<string, number>,
    cards: string[],
    clubs: string[],
    clubTiers: Record<string, string>,
    transferPromos: PromoRow[]
): { section: string; deficit: number } {
    if (neededMiles <= 0 || Object.keys(miles).length === 0) return { section: '', deficit: neededMiles }

    const directBalance = findBalance(miles, targetProgram)

    // Build transfer options for programs the user HAS
    const bases = TRANSFER_BASES[targetProgram] ?? []
    interface TransferOption {
        sourceProgram: string; sourceBalance: number
        effectiveRatio: number; yieldsPoints: number
        promoBonus: number; promoLabel: string | null
    }
    const transferOptions: TransferOption[] = []

    for (const base of bases) {
        const sourceBalance = findBalance(miles, base.source)
        if (sourceBalance <= 0) continue

        const promo = transferPromos.find(p =>
            p.parceiro && (
                base.source.toLowerCase().includes(p.parceiro.toLowerCase()) ||
                p.parceiro.toLowerCase().includes(base.source.toLowerCase().split(' ')[0])
            )
        )
        const promoBonus = promo?.bonus_pct ?? 0
        const effectiveRatio = base.ratio * (1 + promoBonus / 100)
        const yieldsPoints = Math.floor(sourceBalance * effectiveRatio)

        transferOptions.push({
            sourceProgram: base.source,
            sourceBalance,
            effectiveRatio,
            yieldsPoints,
            promoBonus,
            promoLabel: promo
                ? `★ PROMO ATIVA +${promoBonus}% via ${promo.parceiro}${promo.valid_until ? ` (expira ${new Date(promo.valid_until).toLocaleDateString('pt-BR')})` : ''}`
                : null,
        })
    }

    const totalTransferable = transferOptions.reduce((s, t) => s + t.yieldsPoints, 0)
    const totalPotential = directBalance + totalTransferable
    const deficit = Math.max(0, neededMiles - totalPotential)
    const coversPct = neededMiles > 0 ? Math.min(100, Math.round(totalPotential * 100 / neededMiles)) : 0

    const lines: string[] = [
        `Programa alvo: ${targetProgram} | Necessário: ${neededMiles.toLocaleString('pt-BR')} pts`,
        '',
    ]

    lines.push('SALDO DIRETO:')
    if (directBalance > 0) {
        const pct = Math.round(directBalance * 100 / neededMiles)
        lines.push(`  ${targetProgram}: ${directBalance.toLocaleString('pt-BR')} pts (${pct}% do necessário)${directBalance >= neededMiles ? ' ✓ COBRE TUDO' : ''}`)
    } else {
        lines.push(`  ${targetProgram}: 0 pts (sem saldo neste programa)`)
    }

    if (transferOptions.length > 0) {
        lines.push('')
        lines.push('TRANSFERÊNCIAS DISPONÍVEIS (saldo do usuário):')
        for (const opt of transferOptions) {
            lines.push(`  ${opt.sourceProgram}: ${opt.sourceBalance.toLocaleString('pt-BR')} pts → ${targetProgram}`)
            if (opt.promoLabel) {
                lines.push(`    ${opt.promoLabel}`)
                lines.push(`    → Razão efetiva: ${opt.effectiveRatio.toFixed(2)}:1 → rende ${opt.yieldsPoints.toLocaleString('pt-BR')} pts ${targetProgram}`)
            } else {
                lines.push(`    → Razão base: ${opt.effectiveRatio.toFixed(1)}:1 → rende ${opt.yieldsPoints.toLocaleString('pt-BR')} pts (sem promo ativa)`)
            }
        }
    }

    lines.push('')
    if (totalPotential >= neededMiles) {
        lines.push(`POTENCIAL TOTAL: ${totalPotential.toLocaleString('pt-BR')} pts ✓ COBRE TUDO (sobra ${(totalPotential - neededMiles).toLocaleString('pt-BR')} pts)`)
        if (directBalance >= neededMiles) {
            lines.push(`→ Pode emitir usando APENAS o saldo direto de ${targetProgram}, sem nenhuma transferência.`)
        } else {
            const milesStillNeeded = neededMiles - directBalance
            const best = [...transferOptions].sort((a, b) => b.promoBonus - a.promoBonus || b.yieldsPoints - a.yieldsPoints)[0]
            if (best) {
                const rawNeeded = Math.ceil(milesStillNeeded / best.effectiveRatio)
                lines.push(`→ MÍNIMO: usar ${directBalance.toLocaleString('pt-BR')} ${targetProgram} direto + transferir ${rawNeeded.toLocaleString('pt-BR')} ${best.sourceProgram}${best.promoBonus > 0 ? ` (promo +${best.promoBonus}% → gera ${Math.floor(rawNeeded * best.effectiveRatio).toLocaleString('pt-BR')} pts)` : ''}`)
            }
        }
    } else {
        lines.push(`POTENCIAL TOTAL: ${totalPotential.toLocaleString('pt-BR')} pts — FALTAM ${deficit.toLocaleString('pt-BR')} pts (cobre apenas ${coversPct}%)`)
        lines.push(`→ Para completar o déficit: comprar milhas${transferOptions.some(t => t.promoBonus > 0) ? ' (verificar custo com promos ativas)' : ''} ou acumular nos programas transferíveis.`)
    }

    if (clubs.length > 0) {
        lines.push('')
        lines.push('CLUBES ATIVOS (benefícios para este voo):')
        for (const club of clubs) {
            const tier = clubTiers[club]
            lines.push(`  ${club}${tier ? ` (${tier})` : ''}: ${getClubBenefits(club, tier)}`)
        }
    }

    if (cards.length > 0) {
        lines.push(`\nCartões ativos: ${cards.slice(0, 5).join(', ')}`)
    }

    return { section: lines.join('\n'), deficit }
}

// ─── CPM analysis ─────────────────────────────────────────────────────────────

function buildCpmSection(cashPrice: number | null | undefined, totalMilhas: number): string {
    if (!cashPrice || cashPrice <= 0 || totalMilhas <= 0) return ''
    const cpm = (cashPrice * 100) / totalMilhas
    let avaliacao: string
    let recomendacao: string
    if (cpm >= 3.5) {
        avaliacao = 'EXCELENTE (≥ 3.5 c/pt)'
        recomendacao = '→ Vale muito a pena usar milhas. Economia excepcional.'
    } else if (cpm >= 2.5) {
        avaliacao = 'MUITO BOM (2.5–3.5 c/pt)'
        recomendacao = '→ Vale a pena usar milhas.'
    } else if (cpm >= 1.8) {
        avaliacao = 'BOM (1.8–2.5 c/pt)'
        recomendacao = '→ Vale a pena usar milhas.'
    } else if (cpm >= 1.2) {
        avaliacao = 'RAZOÁVEL (1.2–1.8 c/pt)'
        recomendacao = '→ Borderline: vale se o usuário tem muitas milhas sobrando no programa certo.'
    } else {
        avaliacao = 'RUIM (< 1.2 c/pt)'
        recomendacao = '→ ATENÇÃO: em dinheiro é mais vantajoso. Defina vale_a_pena: false.'
    }
    const economyEst = Math.round(cashPrice - totalMilhas * 0.0004)
    return [
        `CPM do resgate: ${cpm.toFixed(2)} c/pt  (R$ ${cashPrice.toLocaleString('pt-BR')} × 100 ÷ ${totalMilhas.toLocaleString('pt-BR')} milhas)`,
        `Avaliação: ${avaliacao}`,
        `Economia potencial bruta: ~R$ ${economyEst.toLocaleString('pt-BR')} (preço cash − taxas)`,
        recomendacao,
    ].join('\n')
}

// ─── Purchase analysis ────────────────────────────────────────────────────────

// Base market price per 1.000 pts (R$) in normal periods — promos often give 20-40% off
const BASE_COST_PER_K: Record<string, number> = {
    'Smiles': 42,
    'LATAM Pass': 50,
    'TudoAzul': 38,
    'Flying Blue': 60,
    'Miles&More': 65,
    'Lifemiles': 46,
    'TAP Miles&Go': 52,
    'Miles&Smiles': 55,
    'Aeroplan': 62,
    'AAdvantage': 55,
    'MileagePlus': 55,
}

// Purchase URLs per program (where users can buy miles directly)
const PROGRAM_PURCHASE_INFO: Record<string, { url: string; notes: string }> = {
    'Smiles':      { url: 'smiles.com.br/compre-milhas', notes: 'Promoções frequentes às quartas-feiras com até 40% de bônus' },
    'LATAM Pass':  { url: 'latampass.latam.com/pt_br/junte-milhas/compre-milhas', notes: 'Pacotes com bônus sazonais; verifique "Turbine"' },
    'TudoAzul':    { url: 'tudoazul.voeazul.com.br/compre-pontos', notes: 'Bônus em datas especiais e campanhas do Clube Azul' },
    'Lifemiles':   { url: 'lifemiles.com/shop/buy-miles', notes: 'Promoções frequentes de 30-125% de bônus' },
    'AAdvantage':  { url: 'aa.com/aadvantage/accrual/purchase-miles.do', notes: '' },
    'MileagePlus': { url: 'united.com/ual/pt/br/flight/mileageplus/buy-miles.html', notes: '' },
    'Flying Blue': { url: 'flyingblue.com/pt/miles/buy', notes: '' },
    'Miles&More':  { url: 'miles-and-more.com/miles/buy', notes: '' },
    'Aeroplan':    { url: 'aeroplan.com/en/earn-miles/buy', notes: '' },
}

// Transfer page URLs per program
const PROGRAM_TRANSFER_URLS: Record<string, string> = {
    'Smiles':      'smiles.com.br/acumule-milhas/transferencia-de-pontos',
    'LATAM Pass':  'latampass.latam.com/pt_br/junte-milhas/transfira-pontos',
    'TudoAzul':    'tudoazul.voeazul.com.br/acumule/transferencia-de-pontos',
    'Livelo':      'livelo.com.br/transferencia-de-pontos',
    'Flying Blue': 'flyingblue.com/en/earn-miles/partners/bank-partners',
}

// Maps card IDs (from userData.cards) to the bank transfer program they belong to
const CARD_TO_BANK_PROGRAM: Record<string, { bank: string; label: string }> = {
    'nubank_ultravioleta': { bank: 'Membership Rewards', label: 'Nubank Ultravioleta (via Amex)' },
    'amex_platinum':       { bank: 'Membership Rewards', label: 'Amex Platinum' },
    'amex_gold':           { bank: 'Membership Rewards', label: 'Amex Gold' },
    'amex_green':          { bank: 'Membership Rewards', label: 'Amex Green' },
    'iupp_itau':           { bank: 'Pontos Itaú', label: 'iupp Itaú' },
    'itau_personnalite':   { bank: 'Pontos Itaú', label: 'Itaú Personnalité' },
    'itau_uniclass':       { bank: 'Pontos Itaú', label: 'Itaú Uniclass' },
    'itau_grafite':        { bank: 'Pontos Itaú', label: 'Itaú Grafite' },
    'esfera_santander':    { bank: 'Esfera', label: 'Santander Esfera' },
    'santander_elite':     { bank: 'Esfera', label: 'Santander Elite' },
    'santander_black':     { bank: 'Esfera', label: 'Santander Black' },
    'c6_atomos':           { bank: 'C6 Bank', label: 'C6 Átomos' },
    'inter_black':         { bank: 'Inter Milhas', label: 'Banco Inter Black' },
    'inter_win':           { bank: 'Inter Milhas', label: 'Banco Inter Win' },
    'diners_global':       { bank: 'Diners Club', label: 'Diners Club Global' },
    'livelo_bradesco':     { bank: 'Livelo', label: 'Bradesco Livelo' },
    'livelo_bb':           { bank: 'Livelo', label: 'BB Livelo' },
    'caixa_mastercard':    { bank: 'Livelo', label: 'Caixa Mastercard' },
}

function buildPurchaseSection(
    targetProgram: string,
    deficitMiles: number,
    purchasePromos: PromoRow[],
    cashPrice: number | null | undefined
): string {
    if (deficitMiles <= 0) return ''

    const baseCostPerK = BASE_COST_PER_K[targetProgram] ?? 50
    const bestPromo = [...purchasePromos].sort((a, b) => (b.bonus_pct ?? 0) - (a.bonus_pct ?? 0))[0]
    const promoBonus = bestPromo?.bonus_pct ?? 0

    // With bonus: buy fewer base miles, receive more
    // To receive deficitMiles, buy ceil(deficitMiles / (1 + bonus/100))
    const milesToBuy = Math.ceil(deficitMiles / (1 + promoBonus / 100))
    const purchaseCost = Math.ceil(milesToBuy / 1000 * baseCostPerK)
    const effectiveCostPerK = promoBonus > 0
        ? Math.round(baseCostPerK / (1 + promoBonus / 100))
        : baseCostPerK

    const lines: string[] = [`Déficit: ${deficitMiles.toLocaleString('pt-BR')} pts | Programa: ${targetProgram}`, '']

    if (promoBonus > 0 && bestPromo) {
        const expiry = bestPromo.valid_until ? `, expira ${new Date(bestPromo.valid_until).toLocaleDateString('pt-BR')}` : ''
        lines.push(`★ PROMO DE COMPRA ATIVA: +${promoBonus}% bônus — ${String(bestPromo.titulo).slice(0, 60)}${expiry}`)
        lines.push(`  Custo efetivo: ~R$${effectiveCostPerK}/mil pts (base R$${baseCostPerK} com +${promoBonus}% de bônus)`)
        lines.push(`  Para cobrir déficit: comprar ${milesToBuy.toLocaleString('pt-BR')} pts base → recebe ${deficitMiles.toLocaleString('pt-BR')} pts → custo ~R$ ${purchaseCost.toLocaleString('pt-BR')}`)
    } else {
        lines.push(`Sem promo de compra ativa para ${targetProgram}.`)
        lines.push(`  Custo base de mercado: ~R$${baseCostPerK}/mil pts`)
        lines.push(`  Para cobrir déficit: ~R$ ${purchaseCost.toLocaleString('pt-BR')} (${deficitMiles.toLocaleString('pt-BR')} pts a preço normal)`)
    }

    if (cashPrice && cashPrice > 0) {
        const taxasEst = 80  // conservative estimate for taxes
        const totalWithPurchase = purchaseCost + taxasEst
        const savings = cashPrice - totalWithPurchase
        const savingsPct = Math.round(savings / cashPrice * 100)
        lines.push('')
        if (savings > 0) {
            lines.push(`Comparando com dinheiro (R$ ${cashPrice.toLocaleString('pt-BR')}):`)
            lines.push(`  Total com compra de milhas + taxas: ~R$ ${totalWithPurchase.toLocaleString('pt-BR')}`)
            lines.push(`  Economia: ~R$ ${savings.toLocaleString('pt-BR')} (${savingsPct}%)`)
            if (savingsPct >= 40) lines.push(`  → Comprar as milhas que faltam VALE MUITO A PENA.`)
            else if (savingsPct >= 20) lines.push(`  → Comprar as milhas que faltam é razoável.`)
            else lines.push(`  → Economia pequena comprando milhas; considere pagar em dinheiro diretamente.`)
        } else {
            lines.push(`→ ATENÇÃO: custo total comprando milhas (~R$ ${totalWithPurchase.toLocaleString('pt-BR')}) próximo ao preço em dinheiro (R$ ${cashPrice.toLocaleString('pt-BR')}). Dinheiro pode ser mais prático.`)
        }
    }

    const purchaseInfo = PROGRAM_PURCHASE_INFO[targetProgram]
    if (purchaseInfo) {
        lines.push('')
        lines.push(`ONDE COMPRAR: https://${purchaseInfo.url}`)
        if (purchaseInfo.notes) lines.push(`  Dica: ${purchaseInfo.notes}`)
    }

    return lines.join('\n')
}

// ─── User data ────────────────────────────────────────────────────────────────

async function fetchUserData(userId: string, sb: ReturnType<typeof createClient>): Promise<UserData | null> {
    try {
        const { data: { user }, error } = await sb.auth.admin.getUserById(userId)
        if (error || !user) return null
        const meta = user.user_metadata ?? {}
        return {
            miles: (meta.miles ?? {}) as Record<string, number>,
            cards: (meta.activeCards ?? []) as string[],
            clubs: (meta.activeClubs ?? []) as string[],
            clubTiers: (meta.activeClubTiers ?? {}) as Record<string, string>,
        }
    } catch { return null }
}

// ─── JSON schema ──────────────────────────────────────────────────────────────

const JSON_SCHEMA = `{
  "vale_a_pena": <true se CPM >= 1.2 c/pt e a estratégia é executável, false se dinheiro é mais vantajoso>,
  "cpm_resgate": <número decimal, ex: 2.50>,
  "cpm_avaliacao": "<EXCELENTE | MUITO BOM | BOM | RAZOÁVEL | RUIM>",
  "programa_recomendado": "<ex: Smiles | LATAM Pass | TudoAzul | Livelo>",
  "motivo": "<máx 2 frases. Se vale_a_pena false, explique por que dinheiro é melhor>",
  "steps": [
    "<Passo 1 — título curto (máx 8 palavras)>",
    "<Passo 2 — título curto>",
    "<Passo 3 — título curto>",
    "<Passo 4 — título curto>"
  ],
  "step_details": [
    "<Passo 1 — explicação completa em 2-4 frases para leigos: onde clicar, qual site/app, o que fazer, quanto tempo leva>",
    "<Passo 2 — mesma estrutura>",
    "<Passo 3 — mesma estrutura>",
    "<Passo 4 — mesma estrutura>"
  ],
  "milhas_necessarias": <número inteiro — usar valor real do Seats.aero quando disponível>,
  "milhas_em_carteira": <número inteiro — saldo direto do usuário no programa alvo, ou 0>,
  "milhas_faltantes": <número inteiro — max(0, milhas_necessarias - total_potencial_com_transferencias)>,
  "como_completar_faltantes": "<se milhas_faltantes > 0: melhor forma de obter as milhas que faltam. Se coberto: 'Saldo atual cobre a emissão completa'>",
  "taxas_estimadas_brl": <número inteiro — taxas reais: Smiles ~R$30-150, LATAM Pass ~R$300-600+>,
  "economia_pct": <número 0-100. Se vale_a_pena false: 0>,
  "economia_brl": <número inteiro — cashPrice - taxas_estimadas_brl. Se vale_a_pena false: 0>,
  "promocao_ativa": "<promoção usada na estratégia, ou null>",
  "alternativa": "<segundo programa viável ou null>",
  "aviso": "<aviso principal ou null>",
  "regras_promocoes": [
    "<Regra ou condição importante sobre promoção citada. Ex: 'Bônus Nubank→Smiles limitado a 1 transferência por mês'>",
    "<outra regra se houver>"
  ]
}`

// ─── Serve ────────────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { flightId, userId, cashPrice, seatsContext, buscaId } = await req.json()
        if (!flightId && !seatsContext) {
            return new Response(JSON.stringify({ ok: false, error: 'flightId or seatsContext required' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const sb = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        // 1. Load flight
        let flight: FlightRow | null = null
        if (flightId) {
            const { data, error: fErr } = await sb.from('resultados_voos').select('*').eq('id', flightId).single()
            if (fErr || !data) {
                return new Response(JSON.stringify({ ok: false, error: 'Flight not found' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            flight = data as FlightRow
        } else if (seatsContext) {
            flight = {
                id: 0,
                companhia: `${seatsContext.airlineName} (${seatsContext.airlineCode})`,
                preco_brl: cashPrice || null,
                preco_milhas: seatsContext.totalMilhas,
                taxas_brl: null, cpm: null,
                partida: null, chegada: null,
                origem: seatsContext.origem,
                destino: seatsContext.destino,
                duracao_min: null,
                cabin_class: seatsContext.cabin?.toLowerCase() ?? 'economy',
                segmentos: null, detalhes: null,
            }
        }
        if (!flight) {
            return new Response(JSON.stringify({ ok: false, error: 'No flight data' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 2. Plan limits (server-side)
        if (userId) {
            const { data: profile } = await sb
                .from('user_profiles')
                .select('plan, plan_expires_at')
                .eq('id', userId)
                .single()

            const rawPlan = (profile?.plan ?? 'free').toLowerCase()
            const isExpired = profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()
            const plan = isExpired ? 'free' : rawPlan

            const LIMITS: Record<string, { lifetime: number | null; perMonth: number | null }> = {
                free:      { lifetime: 1,    perMonth: null },
                essencial: { lifetime: null, perMonth: 3   },
                pro:       { lifetime: null, perMonth: 5   },
                elite:     { lifetime: null, perMonth: 10  },
                admin:     { lifetime: null, perMonth: null },
            }
            const limit = LIMITS[plan] ?? LIMITS['free']

            if (limit.lifetime !== null || limit.perMonth !== null) {
                if (limit.lifetime !== null) {
                    const { count } = await sb
                        .from('strategies')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                    if ((count ?? 0) >= limit.lifetime) {
                        return new Response(JSON.stringify({ ok: false, error: 'plan_limit_reached', plan }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                    }
                } else if (limit.perMonth !== null) {
                    const monthStart = new Date()
                    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
                    const { count } = await sb
                        .from('strategies')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .gte('created_at', monthStart.toISOString())
                    if ((count ?? 0) >= limit.perMonth) {
                        return new Response(JSON.stringify({ ok: false, error: 'plan_limit_reached', plan }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                    }
                }
            }
        }

        // 3. Cache check
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        // Include dataVoo so different travel dates don't share the same cache
        const seatsKey = seatsContext
            ? `seats:${seatsContext.origem}:${seatsContext.destino}:${seatsContext.program.replace(/\s+/g, '_')}:${seatsContext.cabin}:${seatsContext.totalMilhas}${seatsContext.dataVoo ? `:${seatsContext.dataVoo}` : ''}`
            : null

        let cached: { structured_result: unknown; tokens_used: number | null } | null = null

        if (flightId) {
            // Filter by user_id: strategy includes personalized data (balance, clubs)
            let query = sb
                .from('strategies')
                .select('structured_result, tokens_used')
                .eq('flight_id', flightId)
                .gte('created_at', oneDayAgo)
                .not('structured_result', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
            if (userId) query = query.eq('user_id', userId)
            const { data } = await query.maybeSingle()
            cached = data
        } else if (seatsKey && userId) {
            // Cache per user+seatsKey (strategy is personalized with user's balance)
            const { data } = await sb
                .from('strategies')
                .select('structured_result, tokens_used')
                .eq('user_id', userId)
                .contains('tags', [seatsKey])
                .gte('created_at', oneDayAgo)
                .not('structured_result', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            cached = data
        }

        if (cached?.structured_result) {
            console.log(`[strategy] Cache hit — flight:${flightId ?? 'N/A'} seats:${seatsKey ?? 'N/A'}`)
            return new Response(JSON.stringify({
                ok: true,
                strategy: cached.structured_result,
                tokens_used: cached.tokens_used ?? 0,
                cached: true,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 4. Build context (cache miss)
        const iata = extractIata(flight.companhia)
        const programs = AIRLINE_PROGRAMS[iata] ?? ['Livelo']
        const targetProgram = seatsContext?.program ?? programs[0] ?? 'Smiles'
        const neededMiles = seatsContext?.totalMilhas ?? (flight.preco_brl ? Math.round((flight.preco_brl * 55) / 1000) * 1000 : 0)

        const [promoResult, userData] = await Promise.all([
            fetchPromos(targetProgram, programs, sb),
            userId ? fetchUserData(userId, sb) : Promise.resolve(null),
        ])

        const flightStr = buildFlightString(flight, targetProgram)
        const cpmSection = buildCpmSection(cashPrice || flight.preco_brl, neededMiles)
        const coverageResult = userData
            ? buildCoverageSection(
                targetProgram, neededMiles,
                userData.miles, userData.cards, userData.clubs, userData.clubTiers,
                promoResult.transferPromos
            )
            : null
        const coverageSection = coverageResult?.section ?? ''
        // When user has no wallet, assume all miles must be acquired from scratch
        const deficitMiles = userData
            ? (coverageResult?.deficit ?? 0)
            : neededMiles
        const purchaseSection = buildPurchaseSection(
            targetProgram, deficitMiles, promoResult.purchasePromos, cashPrice || flight.preco_brl
        )

        // 5. Assemble prompt
        const sections: string[] = ['=== VOO SELECIONADO ===', flightStr]

        if (seatsContext) {
            const lines = [
                `Disponibilidade REAL encontrada (Seats.aero):`,
                `  Programa: ${seatsContext.program}`,
                `  Ida: ${seatsContext.idaMilhas.toLocaleString('pt-BR')} pts (${seatsContext.origem} → ${seatsContext.destino})`,
            ]
            if (seatsContext.isRoundTrip && seatsContext.voltaMilhas) {
                lines.push(`  Volta: ${seatsContext.voltaMilhas.toLocaleString('pt-BR')} pts (${seatsContext.destino} → ${seatsContext.origem})`)
            }
            lines.push(`  Total: ${seatsContext.totalMilhas.toLocaleString('pt-BR')} pts`)
            if (seatsContext.taxas) lines.push(`  Taxas cobradas: ${seatsContext.taxas}`)
            lines.push(`  Cabine: ${seatsContext.cabin}`)
            sections.push('\n=== DISPONIBILIDADE REAL (Seats.aero) ===', lines.join('\n'))
        }

        if (cpmSection) {
            sections.push('\n=== ANÁLISE DE VALOR ===', cpmSection)
        }

        if (cashPrice && cashPrice > 0) {
            sections.push(
                '\n=== PREÇO EM DINHEIRO (referência) ===',
                `Melhor preço encontrado: R$ ${Number(cashPrice).toLocaleString('pt-BR')}`,
                `Use para calcular economia_pct = round((cashPrice - taxas_estimadas_brl) / cashPrice * 100) e economia_brl = cashPrice - taxas_estimadas_brl.`
            )
        }

        if (coverageSection) {
            sections.push('\n=== COBERTURA COM MILHAS DO USUÁRIO ===', coverageSection)
        } else if (!userData || Object.keys(userData.miles).length === 0) {
            // No wallet configured — explicit guidance for the LLM
            const transferUrl = PROGRAM_TRANSFER_URLS[targetProgram] ?? `${targetProgram.toLowerCase().replace(/\s+/g, '')}.com`
            sections.push('\n=== CARTEIRA DE MILHAS ===', [
                'Usuário SEM milhas cadastradas na carteira FlyWise.',
                `Precisa obter TODAS as ${neededMiles.toLocaleString('pt-BR')} pts de ${targetProgram} do zero.`,
                'Opções para obter as milhas:',
                `  1. COMPRAR DIRETAMENTE: veja seção "ANÁLISE DE COMPRA DE MILHAS" abaixo`,
                `  2. TRANSFERIR de pontos de cartão de crédito bancário para ${targetProgram} — URL: https://${transferUrl}`,
                `  3. ACUMULAR voando: comprar o voo em dinheiro e acumular milhas para futuros resgates`,
            ].join('\n'))
        }

        // Show which of the user's cards can transfer to the target program
        if (userData?.cards && userData.cards.length > 0) {
            const bases = TRANSFER_BASES[targetProgram] ?? []
            const bankPrograms = new Set(bases.map(b => b.source))
            const compatibleCards = userData.cards
                .map(id => CARD_TO_BANK_PROGRAM[id])
                .filter((c): c is { bank: string; label: string } => !!c && bankPrograms.has(c.bank))
            if (compatibleCards.length > 0) {
                const transferUrl = PROGRAM_TRANSFER_URLS[targetProgram]
                const cardLines = compatibleCards.map(c => {
                    const base = bases.find(b => b.source === c.bank)
                    return `  ${c.label} → ${c.bank} → ${targetProgram} (razão base ${base?.ratio ?? 1}:1)`
                })
                sections.push('\n=== CARTÕES DO USUÁRIO COMPATÍVEIS COM TRANSFERÊNCIA ===', [
                    `Os seguintes cartões do usuário podem transferir pontos para ${targetProgram}:`,
                    ...cardLines,
                    transferUrl ? `  URL para transferir: https://${transferUrl}` : '',
                    'IMPORTANTE: o usuário NÃO tem saldo registrado nesses cartões. Sugira verificar o saldo e transferir se disponível.',
                ].filter(Boolean).join('\n'))
            }
        }

        if (purchaseSection) {
            sections.push('\n=== ANÁLISE DE COMPRA DE MILHAS (déficit) ===', purchaseSection)
        }

        sections.push('\n=== PROMOÇÕES ATIVAS (programas relevantes) ===', promoResult.promoStr)
        sections.push(`\nResponda APENAS com JSON neste formato:\n${JSON_SCHEMA}`)

        const userPrompt = sections.join('\n')
        const approxTokens = Math.ceil(userPrompt.length / 4)
        console.log(`[strategy] Flight ${flightId ?? 'seats'} | ~${approxTokens} input tokens | target: ${targetProgram}`)

        // 6. Call OpenAI
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error('OPENAI_API_KEY not set in Edge Function secrets')

        const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é FlyWise, especialista em milhas e programas de fidelidade do Brasil.
Gere uma estratégia HONESTA, PERSONALIZADA e EXECUTÁVEL com base nos dados fornecidos.

REGRAS OBRIGATÓRIAS:
1. ANALISE o CPM fornecido. Se CPM < 1.2 c/pt → defina vale_a_pena: false e explique claramente por que dinheiro é melhor.
2. Se vale_a_pena: true, a estratégia DEVE ser executável com o que o usuário TEM (saldo direto + transferências possíveis conforme "COBERTURA COM MILHAS").
3. NUNCA sugira solicitar ou contratar novo cartão de crédito — PROIBIDO.
4. Se a cobertura mostra "✓ COBRE TUDO" ou saldo direto suficiente, o passo 1 DEVE usar esse saldo diretamente.
5. Se há "★ PROMO ATIVA" na cobertura ou em "CARTÕES DO USUÁRIO COMPATÍVEIS", PRIORIZE essa transferência e explique o bônus no step_details.
6. Se o usuário tem clube (ex: Smiles Diamante), mencione o benefício EXPLICITAMENTE no passo relevante (ex: "10% desconto nas taxas").
7. Se milhas_faltantes > 0 OU usuário não tem carteira: OBRIGATÓRIO criar um passo "Comprar milhas no site oficial" em steps/step_details. Use a seção "ANÁLISE DE COMPRA DE MILHAS" para informar o custo real e inclua a URL exata (https://...) no step_details. Como_completar_faltantes DEVE conter: custo estimado em R$, URL e dica de promo se houver.
8. Se a seção "CARTEIRA DE MILHAS" mostrar que o usuário não tem milhas, o passo 1 DEVE ser como obter as milhas (comprar ou transferir de cartão), não como emitir.
9. steps: TÍTULO curto (máx 8 palavras). step_details: explicação didática completa — onde clicar, qual site/app, o que esperar, quanto tempo leva. Inclua URLs onde relevante.
10. Se vale_a_pena: false: steps devem guiar o usuário para o que fazer neste caso (reservar em dinheiro, aguardar promo, acumular mais).
11. milhas_necessarias: usar o valor REAL do Seats.aero quando fornecido, não estimar.
12. Responda APENAS em JSON válido, sem texto adicional.`,
                    },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 2000,
                temperature: 0.2,
            }),
        })

        const llmData = await llmRes.json()
        if (!llmRes.ok) throw new Error(llmData.error?.message ?? 'OpenAI error')

        const strategyJson = llmData.choices?.[0]?.message?.content ?? '{}'
        const tokensUsed = llmData.usage?.total_tokens ?? 0
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(strategyJson) } catch { /* raw fallback */ }

        // 7. Save to strategies table (non-blocking)
        if (userId) {
            try {
                // Prefer buscaId from frontend; fallback to most recent busca
                let resolvedBuscaId: number | null = buscaId ?? null
                if (!resolvedBuscaId) {
                    const { data: busca } = await sb.from('buscas').select('id')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()
                    resolvedBuscaId = busca?.id ?? null
                }

                const tags = [parsed.programa_recomendado, iata, seatsKey, 'llm'].filter(Boolean) as string[]

                await sb.from('strategies').insert({
                    user_id: userId,
                    busca_id: resolvedBuscaId,
                    flight_id: flightId ?? null,
                    strategy_text: (parsed.steps as string[] ?? []).join('\n\n'),
                    tags,
                    economia_pct: parsed.economia_pct ?? null,
                    preco_cash: flight.preco_brl,
                    preco_estrategia: parsed.taxas_estimadas_brl ?? null,
                    structured_result: parsed,
                    llm_model: 'gpt-4o-mini',
                    tokens_used: tokensUsed,
                })
            } catch (saveErr) {
                console.error('[strategy] DB save failed (non-blocking):', saveErr)
            }
        }

        return new Response(JSON.stringify({
            ok: true,
            strategy: parsed,
            tokens_used: tokensUsed,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (err) {
        console.error('[strategy] Error:', err)
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
