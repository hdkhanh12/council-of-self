export interface Turn {
  role: 'logic' | 'emotion' | 'risk' | 'pleasure' | 'moderator' | string;
  display_name: string;
  content: string;
  round_number: number;
  is_fallback: boolean;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number;
}

export interface ConditionalRecommendation {
  if_priority: string;
  then_lean_towards: string;
}

export interface VerdictSchema {
  summary_per_agent: Record<string, string>;
  consensus_points: string[];
  core_conflict: string;
  conditional_recommendation: ConditionalRecommendation[];
  reversibility_flag: 'reversible' | 'partially_reversible' | 'irreversible';
  confidence_in_synthesis: number;
  extended_narrative: string;
}

export interface SessionDetail {
  session_id: string;
  question: string;
  status: 'in_progress' | 'completed' | 'failed' | 'timeout';
  turns: Turn[];
  verdict: VerdictSchema | null;
  total_tokens_used: number;
  total_latency_ms: number;
}
