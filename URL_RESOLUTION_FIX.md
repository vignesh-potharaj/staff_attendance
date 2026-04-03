# Photo URL Resolution Fix - Complete

## Problem Solved

Fixed critical bug where photo URLs were being incorrectly prefixed, causing broken URLs:

**Before (Broken):**
```
https://staff-attendance-api.onrender.comhttps://lh3.googleusercontent.com/d/FILE_ID
                                        ^^^^^^ Double protocol!
```

**After (Fixed):**
```
https://lh3.googleusercontent.com/d/FILE_ID  ✅ Google Drive URLs unchanged
https://staff-attendance-api.onrender.com/static/images/photo.jpg  ✅ Relative paths prefixed
```

## Root Cause

The code was blindly concatenating `${API_BASE}${photo_url}` for ALL photo URLs:

```javascript
// BEFORE (Wrong)
src={`${API_BASE}${record.photo_url}`}  // Broken if photo_url is absolute
```

This failed for:
- Google Drive URLs: `https://lh3.googleusercontent.com/d/...`
- External URLs: `https://example.com/photo.jpg`

## Solution Implemented

### 1. Created URL Resolution Helper

**File:** `admin-dashboard/src/utils/urlHelper.ts` and `staff-portal/src/utils/urlHelper.ts`

```typescript
export function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Already an absolute URL (Google Drive, external resources, etc.)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Relative path - prepend API base URL
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${API_BASE}${url}`;
}
```

**Logic:**
- ✅ Absolute URLs (http://, https://) → Use as-is
- ✅ Relative paths (/static/images/...) → Prepend API_BASE
- ✅ Null/undefined → Return null

### 2. Updated admin-dashboard/src/pages/Attendance.tsx

**Imports:**
```typescript
import { resolvePhotoUrl } from '../utils/urlHelper';
```

**Removed hardcoded API_BASE:**
```typescript
// BEFORE
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// AFTER
// Using helper function instead
```

**Fixed check-in photo (4 locations):**
```typescript
// BEFORE
href={`${API_BASE}${record.photo_url}`}
src={`${API_BASE}${record.photo_url}`}

// AFTER
href={resolvePhotoUrl(record.photo_url) || '#'}
src={resolvePhotoUrl(record.photo_url) || ''}
```

**Fixed check-out photo (4 locations):**
```typescript
// BEFORE
href={`${API_BASE}${record.check_out_photo_url}`}
src={`${API_BASE}${record.check_out_photo_url}`}

// AFTER
href={resolvePhotoUrl(record.check_out_photo_url) || '#'}
src={resolvePhotoUrl(record.check_out_photo_url) || ''}
```

### 3. Updated staff-portal/src/pages/History.tsx

**Imports:**
```typescript
import { resolvePhotoUrl } from '../utils/urlHelper';
```

**Fixed hardcoded localhost:**
```typescript
// BEFORE
src={`http://localhost:8000${record.photo_url}`}

// AFTER
src={resolvePhotoUrl(record.photo_url) || ''}
```

## URL Handling Examples

### Google Drive URLs (from backend)
```
Stored in DB:     https://lh3.googleusercontent.com/d/FILE_ID
Resolved:         https://lh3.googleusercontent.com/d/FILE_ID  ✅ (unchanged)
Displayed:        <img src="https://lh3.googleusercontent.com/d/FILE_ID" />
```

### Local Storage URLs (from backend)
```
Stored in DB:     /static/images/photo_20260403.jpg
Resolved:         https://api.onrender.com/static/images/photo_20260403.jpg  ✅
Displayed:        <img src="https://api.onrender.com/static/images/photo_20260403.jpg" />
```

### Environment-based URLs
```
Development:      http://localhost:8000/static/images/photo.jpg
Production:       https://staff-attendance-api.onrender.com/static/images/photo.jpg
```

## Files Modified

| File | Changes |
|------|---------|
| `admin-dashboard/src/utils/urlHelper.ts` | ✅ Created new utility |
| `admin-dashboard/src/pages/Attendance.tsx` | ✅ 4 URL fixes + import |
| `staff-portal/src/utils/urlHelper.ts` | ✅ Created new utility |
| `staff-portal/src/pages/History.tsx` | ✅ 1 URL fix + import |

## Testing Checklist

- [ ] Check-in photos display correctly
  - [ ] Local storage URLs show image
  - [ ] Google Drive URLs show image
- [ ] Check-out photos display correctly
  - [ ] Local storage URLs show image
  - [ ] Google Drive URLs show image
- [ ] Photo links are clickable
  - [ ] Relative paths load via API
  - [ ] Google Drive URLs open directly
- [ ] No more double protocol errors
- [ ] Works in both localhost and production

## Benefits

✅ **Fixes Google Drive integration** - Photos can now be stored on Google Drive
✅ **Cleaner code** - Centralized URL logic in helper function
✅ **Consistent behavior** - Works in localhost and production
✅ **Flexible** - Easy to add other CDNs or storage providers
✅ **Maintainable** - Single source of truth for URL resolution

## Backward Compatibility

✅ All existing relative URLs continue to work
✅ No breaking changes to API
✅ Graceful fallback for null/undefined URLs

## Next Steps (Optional)

Consider using this helper function in:
- Thumbnail generation
- Image caching
- CDN URL routing
- Future storage providers (AWS S3, Azure Blob, etc.)
