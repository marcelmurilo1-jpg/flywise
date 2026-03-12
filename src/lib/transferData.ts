// ─── Transfer Data ────────────────────────────────────────────────────────────
// All data is public knowledge from official bank/program terms.
// Promotions should be reviewed periodically.

export interface TransferTier {
    clubId: string | null       // null = sem clube necessário
    label: string               // "Sem clube" | "Smiles Club" etc.
    ratio: number               // pontos do cartão por 1 milha (quanto maior, pior)
    bonusPercent: number        // bônus adicional em milhas (0 = sem bônus)
}

export interface TransferPartner {
    program: string
    tiers: TransferTier[]       // do melhor para o pior
    minPoints: number           // mínimo para transferência
    transferTime: string        // tempo de crédito
    url: string                 // link para transferência
}

export interface CreditCard {
    id: string
    name: string
    currency: string            // nome dos pontos do cartão
    color: string               // cor do cartão no UI
    initials: string
    partners: TransferPartner[]
}

export interface MilesClub {
    id: string
    name: string
    program: string
    color: string
    monthlyFee: string          // custo mensal aproximado
    description: string
    benefits: string[]
}

export interface TransferPromotion {
    cardId: string
    program: string
    bonusPercent: number        // ex: 100 = dobro de milhas
    clubRequired: string | null // null = válido para todos
    validUntil: string          // "2026-04-30" ou "Campanha periódica"
    description: string
    rules: string[]
    isPeriodic: boolean         // campanhas que se repetem
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
    programs: string[]          // programas que cobrem essa rota
}

// ─── Clubes disponíveis ───────────────────────────────────────────────────────

export const MILES_CLUBS: MilesClub[] = [
    {
        id: 'smiles_club',
        name: 'Smiles Club',
        program: 'Smiles',
        color: '#FF6B00',
        monthlyFee: '~R$ 29,90/mês',
        description: 'Programa de assinatura da Smiles com bônus de 80–100% em transferências parceiras',
        benefits: [
            'Bônus de 80% a 100% em transferências de cartão',
            'Milhas extras em voos Gol',
            'Upgrade de cabine com mais facilidade',
            'Acesso a tarifas exclusivas',
        ],
    },
    {
        id: 'tudoazul_clube',
        name: 'TudoAzul Clube',
        program: 'TudoAzul',
        color: '#003DA5',
        monthlyFee: '~R$ 24,90/mês',
        description: 'Assinatura TudoAzul com bônus garantido em compras e transferências',
        benefits: [
            'Bônus de 50% a 100% em transferências',
            'Pontuação em dobro em compras Azul',
            'Resgate a partir de 10.000 pontos',
            'Pontos não expiram com assinatura ativa',
        ],
    },
    {
        id: 'latam_pass_black',
        name: 'LATAM Pass Black',
        program: 'LATAM Pass',
        color: '#E3000F',
        monthlyFee: 'Por status de voo',
        description: 'Status Diamante/Black da LATAM que concede bônus em acúmulo e benefícios premium',
        benefits: [
            'Bônus de 50–100% em acúmulo de pontos',
            'Transferências sem taxa',
            'Acesso a salas VIP',
            'Upgrades prioritários',
        ],
    },
    {
        id: 'livelo_turbo',
        name: 'Livelo Turbo',
        program: 'Livelo',
        color: '#8B5CF6',
        monthlyFee: '~R$ 19,90/mês',
        description: 'Programa de aceleração Livelo com pontuação em dobro em parceiros selecionados',
        benefits: [
            'Pontos em dobro em lojas parceiras',
            'Bônus em transferências periódicas',
            'Acesso a ofertas exclusivas',
            'Pontos nunca expiram',
        ],
    },
]

// ─── Cartões e parceiros ──────────────────────────────────────────────────────

