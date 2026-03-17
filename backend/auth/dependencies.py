from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from backend.database.database import get_db
from backend.models.models import User, RoleEnum
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
        employee_id: str = payload.get("sub")
        role: str = payload.get("role")
        if employee_id is None:
            raise credentials_exception
        token_data = TokenData(employee_id=employee_id, role=role)
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.employee_id == token_data.employee_id).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges"
        )
    return current_user
