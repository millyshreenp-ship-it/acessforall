from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Patch
from ..schemas import FeedbackIn, PatchAction

router = APIRouter(tags=["patches"])


@router.post("/patches/{patch_id}/feedback")
def feedback(patch_id: int, body: FeedbackIn, db: Session = Depends(get_db)):
    p = db.get(Patch, patch_id)
    if not p:
        raise HTTPException(404, "patch not found")
    if body.decision == "edit":
        if body.edited_value is None:
            raise HTTPException(400, "edited_value required")
        a = {**p.action, "value": body.edited_value}
        try:
            PatchAction(**a)
        except ValidationError as e:
            raise HTTPException(422, str(e))
        p.action, p.source, p.status = a, "human", "edited"
    else:
        p.status = "accepted" if body.decision == "accept" else "rejected"
    db.commit()
    return {"id": p.id, "status": p.status, "action": p.action}
