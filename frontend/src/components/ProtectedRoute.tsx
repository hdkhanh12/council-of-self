'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
      } else if (requireAdmin) {
        // Simple client-side guard for admin. We verify role in API, 
        // but here we just do a quick fetch to /api/auth/me to verify role if needed,
        // or just assume if backend returns 403, we handle it.
        // For a more robust check, we fetch role here:
        const checkRole = async () => {
          try {
            const { fetchWithAuth } = await import('@/lib/apiClient')
            const res = await fetchWithAuth('/api/auth/me')
            const data = await res.json()
            if (data.role !== 'admin') {
              router.push('/')
            }
          } catch {
            router.push('/')
          }
        }
        checkRole()
      }
    }
  }, [user, loading, router, requireAdmin, pathname])

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100"><div className="animate-pulse">Loading...</div></div>
  }

  return <>{children}</>
}
