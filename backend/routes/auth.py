from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from services.auth_service import (
    register_user, login_user, create_token,
    decode_token, get_user_by_id
)

router  = APIRouter()
bearer  = HTTPBearer()

class RegisterBody(BaseModel):
    email:    str
    password: str

class LoginBody(BaseModel):
    email:    str
    password: str

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = decode_token(creds.credentials)
        user_id = int(payload["sub"])
        user    = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.post("/register")
def register(body: RegisterBody):
    try:
        user  = register_user(body.email, body.password)
        token = create_token(user["id"], user["email"])
        return {"token": token, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login(body: LoginBody):
    try:
        user  = login_user(body.email, body.password)
        token = create_token(user["id"], user["email"])
        return {"token": token, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/me")
def me(user = Depends(get_current_user)):
    return user