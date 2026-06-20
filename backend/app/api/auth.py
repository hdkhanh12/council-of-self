from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
import asyncio

from app.core.db_client import supabase_client
from app.core.auth import get_current_user, AuthUser

logger = logging.getLogger("council_of_self.api.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


# SCHEMAS
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user_id: str
    email: str


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    user_id: str
    email: str
    role: str


# ENDPOINTS
@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(payload: SignupRequest):
    try:
        result = await asyncio.to_thread(
            lambda: supabase_client.auth.sign_up({
                "email": payload.email,
                "password": payload.password,
            })
        )
    except Exception as e:
        logger.warning(f"Signup thất bại cho {payload.email}: {e}")
        raise HTTPException(status_code=400, detail=_friendly_auth_error(e))

    if result.session is None:
        raise HTTPException(
            status_code=202,
            detail="Đăng ký thành công. Vui lòng kiểm tra email để xác nhận trước khi đăng nhập.",
        )

    return _session_to_response(result.session, result.user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    try:
        result = await asyncio.to_thread(
            lambda: supabase_client.auth.sign_in_with_password({
                "email": payload.email,
                "password": payload.password,
            })
        )
    except Exception as e:
        logger.info(f"Login thất bại cho {payload.email}: {e}")
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng.")

    return _session_to_response(result.session, result.user)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshRequest):
    """
    Cấp access_token mới từ refresh_token
    """
    try:
        result = await asyncio.to_thread(
            lambda: supabase_client.auth.refresh_session(payload.refresh_token)
        )
    except Exception as e:
        logger.info(f"Refresh token thất bại: {e}")
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.")

    return _session_to_response(result.session, result.user)


@router.post("/logout", status_code=204)
async def logout(current_user: AuthUser = Depends(get_current_user)):
    logger.info(f"User {current_user.user_id} ({current_user.email}) đã logout")
    return None


@router.get("/me", response_model=MeResponse)
async def me(current_user: AuthUser = Depends(get_current_user)):
    return MeResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        role=current_user.role,
    )


# HELPERS
def _session_to_response(session, user) -> AuthResponse:
    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
        user_id=user.id,
        email=user.email,
    )


def _friendly_auth_error(e: Exception) -> str:
    msg = str(e).lower()
    if "already registered" in msg or "already exists" in msg:
        return "Email này đã được đăng ký."
    if "password" in msg and ("short" in msg or "weak" in msg):
        return "Mật khẩu chưa đủ mạnh, vui lòng dùng ít nhất 8 ký tự."
    return "Không thể đăng ký lúc này, vui lòng thử lại."