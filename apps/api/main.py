import re

from fastapi import FastAPI, Request
from fastapi.responses import Response

from api.routes.expedients import router as expedients_router
from api.routes.intake import router as intake_router
from api.routes.geo import router as geo_router
from api.routes.escalations import router as escalations_router

app = FastAPI(
    title="DOM Permit Review AI",
    description="AI-assisted building permit review for Chilean municipalities",
    version="0.1.0",
)

_ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://localhost:3001",
    "https://dom-permit-review-a3km.vercel.app",
}
_ORIGIN_RE = re.compile(r"https://dom-permit-review-.*\.vercel\.app")


def _cors_headers(origin: str) -> dict:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
        "Access-Control-Max-Age": "86400",
    }


@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin", "")
    allowed = origin in _ALLOWED_ORIGINS or bool(_ORIGIN_RE.fullmatch(origin))

    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers=_cors_headers(origin) if allowed else {},
        )

    response = await call_next(request)

    if allowed:
        for key, value in _cors_headers(origin).items():
            response.headers[key] = value

    return response


app.include_router(expedients_router, prefix="/api/v1")
app.include_router(intake_router, prefix="/api/v1")
app.include_router(geo_router, prefix="/api/v1")
app.include_router(escalations_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
