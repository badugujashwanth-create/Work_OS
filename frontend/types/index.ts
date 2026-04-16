export type Role = 'admin' | 'manager' | 'employee' | 'hr' | 'auditor';

export type ActivityStatus = 'active' | 'idle' | 'offline';

export interface IEmployeeStatusRecord {
  _id: string;
  name: string;
  email: string;
  role: Role;
  status: ActivityStatus;
  idleMinutes: number;
  workingMinutes: number;
  sessionStatus: 'active' | 'paused' | 'stopped';
  sessionStart?: string;
  reason?: string;
}

export interface IEmployeeStatusSnapshot {
  updatedAt: string;
  summary: {
    active: number;
    idle: number;
    offline: number;
    onLeave: number;
    absent: number;
  };
  users: IEmployeeStatusRecord[];
}

export interface ISystemSettings {
  idleAlertSoftMinutes: number;
  idleAlertAdminMinutes: number;
  workStartHour: number;
  workEndHour: number;
  alertsEnabled: boolean;
  alertRoles: Role[];
  activeOutsideWorkHours: boolean;
  appWhitelist?: string[];
  domainWhitelist?: string[];
  chatRetentionDays?: number;
}

export interface IBrowserSettings {
  browserEnabled: boolean;
  browserHomeUrl?: string;
  browserAllowedUrls?: string[];
}

