import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import DailyLog from '../models/DailyLog.js';
import WorkSession from '../models/WorkSession.js';
import Attendance from '../models/Attendance.js';
import CallSession from '../models/CallSession.js';
import CallMessage from '../models/CallMessage.js';
import ChatThread from '../models/ChatThread.js';
import ChatMessage from '../models/ChatMessage.js';
import AuditLog from '../models/AuditLog.js';
import NotificationRule from '../models/NotificationRule.js';
import Notification from '../models/Notification.js';
import SystemSetting from '../models/SystemSetting.js';
import ActivityAlert from '../models/ActivityAlert.js';
import Document from '../models/Document.js';
import Announcement from '../models/Announcement.js';
import CollabMessage from '../models/CollabMessage.js';
import CollabFile from '../models/CollabFile.js';

const minutesToMs = (minutes) => minutes * 60 * 1000;
const addDays = (days) => dayjs().add(days, 'day').toDate();
const addMinutes = (minutes) => dayjs().add(minutes, 'minute').toDate();

const shouldSeed = () => {
  if (process.env.SEED_TEMP_DATA === 'false') return false;
  if (process.env.SEED_TEMP_DATA === 'true') return true;
  return !process.env.MONGO_URI || process.env.MONGO_URI === 'memory';
};

const demoUsers = [
  {
    name: 'Ava Morgan',
    email: 'admin@workos.dev',
    password: 'Admin@123',
    role: 'admin',
    title: 'Program Lead',
    department: 'Central Ops'
  },
  {
    name: 'Kai Romero',
    email: 'manager@workos.dev',
    password: 'Manager@123',
    role: 'manager',
    title: 'Operations Manager',
    department: 'Pods'
  },
  {
    name: 'Mira Patel',
    email: 'hr@workos.dev',
    password: 'Hr@123456',
    role: 'hr',
    title: 'People Partner',
    department: 'People Ops'
  },
  {
    name: 'Omar Reed',
    email: 'auditor@workos.dev',
    password: 'Auditor@123',
    role: 'auditor',
    title: 'Compliance Auditor',
    department: 'Risk & Compliance'
  },
  {
    name: 'Eli Flores',
    email: 'eli@workos.dev',
    password: 'Employee@123',
    role: 'employee',
    title: 'Product Intern',
    department: 'Pods'
  },
  {
    name: 'Nia Singh',
    email: 'nia@workos.dev',
    password: 'Employee@456',
    role: 'employee',
    title: 'Automation Analyst',
    department: 'Pods'
  }
];

const logDemoCredentials = () => {
  console.log('Seeded demo accounts:');
  demoUsers.forEach((user) => {
    console.log(` - ${user.role.toUpperCase()}: ${user.email} / ${user.password}`);
  });
};

const buildDemoSessions = (employees) =>
  employees.map((employee, index) => ({
    user: employee._id,
    startTime: dayjs().subtract(index + 2, 'hour').toDate(),
    endTime: dayjs().subtract(index * 15, 'minute').toDate(),
    idleTime: minutesToMs(5 + index * 3),
    focusScore: 78 + index * 4,
    activePages: [
      {
        url: 'https://workhub.local/dashboard',
        title: 'Work Mode Console',
        duration: minutesToMs(32)
      },
      {
        url: 'https://docs.workhub/meeting-cockpit',
        title: 'Meeting Cockpit Spec',
        duration: minutesToMs(18)
      }
    ],
    tabSwitchCount: 9 + index * 3,
    status: 'stopped'
  }));

const seedNotificationRules = async () => {
  const idleRule = await NotificationRule.findOne({ eventType: 'idle_threshold' });
  if (!idleRule) {
    await NotificationRule.create({
      name: 'Idle > 45m',
      description: 'Escalate to admins when an operator is idle for more than 45 minutes.',
      eventType: 'idle_threshold',
      condition: { minutes: 45 },
      targetRoles: ['admin', 'manager'],
      severity: 'warning'
    });
  }
};

const DEFAULT_SETTINGS = [
  { key: 'idleAlertSoftMinutes', value: 15 },
  { key: 'idleAlertAdminMinutes', value: 30 },
  { key: 'workStartHour', value: 9 },
  { key: 'workEndHour', value: 18 },
  { key: 'alertsEnabled', value: true },
  { key: 'alertRoles', value: ['admin', 'manager'] },
  { key: 'activeOutsideWorkHours', value: false }
];

const seedSystemSettings = async () => {
  await Promise.all(
    DEFAULT_SETTINGS.map((setting) =>
      SystemSetting.updateOne({ key: setting.key }, { value: setting.value }, { upsert: true })
    )
  );
};

