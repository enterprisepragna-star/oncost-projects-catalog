import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import certifi

async def main():
    client = AsyncIOMotorClient("mongodb+srv://enterprisepragna_db_user:Pragna143@cluster0.etkg5pa.mongodb.net/?appName=Cluster0", tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
    try:
        info = await client.server_info()
        print("SUCCESS:", info.get("version"))
    except Exception as e:
        print("FAILED:", e)

asyncio.run(main())
