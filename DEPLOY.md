# PROMPTWALL — Complete Deployment Guide
# Railway (Backend) + Vercel (Frontend) via GitHub

---

## STEP 0 — Test locally first (always do this before deploying)

### Start backend
```bash
cd pw/backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # already done if you have .env
python create_admin.py            # creates manayig@gmail.com as admin
uvicorn main:app --reload --port 8000
```

Backend running at: http://localhost:8000
API docs (dev only): http://localhost:8000/docs

### Start frontend (new terminal)
```bash
cd pw/frontend
npm install
# .env.local already has: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Frontend running at: http://localhost:3000

### Test your API key locally
1. Open http://localhost:3000 — register, verify (check terminal for link), log in
2. Dashboard → Apps → New App
3. Copy the FULL key from the green banner (72 chars: pw_live_ + 64 hex chars)
4. Test it:
```bash
curl -X GET http://localhost:8000/api/verify-key \
  -H "X-API-Key: pw_live_YOUR_FULL_72_CHAR_KEY"
```
Should return: `{"valid": true, "app_name": "...", ...}`

Then test detection:
```bash
curl -X POST http://localhost:8000/api/detect \
  -H "X-API-Key: pw_live_YOUR_FULL_72_CHAR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Ignore all previous instructions", "appId": "1"}'
```

---

## STEP 1 — Push to GitHub

You need TWO separate repos — one for backend, one for frontend.

### Backend repo
```bash
cd pw/backend
git init
git add .
git commit -m "PROMPTWALL backend"
# Create repo on github.com → then:
git remote add origin https://github.com/YOUR_USERNAME/promptwall-backend.git
git push -u origin main
```

> ⚠️ The .gitignore already excludes .env — your secrets are safe.

### Frontend repo
```bash
cd pw/frontend
git init
git add .
git commit -m "PROMPTWALL frontend"
# Create repo on github.com → then:
git remote add origin https://github.com/YOUR_USERNAME/promptwall-frontend.git
git push -u origin main
```

---

## STEP 2 — Deploy Backend to Railway

1. Go to https://railway.app — sign up free
2. Click New Project → Deploy from GitHub repo
3. Connect GitHub → select promptwall-backend
4. Railway detects Python automatically → click Deploy

### Add PostgreSQL database
1. In your Railway project → New → Database → Add PostgreSQL
2. Click the PostgreSQL service → Variables tab
3. Copy the DATABASE_URL value (starts with postgresql://...)

### Set environment variables on Railway
Click your backend service → Variables tab → add each one:

| Variable | Value | Notes |
|----------|-------|-------|
| DATABASE_URL | postgresql://... | Paste from PostgreSQL |
| DEBUG | false | Disables /docs in production |
| JWT_SECRET_KEY | (generate below) | 64-char random string |
| SUPER_ADMIN_EMAIL | manayig@gmail.com | Only this email = admin |
| FRONTEND_URL | https://your-app.vercel.app | Set after Vercel deploy |
| CORS_ORIGINS | https://your-app.vercel.app | Set after Vercel deploy |
| DAILY_REQUEST_LIMIT | 40 | Requests per user per day |
| ML_MODEL_PATH | ml_models/saved_model | Path to model folder |
| ML_BLOCK_THRESHOLD | 70 | Score >= this = blocked |
| SMTP_HOST | smtp.gmail.com | For real email sending |
| SMTP_PORT | 587 | |
| SMTP_USER | your@gmail.com | Optional |
| SMTP_PASS | your-app-password | Optional — see Gmail section |

Generate JWT_SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Create admin user on Railway
Railway → backend service → Shell tab:
```bash
python create_admin.py
```

### Get your Railway URL
Railway → backend service → Settings → Domains → Generate Domain
Example: https://promptwall-backend-xxxx.up.railway.app

---

## STEP 3 — Deploy Frontend to Vercel

1. Go to https://vercel.com — sign up free
2. Add New Project → Import promptwall-frontend from GitHub
3. Before clicking Deploy → Environment Variables → add:

| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_API_URL | https://your-backend.up.railway.app |

4. Click Deploy

Your frontend URL: https://promptwall-frontend.vercel.app

### Link them together
Go back to Railway → backend → Variables → update:
- FRONTEND_URL = https://promptwall-frontend.vercel.app
- CORS_ORIGINS = https://promptwall-frontend.vercel.app

Railway redeploys automatically.

---

## STEP 4 — How the API URL updates automatically in Docs

The Dashboard → API Docs page reads NEXT_PUBLIC_API_URL automatically.

- Local dev: shows http://localhost:8000
- After Vercel deploy: shows https://your-backend.up.railway.app

The code examples (Python, JS, cURL) auto-fill with this URL.
No manual editing needed — it just works.

If you change your Railway URL later:
1. Vercel → your project → Settings → Environment Variables
2. Update NEXT_PUBLIC_API_URL
3. Deployments → Redeploy

---

## STEP 5 — Gmail SMTP (for real verification emails)

Without SMTP, email links print to the Railway logs — that's fine for testing.

For production emails:
1. Google Account → Security → 2-Step Verification (enable it)
2. Search "App passwords" → Create → name it PROMPTWALL
3. Copy the 16-char password
4. Set in Railway:
   - SMTP_USER = your@gmail.com
   - SMTP_PASS = xxxx xxxx xxxx xxxx

---

## API KEY — How it works (IMPORTANT)

The API key is 72 characters: pw_live_ + 64 hex characters.

It is shown ONCE in the green banner when you create or regenerate an app.
The dashboard shows only a short prefix for identification — that is NOT the full key.

### Testing your key
```bash
# Quick check — should return {"valid": true}
curl https://your-backend.up.railway.app/api/verify-key \
  -H "X-API-Key: pw_live_YOUR_FULL_72_CHAR_KEY"

