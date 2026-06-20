from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.db_client import supabase_admin
from app.core.config import settings

logger = logging.getLogger("council_of_self.rate_limiter")

WINDOW_DURATION = timedelta(hours=1)


async def check_rate_limit(user_id: str) -> bool:
    try:
        return await asyncio.to_thread(_check_and_increment, user_id)
    except Exception:
        logger.exception(f"Rate limiter lỗi cho user_id={user_id} — fail-open")
        return True


def _check_and_increment(user_id: str) -> bool:
    now = datetime.now(timezone.utc)

    existing = (
        supabase_admin.table("rate_limits")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    rows = existing.data or []

    if not rows:
        supabase_admin.table("rate_limits").insert({
            "user_id": user_id,
            "request_count": 1,
            "window_start": now.isoformat(),
        }).execute()
        return True

    row = rows[0]
    window_start = datetime.fromisoformat(row["window_start"].replace("Z", "+00:00"))

    if now - window_start > WINDOW_DURATION:
        supabase_admin.table("rate_limits").update({
            "request_count": 1,
            "window_start": now.isoformat(),
        }).eq("user_id", user_id).execute()
        return True

    if row["request_count"] >= settings.MAX_SESSIONS_PER_HOUR:
        logger.warning(f"Rate limit chạm ngưỡng cho user_id={user_id}")
        return False

    supabase_admin.table("rate_limits").update({
        "request_count": row["request_count"] + 1,
    }).eq("user_id", user_id).execute()
    return True