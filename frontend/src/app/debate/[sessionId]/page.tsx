'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSessionHistory } from '@/hooks/useSessionHistory'
import { MainLayout } from '@/components/MainLayout'
import { AgentCard } from '@/components/AgentCard'
import { VerdictCard } from '@/components/VerdictCard'
import { AgentRole } from '@/lib/agentTheme'
import { Sparkles, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'

const AGENT_ORDER: AgentRole[] = ['logic', 'emotion', 'risk', 'pleasure']

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  
  const { currentSession, loading, error, fetchSessionDetail } = useSessionHistory()

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetail(sessionId)
    }
  }, [sessionId, fetchSessionDetail])

  return (
    <MainLayout>
      <main className="min-h-screen py-12 px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col">
        {/* Header */}
        <header className="mb-12 flex justify-between items-center bg-black/20 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/history')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-white/20" />
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl font-bold text-white tracking-wide">Chi tiết Phiên</h1>
            </div>
          </div>
        </header>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 max-w-2xl mx-auto w-full">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {currentSession && !loading && (
          <div className="flex-1 flex flex-col space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white mb-2">Vấn đề: {currentSession.question}</h2>
              <p className="text-slate-400 flex items-center justify-center gap-2">
                Trạng thái: {currentSession.status} • Độ trễ tổng: {(currentSession.total_latency_ms / 1000).toFixed(1)}s • Tổng Token: {currentSession.total_tokens_used}
              </p>
            </div>

            {/* 4 Agent Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 flex-1 min-h-[400px]">
              {AGENT_ORDER.map(role => {
                const agentTurns = currentSession.turns.filter(t => t.role === role);
                const latestTurn = agentTurns[agentTurns.length - 1];
                return (
                  <AgentCard 
                    key={role} 
                    role={role} 
                    turn={latestTurn} 
                    isThinking={false} 
                  />
                )
              })}
            </div>

            {/* Verdict */}
            {currentSession.verdict && (
              <div className="mt-12 pt-8 pb-12">
                <VerdictCard verdict={currentSession.verdict} />
              </div>
            )}
          </div>
        )}
      </main>
    </MainLayout>
  )
}
