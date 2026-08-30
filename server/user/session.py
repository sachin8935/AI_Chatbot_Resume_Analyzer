from fastapi import APIRouter , HTTPException
from pydantic import BaseModel
import hashlib
from config import redis
router = APIRouter()

class User(BaseModel):
    email:str

@router.post('/create-session',status_code=200)
async def create_user_session(user:User):
    if redis is None:
        raise HTTPException(status_code=500, detail="Redis is not configured")
    email = user.email.strip().lower()
    data = hashlib.sha256(
        email.encode("utf-8")
    ).hexdigest()
    response = redis.get(data)
    if response is None:
         redis.set(data,'active',ex=3600)
    return{
        "message":"success",
        "data":data
    }

