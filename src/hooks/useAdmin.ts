import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface UseAdminResult {
    isAdmin: boolean
    loading: boolean
}

export function useAdmin(): UseAdminResult {
    const { user } = useAuth()
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) { setIsAdmin(false); setLoading(false); return }
        setLoading(true)
        supabase
            .from('user_profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                setIsAdmin(data?.is_admin === true)
                setLoading(false)
            })
    }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    return { isAdmin, loading }
}
