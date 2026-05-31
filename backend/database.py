import os
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

BEIJING = timezone(timedelta(hours=8))

def beijing_now():
    return datetime.now(BEIJING).replace(tzinfo=None)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:party2026@localhost:5432/party_agent")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
