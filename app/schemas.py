import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl, model_validator

ALLOWED_ATTRS = {"alt", "lang", "tabindex", "title", "role", "content"}
ALLOWED_STYLES = {"color", "background-color", "min-width", "min-height", "outline", "font-size"}


class PatchAction(BaseModel):
    """A single safe, reversible DOM change. The only thing the LLM/VLM can ever produce."""
    selector: str = Field(min_length=1, max_length=500)
    action: Literal["set_attr", "remove_attr", "set_style", "set_text", "insert_html"]
    name: Optional[str] = None
    value: Optional[str] = None
    position: Optional[Literal["beforebegin", "afterbegin", "beforeend", "afterend"]] = None

    @model_validator(mode="after")
    def _safe(self):
        a = self.action
        if a in ("set_attr", "remove_attr"):
            if not self.name or not (self.name in ALLOWED_ATTRS or self.name.startswith("aria-")):
                raise ValueError(f"attribute not allowed: {self.name}")
        if a == "set_style" and self.name not in ALLOWED_STYLES:
            raise ValueError(f"style not allowed: {self.name}")
        if a in ("set_attr", "set_style", "set_text", "insert_html") and self.value is None:
            raise ValueError("value required")
        v = (self.value or "").lower()
        if "javascript:" in v:
            raise ValueError("unsafe value")
        if a == "insert_html" and (
            re.search(r"<\s*(script|iframe|object|embed)", v) or re.search(r"\son\w+\s*=", v)
        ):
            raise ValueError("unsafe html")
        return self


class ScanCreate(BaseModel):
    url: Optional[HttpUrl] = None
    html: Optional[str] = Field(default=None, max_length=2_000_000)

    @model_validator(mode="after")
    def _one(self):
        if bool(self.url) == bool(self.html):
            raise ValueError("provide exactly one of url or html")
        return self


class FeedbackIn(BaseModel):
    decision: Literal["accept", "reject", "edit"]
    edited_value: Optional[str] = None
