// ─── Transfer Data ────────────────────────────────────────────────────────────
// Taxas e programas baseados em dados oficiais dos bancos/programas (mar/2026).
// Promoções são campanhas periódicas — a API /api/transfer-promotions atualiza
// diariamente ao meio-dia via Supabase. Os dados abaixo são o fallback local.
//
// IMPORTANTE sobre ratios:
//   ratio = quantos pontos do cartão para 1 milha/ponto no programa destino.
//   Ex: ratio 1.0 → 1.000 pontos do cartão = 1.000 milhas (1:1)
//   Ex: ratio 3.5 → 3.500 pontos = 1.000 milhas (3,5:1)
//
// Fontes pesquisadas em mar/2026:
//   - passageirodeprimeira.com, melhores-destinos.com.br
//   - cartoesdecredito.me, cartoeseviagens.com.br, altarendablog.com.br
//   - Páginas oficiais: esfera.com.vc, livelo.com.br, latampass.latam.com
//
// ⚠️ Livelo internacionais: ratios piorados em set/2023 (antes 2:1, agora 3,5:1)
// ⚠️ Livelo↔TAP encerrado em 19/08/2024 (exceto Bradesco Amex Centurion: 1:1)
// ⚠️ Esfera adicionou Flying Blue, IHG (set/2025) e TAP, Aeroméxico (out/2025)
// ⚠️ Inter Loop→Smiles restrito a clientes Win/Black (desde mar/2025)

export interface TransferTier {
    clubId: string | null       // null = sem clube necessário
    label: string
    ratio: number               // pontos cartão por 1 milha
    bonusPercent: number        // bônus base do tier
}

export interface TransferPartner {
    program: string
    tiers: TransferTier[]       // melhor tier primeiro
    minPoints: number
    minPointsLabel: string
    transferTime: string
    url: string
}

export interface CreditCard {
    id: string
    name: string
    currency: string
    color: string
    initials: string
    partners: TransferPartner[]
}

export interface ClubTierInfo {
    name: string                 // ex: 'Plano 1.000 mi'
    monthlyFee: string
    bonusLabel: string           // informativo
}

export interface MilesClub {
    id: string
    name: string
    program: string
    color: string
    monthlyFee: string
    description: string
    benefits: string[]
    tiers?: ClubTierInfo[]
    signupUrl: string
}

export interface TransferPromotion {
    id: string
    cardId: string
    program: string
    bonusPercent: number         // para não-clube
    clubBonusPercent: number     // para qualquer assinante (fallback genérico)
    // bônus específico por plano do clube (ex: Smiles campanhas por tier)
    clubTierBonuses: Record<string, number>   // tierName → bonus%
    clubRequired: string | null
    validUntil: string
    description: string
    isPeriodic: boolean
    lastConfirmed: string
    rules: string[]
    registrationUrl?: string
}

export interface RouteCategory {
    id: string
    label: string
    description: string
    icon: string
    example: string
    economy: number
    business: number
    cashBRL: number
    programs: string[]
}

// ─── Clubes ───────────────────────────────────────────────────────────────────

