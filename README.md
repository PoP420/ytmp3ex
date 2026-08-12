# ytmp3ex

YouTube to MP3 browser extension with a local Python backend. Works in Microsoft Edge (Manifest V3).

## Features

- Convert YouTube videos to MP3 from the extension popup
- Injected **Download** button directly on YouTube video pages
- **Persistent conversions**: closing the popup or switching tabs no longer cancels downloads
- **Queue & history**: track multiple conversions and retry failed ones
- **Progress tracking**: real-time download/convert progress in the popup
- **Desktop notifications**: get notified when conversion completes
- **Configurable quality**: choose MP3 bitrate from Settings
- Local backend using `yt-dlp` + `ffmpeg` for reliable conversion
- Docker support for easy backend deployment

## Architecture

```
ytmp3ex/
├── backend/                # Python local server (FastAPI + yt-dlp + ffmpeg)
│   ├── app/
│   │   ├── routes/
│   │   │   └── download.py     # /api/convert, /api/convert/async, /api/jobs/{id}, /api/download/{id}
│   │   ├── services/
│   │   │   └── yt_downloader.py # yt-dlp + FFmpegExtractAudio logic
│   │   └── models/
│   │       └── schemas.py      # Pydantic request/response models
│   ├── main.py                 # FastAPI entrypoint
│   ├── requirements.txt        # fastapi, uvicorn, yt-dlp, pydantic
│   └── pyproject.toml
├── extension/                  # Manifest V3 browser extension
│   ├── manifest.json
│   ├── popup/                  # Extension popup UI (Queue / History / Convert)
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── background/
│   │   └── service-worker.js   # Persistent conversion manager + alarms + notifications
│   ├── content/                # YouTube page injection
│   │   └── content.js
│   └── options/                # Settings page
│       ├── options.html
│       └── options.js
├── build/                      # Packaging/versioning scripts
├── tests/                      # Shared tests
└── dist/                       # Build artifacts
```

## How it works

1. Extension sends conversion request to backend via `/api/convert/async`
2. Backend starts conversion in a background thread and returns a `job_id`
3. Service worker polls `/api/jobs/{job_id}` using Chrome Alarms
4. When complete, service worker triggers Edge download and shows a desktop notification
5. Popup shows live progress, queue, and conversion history

This means you can close the popup, switch tabs, or even close Edge — the service worker keeps running and finishes the job.

## Prerequisites

- Python 3.11+
- Docker Desktop (recommended for backend)
- Microsoft Edge
- ffmpeg (included in Docker image)

## Quick Start with Docker (Recommended)

1. Start Docker Desktop
2. Run the backend:

```bash
cd C:\Users\ajdpe\tools\ytmp3ex
docker compose up -d --build
```

3. Verify the backend is running:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

## Install the Extension in Edge

1. Open Edge and go to `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the extension folder:
   ```
   C:\Users\ajdpe\tools\ytmp3ex\extension
   ```
5. Pin the extension to your toolbar

## Usage

### From the Popup

1. Open any YouTube video (or paste any URL)
2. Click the ytmp3ex icon in the Edge toolbar
3. Paste a YouTube URL and click **Convert**
4. Watch progress in the **Queue** tab
5. The MP3 downloads automatically via Edge's download manager when done

### From YouTube Page

1. Open any YouTube video
2. Click the extension icon → **Settings**
3. Check **Auto convert on YouTube page** → **Save**
4. Refresh the YouTube page
5. A **Download** button appears near the like/dislike buttons
6. Click it to convert and download

## Configuration

Open the extension **Settings** to configure:

- **Backend URL** — Default is `http://localhost:8000`
- **Quality (kbps)** — Audio quality for conversion (default: `192`)
- **Auto convert on YouTube page** — Automatically inject the Download button on YouTube

## Backend API

The backend runs on `http://localhost:8000` and exposes:

### POST /api/convert

Synchronous conversion (blocks until done).

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "quality": "192"
}
```

### POST /api/convert/async

Starts conversion in background and returns immediately.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "quality": "192"
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "queued"
}
```

### GET /api/jobs/{job_id}

Returns current job status and progress.

### GET /api/download/{job_id}

Downloads the converted MP3 file.

### GET /health

Health check endpoint.

## Improvements for large files and long music

- yt-dlp is configured with `bestaudio/best`, `nocheckcertificate`, and progress hooks for reliable long-running downloads
- Backend runs conversions in daemon threads with extended timeout (10 minutes)
- Frontend uses polling via Chrome Alarms so the service worker stays alive between checks
- Popup shows real-time download/convert progress so you can track long conversions

## Troubleshooting

### Backend unreachable

- Ensure the backend is running: `curl http://localhost:8000/health`
- Check the backend URL in Settings matches your backend
- If using Docker, ensure port 8000 is not in use

### Conversion failed

- Check backend logs: `docker logs ytmp3ex-backend-1`
- Ensure `ffmpeg` is installed (included in Docker image)
- Some videos may be geo-restricted or age-restricted

### Button not appearing on YouTube

- Enable **Auto convert on YouTube page** in Settings
- Refresh the YouTube page
- YouTube's DOM changes frequently; if the button doesn't appear, open DevTools and inspect the like/dislike button container

### Docker not starting

- Ensure Docker Desktop is running
- Check port 8000 is not in use

## Development

### Project Structure

- `backend/` — FastAPI application
- `extension/` — Edge extension source
- `build/` — Python packaging scripts

### Running Tests

```bash
pytest
```

## Legal

Respect YouTube's Terms of Service and copyright law. Only download content you own or have permission to download.

## License

MIT
