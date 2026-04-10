from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from backend.database.database import get_db
from backend.models.models import User, RoleEnum, UserStatus
from backend.auth.security import SECRET_KEY, ALGORITHM, oauth2_scheme
from backend.schemas.schemas import TokenData

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        role: str = payload.get("role")
        if user_id_raw is None:
            raise credentials_exception
        token_data = TokenData(user_id=int(user_id_raw), tenant_id=tenant_id, role=role)
    except JWTError:
        raise credentials_exception
    except (TypeError, ValueError):
        raise credentials_exception
    
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    if token_data.tenant_id is not None and user.tenant_id != token_data.tenant_id:
        raise credentials_exception
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")
    return user

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges"
        )
    return current_user
