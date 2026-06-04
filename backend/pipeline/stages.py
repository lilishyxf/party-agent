"""Pipeline stage implementations — each stage is an async function.

Each stage receives (db, project, config) and updates the project in-place.
Stages that need to stop for human review raise PauseForReview.
Stages that fail raise StageError.
"""
import json
import logging
import os
import re
import requests
import threading
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models_video import VideoProject, VideoScene, VideoAuditLog
from pipeline.prompts import (
    ALIGN_SYSTEM, build_align_prompt,
    NARRATE_SYSTEM, build_narrate_prompt,
    PROMPTGEN_SYSTEM, build_promptgen_prompt,
    CHAR_ANALYSIS_SYSTEM, build_char_analysis_prompt,
    build_char_sheet_prompt,
    check_safety,
)
from providers.llm import call_dify_chat, extract_json
from providers.jimeng import VolcengineArkClient

MEDIA_DIR = os.getenv("VIDEO_MEDIA_DIR", "/opt/party-agent/media/video")

logger = logging.getLogger(__name__)


class StageError(Exception):
    pass


class PauseForReview(Exception):
    """Raised when pipeline should pause for human review."""
    pass


def _get_style_prefix(config: dict, style_track: str) -> str:
    for t in config.get("style_tracks", []):
        if t["key"] == style_track:
            return t["prompt_prefix_zh"]
    return ""


def _get_composition_rules(config: dict, style_track: str) -> list:
    if style_track == "industrial_documentary":
        return config.get("track2_composition_rules", [])
    return []


def _build_system_query(system: str, query: str) -> str:
    """Combine system prompt and user query for Dify (which has no system/user split)."""
    return f"{system}\n\n---\n\n{query}"


async def _log_event(db: AsyncSession, project_id: int, event_type: str, message: str = "", detail: dict = None, scene_id: int = None):
    log = VideoAuditLog(
        project_id=project_id,
        scene_id=scene_id,
        event_type=event_type,
        message=message,
        detail_json=detail,
    )
    db.add(log)


# ── Stage 1: Align ─────────────────────────────────────────────

async def align_stage(db: AsyncSession, project: VideoProject, config: dict):
    project.status = "aligning"
    project.current_stage = "align"
    project.progress_pct = 5
    await db.commit()

    query = _build_system_query(ALIGN_SYSTEM, build_align_prompt(
        project.knowledge_point, project.sizheng_angle, project.style_track
    ))

    try:
        raw = call_dify_chat(query)
        data = json.loads(extract_json(raw))

        project.alignment_statement = data.get("alignment_statement", "")
        project.scene_plan_json = data.get("scenes", [])
        project.word_budget_json = {
            "total_word_count": data.get("total_word_count", 324),
            "scenes": [{"number": s["number"], "word_count": s.get("word_count", 0)} for s in data.get("scenes", [])],
        }
        project.progress_pct = 15
        await _log_event(db, project.id, "stage_complete", "对齐规划完成", {"stage": "align"})
        await db.commit()
    except (json.JSONDecodeError, KeyError) as e:
        await _log_event(db, project.id, "stage_failed", f"对齐规划解析失败: {e}", {"stage": "align", "raw": raw[:500]})
        raise StageError(f"Align stage failed: {e}")


# ── Stage 2: Narrate ───────────────────────────────────────────

async def narrate_stage(db: AsyncSession, project: VideoProject, config: dict):
    project.status = "narrating"
    project.current_stage = "narrate"
    project.progress_pct = 20
    await db.commit()

    scene_plan = project.scene_plan_json or []
    query = _build_system_query(NARRATE_SYSTEM, build_narrate_prompt(
        project.knowledge_point, project.sizheng_angle,
        project.alignment_statement or "", scene_plan,
    ))

    try:
        raw = call_dify_chat(query)
        narration = raw.strip()

        passed, reason = check_safety(narration)
        if not passed:
            await _log_event(db, project.id, "content_safety_block", reason, {"narration_snippet": narration[:200]})
            project.status = "failed"
            project.error_message = f"内容安全审查未通过: {reason}"
            await db.commit()
            raise StageError(f"Safety check failed: {reason}")

        project.full_narration = narration
        project.progress_pct = 35
        await _log_event(db, project.id, "content_safety_pass", "旁白通过安全审查")
        await _log_event(db, project.id, "stage_complete", "旁白生成完成", {"stage": "narrate", "word_count": len(narration)})
        await db.commit()
    except StageError:
        raise
    except Exception as e:
        await _log_event(db, project.id, "stage_failed", f"旁白生成失败: {e}")
        raise StageError(f"Narrate stage failed: {e}")


