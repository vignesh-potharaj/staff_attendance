import logging
import os
import json
import subprocess
from pathlib import Path
from typing import Optional

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
        logger.warning("⚠️  SMTP is not configured.")
        logger.warning("   GMAIL_USER + GMAIL_APP_PASSWORD: %s", "SET" if _gmail_configured() else "NOT SET")
        logger.warning("   SMTP_HOST + SMTP_PORT + SMTP_USERNAME + SMTP_PASSWORD + MAIL_FROM: %s",
                       "SET" if all([os.getenv("SMTP_HOST"), os.getenv("SMTP_PORT"), 
                                     os.getenv("SMTP_USERNAME"), os.getenv("SMTP_PASSWORD"), 
                                     os.getenv("MAIL_FROM")]) else "NOT SET")
        logger.warning("   Skipping email send to %s", recipient)
        return False

    try:
        project_root = Path(__file__).resolve().parents[2]
        script_path = project_root / "backend" / "services" / "nodemailer_send.js"
        payload = json.dumps(
            {
                "subject": subject,
                "recipient": recipient,
                "plain_text": plain_text,
            }
        )
        result = subprocess.run(
            ["node", str(script_path), payload],
            cwd=project_root,
            capture_output=True,
            text=True,
            check=True,
        )
        if result.stdout.strip():
            logger.info("✅ Nodemailer result for %s: %s", recipient, result.stdout.strip())
        logger.info("✅ Email sent to %s", recipient)
        return True
    except subprocess.CalledProcessError as exc:
        logger.error("❌ Node script failed with exit code %s for %s", exc.returncode, recipient)
        if exc.stderr:
            logger.error("   Node stderr: %s", exc.stderr.strip())
        logger.error("   Full error: %s", exc, exc_info=True)
        return False
    except Exception as exc:
        logger.error("❌ Failed to send email to %s: %s", recipient, exc, exc_info=True)
        return False


def build_preview_url(path: str, token: str) -> Optional[str]:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{frontend_url}{path}?token={token}"
