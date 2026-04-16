# 🚀 LOCAL TESTING GUIDE - Everything Running!

## ✅ Current Status

**Backend**: Running on http://localhost:5000 ✅  
**Frontend**: Running on http://localhost:3000 ✅  
**Database**: In-memory MongoDB (auto-seeded) ✅  

---

## 📍 DEMO ACCOUNTS (Auto-created)

Login with these credentials:

### Admin Account
```
Email: admin@workos.dev
Password: Admin@123
```

### Manager Account
```
Email: manager@workos.dev
Password: Manager@123
```

### Employee Account 1
```
Email: eli@workos.dev
Password: Employee@123
```

### Employee Account 2
```
Email: nia@workos.dev
Password: Employee@456
```

### HR Account
```
Email: hr@workos.dev
Password: Hr@123456
```

### Auditor Account
```
Email: auditor@workos.dev
Password: Auditor@123
```

---

## 🧪 TESTING SCENARIOS

### Scenario 1: Test Work Permission System

**Step 1: Login as Manager**
1. Go to http://localhost:3000
2. Login with: `manager@workos.dev` / `Manager@123`

**Step 2: Create a Task**
1. Navigate to Tasks section
2. Click "Create Task"
3. Fill form:
   - Title: "Build Login Feature"
   - Description: "Implement JWT authentication"
   - Priority: High
   - Save the task

**Step 3: Request Permission from Employee**
1. Find the task you created
2. Click "Request Permission" (NOT direct assign)
3. Select employee: `eli@workos.dev`
4. Fill form:
   - Work Type: development
   - Estimated Hours: 8
   - Priority: High
   - Due Date: 2026-04-20
   - Message: "Please help with this urgent task"
5. Send request

**Step 4: Employee Reviews Permission**
1. Open new browser window (or logout)
2. Login as employee: `eli@workos.dev` / `Employee@123`
3. Look for "Work Permissions" section on dashboard
4. Should see notification for the permission request
5. Click "Accept" or "Decline"
   - If Accept: Task is now assigned
   - If Decline: Task stays unassigned

**Step 5: Manager Sees Response**
1. Switch back to manager account
2. Check task - see permission status
3. See who accepted/rejected and why

✅ **Work Permission System Verified**

---

### Scenario 2: Test Employee Capability Profile

**Step 1: Login as Employee**
1. Login with: `eli@workos.dev` / `Employee@123`

**Step 2: Update Capability Profile**
1. Go to Profile/Settings
2. Update:
   - Skills: "JavaScript (Expert)", "React (Advanced)"
   - Work Types: Development (High proficiency)
   - Availability: 40 hours/week
   - Can work weekends: No
   - Max concurrent tasks: 5

**Step 3: Update Availability**
1. Change status to "Busy" (simulating overload)
2. Manager trying to request work should see warning

✅ **Capability Profile Verified**

---

### Scenario 3: Test Smart Recommendations

**Step 1: Manager Creates Multiple Tasks**
1. Create 3 tasks with different work types:
   - Task A: development, 4 hours
   - Task B: testing, 6 hours
   - Task C: documentation, 2 hours

**Step 2: Manager Requests All 3**
1. Request all 3 tasks for same employee
2. Set different priorities

**Step 3: Employee Views Recommendations**
1. Login as employee
2. Go to Work Permissions
3. Should see recommendations scored 0-100
4. Green checkmark (★) for good matches
5. Gray X (☗) for poor matches
6. Reasons why each is/isn't recommended

✅ **Recommendations Verified**

---

### Scenario 4: Test Timesheet CSV Export

**Step 1: Employee Clock In**
1. Login as employee: `eli@workos.dev`
2. Go to Timesheet section
3. Click "Clock In"
4. System shows: Current time, hours worked

**Step 2: Clock Out**
1. After a few minutes, click "Clock Out"
2. Timesheet entry created

**Step 3: Export to CSV**
1. Click "Export Timesheet"
2. Choose date range
3. Download CSV file
4. File should have columns: Date, Clock In, Clock Out, Break Time, Payable Hours, Notes

✅ **CSV Export Verified**

---

### Scenario 5: Test Real-time Features

