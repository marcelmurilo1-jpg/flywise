export type Plan = 'free' | 'essencial' | 'pro' | 'elite' | 'admin'

export interface PlanConfig {
    label: string
    /** Max strategies ever (only for free). null = use strategiesPerMonth */
    strategiesLifetime: number | null
    /** Max strategies per month (paid plans). null = use strategiesLifetime */
    strategiesPerMonth: number | null
    roteiroPerMonth: number
    notifications: boolean
    unlimitedSearch: boolean
    transferSimulator: boolean
    watchlistSlots: number
}

export const PLAN_LIMITS: Record<Plan, PlanConfig> = {
    admin: {
        label: 'Admin',
        strategiesLifetime: null,
        strategiesPerMonth: null,
        roteiroPerMonth: 999,
        notifications: true,
        unlimitedSearch: true,
        transferSimulator: true,
        watchlistSlots: 999,
    },
    free: {
        label: 'Free',
        strategiesLifetime: 1,
        strategiesPerMonth: null,
        roteiroPerMonth: 0,
        notifications: false,
        unlimitedSearch: false,
        transferSimulator: false,
        watchlistSlots: 0,
    },
    essencial: {
        label: 'Essencial',
        strategiesLifetime: null,
        strategiesPerMonth: 3,
        roteiroPerMonth: 1,
        notifications: false,
        unlimitedSearch: true,
        transferSimulator: false,
        watchlistSlots: 3,
    },
    pro: {
        label: 'Pro',
        strategiesLifetime: null,
        strategiesPerMonth: 5,
        roteiroPerMonth: 3,
        notifications: true,
        unlimitedSearch: true,
        transferSimulator: true,
        watchlistSlots: 10,
    },
    elite: {
        label: 'Elite',
        strategiesLifetime: null,
        strategiesPerMonth: 10,
        roteiroPerMonth: 5,
        notifications: true,
        unlimitedSearch: true,
        transferSimulator: true,
        watchlistSlots: 999,
    },
}

export function getStrategyLimit(plan: Plan): number {
    const cfg = PLAN_LIMITS[plan]
    // null on both = unlimited (admin)
    if (cfg.strategiesLifetime === null && cfg.strategiesPerMonth === null) return 9999
    return cfg.strategiesLifetime ?? cfg.strategiesPerMonth ?? 0
}

export function getRoteiroLimit(plan: Plan): number {
    return PLAN_LIMITS[plan].roteiroPerMonth
}

export function normalizePlan(raw: string | null | undefined): Plan {
    const valid: Plan[] = ['free', 'essencial', 'pro', 'elite', 'admin']
    const lower = (raw ?? '').toLowerCase() as Plan
    return valid.includes(lower) ? lower : 'free'
}

export function getWatchlistLimit(plan: Plan): number {
    return PLAN_LIMITS[plan].watchlistSlots
}
