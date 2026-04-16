# Work Permission System - Complete Guide

## Overview

The Work Permission System ensures that **employees are explicitly asked for permission** before being assigned tasks or background work. This system tracks:

- **Employee capabilities** (skills, work types, experience)
- **Work availability** (hours per week, status, preferences)
- **Permission requests** (when tasks are assigned)
- **Work recommendations** (smart suggestions for task acceptance)
- **Performance metrics** (completion rate, acceptance rate)

## Key Features

### 1. Permission Request System

When a manager/admin assigns work to an employee, they initiate a **work permission request** that:

- Notifies the employee immediately
- Expires automatically after 7 days
- Includes work type, estimated hours, priority, and due date
- Can include a message explaining the work
- Requires explicit accept/reject response from employee

**API Endpoint**: `POST /api/workpermission/request`

```javascript
{
  taskId: "task_id",
  employeeId: "employee_id",
  workType: "development",      // development, design, testing, documentation, support, other
  estimatedHours: 8,
  priority: "high",             // low, medium, high, critical
  dueDate: "2026-04-20",
  message: "This needs to be done by Friday"
}
```

### 2. Employee Capability Profile

Each employee has a capability profile that tracks:

```javascript
{
  skills: [
    { name: "JavaScript", level: "expert", endorsements: 5 },
    { name: "React", level: "advanced", endorsements: 3 }
  ],
  workTypes: [
    { type: "development", proficiency: "high", yearsOfExperience: 5 },
    { type: "testing", proficiency: "medium", yearsOfExperience: 2 }
  ],
  availability: {
    status: "available",        // available, busy, on_leave, unavailable
    maxHoursPerWeek: 40,
    preferredWorkTypes: ["development", "testing"],
    preferredHours: { start: "09:00", end: "17:00" }
  },
  workStyle: {
    remoteFriendly: true,
    collaborationPreference: "hybrid",
    communicationPreference: ["email", "chat", "video-call"]
  },
  constraints: {
    canWorkWeekends: false,
    canWorkOvertime: true,
    maxConcurrentTasks: 5,
    blackoutDates: [
      { start: "2026-05-01", end: "2026-05-05", reason: "vacation" }
    ]
  },
  performance: {
    totalTasksAssigned: 15,
    tasksCompleted: 12,
    averageCompletionRate: 80,
    workPermissionAcceptanceRate: 85,
    averageResponseTime: 120    // minutes
  }
}
```

### 3. Work Recommendations

The system provides **smart recommendations** for which tasks the employee should accept:

- Matches task work type with employee expertise
- Considers priority alignment
- Checks time availability
- Scores matches (0-100)
- Suggests accept/reject based on fit

**API Endpoint**: `GET /api/workpermission/recommendations/my`

```javascript
[
  {
    permissionId: "perm_id",
    task: { _id: "task_id", title: "Build API" },
    matchScore: 85,
    reasons: [
      "Matches your expertise",
      "Fits your availability",
      "You have capacity"
    ],
    shouldAccept: true
  },
  {
    permissionId: "perm_id_2",
    task: { _id: "task_id_2", title: "Design mockups" },
    matchScore: 25,
    reasons: [],
    shouldAccept: false
  }
]
```

### 4. Workload Tracking

The system tracks employee workload:

```javascript
{
  workload: {
    activeTasks: 3,           // Number of tasks in progress
    pendingPermissions: 2,    // Pending permission requests
    isOverloaded: false       // Exceeds max concurrent tasks
  },
  acceptanceStats: {
    total: 20,
    accepted: 17,
    rejected: 3,
    acceptanceRate: 85        // Percentage
  },
  canAccept: {
    canAccept: true,
    reason: "Ready to accept new work"
  },
  maxConcurrentTasks: 5,
  isOverloaded: false
}
```

## Frontend Usage

### Display Work Permissions

```typescript
import { WorkPermissionPanel } from '@/components/WorkPermissionPanel';

export default function Dashboard() {
  return (
    <div>
      <WorkPermissionPanel />
    </div>
  );
}
```

