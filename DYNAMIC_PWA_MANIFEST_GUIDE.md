# Dynamic PWA Manifest & Environment Build Guide

## Overview

Instead of hardcoding separate static `manifest.json` files that could cause conflicts when merging branches (`development` $\rightarrow$ `main`), the project uses **Dynamic Build-Time PWA Manifest Generation** via custom Vite plugins in `staff-portal/vite.config.ts` and `admin-dashboard/vite.config.ts`.

---

## How It Works

During `vite build` or `vite dev`, the plugin checks the build environment (`VITE_APP_ENV` or `VERCEL_ENV`):

| Environment | Condition | App Name | App ID | Theme Color |
|---|---|---|---|---|
| 🧪 **Development / Preview** | `VITE_APP_ENV=development` OR Vercel Preview | **`Smart Staff (DEV)`** / **`Smart Admin (DEV)`** | `com.smart.attendance.staff.dev` | 🟣 Purple (`#7c3aed`) / Amber |
| 🟢 **Production** | `VITE_APP_ENV=production` OR Vercel Production | **`Smart Staff Attendance`** / **`Smart Attendance Admin`** | `com.smart.attendance.staff` | 🔵 Blue (`#2563eb`) / Indigo |

---

## Why This Solves Branch Merging

1. **Identical Source Code**: The plugin code in `vite.config.ts` is identical across all branches.
2. **Zero Merge Conflicts**: When you merge `development` into `main`, Git merges 100% cleanly without overwriting production app names.
3. **Automatic Differentiation**:
   - Vercel Preview URL deployments automatically render as **`Smart Staff (DEV)`** for Android testing.
   - Vercel Production URL deployments automatically render as **`Smart Staff Attendance`** for live staff users.

---

## Testing & Usage

### Local Dev Server
Run `npm run dev` in `staff-portal` or `admin-dashboard`. Navigating to `http://localhost:5174/manifest.json` serves the **`Smart Staff (DEV)`** manifest.

### Merging `development` to `main`
Run standard Git commands:
```bash
git checkout main
git merge development
git push origin main
```
No manual file skipping or special flags required!
