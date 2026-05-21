"""PROMPTWALL — Email Service. Prints to terminal if Brevo not configured."""
import logging
import urllib.request
import urllib.error
import json
from config import settings

log = logging.getLogger("promptwall.email")


def _send(to: str, subject: str, html: str, plain: str) -> bool:
    log.info(f"[EMAIL DEBUG] Sending from: {settings.EMAIL_FROM} to: {to}")
    if not settings.BREVO_API_KEY:
        log.info(
            f"\n{'='*60}\n📧 EMAIL (dev mode — BREVO_API_KEY not configured)\n"
            f"To: {to}\nSubject: {subject}\n{plain}\n{'='*60}"
        )
        return True

    try:
        payload = json.dumps({
            "sender": {"name": "PROMPTWALL", "email": settings.EMAIL_FROM},
            "to": [{"email": to}],
            "subject": subject,
            "htmlContent": html,
            "textContent": plain,
        }).encode()

        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=payload,
            headers={
                "api-key": settings.BREVO_API_KEY,
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req) as resp:
            result = json.load(resp)
            log.info(f"Email sent to {to}: {subject} (id={result.get('messageId')})")
        return True

    except urllib.error.HTTPError as e:
        body = e.read().decode()
        log.error(f"Email failed [{e.code}]: {body}")
        return False
    except Exception as e:
        log.error(f"Email failed: {e}")
        return False


def send_verify(to: str, name: str, token: str) -> bool:
    url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"
    html = f"""<div style="font-family:monospace;background:#050700;color:#fff;padding:40px;max-width:560px;border-radius:12px">
<h2 style="color:#00ff41;letter-spacing:4px;margin-bottom:20px">PROMPTWALL</h2>
<p>Hi {name},</p><p>Click below to verify your email and activate your account.</p>
<a href="{url}" style="display:inline-block;background:#00ff41;color:#050700;padding:12px 28px;font-weight:bold;text-decoration:none;border-radius:8px;margin:20px 0;font-family:monospace">
VERIFY EMAIL</a>
<p style="color:#666;font-size:12px">Expires in 24 hours. If you didn't sign up, ignore this email.</p>
<p style="color:#333;font-size:11px;word-break:break-all">{url}</p></div>"""
    return _send(to, "Verify your PROMPTWALL account", html, f"Verify email: {url}")


def send_reset(to: str, name: str, token: str) -> bool:
    url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
    html = f"""<div style="font-family:monospace;background:#050700;color:#fff;padding:40px;max-width:560px;border-radius:12px">
<h2 style="color:#00ff41;letter-spacing:4px;margin-bottom:20px">PROMPTWALL</h2>
<p>Hi {name},</p><p>Click below to reset your password. Expires in 1 hour.</p>
<a href="{url}" style="display:inline-block;background:#ff3b3b;color:#fff;padding:12px 28px;font-weight:bold;text-decoration:none;border-radius:8px;margin:20px 0;font-family:monospace">
RESET PASSWORD</a>
<p style="color:#666;font-size:12px">If you didn't request this, your account is safe.</p>
<p style="color:#333;font-size:11px;word-break:break-all">{url}</p></div>"""
    return _send(to, "Reset your PROMPTWALL password", html, f"Reset password: {url}")
