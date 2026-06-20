"""
Module thuần tiện ích cho định dạng Server-Sent Events (SSE).

Chịu trách nhiệm format đúng chuẩn SSE để orchestrator.run_debate() yield ra, 
và api/debate.py trả thẳng qua StreamingResponse.

Chuẩn SSE:
    event: <tên sự kiện>\n
    data: <payload JSON 1 dòng>\n
    \n
"""
from __future__ import annotations

import json
from typing import Any, Literal

SSEEventType = Literal["turn", "round_complete", "verdict", "error", "done"]


def sse_format(event: SSEEventType, data: dict[str, Any]) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n"


def sse_comment(text: str = "") -> str:
    """
    Comment SSE (dòng bắt đầu bằng ':') — chỉ dùng làm "keep-alive ping"
    """
    return f": {text}\n\n"