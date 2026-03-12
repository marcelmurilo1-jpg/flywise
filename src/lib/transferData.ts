// ─── Transfer Data ────────────────────────────────────────────────────────────
// Taxas e programas baseados em dados oficiais dos bancos/programas (mar/2026).
// Promoções são campanhas periódicas — atualizar conforme novos anúncios.
//
// IMPORTANTE sobre ratios:
//   ratio = quantos pontos do cartão para 1 milha/ponto no programa destino.
//   Ex: ratio 1.0 → 1.000 pontos do cartão = 1.000 milhas (1:1)
//       ratio 2.5 → 2.500 pontos do cartão = 1.000 milhas
//
// A maioria dos programas modernos (Iupp, C6, Nubank, Esfera) opera em 1:1.

export interface TransferTier {
    clubId: string | null       // null = sem clube necessário
    label: string
    ratio: number               // pontos cartão por 1 milha
    bonusPercent: number        // bônus adicional em campanhas
}

export interface TransferPartner {
    program: string
    tiers: TransferTier[]       // melhor tier primeiro
    minPoints: number
    minPointsLabel: string      // formatado para exibição
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

export interface MilesClub {
    id: string
    name: string
    program: string
    color: string
    monthlyFee: string
    description: string
    benefits: string[]
    tiers?: { name: string; monthlyFee: string; bonus: string }[]
}

export interface TransferPromotion {
    cardId: string
    program: string
    bonusPercent: number        // para não-clube
    clubBonusPercent: number    // para assinantes do clube
    clubRequired: string | null
    validUntil: string
    description: string
    isPeriodic: boolean
    lastConfirmed: string       // data da última confirmação oficial
    rules: string[]
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
        monthlyFee: 'A partir de R$ 39,90/mês',
        description: 'Assinatura mensal da Smiles com compra garantida de milhas + bônus diferencial em promoções de transferência',
        tiers: [
            { name: 'Plano 1.000 mi', monthlyFee: '~R$ 39,90/mês', bonus: 'Bônus diferencial em promos' },
            { name: 'Plano 2.000 mi', monthlyFee: '~R$ 69,90/mês', bonus: 'Bônus diferencial em promos' },
            { name: 'Plano 5.000 mi', monthlyFee: '~R$ 149,90/mês', bonus: 'Bônus diferencial em promos' },
            { name: 'Plano 10.000 mi', monthlyFee: '~R$ 259,90/mês', bonus: 'Bônus diferencial + lounge' },
            { name: 'Plano 20.000 mi / Diamante', monthlyFee: '~R$ 449,90/mês', bonus: 'Máximo bônus em promos' },
        ],
        benefits: [
            'Milhas garantidas todo mês (1.000 a 20.000 conforme plano)',
            'Bônus diferencial em promoções de transferência de cartão',
            'Compra de milhas com desconto',
            'Acesso a tarifas exclusivas de resgate',
            'Clientes Diamante recebem bônus máximo em campanhas',
        ],
    },
    {
        id: 'azul_fidelidade_clube',
        name: 'Clube Azul Fidelidade',
        program: 'TudoAzul',
        color: '#003DA5',
        monthlyFee: 'A partir de R$ 35,00/mês',
        description: 'Assinatura do Azul Fidelidade com pontos mensais + bônus progressivo por tempo de assinatura',
        tiers: [
            { name: 'Plano 1.000 pts (6+ meses)', monthlyFee: '~R$ 35,00/mês', bonus: '+5% em transferências' },
            { name: 'Plano 1.000–5.000 pts (12+ meses)', monthlyFee: 'R$ 35–149/mês', bonus: '+10% em transferências' },
            { name: 'Plano 10.000–20.000 pts (12+ meses)', monthlyFee: 'R$ 250–449/mês', bonus: '+20% em transferências' },
            { name: '5+ anos de assinatura', monthlyFee: 'Plano ativo', bonus: '+30% a +133% em promos especiais' },
        ],
        benefits: [
            'Pontos mensais garantidos (1.000 a 20.000)',
            'Bônus progressivo por tempo de assinatura (5%, 10% ou 20%)',
            'Bônus de até 133% durante campanhas Livelo (assinantes 5+ anos)',
            'Pontos não expiram com assinatura ativa',
            'Resgate a partir de 5.000 pontos',
        ],
    },
    {
        id: 'latam_pass_status',
        name: 'LATAM Pass Silver/Gold/Black',
        program: 'LATAM Pass',
        color: '#E3000F',
        monthlyFee: 'Obtido por voos (sem custo direto)',
        description: 'Status de elite da LATAM obtido por quilometragem voada — concede bônus de acúmulo e benefícios premium',
        tiers: [
            { name: 'Silver', monthlyFee: '6.000 QV/ano', bonus: '+50% em acúmulo de pontos' },
            { name: 'Gold', monthlyFee: '12.000 QV/ano', bonus: '+75% em acúmulo de pontos' },
            { name: 'Black', monthlyFee: '24.000 QV/ano', bonus: '+100% em acúmulo de pontos' },
            { name: 'Black Signature', monthlyFee: '50.000 QV/ano', bonus: '+125% em acúmulo + benefícios premium' },
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
        monthlyFee: 'Gratuito (via banco parceiro)',
        description: 'Programa de benefícios Livelo com transferência imediata gratuita e acesso a promoções exclusivas de parceiros',
        benefits: [
            'Transferência imediata para Smiles e Azul Fidelidade (sem aguardar 72h)',
            'Acesso a promoções exclusivas de bônus',
            'Pontos nunca expiram',
            'Resgate em produtos, passagens e experiências',
            'Parceria com Bradesco, Santander e Banco do Brasil',
        ],
    },
]

// ─── Cartões ─────────────────────────────────────────────────────────────────
// Ratios corrigidos — fontes: Passageiro de Primeira, Melhores Destinos (mar/2026)
// Iupp (Itaú), C6 Átomos, Nubank, Esfera (Santander): transferência 1:1

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
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.itau.com.br/cartoes/iupp',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: 'latam_pass_status', label: 'LATAM Black', ratio: 1.0, bonusPercent: 100 },
                    { clubId: null, label: 'Sem status', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://latampass.latam.com/pt_br/promocao/itau-milhas-extras',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 20 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.itau.com.br/cartoes/iupp',
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
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 2500,
                minPointsLabel: '2.500 Núcleos',
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                minPointsLabel: '2.500 Núcleos',
                transferTime: 'Até 2 dias úteis',
                url: 'https://nubank.com.br/nucleo',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 20 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 2500,
                minPointsLabel: '2.500 Núcleos',
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
                minPoints: 1000,
                minPointsLabel: '1.000 Átomos',
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
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 20 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 Átomos',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.c6bank.com.br/atomos',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 Átomos',
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
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube (promo permanente)', ratio: 1.0, bonusPercent: 20 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts Esfera',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts Esfera',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 20 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts Esfera',
                transferTime: 'Até 5 dias úteis',
                url: 'https://esfera.com.vc',
            },
        ],
    },
    {
        id: 'xp_visa',
        name: 'XP Visa Infinite',
        currency: 'XP Pontos',
        color: '#000000',
        initials: 'XP',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.xpi.com.br/cartao',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://www.xpi.com.br/cartao',
            },
        ],
    },
    {
        id: 'bradesco_livelo',
        name: 'Bradesco / Banco do Brasil',
        currency: 'Pontos Livelo',
        color: '#D40040',
        initials: 'BD',
        partners: [
            {
                program: 'Livelo',
                tiers: [
                    { clubId: 'livelo_clube', label: 'Clube Livelo (via banco)', ratio: 1.0, bonusPercent: 0 },
                    { clubId: null, label: 'Acúmulo padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 15000,
                minPointsLabel: '15.000 pts',
                transferTime: 'Imediato (Clube) ou até 72h',
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
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Promo ativa (25% bônus)', ratio: 1.0, bonusPercent: 25 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 3 dias úteis',
                url: 'https://latampass.latam.com/pt_br/junte-milhas',
            },
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.btgpactual.com/cartao',
            },
            {
                program: 'Livelo',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 3 dias úteis',
                url: 'https://www.livelo.com.br',
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
                program: 'TudoAzul',
                tiers: [
                    { clubId: 'azul_fidelidade_clube', label: 'Clube Azul Fidelidade', ratio: 1.0, bonusPercent: 130 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 80 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 2 dias úteis',
                url: 'https://inter.co/inter-loop',
            },
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 2 dias úteis',
                url: 'https://inter.co/inter-loop',
            },
        ],
    },
    {
        id: 'caixa_uau',
        name: 'Caixa Econômica (UAU)',
        currency: 'Pontos UAU',
        color: '#00529B',
        initials: 'CX',
        partners: [
            {
                program: 'Smiles',
                tiers: [
                    { clubId: 'smiles_club', label: 'Clube Smiles ativo', ratio: 1.0, bonusPercent: 60 },
                    { clubId: null, label: 'Sem clube', ratio: 1.0, bonusPercent: 30 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://uau.caixa.gov.br',
            },
            {
                program: 'LATAM Pass',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://uau.caixa.gov.br',
            },
            {
                program: 'TudoAzul',
                tiers: [
                    { clubId: null, label: 'Taxa padrão', ratio: 1.0, bonusPercent: 0 },
                ],
                minPoints: 1000,
                minPointsLabel: '1.000 pts',
                transferTime: 'Até 5 dias úteis',
                url: 'https://uau.caixa.gov.br',
            },
        ],
    },
]

// ─── Livelo como HUB de transferência ────────────────────────────────────────
// Pontos Livelo → programas aéreos na proporção 1:1 (nacional)
// Mínimo: 15.000 pontos Livelo por transferência

export const LIVELO_AIRLINE_PARTNERS = [
    { program: 'Smiles', ratio: 1.0, minPoints: 15000, label: 'Livelo → Smiles (1:1)' },
    { program: 'LATAM Pass', ratio: 1.0, minPoints: 15000, label: 'Livelo → LATAM Pass (1:1)' },
    { program: 'TudoAzul', ratio: 1.0, minPoints: 15000, label: 'Livelo → Azul Fidelidade (1:1)' },
]

// ─── Promoções periódicas ─────────────────────────────────────────────────────
// Baseado em campanhas recentes (ago/2024 – mar/2026).
// Estas campanhas se repetem com frequência, geralmente com 30–60 dias de intervalo.
// ⚠️ SEMPRE confirme na página oficial antes de transferir.

export const ACTIVE_PROMOTIONS: TransferPromotion[] = [
    {
        cardId: 'iupp_itau',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos e 60% para Clube Smiles — Itaú → Smiles',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir — sem cadastro, sem bônus',
            'Clientes sem clube: 30% de bônus sobre a transferência',
            'Assinantes do Clube Smiles (qualquer plano) ou Diamante: 60% de bônus',
            'Limite de 300.000 milhas bônus por CPF ou Conta Família',
            'Milhas bônus creditadas em até 15 dias após encerramento da campanha',
            'Validade das milhas bônus: 12 meses após creditação',
            'Não é possível cancelar a transferência após confirmação',
        ],
    },
    {
        cardId: 'nubank_ultravioleta',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos e 60% para Clube Smiles — Nubank → Smiles',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir',
            'Sem cadastro prévio = sem bônus (sem exceções)',
            'Mínimo de 2.500 Núcleos por transferência',
            'Clientes Clube Smiles ou Diamante: 60% de bônus',
            'Limite: 300.000 milhas bônus por CPF',
            'Validade das milhas bônus: 12 meses',
        ],
    },
    {
        cardId: 'c6_atomos',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos e 60% para Clube Smiles — C6 Bank → Smiles',
        rules: [
            '⚠️ Cadastre-se na página da promoção ANTES de transferir',
            'Clientes sem clube: 30% de bônus',
            'Assinantes Clube Smiles ou Diamante: 60% de bônus',
            'Limite: 300.000 milhas bônus por CPF',
            'Prazo de creditação: até 5 dias úteis para a transferência base',
        ],
    },
    {
        cardId: 'santander_esfera',
        program: 'Smiles',
        bonusPercent: 20,
        clubBonusPercent: 60,
        clubRequired: 'smiles_club',
        validUntil: 'Bônus de 20% permanente + campanhas periódicas para clube',
        lastConfirmed: 'Mar/2026',
        isPeriodic: false,
        description: '20% permanente para todos (Esfera) + 60% em promos para Clube Smiles',
        rules: [
            'Bônus de 20% é permanente para todos os clientes Santander via Esfera',
            'Assinantes do Clube Smiles recebem 60% de bônus durante campanhas',
            'Para campanhas extras: cadastre-se na página da promoção antes',
            'Mínimo: 1.000 pontos Esfera por transferência',
            'Prazo de crédito: até 5 dias úteis',
        ],
    },
    {
        cardId: 'xp_visa',
        program: 'Smiles',
        bonusPercent: 30,
        clubBonusPercent: 60,
        clubRequired: 'smiles_club',
        validUntil: 'Campanha periódica (confirme em smiles.com.br)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: true,
        description: 'Bônus de 30% para todos e 60% para Clube Smiles — XP → Smiles',
        rules: [
            '⚠️ Cadastre-se na página da promoção antes de transferir',
            'Mínimo de 1.000 XP Pontos por transferência',
            'Limite: 300.000 milhas bônus por CPF',
        ],
    },
    {
        cardId: 'btg_pactual',
        program: 'LATAM Pass',
        bonusPercent: 25,
        clubBonusPercent: 25,
        clubRequired: null,
        validUntil: 'Campanha periódica (confirme em latampass.latam.com)',
        lastConfirmed: 'Mar/2026 — válido até 05/03/2026',
        isPeriodic: true,
        description: '25% de bônus + 1.000 milhas extras na primeira transferência BTG → LATAM Pass',
        rules: [
            '⚠️ Registre-se na página da promoção antes de transferir',
            'Bônus de 25% válido para todos os clientes BTG Pactual',
            '1.000 milhas extras na primeira transferência do período',
            'Milhas bônus creditadas em até 30 dias',
            'Validade das milhas bônus: 36 meses',
        ],
    },
    {
        cardId: 'inter_black',
        program: 'TudoAzul',
        bonusPercent: 80,
        clubBonusPercent: 130,
        clubRequired: 'azul_fidelidade_clube',
        validUntil: 'Campanha periódica (confirme em tudoazul.voeazul.com.br)',
        lastConfirmed: 'Mar/2026 — válido até 05/03/2026',
        isPeriodic: true,
        description: '80% para todos e até 130% para Clube Azul — Inter → TudoAzul',
        rules: [
            '⚠️ Cadastre-se na página da promoção antes de transferir',
            'Todos os clientes Inter: 80% de bônus',
            'Assinantes do Clube Azul Fidelidade: 103% de bônus',
            'Assinantes há 5+ anos: 130% ou mais de bônus',
            'Limite: 300.000 pontos bônus por CPF',
            'Creditação em até 15 dias úteis',
            'Validade dos pontos bônus: 6 meses',
        ],
    },
    {
        cardId: 'bradesco_livelo',
        program: 'Livelo',
        bonusPercent: 0,
        clubBonusPercent: 0,
        clubRequired: null,
        validUntil: 'Transferência padrão (sem campanha ativa no momento)',
        lastConfirmed: 'Mar/2026',
        isPeriodic: false,
        description: 'Bradesco/BB → Livelo: transferência 1:1, sem bônus atualmente. Da Livelo para aéreas também 1:1.',
        rules: [
            'Transferência de Bradesco/BB para Livelo: taxa 1:1',
            'Depois, de Livelo para Smiles/LATAM/TudoAzul: também 1:1',
            'Mínimo de 15.000 pontos por transferência Livelo → aérea',
            'Transferência imediata disponível para membros do Clube Livelo',
            'Sem bônus de campanha ativo no momento — aguarde promoções periódicas',
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

export function findPromotion(cardId: string, program: string): TransferPromotion | null {
    return ACTIVE_PROMOTIONS.find(p => p.cardId === cardId && p.program === program) ?? null
}

export function rateCPM(cpm: number): { label: string; color: string; rating: string } {
    if (cpm >= 4.0) return { label: 'Excelente', color: '#6366F1', rating: 'excelente' }
    if (cpm >= 2.5) return { label: 'Bom', color: '#16A34A', rating: 'bom' }
    if (cpm >= 1.5) return { label: 'Razoável', color: '#F59E0B', rating: 'ok' }
    return { label: 'Abaixo do ideal', color: '#EF4444', rating: 'ruim' }
}