export const MILES_CLUBS: MilesClub[] = [
    {
        id: 'smiles_club',
        name: 'Clube Smiles',
        program: 'Smiles',
        color: '#FF6B00',
        monthlyFee: 'A partir de ~R$ 39,90/mês',
        signupUrl: 'https://www.smiles.com.br/clube-smiles',
        description: 'Assinatura mensal da Smiles com compra garantida de milhas + bônus diferencial por plano em promoções de transferência',
        tiers: [
            { name: 'Plano 1.000 mi', monthlyFee: '~R$ 39,90/mês', bonusLabel: 'Bônus diferencial em promos (ex: 70%)' },
            { name: 'Plano 2.000 mi', monthlyFee: '~R$ 69,90/mês', bonusLabel: 'Bônus diferencial em promos (ex: 80%)' },
            { name: 'Plano 5.000 mi', monthlyFee: '~R$ 149,90/mês', bonusLabel: 'Bônus diferencial em promos — confirmar' },
            { name: 'Plano 10.000 mi', monthlyFee: '~R$ 259,90/mês', bonusLabel: 'Bônus diferencial + lounge — confirmar' },
            { name: 'Plano 20.000 mi / Diamante', monthlyFee: '~R$ 449,90/mês', bonusLabel: 'Máximo bônus em promos — confirmar' },
        ],
        benefits: [
            'Milhas garantidas todo mês (1.000 a 20.000 conforme plano)',
            'Bônus diferencial por plano em promoções de transferência de cartão',
            'Compra de milhas com desconto',
            'Acesso a tarifas exclusivas de resgate',
            'Plano Diamante (20k): bônus máximo em campanhas',
        ],
    },
    {
        id: 'azul_fidelidade_clube',
        name: 'Clube Azul Fidelidade',
        program: 'TudoAzul',
        color: '#003DA5',
        monthlyFee: 'A partir de ~R$ 35,00/mês',
        signupUrl: 'https://www.voeazul.com.br/clube-azul',
        description: 'Assinatura do Azul Fidelidade com pontos mensais + bônus progressivo por tempo de assinatura',
        tiers: [
            { name: 'Plano 1.000 pts', monthlyFee: '~R$ 35,00/mês', bonusLabel: '+5% em transferências (6+ meses)' },
            { name: 'Plano 2.000 pts', monthlyFee: '~R$ 60,00/mês', bonusLabel: '+10% em transferências (12+ meses)' },
            { name: 'Plano 5.000 pts', monthlyFee: '~R$ 120,00/mês', bonusLabel: '+10% em transferências (12+ meses)' },
            { name: 'Plano 10.000 pts', monthlyFee: '~R$ 250,00/mês', bonusLabel: '+20% em transferências (12+ meses)' },
            { name: 'Plano 20.000 pts', monthlyFee: '~R$ 449,00/mês', bonusLabel: '+20% a +133% (5+ anos de assinatura)' },
        ],
        benefits: [
            'Pontos mensais garantidos (1.000 a 20.000)',
            'Bônus progressivo por tempo de assinatura (5%, 10% ou 20%)',
            'Bônus de até 133% em campanhas Livelo (assinantes 5+ anos)',
            'Pontos não expiram com assinatura ativa',
            'Resgate a partir de 5.000 pontos',
        ],
    },
    {
        id: 'latam_pass_status',
        name: 'LATAM Pass Status',
        program: 'LATAM Pass',
        color: '#E3000F',
        monthlyFee: 'Obtido por voos (sem custo direto)',
        signupUrl: 'https://latampass.latam.com/pt_br',
        description: 'Status de elite da LATAM obtido por quilômetros voados — concede bônus de acúmulo e benefícios premium',
        tiers: [
            { name: 'Silver', monthlyFee: '6.000 QV/ano', bonusLabel: '+50% em acúmulo de pontos por voo' },
            { name: 'Gold', monthlyFee: '12.000 QV/ano', bonusLabel: '+75% em acúmulo de pontos por voo' },
            { name: 'Black', monthlyFee: '24.000 QV/ano', bonusLabel: '+100% em acúmulo + lounges LATAM' },
            { name: 'Black Signature', monthlyFee: '50.000 QV/ano', bonusLabel: '+125% em acúmulo + benefícios premium' },
        ],
        benefits: [
            'Bônus de 50 a 125% em acúmulo de pontos por voo',
            'Acesso a lounges LATAM (Gold/Black)',
            'Upgrades prioritários e assento premium',
            'Bagagem extra incluída',
            'Check-in prioritário',
        ],
    },
    {
        id: 'livelo_clube',
        name: 'Clube Livelo',
        program: 'Livelo',
        color: '#8B5CF6',
        monthlyFee: 'Gratuito (via banco parceiro) ou pago',
        signupUrl: 'https://www.livelo.com.br/clube',
        description: 'Clube Livelo gratuito (via Bradesco/BB/Santander) com transferência imediata; planos pagos com pontos mensais garantidos e benefícios extras',
        tiers: [
            { name: 'Clube Livelo Grátis', monthlyFee: 'Gratuito (via banco parceiro)', bonusLabel: 'Transferência imediata para aéreas' },
            { name: 'Plano Classic', monthlyFee: '~R$ 44,90/mês · 1.000 pts', bonusLabel: 'Pontos mensais + benefícios clube' },
            { name: 'Plano Special', monthlyFee: '~R$ 89,90/mês · 2.000 pts', bonusLabel: 'Pontos mensais + benefícios clube' },
            { name: 'Plano Plus', monthlyFee: '~R$ 149,90/mês · 5.000 pts', bonusLabel: 'Pontos mensais + benefícios clube' },
            { name: 'Plano Super', monthlyFee: '~R$ 269,90/mês · 10.000 pts', bonusLabel: 'Pontos mensais + benefícios clube' },
            { name: 'Plano Mega', monthlyFee: '~R$ 449,90/mês · 15.000 pts', bonusLabel: 'Pontos mensais + benefícios clube' },
            { name: 'Plano Top', monthlyFee: '~R$ 799,90/mês · 20.000 pts', bonusLabel: 'Máximo benefícios + bônus exclusivos' },
        ],
        benefits: [
            'Transferência imediata para Smiles e Azul Fidelidade (sem aguardar 72h)',
            'Acesso a promoções exclusivas de bônus em campanhas',
            'Pontos nunca expiram com clube ativo',
            'Resgate em produtos, passagens e experiências',
            'Parceria com Bradesco, Santander e Banco do Brasil',
        ],
    },
    {
        id: 'esfera_clube',
        name: 'Esfera Santander',
        program: 'Esfera',
        color: '#EC0000',
        monthlyFee: 'Gratuito (vinculado ao cartão Santander)',
        signupUrl: 'https://esfera.com.vc',
        description: 'Programa de pontos do Santander. Ter cartão Santander já vincula ao Esfera com 20% de bônus permanente em transferências para Smiles',
        tiers: [
            { name: 'Esfera Básico', monthlyFee: 'Cartões padrão Santander', bonusLabel: '20% bônus permanente Smiles' },
            { name: 'Esfera Select', monthlyFee: 'Van Gogh / Select', bonusLabel: '20% bônus permanente Smiles' },
            { name: 'Esfera Infinite', monthlyFee: 'Infinite / Unique', bonusLabel: '20% permanente + promos exclusivas' },
        ],
        benefits: [
            'Bônus de 20% permanente em transferências para Smiles (todos os cartões)',
            'Acesso a promoções exclusivas com bônus adicionais via Esfera',
            'Pontos Esfera acumulam em todas as compras',
            'Transferência mínima de 1.000 pontos',
            'Prazo de crédito: até 5 dias úteis',
        ],
    },
]