export const seedTempData = async () => {
  if (!shouldSeed()) return;
  const hasUsers = await User.countDocuments();
  if (hasUsers > 0) return;

  try {
    console.log('Seeding WorkHub foundation data...');
    await Promise.all([
      Task.deleteMany({}),
      DailyLog.deleteMany({}),
      WorkSession.deleteMany({}),
      CallSession.deleteMany({}),
      CallMessage.deleteMany({}),
      ChatThread.deleteMany({}),
      ChatMessage.deleteMany({}),
      Attendance.deleteMany({}),
      Project.deleteMany({}),
      AuditLog.deleteMany({}),
      NotificationRule.deleteMany({}),
      Notification.deleteMany({}),
      Document.deleteMany({}),
      Announcement.deleteMany({}),
      CollabMessage.deleteMany({}),
      CollabFile.deleteMany({}),
      SystemSetting.deleteMany({}),
      ActivityAlert.deleteMany({})
    ]);

    await Role.ensureCoreRoles();
    const roleDocs = await Role.find({});

    const hashedUsers = await Promise.all(
    demoUsers.map(async (user) => {
      const roleDoc = roleDocs.find((role) => role.name === user.role);
      return {
        ...user,
        roleRef: roleDoc?._id,
        permissions: roleDoc?.permissions || [],
        password: await bcrypt.hash(user.password, 10),
        lastActiveAt: new Date(),
        activityStatus: 'active',
        idleSince: null,
        isActive: true,
        isDeactivated: false,
        status: 'active'
      };
    })
  );

    const createdUsers = await User.insertMany(hashedUsers);
    const admin = createdUsers.find((user) => user.role === 'admin');
    const manager = createdUsers.find((user) => user.role === 'manager');
    const hr = createdUsers.find((user) => user.role === 'hr');
    const auditor = createdUsers.find((user) => user.role === 'auditor');
    const employees = createdUsers.filter((user) => user.role === 'employee');

    if (!admin || employees.length === 0) {
      console.warn('Seed aborted: missing admin or employee users.');
      return;
    }

    const projectPayload = [
      {
        name: 'Meeting Cockpit',
        code: 'MC-OPS',
        owner: manager?._id || admin._id,
        managers: manager ? [manager._id] : [admin._id],
        members: employees.map((emp) => emp._id).slice(0, 2),
        status: 'active',
        priority: 'high',
        startDate: addDays(-10),
        dueDate: addDays(20),
        tags: ['calls', 'dashboard']
      },
      {
        name: 'Automation Insights',
        code: 'AUTO-INT',
        owner: admin._id,
        managers: hr ? [hr._id] : [admin._id],
        members: employees.map((emp) => emp._id),
        status: 'planning',
        priority: 'medium',
        startDate: addDays(-20),
        dueDate: addDays(14),
        tags: ['automation', 'reporting']
      }
    ];

    const projects = await Project.insertMany(projectPayload);

    const taskPayload = [
      {
        title: 'Meeting cockpit rollout',
        description: 'Ship upcoming meetings list, scheduler, and call-side chat polish.',
        assignedTo: employees[0]._id,
        assignedBy: admin._id,
        project: projects[0]._id,
        status: 'in_progress',
        priority: 'high',
        dueDate: addDays(2),
        tags: ['meeting', 'call hub'],
        comments: [
          { user: admin._id, message: 'Need a clickable demo for Friday review.' },
          { user: employees[0]._id, message: 'UI done, wiring real-time feed now.' }
        ]
      },
      {
        title: 'Automate daily log exports',
        description: 'Connect AI summaries + CSV export for compliance review.',
        assignedTo: employees[1]._id,
        assignedBy: admin._id,
        project: projects[1]._id,
        status: 'todo',
        priority: 'medium',
        dueDate: addDays(4),
        tags: ['automation', 'logs'],
        comments: [{ user: admin._id, message: 'Start after cockpit QA passes.' }]
      },
      {
        title: 'Focus intelligence QA',
        description: 'Validate idle timers, dwell analytics, and focus scoring math.',
        assignedTo: employees[0]._id,
        assignedBy: admin._id,
        project: projects[0]._id,
        status: 'review',
        priority: 'medium',
        dueDate: addDays(1),
        tags: ['focus', 'qa'],
        comments: [{ user: employees[0]._id, message: 'Ready for verification in staging.' }]
      }
    ];

    const createdTasks = await Task.insertMany(taskPayload);

    const attendancePayload = employees.flatMap((employee, index) =>
      Array.from({ length: 4 }).map((_, offset) => {
        const date = dayjs().subtract(offset, 'day').startOf('day');
        const checkIn = date.add(9, 'hour').add(index * 5, 'minute');
        const checkOut = date.add(17, 'hour').add(30 - index * 3, 'minute');
        const breakStart = date.add(13, 'hour');
        return {
          user: employee._id,
          date: date.toDate(),
          checkIn: checkIn.toDate(),
          checkOut: checkOut.toDate(),
          breaks: [
            { start: breakStart.toDate(), end: breakStart.add(30, 'minute').toDate() }
          ],
          workedMinutes: 8 * 60 - 30,
          totalBreakMinutes: 30,
          status: 'completed',
          summary: 'Seeded attendance record'
        };
      })
    );
    await Attendance.insertMany(attendancePayload);

    const logPayload = [
      {
        user: employees[0]._id,
        whatDone: 'Finished meeting cockpit UI and wired live queue socket listener.',
        problems: 'Scheduler form still needs validation copy tweaks.',
        tomorrowPlan: 'Polish call-side chat + add file handoff ledger.',
        timeSpentPerTask: [
          { task: createdTasks[0]._id, taskTitle: createdTasks[0].title, minutes: 210 },
          { task: createdTasks[2]._id, taskTitle: createdTasks[2].title, minutes: 95 }
        ]
      },
      {
        user: employees[1]._id,
        whatDone: 'Mapped AI summary API response to daily log export and PDF builder.',
        problems: 'Need sample data for idle alerts test cases.',
        tomorrowPlan: 'Hook automation to weekly digest emails.',
        timeSpentPerTask: [
          { task: createdTasks[1]._id, taskTitle: createdTasks[1].title, minutes: 160 },
          { taskTitle: 'Idle alert QA', minutes: 60 }
        ]
      }
    ];
    await DailyLog.insertMany(logPayload);
    await WorkSession.insertMany(buildDemoSessions(employees));

    const callSessions = await CallSession.insertMany([
      {
        title: 'Pod stand-up',
        scheduledFor: addMinutes(20),
        channel: '#work-os',
        attendees: ['You', 'Lena (Design)', 'Hiro (Ops)'],
        status: 'live',
        host: admin._id,
        startTime: dayjs().subtract(5, 'minute').toDate()
      },
      {
        title: 'Client status sync',
        scheduledFor: addMinutes(120),
        channel: 'Secure Bridge',
        attendees: ['You', 'Ops lead', 'Client PM'],
        status: 'scheduled',
        host: admin._id
      }
    ]);
    await CallMessage.insertMany([
      {
        call: callSessions[0]._id,
        author: employees[0]._id,
        body: 'Routing deck ready for screen share.'
      },
      {
        call: callSessions[0]._id,
        author: employees[1]._id,
        body: 'Remember to confirm the metrics package before wrap-up.'
      }
    ]);

    const chatThreads = await ChatThread.insertMany([
      {
        participants: [admin._id, employees[0]._id],
        type: 'direct',
        topic: 'Ops coaching thread',
        lastMessageAt: new Date()
      },
      {
        participants: [employees[0]._id, employees[1]._id],
        type: 'direct',
        topic: 'Automation ideas',
        lastMessageAt: new Date()
      }
    ]);
    await ChatMessage.insertMany([
      {
        thread: chatThreads[0]._id,
        author: admin._id,
        body: 'Morning! Sync notes are in the deck. Ping me if you need support.'
      },
      {
        thread: chatThreads[0]._id,
        author: employees[0]._id,
        body: 'On it - direct chat UI is almost ready.'
      },
      {
        thread: chatThreads[1]._id,
        author: employees[0]._id,
        body: 'Let’s pair on idle-alert automation later today.'
      },
      {
        thread: chatThreads[1]._id,
        author: employees[1]._id,
        body: 'Sounds good. Dropping my checklist in this thread.'
      }
    ]);

    await CollabMessage.insertMany([
      {
        room: 'strategy',
        author: admin._id,
        body: 'Daily kickoff in 10 minutes. Drop blockers before we start.'
      },
      {
        room: 'strategy',
        author: employees[0]._id,
        body: 'Focus mode is on, updating dashboards now.'
      },
      {
        room: 'strategy',
        author: employees[1]._id,
        body: 'Focus score at 92. Keep two key windows on screen for peak flow.'
      }
    ]);

    await CollabFile.insertMany([
      {
        room: 'strategy',
        name: 'Sprint 12 deck.pptx',
        link: 'https://drive.work/sprint12',
        owner: employees[1]._id
      },
      {
        room: 'strategy',
        name: 'Client brief v3.pdf',
        link: 'https://drive.work/brief-v3',
        owner: employees[0]._id
      }
    ]);

    await seedNotificationRules();
    await seedSystemSettings();
    await Notification.create({
      targetRoles: ['admin'],
      message: 'System seeded with demo data.',
      severity: 'info'
    });
    await Announcement.create({
      title: 'Welcome to WorkHub',
      body: 'Daily standup is at 9:30 AM. Drop blockers in the strategy room before kickoff.',
      targetRoles: ['employee'],
      createdBy: admin._id
    });

    await AuditLog.insertMany([
      {
        user: admin._id,
        role: admin.role,
        action: 'seed:init',
        entityType: 'system',
        description: 'Demo dataset created',
        metadata: { tasks: createdTasks.length }
      },
      {
        user: manager?._id || admin._id,
        role: manager?.role || admin.role,
        action: 'project:create',
        entityType: 'project',
        entityId: projects[0]._id,
        description: `${projects[0].name} kickoff`,
        metadata: { priority: projects[0].priority }
      },
      {
        user: auditor?._id || admin._id,
        role: auditor?.role || admin.role,
        action: 'audit:view',
        entityType: 'system',
        description: 'Initial controls verified'
      }
    ]);

    logDemoCredentials();
  } catch (error) {
    console.error('Failed to seed temporary data:', error);
  }
};

export default seedTempData;
