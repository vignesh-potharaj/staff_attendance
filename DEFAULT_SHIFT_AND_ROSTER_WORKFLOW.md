# Default Working Shift & Daily Roster Workflow Documentation

## Overview
This document outlines the strict business rules, data model architecture, and operational workflow for **Employee Default Working Shifts** and **Daily Roster Overrides** in the Staff Attendance & Payroll Management System.

---

## 🛠️ Data Model & Schema Specifications

### 1. User Entity (`users` table)
Every employee record stores a permanent **Default Working Shift** schedule alongside their pay rate settings:

| Field Name | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `default_shift_start` | `VARCHAR` | `'09:00:00'` | Standard daily shift start time for the employee |
| `default_shift_end` | `VARCHAR` | `'18:00:00'` | Standard daily shift end time for the employee |

---

## ⚡ Strict Business Rules & Fallback Architecture

### Rule 1: Single-Day Isolation for Roster Overrides
- When an administrator modifies or saves a roster entry in **Today's Roster / Roster Management** for a specific date (e.g. `2026-09-01`), the record is written to the `daily_roasters` table tied strictly to that `(tenant_id, user_id, date)`.
- **Roster edits affect ONLY that specific day**.

### Rule 2: Automatic Reversion to Default Working Shift
- On the next day (or any date without an explicit record in `daily_roasters`), the system **automatically reverts back to the employee's Default Working Shift** (`default_shift_start` and `default_shift_end`).
- **No manual roster reset is needed by administrators**.

### Rule 3: Dynamic Check-In & Late Status Evaluation
- When a staff member checks in via Mobile or Staff Portal:
  1. The system checks if an explicit `daily_roasters` record exists for `today_str`.
  2. **If Daily Roster Record Exists**: Evaluate check-in time and 15-minute grace period against `roaster.start_time`.
  3. **If No Daily Roster Record Exists**: Evaluate check-in time and 15-minute grace period against the employee's `user.default_shift_start`.

---

## 🖥️ User Workflows

### Workflow A: Setting or Editing Default Working Shift
1. Navigate to **Admin Portal → User Management**.
2. To create a new staff member:
   - Click **Add User**.
   - Under **Default Working Shift**, select the employee's standard **Start Time** and **End Time**.
3. To edit an existing employee's standard shift:
   - Click **Edit** on the employee's card.
   - Update **Default Shift Start** / **Default Shift End** in the modal.
   - Click **Update User**.
4. The employee's card displays their permanent standard shift (e.g. `Default Shift: 09:00 – 18:00`).

### Workflow B: Managing Single-Day Roster Overrides
1. Navigate to **Admin Portal → Today's Roaster**.
2. Select the specific date to override (e.g. `2026-09-05` for a night shift or special schedule).
3. Update shift times, mark **Leave**, or mark **Week Off** for specific staff members.
4. Click **Save Roster**.
5. On `2026-09-05`, affected employees will work the overridden shift. On `2026-09-06`, all employees automatically resume their **Default Working Shift**.

---

## 🔒 Verification & Compliance
- **API Endpoint `GET /roaster/?date=YYYY-MM-DD`**:
  - Automatically queries explicit `daily_roasters` overrides for `date`.
  - For staff members without overrides on `date`, dynamically builds their roster record using `default_shift_start` and `default_shift_end`, flagged with `"is_default_shift": true`.
