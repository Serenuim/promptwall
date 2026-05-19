"""PROMPTWALL — All ORM Models"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


def uid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    accepted_policy = Column(Boolean, default=False)
    policy_accepted_at = Column(DateTime, nullable=True)
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    verification_token = Column(String(500), nullable=True)
    verification_token_expires = Column(DateTime, nullable=True)
    reset_token = Column(String(500), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    # Usage tracking
    daily_scans = Column(Integer, default=0)
    daily_scans_reset_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

    applications = relationship("Application", back_populates="owner", cascade="all, delete-orphan")
    scan_logs = relationship("ScanLog", back_populates="user", cascade="all, delete-orphan")
    allowlist = relationship("Allowlist", back_populates="user", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    # Raw key stored as SHA-256 hash — raw key shown ONCE only
    api_key_hash = Column(String(64), unique=True, nullable=False, index=True)
    # Display prefix: first 24 chars of full raw key (pw_live_ + 16 chars) so user can identify
    api_key_prefix = Column(String(30), nullable=False)
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True)
    is_demo = Column(Boolean, default=False)   # demo app for simulation
    demo_requests_used = Column(Integer, default=0)  # demo cap = 10
    total_requests = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="applications")
    scan_logs = relationship("ScanLog", back_populates="application", cascade="all, delete-orphan")
    allowlist = relationship("Allowlist", back_populates="application", cascade="all, delete-orphan")


class ScanLog(Base):
    __tablename__ = "scan_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    app_id = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    prompt = Column(Text, nullable=False)
    risk_score = Column(Integer, nullable=False, default=0)
    attack_type = Column(String(100), nullable=True)
    blocked = Column(Boolean, default=False)
    endpoint = Column(String(20), default="dashboard")
    ip_address = Column(String(45), nullable=True)
    allowlist_override = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="scan_logs")
    application = relationship("Application", back_populates="scan_logs")


class Allowlist(Base):
    __tablename__ = "allowlist"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    app_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    pattern = Column(String(500), nullable=False)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="allowlist")
    application = relationship("Application", back_populates="allowlist")


class FeedbackLog(Base):
    """
    User feedback on individual scan results.
    Each scan can be accepted (safe) or rejected (should have been blocked)
    by the app owner. Collected for model retraining.
    """
    __tablename__ = "feedback_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_log_id = Column(Integer, ForeignKey("scan_logs.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    app_id = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    verdict = Column(String(10), nullable=False)  # "accept" | "reject"
    note = Column(String(500), nullable=True)      # optional reason
    created_at = Column(DateTime, default=datetime.utcnow)

    scan = relationship("ScanLog", backref="feedback")
    user = relationship("User")