// ─── Cartões ─────────────────────────────────────────────────────────────────
// Fontes: Passageiro de Primeira, Melhores Destinos, cartoesdecredito.me (mar/2026)
// Ratios: pontos do cartão necessários para 1 milha/ponto no programa destino.
//   Iupp Itaú: 1:1 (todos os parceiros)
//   Santander Esfera: 1:1 (nacional, mín. 15k) | 2:1 (Iberia) | 2,7:1 (TAP) | 3:1–3,5:1 (Flying Blue, AA, Copa, Aeromexico)
//   Caixa UAU: 1:1 (Smiles/LATAM/Azul) | 2:1 (TAP)
//   Nubank, C6, XP (via Livelo), BTG, Inter: 1:1
// ⚠️ Inter Loop: ativo em mar/2026. Smiles restrito a clientes Win/Black.
// ⚠️ Esfera expandiu parceiros internacionais em set–out/2025.

export const CREDIT_CARDS: CreditCard[] = [
    {
        id: 'iupp_itau',
        name: 'Iupp Itaú / Personnalité',
        currency: 'Pontos Iupp',
        color: '#EC7000',
        initials: 'IT',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (1:1, sem mínimo oficial declarado)',
                transferTime: 'Até 48h',
                url: 'https://www.itau.com.br/cartoes/iupp',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (1:1)',
                transferTime: 'Até 48h',
                url: 'https://latampass.latam.com/pt_br/junte-milhas',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 0 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 100,
                minPointsLabel: '100 pts (1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.itau.com.br/cartoes/iupp',
            },
            {
                program: 'TAP Miles&Go',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.itau.com.br/cartoes/iupp',
            },
        ],
    },
    {
        id: 'nubank_ultravioleta',
        name: 'Nubank Ultravioleta',
        currency: 'Pontos Nubank',
        color: '#8A05BE',
        initials: 'NU',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 2500,
                minPointsLabel: '2.500 Pontos Nubank',
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                minPointsLabel: '2.500 Pontos Nubank',
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                minPointsLabel: '2.500 Pontos Nubank',
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
        ],
    },
    {
        id: 'c6_atomos',
        name: 'C6 Bank Carbon / Carbono',
        currency: 'Átomos',
        color: '#222222',
        initials: 'C6',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 5000,
                minPointsLabel: '5.000 Átomos',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 Átomos',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 0 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 100,
                minPointsLabel: '100 Átomos',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
            {
                program: 'TAP Miles&Go',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 50000,
                minPointsLabel: '50.000 Átomos (mínimo alto)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Hub Livelo (acesso a programas internacionais)', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 Átomos → Livelo (depois Livelo→aérea)',
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.livelo.com.br',
            },
        ],
    },
    {
        id: 'santander_esfera',
        name: 'Santander Infinite / Esfera',
        currency: 'Pontos Esfera',
        color: '#EC0000',
        initials: 'SN',
        partners: [
            // ── Nacional (1:1) ────────────────────────────────────────────────
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: 'esfera_clube', label: 'Esfera (sem Clube Smiles) — 20% permanente', ratio: 1.0, bonusPercent: 20 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 20 },
                ],
                minPoints: 15000,
                minPointsLabel: '15.000 pts Esfera (1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 15000,
                minPointsLabel: '15.000 pts Esfera (1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 15000,
                minPointsLabel: '15.000 pts Esfera (1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            // ── Internacional ─────────────────────────────────────────────────
            {
                program: 'Iberia Plus',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 2.0, bonusPercent: 0 },
                ],
                minPoints: 15000,
                minPointsLabel: '15.000 pts (2:1 → 7.500 Avios)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'Flying Blue',
                tiers: [
                    { clubId: 'esfera_clube', label: 'Esfera Select/Infinite', ratio: 3.0, bonusPercent: 0 },
                    { clubId: null, label: 'Taxa padrão', ratio: 3.5, bonusPercent: 0 },
                ],
                minPoints: 30000,
                minPointsLabel: '30.000 pts (3:1 clube / 3,5:1 padrão → ≥8.571 mi)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'TAP Miles&Go',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 2.7, bonusPercent: 0 },
                ],
                minPoints: 15000,
                minPointsLabel: '15.000 pts (2,7:1 → ≈5.556 milhas TAP)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'American Airlines',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 3.5, bonusPercent: 0 },
                ],
                minPoints: 30000,
                minPointsLabel: '30.000 pts (3,5:1 → ≈8.571 AAdvantage)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'ConnectMiles',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 3.5, bonusPercent: 0 },
                ],
                minPoints: 30000,
                minPointsLabel: '30.000 pts (3,5:1 → ≈8.571 milhas Copa)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'Club Premier',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 3.5, bonusPercent: 0 },
                ],
                minPoints: 30000,
                minPointsLabel: '30.000 pts (3,5:1 → ≈8.571 milhas Aeromexico)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
        ],
    },
    {
        id: 'xp_visa',
        name: 'XP Visa Infinite',
        currency: 'Pontos XP',
        color: '#000000',
        initials: 'XP',
        // ⚠️ XP opera via hub Livelo: pts XP → Livelo (1:1) → programas aéreos.
        // Ratios internacionais seguem tabela Livelo (Flying Blue 3,5:1, etc.)
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (via Livelo → Smiles, 1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.xpi.com.br/cartao',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (via Livelo → LATAM, 1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.xpi.com.br/cartao',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (via Livelo → Azul, 1:1)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.xpi.com.br/cartao',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: 'livelo_clube', label: 'Hub Livelo (acesso a Flying Blue, BA, etc.)', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts → Livelo (hub para internacionais)',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.livelo.com.br',
            },
        ],
    },
    {
        id: 'bradesco_livelo',
        name: 'Bradesco / Banco do Brasil',
        currency: 'Pontos Livelo',
        color: '#D40040',
        initials: 'BD',
        // Acumula diretamente em Livelo. De Livelo: Smiles/LATAM/Azul 1:1 | Flying Blue 3,5:1 | etc.
        // ⚠️ Bradesco Amex Centurion: mantém TAP 1:1 (parceria Livelo-TAP encerrou em 19/08/2024 para demais)
        partners: [
            {
                program: 'Livelo',
                tiers: [
                    { clubId: 'livelo_clube', label: 'Clube Livelo (transferência imediata)', ratio: 1.0, bonusPercent: 0 },
                    { clubId: null, label: 'Acúmulo padrão (até 72h)', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                minPointsLabel: '2.500 pts → Livelo (depois Livelo→aérea mín. 10.000)',
                transferTime: 'Imediato (Clube) ou até 72h',
                url: 'https://www.livelo.com.br',
            },
        ],
    },
    {
        id: 'btg_pactual',
        name: 'BTG Pactual',
        currency: 'Pontos BTG',
        color: '#005B99',
        initials: 'BT',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (1:1)',
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.btgpactual.com/cartao',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (1:1)',
                transferTime: 'Até 3 dias úteis',
                url: 'https://latampass.latam.com/pt_br/junte-milhas',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts (1:1)',
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.btgpactual.com/cartao',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Hub Livelo (acesso a programas internacionais)', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts → Livelo (hub para internacionais)',
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.livelo.com.br',
            },
        ],
    },
    {
        id: 'inter_black',
        name: 'Inter Black / One',
        currency: 'Pontos Inter Loop',
        color: '#FF6B00',
        initials: 'IN',
        partners: [
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 0 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 3000,
                minPointsLabel: '3.000 pts (1:1, todos os clientes)',
                transferTime: 'Até 2 dias úteis',
                url: 'https://inter.co/inter-loop',
            },
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 10000,
                minPointsLabel: '10.000 pts (1:1) — ⚠️ restrito a clientes Win/Black',
                transferTime: 'Até 2 dias úteis',
                url: 'https://inter.co/inter-loop',
            },
        ],
    },
    {
        id: 'caixa_uau',
        name: 'Caixa Econômica (UAU)',
        currency: 'Pontos Uau Caixa',
        color: '#00529B',
        initials: 'CX',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 4000,
                minPointsLabel: '4.000 pts UAU (1:1)',
                transferTime: 'Até 72h',
                url: 'https://uau.caixa.gov.br',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 4000,
                minPointsLabel: '4.000 pts UAU (1:1)',
                transferTime: 'Até 72h',
                url: 'https://uau.caixa.gov.br',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2000,
                minPointsLabel: '2.000 pts UAU (1:1)',
                transferTime: 'Até 72h',
                url: 'https://uau.caixa.gov.br',
            },
            {
                program: 'TAP Miles&Go',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 2.0, bonusPercent: 0 },
                ],
                minPoints: 10000,
                minPointsLabel: '10.000 pts UAU (2:1 → 5.000 milhas TAP)',
                transferTime: 'Até 72h',
                url: 'https://uau.caixa.gov.br',
            },
        ],
    },
]

