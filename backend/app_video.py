"""AI Video Engine — FastAPI sub-application for teaching sizheng video production.

Mounted at /api/video on the main app.
"""
import asyncio
import hashlib
import hmac
import base64
import json
import logging
import os
import re
import threading
from datetime import datetime
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Literal

from database import engine, get_db, Base, beijing_now
from models_video import VideoProject, VideoScene, VideoAuditLog
from providers.llm import call_dify_chat, extract_json
from pipeline.prompts import ALIGN_SYSTEM, build_align_prompt

load_dotenv()
logger = logging.getLogger(__name__)

MEDIA_DIR = os.getenv("VIDEO_MEDIA_DIR", "/opt/party-agent/media/video")

# ── FastAPI sub-app ────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    os.makedirs(MEDIA_DIR, exist_ok=True)
    yield

video_app = FastAPI(title="AI Video Engine", lifespan=lifespan)

# Mount media serving
try:
    video_app.mount("/media/video", StaticFiles(directory=MEDIA_DIR), name="media_video")
except Exception:
    pass  # directory may not exist on first startup


# ── Auth (same HMAC scheme as app_sizheng.py) ─────────────────

ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "party-agent-admin-secret-2026")

def _verify_admin_token(token: str) -> int | None:
    try:
        raw = base64.b64decode(token.encode()).decode()
        payload, sig = raw.rsplit(":", 1)
        expected = hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if sig != expected:
            return None
        uid_str, ts_str = payload.split(":", 1)
        if int(datetime.now().timestamp()) - int(ts_str) > 24 * 3600:
            return None
        return int(uid_str)
    except Exception:
        return None


async def get_current_admin(request: Request, db: AsyncSession = Depends(get_db)):
    from models_sizheng_alias import AdminUser
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "未登录")
    uid = _verify_admin_token(auth[7:])
    if not uid:
        raise HTTPException(401, "登录已过期，请重新登录")
    user = await db.get(AdminUser, uid)
    if not user or not user.is_active:
        raise HTTPException(401, "账号已禁用")
    return user


# ── Request / Response models ─────────────────────────────────

class CreateProjectRequest(BaseModel):
    knowledge_point: str
    sizheng_angle: str
    style_track: str = "industrial_documentary"


class SceneReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    comment: str | None = None


class SceneRegenRequest(BaseModel):
    start_frame_prompt: str | None = None
    end_frame_prompt: str | None = None
    comment: str | None = None


def _scene_to_dict(scene: VideoScene) -> dict:
    return {
        "id": scene.id,
        "scene_number": scene.scene_number,
        "teaching_function": scene.teaching_function,
        "status": scene.status,
        "review_status": scene.review_status,
        "narration_text": scene.narration_text,
        "subtitle_text": scene.subtitle_text,
        "duration_seconds": scene.duration_seconds,
        "narration_word_count": scene.narration_word_count,
        "teaching_point": scene.teaching_point,
        "image_prompt_zh": scene.image_prompt_zh,
        "start_frame_prompt": scene.start_frame_prompt,
        "end_frame_prompt": scene.end_frame_prompt,
        "motion_prompt": scene.motion_prompt,
        "start_frame_url": scene.start_frame_url,
        "end_frame_url": scene.end_frame_url,
        "video_segment_url": scene.video_segment_url,
        "review_comment": scene.review_comment,
        "post_overlay_json": scene.post_overlay_json,
    }


