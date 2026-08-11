# ytmp3ex

YouTube to MP3 browser extension with a local Python backend. Works in Microsoft Edge (Manifest V3).

## Features

- Convert YouTube videos to MP3 from the extension popup
- Injected **Download** button directly on YouTube video pages
- Local backend using `yt-dlp` + `ffmpeg` for reliable conversion
- Docker support for easy backend deployment
- Configurable backend URL and audio quality

## Architecture

```
ytmp3ex/
├── backend/                # Python local server (FastAPI + yt-dlp + ffmpeg)
│   ├── app/
│   │   ├── routes/
│   │   │   └── download.py     # /api/convert, /api/download/{id}
│   │   ├── services/
│   │   │   └── yt_downloader.py # yt-dlp + FFmpegExtractAudio logic
│   │   └── models/
│   │       └── schemas.py      # Pydantic request/response models
│   ├── main.py                 # FastAPI entrypoint
│   ├── requirements.txt        # fastapi, uvicorn, yt-dlp, pydantic
│   └── pyproject.toml
├── extension/                  # Manifest V3 browser extension
│   ├── manifest.json
│   ├── popup/                  # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── content/                # YouTube page injection
│   │   └── content.js
│   ├── background/
│   │   └── service-worker.js
│   └── options/                # Settings page
│       ├── options.html
│       └── options.js
├── build/                      # Packaging/versioning scripts
├── tests/                      # Shared tests
└── dist/                       # Build artifacts
```

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

1. Open any YouTube video
2. Click the ytmp3ex icon in the Edge toolbar
3. Click **Convert to MP3**
4. The MP3 downloads automatically via Edge's download manager

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

The backend runs on `http://localhost:8000` and exposes two endpoints:

### POST /api/convert

Converts a YouTube video to MP3.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "id": "VIDEO_ID",
  "title": "Video Title",
  "duration": 180,
  "thumbnail": "https://...",
  "uploader": "Channel Name",
  "file_path": "/app/downloads/VIDEO_ID.mp3"
}
```

### GET /api/download/{video_id}

Downloads the converted MP3 file.

```bash
curl -L http://localhost:8000/api/download/VIDEO_ID -o output.mp3
```

### GET /health

Health check endpoint.

## Backend API Flow

```
Browser Extension          Backend (FastAPI)
      |                           |
      |--- POST /api/convert --->|
      |                           |-- yt-dlp extracts info & downloads audio
      |                           |-- ffmpeg converts to MP3
      |<-- JSON with video info --|
      |                           |
      |--- GET /api/download/:id ->|
      |<-- MP3 file -------------|
      |                           |
```

## Manual Backend Setup (Without Docker)

If you prefer running the backend directly:

```bash
# Create virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run the server
python backend/main.py
```

## Troubleshooting

### "Couldn't download" in Edge

- Ensure the backend is running: `curl http://localhost:8000/health`
- Ensure the extension has the `downloads` permission (included in manifest)
- Reload the extension after making changes

### "Failed to convert"

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
