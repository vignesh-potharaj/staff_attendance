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

---

## 🔒 Fix: Connecting Mobile/APK to Backend

If you see "Is the server running?" on your phone, it's because the app is trying to connect to `localhost`. You need to point it to your computer's address.

### Option A: Using ngrok (Recommended & Easiest)
1. Install [ngrok](https://ngrok.com/).
2. Run your backend locally (`npm run dev:backend`).
3. In a new terminal, run: `ngrok http 8000`.
4. Copy the "Forwarding" URL (e.g., `https://random-id.ngrok-free.app`).
5. Update **Vercel Dashboard**: Set `VITE_API_URL` to this ngrok URL.
6. Done! Your phone can now talk to your computer from anywhere.

### Option B: Using local IP (Wi-Fi Only)
1. Connect your phone and computer to the **same Wi-Fi**.
2. Find your computer's IP: Run `ipconfig` and look for `IPv4 Address` (e.g., `192.168.0.100`).
3. Update **Vercel Dashboard**: Set `VITE_API_URL` to `http://192.168.0.100:8000`.
4. **Note**: This only works while you are at home/office on that specific Wi-Fi.

> [!IMPORTANT]
> Always push your changes to GitHub and wait for Vercel to redeploy after updating environment variables!