# ── Stage 3: Prompt Gen ────────────────────────────────────────

async def promptgen_stage(db: AsyncSession, project: VideoProject, config: dict):
    project.status = "prompt_generating"
    project.current_stage = "prompt_gen"
    project.progress_pct = 40
    await db.commit()

    style_prefix = _get_style_prefix(config, project.style_track)
    comp_rules = _get_composition_rules(config, project.style_track)
    scene_plan = project.scene_plan_json or []

    query = _build_system_query(PROMPTGEN_SYSTEM, build_promptgen_prompt(
        project.knowledge_point, project.sizheng_angle,
        project.style_track, style_prefix,
        scene_plan, project.full_narration or "",
        comp_rules,
    ))

    try:
        raw = call_dify_chat(query, timeout=300)
        data = json.loads(extract_json(raw))

        for sdata in data.get("scenes", []):
            scene = VideoScene(
                project_id=project.id,
                scene_number=sdata["scene_number"],
                teaching_function=sdata.get("teaching_function", ""),
                duration_seconds=sdata.get("duration_seconds", 12),
                narration_text=sdata.get("narration_text", ""),
                subtitle_text=sdata.get("subtitle_text", sdata.get("narration_text", "")),
                narration_word_count=sdata.get("narration_word_count", 0),
                teaching_point=sdata.get("teaching_point", ""),
                image_prompt_zh=style_prefix + " " + sdata.get("start_frame_prompt", ""),
                start_frame_prompt=sdata.get("start_frame_prompt", ""),
                end_frame_prompt=sdata.get("end_frame_prompt", ""),
                motion_prompt=sdata.get("scene_prompt", ""),
                post_overlay_json=sdata.get("post_overlay", []),
                status="prompts_ready",
            )
            db.add(scene)

        project.progress_pct = 55
        # Pause for human review after this stage
        project.status = "prompts_review"
        project.current_stage = "prompt_gen"
        await _log_event(db, project.id, "stage_complete", f"分镜提示词生成完成,{len(data.get('scenes', []))}个Scene", {"stage": "prompt_gen"})
        await db.commit()
    except (json.JSONDecodeError, KeyError) as e:
        await _log_event(db, project.id, "stage_failed", f"分镜提示词解析失败: {e}", {"raw": raw[:500]})
        raise StageError(f"Prompt gen stage failed: {e}")


# ── Stage 3.5: Character Reference Sheet ──────────────────────


