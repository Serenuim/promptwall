"""PROMPTWALL — Email Service. Prints to terminal if SMTP not configured."""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import settings

log = logging.getLogger("promptwall.email")


def _send(to: str, subject: str, html: str, plain: str) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        log.info(f"\n{'='*60}\n📧 EMAIL (dev mode — SMTP not configured)\nTo: {to}\nSubject: {subject}\n{plain}\n{'='*60}")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"PROMPTWALL <{settings.EMAIL_FROM}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as s:
            s.ehlo(); s.starttls(); s.login(settings.SMTP_USER, settings.SMTP_PASS)
            s.sendmail(settings.EMAIL_FROM, to, msg.as_string())
        log.info(f"Email sent to {to}: {subject}")
        return True
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
