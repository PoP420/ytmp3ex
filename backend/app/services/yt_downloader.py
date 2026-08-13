import os
from pathlib import Path
from typing import Optional
from yt_dlp import YoutubeDL

DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "/app/downloads"))
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_video_info(url: str) -> dict:
    ydl_opts = {"quiet": True, "no_warnings": True, "socket_timeout": 30}
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "id": info.get("id"),
        "title": info.get("title"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "uploader": info.get("uploader"),
    }


def download_audio(url: str, output_template: Optional[str] = None) -> str:
    out = output_template or str(DOWNLOAD_DIR / "%(id)s.%(ext)s")
    ydl_opts = {
        "format": "bestaudio",
        "outtmpl": out,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "keepvideo": False,
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
    filename = ydl.prepare_filename(info)
    base = os.path.splitext(filename)[0]
    mp3_path = base + ".mp3"
    if not os.path.exists(mp3_path):
        raise FileNotFoundError(f"Converted file not found: {mp3_path}")
    return mp3_path
