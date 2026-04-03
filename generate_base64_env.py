"""
Generate base64 encoded credentials for production deployment
Also display them so you can copy-paste into Render environment variables
"""

import os
import base64
import json

print("=" * 80)
print("Google Drive Base64 Encoding Tool")
print("=" * 80)
print()

# Check if files exist
cred_path = "credentials.json"
token_path = "token.pickle"

if not os.path.exists(cred_path):
    print(f"❌ {cred_path} not found")
    print("   Please ensure credentials.json is in the project root")
    exit(1)

if not os.path.exists(token_path):
    print(f"❌ {token_path} not found")
    print("   Please run: python generate_token.py")
    exit(1)

print(f"✅ Found {cred_path}")
print(f"✅ Found {token_path}")
print()

# Encode credentials.json
print("1️⃣  Encoding credentials.json...")
print("-" * 80)

with open(cred_path, "rb") as f:
    cred_data = f.read()
    cred_b64 = base64.b64encode(cred_data).decode('utf-8')

print(f"   Original size: {len(cred_data)} bytes")
print(f"   Base64 size: {len(cred_b64)} characters")
print()

# Encode token.pickle
print("2️⃣  Encoding token.pickle...")
print("-" * 80)

with open(token_path, "rb") as f:
    token_data = f.read()
    token_b64 = base64.b64encode(token_data).decode('utf-8')

print(f"   Original size: {len(token_data)} bytes")
print(f"   Base64 size: {len(token_b64)} characters")
print()

# Save to files for reference
with open("credentials.json.b64", "w") as f:
    f.write(cred_b64)
print(f"✅ Saved to credentials.json.b64")

with open("token.pickle.b64", "w") as f:
    f.write(token_b64)
print(f"✅ Saved to token.pickle.b64")

# Get folder ID
with open(cred_path, "r") as f:
    cred_json = json.load(f)
    # Determine if it's web or installed app
    if "web" in cred_json:
        app_type = "Web application"
    elif "installed" in cred_json:
        app_type = "Desktop application"
    else:
        app_type = "Unknown"

print()
print("=" * 80)
print("RENDER ENVIRONMENT VARIABLES (Copy these to Render Dashboard)")
print("=" * 80)
print()

print("Name: GOOGLE_CREDENTIALS_JSON_B64")
print(f"Value: {cred_b64}")
print()

print("Name: GOOGLE_TOKEN_PICKLE_B64")
print(f"Value: {token_b64}")
print()

print("Name: GOOGLE_DRIVE_FOLDER_ID")
print("Value: 1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu")
print()

print("=" * 80)
print("SETUP INSTRUCTIONS")
print("=" * 80)
print()
print("1. Go to Render Dashboard (https://dashboard.render.com)")
print("2. Open your staff_attendance Web Service")
print("3. Click 'Environment' tab")
print("4. Add the 3 environment variables above")
print("5. Click 'Save Changes'")
print("6. Render will auto-redeploy with new variables")
print()

print("=" * 80)
print(f"OAuth2 Application Type: {app_type}")
print("=" * 80)