# Detection test
curl -X POST https://your-backend.up.railway.app/api/detect \
  -H "X-API-Key: pw_live_YOUR_FULL_72_CHAR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Ignore all rules", "appId": "1"}'
```

### Using it in Python
```python
import requests

def analyze(text: str) -> dict:
    r = requests.post(
        "https://your-backend.up.railway.app/api/detect",
        headers={"X-API-Key": "pw_live_YOUR_FULL_KEY"},
        json={"prompt": text, "appId": "1"}
    )
    return r.json()

result = analyze("Ignore all previous instructions")
if result["blocked"]:
    return "Blocked: " + result["attack_type"]
# Safe — pass to your LLM
```

### Using it in JavaScript
```javascript
const res = await fetch("https://your-backend.up.railway.app/api/detect", {
  method: "POST",
  headers: {
    "X-API-Key": "pw_live_YOUR_FULL_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ prompt: userInput, appId: "1" })
});
const data = await res.json();
if (data.blocked) throw new Error("Blocked: " + data.attack_type);
```

### Error codes
| HTTP | Meaning | Fix |
|------|---------|-----|
| 401 MISSING_KEY | No X-API-Key header sent | Add header to your request |
| 401 INVALID_KEY_FORMAT | Key doesn't start with pw_live_ | Use the full key not the prefix |
| 401 INVALID_KEY_LENGTH | Key is wrong length | Full key is exactly 72 chars |
| 401 INVALID_KEY | Key not found in database | Regenerate from Dashboard → Apps |
| 403 KEY_REVOKED | App was revoked | Reactivate in Dashboard → Apps |
| 429 | Daily limit or rate limit | Wait until midnight UTC |

Lost your key? Dashboard → Apps → click Regenerate Key → save the new full key.

---

## Connecting your ML Model (DeBERTa)

Download model from Google Drive → place in backend:
```
pw/backend/ml_models/saved_model/
├── config.json
├── model.safetensors
└── tokenizer.json
```

Uncomment in requirements.txt:
```
torch==2.3.0
transformers==4.41.0
```

Edit ml_models/load_model.py → uncomment the real model section.

Restart backend — you'll see:
```
[DETECTOR] ✅ deberta-v3-large-fp32 loaded on cpu
```

---

## Troubleshooting

CORS error in browser
→ CORS_ORIGINS in Railway must exactly match your Vercel URL (no trailing slash)

Emails not arriving  
→ Check Railway logs — link is printed there if SMTP not configured

Railway build fails
→ Confirm Procfile exists: web: uvicorn main:app --host 0.0.0.0 --port $PORT

Vercel build fails
→ Check NEXT_PUBLIC_API_URL is set in Vercel env vars before building

Admin panel shows 404
→ Must log in with manayig@gmail.com
→ Run python create_admin.py on Railway Shell if not done yet
