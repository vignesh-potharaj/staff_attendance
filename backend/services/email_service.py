import json
import logging
import os
import smtplib
import sys
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)


def _brevo_configured() -> bool:
    return all(
        [
            os.getenv("BREVO_API_KEY"),
            os.getenv("MAIL_FROM"),
        ]
    )


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
            os.getenv("SMTP_PORT") or os.getenv("SMOTP_PORT"),
            os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER"),
            os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS"),
            os.getenv("MAIL_FROM"),
        ]
    )


def _send_via_brevo(subject: str, recipient: str, plain_text: str) -> bool:
    api_key = os.getenv("BREVO_API_KEY")
    from_address = os.getenv("MAIL_FROM")
    from_name = os.getenv("MAIL_FROM_NAME", "Smart Attend")

    url = "https://api.brevo.com/v3/smtp/email"

    masked_key = f"{api_key[:6]}...{api_key[-4:]}" if api_key and len(api_key) > 10 else "INVALID"
    logger.info(
        "Attempting to send email via Brevo:\n"
        "   From: %s <%s>\n"
        "   To: %s\n"
        "   API Key: %s",
        from_name,
        from_address,
        recipient,
        masked_key,
    )

    try:
        headers = {
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        }

        payload = {
            "sender": {
                "name": from_name,
                "email": from_address,
            },
            "to": [
                {
                    "email": recipient,
                }
            ],
            "subject": subject,
            "textContent": plain_text,
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url=url, data=data, headers=headers, method="POST")

        with urllib.request.urlopen(req, timeout=20) as response:
            status_code = response.getcode()
            response_body = response.read().decode("utf-8")
            if 200 <= status_code < 300:
                logger.info("Email sent to %s via Brevo (Status: %s)", recipient, status_code)
                return True
            else:
                logger.error(
                    "Failed to send email to %s via Brevo. Status code: %s, Response: %s",
                    recipient,
                    status_code,
                    response_body,
                )
                return False
    except urllib.error.HTTPError as exc:
        try:
            error_body = exc.read().decode("utf-8")
        except Exception:
            error_body = "Could not read error body"
        logger.error(
            "Brevo HTTPError: Status %s, Reason: %s, Body: %s",
            exc.code,
            exc.reason,
            error_body,
            exc_info=True,
        )
        return False
    except Exception as exc:
        logger.error("Failed to send email to %s via Brevo: %s", recipient, exc, exc_info=True)
        return False


def send_email(subject: str, recipient: str, plain_text: str) -> bool:
    # Print immediately to stdout with flush=True so Render logs capture it regardless of stream buffering
    print(
        "\n"
        "========================================================================\n"
        "   [RENDER LOG] EMAIL / OTP / TOKEN DISPATCH                            \n"
        "========================================================================\n"
        f" Recipient : {recipient}\n"
        f" Subject   : {subject}\n"
        "------------------------------------------------------------------------\n"
        f" Content:\n{plain_text}\n"
        "========================================================================\n",
        flush=True,
    )
    sys.stdout.flush()

    success = False

    if _brevo_configured():
        success = _send_via_brevo(subject, recipient, plain_text)
    elif _smtp_configured():
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
                smtp_port = int(os.getenv("SMTP_PORT") or os.getenv("SMOTP_PORT") or "587")
                smtp_username = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER") or ""
                smtp_password = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or ""
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
            success = True
        except Exception as exc:
            logger.error("Failed to send email to %s: %s", recipient, exc, exc_info=True)
            success = False
    else:
        logger.warning("Neither Brevo nor SMTP is configured.")
        logger.warning(
            "   Brevo (BREVO_API_KEY + MAIL_FROM): %s",
            "SET" if _brevo_configured() else "NOT SET",
        )
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
        success = False

    # If email delivery failed or email service is down, print high-visibility FALLBACK block to stdout & logger
    if not success:
        logger.warning(
            "\n"
            "========================================================================\n"
            "   [RENDER LOG - EMAIL SERVICE DOWN / FALLBACK OTP LOG]                \n"
            "========================================================================\n"
            " ATTENTION: Email service is down or unconfigured.                       \n"
            " Retrieve OTP / Token / Verification link directly from Render logs:   \n"
            " Recipient: %s\n"
            " Subject  : %s\n"
            "------------------------------------------------------------------------\n"
            " Email Body / OTP Details:\n"
            "%s\n"
            "========================================================================",
            recipient,
            subject,
            plain_text,
        )
        print(
            "\n"
            "========================================================================\n"
            "   [RENDER LOG - EMAIL SERVICE DOWN / FALLBACK OTP LOG]                \n"
            "========================================================================\n"
            " ATTENTION: Email service is down or unconfigured.                       \n"
            " Retrieve OTP / Token / Verification link directly from Render logs:   \n"
            f" Recipient: {recipient}\n"
            f" Subject  : {subject}\n"
            "------------------------------------------------------------------------\n"
            " Email Body / OTP Details:\n"
            f"{plain_text}\n"
            "========================================================================\n",
            flush=True,
        )
        sys.stdout.flush()

    return success


def build_preview_url(path: str, token: str) -> str:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    parsed = urlparse(frontend_url)

    if parsed.path in {"/login", "/forgot-password", "/reset-password"}:
        frontend_url = urlunparse((parsed.scheme, parsed.netloc, "", "", "", "")).rstrip("/")

    return f"{frontend_url}{path}?token={token}"
