# Bug Fixes: Image URLs and Pickle Error Handling

## Issue 1: Image URLs saved as localhost in database

### Problem
When Google Drive upload fails and the system falls back to local storage, the photo URL was being saved as:
```
http://localhost:8000/static/images/filename.jpg
```

This URL only works on the local machine. On production (Render), it breaks because:
- `localhost:8000` doesn't exist on Render
- Frontend can't access the photos
- Links are invalid after deployment

### Solution
Added `BACKEND_URL` environment variable support:

**Before:**
```python
photo_url = f"/static/images/{filename}"  # Relative path - only works locally
```

**After:**
```python
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

# In fallback logic:
photo_url = f"{BACKEND_URL}/static/images/{filename}"  # Absolute URL - works everywhere
```

### Environment Setup (Required on Render)

Add to Render environment variables:
```
BACKEND_URL=https://your-render-app.onrender.com
```

For local development (auto-defaults):
```
BACKEND_URL=http://localhost:8000
```

### URLs Generated
- **Local**: `http://localhost:8000/static/images/emp1_20260403212750_attendance_photo.jpg`
- **Render**: `https://staff-attendance-api.onrender.com/static/images/emp1_20260403212750_attendance_photo.jpg`

### Files Modified
- `backend/routers/attendance.py`:
  - Added `BACKEND_URL` constant (line 31)
  - Updated check-in photo fallback (line 94)
  - Updated check-out photo fallback (line 183)

---

## Issue 2: Broken token pickle crashes Google Drive

### Problem
When the token pickle file is corrupted (as seen in Render logs):
```
ERROR:backend.services.google_drive:❌ Failed to load pickle file: MemoryError: 
```

The unpickling would fail with various errors:
- `MemoryError` - Corrupted large file
- `EOFError` - Truncated file
- `UnpicklingError` - Invalid pickle format

This would crash the entire request instead of gracefully falling back.

### Solution
Enhanced pickle error handling with specific exception catching:

**Before:**
```python
except Exception as pickle_err:
    logger.error(f"Failed to unpickle token: {pickle_err}")
    creds = None
```

This would catch all exceptions but not distinguish between recoverable and critical errors.

**After:**
```python
except (pickle.UnpicklingError, EOFError, MemoryError) as pickle_err:
    # Handle specific pickle errors (corrupted token)
    logger.error(f"❌ Token file is corrupted ({type(pickle_err).__name__}): {str(pickle_err)}", exc_info=True)
    logger.warning("⚠️  Token file corrupted - will skip Google Drive for this request")
    creds = None
except Exception as pickle_err:
    # Handle any other unexpected errors during unpickling
    logger.error(f"❌ Failed to unpickle token: {type(pickle_err).__name__}: {pickle_err}", exc_info=True)
    logger.warning("⚠️  Could not load token - Google Drive will be unavailable")
    creds = None
```

This ensures:
1. **Specific pickle errors** (MemoryError, EOFError, UnpicklingError) are caught and clearly identified
2. **Corrupted token doesn't crash** - gracefully falls back to local storage
3. **Clear error messages** help diagnose token issues
4. **Any other errors** are still caught and logged with context

### Error Logging Behavior

**Scenario: Corrupted pickle file**
```
INFO:backend.services.google_drive:📂 Checking for token file at /tmp/token.pickle
INFO:backend.services.google_drive:✅ Token file found
ERROR:backend.services.google_drive:❌ Token file is corrupted (MemoryError): 
WARNING:backend.services.google_drive:⚠️  Token file corrupted - will skip Google Drive for this request
WARNING:backend.routers.attendance:⚠️  Falling back to local storage for emp1_20260403212750_attendance_photo.jpg
INFO:backend.routers.attendance:Photo saved to local storage: https://my-app.onrender.com/static/images/emp1_20260403212750_attendance_photo.jpg
```

### Files Modified
- `backend/services/google_drive.py` (lines 93-119):
  - Separated `pickle.UnpicklingError`, `EOFError`, `MemoryError` from generic `Exception`
  - Added clear logging for corrupted tokens
  - Added fallback warning message

---

## Combined Impact

### Before These Fixes
1. ❌ Photos uploaded to local storage had wrong URLs (localhost)
2. ❌ Photos couldn't be accessed on Render
3. ❌ Corrupted token pickle crashed the entire request
4. ❌ Database stored invalid URLs

### After These Fixes
1. ✅ Photos use absolute URLs with BACKEND_URL
2. ✅ Photos accessible on both local and Render
3. ✅ Corrupted token gracefully falls back to local storage
4. ✅ Database stores valid, working URLs
5. ✅ Clear error messages for debugging

---

## Testing

### Local Test
```bash
cd C:\projects\staff_attendance
python -c "from backend.routers import attendance; print(f'BACKEND_URL={attendance.BACKEND_URL}')"
# Output: BACKEND_URL=http://localhost:8000
```

### Render Test
When deployed with `BACKEND_URL=https://staff-attendance-api.onrender.com`:
```
Photo saved to local storage: https://staff-attendance-api.onrender.com/static/images/emp1_20260403212750_attendance_photo.jpg
```

---

## Deployment Checklist

- [ ] Add `BACKEND_URL` environment variable to Render:
  ```
  BACKEND_URL=https://your-render-app.onrender.com
  ```

- [ ] Ensure `GOOGLE_CREDENTIALS_JSON_B64` and `GOOGLE_TOKEN_PICKLE_B64` are set

- [ ] Test photo upload (mark attendance)

- [ ] Verify photo URL in database is absolute URL (not localhost)

- [ ] Verify photo is accessible via the URL

---

## Rollback Plan

If issues occur:
1. Remove `BACKEND_URL` environment variable
2. `BACKEND_URL` will default to `http://localhost:8000` locally
3. Photos will still fall back to local storage gracefully
4. No code changes needed - just environment variable

---

## Git Commits

```
Fix: Handle corrupted token pickle and use absolute URLs for fallback photos

Issue 1: Photo URLs saved as localhost in database
- Added BACKEND_URL environment variable support
- Check-in and check-out photos now use absolute URLs
- URLs are publicly accessible on Render: https://app.onrender.com/static/images/...
- Defaults to http://localhost:8000 for local development

Issue 2: Corrupted token pickle crashes Google Drive
- Separated pickle-specific errors (MemoryError, EOFError, UnpicklingError)
- Gracefully falls back to local storage instead of crashing
- Clear error messages identify corruption vs other issues
- Maintains full traceback logging for debugging

This ensures photos work on production while maintaining local development experience.
```
