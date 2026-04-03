"""
Diagnostic script to test Google Drive OAuth2 setup
Run this to identify Google Drive issues
"""

import os
import sys
import pickle
import json
import base64
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def diagnose():
    """Run diagnostics on Google Drive setup"""
    
    print("=" * 70)
    print("Google Drive OAuth2 Diagnostic")
    print("=" * 70)
    print()
    
    # Check 1: Environment variables
    print("1️⃣  Checking Environment Variables...")
    print("-" * 70)
    
    cred_b64 = os.getenv("GOOGLE_CREDENTIALS_JSON_B64")
    token_b64 = os.getenv("GOOGLE_TOKEN_PICKLE_B64")
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    
    print(f"   GOOGLE_CREDENTIALS_JSON_B64: {'✅ Set' if cred_b64 else '❌ Not set'}")
    if cred_b64:
        print(f"      Size: {len(cred_b64)} characters")
    
    print(f"   GOOGLE_TOKEN_PICKLE_B64: {'✅ Set' if token_b64 else '❌ Not set'}")
    if token_b64:
        print(f"      Size: {len(token_b64)} characters")
    
    print(f"   GOOGLE_DRIVE_FOLDER_ID: {'✅ Set' if folder_id else '❌ Not set'}")
    if folder_id:
        print(f"      Value: {folder_id}")
    
    print()
    
    # Check 2: Decode base64
    print("2️⃣  Attempting to Decode Base64...")
    print("-" * 70)
    
    try:
        if cred_b64:
            cred_decoded = base64.b64decode(cred_b64)
            print(f"   ✅ Credentials decoded: {len(cred_decoded)} bytes")
            
            # Try to parse as JSON
            try:
                cred_json = json.loads(cred_decoded)
                print(f"   ✅ Valid JSON with keys: {list(cred_json.keys())}")
                if 'web' in cred_json:
                    print(f"      - Client ID: {cred_json['web'].get('client_id', 'N/A')[:20]}...")
            except json.JSONDecodeError as e:
                print(f"   ❌ Invalid JSON: {e}")
    except Exception as e:
        print(f"   ❌ Credentials decode error: {e}")
    
    try:
        if token_b64:
            token_decoded = base64.b64decode(token_b64)
            print(f"   ✅ Token decoded: {len(token_decoded)} bytes")
    except Exception as e:
        print(f"   ❌ Token decode error: {e}")
    
    print()
    
    # Check 3: Try to load pickle
    print("3️⃣  Attempting to Load Token Pickle...")
    print("-" * 70)
    
    try:
        if token_b64:
            token_decoded = base64.b64decode(token_b64)
            creds = pickle.loads(token_decoded)
            print(f"   ✅ Token loaded successfully")
            print(f"      - Type: {type(creds)}")
            print(f"      - Has token: {hasattr(creds, 'token')}")
            print(f"      - Has refresh_token: {hasattr(creds, 'refresh_token')}")
            if hasattr(creds, 'expired'):
                print(f"      - Expired: {creds.expired}")
            if hasattr(creds, 'valid'):
                print(f"      - Valid: {creds.valid}")
    except Exception as e:
        print(f"   ❌ Token load error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Check 4: Try to initialize Google Drive
    print("4️⃣  Attempting to Initialize Google Drive Service...")
    print("-" * 70)
    
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from google.auth.transport.requests import Request
        
        if token_b64:
            token_decoded = base64.b64decode(token_b64)
            creds = pickle.loads(token_decoded)
            
            # Try to refresh if expired
            if creds.expired and creds.refresh_token:
                print("   ℹ️  Token expired, attempting refresh...")
                try:
                    creds.refresh(Request())
                    print("   ✅ Token refreshed")
                except Exception as refresh_err:
                    print(f"   ❌ Refresh failed: {refresh_err}")
            
            # Try to build service
            service = build("drive", "v3", credentials=creds)
            print("   ✅ Google Drive service created successfully")
            
            # Try a simple API call
            try:
                results = service.files().list(pageSize=1).execute()
                print("   ✅ API call successful (can list files)")
            except Exception as api_err:
                print(f"   ⚠️  API call failed: {api_err}")
    
    except Exception as e:
        print(f"   ❌ Service initialization error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    print("=" * 70)
    print("Diagnostic Complete")
    print("=" * 70)

if __name__ == "__main__":
    diagnose()
