from fastapi import APIRouter, Header

router = APIRouter()

@router.post("/heartbeat")
def heartbeat(authorization: str = Header(None)):
    # validate token here
    return {"status": "ok"}