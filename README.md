# Smart Staff Attendance System

A comprehensive, production-ready attendance tracking system featuring selfie verification, GPS location tracking, and real-time admin analytics.

## 🏗️ Project Structure
- **/backend**: FastAPI (Python) - Secure JWT-based API.
- **/admin-dashboard**: React (Vite) - Admin portal with Chart.js & Tailwind.
- **/mobile_app**: Flutter - Mobile application for staff check-ins.

---

## ⚡ Setup & Run (Windows)

I have simplified the startup process using a root-level controller. Follow these steps exactly:

### 1. Initial Setup (Run Once)
Open a terminal in the `staff_attendance` folder and run:
```powershell
npm run install:all
```
*This installs both backend Python packages and dashboard Node modules.*

### 2. Run the System
You need **two separate terminal windows** open in this root directory:

**Terminal 1: Start Backend**
```powershell
npm run dev:backend
```
*Wait for "Application startup complete" and "Uvicorn running on http://127.0.0.1:8000".*

**Terminal 2: Start Admin Dashboard**
```powershell
npm run dev
```
*Wait for "VITE ... ready in ... ms" and open the link provided (usually http://localhost:5173).*

---

## 🔑 Default Credentials
- **Admin ID**: `admin`
- **Password**: `admin123`

---

## 📖 Key Documentation
- [USER_GUIDE.md](USER_GUIDE.md): Detailed usage instructions for Admins and Staff.
- [Walkthrough](C:\Users\dell\.gemini\antigravity\brain\7749828a-31a0-4ac3-aad2-b0d652c0606f\walkthrough.md): Feature overview.