export const CREDIT_CARDS: CreditCard[] = [
    {
        id: 'itaucard_personnalite',
        name: 'Itaucard / Personnalité',
        currency: 'Pontos Itaú',
        color: '#EC7000',
        initials: 'IT',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 2.5, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.itau.com.br/cartoes/vantagens/milhas',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: 'latam_pass_black', label: 'LATAM Black', ratio: 2.5, bonusPercent: 50 },
                    { clubId: null, label: 'Sem status', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.itau.com.br/cartoes/vantagens/milhas',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'tudoazul_clube', label: 'TudoAzul Clube', ratio: 2.5, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.itau.com.br/cartoes/vantagens/milhas',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                transferTime: 'Instantâneo',
                url: 'https://www.livelo.com.br',
            },
        ],
    },
    {
        id: 'nubank_ultravioleta',
        name: 'Nubank Ultravioleta',
        currency: 'Núcleos',
        color: '#8A05BE',
        initials: 'NU',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 1.0, bonusPercent: 80 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'tudoazul_clube', label: 'TudoAzul Clube', ratio: 1.0, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                transferTime: 'Instantâneo',
                url: 'https://nubank.com.br/nucleo',
            },
        ],
    },
    {
        id: 'xp_visa_infinite',
        name: 'XP Visa Infinite',
        currency: 'XP Pontos',
        color: '#000000',
        initials: 'XP',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 1.5, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 1.5, bonusPercent: 0 },
                ],
                minPoints: 3000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.xpi.com.br/cartao',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.5, bonusPercent: 0 },
                ],
                minPoints: 3000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.xpi.com.br/cartao',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                transferTime: 'Instantâneo',
                url: 'https://www.xpi.com.br/cartao',
            },
        ],
    },
    {
        id: 'c6_carbon',
        name: 'C6 Bank Carbon',
        currency: 'Átomos',
        color: '#222222',
        initials: 'C6',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 2.5, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'tudoazul_clube', label: 'TudoAzul Clube', ratio: 2.5, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
        ],
    },
    {
        id: 'santander_infinite',
        name: 'Santander Infinite',
        currency: 'Esfera',
        color: '#EC0000',
        initials: 'SN',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 2.2, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 2.2, bonusPercent: 20 },
                ],
                minPoints: 4400,
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 2.2, bonusPercent: 0 },
                ],
                minPoints: 4400,
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'tudoazul_clube', label: 'TudoAzul Clube', ratio: 2.2, bonusPercent: 80 },
                    { clubId: null, label: 'Sem clube', ratio: 2.2, bonusPercent: 0 },
                ],
                minPoints: 4400,
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
        ],
    },
    {
        id: 'bradesco_diners',
        name: 'Bradesco / Diners',
        currency: 'Livelo',
        color: '#D40040',
        initials: 'BD',
        partners: [
            {
                program: 'Livelo',
                tiers: [
                    { clubId: 'livelo_turbo', label: 'Livelo Turbo', ratio: 1.0, bonusPercent: 50 },
                    { clubId: null, label: 'Sem programa', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                transferTime: 'Instantâneo',
                url: 'https://www.livelo.com.br',
            },
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 1.0, bonusPercent: 80 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.livelo.com.br',
            },
        ],
    },
    {
        id: 'btg_pactual',
        name: 'BTG Pactual',
        currency: 'BTG+ Pontos',
        color: '#005B99',
        initials: 'BT',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 1.5, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 1.5, bonusPercent: 0 },
                ],
                minPoints: 3000,
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.btgpactual.com/cartao',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.5, bonusPercent: 0 },
                ],
                minPoints: 3000,
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.btgpactual.com/cartao',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                transferTime: 'Instantâneo',
                url: 'https://www.btgpactual.com/cartao',
            },
        ],
    },
    {
        id: 'inter_black',
        name: 'Inter Black / One',
        currency: 'Interpoints',
        color: '#FF6B00',
        initials: 'IN',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Smiles Club ativo', ratio: 1.0, bonusPercent: 100 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                transferTime: 'Até 2 dias úteis',
                url: 'https://inter.co/inter-loop',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                transferTime: 'Até 2 dias úteis',
                url: 'https://inter.co/inter-loop',
            },
        ],
    },
    {
        id: 'porto_seguro',
        name: 'Porto Seguro / Itaú',
        currency: 'Porto+ Pontos',
        color: '#0066CC',
        initials: 'PS',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://portoseguro.com.br',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 2.5, bonusPercent: 0 },
                ],
                minPoints: 5000,
                transferTime: 'Até 5 dias úteis',
                url: 'https://portoseguro.com.br',
            },
        ],
    },
]

// ─── Promoções ativas ─────────────────────────────────────────────────────────
// Atualizar periodicamente com campanhas reais.

