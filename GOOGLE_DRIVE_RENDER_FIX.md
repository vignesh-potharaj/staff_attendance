# Google Drive OAuth2 - Headless Render Fix

## Problem

The original implementation called `flow.run_local_server()` which requires a browser. On Render (headless environment), this fails:

```
ERROR: could not locate runnable browser
webbrowser.Error: could not locate runnable browser
```

Additionally, the token pickle was causing MemoryError due to format issues.

## Solution

Rewrote `_initialize_service()` to work entirely on headless environments:

### New Approach (No Browser Required)

1. **Load Token from Base64**
   - Reads `GOOGLE_TOKEN_PICKLE_B64` environment variable
   - Decodes from base64 to binary
   - Unpickles the OAuth2 credentials object
   - Logs detailed credential properties (valid, expired, has refresh token)

2. **Refresh If Needed (Headless-Safe)**
   - Checks if token is expired
   - If expired AND has refresh_token, calls `creds.refresh(Request())`
   - This works on Render without any browser interaction
   - No local server required

3. **Fail Gracefully (No Browser Fallback)**
   - If token is missing/invalid, instead of trying `run_local_server()`
   - Simply logs a clear error message
   - Disables Google Drive (sets `self.service = None`)
   - Falls back to local storage for photos
   - App continues running normally

### Key Changes

```python
# OLD (Render-incompatible)
creds = flow.run_local_server(port=0)  # Needs browser - FAILS on Render

# NEW (Render-compatible)
# Just load token and refresh if needed
creds.refresh(Request())  # Works headless without browser
```

## Implementation Details

### Token Loading
```python
if os.path.exists(self.token_pickle_path):
    with open(self.token_pickle_path, "rb") as token_file:
        creds = pickle.load(token_file)
    logger.info("✅ Token unpickled successfully")
```

### Token Refresh (Headless-Safe)
```python
if creds.expired and creds.refresh_token:
    creds.refresh(Request())  # Works on Render!
    logger.info("✅ Token refreshed successfully")
```

### Graceful Degradation
```python
if not creds or not creds.valid:
    logger.error("OAuth2 authorization required but not available on headless")
    self.service = None  # Disable Google Drive
    return  # Fall back to local storage
```

## Environment Variables Required

All three must be set on Render:

```
GOOGLE_CREDENTIALS_JSON_B64 = eyJ3ZWI6e...  (base64 encoded)
GOOGLE_TOKEN_PICKLE_B64 = gASV8QM...        (base64 encoded)
GOOGLE_DRIVE_FOLDER_ID = 1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu
```

## Setup Instructions

### 1. Generate Token Locally (Once)

```bash
# Browser login flow - creates token.pickle
python generate_token.py
```

### 2. Encode to Base64 (Local Machine)

```bash
# Creates credentials.json.b64 and token.pickle.b64
python generate_base64_env.py
```

### 3. Set Render Environment Variables

Go to **Render Dashboard → staff_attendance → Environment**

Add these three variables:
- Name: `GOOGLE_CREDENTIALS_JSON_B64` → Value: *(contents of credentials.json.b64)*
- Name: `GOOGLE_TOKEN_PICKLE_B64` → Value: *(contents of token.pickle.b64)*
- Name: `GOOGLE_DRIVE_FOLDER_ID` → Value: `1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu`

### 4. Deploy

Render will auto-redeploy with new environment variables.

## Logging Output

### Success (Render logs)

```
📂 Checking for token file at /tmp/token.pickle
✅ Token file found
✅ Token unpickled successfully
   - Type: Credentials
   - Has access_token: True
   - Has refresh_token: True
   - Valid: True
   - Expired: False
✅ Google Drive service initialized successfully
   - Folder ID: 1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu
```

### Token Expired (Will Refresh Automatically)

```
📂 Checking for token file at /tmp/token.pickle
✅ Token unpickled successfully
   - Expired: True
🔄 Token expired, refreshing...
✅ Token refreshed successfully
✅ Google Drive service initialized successfully
```

### Token Missing (Graceful Fallback)

```
📂 Checking for token file at /tmp/token.pickle
❌ Token file not found at /tmp/token.pickle
❌ No valid credentials. Attempting authorization...
❌ OAuth2 authorization required but not available on headless
❌ Please ensure GOOGLE_TOKEN_PICKLE_B64 is set and decoded
⚠️  Google Drive disabled, using local storage for photos
```

## Error Handling

All errors are caught and logged clearly:
- ❌ Token unpickle errors (format mismatch, corruption)
- ❌ Token refresh failures (network issues, invalid refresh token)
- ❌ Missing credentials or token files
- ❌ Service build errors

**Result**: App never crashes, always falls back to local storage gracefully.

## Files Modified

- `backend/services/google_drive.py` - Rewrote `_initialize_service()`
  - Now handles token loading and refresh without browser
  - Graceful error handling
  - Detailed logging at each step

## Testing

**Local test (with base64 env vars):**
```bash
python test_google_drive_production.py
# Output: SUCCESS! Google Drive manager initialized
```

**Local test (missing token):**
```bash
# Clear GOOGLE_TOKEN_PICKLE_B64 env var
python test_google_drive_error_handling.py
# Output: Service correctly disabled when token missing
```

## Render Deployment Checklist

- [ ] `GOOGLE_CREDENTIALS_JSON_B64` set in Render environment
- [ ] `GOOGLE_TOKEN_PICKLE_B64` set in Render environment
- [ ] `GOOGLE_DRIVE_FOLDER_ID` set to `1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu`
- [ ] Render deployment complete
- [ ] Check logs for "✅ Google Drive service initialized successfully"
- [ ] Test attendance photo upload
- [ ] Verify photos appear in Google Drive folder

## Fallback Behavior

If Google Drive fails for any reason:
- ✅ Photos saved to `/static/images/` (local storage)
- ✅ App continues working normally
- ✅ Attendance is recorded correctly
- ✅ Photos accessible locally (though not persistent across redeploys)
- ⚠️ No error shown to user (graceful degradation)

## Migration Path

If switching back to Service Account:
1. Generate service account JSON from Google Cloud
2. Encode to base64
3. Update `GOOGLE_CREDENTIALS_JSON_B64` on Render
4. Change OAuth2 scope to Service Account scope
5. Redeploy

But OAuth2 with refresh tokens is simpler for this use case.

## Summary

✅ **Now works on Render (headless)**
- Token loaded from base64 environment variable
- Token refresh works without browser
- Graceful fallback to local storage if credentials missing
- Clear error messages for debugging
- Never crashes, always degrades gracefully
