from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from database import get_connection
import os
from dotenv import load_dotenv

load_dotenv()

SECRET     = os.getenv("JWT_SECRET", "changeme")
ALGORITHM  = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", 10080))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_token(user_id: int, email: str) -> str:
    payload = {
        "sub":   str(user_id),
        "email": email,
        "exp":   datetime.utcnow() + timedelta(minutes=EXPIRE_MIN),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET, algorithms=[ALGORITHM])

def register_user(email: str, password: str) -> dict:
    if len(password.encode('utf-8')) > 72:
        raise ValueError("Password must be 72 characters or fewer")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

def register_user(email: str, password: str) -> dict:
    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close(); conn.close()
        raise ValueError("Email already registered")
    hashed = hash_password(password)
    cursor.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s, %s)",
        (email, hashed)
    )
    conn.commit()
    user_id = cursor.lastrowid
    cursor.close(); conn.close()
    return {"id": user_id, "email": email}

def login_user(email: str, password: str) -> dict:
    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, email, password_hash FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close(); conn.close()
    if not user or not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid email or password")
    return {"id": user["id"], "email": user["email"]}

def get_user_by_id(user_id: int) -> dict:
    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, email, created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    cursor.close(); conn.close()
    return user