export const ACTIVE_PROMOTIONS: TransferPromotion[] = [
    {
        cardId: 'itaucard_personnalite',
        program: 'Smiles',
        bonusPercent: 100,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica',
        isPeriodic: true,
        description: '100% de bônus Itaucard → Smiles com Smiles Club',
        rules: [
            'Válido exclusivamente para assinantes do Smiles Club',
            'Sem Smiles Club: sem bônus (taxa base 2.5:1)',
            'Mínimo de 5.000 pontos por transferência',
            'Transferências em múltiplos de 1.000 pontos',
            'Prazo de crédito: até 5 dias úteis',
            'Não é possível cancelar transferência após confirmação',
        ],
    },
    {
        cardId: 'nubank_ultravioleta',
        program: 'Smiles',
        bonusPercent: 80,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica',
        isPeriodic: true,
        description: '80% de bônus Nubank → Smiles com Smiles Club',
        rules: [
            'Válido para assinantes do Smiles Club',
            'Sem Smiles Club: transferência 1:1 sem bônus',
            'Mínimo de 2.500 Núcleos por transferência',
            'Taxa de câmbio fixa no momento da transferência',
            'Prazo de crédito: até 2 dias úteis',
        ],
    },
    {
        cardId: 'nubank_ultravioleta',
        program: 'TudoAzul',
        bonusPercent: 100,
        clubRequired: 'tudoazul_clube',
        validUntil: 'Campanha periódica',
        isPeriodic: true,
        description: '100% de bônus Nubank → TudoAzul com TudoAzul Clube',
        rules: [
            'Válido apenas para assinantes do TudoAzul Clube',
            'Sem clube: transferência 1:1 sem bônus',
            'Mínimo de 2.500 Núcleos',
            'Prazo de crédito: até 2 dias úteis',
        ],
    },
    {
        cardId: 'santander_infinite',
        program: 'Smiles',
        bonusPercent: 20,
        clubRequired: null,
        validUntil: 'Permanente',
        isPeriodic: false,
        description: '20% de bônus Esfera → Smiles (todos os clientes)',
        rules: [
            'Bônus de 20% disponível para todos os clientes Santander',
            'Assinantes do Smiles Club recebem 100% de bônus',
            'Mínimo de 4.400 pontos Esfera por transferência',
            'Transferências em múltiplos de 4.400 pontos',
            'Prazo de crédito: até 5 dias úteis',
        ],
    },
    {
        cardId: 'xp_visa_infinite',
        program: 'Smiles',
        bonusPercent: 100,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica',
        isPeriodic: true,
        description: '100% de bônus XP → Smiles com Smiles Club',
        rules: [
            'Promoção válida para assinantes do Smiles Club',
            'Taxa base: 1,5 XP Pontos = 1 milha Smiles',
            'Com bônus de 100%: 1,5 XP Pontos = 2 milhas Smiles',
            'Mínimo de 3.000 pontos por transferência',
        ],
    },
    {
        cardId: 'c6_carbon',
        program: 'TudoAzul',
        bonusPercent: 100,
        clubRequired: 'tudoazul_clube',
        validUntil: 'Campanha periódica',
        isPeriodic: true,
        description: '100% de bônus C6 Bank → TudoAzul com TudoAzul Clube',
        rules: [
            'Válido para assinantes do TudoAzul Clube',
            'Taxa base: 2,5 Átomos = 1 ponto TudoAzul',
            'Com bônus: dobro de pontos na transferência',
            'Mínimo de 5.000 Átomos',
        ],
    },
    {
        cardId: 'btg_pactual',
        program: 'Smiles',
        bonusPercent: 100,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica',
        isPeriodic: true,
        description: '100% de bônus BTG → Smiles com Smiles Club',
        rules: [
            'Válido para assinantes do Smiles Club',
            'Taxa base: 1,5 BTG+ Pontos = 1 milha',
            'Com bônus: 1,5 BTG+ Pontos = 2 milhas',
            'Mínimo de 3.000 pontos BTG+',
            'Prazo de crédito: até 3 dias úteis',
        ],
    },
]

// ─── Rotas de referência ──────────────────────────────────────────────────────

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
        programs: ['Smiles', 'LATAM Pass', 'TudoAzul'],
    },
    {
        id: 'dom_medium',
        label: 'Doméstico médio',
        description: 'Voos de 2h a 3h30',
        icon: '✈️',
        example: 'GRU ↔ SSA / GRU ↔ FOR',
        economy: 10000,
        business: 25000,
        cashBRL: 780,
        programs: ['Smiles', 'LATAM Pass', 'TudoAzul'],
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
        programs: ['Smiles', 'LATAM Pass', 'TudoAzul'],
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

/** Calcula milhas resultantes dado pontos, ratio e bônus% */
export function computeMiles(points: number, ratio: number, bonusPercent: number): number {
    const base = Math.floor(points / ratio)
    return Math.floor(base * (1 + bonusPercent / 100))
}

/** Encontra promoção ativa para um par cartão+programa */
export function findPromotion(cardId: string, program: string): TransferPromotion | null {
    return ACTIVE_PROMOTIONS.find(p => p.cardId === cardId && p.program === program) ?? null
}

/** Avalia CPM (centavos por milha) */
export function rateCPM(cpm: number): { label: string; color: string; rating: string } {
    if (cpm >= 4.0) return { label: 'Excelente', color: '#6366F1', rating: 'excelente' }
    if (cpm >= 2.5) return { label: 'Bom', color: '#16A34A', rating: 'bom' }
    if (cpm >= 1.5) return { label: 'Razoável', color: '#F59E0B', rating: 'ok' }
    return { label: 'Abaixo do ideal', color: '#EF4444', rating: 'ruim' }
}
