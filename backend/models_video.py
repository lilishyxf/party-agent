"""AI Video Engine models — all tables prefixed with video_"""
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base, beijing_now


class VideoProject(Base):
    __tablename__ = "video_project"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    knowledge_point: Mapped[str] = mapped_column(Text, nullable=False)
    sizheng_angle: Mapped[str] = mapped_column(Text, nullable=False)
    style_track: Mapped[str] = mapped_column(String(32), default="flat_illustration")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    # pending → aligning → narrating → prompt_generating → prompts_review
    # → image_generating → images_review → video_generating → assembling → done / failed / cancelled
    current_stage: Mapped[str | None] = mapped_column(String(32))
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)

    alignment_statement: Mapped[str | None] = mapped_column(Text)
    scene_plan_json: Mapped[dict | None] = mapped_column(JSON)
    word_budget_json: Mapped[dict | None] = mapped_column(JSON)
    full_narration: Mapped[str | None] = mapped_column(Text)

    final_video_path: Mapped[str | None] = mapped_column(String(500))
    final_video_url: Mapped[str | None] = mapped_column(String(255))
    total_duration_seconds: Mapped[int | None] = mapped_column(Integer)
    total_cost_cny: Mapped[float] = mapped_column(Float, default=0.0)
    image_gen_cost_cny: Mapped[float] = mapped_column(Float, default=0.0)
    video_gen_cost_cny: Mapped[float] = mapped_column(Float, default=0.0)
    character_sheets_json: Mapped[dict | None] = mapped_column(JSON)

    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_adminuser.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    scenes: Mapped[list["VideoScene"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    audit_logs: Mapped[list["VideoAuditLog"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class VideoScene(Base):
    __tablename__ = "video_scene"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("video_project.id", ondelete="CASCADE"), nullable=False)
    scene_number: Mapped[int] = mapped_column(Integer, nullable=False)
    teaching_function: Mapped[str | None] = mapped_column(String(64))

    status: Mapped[str] = mapped_column(String(32), default="pending")
    # pending → prompts_ready → image_generating → images_ready → approved / rejected
    # → video_generating → video_ready → failed

    narration_text: Mapped[str | None] = mapped_column(Text)
    subtitle_text: Mapped[str | None] = mapped_column(Text)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    narration_word_count: Mapped[int | None] = mapped_column(Integer)
    teaching_point: Mapped[str | None] = mapped_column(Text)

    image_prompt_en: Mapped[str | None] = mapped_column(Text)
    image_prompt_zh: Mapped[str | None] = mapped_column(Text)
    start_frame_prompt: Mapped[str | None] = mapped_column(Text)
    end_frame_prompt: Mapped[str | None] = mapped_column(Text)
    motion_prompt: Mapped[str | None] = mapped_column(Text)
    post_overlay_json: Mapped[dict | None] = mapped_column(JSON)

    start_frame_url: Mapped[str | None] = mapped_column(String(500))
    end_frame_url: Mapped[str | None] = mapped_column(String(500))
    start_frame_local_path: Mapped[str | None] = mapped_column(String(500))
    end_frame_local_path: Mapped[str | None] = mapped_column(String(500))
    video_segment_url: Mapped[str | None] = mapped_column(String(500))
    video_segment_local_path: Mapped[str | None] = mapped_column(String(500))

    reviewed_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_adminuser.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    review_comment: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[str | None] = mapped_column(String(16))  # approved, rejected

    image_gen_task_id: Mapped[str | None] = mapped_column(String(128))
    video_gen_task_id: Mapped[str | None] = mapped_column(String(128))
    retry_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    project: Mapped["VideoProject"] = relationship(back_populates="scenes")


class VideoAuditLog(Base):
    __tablename__ = "video_audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("video_project.id", ondelete="CASCADE"), nullable=False)
    scene_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("video_scene.id", ondelete="SET NULL"))

    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    detail_json: Mapped[dict | None] = mapped_column(JSON)
    message: Mapped[str | None] = mapped_column(Text)
    operator_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_adminuser.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    project: Mapped["VideoProject"] = relationship(back_populates="audit_logs")
