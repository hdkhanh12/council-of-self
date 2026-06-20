from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.debate import router as debate_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.core.db_client import healthcheck
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(
    title="Council of Self API",
    description="Multi-Agent Debate Architecture for Persona-Driven Cognitive Consensus",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(debate_router)
app.include_router(admin_router)


@app.get("/health")
async def health():
    db_ok = await healthcheck()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
    }