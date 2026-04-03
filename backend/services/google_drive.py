"""
Google Drive integration for storing attendance photos.
Handles uploading images to Google Drive and generating public shareable links.
Uses OAuth2 authentication with token.pickle for credentials persistence.

Supports both local development and production deployment:
- Local: credentials.json and token.pickle as files
- Production: Base64-encoded environment variables for security
"""

import os
import io
import pickle
import logging
import base64
import tempfile
import json
from typing import Optional
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

logger = logging.getLogger(__name__)

# Google Drive API scopes
SCOPES = ["https://www.googleapis.com/auth/drive"]


def decode_base64_env(env_var_name: str, file_path: str) -> str:
    """
    Decode base64 environment variable and save to file if needed.
    Used for production deployment where files can't be committed.
    
    Args:
        env_var_name: Name of environment variable containing base64 data
        file_path: Path where to save decoded file
    
    Returns:
        Path to the decoded file
    """
    base64_data = os.getenv(env_var_name)
    
    if base64_data:
        try:
            # Decode base64 and save to file
            decoded_data = base64.b64decode(base64_data)
            with open(file_path, "wb") as f:
                f.write(decoded_data)
            logger.info(f"Decoded {env_var_name} and saved to {file_path}")
            return file_path
        except Exception as e:
            logger.error(f"Failed to decode {env_var_name}: {e}")
            raise
    
    return file_path


