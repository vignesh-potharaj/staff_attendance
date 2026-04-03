# Google Drive OAuth2 Setup Guide

This guide helps you set up **OAuth2 authentication** for Google Drive storage of attendance photos.

## Key Differences: OAuth2 vs Service Account

| Feature | OAuth2 | Service Account |
|---------|--------|-----------------|
| **Auth Type** | User login flow | Automated server auth |
| **Setup** | One-time browser auth | Download JSON key |
| **Ideal For** | Desktop/development apps | Server-side automation |
| **We're Using** | ✅ This one | ❌ Not using |

OAuth2 requires you to login via browser once, and then the token is saved in `token.pickle` for future use.

---

## Prerequisites

- Google Account
- Google Cloud Project
- Google Drive API enabled

---

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Enter project name: `Staff Attendance`
4. Click "Create"

### 2. Enable Google Drive API

1. Search for "Google Drive API" in the search bar
2. Click on it
3. Press "Enable"

### 3. Create OAuth2 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - Choose "External" (for testing)
   - Fill in app name: `Staff Attendance App`
   - Add your email as developer contact
   - Click "Save and Continue"
   - Skip optional scopes
   - Add your email as test user
   - Click "Save and Continue"
   - Click "Back to Dashboard"

4. Now create the OAuth client ID:
   - Click "Create Credentials" → "OAuth client ID"
   - Choose application type: **Desktop application** (or Web application)
   - If Web application, add redirect URIs:
     - `http://localhost:8000/auth/callback`
     - `http://localhost:5173`
   - Click "Create"
   - Download the JSON file
   - Save it as `credentials.json` in your project root

**Note**: Both Desktop and Web applications work the same way. The code automatically detects which type you're using.

### 4. Create Google Drive Folder and Get Folder ID