def _project_to_dict(project: VideoProject, scenes: list[VideoScene] = None) -> dict:
    return {
        "id": project.id,
        "title": project.title,
        "knowledge_point": project.knowledge_point,
        "sizheng_angle": project.sizheng_angle,
        "style_track": project.style_track,
        "status": project.status,
        "current_stage": project.current_stage,
        "progress_pct": project.progress_pct,
        "alignment_statement": project.alignment_statement,
        "scene_plan_json": project.scene_plan_json,
        "word_budget_json": project.word_budget_json,
        "full_narration": project.full_narration,
        "final_video_url": project.final_video_url,
        "total_cost_cny": project.total_cost_cny,
        "total_duration_seconds": project.total_duration_seconds,
        "error_message": project.error_message,
        "scenes": [_scene_to_dict(s) for s in scenes] if scenes else [],
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


# ── Routes ─────────────────────────────────────────────────────

@video_app.get("/style-tracks")
async def get_style_tracks():
    """List available style tracks."""
    # Import from YAML config
    try:
        import yaml
        from pathlib import Path
        config_path = Path(__file__).parent / "pipeline" / "skill_config.yaml"
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        return {"tracks": config.get("style_tracks", [])}
    except Exception:
        return {
            "tracks": [
                {"key": "flat_illustration", "label": "扁平插画叙事"},
                {"key": "industrial_documentary", "label": "工业纪实科技"},
                {"key": "historical_humanities", "label": "历史人文"},
            ]
        }


@video_app.get("/health")
async def health():
    return {"status": "ok", "media_dir": MEDIA_DIR}


# ── Sizheng Angle Suggestions ─────────────────────────────────

class SuggestAnglesRequest(BaseModel):
    knowledge_point: str


@video_app.post("/suggest-angles")
async def suggest_angles(
    body: SuggestAnglesRequest,
    admin=Depends(get_current_admin),
):
    """Analyze a knowledge point and suggest 3-5 sizheng angles."""
    from pipeline.prompts import SUGGEST_ANGLES_SYSTEM, build_suggest_angles_prompt

    query = f"{SUGGEST_ANGLES_SYSTEM}\n\n---\n\n{build_suggest_angles_prompt(body.knowledge_point)}"

    try:
        raw = call_dify_chat(query, timeout=60)
        data = json.loads(extract_json(raw))
        return {"angles": data.get("angles", []), "knowledge_point_summary": data.get("knowledge_point_summary", "")}
    except json.JSONDecodeError as e:
        logger.error(f"suggest-angles JSON parse failed: {e}\nraw={raw[:500]}")
        raise HTTPException(500, f"思政角度建议JSON解析失败: {e}")
    except Exception as e:
        logger.exception(f"suggest-angles failed: {e}")
        raise HTTPException(500, f"思政角度建议生成失败: {e}")


# ── Project CRUD ──────────────────────────────────────────────

@video_app.post("/projects")
async def create_project(
    body: CreateProjectRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Create a video project and start the pipeline."""
    project = VideoProject(
        title=f"{body.knowledge_point[:30]}",
        knowledge_point=body.knowledge_point,
        sizheng_angle=body.sizheng_angle,
        style_track=body.style_track,
        created_by=admin.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Launch pipeline in background thread
    from pipeline.engine import PipelineEngine
    from database import async_session
    engine = PipelineEngine(async_session)
    engine.start_in_thread(project.id)

    return {
        "project_id": project.id,
        "status": project.status,
        "message": "项目已创建,流水线已启动",
    }


@video_app.get("/projects")
async def list_projects(
    page: int = 1,
    page_size: int = 20,
    status: str = "",
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """List video projects for the current admin."""
    stmt = select(VideoProject).order_by(VideoProject.created_at.desc())
    if status:
        stmt = stmt.where(VideoProject.status == status)

    result = await db.execute(stmt)
    all_items = result.scalars().all()

    total = len(all_items)
    start = (page - 1) * page_size
    items = all_items[start:start + page_size]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_project_to_dict(p) for p in items],
    }


@video_app.get("/projects/{project_id}")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Get full project detail with all scenes."""
    project = await db.get(VideoProject, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")

    result = await db.execute(
        select(VideoScene).where(VideoScene.project_id == project_id)
        .order_by(VideoScene.scene_number)
    )
    scenes = result.scalars().all()

    return {"project": _project_to_dict(project, list(scenes))}


@video_app.get("/projects/{project_id}/status")
async def get_project_status(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Lightweight status poll for pipeline progress UI."""
    project = await db.get(VideoProject, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return {
        "status": project.status,
        "current_stage": project.current_stage,
        "progress_pct": project.progress_pct,
        "error_message": project.error_message,
    }


@video_app.post("/projects/{project_id}/cancel")
async def cancel_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Cancel a running project."""
    project = await db.get(VideoProject, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    project.status = "cancelled"
    await db.commit()
    return {"status": "cancelled"}


@video_app.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Delete project, its scenes, audit logs, and media files."""
    project = await db.get(VideoProject, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")

    # Delete media files
    import shutil
    media_dir = os.path.join(MEDIA_DIR, str(project_id))
    if os.path.exists(media_dir):
        shutil.rmtree(media_dir)

    await db.delete(project)
    await db.commit()
    return {"status": "deleted"}


@video_app.get("/projects/{project_id}/download")
async def download_video(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Download the final assembled MP4."""
    project = await db.get(VideoProject, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    if not project.final_video_path or not os.path.exists(project.final_video_path):
        raise HTTPException(404, "视频文件不存在")
    return FileResponse(
        project.final_video_path,
        media_type="video/mp4",
        filename=f"video_{project_id}.mp4",
    )


# ── Pipeline Control ──────────────────────────────────────────

@video_app.post("/projects/{project_id}/start-image-gen")
async def start_image_generation(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """After prompts review, teacher confirms to start image generation."""
    project = await db.get(VideoProject, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    if project.status != "prompts_review":
        raise HTTPException(400, f"当前状态不是prompts_review,而是{project.status}")

    from pipeline.engine import PipelineEngine
    from database import async_session
    engine = PipelineEngine(async_session)
    engine.start_in_thread(project.id)

    return {"status": "started", "message": "图像生成已启动"}


@video_app.post("/projects/{project_id}/start-video-gen")
async def start_video_generation(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """After images review (all scenes approved), teacher starts video generation."""
    project = await db.get(VideoProject, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    if project.status != "images_review":
        raise HTTPException(400, f"当前状态不是images_review,而是{project.status}")

    from pipeline.engine import PipelineEngine
    from database import async_session
    engine = PipelineEngine(async_session)
    engine.start_in_thread(project.id)

    return {"status": "started", "message": "视频生成已启动"}


# ── Scene Review ──────────────────────────────────────────────

@video_app.post("/projects/{project_id}/scenes/{scene_id}/review")
async def review_scene(
    project_id: int,
    scene_id: int,
    body: SceneReviewRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Approve or reject a scene's generated images."""
    scene = await db.get(VideoScene, scene_id)
    if not scene or scene.project_id != project_id:
        raise HTTPException(404, "Scene不存在")

    scene.review_status = body.action + "d"
    scene.reviewed_by = admin.id
    scene.reviewed_at = beijing_now()
    scene.review_comment = body.comment

    # Log audit event
    log = VideoAuditLog(
        project_id=project_id,
        scene_id=scene_id,
        event_type=f"human_review_{body.action}d",
        message=body.comment or "",
        operator_id=admin.id,
    )
    db.add(log)
    await db.commit()

    return {"status": body.action + "d", "scene_id": scene_id}


@video_app.post("/projects/{project_id}/scenes/{scene_id}/regenerate")
async def regenerate_scene_image(
    project_id: int,
    scene_id: int,
    body: SceneRegenRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Regenerate images for a rejected scene with optional prompt revision."""
    scene = await db.get(VideoScene, scene_id)
    if not scene or scene.project_id != project_id:
        raise HTTPException(404, "Scene不存在")

    if body.start_frame_prompt:
        scene.start_frame_prompt = body.start_frame_prompt
        scene.image_prompt_zh = (body.start_frame_prompt or "") + " " + (body.end_frame_prompt or "")
    if body.end_frame_prompt:
        scene.end_frame_prompt = body.end_frame_prompt

    scene.status = "pending"
    scene.review_status = None
    scene.retry_count = (scene.retry_count or 0) + 1

    log = VideoAuditLog(
        project_id=project_id,
        scene_id=scene_id,
        event_type="image_regenerate",
        message=body.comment or "",
        detail_json={"retry_count": scene.retry_count},
        operator_id=admin.id,
    )
    db.add(log)
    await db.commit()

    # Re-run image generation for this scene in background
    project = await db.get(VideoProject, project_id)

    def _regen():
        import asyncio as aio
        loop = aio.new_event_loop()
        aio.set_event_loop(loop)
        from pipeline.stages import image_gen_stage
        from database import async_session as asf

        async def _run():
            import yaml
            config_path = os.path.join(os.path.dirname(__file__), "pipeline", "skill_config.yaml")
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            async with asf() as sess:
                proj = await sess.get(VideoProject, project_id)
                s = await sess.get(VideoScene, scene_id)
                if proj and s:
                    proj.status = "image_generating"
                    s.status = "image_generating"
                    await sess.commit()
                    try:
                        await image_gen_stage(sess, proj, config)
                    except Exception as e:
                        logger.error(f"Scene {scene_id} regeneration failed: {e}")
                        proj.status = "images_review"
                        s.status = "failed"
                        await sess.commit()

        loop.run_until_complete(_run())
        loop.close()

    threading.Thread(target=_regen, daemon=True).start()

    return {"status": "regenerating", "scene_id": scene_id}


# ── Budget ────────────────────────────────────────────────────

@video_app.get("/budget/summary")
async def budget_summary(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Get total API spend summary."""
    result = await db.execute(
        select(VideoProject).where(VideoProject.total_cost_cny > 0)
    )
    projects = result.scalars().all()
    total = sum(p.total_cost_cny for p in projects)
    image_total = sum(p.image_gen_cost_cny for p in projects)
    video_total = sum(p.video_gen_cost_cny for p in projects)
    return {
        "total_spent_cny": round(total, 2),
        "image_gen_total": round(image_total, 2),
        "video_gen_total": round(video_total, 2),
        "project_count": len(projects),
    }
