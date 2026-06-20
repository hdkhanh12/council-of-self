"""
Pydantic schemas dùng chung giữa orchestrator, API layer, và DB layer.
"""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class DebateRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)


class Turn(BaseModel):
    role: str
    display_name: str
    content: str
    round_number: int
    is_fallback: bool = False
    tokens_input: int = 0
    tokens_output: int = 0
    latency_ms: int = 0


class ConditionalRecommendation(BaseModel):
    if_priority: str
    then_lean_towards: str


class VerdictSchema(BaseModel):
    summary_per_agent: dict[str, str]
    consensus_points: list[str]
    core_conflict: str
    conditional_recommendation: list[ConditionalRecommendation]
    reversibility_flag: Literal["reversible", "partially_reversible", "irreversible"]
    confidence_in_synthesis: float = Field(..., ge=0.0, le=1.0)
    extended_narrative: str = Field(..., min_length=50)


class SessionDetail(BaseModel):
    session_id: str
    question: str
    status: Literal["in_progress", "completed", "failed", "timeout"]
    turns: list[Turn]
    verdict: VerdictSchema | None = None
    total_tokens_used: int = 0
    total_latency_ms: int = 0