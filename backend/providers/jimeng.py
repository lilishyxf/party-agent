"""Volcengine Ark provider — image (Seedream) and video (Seedance) generation.

Uses Volcengine Ark API with API Key auth. OpenAI-compatible endpoints.

Env vars:
  VOLCENGINE_API_KEY   — Ark API key (required)
  VOLCENGINE_ARK_URL   — base URL (default: https://ark.cn-beijing.volces.com/api/v3)
"""
import os
import time
import logging
import requests

from providers.base import ImageGenerator, VideoGenerator, ImageGenRequest, ImageGenResult, VideoGenRequest, VideoGenResult

logger = logging.getLogger(__name__)

ARK_URL = os.getenv("VOLCENGINE_ARK_URL", "https://ark.cn-beijing.volces.com/api/v3")
API_KEY = os.getenv("VOLCENGINE_API_KEY", "")

# Models (overridable via env vars)
IMAGE_MODEL = os.getenv("VOLCENGINE_IMAGE_MODEL", "doubao-seedream-4.0")
VIDEO_MODEL = os.getenv("VOLCENGINE_VIDEO_MODEL", "doubao-seedance-2.0-pro")

# Seedance 2.0 VIP: supports up to 10s/segment, 1080p
DEFAULT_DURATION = int(os.getenv("VOLCENGINE_VIDEO_DURATION", "10"))
DEFAULT_SIZE = os.getenv("VOLCENGINE_VIDEO_SIZE", "1920x1080")

# Pricing (CNY — update from Volcengine console)
IMAGE_COST_PER_IMAGE = 0.12
VIDEO_COST_PER_SECOND = 0.25


