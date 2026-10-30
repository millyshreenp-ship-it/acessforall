from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now():
    return datetime.now(timezone.utc)


class Scan(Base):
    __tablename__ = "scans"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    url: Mapped[Optional[str]] = mapped_column(Text)
    snapshot: Mapped[Optional[str]] = mapped_column(Text)  # sanitized DOM from the extension
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued|scanning|scanned|fixing|done|failed
    error: Mapped[Optional[str]] = mapped_column(Text)
    keyboard: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    issues: Mapped[list["Issue"]] = relationship(cascade="all, delete-orphan")


class Issue(Base):
    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[str] = mapped_column(String(64), index=True)
    impact: Mapped[Optional[str]] = mapped_column(String(16))
    selector: Mapped[str] = mapped_column(Text)
    html: Mapped[Optional[str]] = mapped_column(Text)
    context: Mapped[Optional[str]] = mapped_column(Text)
    wcag: Mapped[Optional[list]] = mapped_column(JSON)
    message: Mapped[Optional[str]] = mapped_column(Text)
    data: Mapped[Optional[dict]] = mapped_column(JSON)
    image_path: Mapped[Optional[str]] = mapped_column(Text)


class Patch(Base):
    __tablename__ = "patches"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    action: Mapped[dict] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(16))  # rule|vision|llm|human
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    validated: Mapped[bool] = mapped_column(Boolean, default=False)
    validation: Mapped[Optional[dict]] = mapped_column(JSON)
    # proposed|failed_validation|accepted|rejected|edited  (feedback doubles as a training dataset)
    status: Mapped[str] = mapped_column(String(24), default="proposed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
