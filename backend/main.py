from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import download

app = FastAPI(title="ytmp3ex Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(download.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}
