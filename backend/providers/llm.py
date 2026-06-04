"""LLM provider — wraps Dify/Dify workflow API for SKILL pipeline calls."""
import os
import re
import requests
import logging

logger = logging.getLogger(__name__)

DIFY_API_URL = os.getenv("DIFY_API_URL", "http://127.0.0.1:8888/v1")
DIFY_API_KEY = os.getenv("DIFY_API_KEY", "")
DIFY_VIDEO_API_KEY = os.getenv("DIFY_VIDEO_API_KEY", "") or DIFY_API_KEY


def _strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks from DeepSeek R1 reasoning output."""
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()


def extract_json(text: str) -> str:
    """Extract a JSON object from LLM output, stripping thinking blocks,
    code fences, and any text outside the outermost { ... }.
    """
    text = _strip_thinking(text)
    # strip markdown code fences
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    # extract from first { to last }
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        text = text[start:end + 1]
    return text


def call_dify_chat(query: str, api_key: str = "", timeout: int = 180) -> str:
    """Call Dify chat-messages API synchronously. Returns answer text."""
    key = api_key or DIFY_VIDEO_API_KEY or DIFY_API_KEY
    if not key:
        raise RuntimeError("No Dify API key configured for video pipeline")

    try:
        resp = requests.post(
            f"{DIFY_API_URL}/chat-messages",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "inputs": {},
                "query": query,
                "response_mode": "blocking",
                "user": "video-pipeline",
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        answer = data.get("answer", "")
        return _strip_thinking(answer)
    except Exception as e:
        logger.error(f"Dify chat failed: {e}")
        raise


def call_dify_workflow(inputs: dict, api_key: str = "", timeout: int = 300) -> dict:
    """Call Dify workflow API. Returns the outputs dict."""
    key = api_key or DIFY_VIDEO_API_KEY or DIFY_API_KEY
    if not key:
        raise RuntimeError("No Dify API key configured for video pipeline")

    try:
        resp = requests.post(
            f"{DIFY_API_URL}/workflows/run",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"inputs": inputs, "response_mode": "blocking", "user": "video-pipeline"},
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", {}).get("outputs", {})
    except Exception as e:
        logger.error(f"Dify workflow failed: {e}")
        raise
