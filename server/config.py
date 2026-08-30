from upstash_redis import Redis
from dotenv import load_dotenv
load_dotenv()


redis= Redis.from_env()
