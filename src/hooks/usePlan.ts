import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PLAN_LIMITS, getStrategyLimit, getRoteiroLimit, normalizePlan, type Plan } from '@/lib/planLimits'

export interface UsePlanResult {
    plan: Plan
    planExpiresAt: string | null
    strategiesUsed: number
    roteiroUsed: number
    loading: boolean
    canGenerateStrategy: boolean
    canGenerateRoteiro: boolean
    strategyLimit: number
    roteiroLimit: number
    /** Re-fetches usage counts (call after generating a strategy or roteiro) */
    refresh: () => void
}

const TEST_EMAILS = ['teste@gmail.com']

export function usePlan(): UsePlanResult {
    const { user } = useAuth()
    const [plan, setPlan] = useState<Plan>('free')
    const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null)
    const [strategiesUsed, setStrategiesUsed] = useState(0)
    const [roteiroUsed, setRoteiroUsed] = useState(0)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        if (!user) { setLoading(false); return }
        setLoading(true)
        try {
            const now = new Date()
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

            const [profileRes, strategiesAllRes, strategiesMonthRes, roteiroRes] = await Promise.all([
                supabase
                    .from('user_profiles')
                    .select('plan, plan_expires_at')
                    .eq('id', user.id)
                    .single(),
                supabase
                    .from('strategies')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id),
                supabase
                    .from('strategies')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .gte('created_at', monthStart),
                supabase
                    .from('itineraries')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .gte('created_at', monthStart),
            ])

            // Determine effective plan (downgrade to free if expired)
            const rawPlan = normalizePlan(profileRes.data?.plan)
            const expiresAt = profileRes.data?.plan_expires_at ?? null
            const isExpired = expiresAt != null && new Date(expiresAt) < now
            const effectivePlan: Plan = isExpired ? 'free' : rawPlan

            // For free: count all-time strategies; for paid: count this month
            const stratCount = effectivePlan === 'free'
                ? (strategiesAllRes.count ?? 0)
                : (strategiesMonthRes.count ?? 0)

            setPlan(effectivePlan)
            setPlanExpiresAt(expiresAt)
            setStrategiesUsed(stratCount)
            setRoteiroUsed(roteiroRes.count ?? 0)
        } finally {
            setLoading(false)
        }
    }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load() }, [load])

    // Test account bypass — always elite with unlimited usage
    if (user?.email && TEST_EMAILS.includes(user.email)) {
        return {
            plan: 'elite',
            planExpiresAt: null,
            strategiesUsed: 0,
            roteiroUsed: 0,
            loading: false,
            canGenerateStrategy: true,
            canGenerateRoteiro: true,
            strategyLimit: 9999,
            roteiroLimit: 9999,
            refresh: load,
        }
    }

    const strategyLimit = getStrategyLimit(plan)
    const roteiroLimit = getRoteiroLimit(plan)
    const limits = PLAN_LIMITS[plan]

    return {
        plan,
        planExpiresAt,
        strategiesUsed,
        roteiroUsed,
        loading,
        canGenerateStrategy: strategiesUsed < strategyLimit,
        canGenerateRoteiro: limits.roteiroPerMonth > 0 && roteiroUsed < roteiroLimit,
        strategyLimit,
        roteiroLimit,
        refresh: load,
    }
}
