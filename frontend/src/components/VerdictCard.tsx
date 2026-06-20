import { VerdictSchema } from '@/types/debate'
import { motion } from 'framer-motion'
import { Scale, AlertTriangle, Lock, Unlock, Key, CheckCircle2 } from 'lucide-react'
import { agentThemes, AgentRole } from '@/lib/agentTheme'
import { cn } from '@/lib/utils'

export function VerdictCard({ verdict }: { verdict: VerdictSchema }) {
  const theme = agentThemes.moderator

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "w-full max-w-5xl mx-auto rounded-3xl border backdrop-blur-xl p-8 shadow-2xl transition-all duration-500 hover:scale-[1.01] hover:backdrop-blur-2xl",
        theme.bg, theme.border, theme.glow
      )}
    >
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Quyết định cuối cùng</h2>
            <p className="text-slate-300 mt-1 flex items-center gap-2">
              Độ tin cậy tổng hợp: 
              <span className="font-semibold text-white">{(verdict.confidence_in_synthesis * 100).toFixed(0)}%</span>
            </p>
          </div>
        </div>
        
        {/* Reversibility Badge */}
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium",
          verdict.reversibility_flag === 'irreversible' ? 'bg-red-500/20 border-red-500/50 text-red-200' :
          verdict.reversibility_flag === 'partially_reversible' ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' :
          'bg-green-500/20 border-green-500/50 text-green-200'
        )}>
          {verdict.reversibility_flag === 'irreversible' && <Lock className="w-4 h-4" />}
          {verdict.reversibility_flag === 'partially_reversible' && <Key className="w-4 h-4" />}
          {verdict.reversibility_flag === 'reversible' && <Unlock className="w-4 h-4" />}
          {verdict.reversibility_flag === 'irreversible' ? 'Quyết định không thể đảo ngược' :
           verdict.reversibility_flag === 'partially_reversible' ? 'Có thể đảo ngược một phần' : 
           'Dễ dàng thay đổi sau này'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Consensus */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Điểm đồng thuận
            </h3>
            <ul className="space-y-3">
              {verdict.consensus_points.map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-200 bg-white/5 p-4 rounded-xl border border-white/10">
                  <span className="w-1.5 h-1.5 mt-2 rounded-full bg-green-400 shrink-0" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Core Conflict */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Mâu thuẫn cốt lõi
            </h3>
            <div className="text-slate-200 bg-amber-500/10 p-5 rounded-xl border border-amber-500/20 leading-relaxed">
              {verdict.core_conflict}
            </div>
          </section>

          {/* Conditional Recommendations */}
          {verdict.conditional_recommendation.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-4">Khuyến nghị theo hướng ưu tiên</h3>
              <div className="grid gap-4">
                {verdict.conditional_recommendation.map((rec, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="flex-1">
                      <span className="text-sm text-slate-400 uppercase tracking-wider font-semibold block mb-1">Nếu ưu tiên:</span>
                      <span className="text-slate-200">{rec.if_priority}</span>
                    </div>
                    <div className="hidden md:block w-px h-12 bg-white/10" />
                    <div className="flex-1">
                      <span className="text-sm text-slate-400 uppercase tracking-wider font-semibold block mb-1">Thì nên chọn:</span>
                      <span className="text-white font-medium">{rec.then_lean_towards}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Agent Summaries */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white mb-4">Góc nhìn từng Cố vấn</h3>
          {Object.entries(verdict.summary_per_agent).map(([role, summary]) => {
            const agentTheme = agentThemes[role as AgentRole]
            return (
              <div key={role} className={cn("p-4 rounded-xl border backdrop-blur-sm", agentTheme.bg, agentTheme.border)}>
                <h4 className={cn("text-sm font-bold uppercase tracking-wider mb-2", agentTheme.text)}>
                  {role}
                </h4>
                <p className="text-slate-200 text-sm leading-relaxed">
                  {summary}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Extended Narrative */}
      {verdict.extended_narrative && (
        <div className="mt-8 p-6 bg-white/5 border border-white/20 rounded-2xl backdrop-blur-md shadow-inner">
          <h3 className="text-xl font-semibold text-white mb-4 italic">Lời kết từ Chủ tọa</h3>
          <p className="text-slate-200 text-lg leading-relaxed italic">
            {verdict.extended_narrative}
          </p>
        </div>
      )}
    </motion.div>
  )
}
