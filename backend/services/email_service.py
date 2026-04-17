import logging
import os
import smtplib
from email.message import EmailMessage
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)


def _gmail_configured() -> bool:
    return all(
        [
            os.getenv("GMAIL_USER"),
            os.getenv("GMAIL_APP_PASSWORD"),
        ]
    )


def _smtp_configured() -> bool:
    if _gmail_configured():
        return True
    return all(
        [
            os.getenv("SMTP_HOST"),
            os.getenv("SMTP_PORT"),
            os.getenv("SMTP_USERNAME"),
            os.getenv("SMTP_PASSWORD"),
            os.getenv("MAIL_FROM"),
        ]
    )


def send_email(subject: str, recipient: str, plain_text: str) -> bool:
    if not _smtp_configured():
        logger.warning("SMTP is not configured.")
        logger.warning("   GMAIL_USER + GMAIL_APP_PASSWORD: %s", "SET" if _gmail_configured() else "NOT SET")
        logger.warning(
            "   SMTP_HOST + SMTP_PORT + SMTP_USERNAME + SMTP_PASSWORD + MAIL_FROM: %s",
            "SET"
            if all(
                [
                    os.getenv("SMTP_HOST"),
                    os.getenv("SMTP_PORT"),
                    os.getenv("SMTP_USERNAME"),
                    os.getenv("SMTP_PASSWORD"),
                    os.getenv("MAIL_FROM"),
                ]
            )
            else "NOT SET",
        )
        logger.warning("   Skipping email send to %s", recipient)
        return False

    try:
        gmail_user = os.getenv("GMAIL_USER")
        gmail_password = os.getenv("GMAIL_APP_PASSWORD")

        if gmail_user and gmail_password:
            smtp_host = "smtp.gmail.com"
            smtp_port = 465
            smtp_username = gmail_user
            smtp_password = gmail_password
            from_address = os.getenv("MAIL_FROM") or gmail_user
            use_ssl = True
        else:
            smtp_host = os.getenv("SMTP_HOST") or ""
            smtp_port = int(os.getenv("SMTP_PORT") or "587")
            smtp_username = os.getenv("SMTP_USERNAME") or ""
            smtp_password = os.getenv("SMTP_PASSWORD") or ""
            from_address = os.getenv("MAIL_FROM") or smtp_username
            use_ssl = smtp_port == 465

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = from_address
        message["To"] = recipient
        message.set_content(plain_text)

        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                server.login(smtp_username, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.starttls()
                server.login(smtp_username, smtp_password)
                server.send_message(message)

        logger.info("Email sent to %s", recipient)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", recipient, exc, exc_info=True)
        return False


def build_preview_url(path: str, token: str) -> str:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    parsed = urlparse(frontend_url)

    if parsed.path in {"/login", "/forgot-password", "/reset-password"}:
        frontend_url = urlunparse((parsed.scheme, parsed.netloc, "", "", "", "")).rstrip("/")

    return f"{frontend_url}{path}?token={token}"
