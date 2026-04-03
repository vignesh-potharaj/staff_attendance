"""
Cloudinary integration for storing attendance photos.
Handles uploading images to Cloudinary and generating secure URLs.
Uses Cloudinary API for file storage and CDN delivery.

Environment variables required:
- CLOUDINARY_CLOUD_NAME: Cloudinary cloud name
- CLOUDINARY_API_KEY: Cloudinary API key
- CLOUDINARY_API_SECRET: Cloudinary API secret
"""

import os
import io
import logging
from typing import Optional
import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

logger = logging.getLogger(__name__)


class CloudinaryManager:
    """Manages file uploads to Cloudinary for attendance photos."""
    
    def __init__(self):
        """
        Initialize Cloudinary manager.
        Configures cloudinary with environment variables.
        Raises error if required env vars are missing.
        """
        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        api_key = os.getenv("CLOUDINARY_API_KEY")
        api_secret = os.getenv("CLOUDINARY_API_SECRET")
        
        if not cloud_name:
            logger.error("❌ CLOUDINARY_CLOUD_NAME environment variable not set")
            raise ValueError("CLOUDINARY_CLOUD_NAME environment variable is required")
        
        if not api_key:
            logger.error("❌ CLOUDINARY_API_KEY environment variable not set")
            raise ValueError("CLOUDINARY_API_KEY environment variable is required")
        
        if not api_secret:
            logger.error("❌ CLOUDINARY_API_SECRET environment variable not set")
            raise ValueError("CLOUDINARY_API_SECRET environment variable is required")
        
        try:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret
            )
            logger.info("✅ Cloudinary configured successfully")
            logger.info(f"   - Cloud Name: {cloud_name}")
        except Exception as e:
            logger.error(f"❌ Failed to configure Cloudinary: {type(e).__name__}: {e}", exc_info=True)
            raise
    
    def upload_file(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str = "image/jpeg"
    ) -> Optional[str]:
        """
        Upload file to Cloudinary and return secure URL.
        
        Args:
            file_content: File content as bytes
            filename: Name of the file
            mime_type: MIME type of the file (default: image/jpeg)
        
        Returns:
            Secure URL to the file on Cloudinary, or None if upload failed
        """
        try:
            if not file_content:
                logger.warning(f"❌ Empty file content for {filename}, skipping upload")
                return None
            
            logger.info(f"🔄 Uploading '{filename}' to Cloudinary...")
            
            # Upload to Cloudinary under attendance_photos folder
            result = cloudinary.uploader.upload(
                io.BytesIO(file_content),
                public_id=filename,
                folder="attendance_photos",
                resource_type="auto",
                overwrite=True
            )
            
            secure_url = result.get("secure_url")
            
            if not secure_url:
                logger.error(f"❌ Cloudinary response missing secure_url: {result}")
                return None
            
            # Validate URL format
            if not secure_url.startswith("https://"):
                logger.error(f"❌ Invalid Cloudinary URL generated: {secure_url}")
                raise ValueError(f"Invalid Cloudinary URL generated: {secure_url}")
            
            logger.info(f"✅ File uploaded to Cloudinary: {filename}")
            logger.info(f"   - URL: {secure_url}")
            
            return secure_url
            
        except Exception as e:
            logger.error(f"❌ Failed to upload file {filename}: {type(e).__name__}: {e}", exc_info=True)
            return None


def get_cloudinary_manager() -> CloudinaryManager:
    """
    Get Cloudinary manager instance.
    
    Initializes with environment variables:
    - CLOUDINARY_CLOUD_NAME: Cloudinary cloud name
    - CLOUDINARY_API_KEY: Cloudinary API key
    - CLOUDINARY_API_SECRET: Cloudinary API secret
    
    Returns:
        Initialized CloudinaryManager instance
        
    Raises:
        ValueError: If required environment variables are not set
    """
    try:
        return CloudinaryManager()
    except Exception as e:
        logger.error(f"❌ Failed to initialize Cloudinary manager: {type(e).__name__}: {e}", exc_info=True)
        raise
