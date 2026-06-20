export type AgentRole = 'logic' | 'emotion' | 'risk' | 'pleasure' | 'moderator';

export const agentThemes: Record<AgentRole, {
  bg: string;
  border: string;
  text: string;
  glow: string;
  iconColor: string;
}> = {
  logic: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-100',
    glow: 'shadow-[0_0_15px_rgba(74,144,217,0.3)]',
    iconColor: 'text-blue-400',
  },
  emotion: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-100',
    glow: 'shadow-[0_0_15px_rgba(224,122,158,0.3)]',
    iconColor: 'text-rose-400',
  },
  risk: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-100',
    glow: 'shadow-[0_0_15px_rgba(217,162,74,0.3)]',
    iconColor: 'text-amber-400',
  },
  pleasure: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-100',
    glow: 'shadow-[0_0_15px_rgba(122,201,122,0.3)]',
    iconColor: 'text-green-400',
  },
  moderator: {
    bg: 'bg-slate-200/10',
    border: 'border-slate-300/40',
    text: 'text-slate-100',
    glow: 'shadow-[0_0_20px_rgba(255,255,255,0.2)]',
    iconColor: 'text-slate-200',
  }
};
