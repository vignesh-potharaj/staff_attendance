import os
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status

from backend.auth.super_admin import (
    SUPER_ADMIN_ACCESS_TOKEN_EXPIRE_MINUTES,
    create_super_admin_access_token,
)
from backend.schemas.schemas import SuperAdminLoginRequest, Token

router = APIRouter(prefix="/super-admin/auth", tags=["Super Admin Authentication"])


@router.post("/login", response_model=Token)
def super_admin_login(payload: SuperAdminLoginRequest):
    expected_email = os.getenv("SUPER_ADMIN_EMAIL")
    expected_password = os.getenv("SUPER_ADMIN_PASSWORD")

    if not expected_email or not expected_password:
        raise HTTPException(
            status_code=503,
            detail="Missing required environment variables: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD",
        )

    if payload.email.strip().lower() != expected_email.strip().lower() or payload.password != expected_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid super admin credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_super_admin_access_token(
        data={"email": payload.email.strip().lower(), "role": "super_admin"},
        expires_delta=timedelta(minutes=SUPER_ADMIN_ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user={"email": payload.email.strip().lower(), "role": "super_admin"},
    )
