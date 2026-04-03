# Google Drive OAuth2 Debugging Guide

## Problem Summary

After deploying to Render, Google Drive OAuth2 initialization fails silently with an **empty error message**:

```
ERROR:backend.services.google_drive:Failed to initialize Google Drive service: 
WARNING:backend.routers.attendance:Google Drive upload failed, falling back to local storage: 
```

The photos then fall back to local storage (`/static/images/`), which defeats the purpose of using Google Drive for persistent storage.

## Root Cause Analysis

The enhanced error logging reveals the issue occurs during **token initialization** on Render, even though:
- ✅ Base64 decoding works
- ✅ Files are written to `/tmp/`
- ✅ **Everything works locally with the same base64 variables**

Possible causes on Render:
1. **Python pickle format mismatch** - Token created on Python 3.13 (local) vs Python version on Render
2. **Corrupted base64 encoding** - Encoding/decoding mismatch
3. **Missing Python dependencies** - Google API client not properly installed
4. **Environment variable truncation** - Very long base64 strings might be truncated in Render
5. **File permissions** - `/tmp/` access issues

## Solution: Enable Detailed Logging

The improved `backend/services/google_drive.py` now logs:
- ✅ Token file existence
- ✅ Pickle load errors with full exception details
- ✅ Credential properties (token, refresh_token, valid, expired)
- ✅ OAuth2 flow step-by-step progress
- ✅ Exception type and traceback

### Local Testing (BEFORE deploying to Render)

**Test 1: Basic Diagnostics**
```bash
python diagnose_google_drive.py
```
This tests:
- Environment variable availability
- Base64 decoding
- Pickle loading
- Google Drive service initialization
- API call functionality

**Test 2: Production Mode Simulation**
```bash
python test_google_drive_production.py
```
This simulates Render's base64 environment variable mode locally.

**Test 3: Generate Base64 Variables**
```bash
python generate_base64_env.py
```
This creates the exact base64 strings to paste into Render environment variables.

## Deployment Steps (Render)

### Step 1: Verify Environment Variables

Go to: **Render Dashboard → staff_attendance Service → Environment**

You should have these **3** variables:

```
GOOGLE_CREDENTIALS_JSON_B64 = eyJ3ZWI6e...  (700+ chars)
GOOGLE_TOKEN_PICKLE_B64 = gASV8QM...        (1360+ chars)
GOOGLE_DRIVE_FOLDER_ID = 1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu
```

⚠️ **WARNING**: If the base64 values are truncated (cut off mid-string), Render won't accept them. The values must be complete.

### Step 2: Verify Requirements.txt

Ensure `backend/requirements.txt` has:
```
google-auth-oauthlib==1.2.0
google-auth-httplib2==0.2.0
google-api-python-client==2.100.0
```

### Step 3: Trigger Redeployment

After setting environment variables:
1. Click "Save Changes"
2. Render automatically triggers a redeploy
3. Watch the Render logs for detailed OAuth2 initialization steps

### Step 4: Monitor Logs

New logs will show:
```
✅ Decoded credentials.json to /tmp/credentials.json
✅ Decoded token.pickle to /tmp/token.pickle
✅ Successfully loaded credentials from /tmp/token.pickle
   - Credential type: Credentials
   - Has token: True
   - Has refresh_token: True
   - Valid: True
   - Expired: False
✅ Google Drive service initialized successfully (OAuth2)
```

If you see errors, the traceback will show exactly what failed.

## Troubleshooting

### Issue: "Token file not found"

**Solution**: Run `generate_token.py` locally to create `token.pickle`:
```bash
python generate_token.py
```

Then encode it:
```bash
python generate_base64_env.py
```

Then update Render environment variables.

### Issue: "Failed to load pickle file: EOFError"

**Cause**: Corrupted base64 encoding or truncation

**Solution**:
1. Verify the base64 string is complete (no cut-off)
2. Regenerate on a fresh machine:
   ```bash
   rm credentials.json.b64 token.pickle.b64
   python generate_base64_env.py
   ```
3. Copy the ENTIRE values into Render

### Issue: "OAuth2 flow failed: [specific error]"

**Solution**: This means the token is invalid/expired. Regenerate it:
```bash
rm token.pickle
python generate_token.py
```

Then regenerate base64:
```bash
python generate_base64_env.py
```

And update Render.

### Issue: "Google Drive service is not initialized"

**Cause**: An exception occurred but wasn't fully logged

**Solution**:
1. Check Render logs for the full error message (now with traceback)
2. Run local diagnostic tools
3. Open a GitHub issue with the complete traceback

## Files in This Solution

### Core Implementation
- `backend/services/google_drive.py` - Main Google Drive integration with enhanced logging

### Diagnostic Tools
- `diagnose_google_drive.py` - Test entire OAuth2 setup
- `generate_base64_env.py` - Create base64 environment variables
- `test_google_drive_production.py` - Test with base64 env vars

### Documentation
- `GOOGLE_DRIVE_OAUTH2_SETUP.md` - Full OAuth2 setup guide
- `GOOGLE_DRIVE_OAUTH2_QUICKSTART.md` - Quick reference
- `RENDER_ENV_VARS.md` - Environment variable setup

## Key Improvements Made

1. **Added 13 detailed log messages** with emoji indicators:
   - 📄 Loading files
   - ✅ Success states
   - ❌ Errors
   - ⚠️ Warnings
   - 🔄 In-progress operations

2. **Exception details now captured**:
   ```python
   logger.error(f"❌ {msg}: {type(e).__name__}: {str(e)}", exc_info=True)
   ```

3. **Credential validation checks**:
   - Token file existence
   - Pickle load errors
   - Token validity
   - Token expiration
   - Refresh token availability

4. **Production-grade error handling**:
   - Graceful fallback to local storage (already implemented)
   - Clear error messages for debugging
   - Full exception tracebacks for investigation

## Next Steps

1. **Deploy to Render** with the improved error logging
2. **Test file upload** to trigger Google Drive initialization
3. **Check Render logs** for detailed error messages
4. **Run diagnostic tools** if issues persist
5. **Fix based on actual error** (now visible with full traceback)

## Quick Reference

**If Google Drive is failing:**

1. Check if environment variables are set:
   ```bash
   python diagnose_google_drive.py
   ```

2. Test production mode locally:
   ```bash
   python test_google_drive_production.py
   ```

3. Regenerate credentials if needed:
   ```bash
   python generate_token.py
   python generate_base64_env.py
   ```

4. Update Render environment variables and redeploy

5. Check logs for detailed error message

## Success Indicators

When Google Drive is working correctly, you should see:
- ✅ Photos upload to Google Drive (not local storage)
- ✅ Shareable links generated
- ✅ Photos accessible via link
- ✅ Logs show "Photo uploaded to Google Drive"
- ✅ No fallback to local storage