class VolcengineArkClient:
    """Low-level HTTP client for Volcengine Ark API (OpenAI-compatible)."""

    def __init__(self, api_key: str = "", base_url: str = ""):
        self.base_url = (base_url or ARK_URL).rstrip("/")
        self.api_key = api_key or API_KEY
        if not self.api_key:
            logger.warning("VOLCENGINE_API_KEY not set — Volcengine Ark calls will fail")

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def text_to_image(self, prompt: str, model: str = "",
                      aspect_ratio: str = "16:9", negative_prompt: str = "",
                      reference_image_url: str = "") -> dict:
        """Generate a single image via OpenAI-compatible endpoint.

        If reference_image_url is provided, the image is downloaded, base64-encoded,
        and sent as the ``image`` parameter for img2img / reference-based generation.

        Returns {"url": ..., "task_id": ...}.
        """
        import base64 as _b64
        model = model or IMAGE_MODEL
        size = "1792x1024" if aspect_ratio == "16:9" else "1024x1024"
        body: dict = {
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": size,
        }
        if negative_prompt:
            body["negative_prompt"] = negative_prompt

        if reference_image_url:
            try:
                ref_resp = requests.get(reference_image_url, timeout=60)
                ref_resp.raise_for_status()
                body["image"] = _b64.b64encode(ref_resp.content).decode("utf-8")
            except Exception as e:
                logger.warning(f"Failed to download reference image {reference_image_url}: {e}")

        resp = requests.post(
            f"{self.base_url}/v1/images/generations",
            headers=self._headers(),
            json=body,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        images = data.get("data", [])
        if images:
            return {"url": images[0].get("url", ""), "task_id": data.get("id", "")}
        raise RuntimeError(f"Seedream returned no images: {data}")

    def submit_video_task(self, prompt: str, model: str = "",
                          duration: int = None, size: str = "",
                          start_frame_url: str = "", end_frame_url: str = "") -> dict:
        """Submit an async video generation task to Seedance 2.0.
        Returns {"task_id": ...}.
        """
        model = model or VIDEO_MODEL
        size = size or DEFAULT_SIZE
        duration = duration or DEFAULT_DURATION
        body = {
            "model": model,
            "prompt": prompt,
            "duration": duration,
            "size": size,
        }
        if start_frame_url:
            body["image_url"] = start_frame_url
        if end_frame_url:
            body["last_frame_url"] = end_frame_url

        resp = requests.post(
            f"{self.base_url}/v1/video/generations",
            headers=self._headers(),
            json=body,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"task_id": data.get("id", data.get("task_id", ""))}

    def poll_video_task(self, task_id: str) -> dict:
        """Poll a video generation task.
        Returns {"status": "pending|processing|succeeded|failed", "url": "...", "error": "..."}.
        """
        resp = requests.get(
            f"{self.base_url}/v1/video/generations/{task_id}",
            headers=self._headers(),
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        status = data.get("status", "unknown")
        url = ""
        if status == "succeeded":
            video_data = data.get("video", data.get("output", {}))
            url = video_data.get("url", "") if isinstance(video_data, dict) else ""
            # Alternative response shape: data.result_url
            if not url:
                url = data.get("result_url", "")

        return {"status": status, "url": url, "error": data.get("error", {}).get("message", "") if isinstance(data.get("error"), dict) else ""}

    def wait_for_video(self, task_id: str, poll_interval: int = 10, timeout: int = 600) -> dict:
        """Poll until video task completes or times out.
        Returns {"url": "...", "task_id": "..."} or raises TimeoutError.
        """
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = self.poll_video_task(task_id)
            status = result["status"]
            if status == "succeeded":
                return {"url": result["url"], "task_id": task_id}
            if status == "failed":
                raise RuntimeError(f"Video generation failed: {result.get('error', 'unknown')}")
            time.sleep(poll_interval)
        raise TimeoutError(f"Video task {task_id} timed out after {timeout}s")


class VolcengineImageGen(ImageGenerator):
    """Image generation via Volcengine Ark (Seedream)."""

    provider_name = "volcengine_seedream"

    def __init__(self, client: VolcengineArkClient = None):
        self.client = client or VolcengineArkClient()

    async def generate(self, request: ImageGenRequest) -> ImageGenResult:
        prompt = request.prompt_zh or request.prompt_en
        if not prompt:
            raise ValueError("Image prompt is empty")

        full_prompt = f"{prompt}, 画面中不要有任何文字, no text, no watermark"
        try:
            result = self.client.text_to_image(
                prompt=full_prompt,
                aspect_ratio=request.aspect_ratio,
                negative_prompt=request.negative_prompt or "text, letters, words, watermark, logo",
            )
            return ImageGenResult(
                image_url=result.get("url", ""),
                task_id=result.get("task_id", ""),
                cost_cny=IMAGE_COST_PER_IMAGE,
            )
        except Exception as e:
            logger.error(f"Seedream image generation failed: {e}")
            raise

    async def check_status(self, task_id: str) -> ImageGenResult | None:
        return None  # sync generation, no polling needed


class VolcengineVideoGen(VideoGenerator):
    """Video generation via Volcengine Ark (Seedance)."""

    provider_name = "volcengine_seedance"

    def __init__(self, client: VolcengineArkClient = None):
        self.client = client or VolcengineArkClient()

    async def generate(self, request: VideoGenRequest) -> VideoGenResult:
        if not request.prompt:
            raise ValueError("Video prompt is empty")

        try:
            submit = self.client.submit_video_task(
                prompt=request.prompt,
                duration=request.duration_seconds,
                start_frame_url=request.start_frame_path if request.start_frame_path.startswith("http") else "",
                end_frame_url=request.end_frame_path if (request.end_frame_path or "").startswith("http") else "",
            )
            task_id = submit.get("task_id", "")
            if not task_id:
                raise RuntimeError("No task_id returned from Seedance submit")

            result = self.client.wait_for_video(task_id)
            cost = round(request.duration_seconds * VIDEO_COST_PER_SECOND, 2)
            return VideoGenResult(
                video_url=result.get("url", ""),
                task_id=task_id,
                cost_cny=cost,
                duration_seconds=request.duration_seconds,
            )
        except Exception as e:
            logger.error(f"Seedance video generation failed: {e}")
            raise

    async def check_status(self, task_id: str) -> VideoGenResult | None:
        try:
            result = self.client.poll_video_task(task_id)
            if result["status"] == "succeeded" and result.get("url"):
                return VideoGenResult(video_url=result["url"], task_id=task_id)
        except Exception as e:
            logger.error(f"Seedance poll failed: {e}")
        return None