export interface IActivityAlert {
  _id: string;
  user: { _id: string; name: string; email: string; role: Role };
  type: 'idle_soft' | 'idle_admin' | 'offline_work_hours' | 'active_outside';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IReportUserRow {
  user: {
    _id: string;
    name: string;
    email: string;
    department?: string;
    role: Role;
  };
  activeMinutes: number;
  idleMinutes: number;
  offlineMinutes: number;
  sessions: number;
}

export interface IDailyActivityReport {
  date: string;
  workMinutes: number;
  users: IReportUserRow[];
}

export interface IWeeklySummaryReport {
  period: string;
  workMinutes: number;
  users: IReportUserRow[];
}

export interface ITeamOverviewReport {
  workMinutes: number;
  summary: {
    department: string;
    activeMinutes: number;
    idleMinutes: number;
    offlineMinutes: number;
    count: number;
  }[];
}

export interface IIdlePatternEntry {
  user: {
    _id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  count: number;
  latest: string;
}

export interface IIdlePatternReport {
  windowDays: number;
  patterns: IIdlePatternEntry[];
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  title?: string;
  status?: 'active' | 'inactive';
  isActive?: boolean;
  isDeactivated?: boolean;
  deactivatedAt?: string;
  lastActiveAt?: string;
  createdAt?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract';
  workHoursPerWeek?: number;
  attendancePreferences?: {
    shiftStart?: string;
    shiftEnd?: string;
    timezone?: string;
  };
  manager?: Pick<IUser, '_id' | 'name' | 'email'> | string;
}

export interface IAdminUserResponse {
  user: IUser;
  tempPassword?: string;
}

export type LeaveDecisionStatus = 'pending' | 'approved' | 'rejected';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveDurationType = 'full_day' | 'half_day' | 'hours';

export interface ILeaveType {
  _id: string;
  name: string;
  paid: boolean;
  isActive?: boolean;
  defaultAnnualDays?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ILeaveBalance {
  _id: string;
  userId: string | IUser;
  leaveTypeId: string | ILeaveType;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ILeaveRequest {
  _id: string;
  userId: string | IUser;
  leaveTypeId: string | ILeaveType;
  startAt: string;
  endAt: string;
  durationType: LeaveDurationType;
  hoursRequested?: number;
  reason?: string;
  attachmentUrl?: string;
  status: LeaveRequestStatus;
  managerDecision: LeaveDecisionStatus;
  adminDecision: LeaveDecisionStatus;
  managerId?: string | IUser;
  adminId?: string | IUser;
  managerComment?: string;
  adminComment?: string;
  createdAt: string;
  updatedAt?: string;
}

export type InviteStatus = 'active' | 'used' | 'expired';

export interface IInvite {
  _id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
  createdBy?: { _id: string; name?: string; email?: string } | string;
  usedBy?: { _id: string; name?: string; email?: string } | string;
}

export type TeamMemberRole = 'owner' | 'manager' | 'member';

export interface ITeam {
  _id: string;
  name: string;
  isArchived?: boolean;
  createdAt?: string;
  createdBy?: IUser;
}

export interface ITeamMember {
  _id: string;
  teamId?: string;
  userId?: string;
  role: TeamMemberRole;
  user?: IUser;
}

export interface IChannel {
  _id: string;
  teamId: string;
  name: string;
  type: 'general' | 'announcements' | 'project';
  isArchived?: boolean;
  createdAt?: string;
}

export interface ITeamMembership {
  team: ITeam;
  role: TeamMemberRole;
}

export interface IAdminTeam extends ITeam {
  members: ITeamMember[];
  channels: IChannel[];
}

export interface ITeamMessage {
  _id: string;
  teamId: string;
  channelId: string;
  senderId: string;
  sender?: IUser;
  text: string;
  createdAt: string;
}

export interface IWorkSession {
  _id: string;
  user: string;
  startTime: string;
  startAt?: string;
  endTime?: string;
  endAt?: string;
  idleTime: number;
  activeMs?: number;
  idleMs?: number;
  lastTickAt?: string;
  focusScore: number;
  activePages: { url: string; title?: string; duration?: number }[];
  tabSwitchCount: number;
  status: 'active' | 'paused' | 'stopped';
  events?: {
    type: string;
    actor?: IUser | string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  }[];
}

export interface IWorkdayTotals {
  activeMs: number;
  idleMs: number;
}

export interface IProject {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner?: IUser | string;
  managers?: (IUser | string)[];
  members?: (IUser | string)[];
  startDate?: string;
  dueDate?: string;
  tags?: string[];
}

export interface ITaskHistoryEntry {
  action: string;
  field?: string;
  from?: unknown;
  to?: unknown;
  actor?: IUser | string;
  createdAt?: string;
}

export interface ITaskAttachment {
  name?: string;
  url?: string;
  uploadedBy?: IUser | string;
  uploadedAt?: string;
}

export interface ITask {
  _id: string;
  title: string;
  description?: string;
  assignedTo?: IUser | string;
  assignedBy?: IUser | string;
  project?: IProject | string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  estimatedHours?: number;
  comments?: ITaskComment[];
  attachments?: ITaskAttachment[];
  history?: ITaskHistoryEntry[];
  tags?: string[];
}

export interface IDailyLog {
  _id: string;
  user?: IUser;
  whatDone: string;
  problems?: string;
  tomorrowPlan?: string;
  timeSpentPerTask?: { taskTitle?: string; minutes?: number }[];
  createdAt: string;
}

export interface ITaskComment {
  user?: IUser | string;
  message: string;
  createdAt?: string;
}

export interface IAttendanceRecord {
  _id: string;
  user?: IUser;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  workedMinutes?: number;
  totalBreakMinutes?: number;
  breaks?: { start: string; end?: string }[];
  summary?: string;
}

export interface ITimeSheetDay {
  _id: string;
  user?: IUser;
  date: string;
  clockInAt?: string;
  clockOutAt?: string;
  breakMinutes?: number;
  payableMinutes?: number;
  activeMinutes?: number;
  idleMinutes?: number;
  note?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvalNote?: string;
  approvedBy?: IUser | string;
  approvedAt?: string;
}

export interface IUsageSummaryApp {
  app: string;
  minutes: number;
  activeMinutes: number;
  idleMinutes: number;
  nonWorkMinutes: number;
  isWhitelisted: boolean;
}

export interface IUsageSummaryModule {
  module: string;
  minutes: number;
}

export interface IUsageSummaryExternalApp {
  app: string;
  minutes: number;
}

export interface IUsageSummary {
  date: string;
  userId: string;
  appWhitelist: string[];
  totals: {
    minutes: number;
    activeMinutes: number;
    idleMinutes: number;
    nonWorkMinutes: number;
  };
  apps: IUsageSummaryApp[];
  totalsByExternalApp?: IUsageSummaryExternalApp[];
  totalsByWorkosModule?: IUsageSummaryModule[];
  idleMinutes?: number;
  activeMinutes?: number;
}

export interface IAdminDashboardSnapshot {
  metrics: {
    totalEmployees: number;
    activeEmployees: number;
    totalProjects: number;
    onlineEmployees: number;
    hoursToday: number;
    hoursWeek: number;
    hoursMonth: number;
  };
  taskSummary: Record<string, number>;
  attendanceToday: IAttendanceRecord[];
  focusTrend: { label: string; focusScore: number }[];
  alerts: { type: string; message: string }[];
  idleUsers: IUser[];
  recentActivity: IActivityLog[];
}

export interface IActivityLog {
  _id: string;
  user?: IUser;
  role?: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface IPresenceMetrics {
  onlineUsers: number;
  idleUsers: number;
  activeSessions: number;
  liveHours: number;
}

export interface IPresenceUser {
  _id: string;
  name: string;
  role: Role;
  idle: boolean;
  lastActiveAt?: string;
  sessionStatus?: 'idle' | 'active' | 'paused' | 'stopped';
  sessionStart?: string;
}

export interface IPresencePayload {
  timestamp: string;
  liveMetrics: IPresenceMetrics;
  activeUsers: IPresenceUser[];
  idleUsers: IPresenceUser[];
}

export interface IPresenceUserStatus {
  _id: string;
  name: string;
  role: Role;
  status: ActivityStatus;
  lastActiveAt?: string;
}

export interface INotification {
  _id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  readAt?: string;
  context?: Record<string, unknown>;
}

export interface IDocument {
  _id: string;
  name: string;
  url: string;
  description?: string;
  tags?: string[];
  mimeType?: string;
  size?: number;
  accessRoles?: Role[];
  uploadedBy?: IUser;
  createdAt: string;
  updatedAt: string;
}

export interface IAnnouncement {
  _id: string;
  title: string;
  body: string;
  targetRoles?: Role[];
  createdBy?: IUser;
  createdAt: string;
  updatedAt: string;
}

export interface ICallSession {
  _id: string;
  title: string;
  scheduledFor?: string;
  channel: string;
  attendees: string[];
  status: 'scheduled' | 'live' | 'ended';
  host?: IUser;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICallMessage {
  _id: string;
  call: string | ICallSession;
  author?: IUser;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICollabMessage {
  _id: string;
  room: string;
  author?: IUser;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICollabFile {
  _id: string;
  room: string;
  name: string;
  link: string;
  owner?: IUser;
  createdAt: string;
  updatedAt: string;
}

export type CallLogStatus = 'missed' | 'answered' | 'rejected' | 'cancelled';

export interface ICallLog {
  _id: string;
  callId: string;
  fromUserId: IUser;
  toUserId: IUser;
  type: 'audio' | 'video';
  status: CallLogStatus;
  startedAt: string;
  endedAt: string;
  durationSec: number;
}

export interface IChatThread {
  _id: string;
  participants: IUser[];
  type: 'direct' | 'room';
  topic?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IChatMessage {
  _id: string;
  thread: string | IChatThread;
  author?: IUser;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type RiskAlertStatus = 'open' | 'snoozed' | 'resolved';
export type RiskAlertSeverity = 'info' | 'warning' | 'critical';
export type RiskAlertType =
  | 'no_clockin_2days'
  | 'low_hours'
  | 'too_much_idle'
  | 'no_usage_ticks';

export interface IRiskAlert {
  _id: string;
  userId: IUser | string;
  type: RiskAlertType;
  severity: RiskAlertSeverity;
  status: RiskAlertStatus;
  message: string;
  note?: string;
  metadata?: Record<string, unknown>;
  snoozedUntil?: string;
  resolvedAt?: string;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type RiskLevel = 'green' | 'yellow' | 'red';

export interface IControlCenterEmployee {
  user: IUser;
  status: ActivityStatus;
  workedMinutes: number;
  breakMinutes: number;
  leaveStatus: 'on_leave' | 'not_on_leave';
  leaveType?: string;
  platformTop: { app: string; minutes: number; idleMinutes: number; activeMinutes: number }[];
  moduleTop: { module: string; minutes: number }[];
  risk: RiskLevel;
  riskAlerts: IRiskAlert[];
  lastActivityAt?: string;
  teams: { _id: string; name: string }[];
}

export interface IControlCenterSnapshot {
  date: string;
  teams: { _id: string; name: string }[];
  employees: IControlCenterEmployee[];
}

export interface IControlCenterDetail {
  user: IUser;
  timesheetTrend: Array<{
    date: string;
    workedMinutes: number;
    breakMinutes: number;
    payableMinutes: number;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    approvalNote?: string;
  }>;
  platformBreakdown: { app: string; minutes: number; idleMinutes: number; activeMinutes: number }[];
  moduleBreakdown: { module: string; minutes: number }[];
  leaveHistory: ILeaveRequest[];
  timesheetApprovals: Array<{
    date: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    approvalNote?: string;
  }>;
}
