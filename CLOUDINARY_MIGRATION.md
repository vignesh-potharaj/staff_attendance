# Migration from Google Drive to Cloudinary

## Summary
Replaced Google Drive OAuth2 photo storage with Cloudinary CDN. All photos now upload to Cloudinary instead of local storage or Google Drive.

## Files Changed

### New File Created
- **`backend/services/cloudinary_storage.py`** - New Cloudinary integration service
  - `CloudinaryManager` class handles uploads
  - `get_cloudinary_manager()` factory function
  - Returns secure HTTPS URLs from Cloudinary
  - Includes comprehensive error logging

### Files Updated
- **`backend/routers/attendance.py`**
  - Changed import: `from backend.services.google_drive` → `from backend.services.cloudinary_storage`
  - Renamed function: `upload_photo_to_drive()` → `upload_photo_to_cloudinary()`
  - Renamed: `drive_manager` → `cloudinary_manager`
  - Updated comments from "Google Drive" to "Cloudinary"
  - Both check-in and check-out photos use Cloudinary

- **`backend/requirements.txt`**
  - Removed: `google-auth-oauthlib==1.2.1`
  - Removed: `google-auth-httplib2==0.2.0`
  - Removed: `google-api-python-client==2.117.0`
  - Added: `cloudinary==1.37.0`

### Files to Delete
- **`backend/services/google_drive.py`** - Entire file (delete after deployment)
- **`backend/services/__init__.py`** - If it imports google_drive (update if needed)

### Test Files to Remove (Optional)
These can be deleted as they're no longer relevant:
- `test_google_drive_production.py`
- `test_google_drive_error_handling.py`
- `diagnose_google_drive.py`
- `generate_token.py`
- `generate_base64_env.py`
- `encode_credentials.ps1`

### Documentation Files to Remove (Optional)
These reference the old Google Drive integration:
- `GOOGLE_DRIVE_OAUTH2_SETUP.md`
- `GOOGLE_DRIVE_OAUTH2_QUICKSTART.md`
- `GOOGLE_DRIVE_DEBUG.md`
- `GOOGLE_DRIVE_URL_FIXES.md`
- `ISSUE_ANALYSIS_GOOGLE_DRIVE_FIX.md`
- `RENDER_ENV_VARS.md`
- `RENDER_DEPLOYMENT_CHECKLIST.md`

## Required Environment Variables

Set these in Render Dashboard → Environment:

```
CLOUDINARY_CLOUD_NAME = your-cloud-name
CLOUDINARY_API_KEY = your-api-key
CLOUDINARY_API_SECRET = your-api-secret
```

Get these from: https://cloudinary.com/console/c/organization/media_library/folders/home

## Environment Variables to Remove

These are no longer needed (remove from Render):
```
GOOGLE_CREDENTIALS_JSON_B64        [DELETE]
GOOGLE_TOKEN_PICKLE_B64            [DELETE]
GOOGLE_DRIVE_FOLDER_ID             [DELETE]
```

## How It Works

### Photo Upload Flow
1. User uploads photo in attendance check-in/check-out
2. Backend reads file bytes
3. Calls `upload_photo_to_cloudinary()` function
4. Function gets Cloudinary manager with env vars
5. Manager uploads to Cloudinary (folder: `attendance_photos/`)
6. Cloudinary returns secure HTTPS URL
7. URL is stored in database
8. **If Cloudinary fails**: Falls back to local storage (`/static/images/`)

### Photo Retrieval Flow
1. Frontend requests attendance records
2. API returns `photo_url` and `check_out_photo_url`
3. Frontend uses `resolvePhotoUrl()` helper to resolve URLs
4. Cloudinary URLs (absolute, https://) used as-is
5. Local storage URLs (relative, /static/...) prefixed with API base

## Benefits vs Google Drive

| Feature | Google Drive | Cloudinary |
|---------|--------------|-----------|
| Setup | Complex OAuth2, browser login needed | Simple env vars, no auth flow |
| Token Management | Pickle files, token expiry, refresh | No tokens, API key auth |
| Headless Servers | Fails (needs browser) | Works perfectly |
| CDN Delivery | Manual configuration | Built-in, automatic |
| Image Optimization | Manual | Automatic on-the-fly |
| URL Format | Long, complex | Short, simple |
| Cost | Free 15GB | Free tier: 25GB/month |

## Installation

### Local Development
```bash
pip install -r backend/requirements.txt
```

### Render Deployment
1. Push to GitHub (auto-triggers Render rebuild)
2. Render runs: `pip install -r backend/requirements.txt`
3. Set 3 environment variables in Render Dashboard
4. Service auto-redeploys with new config

## Testing

### Test Upload
```bash
curl -X POST http://localhost:8000/attendance/mark \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@photo.jpg" \
  -F "latitude=37.7749" \
  -F "longitude=-122.4194" \
  -F "device_info=iPhone 12"
```

### Check URL
```bash
# View attendance record
curl http://localhost:8000/attendance/records \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should see photo_url like:
# "photo_url": "https://res.cloudinary.com/your-cloud/image/upload/attendance_photos/..."
```

### Verify Cloudinary
1. Go to https://cloudinary.com/console
2. Click "Media Library"
3. Should see photos in `attendance_photos/` folder
4. Each photo has transformations available (resize, crop, etc.)

## Fallback Behavior

If Cloudinary upload fails:
1. Error logged with full traceback
2. Falls back to local storage: `/static/images/{filename}`
3. URL stored as: `{BACKEND_URL}/static/images/{filename}`
4. Frontend still displays photo
5. No crash, app continues normally

This ensures attendance system is resilient even if Cloudinary is down.

## Logging

### Success
```
INFO: 🔄 Attempting to upload 'emp1_20260403212750_attendance_photo.jpg' to Cloudinary...
INFO: ✅ Cloudinary manager initialized
INFO: ✅ File uploaded to Cloudinary: emp1_20260403212750_attendance_photo.jpg
INFO:    - URL: https://res.cloudinary.com/...
```

### Failure → Fallback
```
ERROR: ❌ Failed to upload file: ... [error details]
INFO: ⚠️  Falling back to local storage for emp1_20260403212750_attendance_photo.jpg
INFO: Photo saved to local storage: https://api.onrender.com/static/images/...
```

## No Breaking Changes

- ✅ API response format unchanged
- ✅ Photo URLs work the same (absolute HTTPS)
- ✅ Frontend code unchanged (except import)
- ✅ Database schema unchanged
- ✅ Attendance router interface unchanged
- ✅ Authentication unchanged
- ✅ Local storage fallback still works

## Next Steps

1. **Install Cloudinary package locally**:
   ```bash
   pip install cloudinary==1.37.0
   ```

2. **Get Cloudinary credentials**:
   - Sign up: https://cloudinary.com/users/register/free
   - Dashboard: https://cloudinary.com/console
   - Copy Cloud Name, API Key, API Secret

3. **Test locally** (optional):
   - Set env vars
   - Run backend
   - Try uploading photo

4. **Deploy to Render**:
   - Push to GitHub
   - Set 3 Cloudinary env vars in Render Dashboard
   - Wait for auto-redeploy

5. **Verify on production**:
   - Try attendance check-in/out
   - Verify photos in Cloudinary Media Library
   - Check Render logs for success messages

6. **Remove old files** (after verifying it works):
   - `backend/services/google_drive.py`
   - Google Drive test files
   - Google Drive documentation files