class GoogleDriveManager:
    def __init__(self, credentials_json_path: str, token_pickle_path: str, folder_id: str):
        """
        Initialize Google Drive manager using OAuth2 credentials.
        
        Args:
            credentials_json_path: Path to credentials.json from Google Cloud Console
                                  (or decoded from GOOGLE_CREDENTIALS_JSON_B64 env var)
            token_pickle_path: Path where token.pickle will be stored/loaded
                              (or decoded from GOOGLE_TOKEN_PICKLE_B64 env var)
            folder_id: Google Drive folder ID where images will be stored
        """
        self.credentials_json_path = credentials_json_path
        self.token_pickle_path = token_pickle_path
        self.folder_id = folder_id
        self.service = None
        self._initialize_service()

    def _initialize_service(self):
        """
        Initialize Google Drive API service using OAuth2 credentials.
        
        Works on headless environments (Render) without requiring browser:
        1. Loads pre-authorized token from GOOGLE_TOKEN_PICKLE_B64 env var
        2. If expired, refreshes token using credentials from GOOGLE_CREDENTIALS_JSON_B64
        3. Never calls run_local_server() or webbrowser
        4. Gracefully disables Google Drive if credentials are missing
        """
        try:
            creds = None
            
            # Step 1: Try to load existing token from pickle file
            logger.info(f"📂 Checking for token file at {self.token_pickle_path}")
            if os.path.exists(self.token_pickle_path):
                logger.info(f"✅ Token file found")
                try:
                    with open(self.token_pickle_path, "rb") as token_file:
                        creds = pickle.load(token_file)
                    
                    logger.info(f"✅ Token unpickled successfully")
                    logger.info(f"   - Type: {type(creds).__name__}")
                    logger.info(f"   - Has access_token: {hasattr(creds, 'token') and bool(creds.token)}")
                    logger.info(f"   - Has refresh_token: {hasattr(creds, 'refresh_token') and bool(creds.refresh_token)}")
                    if hasattr(creds, 'valid'):
                        logger.info(f"   - Valid: {creds.valid}")
                    if hasattr(creds, 'expired'):
                        logger.info(f"   - Expired: {creds.expired}")
                        
                except (pickle.UnpicklingError, EOFError, MemoryError) as pickle_err:
                    # Handle specific pickle errors (corrupted token)
                    logger.error(f"❌ Token file is corrupted ({type(pickle_err).__name__}): {str(pickle_err)}", exc_info=True)
                    logger.warning("⚠️  Token file corrupted - will skip Google Drive for this request")
                    creds = None
                except Exception as pickle_err:
                    # Handle any other unexpected errors during unpickling
                    logger.error(f"❌ Failed to unpickle token: {type(pickle_err).__name__}: {pickle_err}", exc_info=True)
                    logger.warning("⚠️  Could not load token - Google Drive will be unavailable")
                    creds = None
            else:
                logger.warning(f"❌ Token file not found at {self.token_pickle_path}")
                available = os.listdir(os.path.dirname(self.token_pickle_path))
                logger.info(f"   Available files: {available}")
            
            # Step 2: Refresh token if expired OR invalid (works on headless Render without browser)
            if creds:
                has_valid = hasattr(creds, 'valid') and creds.valid
                is_expired = hasattr(creds, 'expired') and creds.expired
                has_token = hasattr(creds, 'token') and creds.token
                has_refresh = hasattr(creds, 'refresh_token') and creds.refresh_token
                
                logger.info(f"🔍 Token state: valid={has_valid}, expired={is_expired}, has_token={has_token}, has_refresh={has_refresh}")
                
                # Attempt refresh if: (1) token is expired, OR (2) token is not valid but has refresh_token
                should_refresh = (is_expired or (not has_valid and has_refresh))
                
                if should_refresh and has_refresh:
                    try:
                        logger.info("🔄 Attempting token refresh...")
                        creds.refresh(Request())
                        logger.info("✅ Token refreshed successfully")
                    except Exception as refresh_err:
                        logger.error(f"❌ Token refresh failed: {type(refresh_err).__name__}: {refresh_err}", exc_info=True)
                        logger.warning("⚠️  Could not refresh token. Google Drive may not work.")
                        # Don't set creds = None here - if it has a token, it might still work
                elif is_expired and not has_refresh:
                    logger.warning("⚠️  Token expired but no refresh_token available - Google Drive unavailable")
                    creds = None
            
            # Step 3: If still no valid credentials, attempt authorization (headless-safe approach)
            if not creds or (hasattr(creds, 'valid') and not creds.valid):
                logger.warning("⚠️  No valid credentials. Attempting authorization...")
                
                if not os.path.exists(self.credentials_json_path):
                    logger.error(f"❌ credentials.json not found at {self.credentials_json_path}")
                    logger.error("❌ Cannot authorize without credentials.json")
                    logger.error("❌ Please ensure GOOGLE_CREDENTIALS_JSON_B64 is set and decoded")
                    self.service = None
                    return
                
                try:
                    logger.info("📄 Loading client credentials from JSON")
                    
                    # Load credentials and build a flow (but don't run it - we'll handle auth differently)
                    flow = InstalledAppFlow.from_client_secrets_file(
                        self.credentials_json_path,
                        SCOPES
                    )
                    
                    logger.error("❌ OAuth2 authorization required but not available on headless environment")
                    logger.error("❌ run_local_server() cannot be used on Render (no browser)")
                    logger.error("❌ To fix: Generate token.pickle locally with 'python generate_token.py'")
                    logger.error("❌ Then encode with 'python generate_base64_env.py'")
                    logger.error("❌ Then set GOOGLE_TOKEN_PICKLE_B64 in Render environment variables")
                    
                    self.service = None
                    return
                    
                except Exception as setup_err:
                    logger.error(f"❌ Failed to load credentials: {type(setup_err).__name__}: {setup_err}", exc_info=True)
                    self.service = None
                    return
            
            # Step 4: Build and return Google Drive service with valid credentials
            if creds and creds.token:
                logger.info("✅ Valid credentials found, building Drive service...")
                try:
                    self.service = build("drive", "v3", credentials=creds)
                    logger.info("✅ Google Drive service initialized successfully")
                    logger.info(f"   - Folder ID: {self.folder_id}")
                except Exception as build_err:
                    logger.error(f"❌ Failed to build Drive service: {type(build_err).__name__}: {build_err}", exc_info=True)
                    self.service = None
            else:
                logger.warning("⚠️  No valid token found - Google Drive upload will be unavailable")
                self.service = None
                
        except Exception as e:
            logger.error(f"❌ Unexpected error in _initialize_service: {type(e).__name__}: {str(e)}", exc_info=True)
            self.service = None
            self.service = None
    
    def upload_file(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str = "image/jpeg"
    ) -> Optional[str]:
        """
        Upload file to Google Drive and return public shareable link.
        
        Args:
            file_content: File content as bytes
            filename: Name of the file
            mime_type: MIME type of the file (default: image/jpeg)
        
        Returns:
            Public shareable link to the file, or None if upload failed
        """
        try:
            if self.service is None:
                logger.warning(f"Google Drive service not initialized, cannot upload {filename}")
                return None
            # Create file metadata
            file_metadata = {
                "name": filename,
                "parents": [self.folder_id],
                "mimeType": mime_type
            }
            # Create media upload
            media = MediaIoBaseUpload(
                io.BytesIO(file_content),
                mimetype=mime_type,
                resumable=True
            )
            # Upload file
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id, webViewLink"
            ).execute()
            file_id = file.get("id")
            logger.info(f"✅ File uploaded to Google Drive: {filename} (ID: {file_id})")
            
            # Make file publicly accessible
            self._make_file_public(file_id)
            
            # Return direct image link using lh3.googleusercontent.com
            # This format works better for embedding images in web apps
            public_link = f"https://lh3.googleusercontent.com/d/{file_id}"
            
            # Validate the URL format before returning
            if not public_link.startswith("https://"):
                logger.error(f"❌ Invalid Google Drive URL generated: {public_link}")
                raise ValueError(f"Invalid Google Drive URL generated: {public_link}")
            
            logger.info(f"✅ Public image link: {public_link}")
            return public_link
        except Exception as e:
            logger.error(f"Failed to upload file {filename}: {type(e).__name__}: {e}", exc_info=True)
            return None
    
    def _make_file_public(self, file_id: str):
        """Make a file publicly accessible on Google Drive."""
        try:
            if self.service is None:
                raise RuntimeError("Google Drive service is not initialized")
            # Set file as publicly readable (anyone with link can view)
            self.service.permissions().create(
                fileId=file_id,
                body={"role": "reader", "type": "anyone"}
            ).execute()
            logger.info(f"✅ File {file_id} made public (shareable link enabled)")
        except Exception as e:
            logger.error(f"❌ Failed to make file public: {type(e).__name__}: {e}", exc_info=True)
    
    def delete_file(self, file_id: str) -> bool:
        """Delete a file from Google Drive."""
        try:
            if self.service is None:
                raise RuntimeError("Google Drive service is not initialized")
            self.service.files().delete(fileId=file_id).execute()
            logger.info(f"File deleted: {file_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file {file_id}: {e}")
            return False


