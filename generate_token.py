"""
Generate Google Drive OAuth2 token.pickle interactively.
Run this script to authenticate and create token.pickle
"""

import os
import pickle
import logging
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive"]

def generate_token():
    """Generate token.pickle by running OAuth2 flow"""
    
    credentials_file = "credentials.json"
    token_file = "token.pickle"
    
    # Check if credentials.json exists
    if not os.path.exists(credentials_file):
        print(f"❌ Error: {credentials_file} not found!")
        print(f"   Download from Google Cloud Console and save in project root")
        return False
    
    print("=" * 60)
    print("Google Drive OAuth2 Token Generator")
    print("=" * 60)
    print()
    print(f"📁 Using credentials: {credentials_file}")
    print(f"💾 Will save token to: {token_file}")
    print()
    print("📱 A browser window will open for you to login...")
    print()
    
    try:
        # Check if token already exists
        if os.path.exists(token_file):
            print(f"ℹ️  {token_file} already exists")
            response = input("Overwrite? (y/n): ").lower()
            if response != 'y':
                print("Cancelled")
                return False
        
        # Run OAuth2 flow
        flow = InstalledAppFlow.from_client_secrets_file(
            credentials_file,
            SCOPES
        )
        
        # This opens browser automatically on port 8080
        creds = flow.run_local_server(port=8080)
        
        # Save token
        with open(token_file, 'wb') as token:
            pickle.dump(creds, token)
        
        print()
        print("=" * 60)
        print("✅ SUCCESS!" )
        print("=" * 60)
        print()
        print(f"✅ Token saved to: {token_file}")
        print()
        print("📝 Next steps:")
        print("   1. Run encode_credentials.ps1 to encode both files")
        print("   2. Add to Render environment variables:")
        print("      - GOOGLE_CREDENTIALS_JSON_B64")
        print("      - GOOGLE_TOKEN_PICKLE_B64")
        print("      - GOOGLE_DRIVE_FOLDER_ID")
        print()
        return True
        
    except Exception as e:
        print()
        print(f"❌ Error: {e}")
        print()
        print("Troubleshooting:")
        print("1. Check credentials.json is valid")
        print("2. Make sure port 8080 is available")
        print("3. Check your Google Cloud project settings")
        return False

if __name__ == "__main__":
    success = generate_token()
    exit(0 if success else 1)
