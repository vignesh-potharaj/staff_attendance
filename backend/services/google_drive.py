"""
Google Drive integration for storing attendance photos.
Handles uploading images to Google Drive and generating public shareable links.
Uses Service Account authentication (recommended for server-side apps).
"""

import os
import io
import json
import logging
from typing import Optional
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

logger = logging.getLogger(__name__)

# Google Drive API scopes
SCOPES = ["https://www.googleapis.com/auth/drive"]

class GoogleDriveManager:
    def __init__(self, service_account_json: str, folder_id: str):
        """
        Initialize Google Drive manager using Service Account credentials.
        
        Args:
            service_account_json: Path to service account JSON file or JSON string
            folder_id: Google Drive folder ID where images will be stored
        """
        self.folder_id = folder_id
        self.service = None
        self._initialize_service(service_account_json)

    def _initialize_service(self, service_account_json: str):
        """Initialize Google Drive API service using Service Account."""
        try:
            # Try to load as file path first
            if os.path.isfile(service_account_json):
                credentials = Credentials.from_service_account_file(
                    service_account_json,
                    scopes=SCOPES
                )
                logger.info("Loaded credentials from file")
            else:
                # Try to load as JSON string
                try:
                    credentials_dict = json.loads(service_account_json)
                    credentials = Credentials.from_service_account_info(
                        credentials_dict,
                        scopes=SCOPES
                    )
                    logger.info("Loaded credentials from JSON string")
                except json.JSONDecodeError:
                    raise ValueError(
                        "GOOGLE_SERVICE_ACCOUNT_JSON must be a valid file path or JSON string"
                    )
            
            self.service = build("drive", "v3", credentials=credentials)
            logger.info("Google Drive service initialized successfully (Service Account)")
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
    Uses environment variables:
    - GOOGLE_SERVICE_ACCOUNT_JSON: Path to service account JSON or JSON string
    - GOOGLE_DRIVE_FOLDER_ID: Google Drive folder ID
    """
    service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    
    if not service_account_json:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set")
    if not folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID environment variable not set")
    
    return GoogleDriveManager(service_account_json, folder_id)
