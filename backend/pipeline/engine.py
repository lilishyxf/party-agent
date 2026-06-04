"""Pipeline state machine — orchestrates the 6-stage video production pipeline.

The engine runs each stage sequentially. At human-review gates, it stops
and marks the project status for UI polling. The UI calls the "advance"
endpoint to continue past each gate.
"""
import asyncio
import logging
import threading
import yaml
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from models_video import VideoProject
from pipeline.stages import (
    align_stage, narrate_stage, promptgen_stage, char_ref_stage,
    image_gen_stage, video_gen_stage, assemble_stage,
    StageError,
)

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "skill_config.yaml"

# Map pipeline stage keys to functions
STAGE_MAP = {
    "align": align_stage,
    "narrate": narrate_stage,
    "prompt_gen": promptgen_stage,
    "char_ref": char_ref_stage,
    "image_gen": image_gen_stage,
    "video_gen": video_gen_stage,
    "assemble": assemble_stage,
}

# Stages that stop and wait for human review before continuing
REVIEW_GATE_STAGES = {"prompts_review", "images_review"}


class PipelineEngine:
    """Orchestrates async pipeline execution for one video project."""

    def __init__(self, session_factory: async_sessionmaker):
        self.session_factory = session_factory
        self.config = self._load_config()

    def _load_config(self) -> dict:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def start_in_thread(self, project_id: int):
        """Launch pipeline in a background daemon thread.

        Called from FastAPI route handler. Spawns a thread that runs
        the async pipeline via asyncio.run().
        """
        t = threading.Thread(target=self._run_sync, args=(project_id,), daemon=True)
        t.start()
        logger.info(f"Pipeline started for project {project_id}")

    def _run_sync(self, project_id: int):
        """Synchronous wrapper that creates an event loop and runs the async pipeline."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self.run(project_id))
        except Exception as e:
            logger.exception(f"Pipeline for project {project_id} crashed: {e}")
        finally:
            loop.close()

    async def run(self, project_id: int):
        """Execute the full pipeline. Stops at review gates."""
        stage_order = [s["key"] for s in self.config.get("pipeline_stages", [])]

        async with self.session_factory() as db:
            for stage_key in stage_order:
                try:
                    # Reload project to get latest status
                    from sqlalchemy import select
                    result = await db.execute(select(VideoProject).where(VideoProject.id == project_id))
                    project = result.scalar_one_or_none()
                    if not project:
                        logger.error(f"Project {project_id} not found")
                        return

                    # Skip if project was cancelled
                    if project.status == "cancelled":
                        logger.info(f"Project {project_id} was cancelled, stopping pipeline")
                        return

                    # Skip if we're at a review gate (not ready to continue)
                    if project.status in REVIEW_GATE_STAGES:
                        # Find which stage to run next based on status
                        if project.status == "prompts_review" and stage_key in ("align", "narrate", "prompt_gen"):
                            continue  # Already done, waiting for review
                        if project.status == "images_review" and stage_key in ("align", "narrate", "prompt_gen", "char_ref", "image_gen"):
                            continue  # Already done, waiting for review

                    stage_fn = STAGE_MAP.get(stage_key)
                    if not stage_fn:
                        logger.warning(f"Unknown stage: {stage_key}")
                        continue

                    logger.info(f"Running stage '{stage_key}' for project {project_id}")
                    await stage_fn(db, project, self.config)

                    # Check if we should pause for review
                    from sqlalchemy import select as _select
                    result2 = await db.execute(_select(VideoProject).where(VideoProject.id == project_id))
                    project = result2.scalar_one_or_none()
                    if project and project.status in REVIEW_GATE_STAGES:
                        logger.info(f"Pipeline paused at review gate for project {project_id}: {project.status}")
                        return

                except StageError as e:
                    logger.error(f"Stage '{stage_key}' failed for project {project_id}: {e}")
                    async with self.session_factory() as err_db:
                        result3 = await err_db.execute(select(VideoProject).where(VideoProject.id == project_id))
                        proj = result3.scalar_one_or_none()
                        if proj:
                            proj.status = "failed"
                            proj.error_message = str(e)
                            await err_db.commit()
                    return

    async def continue_past_review(self, project_id: int):
        """Resume pipeline after human review approval.

        Determines the next stage to run based on current project status
        and continues from there.
        """
        async with self.session_factory() as db:
            from sqlalchemy import select as _sel
            result = await db.execute(_sel(VideoProject).where(VideoProject.id == project_id))
            project = result.scalar_one_or_none()
            if not project:
                return

            stage_order = [s["key"] for s in self.config.get("pipeline_stages", [])]

            if project.status == "prompts_review":
                # After prompts review → run image_gen, video_gen, assemble
                stages_to_run = ["image_gen", "video_gen", "assemble"]
            elif project.status == "images_review":
                # After images review → run video_gen, assemble
                stages_to_run = ["video_gen", "assemble"]
            else:
                logger.warning(f"Cannot continue from status: {project.status}")
                return

            self.start_in_thread(project_id)
            # The Thread approach: we just relaunch from the beginning.
            # The engine will skip already-completed stages based on project status.
