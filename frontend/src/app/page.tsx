'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useDebateStream } from '@/hooks/useDebateStream'
import { MainLayout } from '@/components/MainLayout'
import { AgentCard } from '@/components/AgentCard'
import { VerdictCard } from '@/components/VerdictCard'
import { ProgressStepper } from '@/components/ProgressStepper'
import { AgentRole } from '@/lib/agentTheme'
import { Send, Sparkles, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

const AGENT_ORDER: AgentRole[] = ['logic', 'emotion', 'risk', 'pleasure']

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const { user } = useAuth()
  const { startDebate, turns, verdict, status, error, currentRound, nextAction, resetDebate } = useDebateStream()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim().length < 5) return
    startDebate(question)
  }

  const handleNewDecision = () => {
    resetDebate()
    setQuestion('')
    router.push('/')
  }

  // To view history if desired after complete:
  // if (status === 'completed' && sessionId) { ... can provide a link ... }

  return (
    <MainLayout onNewDecision={handleNewDecision}>
      <main className="min-h-screen py-12 px-4 md:px-8 max-w-[1600px] mx-auto relative flex flex-col">
        {/* Header */}
        <header className="mb-12 flex justify-between items-center bg-black/20 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">COUNCIL OF SELF</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-300 text-sm hidden md:inline-block">{user?.email}</span>
            {user?.email === 'admin@example.com' /* Or rely on role if exposed */ && (
              <button
                onClick={() => router.push('/admin')}
                className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                Admin
              </button>
            )}
          </div>
        </header>

        {/* Input Phase */}
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full pb-20"
            >
              <div className="text-center mb-10">
                <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-rose-400 to-amber-400 mb-4 drop-shadow-sm">
                  Bạn đang phân vân điều gì?
                </h2>
                <p className="text-lg text-slate-300">
                  Hội đồng cố vấn sẽ phân tích quyết định của bạn từ 4 góc nhìn khác biệt.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="w-full relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-rose-500/20 to-amber-500/20 rounded-2xl blur-lg group-hover:opacity-100 transition duration-1000 opacity-70"></div>
                <div className="relative bg-white/5 backdrop-blur-2xl border border-white/20 rounded-2xl p-2 shadow-2xl shadow-black/40">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full h-40 bg-transparent text-white p-4 pb-16 resize-none focus:outline-none text-lg"
                  />
                  <div className="absolute bottom-4 right-4 flex items-center gap-3">
                    <span className="text-sm text-slate-400">
                      {question.length} {question.length > 0 && question.length < 5 ? '(Tối thiểu 5 ký tự)' : ''}
                    </span>
                    <button
                      type="submit"
                      disabled={question.length < 5}
                      className="p-3 bg-white text-slate-900 rounded-full hover:bg-slate-200 hover:scale-[1.05] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}

          {/* Debate Phase */}
          {status !== 'idle' && (
            <motion.div
              key="debate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col space-y-8"
            >
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">Vấn đề: {question}</h2>
                {status !== 'error' && status !== 'completed' && (
                  <p className="text-slate-400 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Đang thảo luận
                  </p>
                )}
              </div>

              {/* Progress Stepper & Error handling */}
              {status !== 'completed' && (
                <ProgressStepper
                  currentRound={currentRound}
                  status={status}
                  nextAction={nextAction}
                  error={error}
                />
              )}

              {/* 4 Agent Columns */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 flex-1 min-h-[400px]">
                {AGENT_ORDER.map(role => {
                  // Find the latest turn for this agent
                  const agentTurns = turns.filter(t => t.role === role);
                  const latestTurn = agentTurns[agentTurns.length - 1];

                  // An agent is thinking if we are streaming, in a round, and they haven't spoken yet in this round
                  const hasSpokenThisRound = latestTurn && latestTurn.round_number === currentRound;
                  const isThinking = status === 'streaming' && !hasSpokenThisRound;

                  return (
                    <AgentCard
                      key={role}
                      role={role}
                      turn={latestTurn}
                      isThinking={isThinking}
                    />
                  )
                })}
              </div>

              {/* Verdict */}
              {verdict && (
                <div className="mt-12 pt-8 pb-12">
                  <VerdictCard verdict={verdict} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </MainLayout>
  )
}
