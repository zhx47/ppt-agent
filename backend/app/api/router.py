from fastapi import APIRouter

from app.api.routes.outline import router as outline_router
from app.api.routes.pages import router as pages_router
from app.api.routes.projects import router as projects_router
from app.api.routes.requirements import router as requirements_router

api_router = APIRouter()
api_router.include_router(projects_router)
api_router.include_router(requirements_router)
api_router.include_router(outline_router)
api_router.include_router(pages_router)

