import os
import sys

# Add workspace to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment variables simulating user config
os.environ["SMOTP_PORT"] = "2525"
os.environ["SMTP_HOST"] = "smtp-relay.brevo.com"
os.environ["SMTP_PASS"] = "test-pass"
os.environ["SMTP_USER"] = "test-user"
os.environ["MAIL_FROM"] = "test@example.com"

# Remove any gmail/brevo variables to test the SMTP fallback path
os.environ.pop("GMAIL_USER", None)
os.environ.pop("GMAIL_APP_PASSWORD", None)
os.environ.pop("BREVO_API_KEY", None)

from backend.services.email_service import _smtp_configured

print("SMTP Configured check:", _smtp_configured())
assert _smtp_configured() is True, "Should be True when custom SMTP config is present!"
print("Test passed successfully!")
