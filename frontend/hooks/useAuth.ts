'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { userApi, type User } from '@/lib/api'

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    userApi.profile()
      .then(u => { setUser(u); setLoading(false) })
      .catch(() => { router.push('/auth/signin'); setLoading(false) })
  }, [router])

  return { user, loading, setUser }
}
