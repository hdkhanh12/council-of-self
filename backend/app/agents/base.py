from __future__ import annotations
 
from typing import Literal
from pydantic import BaseModel
 
 
class AgentConfig(BaseModel):
    role_id: str
    display_name: str
    system_prompt: str
    temperature: float
    model_tier: Literal["light", "strong"]
    max_tokens: int = 180
 