"""FFmpeg assembler — concatenates video segments and burns subtitles."""

import subprocess
import logging
import os

logger = logging.getLogger(__name__)


def assemble_video(segment_paths: list[str], srt_path: str, output_path: str) -> str:
    """Concatenate MP4 segments and burn SRT subtitles.

    Args:
        segment_paths: Ordered list of .mp4 file paths to concatenate.
        srt_path: Path to the SRT subtitle file.
        output_path: Path for the final output .mp4 file.

    Returns:
        Path to the final video file.

    Raises:
        subprocess.CalledProcessError: If FFmpeg fails.
        FileNotFoundError: If FFmpeg is not installed.
    """
    if not segment_paths:
        raise ValueError("No video segments to assemble")

    # Check FFmpeg availability
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        raise FileNotFoundError("FFmpeg not found. Install with: apt install ffmpeg")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if len(segment_paths) == 1:
        # Single segment: just burn subtitles
        _burn_subtitles(segment_paths[0], srt_path, output_path)
    else:
        # Multiple segments: concat first, then burn subtitles
        concat_file = output_path + ".concat.txt"
        try:
            with open(concat_file, "w", encoding="utf-8") as f:
                for p in segment_paths:
                    # FFmpeg concat demuxer requires relative or absolute paths
                    abs_path = os.path.abspath(p).replace("\\", "/")
                    f.write(f"file '{abs_path}'\n")

            tmp_output = output_path + ".tmp.mp4"
            subprocess.run([
                "ffmpeg", "-y",
                "-f", "concat", "-safe", "0", "-i", concat_file,
                "-c", "copy",
                tmp_output,
            ], check=True, capture_output=True, text=True)

            _burn_subtitles(tmp_output, srt_path, output_path)

            # Cleanup
            if os.path.exists(tmp_output):
                os.remove(tmp_output)
        finally:
            if os.path.exists(concat_file):
                os.remove(concat_file)

    logger.info(f"Video assembled: {output_path}")
    return output_path


def _burn_subtitles(input_path: str, srt_path: str, output_path: str):
    """Burn SRT subtitles into the video using the subtitles filter."""
    if not os.path.exists(srt_path):
        # No subtitles — just copy
        subprocess.run([
            "ffmpeg", "-y",
            "-i", input_path,
            "-c", "copy",
            output_path,
        ], check=True, capture_output=True, text=True)
        return

    # Escape SRT path for FFmpeg filter (Windows needs backslash escaping, Linux needs colon escaping)
    escaped_srt = srt_path.replace("\\", "/").replace(":", "\\\\:")

    subprocess.run([
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", f"subtitles='{escaped_srt}':force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=1.5,Alignment=2'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        output_path,
    ], check=True, capture_output=True, text=True)
