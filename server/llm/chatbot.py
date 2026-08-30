from openai import OpenAI
from dotenv import load_dotenv
from fastapi import APIRouter , UploadFile , File , HTTPException , Form
from io import BytesIO
from pypdf import PdfReader
from pydantic import BaseModel
from config import redis
import json
load_dotenv()
client = OpenAI()
router = APIRouter()

@router.post('/prepare-chat',status_code=200)
async def get_chat_response(file: UploadFile = File(...), session_id: str = Form(...)):
    redis.set(session_id,'active',keepttl=True)
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only pdf files are allowed"
        )
    content= await file.read()

    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Could not verify if the file is in pdf format"
            )
    reader = PdfReader(BytesIO(content))
    pdf_data=[]
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            pdf_data.append(page_text)
    chat_list=[
    {'role':'system','content':'You are a senior software enginner and can answer any questions from the resume'},
    {'role':'user','content':pdf_data[0]}
    ]
    redis.set(session_id, json.dumps(chat_list),keepttl=True)




class chatUser(BaseModel):
    session_id:str
    prompt:str

@router.post("/chat",status_code=200)
async def chatwithAI(user:chatUser):
    data=redis.get(user.session_id)
    chat_history= json.loads(data)
    chat_history.append({'role':'user','content':user.prompt})
    chat = client.responses.create(
        model='gpt-5-mini',
        input=chat_history,
        max_output_tokens=100
    )
    response = chat.output_text
    feed_data = {'role':'assistant','content':response}
    chat_history.append(feed_data)
    redis.set(user.session_id,chat_history,keepttl=True)

    return{
        "status":"success",
        "data":response
    }
