from passlib.context import CryptContext
from config import settings

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=settings.BCRYPT_ROUNDS)


def hash_pw(plain: str) -> str:
    return pwd.hash(plain)


def verify_pw(plain: str, hashed: str) -> bool:
    return pwd.verify(plain, hashed)
