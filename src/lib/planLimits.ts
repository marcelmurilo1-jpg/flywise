export type Plan = 'free' | 'essencial' | 'pro' | 'elite'

export interface PlanConfig {
    label: string
    /** Max strategies ever (only for free). null = use strategiesPerMonth */
    strategiesLifetime: number | null
    /** Max strategies per month (paid plans). null = use strategiesLifetime */
    strategiesPerMonth: number | null
    roteiroPerMonth: number
    notifications: boolean
    unlimitedSearch: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanConfig> = {
    free: {
        label: 'Free',
        strategiesLifetime: 1,
        strategiesPerMonth: null,
        roteiroPerMonth: 0,
        notifications: false,
        unlimitedSearch: false,
    },
    essencial: {
        label: 'Essencial',
        strategiesLifetime: null,
        strategiesPerMonth: 3,
        roteiroPerMonth: 1,
        notifications: false,
        unlimitedSearch: true,
    },
    pro: {
        label: 'Pro',
        strategiesLifetime: null,
        strategiesPerMonth: 5,
        roteiroPerMonth: 3,
        notifications: true,
        unlimitedSearch: true,
    },
    elite: {
        label: 'Elite',
        strategiesLifetime: null,
        strategiesPerMonth: 10,
        roteiroPerMonth: 5,
        notifications: true,
        unlimitedSearch: true,
    },
}

export function getStrategyLimit(plan: Plan): number {
    const cfg = PLAN_LIMITS[plan]
    return cfg.strategiesLifetime ?? cfg.strategiesPerMonth ?? 0
}

export function getRoteiroLimit(plan: Plan): number {
    return PLAN_LIMITS[plan].roteiroPerMonth
}

export function normalizePlan(raw: string | null | undefined): Plan {
    const valid: Plan[] = ['free', 'essencial', 'pro', 'elite']
    const lower = (raw ?? '').toLowerCase() as Plan
    return valid.includes(lower) ? lower : 'free'
}
