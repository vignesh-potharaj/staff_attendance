# User Guide - Smart Staff Attendance

This guide provides step-by-step instructions on how to use the Smart Staff Attendance system.

---

## 🔐 Administrator Guide

The Administrator manages the entire system, including users, shifts, and attendance records.

### 1. Launching the Dashboard
**Terminal 1: Start Backend**
```powershell
npm run dev:backend
```
*Wait for "Application startup complete".*

**Terminal 2: Start Admin Dashboard**
```powershell
npm run dev
```
*Accessible at http://localhost:5175.*

**Terminal 3: Start Staff Web Portal**
```powershell
npm run dev:staff
```
*Accessible at http://localhost:5174 (or the port shown in your terminal).*

### 2. Creating Shifts
Before adding staff, define your company shifts:
- Go to **Shift Management** > **Add Shift**.
- Define **Shift Name**, **Start/End Times**, and **Grace Period** (in minutes).
- Click **Save**.

### 3. Adding Staff
- Go to **User Management** > **Add User**.
- Assign the staff member a **Name**, **Employee ID**, **Password**, and **Shift**.
- Click **Save**. Provide the ID and Password to the staff member.

### 4. Viewing Records
- Go to **Attendance Records** to see real-time check-ins.
- Click the **Map icon** to verify GPS location.
- Click the **Image icon** to view the selfie.
- Use **Export CSV** for reporting.

---

## 📱 Staff Member Guide

Staff use the Flutter mobile application to check in.

### 1. Web Portal Access (Recommended)
- Open a terminal in the `staff_attendance` folder and run `npm run dev:staff`.
- Visit `http://localhost:5174`.
- Log in with your **Employee ID** and **Password**.
- Capture your selfie and allow location access.
- Click **Submit Attendance**.

### 2. Flutter Mobile Application
If setup, staff can also use the mobile app:
- Log in with your **Employee ID** and **Password**.
- Tap **Mark Attendance** on the dashboard.
- Allow camera and location permissions.
- Capture your selfie.

### 3. View History
- Check your personal history anytime via the **History** tab in the app.

---

## 🛠️ Common Fixes
- **Backend error reading bcrypt**: Resolved. Ensure you ran `npm run install:all`.
- **Dashboard Tailwind error**: Resolved. Ensure all dependencies are installed.
- **Connection Error**: Ensure the backend terminal shows it is running on port 8000.
- **Port already in use**: If Vite starts on a different port (e.g., 5175, 5176), check your terminal output for the correct URL.