// ─── Livelo como HUB de transferência ────────────────────────────────────────
// Pontos Livelo → programas aéreos na proporção 1:1
// Mínimo: 15.000 pontos Livelo por transferência (doméstico e internacional)
// Fontes: livelo.com.br/transferencia (mar/2026)
// ⚠️ Parceria Livelo ↔ Smiles: verifique status atual em livelo.com.br (houve instabilidade em 2022)

export const LIVELO_AIRLINE_PARTNERS: Array<{
    program: string
    ratio: number
    minPoints: number
    label: string
    international?: boolean
    note?: string
}> = [
    // ── Doméstico (1:1) ────────────────────────────────────────────────────────
    { program: 'Smiles', ratio: 1.0, minPoints: 10000, label: 'Livelo → Smiles (1:1, mín. 10.000)' },
    { program: 'LATAM Pass', ratio: 1.0, minPoints: 15000, label: 'Livelo → LATAM Pass (1:1, mín. 15.000)' },
    { program: 'TudoAzul', ratio: 1.0, minPoints: 1000, label: 'Livelo → Azul Fidelidade (1:1, mín. 1.000)' },
    // ── Internacional — ratios piores que doméstico ────────────────────────────
    // Ratios piorados em set/2023: antes 2:1, agora 3,5:1 para Flying Blue/BA/Etihad/Iberia
    { program: 'Flying Blue', ratio: 3.5, minPoints: 10000, label: 'Livelo → Flying Blue AF/KLM (3,5:1)', international: true },
    { program: 'British Airways', ratio: 3.5, minPoints: 10000, label: 'Livelo → British Airways Avios (3,5:1)', international: true },
    { program: 'Etihad Guest', ratio: 3.5, minPoints: 10000, label: 'Livelo → Etihad Guest (3,5:1)', international: true },
    { program: 'Iberia Plus', ratio: 3.5, minPoints: 3500, label: 'Livelo → Iberia Plus Avios (3,5:1, mín. 3.500)', international: true },
    { program: 'Club Premier', ratio: 3.5, minPoints: 10000, label: 'Livelo → Aeroméxico Club Premier (3,5:1)', international: true },
    { program: 'ConnectMiles', ratio: 3.0, minPoints: 1000, label: 'Livelo → Copa ConnectMiles (3:1, mín. 1.000)', international: true },
    { program: 'United MileagePlus', ratio: 4.0, minPoints: 10000, label: 'Livelo → United MileagePlus (4:1)', international: true },
    // ── Encerradas ─────────────────────────────────────────────────────────────
    // TAP Miles&Go: parceria Livelo↔TAP encerrou em 19/08/2024 (exceto Bradesco Amex Centurion: 1:1)
    // Emirates Skywards: sem parceria com nenhum programa/cartão brasileiro
]

