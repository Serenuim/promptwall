# 🛡️ PROMPTWALL — Complete Setup & Deployment Guide

**AI Prompt Injection Detection API — Production SaaS**

---

## 📁 Project Structure

```
pw/
├── backend/          ← FastAPI Python backend
│   ├── main.py
│   ├── routes/       ← auth, apps, api, admin
│   ├── services/     ← detection, email
│   ├── security/     ← JWT, bcrypt, rate limiter
│   ├── ml_models/    ← load_model.py + your model files
│   ├── .env          ← all config here (never commit)
│   └── requirements.txt
└── frontend/         ← Next.js TypeScript frontend
    ├── app/
    │   ├── page.tsx           ← Landing page (/)
    │   ├── auth/signup        ← Register
    │   ├── auth/signin        ← Login
    │   ├── auth/verify-email  ← Email verification
    │   ├── Dashboard/home     ← Apps & API keys
    │   ├── Dashboard/customized-detection
    │   ├── Dashboard/simulation
    │   ├── Dashboard/analysis
    │   ├── Dashboard/settings
    │   ├── Dashboard/docs     ← API documentation
    │   └── admin/dashboard    ← Admin (manayig@gmail.com only)
    ├── lib/api.ts             ← All backend API calls
    ├── middleware.ts          ← Route protection
    └── .env.local             ← frontend env (never commit)
```

---

## 🚀 PART 1 — Run Locally First

### Backend Setup

```bash
cd pw/backend

# 1. Create virtual environment
python -m venv venv

# Activate (Mac/Linux):
source venv/bin/activate
# Activate (Windows):
venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt
