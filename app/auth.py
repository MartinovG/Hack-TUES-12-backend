import bcrypt
from jose import jwt

SECRET = "supersecret"

def hash_password(password: str):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())

def verify_password(password: str, hashed: bytes):
    return bcrypt.checkpw(password.encode(), hashed)

def create_token(user_id: int):
    return jwt.encode({"user_id": user_id}, SECRET, algorithm="HS256")