async def char_ref_stage(db: AsyncSession, project: VideoProject, config: dict):
    """Analyze script for human characters and generate 三视图 reference sheets.

    If no specific human characters are found (e.g. industrial/tech-only video),
    this stage is a no-op and the pipeline proceeds directly to image_gen.
    """
    project.status = "char_ref"
    project.current_stage = "char_ref"
    project.progress_pct = 57
    await db.commit()

    scene_plan = project.scene_plan_json or []
    full_narration = project.full_narration or ""

    # Step 1: LLM analyzes whether the script has specific human characters
    query = _build_system_query(CHAR_ANALYSIS_SYSTEM, build_char_analysis_prompt(
        full_narration, scene_plan, project.knowledge_point
    ))

    try:
        raw = call_dify_chat(query, timeout=120)
        data = json.loads(extract_json(raw))
    except (json.JSONDecodeError, KeyError) as e:
        await _log_event(db, project.id, "stage_failed", f"角色分析解析失败: {e}", {"raw": raw[:500] if 'raw' in dir() else ""})
        raise StageError(f"Char analysis stage failed: {e}")

    has_characters = data.get("has_characters", False)
    characters = data.get("characters", [])
    reasoning = data.get("reasoning", "")

    await _log_event(db, project.id, "char_analysis", f"角色分析完成: has_characters={has_characters}, {reasoning}",
                     {"has_characters": has_characters, "character_count": len(characters)})

    if not has_characters or not characters:
        project.character_sheets_json = {"has_characters": False, "characters": [], "reasoning": reasoning}
        project.progress_pct = 58
        await _log_event(db, project.id, "stage_complete", "无具体人物角色,跳过三视图生成", {"stage": "char_ref"})
        await db.commit()
        return

    # Step 2: Generate 三视图 for each detected character
    api = VolcengineArkClient()
    style_prefix = _get_style_prefix(config, project.style_track)
    media_root = os.path.join(MEDIA_DIR, str(project.id), "char_sheets")
    os.makedirs(media_root, exist_ok=True)

    char_sheets = []
    for i, char in enumerate(characters):
        try:
            sheet_prompt = build_char_sheet_prompt(char, style_prefix)
            result = api.text_to_image(
                prompt=sheet_prompt + ", 画面中不要有任何文字, no text, no watermark",
            )
            image_url = result.get("url", "")
            local_path = None
            if image_url:
                local_path = os.path.join(media_root, f"char_{i}_{char.get('name', 'unknown')}.png")
                _download_image(image_url, local_path)

            char_sheets.append({
                "name": char.get("name", ""),
                "appearance_zh": char.get("appearance_zh", ""),
                "clothing": char.get("clothing", ""),
                "sheet_image_url": image_url,
                "sheet_local_path": local_path,
                "sheet_prompt": sheet_prompt,
            })
            await _log_event(db, project.id, "char_sheet_generated", f"角色 {char.get('name', '')} 三视图生成完成")

        except Exception as e:
            logger.error(f"Character sheet for {char.get('name', '')} failed: {e}")
            char_sheets.append({
                "name": char.get("name", ""),
                "appearance_zh": char.get("appearance_zh", ""),
                "clothing": char.get("clothing", ""),
                "sheet_image_url": "",
                "sheet_local_path": None,
                "sheet_prompt": "",
                "error": str(e),
            })

    project.character_sheets_json = {
        "has_characters": True,
        "reasoning": reasoning,
        "characters": char_sheets,
    }
    project.progress_pct = 60
    await _log_event(db, project.id, "stage_complete",
                     f"角色参照图生成完成,{len([c for c in char_sheets if c.get('sheet_image_url')])}/{len(char_sheets)}个成功",
                     {"stage": "char_ref"})
    await db.commit()


# ── Utility: download image to local path ──────────────────────

def _download_image(url: str, local_path: str):
    """Download an image URL to a local file path."""
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    with open(local_path, "wb") as f:
        f.write(resp.content)
    logger.info(f"Downloaded image to {local_path}")


# ── Stage 4: Image Generation ──────────────────────────────────

