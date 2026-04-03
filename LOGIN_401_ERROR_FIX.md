# 401 Unauthorized Login Error - Root Cause & Solution

## Problem Summary
When creating a new user from the admin portal and trying to log in, the application returned **401 Unauthorized** errors on the `/auth/login` endpoint.

## Root Cause
The **Users.tsx** form was allowing users to be created with **empty passwords**. When this happened:

1. A new user was created with an **empty password string** (`""`)
2. The backend hashed this empty string using `get_password_hash("")`
3. The resulting hash was stored in the database
4. When logging in with any actual password, the `verify_password()` function would reject it because no password matches an empty string hash

### Code Issue (Before Fix)
```typescript
// admin-dashboard/src/pages/Users.tsx (line 69)
if (editingUser) {
  if (!payload.password) delete payload.password;
  // For new users, empty password was still sent!
  await api.post('/users/', payload); // payload.password = ""
}
```

## Solution Implemented

### 1. Frontend Validation (Users.tsx)
Added validation to **require a password when creating new users**:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // For new users, password is required
  if (!editingUser && !formData.password) {
    alert('Password is required for new users');
    return;
  }
  // ... rest of code
}
```

### 2. Database Password Reset
Fixed all existing users with invalid password hashes:
- **Admin user**: Password set to `admin123`
- **EMP-001**: Password set to `staff1`
- **EMP-002**: Password set to `staff2`
- **EMP-003**: Password set to `staff3`

## How to Prevent This
1. Always provide a **strong password** when creating new users from the admin portal
2. The form now validates and prevents empty passwords
3. Existing users can have passwords updated by leaving the password field blank during edit (for updating other fields) or entering a new password

## Testing Credentials
After the fix, use these credentials to log in:

| User | Employee ID | Password | Role |
|------|------------|----------|------|
| Admin | admin | admin123 | ADMIN |
| Staff 1 | EMP-001 | staff1 | STAFF |
| Staff 2 | EMP-002 | staff2 | STAFF |
| Staff 3 | EMP-003 | staff3 | STAFF |

## Technical Details
- **Backend**: Uses argon2 for password hashing (primary scheme) with bcrypt fallback
- **Verification**: `verify_password()` function correctly validates stored hashes
- **Security**: All passwords are hashed with cryptographic security before storage
