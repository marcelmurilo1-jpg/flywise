import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function useNotificationSurvey() {
  const { user } = useAuth()
  const [shouldShow, setShouldShow] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        // Mostra o survey apenas se o usuário ainda não configurou
        setShouldShow(!data)
        setIsLoading(false)
      })
  }, [user])

  const dismiss = () => setShouldShow(false)

  return { shouldShow, isLoading, dismiss }
}