async def image_gen_stage(db: AsyncSession, project: VideoProject, config: dict):
    project.status = "image_generating"
    project.current_stage = "image_gen"
    project.progress_pct = 60
    await db.commit()

    # Load all scenes
    result = await db.execute(
        select(VideoScene).where(VideoScene.project_id == project.id).order_by(VideoScene.scene_number)
    )
    scenes = result.scalars().all()

    if not scenes:
        await _log_event(db, project.id, "stage_failed", "没有找到Scene记录")
        raise StageError("No scenes found for image generation")

    api = VolcengineArkClient()
    total = len(scenes)
    media_root = os.path.join(MEDIA_DIR, str(project.id), "scenes")

    # Load character reference sheets for consistent character appearance
    char_sheets = (project.character_sheets_json or {}).get("characters", [])
    char_ref_url = ""
    if char_sheets:
        char_ref_url = char_sheets[0].get("sheet_image_url", "") or ""
        if char_ref_url:
            await _log_event(db, project.id, "char_ref_applied",
                             f"使用角色参照图: {char_sheets[0].get('name', '')}")

    for i, scene in enumerate(scenes):
        scene.status = "image_generating"
        await db.commit()

        # Generate start frame
        try:
            start_prompt = scene.image_prompt_zh or scene.start_frame_prompt or ""
            if start_prompt:
                result_img = api.text_to_image(
                    prompt=start_prompt,
                    reference_image_url=char_ref_url,
                )
                start_url = result_img.get("url", "")
                if start_url:
                    start_local = os.path.join(media_root, f"scene_{scene.scene_number}_start.png")
                    _download_image(start_url, start_local)
                    scene.start_frame_url = start_url
                    scene.start_frame_local_path = start_local
                    await _log_event(db, project.id, "image_generated", f"Scene {scene.scene_number} 首帧生成完成", scene_id=scene.id)
        except Exception as e:
            logger.error(f"Scene {scene.scene_number} start frame failed: {e}")
            await _log_event(db, project.id, "stage_failed", f"Scene {scene.scene_number} 首帧失败: {e}", scene_id=scene.id)
            scene.status = "failed"
            await db.commit()
            raise StageError(f"Scene {scene.scene_number} start frame generation failed: {e}")

        # Generate end frame
        try:
            end_prompt = (scene.image_prompt_zh or "").replace(scene.start_frame_prompt or "", "") + " " + (scene.end_frame_prompt or "")
            if scene.end_frame_prompt:
                result_img = api.text_to_image(
                    prompt=end_prompt.strip(),
                    reference_image_url=char_ref_url,
                )
                end_url = result_img.get("url", "")
                if end_url:
                    end_local = os.path.join(media_root, f"scene_{scene.scene_number}_end.png")
                    _download_image(end_url, end_local)
                    scene.end_frame_url = end_url
                    scene.end_frame_local_path = end_local
                    await _log_event(db, project.id, "image_generated", f"Scene {scene.scene_number} 尾帧生成完成", scene_id=scene.id)
        except Exception as e:
            logger.error(f"Scene {scene.scene_number} end frame failed: {e}")
            await _log_event(db, project.id, "stage_failed", f"Scene {scene.scene_number} 尾帧失败: {e}", scene_id=scene.id)
            # End frame failure is non-fatal — continue with start frame only
            scene.end_frame_local_path = None

        scene.status = "images_ready"
        progress = 60 + int((i + 1) / total * 20)
        project.progress_pct = min(progress, 80)
        await db.commit()

    # Pause for human review of generated images
    project.status = "images_review"
    project.current_stage = "image_gen"
    project.progress_pct = 80
    await _log_event(db, project.id, "stage_complete", f"图像生成完成,{total}个Scene待审核")
    await db.commit()


# ── Stage 5: Video Generation ──────────────────────────────────

