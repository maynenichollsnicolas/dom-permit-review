from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.expedients import router as expedients_router
from api.routes.intake import router as intake_router
from api.routes.geo import router as geo_router

app = FastAPI(
    title="DOM Permit Review AI",
    description="AI-assisted building permit review for Chilean municipalities",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(expedients_router, prefix="/api/v1")
app.include_router(intake_router, prefix="/api/v1")
app.include_router(geo_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
