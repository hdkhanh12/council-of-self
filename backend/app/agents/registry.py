from app.agents.prompts.logic import LOGIC_SYSTEM_PROMPT
from app.agents.prompts.emotion import EMOTION_SYSTEM_PROMPT
from app.agents.prompts.risk import RISK_SYSTEM_PROMPT
from app.agents.prompts.pleasure import PLEASURE_SYSTEM_PROMPT
from app.agents.prompts.moderator import MODERATOR_SYSTEM_PROMPT
from app.agents.base import AgentConfig

AGENTS: dict[str, AgentConfig] = {
    "logic": AgentConfig(
        role_id="logic", display_name="Lý Trí",
        system_prompt=LOGIC_SYSTEM_PROMPT,
        temperature=0.3, model_tier="light", max_tokens=300,
    ),
    "emotion": AgentConfig(
        role_id="emotion", display_name="Con Tim",
        system_prompt=EMOTION_SYSTEM_PROMPT,
        temperature=0.8, model_tier="light", max_tokens=300,
    ),
    "risk": AgentConfig(
        role_id="risk", display_name="Người Cẩn Trọng",
        system_prompt=RISK_SYSTEM_PROMPT,
        temperature=0.4, model_tier="light", max_tokens=300,
    ),
    "pleasure": AgentConfig(
        role_id="pleasure", display_name="Người Tự Do",
        system_prompt=PLEASURE_SYSTEM_PROMPT,
        temperature=0.9, model_tier="light", max_tokens=300,
    ),
}

AGENT_ROLES_ORDER: list[str] = ["logic", "emotion", "risk", "pleasure"]

MODERATOR_CONFIG = AgentConfig(
    role_id="moderator", display_name="Chủ Tọa",
    system_prompt=MODERATOR_SYSTEM_PROMPT,
    temperature=0.2, model_tier="strong", max_tokens=1200,
)

FALLBACK_LINES: dict[str, str] = {
    "logic": "Lý Trí cần thêm thời gian phân tích vấn đề này — phần này tạm vắng mặt trong vòng tranh luận.",
    "emotion": "Con Tim chưa kịp lên tiếng ở lượt này.",
    "risk": "Người Cẩn Trọng tạm vắng mặt — khuyến nghị xem xét lại rủi ro một cách thủ công.",
    "pleasure": "Người Tự Do chưa kịp phản hồi trong lượt này.",
}