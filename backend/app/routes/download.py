from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from app.models.schemas import ConvertRequest, VideoInfo
from app.services.yt_downloader import get_video_info, download_audio, DOWNLOAD_DIR

router = APIRouter()


@router.post("/convert", response_model=VideoInfo)
def convert(req: ConvertRequest):
    try:
        info = get_video_info(req.url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch video info: {exc}") from exc
    try:
        path = download_audio(req.url)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to convert: {exc}") from exc
    info["file_path"] = path
    return info


@router.get("/download/{video_id}")
def download(video_id: str):
    file = DOWNLOAD_DIR / f"{video_id}.mp3"
    if not file.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file, filename=f"{video_id}.mp3", media_type="audio/mpeg")
