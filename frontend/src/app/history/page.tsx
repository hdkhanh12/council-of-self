'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionHistory } from '@/hooks/useSessionHistory'
import { MainLayout } from '@/components/MainLayout'
import { Clock, ArrowRight, Loader2, Sparkles, Home } from 'lucide-react'

export default function HistoryPage() {
  const router = useRouter()
  const { sessions, loading, error, fetchSessions } = useSessionHistory()

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  return (
    <MainLayout>
      <main className="min-h-screen py-12 px-4 md:px-8 max-w-[1200px] mx-auto flex flex-col">
        {/* Header */}
        <header className="mb-12 flex justify-between items-center bg-black/20 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300"
            >
              <Home className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-white/20" />
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl font-bold text-white tracking-wide">Lịch sử phiên</h1>
            </div>
          </div>
        </header>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-200">
            {error}
          </div>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p>Bạn chưa có phiên tranh luận nào.</p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <div 
                key={session.session_id} 
                onClick={() => router.push(`/debate/${session.session_id}`)}
                className="bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all rounded-2xl p-6 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-slate-100 mb-2 line-clamp-2">{session.question}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        session.status === 'completed' ? 'bg-green-400' :
                        session.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                      }`} />
                      {session.status}
                    </span>
                    <span>•</span>
                    <span>{session.total_tokens_used} tokens</span>
                    <span>•</span>
                    <span>{(session.total_latency_ms / 1000).toFixed(1)}s</span>
                  </div>
                </div>
                
                <div className="p-3 bg-white/5 group-hover:bg-blue-500/20 rounded-xl transition-colors">
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </MainLayout>
  )
}
