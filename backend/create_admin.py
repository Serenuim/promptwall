"""Run once to create the admin account for manayig@gmail.com"""
import asyncio, sys
from datetime import datetime

async def main():
    from database import AsyncSessionLocal, init_db
    from models import User
    from security.password_utils import hash_pw
    from sqlalchemy import select
    from config import settings

    print(f"\n🛡  PROMPTWALL — Create Admin\nAdmin email locked to: {settings.SUPER_ADMIN_EMAIL}\n")
    name = input("Your name: ").strip()
    password = input("Password (8+ chars, uppercase, number): ").strip()
    if not name or not password:
        print("❌ All fields required."); sys.exit(1)

    await init_db()
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(User).where(User.email == settings.SUPER_ADMIN_EMAIL))
        existing = r.scalar_one_or_none()
        if existing:
            existing.is_admin = True
            existing.name = name
            existing.is_verified = True
            existing.is_active = True
            await db.commit()
            print(f"✅ Updated existing account: {settings.SUPER_ADMIN_EMAIL}")
        else:
            u = User(
                name=name, email=settings.SUPER_ADMIN_EMAIL,
                password_hash=hash_pw(password),
                is_verified=True, accepted_policy=True,
                policy_accepted_at=datetime.utcnow(),
                is_admin=True, is_active=True,
            )
            db.add(u)
            await db.commit()
            print(f"✅ Admin created: {settings.SUPER_ADMIN_EMAIL}")
        print("   → You can now log in at /auth/signin\n")

if __name__ == "__main__":
    asyncio.run(main())
