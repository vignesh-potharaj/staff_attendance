import os
import sys
from dotenv import load_dotenv

# Load local .env file
load_dotenv()

# Add workspace to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.services.email_service import send_email

# Try to get from environment
api_key = os.getenv("BREVO_API_KEY")
from_email = os.getenv("MAIL_FROM")

if not api_key or not from_email:
    print("--- Brevo Local Test ---")
    print("Please enter your Brevo credentials:")
    api_key = input("Brevo API Key (starts with xkeysib-): ").strip()
    from_email = input("Verified Sender Email (must be configured in Brevo): ").strip()
    
    os.environ["BREVO_API_KEY"] = api_key
    os.environ["MAIL_FROM"] = from_email

recipient = input("Enter recipient email address: ").strip()
subject = "Hello from Brevo"
body = "Congratulations! You have successfully sent an email using Brevo via our Python FastAPI service."

print(f"\nSending test email...")
print(f"  From: {from_email}")
print(f"  To: {recipient}")

# Import logging to see HTTP/API details on stdout
import logging
logging.basicConfig(level=logging.INFO)

success = send_email(subject, recipient, body)

if success:
    print("\nSUCCESS! Test email sent successfully via Brevo.")
else:
    print("\nFAILED to send test email. Check the logs above for error details.")
