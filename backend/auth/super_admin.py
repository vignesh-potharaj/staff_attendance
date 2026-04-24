import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from backend.auth.security import ALGORITHM, IST


SUPER_ADMIN_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
super_admin_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/super-admin/auth/login")


def _super_admin_secret_key() -> str:
    value = os.getenv("SUPER_ADMIN_JWT_SECRET")
    if not value:
        raise HTTPException(status_code=503, detail="Missing required environment variable: SUPER_ADMIN_JWT_SECRET")
    return value


def create_super_admin_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(IST) + (expires_delta or timedelta(minutes=SUPER_ADMIN_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _super_admin_secret_key(), algorithm=ALGORITHM)


def require_super_admin(token: str = Depends(super_admin_oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate super admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _super_admin_secret_key(), algorithms=[ALGORITHM])
    except JWTError:
        raise credentials_exception

    role = payload.get("role")
    email = payload.get("email")
    if role != "super_admin" or not email:
        raise credentials_exception
    return payload
