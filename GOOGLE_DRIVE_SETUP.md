# Google Drive Integration Setup Guide

This guide helps you set up Google Drive storage for attendance photos.

## Prerequisites

- Google Cloud Project
- Google Drive API enabled
- Service Account with appropriate permissions

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Enter project name (e.g., "Staff Attendance")
4. Click "Create"

### 2. Enable Google Drive API

1. In the project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### 3. Create a Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in the details:
   - Service account name: `staff-attendance-app`
   - Click "Create and Continue"
4. Grant permissions:
   - Skip optional steps if you don't need them
   - Click "Done"

### 4. Generate a JSON Key

1. Go to the service account you just created
2. Click the "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON" format
5. Click "Create" - the JSON file will download automatically
6. **Save this file securely** (you'll need it for environment setup)

### 5. Create a Google Drive Folder and Share It

1. Go to [Google Drive](https://drive.google.com/)
2. Click "New" → "Folder"
3. Name it `Staff Attendance Photos`
4. Right-click the folder → "Share"
5. Paste the service account email (looks like: `staff-attendance-app@project-id.iam.gserviceaccount.com`)
   - You can find this email in the JSON file you downloaded (field: `client_email`)
6. Grant "Editor" access
7. Copy the folder ID from the URL:
   - Example URL: `https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9`
   - Folder ID: `1A2b3C4d5E6f7G8h9`

### 6. Configure Environment Variables

You have two options:

#### Option A: File Path (Local Development)
```bash
GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/downloaded/service-account-key.json
GOOGLE_DRIVE_FOLDER_ID=1A2b3C4d5E6f7G8h9
```

#### Option B: JSON String (Production - Render, Vercel, etc.)
1. Open the downloaded JSON file
2. Copy the entire JSON content
3. Set as environment variable:
```bash
GOOGLE_SERVICE_ACCOUNT_JSON={"type": "service_account", "project_id": "...", ...}
GOOGLE_DRIVE_FOLDER_ID=1A2b3C4d5E6f7G8h9
```

For Render:
1. Go to your backend service on Render
2. Environment → Add Environment Variable
3. Name: `GOOGLE_SERVICE_ACCOUNT_JSON`
4. Value: Paste the entire JSON (from the downloaded file)
5. Name: `GOOGLE_DRIVE_FOLDER_ID`
6. Value: Your folder ID

### 7. Test the Setup

1. Run your backend:
```bash
python -m uvicorn backend.main:app --reload
```

2. Try marking attendance:
   - The photos should now upload to Google Drive
   - Check that photos appear in your "Staff Attendance Photos" folder

### 8. Verify Public Access

Photos should be publicly accessible via the generated link:
```
https://drive.google.com/uc?id={FILE_ID}&export=view
```

You can test by clicking the link in the attendance records - it should open the image in a new tab.

## Troubleshooting

### Error: "GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set"
- Make sure you've set the environment variable in your `.env` file or system settings
- The backend needs to restart to pick up environment changes

### Error: "GOOGLE_DRIVE_FOLDER_ID environment variable not set"
- Verify you've set the folder ID correctly
- Make sure there are no extra spaces or special characters

### Photos still returning 404
- Check that the folder is shared with the service account email
- Verify the service account has "Editor" permissions
- Try re-uploading a photo

### "File not found" error on Google Drive
- Make sure the service account email has access to the folder
- The folder might be in a shared drive - ensure proper permissions

## Fallback to Local Storage

If Google Drive integration fails for any reason:
1. Photos will automatically fall back to local storage (`/static/images/`)
2. You'll see a warning in the logs: "Google Drive upload failed, falling back to local storage"
3. This ensures the app continues to work even if Google Drive is unavailable

## Performance Notes

- Google Drive uploads are fast (typically < 1 second per image)
- Images are made publicly accessible automatically
- Shareable links don't require authentication
- Direct view links work without requiring Google Drive login

## Security Considerations

- Service account keys should be kept secret
- Never commit keys to version control
- Use environment variables for sensitive data
- Service account has limited permissions (only to the designated folder)
- Public Google Drive links can theoretically be guessed, but folder structure is hidden

## Cost

- Google Drive: Free tier includes 15 GB of storage
- API usage: Free for personal use (no rate limiting concerns)
- No additional charges for this integration

## Monitoring

Check `/static/images/` folder to see if fallback is being used:
- If folder contains recent files: Fallback to local storage is active
- If folder is empty/old: Google Drive upload is working correctly
