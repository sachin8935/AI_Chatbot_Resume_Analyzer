from fastapi import FastAPI , UploadFile , HTTPException

from llm.chatbot import router as chatbot_router
from user.session import router as user_router
app = FastAPI()
app.include_router(chatbot_router)
app.include_router(user_router)

@app.get("/",status_code=200)
def home():
    return{"fastapi is running"}
