"""
Helper dùng chung cho mọi lệnh gọi Supabase (sync) trong context async
"""
from __future__ import annotations

import asyncio
from typing import Callable, TypeVar

T = TypeVar("T")


async def run_db(fn: Callable[[], T]) -> T:
    return await asyncio.to_thread(fn)