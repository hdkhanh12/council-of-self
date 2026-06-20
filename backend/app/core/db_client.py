"""
Khởi tạo Supabase client dùng chung cho toàn backend
"""
from __future__ import annotations

import logging
from supabase import create_client, Client

from app.core.config import settings

logger = logging.getLogger("council_of_self.db_client")

# ==============================================================================
# CLIENT SINGLETONS
# ==============================================================================
# supabase-py tự quản lý connection pool nội bộ (qua httpx) khi dùng cùng 1
# instance Client xuyên suốt vòng đời app — không tạo Client mới mỗi request.

supabase_client: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY,
)

supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)


import asyncio

async def run_db(fn):
    """
    Chạy 1 lệnh Supabase đồng bộ (vd: lambda: supabase_admin.table(...).execute())
    trong thread pool, không block event loop. Dùng hàm này cho MỌI lệnh gọi
    supabase_client/supabase_admin trong context async, thay vì gọi
    asyncio.to_thread() rải rác ở từng file.
    """
    return await asyncio.to_thread(fn)

async def healthcheck() -> bool:
    try:
        await run_db(lambda: supabase_admin.table("sessions").select("id").limit(1).execute())
        return True
    except Exception:
        logger.exception("Healthcheck DB thất bại")
        return False