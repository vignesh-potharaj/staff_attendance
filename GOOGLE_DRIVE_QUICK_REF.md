# Google Drive Integration - Quick Reference

## 📋 Checklist

- [ ] Create Google Cloud Project
- [ ] Enable Google Drive API
- [ ] Create Service Account
- [ ] Download JSON key file
- [ ] Create "Staff Attendance Photos" folder in Google Drive
- [ ] Share folder with service account email
- [ ] Copy folder ID
- [ ] Set `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable
- [ ] Set `GOOGLE_DRIVE_FOLDER_ID` environment variable
- [ ] Test attendance upload
- [ ] Verify photo appears in Google Drive
- [ ] Deploy to Render

## 🔧 Environment Variables

### Development (.env):
```env
GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account-key.json
GOOGLE_DRIVE_FOLDER_ID=1A2b3C4d5E6f7G8h9
```

### Production (Render):
```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
GOOGLE_DRIVE_FOLDER_ID=1A2b3C4d5E6f7G8h9
```

## 📝 Key Folder IDs

Your Folder ID is in the Google Drive URL:
```
https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9
                                        ^^^^^^^^^^^^^^^^^^^
                                        This is your Folder ID
```

## 🔑 Service Account Email

From your JSON file (used for sharing folder):
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "staff-attendance-app@project-id.iam.gserviceaccount.com",
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                   Use THIS email to share the Google Drive folder
  ...
}
```

## ✅ Verification Steps

1. **After setup**, mark attendance
2. **Check image URL** - should start with:
   ```
   https://drive.google.com/uc?id=
   ```
3. **Click link** - should open image in new tab
4. **Check Google Drive folder** - photo should be there

## 🚨 Troubleshooting

| Error | Solution |
|-------|----------|
| `GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set` | Set env var and restart backend |
| `GOOGLE_DRIVE_FOLDER_ID environment variable not set` | Set env var and restart backend |
| Photos still showing 404 | Make sure folder is shared with service account email |
| Permission denied error | Give service account "Editor" access to folder |
| Photos not in Google Drive folder | Check folder is shared, re-upload a new photo |

## 📚 Full Documentation

- **Complete Setup**: See `GOOGLE_DRIVE_SETUP.md`
- **Implementation Details**: See `backend/services/google_drive.py`
- **Summary**: See `GOOGLE_DRIVE_INTEGRATION_SUMMARY.md`

## 🌐 Generated Photo URLs

Photos are accessible at:
```
https://drive.google.com/uc?id={FILE_ID}&export=view
```

Example:
```
https://drive.google.com/uc?id=1B7c8D9e0F1g2H3i4&export=view
```

This link:
- ✅ Works without Google Drive login
- ✅ Displays image directly
- ✅ Works on mobile and desktop
- ✅ Fast loading
- ✅ Can be shared with anyone

## 💡 Tips

- **Backup**: Old local photos (if any) are lost on Render redeployment (normal)
- **Fallback**: If Google Drive fails, photos save to local storage automatically
- **Free**: Google Drive free tier (15 GB) is enough for thousands of photos
- **Performance**: Photo uploads are fast (< 1 second typically)
- **Privacy**: Folder is in your personal Google Drive, only shared with service account

---

**Need help?** Read `GOOGLE_DRIVE_SETUP.md` for detailed step-by-step instructions.