def get_google_drive_manager() -> GoogleDriveManager:
    """
    Get or create Google Drive manager instance.
    
    Supports two deployment modes:
    
    1. LOCAL DEVELOPMENT:
       - GOOGLE_CREDENTIALS_JSON: Path to credentials.json
       - GOOGLE_TOKEN_PICKLE: Path to token.pickle
    
    2. PRODUCTION (Render, etc):
       - GOOGLE_CREDENTIALS_JSON_B64: Base64-encoded credentials.json
       - GOOGLE_TOKEN_PICKLE_B64: Base64-encoded token.pickle
       - GOOGLE_DRIVE_FOLDER_ID: Google Drive folder ID
    
    Environment variables checked in order:
    - Base64 versions (production) - decoded and saved to temp files
    - File path versions (local dev) - used directly
    """
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    
    if not folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID environment variable not set")
    
    # Try to load from base64 environment variables (production mode)
    credentials_json_b64 = os.getenv("GOOGLE_CREDENTIALS_JSON_B64")
    token_pickle_b64 = os.getenv("GOOGLE_TOKEN_PICKLE_B64")
    
    if credentials_json_b64 or token_pickle_b64:
        logger.info("Using base64-encoded credentials (production mode)")
        
        # Create temp directory for decoded files
        temp_dir = tempfile.gettempdir()
        
        credentials_json = os.path.join(temp_dir, "credentials.json")
        token_pickle = os.path.join(temp_dir, "token.pickle")
        
        # Decode base64 environment variables if present
        if credentials_json_b64:
            try:
                decoded = base64.b64decode(credentials_json_b64)
                with open(credentials_json, "wb") as f:
                    f.write(decoded)
                logger.info(f"Decoded credentials.json to {credentials_json}")
            except Exception as e:
                logger.error(f"Failed to decode GOOGLE_CREDENTIALS_JSON_B64: {e}")
                raise
        
        if token_pickle_b64:
            try:
                decoded = base64.b64decode(token_pickle_b64)
                with open(token_pickle, "wb") as f:
                    f.write(decoded)
                logger.info(f"Decoded token.pickle to {token_pickle}")
            except Exception as e:
                logger.error(f"Failed to decode GOOGLE_TOKEN_PICKLE_B64: {e}")
                raise
    else:
        # Use file paths (local development mode)
        logger.info("Using file-based credentials (local development mode)")
        credentials_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "credentials.json")
        token_pickle = os.getenv("GOOGLE_TOKEN_PICKLE", "token.pickle")
    
    return GoogleDriveManager(credentials_json, token_pickle, folder_id)
