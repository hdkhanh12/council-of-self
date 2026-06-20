'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionHistory } from '@/hooks/useSessionHistory'
import { useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: React.ReactNode;
  onNewDecision?: () => void;
}

export function MainLayout({ children, onNewDecision }: MainLayoutProps) {
  const [isOpen, setIsOpen] = useState(true)
  const router = useRouter()
  const { sessions, fetchSessions, loading } = useSessionHistory()
  const { logout } = useAuth()

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleNewDecision = () => {
    if (onNewDecision) {
      onNewDecision()
    } else {
      router.push('/')
    }
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen relative overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="relative z-20 flex-shrink-0 border-r border-white/10 bg-black/20 backdrop-blur-xl flex flex-col"
            >
              <div className="p-4 w-[320px] flex flex-col h-full">
                {/* New Decision Button */}
                <button
                  onClick={handleNewDecision}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all duration-300 py-3 rounded-xl font-semibold shadow-[0_0_15px_rgba(79,70,229,0.3)] mb-6"
                >
                  Câu hỏi mới
                </button>

                <div className="flex items-center gap-2 mb-4 px-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Lịch sử phiên
                  </h3>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {loading ? (
                    <div className="text-sm text-slate-500 italic px-2">Đang tải...</div>
                  ) : sessions.length === 0 ? (
                    <div className="text-sm text-slate-500 italic px-2">Chưa có phiên nào.</div>
                  ) : (
                    sessions.slice(0, 50).map((session) => (
                      <div
                        key={session.session_id}
                        onClick={() => router.push(`/debate/${session.session_id}`)}
                        className="group p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] transition-all duration-200 cursor-pointer flex items-start gap-3"
                      >
                        <div className="mt-0.5">
                          {session.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : session.status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">
                            {session.question}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Logout Button */}
                <div className="pt-4 mt-auto border-t border-white/10">
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-all duration-300 py-2.5 rounded-xl font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "absolute z-30 top-6 w-8 h-12 flex items-center justify-center bg-white/10 border border-white/20 backdrop-blur-md rounded-r-xl hover:bg-white/20 hover:w-10 transition-all duration-300",
            isOpen ? "left-[320px]" : "left-0"
          )}
        >
          {isOpen ? <ChevronLeft className="w-5 h-5 text-slate-300" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
        </button>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto relative h-screen">
          {children}
        </div>
      </div>
    </ProtectedRoute>
  )
}
