"""
Google Drive integration for storing attendance photos.
Handles uploading images to Google Drive and generating public shareable links.
"""

import os
import io
import json
import logging
from typing import Optional

import pickle
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

logger = logging.getLogger(__name__)

# Google Drive API scopes
SCOPES = ["https://www.googleapis.com/auth/drive"]

class GoogleDriveManager:
    def __init__(self, folder_id: str, token_pickle_path: str = "token.pickle"):
        """
        Initialize Google Drive manager using OAuth2 user credentials.
        Args:
            folder_id: Google Drive folder ID where images will be stored
            token_pickle_path: Path to the token.pickle file
        """
        self.folder_id = folder_id
        self.service = None
        self._initialize_service(token_pickle_path)

    def _initialize_service(self, token_pickle_path: str):
        """Initialize Google Drive API service using OAuth2 user credentials."""
        try:
            with open(token_pickle_path, "rb") as token:
                creds = pickle.load(token)
            self.service = build("drive", "v3", credentials=creds)
            logger.info("Google Drive service initialized successfully (OAuth2 user)")
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
    Get or create Google Drive manager instance using OAuth2 user credentials.
    Uses environment variable:
    - GOOGLE_DRIVE_FOLDER_ID: Google Drive folder ID
    """
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    if not folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID environment variable not set")
    # token.pickle is assumed to be in the project root
    return GoogleDriveManager(folder_id)
