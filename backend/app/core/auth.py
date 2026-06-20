from __future__ import annotations

import logging
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Request

from app.core.config import settings
from app.core.db_client import supabase_admin
from app.core.async_utils import run_db

logger = logging.getLogger("council_of_self.auth")

_jwk_client: PyJWKClient | None = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwk_client = PyJWKClient(jwks_url, cache_keys=True)
        logger.info(f"Khởi tạo PyJWKClient với JWKS URL: {jwks_url}")
    return _jwk_client


@dataclass
class AuthUser:
    user_id: str
    email: str
    role: str  # "user" | "admin"


def _decode_jwt(token: str) -> dict:
    try:
        signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn.")
    except Exception as jwks_error:
        if settings.SUPABASE_JWT_SECRET:
            try:
                return jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn.")
            except jwt.InvalidTokenError:
                pass

        logger.warning(f"JWT verify thất bại (cả JWKS lẫn fallback HS256): {jwks_error}")
        raise HTTPException(status_code=401, detail="Token không hợp lệ.")


def _extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Thiếu Authorization header.")
    return auth_header.split(" ", 1)[1].strip()


async def _fetch_role(user_id: str) -> str:
    try:
        res = await run_db(
            lambda: supabase_admin.table("profiles")
            .select("role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return res.data["role"] if res.data else "user"
    except Exception:
        logger.exception(f"Không tra được role cho user_id={user_id} — mặc định 'user'")
        return "user"

# FASTAPI DEPENDENCIES
async def get_current_user(request: Request) -> AuthUser:
    token = _extract_bearer_token(request)
    payload = _decode_jwt(token)
    user_id = payload["sub"]
    email = payload.get("email", "")
    role = await _fetch_role(user_id)
    return AuthUser(user_id=user_id, email=email, role=role)


async def get_current_admin(request: Request) -> AuthUser:
    user = await get_current_user(request)
    if user.role != "admin":
        logger.warning(f"User {user.user_id} ({user.email}) cố truy cập route admin")
        raise HTTPException(status_code=403, detail="Yêu cầu quyền quản trị.")
    return user


async def get_optional_user(request: Request) -> AuthUser | None:
    auth_header = request.headers.get("authorization")
    if not auth_header:
        return None
    try:
        return await get_current_user(request)
    except HTTPException:
        return None