// ─── Promoções periódicas ─────────────────────────────────────────────────────
// ⚠️ SEMPRE confirme na página oficial antes de transferir.
// ⚠️ Bônus POR PLANO do Clube Smiles:
//    1k=70%, 2k=80% (confirmados pelo usuário, mar/2026).
//    5k, 10k, Diamante: valores típicos de campanhas — confirmar na campanha vigente.
//
// Estes dados são o FALLBACK LOCAL. A API /api/transfer-promotions retorna
// dados atualizados do Supabase (atualizado diariamente ao meio-dia).

export const ACTIVE_PROMOTIONS: TransferPromotion[] = [
    {
        id: 'iupp_smiles',
        cardId: 'iupp_itau',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Itaú → Smiles',
        registrationUrl: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir — sem cadastro, sem bônus',
            'Sem clube: 30% de bônus',
            'Clube Smiles Plano 1.000 mi: 70% de bônus (confirmado)',
            'Clube Smiles Plano 2.000 mi: 80% de bônus (confirmado)',
            'Planos 5k, 10k, Diamante: bônus maior — confirmar na campanha vigente',
            'Limite de 300.000 milhas bônus por CPF ou Conta Família',
            'Milhas bônus creditadas em até 15 dias após encerramento da campanha',
            'Validade das milhas bônus: 12 meses após creditação',
        ],
    },
    {
        id: 'nubank_smiles',
        cardId: 'nubank_ultravioleta',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Nubank → Smiles',
        registrationUrl: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir',
            'Sem cadastro prévio = sem bônus (sem exceções)',
            'Mínimo de 2.500 Pontos Nubank por transferência',
            'Plano 1.000 mi: 70% de bônus; Plano 2.000 mi: 80%',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
            'Validade das milhas bônus: 12 meses',
        ],
    },
    {
        id: 'c6_smiles',
        cardId: 'c6_atomos',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — C6 Bank → Smiles',
        registrationUrl: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
            'Prazo de creditação: até 5 dias úteis para a transferência base',
        ],
    },
    {
        id: 'santander_smiles',
        cardId: 'santander_esfera',
        program: 'Smiles',
        bonusPercent: 20,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Bônus de 20% permanente + campanhas periódicas para clube',
        lastConfirmed: 'Mar/2026',
        isPeriodic: false,
        description: '20% permanente para todos (Esfera) + por plano Clube Smiles em campanhas',
        registrationUrl: 'https://esfera.com.vc',
        rules: [
            'Bônus de 20% é permanente para todos os clientes Santander via Esfera',
            'Clube Smiles ativo: bônus extra durante campanhas periódicas',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80% (em campanhas)',
            'Para campanhas extras: cadastre-se na página da promoção antes',
            'Mínimo: 1.000 pontos Esfera por transferência',
            'Prazo de crédito: até 5 dias úteis',
        ],
    },
    {
        id: 'xp_smiles',
        cardId: 'xp_visa',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — XP → Smiles',
        registrationUrl: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na página da promoção antes de transferir',
            'Mínimo de 1.000 XP Pontos por transferência',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%',
            'Limite: 300.000 milhas bônus por CPF',
        ],
    },
    {
        id: 'btg_latam',
        cardId: 'btg_pactual',
        program: 'LATAM Pass',
        bonusPercent: 25,
        clubBonusPercent: 25,
        clubTierBonuses: {},
        clubRequired: null,
        validUntil: 'Campanha periódica (confirme em latampass.latam.com)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: '25% de bônus + 1.000 milhas extras na primeira transferência BTG → LATAM Pass',
        registrationUrl: 'https://latampass.latam.com/pt_br/junte-milhas',
        rules: [
            '⚠️ Registre-se na página da promoção antes de transferir',
            'Bônus de 25% válido para todos os clientes BTG Pactual',
            '1.000 milhas extras na primeira transferência do período',
            'Milhas bônus creditadas em até 30 dias',
            'Validade das milhas bônus: 36 meses',
        ],
    },
    {
        id: 'inter_tudoazul',
        cardId: 'inter_black',
        program: 'TudoAzul',
        bonusPercent: 80,
        clubBonusPercent: 130,
        clubTierBonuses: {
            'Plano 1.000 pts': 103,
            'Plano 2.000 pts': 103,
            'Plano 5.000 pts': 103,
            'Plano 10.000 pts': 103,
            'Plano 20.000 pts': 130,
        },
        clubRequired: 'azul_fidelidade_clube',
        validUntil: 'Campanha periódica (confirme em tudoazul.voeazul.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: '80% para todos; Clube Azul: 103%; 5+ anos assinatura: 130% — Inter → TudoAzul',
        registrationUrl: 'https://www.voeazul.com.br/inter-pontos',
        rules: [
            '⚠️ Cadastre-se na página da promoção antes de transferir',
            'Todos os clientes Inter: 80% de bônus',
            'Assinantes do Clube Azul Fidelidade (qualquer plano): 103% de bônus',
            'Assinantes há 5+ anos (Plano 20.000 pts): 130% de bônus',
            'Limite: 300.000 pontos bônus por CPF',
            'Creditação em até 15 dias úteis',
            'Validade dos pontos bônus: 6 meses',
        ],
    },
    {
        id: 'inter_smiles',
        cardId: 'inter_black',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Inter → Smiles',
        registrationUrl: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir — sem cadastro, sem bônus',
            'Sem clube: 30% de bônus',
            'Clube Smiles Plano 1.000 mi: 70% de bônus (confirmado)',
            'Clube Smiles Plano 2.000 mi: 80% de bônus (confirmado)',
            'Planos 5k, 10k, Diamante: bônus maior — confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
            'Milhas bônus creditadas em até 15 dias após encerramento da campanha',
        ],
    },
    {
        id: 'bradesco_livelo',
        cardId: 'bradesco_livelo',
        program: 'Livelo',
        bonusPercent: 0,
        clubBonusPercent: 0,
        clubTierBonuses: {},
        clubRequired: null,
        validUntil: 'Transferência padrão (sem campanha ativa no momento)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: false,
        description: 'Bradesco/BB → Livelo: transferência 1:1, sem bônus atualmente.',
        rules: [
            'Transferência de Bradesco/BB para Livelo: taxa 1:1',
            'Depois, de Livelo para Smiles/LATAM/TudoAzul: também 1:1',
            'Mínimo de 15.000 pontos por transferência Livelo → aérea',
            'Transferência imediata disponível para membros do Clube Livelo',
            'Sem bônus de campanha ativo no momento — aguarde promoções periódicas',
        ],
    },
    {
        id: 'caixa_smiles',
        cardId: 'caixa_uau',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — Caixa → Smiles',
        registrationUrl: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
        ],
    },
    {
        id: 'btg_smiles',
        cardId: 'btg_pactual',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubTierBonuses: {
            'Plano 1.000 mi': 70,
            'Plano 2.000 mi': 80,
            'Plano 5.000 mi': 100,
            'Plano 10.000 mi': 120,
            'Plano 20.000 mi / Diamante': 130,
        },
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — BTG → Smiles',
        registrationUrl: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na página da promoção antes de transferir',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
        ],
    },
]

