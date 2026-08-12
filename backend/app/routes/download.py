import os
import time
import uuid
import threading
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from yt_dlp import YoutubeDL

from app.models.schemas import ConvertRequest, VideoInfo

router = APIRouter()

DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "/app/downloads"))
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

jobs: Dict[str, Dict[str, Any]] = {}
jobs_lock = threading.Lock()


def _update_job(job_id: str, **kwargs):
    with jobs_lock:
        jobs[job_id].update(kwargs)


def _run_conversion(job_id: str, url: str, quality: str):
    try:
        _update_job(job_id, status="processing", progress=0, message="Starting...")

        def progress_hook(d):
            if d.get("status") == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes", 0)
                if total > 0:
                    pct = min(int((downloaded / total) * 100), 99)
                    _update_job(job_id, progress=pct, message=f"Downloading... {pct}%")
            elif d.get("status") == "processing":
                _update_job(job_id, progress=95, message="Converting to MP3...")

        out_template = str(DOWNLOAD_DIR / f"{job_id}.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "extract_flat": False,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": quality,
                }
            ],
            "keepvideo": False,
            "nocheckcertificate": True,
            "ignoreerrors": False,
            "no_warnings": True,
            "progress_hooks": [progress_hook],
        }

        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

        filename = ydl.prepare_filename(info)
        base = os.path.splitext(filename)[0]
        mp3_path = base + ".mp3"

        if not os.path.exists(mp3_path):
            raise FileNotFoundError(f"Converted file not found: {mp3_path}")

        title = info.get("title", f"{job_id}")
        _update_job(
            job_id,
            status="completed",
            progress=100,
            message="Done",
            title=title,
            duration=info.get("duration"),
            thumbnail=info.get("thumbnail"),
            uploader=info.get("uploader"),
            file_path=mp3_path,
        )
    except Exception as exc:
        _update_job(job_id, status="failed", message=f"Error: {exc}")


@router.post("/convert", response_model=VideoInfo)
def convert(req: ConvertRequest):
    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "id": job_id,
            "status": "processing",
            "progress": 0,
            "message": "Queued...",
            "url": req.url,
        }
    thread = threading.Thread(target=_run_conversion, args=(job_id, req.url, req.quality or "192"), daemon=True)
    thread.start()

    start = time.time()
    while thread.is_alive():
        thread.join(timeout=0.5)
        if time.time() - start > 600:
            raise HTTPException(status_code=504, detail="Conversion timed out")

    job = jobs[job_id]
    if job["status"] == "failed":
        raise HTTPException(status_code=500, detail=job["message"])

    return VideoInfo(
        id=job_id,
        title=job.get("title"),
        duration=job.get("duration"),
        thumbnail=job.get("thumbnail"),
        uploader=job.get("uploader"),
        file_path=job.get("file_path"),
    )


@router.post("/convert/async")
def convert_async(req: ConvertRequest):
    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "progress": 0,
            "message": "Queued...",
            "url": req.url,
        }
    thread = threading.Thread(target=_run_conversion, args=(job_id, req.url, req.quality or "192"), daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/download/{job_id}")
def download(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="File not ready")
    file = Path(job.get("file_path", ""))
    if not file.exists():
        raise HTTPException(status_code=404, detail="File not found")
    title = job.get("title") or job_id
    return FileResponse(path=file, filename=f"{title}.mp3", media_type="audio/mpeg")


@router.get("/jobs")
def list_jobs():
    with jobs_lock:
        return list(jobs.values())
