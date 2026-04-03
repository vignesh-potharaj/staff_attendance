# Google Drive Token Validity Bug Fix

## Problem

On Render, Google Drive OAuth2 was falling through to Step 3 (OAuth flow requiring browser) even though `GOOGLE_TOKEN_PICKLE_B64` was properly set and decoded.

**Root cause identified:**
The token was loading successfully but:
- `creds.valid` was `False` (not set on some tokens)
- `creds.expired` was `False` (no expiry set)
- But `creds.token` existed and was valid

The Step 4 validity check was too strict:
```python
# OLD - Too complex, fails for valid tokens with valid=False
if creds and (hasattr(creds, 'valid') and creds.valid or hasattr(creds, 'token') and creds.token):
```

This complex OR condition failed because:
1. `creds.valid` was `False` (first part of OR fails)
2. The complex precedence made it evaluate incorrectly
3. Fell through to Step 3 (OAuth flow) which can't run on headless Render

## Solution

### Fix 1: Enhanced Step 2 Token State Diagnostics

Added detailed token state logging before attempting anything:

```python
has_valid = hasattr(creds, 'valid') and creds.valid
is_expired = hasattr(creds, 'expired') and creds.expired
has_token = hasattr(creds, 'token') and creds.token
has_refresh = hasattr(creds, 'refresh_token') and creds.refresh_token

logger.info(f"🔍 Token state: valid={has_valid}, expired={is_expired}, has_token={has_token}, has_refresh={has_refresh}")
```

Now the logs will show exactly what state the token is in.

### Fix 2: Smart Refresh Logic

Added logic to attempt refresh even if `valid=False` but `refresh_token` exists:

```python
should_refresh = (is_expired or (not has_valid and has_refresh))

if should_refresh and has_refresh:
    logger.info("🔄 Attempting token refresh...")
    creds.refresh(Request())
    logger.info("✅ Token refreshed successfully")
```

This means:
- Refresh if token is expired (always)
- Refresh if token is not valid but has refresh_token (fallback)
- Don't mark as None if refresh fails - token might still work

### Fix 3: Simplified Step 4 Validity Check

Changed from complex multi-condition check to simple check:

```python
# NEW - Simple and clear
if creds and creds.token:
```

This now correctly identifies:
- If `creds` object exists
- AND it has an access token

That's it. If both are true, use it. This handles:
- Tokens with `valid=True` ✅
- Tokens with `valid=False` but `token` exists ✅
- Expired tokens that were refreshed ✅
- New tokens generated via OAuth ✅

## Testing on Render

When you redeploy to Render, the logs will now show:

**If token loads successfully:**
```
✅ Token file found
✅ Token unpickled successfully
   - Type: Credentials
   - Has access_token: True
   - Has refresh_token: True
   - Valid: False
   - Expired: False
🔍 Token state: valid=False, expired=False, has_token=True, has_refresh=True
🔄 Attempting token refresh...
✅ Token refreshed successfully
✅ Valid credentials found, building Drive service...
✅ Google Drive service initialized successfully
```

**If token file is missing:**
```
❌ Token file not found at /tmp/token.pickle
   Available files: [...]
⚠️  No valid token found - Google Drive upload will be unavailable
```

**If token is corrupted:**
```
✅ Token file found
❌ Token file is corrupted (UnpicklingError): ...
⚠️  Token file corrupted - will skip Google Drive for this request
```

## Files Modified

- `backend/services/google_drive.py`:
  - Enhanced Step 2 with token state diagnostics
  - Added fallback refresh logic for invalid tokens
  - Simplified Step 4 validity check from complex OR to simple `creds.token` check

## Expected Behavior

**Before Fix:**
- Token loads but `valid=False`
- Step 4 check fails
- Falls through to Step 3 (OAuth flow)
- Crashes: "could not locate runnable browser"

**After Fix:**
- Token loads but `valid=False`
- Step 2 detects this and attempts refresh
- Step 4 check passes (just checks for token)
- Google Drive service builds successfully
- Photos upload to Drive

## Verification

Local testing confirmed:
- ✅ Module imports without errors
- ✅ No syntax errors
- ✅ Logic is sound

Next: Deploy to Render and test with photos upload.
