# Google Drive OAuth2 - Quick Start

## ⚡ TL;DR Setup (5 minutes)

1. **Download credentials.json**:
   - Google Cloud Console → OAuth client ID → Desktop app → Download

2. **Save in project root**: 
   ```
   /credentials.json
   ```

3. **Set environment variables** in `.env`:
   ```env
   GOOGLE_CREDENTIALS_JSON=credentials.json
   GOOGLE_TOKEN_PICKLE=token.pickle
   GOOGLE_DRIVE_FOLDER_ID=YOUR_FOLDER_ID_HERE
   ```

4. **Create Google Drive folder**:
   - Google Drive → New Folder → `Staff Attendance Photos`
   - Copy folder ID from URL

5. **Start backend**:
   ```bash
   python -m uvicorn backend.main:app --reload
   ```
   - Browser will open for login (first time only)
   - Allow permissions
   - ✅ Done!

6. **Test**: Mark attendance → photo uploads to Google Drive ✅

---

## 📋 Checklist

- [ ] Created Google Cloud Project
- [ ] Enabled Google Drive API
- [ ] Created OAuth2 Credentials (Desktop app)
- [ ] Downloaded credentials.json
- [ ] Saved credentials.json in project root
- [ ] Created "Staff Attendance Photos" folder in Google Drive
- [ ] Copied folder ID
- [ ] Set GOOGLE_DRIVE_FOLDER_ID in .env
- [ ] Added credentials.json and token.pickle to .gitignore
- [ ] Started backend (browser login on first run)
- [ ] Tested photo upload

---

## 🔑 Environment Variables

```env
GOOGLE_CREDENTIALS_JSON=credentials.json
GOOGLE_TOKEN_PICKLE=token.pickle
GOOGLE_DRIVE_FOLDER_ID=1A2b3C4d5E6f7G8h9
```

**Folder ID Location**:
```
https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9
                                        ^^^^^^^^^^^^^^^^^^^
```

---

## 🔄 How It Works

| Step | What Happens |
|------|--------------|
| First Run | Browser opens → You login → Token saved |
| Next Runs | Uses saved token automatically |
| Token Expires | Auto-refreshed when needed |
| Photo Upload | Uses token to upload to Drive |

---

## ✅ Verification

After setup, check:

1. **Backend logs show**:
   ```
   INFO:backend.services.google_drive:Google Drive service initialized successfully (OAuth2)
   ```

2. **Photo uploads appear in**:
   ```
   https://drive.google.com → Staff Attendance Photos folder
   ```

3. **Frontend shows photo link**:
   ```
   https://drive.google.com/uc?id=xyz&export=view
   ```

---

## 🚨 Common Issues

| Issue | Fix |
|-------|-----|
| `credentials.json not found` | Download from Google Cloud Console, place in root |
| `token.pickle not found` (first run) | Normal! Browser will open for login |
| Browser doesn't open | Check backend logs for auth URL, open manually |
| Photos not in Drive | Check folder ID, verify folder access |
| `Invalid grant` error | Delete token.pickle, restart (re-auth required) |

---

## 📁 Project Files

```
project/
├── credentials.json        ← DON'T COMMIT (in .gitignore)
├── token.pickle            ← DON'T COMMIT (in .gitignore)
├── .env                    ← DON'T COMMIT
├── .gitignore              ← Add both files
├── backend/services/google_drive.py
└── backend/routers/attendance.py
```

---

## 🔐 Security

✅ Add to `.gitignore`:
```
credentials.json
token.pickle
.env
```

❌ Never commit these to Git

---

## 🌐 Google Drive Link Format

```
https://drive.google.com/uc?id=FILE_ID&export=view
```

This link:
- ✅ Works without login
- ✅ Direct image display
- ✅ Mobile & desktop friendly
- ✅ Shareable with anyone

---

## 📖 Full Documentation

See `GOOGLE_DRIVE_OAUTH2_SETUP.md` for complete setup guide with screenshots and troubleshooting.

---

**Status**: Ready for local development ✅
