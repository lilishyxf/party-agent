"""Abstract interfaces for swappable media generation providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ImageGenRequest:
    prompt_zh: str
    prompt_en: str = ""
    aspect_ratio: str = "16:9"
    reference_image_url: str | None = None
    negative_prompt: str = ""


@dataclass
class ImageGenResult:
    image_url: str = ""
    local_path: str | None = None
    task_id: str | None = None
    cost_cny: float = 0.0


@dataclass
class VideoGenRequest:
    start_frame_path: str
    end_frame_path: str | None = None
    prompt: str = ""
    narration_text: str = ""
    duration_seconds: int = 12


@dataclass
class VideoGenResult:
    video_url: str = ""
    local_path: str | None = None
    task_id: str | None = None
    cost_cny: float = 0.0
    duration_seconds: int = 0


class ImageGenerator(ABC):
    provider_name: str = ""

    @abstractmethod
    async def generate(self, request: ImageGenRequest) -> ImageGenResult: ...

    @abstractmethod
    async def check_status(self, task_id: str) -> ImageGenResult | None: ...


class VideoGenerator(ABC):
    provider_name: str = ""

    @abstractmethod
    async def generate(self, request: VideoGenRequest) -> VideoGenResult: ...

    @abstractmethod
    async def check_status(self, task_id: str) -> VideoGenResult | None: ...
