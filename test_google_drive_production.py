"""
Test script to simulate production mode with base64 environment variables
"""

import os
import sys

# Read base64 files
with open("credentials.json.b64", "r") as f:
    cred_b64 = f.read().strip()

with open("token.pickle.b64", "r") as f:
    token_b64 = f.read().strip()

# Set environment variables
os.environ["GOOGLE_CREDENTIALS_JSON_B64"] = cred_b64
os.environ["GOOGLE_TOKEN_PICKLE_B64"] = token_b64
os.environ["GOOGLE_DRIVE_FOLDER_ID"] = "1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu"

print("=" * 80)
print("Testing Google Drive with Base64 Environment Variables")
print("=" * 80)
print()

# Now test
from backend.services.google_drive import get_google_drive_manager

try:
    print("🔄 Initializing Google Drive Manager with base64 env vars...")
    manager = get_google_drive_manager()
    print("✅ SUCCESS! Google Drive manager initialized")
    print(f"   Service: {manager.service}")
    print(f"   Folder ID: {manager.folder_id}")
except Exception as e:
    print(f"❌ FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 80)
