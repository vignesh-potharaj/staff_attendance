# Render Deployment Checklist for Google Drive OAuth2

## Pre-Deployment (Local Machine)

- [ ] Python version check
  ```bash
  python --version  # Should be 3.9+
  ```

- [ ] Credentials exist
  ```bash
  ls credentials.json token.pickle
  ```

- [ ] Run diagnostic test
  ```bash
  python diagnose_google_drive.py
  ```
  Expected: All tests pass ✅

- [ ] Test production mode locally
  ```bash
  python test_google_drive_production.py
  ```
  Expected: "SUCCESS! Google Drive manager initialized" ✅

- [ ] Generate base64 variables
  ```bash
  python generate_base64_env.py
  ```
  Expected: Files `credentials.json.b64` and `token.pickle.b64` created

- [ ] Verify base64 files are valid
  ```bash
  wc -c credentials.json.b64 token.pickle.b64
  # credentials.json.b64 should be ~700 chars
  # token.pickle.b64 should be ~1360 chars
  ```

- [ ] Push changes to GitHub
  ```bash
  git add .
  git commit -m "Pre-deployment: Google Drive OAuth2"
  git push origin main
  ```

## Render Dashboard Configuration

### Step 1: Navigate to Environment Variables

1. Go to https://dashboard.render.com
2. Select **staff_attendance** Web Service
3. Click **Environment** tab
4. Click **Add Environment Variable**

### Step 2: Add Three Variables

**Variable 1: Credentials**
- Name: `GOOGLE_CREDENTIALS_JSON_B64`
- Value: *(Copy from `credentials.json.b64` file)*
- Click **Add**

**Variable 2: Token**
- Name: `GOOGLE_TOKEN_PICKLE_B64`
- Value: *(Copy from `token.pickle.b64` file)*
- Click **Add**

**Variable 3: Folder ID**
- Name: `GOOGLE_DRIVE_FOLDER_ID`
- Value: `1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu`
- Click **Add**

### Step 3: Verify All Three Variables

All three should appear in the list:
```
GOOGLE_CREDENTIALS_JSON_B64 = eyJ3ZWI6e...
GOOGLE_TOKEN_PICKLE_B64 = gASV8QM...
GOOGLE_DRIVE_FOLDER_ID = 1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu
```

- [ ] All three variables present
- [ ] Values not truncated (full length)
- [ ] Folder ID matches exactly

### Step 4: Save and Trigger Redeployment

- [ ] Click **Save Changes** button at bottom right
- [ ] Wait for deployment to start (you should see it in Recent Deploy Activity)
- [ ] Wait for deployment to complete (2-3 minutes)
- [ ] Status should change to "Live"

## Post-Deployment Verification

### Step 1: Check Application Status

- [ ] Go to https://staff-attendance-admin.vercel.app
- [ ] Log in with test user
- [ ] Navigate to Attendance page

### Step 2: Test File Upload

- [ ] Try to check in (mark attendance)
- [ ] This will trigger photo upload to Google Drive

### Step 3: Monitor Logs

In Render Dashboard:
1. Click **Logs** tab
2. Look for messages from `backend.services.google_drive`

Expected success logs:
```
✅ Decoded credentials.json to /tmp/credentials.json
✅ Decoded token.pickle to /tmp/token.pickle
✅ Successfully loaded credentials from /tmp/token.pickle
✅ Google Drive service initialized successfully (OAuth2)
✅ Photo uploaded to Google Drive: [filename]
```

- [ ] Logs show "Decoded credentials.json"
- [ ] Logs show "Decoded token.pickle"
- [ ] Logs show "Google Drive service initialized"
- [ ] Logs show "Photo uploaded to Google Drive"
- [ ] No "Google Drive upload failed" messages

### Step 4: Verify Photo Upload

1. Try marking attendance (check-in)
2. Check Render logs for "Photo uploaded to Google Drive"
3. If failed, logs should now show detailed error

## Troubleshooting Checklist

If Google Drive uploads are failing:

- [ ] **Check error message in Render logs**
  - Should now show full exception with type and traceback
  - This was the main improvement - before it showed nothing

- [ ] **Verify environment variables are set**
  - In Render Dashboard → Environment
  - All three variables should be present
  - Values should not be truncated

- [ ] **Check variable lengths**
  - `GOOGLE_CREDENTIALS_JSON_B64` should be ~700 characters
  - `GOOGLE_TOKEN_PICKLE_B64` should be ~1360 characters
  - If shorter, it was truncated during copy-paste

- [ ] **Verify requirements.txt has Google packages**
  ```
  google-auth-oauthlib
  google-auth-httplib2
  google-api-python-client
  ```

- [ ] **Check if token is expired**
  - Solution: Regenerate token locally
  - Run: `python generate_token.py`
  - Then: `python generate_base64_env.py`
  - Update Render env vars

- [ ] **Verify Python version on Render**
  - Render should use Python 3.13 (specified in runtime.txt)
  - Pickle format must match

- [ ] **Check folder permissions**
  - Verify Google Drive folder ID is correct
  - Verify OAuth2 credentials have drive scope

## Rollback Plan

If something goes wrong:

1. **Remove base64 environment variables** from Render
2. **Keep file-based paths** in `.env`:
   ```
   GOOGLE_CREDENTIALS_JSON=credentials.json
   GOOGLE_TOKEN_PICKLE=token.pickle
   ```
3. Render will revert to "no valid credentials" and use OAuth2 flow
4. **But OAuth2 flow won't work on Render** (no browser), so fallback to local storage

The base64 environment variable approach is the ONLY way to use OAuth2 on Render.

## Success Criteria

Deployment is successful when:

- ✅ No errors in Render logs
- ✅ Photos upload to Google Drive (not `/static/images/`)
- ✅ Shareable links work in attendance photos
- ✅ Multiple photos can be uploaded without issues
- ✅ Logs show "Photo uploaded to Google Drive" for each photo

## Support

If issues persist after following this checklist:

1. **Collect information**:
   - Render deployment ID (shown in Recent Deploy Activity)
   - Full error message from logs (with traceback)
   - Steps to reproduce the issue

2. **Run local diagnostic**:
   ```bash
   python diagnose_google_drive.py
   python test_google_drive_production.py
   ```

3. **Check documentation**:
   - `GOOGLE_DRIVE_DEBUG.md` - Detailed debugging guide
   - `GOOGLE_DRIVE_OAUTH2_SETUP.md` - OAuth2 setup details
   - `GOOGLE_DRIVE_OAUTH2_QUICKSTART.md` - Quick reference

4. **Create GitHub issue** with:
   - Error message from Render logs
   - Output from diagnostic tools
   - Steps to reproduce
