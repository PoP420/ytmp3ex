from pydantic import BaseModel, Field


class ConvertRequest(BaseModel):
    url: str = Field(..., min_length=10)


class VideoInfo(BaseModel):
    id: str
    title: str
    duration: int | None = None
    thumbnail: str | None = None
    uploader: str | None = None
    file_path: str | None = None
