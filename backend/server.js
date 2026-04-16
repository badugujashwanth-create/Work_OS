import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import { getAllowedOrigins, isOriginAllowed } from './config/origins.js';
import seedTempData from './utils/seedTempData.js';
import Role from './models/Role.js';
import authRoutes from './routes/authRoutes.js';
import workRoutes from './routes/workRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import logRoutes from './routes/logRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import callRoutes from './routes/callRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import userRoutes from './routes/userRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import statusRoutes from './routes/statusRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import collabRoutes from './routes/collabRoutes.js';
import timesheetRoutes from './routes/timesheetRoutes.js';
import usageRoutes from './routes/usageRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import teamChatRoutes from './routes/teamChatRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import { initSocket } from './socket.js';

dotenv.config();

const app = express();
app.disable('etag');
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
const server = http.createServer(app);
initSocket(server);

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins))
        return callback(null, true);
      callback(new Error(`CORS policy blocks requests from ${origin}`));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/work', workRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/collab', collabRoutes);
app.use('/api/timesheet', timesheetRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/chat', teamChatRoutes);
app.use('/api/leave', leaveRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'workhub-backend' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('API error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = Number(process.env.PORT || 5000);
let serverStarted = false;
let serverStarting = false;

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the other process or set PORT to an open port before starting WorkHub API.`
    );
    serverStarted = false;
    serverStarting = false;
    return;
  }
  console.error('Server error:', error);
});

const shutdownServer = async (signal) => {
  if (serverStarted && server.listening) {
    console.log(`Gracefully shutting down server due to ${signal}`);
    await new Promise((resolve) => server.close(resolve));
  }
  process.exit(0);
};

['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((signal) => {
  process.on(signal, () => shutdownServer(signal));
});

const start = async () => {
  if (serverStarted || serverStarting || server.listening) return;
  serverStarting = true;
  try {
    await connectDB();
  } catch (error) {
    serverStarting = false;
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  try {
    await Role.ensureCoreRoles();
  } catch (error) {
    console.error('Failed to ensure core roles:', error);
  }

  try {
    await seedTempData();
  } catch (error) {
    console.error('Seed failed, continuing server start:', error);
  }

  server.listen(PORT, () => {
    serverStarted = true;
    serverStarting = false;
    console.log(`WorkHub API on port ${PORT}`);
  });
};

start();