### Programmatic Usage

```typescript
import { workPermissionService } from '@/services/workPermissionService';

// Get pending permissions for current user
const permissions = await workPermissionService.getPendingPermissions();

// Accept a permission
await workPermissionService.acceptPermission(permissionId, 'Optional notes');

// Reject a permission
await workPermissionService.rejectPermission(permissionId, 'Too busy right now');

// Get work recommendations
const recommendations = await workPermissionService.getWorkRecommendations();

// Get employee workload
const workload = await workPermissionService.getEmployeeWorkload(employeeId);

// Update capability profile
await workPermissionService.updateEmployeeCapability(employeeId, {
  availability: { status: 'busy', maxHoursPerWeek: 40 }
});

// Add skill
await workPermissionService.addSkill(employeeId, {
  name: 'TypeScript',
  level: 'intermediate'
});

// Add work type
await workPermissionService.addWorkType(employeeId, {
  type: 'development',
  proficiency: 'high',
  yearsOfExperience: 5
});
```

## Backend API Routes

### Permission Routes

| Method | Endpoint | Description | Requires |
|--------|----------|-------------|----------|
| POST | `/api/workpermission/request` | Request permission for employee | admin/manager |
| PATCH | `/api/workpermission/:permissionId/accept` | Accept permission | own user |
| PATCH | `/api/workpermission/:permissionId/reject` | Reject permission | own user |
| GET | `/api/workpermission/pending` | Get pending permissions | authenticated |
| GET | `/api/workpermission/task/:taskId` | Get all permissions for task | admin/manager |

### Capability Routes

| Method | Endpoint | Description | Requires |
|--------|----------|-------------|----------|
| GET | `/api/workpermission/capability/:employeeId` | Get capability profile | authenticated |
| PATCH | `/api/workpermission/capability/:employeeId` | Update capability profile | owner/admin |
| GET | `/api/workpermission/workload/:employeeId` | Get workload info | authenticated |
| GET | `/api/workpermission/recommendations/my` | Get work recommendations | authenticated |

## Manager/Admin Workflow

### Assigning Work with Permission

1. Manager views employee profile or create task
2. Clicks "Request Permission" instead of direct assign
3. Fills form with:
   - Work type (e.g., "development")
   - Estimated hours
   - Priority level
   - Due date
   - Optional message
4. Permission request sent to employee with notification
5. Manager can see status in "Task Permissions" view
6. Employee accepts or rejects within 7 days
7. On acceptance, task is automatically assigned
8. On rejection, manager can:
   - Try reassigning to another employee
   - Adjust the request (hours, deadline)
   - Escalate if urgent

### Monitoring Employee Capacity

1. View employee capability profile
   - Skills, work types, experience level
   - Current availability status
   - Max concurrent tasks
2. Check workload
   - Active tasks count
   - Pending permission requests
   - Acceptance rate
   - Can accept more work? (yes/no)
3. Make informed assignment decisions
   - Only assign when employee can handle it
   - Match work type with expertise
   - Consider time availability

## Employee Workflow

### Responding to Permission Requests

1. Employee sees notification: "New work permission request"
2. Opens permission detail showing:
   - Task title and description
   - Requested by (manager name)
   - Work type, hours, priority
   - Due date
   - Manager's message
3. Employee can:
   - **Accept**: Task is assigned, they start working
   - **Decline**: Permission rejected, manager sees reason
4. Employee can add optional notes/reason
5. Permission expires in 7 days if no response

### Setting Up Capability Profile

1. Employee updates their profile with:
   - **Skills**: Languages, frameworks, tools
   - **Work Types**: What they do best (development, design, etc.)
   - **Availability**: Hours/week, status, preferred hours
   - **Work Style**: Remote preference, collaboration style
   - **Constraints**: Can work weekends? Max tasks?
   - **Special Skills**: Certifications, specializations

2. System uses this to:
   - Recommend suitable tasks
   - Avoid overloading
   - Match work with expertise
   - Calculate acceptance recommendations

