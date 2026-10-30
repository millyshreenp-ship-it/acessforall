import pytest
from pydantic import ValidationError

from app.schemas import PatchAction
from app.services.fixers.rules import contrast, fix_contrast_color, _hex2rgb
from app.services.report import wcag_refs


def test_contrast_fix_meets_ratio():
    out = fix_contrast_color("#999999", "#ffffff", 4.5)
    assert contrast(_hex2rgb(out), _hex2rgb("#ffffff")) >= 4.5


def test_contrast_fix_on_dark_background():
    out = fix_contrast_color("#555555", "#111111", 4.5)
    assert contrast(_hex2rgb(out), _hex2rgb("#111111")) >= 4.5


def test_patch_whitelist():
    PatchAction(selector="#a", action="set_attr", name="aria-label", value="Search")
    PatchAction(selector="img", action="set_attr", name="alt", value="")
    for bad in [
        dict(action="set_attr", name="onclick", value="x()"),
        dict(action="set_attr", name="href", value="javascript:alert(1)"),
        dict(action="insert_html", value="<script>x</script>", position="afterbegin"),
        dict(action="insert_html", value='<a onclick="x()">', position="afterbegin"),
        dict(action="set_style", name="position", value="fixed"),
    ]:
        with pytest.raises(ValidationError):
            PatchAction(selector="#a", **bad)


def test_wcag_refs():
    assert wcag_refs(["cat.color", "wcag2aa", "wcag143", "wcag1410"]) == ["1.4.10", "1.4.3"]