// ─── Rotas de referência ──────────────────────────────────────────────────────
// ⚠️ Preços MÉDIOS estimados com base em tabelas de resgate dos programas.
// Valores reais variam por data, disponibilidade e categoria.
// O FlyWise atualiza esses dados semanalmente via Seats.aero.

export const ROUTE_CATEGORIES: RouteCategory[] = [
    {
        id: 'dom_short',
        label: 'Doméstico curto',
        description: 'Voos até ~1h30',
        icon: '🏙️',
        example: 'GRU ↔ SDU / GRU ↔ CGH',
        economy: 6000,
        business: 15000,
        cashBRL: 480,
        programs: ['Smiles', 'LATAM Pass', 'TudoAzul', 'Livelo'],
    },
    {
        id: 'dom_medium',
        label: 'Doméstico médio',
        description: 'Voos de 2h a 3h30',
        icon: '✈️',
        example: 'GRU ↔ SSA / GRU ↔ BSB',
        economy: 10000,
        business: 25000,
        cashBRL: 780,
        programs: ['Smiles', 'LATAM Pass', 'TudoAzul', 'Livelo'],
    },
    {
        id: 'dom_long',
        label: 'Doméstico longo',
        description: 'Voos acima de 3h30',
        icon: '🛫',
        example: 'GRU ↔ BEL / GRU ↔ REC',
        economy: 15000,
        business: 35000,
        cashBRL: 1100,
        programs: ['Smiles', 'LATAM Pass', 'TudoAzul', 'Livelo'],
    },
    {
        id: 'latam_short',
        label: 'América Latina curto',
        description: 'Vizinhos próximos',
        icon: '🌎',
        example: 'GRU ↔ BOG / GRU ↔ SCL',
        economy: 18000,
        business: 40000,
        cashBRL: 1500,
        programs: ['Smiles', 'LATAM Pass', 'TudoAzul', 'Livelo'],
    },
    {
        id: 'latam_medium',
        label: 'América Latina médio',
        description: 'Caribe e América Central',
        icon: '🏖️',
        example: 'GRU ↔ MEX / GRU ↔ CUN',
        economy: 25000,
        business: 55000,
        cashBRL: 2200,
        programs: ['Smiles', 'LATAM Pass', 'Livelo'],
    },
    {
        id: 'transatlantic',
        label: 'Europa / EUA',
        description: 'Destinos transatlânticos',
        icon: '🗺️',
        example: 'GRU ↔ CDG / GRU ↔ JFK',
        economy: 45000,
        business: 85000,
        cashBRL: 5500,
        programs: ['Smiles', 'LATAM Pass', 'Livelo'],
    },
    {
        id: 'longhaul',
        label: 'Ásia / Oceania',
        description: 'Longa distância',
        icon: '🌏',
        example: 'GRU ↔ NRT / GRU ↔ SYD',
        economy: 65000,
        business: 120000,
        cashBRL: 9500,
        programs: ['Smiles', 'LATAM Pass'],
    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function computeMiles(points: number, ratio: number, bonusPercent: number): number {
    const base = Math.floor(points / ratio)
    return Math.floor(base * (1 + bonusPercent / 100))
}

export function findPromotion(cardId: string, program: string, promotions?: TransferPromotion[]): TransferPromotion | null {
    const list = promotions ?? ACTIVE_PROMOTIONS
    return list.find(p => p.cardId === cardId && p.program === program) ?? null
}

/** Retorna o bônus do promo para um tier específico do clube, ou fallback clubBonusPercent. */
export function getClubTierBonus(promo: TransferPromotion, tierName: string | null): number {
    if (!tierName) return promo.bonusPercent
    const tierBonus = promo.clubTierBonuses[tierName]
    if (tierBonus !== undefined) return tierBonus
    return promo.clubBonusPercent
}

export function rateCPM(cpm: number): { label: string; color: string; rating: string } {
    if (cpm >= 4.0) return { label: 'Excelente', color: '#6366F1', rating: 'excelente' }
    if (cpm >= 2.5) return { label: 'Bom', color: '#16A34A', rating: 'bom' }
    if (cpm >= 1.5) return { label: 'Razoável', color: '#F59E0B', rating: 'ok' }
    return { label: 'Abaixo do ideal', color: '#EF4444', rating: 'ruim' }
}

// ─── Detecção de validade/expiração ──────────────────────────────────────────
// Tenta extrair uma data explícita do campo validUntil.
// Formatos reconhecidos:
//   ISO:         "2026-03-23" (ou embutido em texto "até 2026-03-23")
//   Brasileiro:  "23/03/2026" (ou "23 de março de 2026")
//   "até hoje" / "acaba hoje" → trata o dia atual como expiração

const MONTHS_PT: Record<string, string> = {
    janeiro: '01', fevereiro: '02', março: '03', marco: '03',
    abril: '04', maio: '05', junho: '06', julho: '07',
    agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
}

export function parsePromoExpiry(validUntil: string): Date | null {
    if (!validUntil) return null
    const s = validUntil.toLowerCase()

    // "até hoje" / "acaba hoje" / "válido hoje"
    if (/\b(hoje|today|acaba hoje|até hoje)\b/.test(s)) {
        const d = new Date()
        d.setHours(23, 59, 59, 999)
        return d
    }

    // ISO: 2026-03-23
    const iso = validUntil.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T23:59:59`)

    // Brasileiro DD/MM/YYYY
    const br = validUntil.match(/(\d{1,2})\/(\d{2})\/(\d{4})/)
    if (br) return new Date(`${br[3]}-${br[2]}-${br[1].padStart(2, '0')}T23:59:59`)

    // "23 de março de 2026"
    const ext = s.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/)
    if (ext) {
        const month = MONTHS_PT[ext[2]]
        if (month) return new Date(`${ext[3]}-${month}-${ext[1].padStart(2, '0')}T23:59:59`)
    }

    return null
}

/** Retorna true se a promoção tem data explícita e ela já passou. */
export function isPromotionExpired(promo: TransferPromotion): boolean {
    const expiry = parsePromoExpiry(promo.validUntil)
    if (!expiry) return false
    return new Date() > expiry
}

/** Retorna o bônus efetivo respeitando expiração — 0 se expirado. */
export function getEffectiveBonusPercent(promo: TransferPromotion, clubTier?: string | null): number {
    if (isPromotionExpired(promo)) return 0
    return clubTier ? getClubTierBonus(promo, clubTier) : promo.bonusPercent
}