### Viewing Recommendations

1. Employee sees "Suggested Work" section
2. System shows tasks ranked by match score
3. Green star (★) = Highly recommended for you
4. Gray star (☆) = Not a good fit
5. Employee can:
   - Click "Accept Recommended" to accept high matches
   - Accept anyway if interested
   - See why something is/isn't recommended

## Permission Status Flow

```
┌─────────────┐
│   PENDING   │ (Waiting for employee response)
└──────┬──────┘
       │
       ├──→ ACCEPTED (Employee accepted, task assigned)
       │
       ├──→ REJECTED (Employee declined)
       │
       └──→ EXPIRED (7 days passed without response)
```

## Notification System

Employees receive notifications for:

1. **New Permission Request**
   - Task title, priority, due date
   - Who requested it
   - Action: Accept/Decline

2. **Permission Expiring Soon**
   - Shows which permissions expire in 24 hours
   - Action: Respond now

3. **Permission Request Accepted**
   - Manager sees employee accepted
   - Action: Task is assigned

4. **Permission Request Rejected**
   - Manager sees rejection reason
   - Action: Reassign or follow up

## Database Models

### WorkPermission Schema

```javascript
{
  employee: ObjectId,           // Employee being asked
  task: ObjectId,               // Task being assigned
  requestedBy: ObjectId,        // Manager who requested
  status: String,               // pending, accepted, rejected, expired
  workType: String,
  estimatedHours: Number,
  priority: String,
  dueDate: Date,
  requestMessage: String,
  employeeNotes: String,        // Employee's acceptance/rejection note
  respondedAt: Date,
  expiresAt: Date,
  taskSnapshot: {               // Snapshot of task at request time
    title: String,
    description: String,
    priority: String
  }
}
```

### EmployeeCapability Schema

```javascript
{
  employee: ObjectId,
  skills: [{name, level, endorsements}],
  workTypes: [{type, proficiency, yearsOfExperience}],
  availability: {
    status,
    maxHoursPerWeek,
    preferredWorkTypes,
    preferredHours
  },
  workStyle: {
    remoteFriendly,
    collaborationPreference,
    communicationPreference
  },
  performance: {
    totalTasksAssigned,
    tasksCompleted,
    averageCompletionRate,
    workPermissionAcceptanceRate,
    averageResponseTime
  },
  constraints: {
    canWorkWeekends,
    canWorkOvertime,
    maxConcurrentTasks,
    blackoutDates
  },
  preferences: {
    autoAcceptWork,
    permissionRequestExpiryDays,
    notifyOnNewTask,
    notifyOnPermissionExpiry
  }
}
```

## Benefits

✅ **Employees**: Control over work assignments, clear expectations, fair workload
✅ **Managers**: Know who can accept work, data-driven assignment decisions
✅ **Organization**: Better resource utilization, higher acceptance rates
✅ **Transparency**: Clear record of who accepted/rejected what work
✅ **Fairness**: Prevents overloading specific employees
✅ **Smart Matching**: AI-like recommendations for optimal assignments

## Implementation Checklist

- [x] Create WorkPermission model
- [x] Create EmployeeCapability model
- [x] Implement permission request API
- [x] Implement accept/reject API
- [x] Create work recommendations engine
- [x] Add workload tracking
- [x] Create notification system integration
- [x] Build frontend permission panel
- [x] Add capability profile management
- [ ] Integrate with task assignment workflow
- [ ] Add analytics dashboard for permissions
- [ ] Create permission history reports
- [ ] Add bulk permission management

## Next Steps

1. **Integrate with Task Controller**: When creating tasks, use permission system
2. **Add Dashboard**: Show permission metrics and trends
3. **Create Reports**: Employee acceptance rate, assignment patterns
4. **Analytics**: Which tasks are accepted/rejected most
5. **Auto-suggestions**: ML-based work type recommendations
6. **Integration**: Slack/Teams notifications for permissions
7. **Mobile**: Mobile app for quick permission responses

---

**Status**: ✅ Core system implemented and ready to use
