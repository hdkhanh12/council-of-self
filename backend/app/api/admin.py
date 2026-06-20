from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import asyncio

from app.core.auth import get_current_admin, AuthUser
from app.core.db_client import supabase_admin

logger = logging.getLogger("council_of_self.api.admin")
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


# SCHEMAS
class OverviewStats(BaseModel):
    total_sessions: int
    sessions_today: int
    sessions_in_progress: int
    sessions_failed: int
    total_tokens_used_all_time: int
    total_tokens_used_today: int
    avg_latency_ms: float


class UserListItem(BaseModel):
    user_id: str
    email: str
    role: str
    session_count: int
    created_at: str


class UpdateUserRoleRequest(BaseModel):
    role: str  # "user" | "admin"


class RuntimeConfig(BaseModel):
    max_rounds: int
    agent_timeout_s: float
    max_sessions_per_hour: int


# OVERVIEW — số liệu tổng quan cho dashboard
@router.get("/overview", response_model=OverviewStats)
async def get_overview():
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    all_sessions_res = await asyncio.to_thread(
        lambda: supabase_admin.table("sessions").select("status, total_tokens_used, total_latency_ms, created_at").execute()
    )
    rows = all_sessions_res.data or []

    sessions_today = [r for r in rows if _parse_ts(r["created_at"]) >= today_start]
    latencies = [r["total_latency_ms"] for r in rows if r.get("total_latency_ms")]

    return OverviewStats(
        total_sessions=len(rows),
        sessions_today=len(sessions_today),
        sessions_in_progress=sum(1 for r in rows if r["status"] == "in_progress"),
        sessions_failed=sum(1 for r in rows if r["status"] == "failed"),
        total_tokens_used_all_time=sum(r.get("total_tokens_used", 0) or 0 for r in rows),
        total_tokens_used_today=sum(r.get("total_tokens_used", 0) or 0 for r in sessions_today),
        avg_latency_ms=round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
    )


# USERS — danh sách + nâng/hạ quyền
@router.get("/users", response_model=list[UserListItem])
async def list_users():
    profiles_res = await asyncio.to_thread(
        lambda: supabase_admin.table("profiles").select("id, email, role, created_at").execute()
    )
    profiles = profiles_res.data or []

    sessions_res = await asyncio.to_thread(
        lambda: supabase_admin.table("sessions").select("user_id").execute()
    )
    session_counts: dict[str, int] = {}
    for row in (sessions_res.data or []):
        uid = row["user_id"]
        session_counts[uid] = session_counts.get(uid, 0) + 1

    return [
        UserListItem(
            user_id=p["id"],
            email=p["email"],
            role=p["role"],
            session_count=session_counts.get(p["id"], 0),
            created_at=p["created_at"],
        )
        for p in profiles
    ]


@router.patch("/users/{user_id}/role", status_code=204)
async def update_user_role(
    user_id: str,
    payload: UpdateUserRoleRequest,
    current_admin: AuthUser = Depends(get_current_admin),
):
    if payload.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="role phải là 'user' hoặc 'admin'.")

    if user_id == current_admin.user_id and payload.role == "user":
        raise HTTPException(status_code=400, detail="Không thể tự hạ quyền của chính mình.")

    try:
        await asyncio.to_thread(
            lambda: supabase_admin.table("profiles").update({"role": payload.role}).eq("id", user_id).execute()
        )
    except Exception:
        logger.exception(f"Lỗi khi đổi role cho user_id={user_id}")
        raise HTTPException(status_code=500, detail="Không cập nhật được quyền người dùng.")

    logger.info(f"Admin {current_admin.email} đổi role của {user_id} thành '{payload.role}'")
    return None


# RUNTIME CONFIG — xem nhanh tham số vận hành hiện tại
@router.get("/config", response_model=RuntimeConfig)
async def get_runtime_config():
    from app.core.config import settings
    return RuntimeConfig(
        max_rounds=settings.MAX_ROUNDS,
        agent_timeout_s=settings.AGENT_TIMEOUT_S,
        max_sessions_per_hour=settings.MAX_SESSIONS_PER_HOUR,
    )


# HELPERS
def _parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))