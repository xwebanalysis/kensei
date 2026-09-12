from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow() -> datetime:
    """Naive UTC now (column is timezone-naive for SQLite/PostgreSQL parity)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True, index=True)
    domain_target = Column(String, index=True)
    status = Column(String, default="RUNNING")
    created_at = Column(DateTime, default=_utcnow)

    technologies = relationship("Technology", back_populates="profile", cascade="all, delete-orphan")
    routes = relationship("DiscoveredRoute", back_populates="profile", cascade="all, delete-orphan")
    js_dependencies = relationship("JsDependency", back_populates="profile", cascade="all, delete-orphan")


class Technology(Base):
    __tablename__ = "technologies"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))

    category = Column(String)  # frontend, backend, cdn, analytics, hosting
    name = Column(String)
    version = Column(String, nullable=True)
    confidence = Column(String, nullable=True)  # high, medium, low
    evidence = Column(Text, nullable=True)

    profile = relationship("Profile", back_populates="technologies")


class DiscoveredRoute(Base):
    __tablename__ = "discovered_routes"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))

    path = Column(String)
    framework = Column(String, nullable=True)  # angular, react, vue
    route_type = Column(String, nullable=True)  # static, lazy, guard, param
    module = Column(String, nullable=True)

    profile = relationship("Profile", back_populates="routes")


class JsDependency(Base):
    __tablename__ = "js_dependencies"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))

    name = Column(String)
    version = Column(String, nullable=True)
    source = Column(String, nullable=True)  # bundle, sourcemap, inline
    package_manager = Column(String, nullable=True)  # npm, yarn, pnpm, unknown

    profile = relationship("Profile", back_populates="js_dependencies")
