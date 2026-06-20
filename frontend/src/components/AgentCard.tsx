import { AgentRole, agentThemes } from '@/lib/agentTheme'
import { Turn } from '@/types/debate'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Heart, ShieldAlert, Sparkles, User, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const icons: Record<AgentRole, React.ReactNode> = {
  logic: <Brain className="w-5 h-5" />,
  emotion: <Heart className="w-5 h-5" />,
  risk: <ShieldAlert className="w-5 h-5" />,
  pleasure: <Sparkles className="w-5 h-5" />,
  moderator: <User className="w-5 h-5" />
}

export function AgentCard({ role, turn, isThinking }: { role: AgentRole, turn?: Turn, isThinking: boolean }) {
  const theme = agentThemes[role]
  const displayName = turn?.display_name || role.toUpperCase()
  const isFallback = turn?.is_fallback

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: (!turn && !isThinking) ? 0.6 : 1, y: 0 }}
      className={cn(
        "relative flex flex-col h-full rounded-2xl border backdrop-blur-md overflow-hidden transition-all duration-500",
        isFallback ? "border-slate-500/50 bg-slate-800/30" : [theme.bg, theme.border],
        isThinking && theme.glow,
        turn && !isThinking && "hover:scale-[1.01] hover:backdrop-blur-xl hover:bg-white/10"
      )}
    >
      {/* Header */}
      <div className={cn("p-4 border-b flex items-center gap-3", isFallback ? "border-slate-500/30 bg-slate-900/50" : [theme.border, "bg-black/10"])}>
        <div className={isFallback ? "text-slate-400" : theme.iconColor}>
          {icons[role]}
        </div>
        <h3 className={cn("font-semibold tracking-wide flex-1", isFallback ? "text-slate-300" : theme.text)}>
          {displayName}
        </h3>
        {isFallback && (
          <div title="Câu trả lời dự phòng do lỗi kết nối" className="flex items-center text-slate-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 overflow-y-auto">
        <AnimatePresence mode="wait">
          {isThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-slate-400 h-full"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className={cn("w-2 h-2 rounded-full", theme.bg.replace('/10', '/50'))}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-sm italic">Đang suy nghĩ...</span>
            </motion.div>
          ) : turn ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn("text-sm leading-relaxed whitespace-pre-wrap", isFallback ? "text-slate-300" : theme.text)}
            >
              {turn.content}
            </motion.div>
          ) : (
            <div className="text-slate-500 italic text-sm">Đang chờ tới lượt...</div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Footer Metrics */}
      {turn && (
        <div className={cn("p-2 border-t text-xs flex justify-between px-4", isFallback ? "bg-slate-900/50 border-slate-500/30 text-slate-400" : ["bg-black/20", theme.border, theme.text])}>
          <span className="opacity-70">
            {turn.latency_ms > 0 ? `${(turn.latency_ms / 1000).toFixed(1)}s` : ''}
          </span>
          <span className="opacity-70">
            {(turn.tokens_input + turn.tokens_output)} tokens
          </span>
        </div>
      )}
    </motion.div>
  )
}
