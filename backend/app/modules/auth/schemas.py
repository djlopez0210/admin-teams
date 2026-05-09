"""Pydantic/DTO schemas for auth endpoints (optional scaffold)."""

try:
    from pydantic import BaseModel
except Exception:  # pragma: no cover
    BaseModel = object  # type: ignore


class LoginDTO(BaseModel):
    username: str
    password: str


class RegisterDTO(BaseModel):
    username: str
    password: str
