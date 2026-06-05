import os
import sys
from dotenv import load_dotenv

# Load local .env file
load_dotenv()

# Add workspace to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.services.email_service import send_email

# Try to get from environment
api_key = os.getenv("MAILGUN_API_KEY")
domain = os.getenv("MAILGUN_DOMAIN")

if not api_key or not domain:
    print("--- Mailgun Local Test ---")
    print("Please enter your Mailgun credentials:")
    api_key = input("Mailgun API Key (starts with key-): ").strip()
    domain = input("Mailgun Domain (e.g. sandbox871a...mailgun.org): ").strip()
    
    os.environ["MAILGUN_API_KEY"] = api_key
    os.environ["MAILGUN_DOMAIN"] = domain

recipient = "attendance.noreply.verified@gmail.com"
subject = "Hello Attendance"
body = "Congratulations Attendance, you just sent an email with Mailgun via Python! You are truly awesome!"

print(f"\nSending test email...")
print(f"  To: {recipient}")
print(f"  Domain: {domain}")

# Import logging to see traceback/details on stdout
import logging
logging.basicConfig(level=logging.INFO)

success = send_email(subject, recipient, body)

if success:
    print("\nSUCCESS! Test email sent successfully.")
else:
    print("\nFAILED to send test email. Check the logs above for error details.")
