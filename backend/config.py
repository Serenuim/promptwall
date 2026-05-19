"""PROMPTWALL — Central Config. All values from .env — nothing hardcoded."""
import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PROMPTWALL"
    APP_VERSION: str = "2.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./promptwall.db"

    # JWT
    JWT_SECRET_KEY: str = "change_me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Security
    BCRYPT_ROUNDS: int = 12
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15

    # Super admin — only this email sees /admin
    SUPER_ADMIN_EMAIL: str = "manayig@gmail.com"

    # Rate limits
    DAILY_REQUEST_LIMIT: int = 40
    AUTH_RATE_LIMIT_PER_MINUTE: int = 5
    API_RATE_LIMIT_PER_MINUTE: int = 20

    # Plan limits
    FREE_MAX_APPS: int = 5
    FREE_DAILY_SCANS: int = 40

    # CORS — read as comma-separated string, split into list
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    EMAIL_FROM: str = "noreply@promptwall.io"
    RESEND_API_KEY: str = ""
    
    # ML Model
    ML_MODEL_PATH: str = "ml_models/promptwall_compressed"
    ML_BLOCK_THRESHOLD: int = 70

    # Simulation
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.2-3b-preview"
    SIMULATION_SYSTEM_PROMPT: str = "You are a secure AI assistant."

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
