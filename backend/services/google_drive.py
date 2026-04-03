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
        """Initialize Google Drive API service using OAuth2."""
        try:
            creds = None
            
            # Load existing token if available
            if os.path.exists(self.token_pickle_path):
                with open(self.token_pickle_path, "rb") as token:
                    creds = pickle.load(token)
                logger.info(f"Loaded existing credentials from {self.token_pickle_path}")
            

            # Refresh token if expired
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
                logger.info("Refreshed expired credentials")
            
            # If no valid credentials, run OAuth2 flow
            if not creds or not creds.valid:
                if not os.path.exists(self.credentials_json_path):
                    raise FileNotFoundError(
                        f"credentials.json not found at {self.credentials_json_path}\n"
                        f"Download it from Google Cloud Console and place it there."
                    )
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_json_path,
                    SCOPES
                )
                creds = flow.run_local_server(port=0)
                logger.info("Completed new OAuth2 authentication flow")
                
                # Save credentials for future use
                with open(self.token_pickle_path, "wb") as token:
                    pickle.dump(creds, token)
                logger.info(f"Saved credentials to {self.token_pickle_path}")
            
            self.service = build("drive", "v3", credentials=creds)
            logger.info("Google Drive service initialized successfully (OAuth2)")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Drive service: {e}")
            raise
    
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
                raise RuntimeError("Google Drive service is not initialized")
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
            logger.info(f"File uploaded successfully: {filename} (ID: {file_id})")
            # Make file publicly accessible
            self._make_file_public(file_id)
            # Return direct view link (better for images)
            public_link = f"https://drive.google.com/uc?id={file_id}&export=view"
            return public_link
        except Exception as e:
            logger.error(f"Failed to upload file {filename}: {e}")
            return None
    
    def _make_file_public(self, file_id: str):
        """Make a file publicly accessible."""
        try:
            if self.service is None:
                raise RuntimeError("Google Drive service is not initialized")
            self.service.permissions().create(
                fileId=file_id,
                body={"kind": "anyone", "role": "reader", "type": "anyone"}
            ).execute()
            logger.info(f"File {file_id} made public")
        except Exception as e:
            logger.error(f"Failed to make file public: {e}")
    
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