async def video_gen_stage(db: AsyncSession, project: VideoProject, config: dict):
    project.status = "video_generating"
    project.current_stage = "video_gen"
    project.progress_pct = 82
    await db.commit()

    result = await db.execute(
        select(VideoScene).where(
            VideoScene.project_id == project.id,
            VideoScene.review_status == "approved",
        ).order_by(VideoScene.scene_number)
    )
    scenes = result.scalars().all()

    if not scenes:
        await _log_event(db, project.id, "stage_failed", "没有已审核通过的Scene")
        raise StageError("No approved scenes for video generation")

    api = VolcengineArkClient()
    total = len(scenes)
    media_root = os.path.join(MEDIA_DIR, str(project.id), "scenes")

    for i, scene in enumerate(scenes):
        scene.status = "video_generating"
        await db.commit()

        try:
            prompt = scene.motion_prompt or ""
            if not prompt:
                prompt = scene.image_prompt_zh or ""

            submit = api.submit_video_task(
                prompt=prompt,
                duration=min(scene.duration_seconds or 12, 15),
            )
            task_id = submit.get("task_id", "")
            if not task_id:
                raise RuntimeError("Seedance did not return a task_id")

            result_video = api.wait_for_video(task_id)
            video_url = result_video.get("url", "")
            if video_url:
                video_local = os.path.join(media_root, f"scene_{scene.scene_number}.mp4")
                os.makedirs(os.path.dirname(video_local), exist_ok=True)
                resp = requests.get(video_url, timeout=120)
                resp.raise_for_status()
                with open(video_local, "wb") as f:
                    f.write(resp.content)

                scene.video_segment_url = video_url
                scene.video_segment_local_path = video_local
                scene.video_gen_task_id = task_id

            scene.status = "video_ready"
            await _log_event(db, project.id, "video_generated", f"Scene {scene.scene_number} 视频生成完成", scene_id=scene.id)
        except Exception as e:
            logger.error(f"Scene {scene.scene_number} video failed: {e}")
            scene.status = "failed"
            await _log_event(db, project.id, "stage_failed", f"Scene {scene.scene_number} 视频失败: {e}", scene_id=scene.id)
            await db.commit()
            raise StageError(f"Scene {scene.scene_number} video generation failed: {e}")

        progress = 82 + int((i + 1) / total * 13)
        project.progress_pct = min(progress, 95)
        await db.commit()

    project.progress_pct = 95
    await _log_event(db, project.id, "stage_complete", f"视频生成完成,{total}个Scene")
    await db.commit()


# ── Stage 6: Assemble (FFmpeg) ─────────────────────────────────

async def assemble_stage(db: AsyncSession, project: VideoProject, config: dict):
    """Concatenate video segments + burn subtitles using FFmpeg."""
    project.status = "assembling"
    project.current_stage = "assemble"
    project.progress_pct = 96
    await db.commit()

    from ffmpeg.assembler import assemble_video

    result = await db.execute(
        select(VideoScene).where(VideoScene.project_id == project.id)
        .order_by(VideoScene.scene_number)
    )
    scenes = result.scalars().all()

    # Collect video segment paths (only scenes that have video)
    segment_paths = []
    subtitle_entries = []
    time_offset = 0.0

    for scene in scenes:
        if scene.video_segment_local_path and os.path.exists(scene.video_segment_local_path):
            segment_paths.append(scene.video_segment_local_path)
            dur = scene.duration_seconds or 12
            if scene.subtitle_text:
                subtitle_entries.append({
                    "start": time_offset,
                    "end": time_offset + dur,
                    "text": scene.subtitle_text,
                })
            time_offset += dur

    if not segment_paths:
        await _log_event(db, project.id, "stage_failed", "没有可拼接的视频片段")
        raise StageError("No video segments to assemble")

    output_dir = os.path.join(MEDIA_DIR, str(project.id))
    output_path = os.path.join(output_dir, "final.mp4")
    srt_path = os.path.join(output_dir, "subtitles.srt")

    os.makedirs(output_dir, exist_ok=True)

    # Generate SRT file
    _write_srt(subtitle_entries, srt_path)

    # Run FFmpeg in a thread (blocking)
    try:
        assemble_video(segment_paths, srt_path, output_path)
    except Exception as e:
        await _log_event(db, project.id, "stage_failed", f"FFmpeg合成失败: {e}")
        raise StageError(f"FFmpeg assembly failed: {e}")

    total_dur = sum(s.duration_seconds or 12 for s in scenes if s.video_segment_local_path)

    project.final_video_path = output_path
    project.final_video_url = f"/media/video/{project.id}/final.mp4"
    project.total_duration_seconds = int(total_dur)
    project.status = "done"
    project.current_stage = "assemble"
    project.progress_pct = 100
    await _log_event(db, project.id, "stage_complete", "视频合成完成,项目完成")
    await db.commit()


def _write_srt(entries: list, output_path: str):
    """Write a list of {start, end, text} dicts to an SRT file."""
    with open(output_path, "w", encoding="utf-8") as f:
        for i, entry in enumerate(entries, 1):
            f.write(f"{i}\n")
            f.write(f"{_srt_time(entry['start'])} --> {_srt_time(entry['end'])}\n")
            f.write(f"{entry['text']}\n\n")


def _srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