**Step 1: Open Multiple Browser Windows**
1. Window 1: Login as manager
2. Window 2: Login as employee
3. Window 3: Login as another manager

**Step 2: Send Permission Request**
1. In Window 1: Send permission request to employee
2. In Window 2: Should see notification immediately
3. Employee accepts/rejects

**Step 3: See Update in Real-time**
1. In Window 1: Manager should see status update
2. Both should get notifications

✅ **Real-time Features Verified**

---

### Scenario 6: Test Platform Detection

**Step 1: Check Console**
1. Login to application
2. Open DevTools (F12)
3. Go to Console tab
4. You should see platform info logged

**Step 2: Check Different Devices**
1. Open on mobile browser (or DevTools mobile mode)
2. Desktop app still works
3. Responsive design adapts

✅ **Platform Detection Verified**

---

## 📊 API TESTING (Using Browser DevTools)

### Test Work Permission Endpoint

**Open DevTools (F12) → Network tab**

**Request permission from manager account:**
```
POST http://localhost:5000/api/workpermission/request

Body:
{
  "taskId": "YOUR_TASK_ID",
  "employeeId": "EMPLOYEE_ID",
  "workType": "development",
  "estimatedHours": 8,
  "priority": "high",
  "message": "Test permission"
}

Response (should be 201):
{
  "message": "Work permission requested",
  "permission": { ...permission object... }
}
```

**Get pending permissions (as employee):**
```
GET http://localhost:5000/api/workpermission/pending

Response (should be 200):
[
  { ...permission objects... }
]
```

**Accept permission:**
```
PATCH http://localhost:5000/api/workpermission/PERMISSION_ID/accept

Body:
{
  "notes": "I can start immediately"
}

Response (should be 200):
{
  "message": "Work permission accepted",
  "permission": { ...updated permission... }
}
```

---

## 🔍 DEBUGGING TIPS

### Check Backend Logs

**Terminal 1 (Backend):**
- Shows all API requests
- Shows database operations
- Shows errors/warnings
- If an error occurs, fix the issue and backend will auto-restart

### Check Frontend Logs

**Browser DevTools (F12):**
- Console tab: JavaScript errors
- Network tab: API calls and responses
- Application tab: Local storage, cookies

### Common Issues & Solutions

**Issue: "Cannot connect to API"**
- Solution: Check backend terminal shows "WorkHub API on port 5000"
- Check frontend .env has correct API_URL

**Issue: "401 Unauthorized"**
- Solution: Need to login first
- Check token is being sent in Authorization header
- Check JWT_SECRET matches both backend and tokens

**Issue: "Permission denied"**
- Solution: Check user role (admin/manager for requesting)
- Check you're logged in as correct user

**Issue: "Task not found"**
- Solution: Create task first before requesting permission
- Copy correct task ID

---

## ✅ VERIFICATION CHECKLIST

After testing, verify:

- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] Can login with demo accounts
- [ ] Can create tasks
- [ ] Can request work permissions
- [ ] Employee receives notification
- [ ] Employee can accept/reject
- [ ] Task auto-assigns on accept
- [ ] Smart recommendations work
- [ ] Timesheet clock in/out works
- [ ] CSV export downloads
- [ ] Real-time updates visible
- [ ] No console errors
- [ ] No API errors (check Network tab)

---

## 🛑 STOPPING SERVERS

### To Stop Backend
In backend terminal:
```
Press Ctrl+C
```

### To Stop Frontend
In frontend terminal:
```
Press Ctrl+C
```

### To Restart
```
# Backend
npm run dev

# Frontend
npm run dev
```

---

## 📝 NOTES

- **Database**: Runs in-memory (resets on backend restart)
- **Auto-seed**: Demo data created automatically on startup
- **Hot Reload**: Both backend and frontend auto-reload on file changes
- **All Features**: Everything is local - no internet needed!

---

## 🎯 NEXT STEPS

1. ✅ Test all scenarios above
2. ✅ Check everything works as expected
3. ✅ Take screenshots/videos for documentation
4. ✅ Note any issues for fixing
5. ✅ When satisfied, proceed to production deployment

---

**Happy Testing! 🚀**

If you find any issues, they'll show in the terminal logs. Fix them and the app will auto-restart.
