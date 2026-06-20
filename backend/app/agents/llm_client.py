"""
Wrapper duy nhất cho mọi lệnh gọi LLM trong hệ thống Council of Self.
- Tầng "light"  -> dùng cho 4 Agent tranh luận (Logic, Emotion, Risk, Pleasure)
- Tầng "strong" -> dùng cho Chủ tọa (Moderator), yêu cầu structured JSON output

Nguyên tắc kiến trúc quan trọng:
- Module này KHÔNG quyết định control flow.
  Chỉ chịu trách nhiệm gọi model, retry khi lỗi tạm thời, và trả về kết
  quả đã chuẩn hoá. Quyết định làm gì khi agent fail thuộc về orchestrator.handle_agent_result().
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass

import openai
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger("council_of_self.llm_client")

# ==============================================================================
# CẤU HÌNH MODEL THEO TẦNG
# ==============================================================================

MODEL_BY_TIER: dict[str, str] = {
    "light": "gpt-4o-mini",
    "strong": "gpt-4o",
}

DEFAULT_MAX_RETRIES = 2
RETRY_BACKOFF_BASE_S = 1.5

# ==============================================================================
# DATA CONTRACTS
# ==============================================================================

@dataclass
class AgentCallResult:
    success: bool
    content: str | None
    raw_json: dict | None
    tokens_input: int
    tokens_output: int
    latency_ms: int
    error_type: str | None = None
    error_detail: str | None = None


class LLMClientError(Exception):
    pass


# ==============================================================================
# CLIENT SINGLETON
# ==============================================================================

_async_client: AsyncOpenAI | None = None

def get_async_client() -> AsyncOpenAI:
    global _async_client
    if _async_client is None:
        _async_client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            max_retries=0,  # retry quản lý thủ công ở tầng trên
            timeout=httpx_timeout_for_safety(),
        )
    return _async_client


def httpx_timeout_for_safety():
    import httpx
    return httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)


# ==============================================================================
# HÀM GỌI 4 AGENT TRANH LUẬN
# ==============================================================================

async def call_agent(
    role: str,
    prompt: str,
    timeout_s: float,
    max_tokens: int = 180,
    temperature: float = 0.7,
) -> AgentCallResult:
    model = MODEL_BY_TIER["light"]
    return await _call_with_retry(
        role=role,
        model=model,
        prompt=prompt,
        timeout_s=timeout_s,
        max_tokens=max_tokens,
        temperature=temperature,
        expect_json=False,
    )


# ==============================================================================
# HÀM GỌI CHO CHỦ TỌA
# ==============================================================================

async def call_moderator(
    prompt: str,
    timeout_s: float,
    max_tokens: int = 700,
    temperature: float = 0.2,
) -> AgentCallResult:
    model = MODEL_BY_TIER["strong"]
    return await _call_with_retry(
        role="moderator",
        model=model,
        prompt=prompt,
        timeout_s=timeout_s,
        max_tokens=max_tokens,
        temperature=temperature,
        expect_json=True,
    )


# ==============================================================================
# CORE: GỌI API + RETRY LOGIC
# ==============================================================================

async def _call_with_retry(
    role: str,
    model: str,
    prompt: str,
    timeout_s: float,
    max_tokens: int,
    temperature: float,
    expect_json: bool,
    _attempt: int = 0,
) -> AgentCallResult:
    start_time = time.monotonic()
    client = get_async_client()

    try:
        call_kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        if expect_json:
            call_kwargs["response_format"] = {"type": "json_object"}

        response = await asyncio.wait_for(
            client.chat.completions.create(**call_kwargs),
            timeout=timeout_s,
        )

    except asyncio.TimeoutError:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        logger.warning(f"[{role}] Timeout sau {latency_ms}ms (giới hạn {timeout_s}s)")
        return AgentCallResult(
            success=False, content=None, raw_json=None,
            tokens_input=0, tokens_output=0, latency_ms=latency_ms,
            error_type="timeout", error_detail=f"Vượt quá {timeout_s}s",
        )

    except openai.RateLimitError as e:
        return await _maybe_retry(
            role, model, prompt, timeout_s, max_tokens, temperature,
            expect_json, _attempt, error_type="rate_limit", exc=e,
        )

    except openai.APIConnectionError as e:
        return await _maybe_retry(
            role, model, prompt, timeout_s, max_tokens, temperature,
            expect_json, _attempt, error_type="connection_error", exc=e,
        )

    except openai.APIStatusError as e:
        if e.status_code >= 500:
            return await _maybe_retry(
                role, model, prompt, timeout_s, max_tokens, temperature,
                expect_json, _attempt, error_type="server_error", exc=e,
            )
        latency_ms = int((time.monotonic() - start_time) * 1000)
        logger.error(f"[{role}] Lỗi API không retry được: {e.status_code} {e.message}")
        return AgentCallResult(
            success=False, content=None, raw_json=None,
            tokens_input=0, tokens_output=0, latency_ms=latency_ms,
            error_type="api_error", error_detail=str(e),
        )

    except Exception as e:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        logger.exception(f"[{role}] Lỗi không xác định khi gọi LLM")
        return AgentCallResult(
            success=False, content=None, raw_json=None,
            tokens_input=0, tokens_output=0, latency_ms=latency_ms,
            error_type="unknown_error", error_detail=str(e),
        )

    latency_ms = int((time.monotonic() - start_time) * 1000)
    text_content = response.choices[0].message.content or ""
    tokens_input = response.usage.prompt_tokens if response.usage else 0
    tokens_output = response.usage.completion_tokens if response.usage else 0

    logger.info(
        f"[{role}] OK — {latency_ms}ms, in={tokens_input}, out={tokens_output}"
    )

    if not expect_json:
        return AgentCallResult(
            success=True, content=text_content, raw_json=None,
            tokens_input=tokens_input, tokens_output=tokens_output,
            latency_ms=latency_ms,
        )

    parsed = _try_parse_json(text_content)
    if parsed is not None:
        return AgentCallResult(
            success=True, content=text_content, raw_json=parsed,
            tokens_input=tokens_input, tokens_output=tokens_output,
            latency_ms=latency_ms,
        )

    if _attempt < 1:
        logger.warning(f"[{role}] JSON parse lỗi, thử lại với prompt nhấn mạnh format")
        retry_prompt = _build_json_retry_prompt(prompt, text_content)
        return await _call_with_retry(
            role, model, retry_prompt, timeout_s, max_tokens, temperature,
            expect_json=True, _attempt=_attempt + 1,
        )

    logger.error(f"[{role}] JSON parse lỗi sau khi đã retry — trả về fail")
    return AgentCallResult(
        success=False, content=text_content, raw_json=None,
        tokens_input=tokens_input, tokens_output=tokens_output,
        latency_ms=latency_ms,
        error_type="parse_error",
        error_detail="Không parse được JSON sau 1 lần retry",
    )


async def _maybe_retry(
    role, model, prompt, timeout_s, max_tokens, temperature, expect_json,
    _attempt, error_type, exc,
) -> AgentCallResult:
    if _attempt >= DEFAULT_MAX_RETRIES:
        logger.error(f"[{role}] Hết số lần retry ({DEFAULT_MAX_RETRIES}) — lỗi: {exc}")
        return AgentCallResult(
            success=False, content=None, raw_json=None,
            tokens_input=0, tokens_output=0, latency_ms=0,
            error_type=error_type, error_detail=str(exc),
        )

    backoff = RETRY_BACKOFF_BASE_S * (2 ** _attempt)
    logger.warning(
        f"[{role}] {error_type}, thử lại sau {backoff:.1f}s "
        f"(lần {_attempt + 1}/{DEFAULT_MAX_RETRIES})"
    )
    await asyncio.sleep(backoff)
    return await _call_with_retry(
        role, model, prompt, timeout_s, max_tokens, temperature,
        expect_json, _attempt=_attempt + 1,
    )


# ==============================================================================
# HELPERS
# ==============================================================================

def _try_parse_json(text: str) -> dict | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def _build_json_retry_prompt(original_prompt: str, bad_output: str) -> str:
    return (
        f"{original_prompt}\n\n"
        f"---\n"
        f"LƯU Ý QUAN TRỌNG: lần trả lời trước của bạn không phải JSON hợp lệ:\n"
        f"{bad_output[:300]}\n\n"
        f"Hãy trả lời lại CHỈ DUY NHẤT một đối tượng JSON hợp lệ theo đúng schema "
        f"đã quy định, không kèm bất kỳ văn bản, markdown, hay code fence nào khác."
    )