1. Go to [Google Drive](https://drive.google.com/)
2. Create a new folder: `Staff Attendance Photos`
3. Open the folder
4. Copy the folder ID from the URL:
   ```
   https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9
                                         ^^^^^^^^^^^^^^^^^^^
                                         This is your Folder ID
   ```

### 5. Configure Environment Variables

Create or update your `.env` file:

```env
GOOGLE_CREDENTIALS_JSON=credentials.json
GOOGLE_TOKEN_PICKLE=token.pickle
GOOGLE_DRIVE_FOLDER_ID=1A2b3C4d5E6f7G8h9
```

**Important**: 
- `credentials.json` should be in your project root
- `token.pickle` will be created automatically on first run
- Add both to `.gitignore` to prevent accidental commits

### 6. Update .gitignore

Make sure these files are NOT committed to Git:

```bash
# .gitignore

# Google Drive OAuth2 credentials (LOCAL ONLY - NEVER COMMIT)
credentials.json
token.pickle

# Base64 encoded files (optional local encoding)
credentials.json.b64
token.pickle.b64

# Environment files
.env
.env.local
```

**Why?**
- `credentials.json` contains sensitive OAuth2 data
- `token.pickle` contains authenticated session tokens
- **Never commit these to GitHub** - anyone with access can impersonate your app

### 7. Test Local Setup

1. Place `credentials.json` in project root
2. Start your backend:
   ```bash
   python -m uvicorn backend.main:app --reload
   ```

3. On first run:
   - A browser window will open asking you to login
   - Click "Allow" to grant permissions
   - `token.pickle` will be created automatically
   - Photos will now upload to Google Drive

### 8. Test Attendance Upload

1. Mark attendance in the app
2. Upload a photo
3. Check your Google Drive folder
4. Photo should appear in `Staff Attendance Photos` folder

---

## Production Deployment (Render)

Since OAuth2 credentials can't be committed to Git, we need to encode them as environment variables.

### Step 1: Generate Base64-Encoded Credentials (Local Machine)

On your local machine, run these commands to convert files to base64:

**Windows (PowerShell)**:
```powershell
# Encode credentials.json
$credB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("credentials.json"))
Write-Output $credB64 | Set-Content "credentials.json.b64"

# Encode token.pickle
$tokenB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("token.pickle"))
Write-Output $tokenB64 | Set-Content "token.pickle.b64"
```

**Mac/Linux**:
```bash
# Encode credentials.json
cat credentials.json | base64 > credentials.json.b64

# Encode token.pickle
cat token.pickle | base64 > token.pickle.b64
```

### Step 2: Add Environment Variables to Render

1. Go to your Render backend service
2. Click "Environment"
3. Add new environment variables:

```
GOOGLE_CREDENTIALS_JSON_B64=<contents of credentials.json.b64>
GOOGLE_TOKEN_PICKLE_B64=<contents of token.pickle.b64>
GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
```

**Copy-paste the entire base64 string** (it will be very long - that's normal!)

### Step 3: Redeploy

1. Push your updated code to GitHub
2. Render will automatically redeploy
3. Backend will decode base64 variables and create temp files
4. Photos will upload to Google Drive ✅

### How Production Mode Works

```
Render receives base64 env vars
         ↓
Backend starts up
         ↓
Code detects base64 variables
         ↓
Decodes and creates temp files
         ↓
OAuth2 uses temp credentials
         ↓
Photos upload to Google Drive ✅
         ↓
Temp files cleaned up on app restart
```

**Important**: The files are temporary and not persisted between restarts - but the OAuth2 token is valid as long as needed.

### Security

✅ **This is secure because**:
- Credentials never stored on disk permanently
- Base64 is just encoding, not encryption (but GitHub is private)
- Render environment variables are encrypted
- Only visible to authorized users
- Temporary files auto-cleanup

### Fallback: Keep Token Valid

To ensure the token stays valid:
1. Generate token.pickle locally (browser auth)
2. Encode as base64
3. Add to Render environment
4. Token will refresh automatically if needed

---

## Troubleshooting

### Error: `credentials.json not found`

**Solution**: 
- Download `credentials.json` from Google Cloud Console
- Place it in project root (`/credentials.json`)
- Restart backend

### Error: `[Errno 2] No such file or directory: 'token.pickle'`

**Solution** (First run):
- This is expected on first run
- Backend will open browser for auth
- Allow permissions
- `token.pickle` will be created
- Restart backend

### Browser doesn't open for auth

**Solution**:
- Check backend logs for auth URL
- Copy URL and open manually in browser
- Allow permissions
- Token will be saved

### File uploads but not visible in Google Drive

**Solution**:
1. Verify `GOOGLE_DRIVE_FOLDER_ID` is correct
2. Verify you have "Editor" access to the folder
3. Check Google Drive folder permissions
4. Try uploading a new photo

### "Invalid grant" error

**Solution**:
- Delete `token.pickle`
- Re-run app (will trigger new auth flow)
- Allow permissions again

---

## File Structure

After setup, your project should have:

```
staff_attendance/
├── credentials.json          ← Downloaded from Google Cloud (DON'T COMMIT)
├── token.pickle              ← Auto-generated on first run (DON'T COMMIT)
├── .env                       ← Local environment variables
├── .gitignore                 ← Must include both files above
├── backend/
│   ├── services/
│   │   └── google_drive.py    ← OAuth2 implementation
│   └── routers/
│       └── attendance.py      ← Uses google_drive.py
└── .env.example               ← Documentation for setup
```

---

## Environment Variables Reference

| Variable | Example | Description |
|----------|---------|-------------|
| `GOOGLE_CREDENTIALS_JSON` | `credentials.json` | Path to OAuth2 credentials file |
| `GOOGLE_TOKEN_PICKLE` | `token.pickle` | Path where auth token is stored |
| `GOOGLE_DRIVE_FOLDER_ID` | `1A2b3C4d5E6f7G8h9` | Google Drive folder ID for uploads |

---

## Security Best Practices

✅ **DO**:
- Add `credentials.json` and `token.pickle` to `.gitignore`
- Use environment variables for paths
- Never commit credentials to Git
- Restrict folder sharing to your account only
- Regularly review Google Drive folder permissions

❌ **DON'T**:
- Commit `credentials.json` to Git
- Commit `token.pickle` to Git (unless base64 encoded)
- Share your `credentials.json` publicly
- Use the same credentials for multiple projects

---

## How It Works

1. **First Run**: 
   - App checks for `token.pickle`
   - If missing, opens browser for OAuth2 login
   - Saves credentials to `token.pickle`

2. **Subsequent Runs**:
   - App loads credentials from `token.pickle`
   - If token expired, automatically refreshes it
   - Photos upload directly to Google Drive

3. **Photo Upload**:
   - User uploads attendance photo
   - Backend authenticates via `token.pickle`
   - Photo uploaded to Google Drive folder
   - Public link generated: `https://drive.google.com/uc?id={ID}&export=view`
   - Link stored in database

---

## Need Help?

- **Setup Issues**: Check `.env` file and verify all environment variables
- **Auth Issues**: Delete `token.pickle` and retry (browser auth will trigger)
- **Upload Issues**: Check Google Drive folder ID and permissions
- **Production**: See "Production Deployment" section above

---

**Status**: ✅ OAuth2 implementation ready for local development and testing
