import Channel from '../models/Channel.js';
import Team from '../models/Team.js';
import TeamMessage from '../models/TeamMessage.js';
import { recordAuditLog } from '../utils/auditLogger.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';
import { getSettings } from '../services/settingsService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseDateRange = (value) => {
  if (!value) return {};
  const raw = String(value).trim();
  if (!raw) return {};
  const parts = raw.split(',');
  if (parts.length !== 2) return { invalid: true };
  const start = toDate(parts[0]);
  const end = toDate(parts[1]);
  if (!start || !end) return { invalid: true };
  return { start, end };
};

const sortChannels = (channels = []) =>
  channels.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    if (a.type === 'announcements') return -1;
    if (b.type === 'announcements') return 1;
    return a.type.localeCompare(b.type);
  });

const mapChannel = (channel) => ({
  _id: channel._id,
  teamId: channel.teamId?.toString?.() || channel.teamId,
  name: channel.name,
  type: channel.type,
  isArchived: channel.isArchived
});

const mapMessage = (message) => ({
  _id: message._id,
  teamId: message.teamId?.toString?.() || message.teamId,
  channelId: message.channelId?.toString?.() || message.channelId,
  senderId:
    message.senderId?._id?.toString?.() ||
    message.senderId?.toString?.() ||
    message.senderId,
  sender: message.senderId?._id
    ? {
        _id: message.senderId._id,
        name: message.senderId.name,
        email: message.senderId.email,
        role: message.senderId.role
      }
    : undefined,
  text: message.text,
  createdAt: message.createdAt
});

const resolveRetentionCutoff = async () => {
  const settings = await getSettings();
  const days = Number(settings.chatRetentionDays || 0);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() - days * DAY_MS);
};

export const listAdminChatTeams = async (req, res) => {
  const includeArchived = req.query?.includeArchived === 'true';
  const teamQuery = includeArchived ? {} : { isArchived: false };
  const teams = await Team.find(teamQuery).sort({ name: 1 }).lean();
  if (teams.length === 0) return res.json([]);

  const teamIds = teams.map((team) => team._id);
  const channelQuery = {
    teamId: { $in: teamIds },
    ...(includeArchived ? {} : { isArchived: false })
  };
  const channels = await Channel.find(channelQuery).lean();
  const channelsByTeam = new Map();
  channels.forEach((channel) => {
    const key = channel.teamId.toString();
    const bucket = channelsByTeam.get(key) || [];
    bucket.push(mapChannel(channel));
    channelsByTeam.set(key, bucket);
  });

  res.json(
    teams.map((team) => ({
      _id: team._id,
      name: team.name,
      isArchived: team.isArchived,
      channels: sortChannels(channelsByTeam.get(team._id.toString()) || [])
    }))
  );
};

export const listAdminChatMessages = async (req, res) => {
  const { teamId, channelId, dateRange } = req.query || {};
  if (!teamId || !channelId) {
    return res.status(400).json({ message: 'teamId and channelId are required' });
  }
  if (respondIfInvalidObjectId(res, teamId, 'team id')) return;
  if (respondIfInvalidObjectId(res, channelId, 'channel id')) return;

  const team = await Team.findById(teamId).select('name isArchived');
  if (!team) return res.status(404).json({ message: 'Team not found' });

  const channel = await Channel.findOne({ _id: channelId, teamId }).select('name type isArchived');
  if (!channel) return res.status(404).json({ message: 'Channel not found' });

  const parsedRange = parseDateRange(dateRange);
  if (parsedRange.invalid) {
    return res.status(400).json({ message: 'Invalid dateRange format' });
  }

  const retentionCutoff = await resolveRetentionCutoff();
  const query = { teamId, channelId };
  const createdAt = {};
  const rangeStart = parsedRange.start || null;
  const rangeEnd = parsedRange.end || null;
  if (retentionCutoff && rangeStart) {
    createdAt.$gte = retentionCutoff > rangeStart ? retentionCutoff : rangeStart;
  } else if (retentionCutoff || rangeStart) {
    createdAt.$gte = retentionCutoff || rangeStart;
  }
  if (rangeEnd) createdAt.$lte = rangeEnd;
  if (Object.keys(createdAt).length > 0) query.createdAt = createdAt;

  const messages = await TeamMessage.find(query)
    .populate('senderId', 'name email role')
    .sort({ createdAt: 1 });

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'ADMIN_VIEW_TEAM_CHAT',
    entityType: 'team_chat',
    entityId: channel._id,
    description: `Admin viewed team chat ${team.name} #${channel.name}`,
    metadata: {
      teamId,
      channelId,
      dateRange: parsedRange.start && parsedRange.end ? dateRange : undefined
    },
    ipAddress: req.ip
  });

  res.json(messages.map((message) => mapMessage(message)));
};

export const postAdminAnnouncement = async (req, res) => {
  const { teamId, channelId, text } = req.body || {};
  if (!teamId || !channelId) {
    return res.status(400).json({ message: 'teamId and channelId are required' });
  }
  if (respondIfInvalidObjectId(res, teamId, 'team id')) return;
  if (respondIfInvalidObjectId(res, channelId, 'channel id')) return;

  const team = await Team.findById(teamId).select('isArchived');
  if (!team) return res.status(404).json({ message: 'Team not found' });
  if (team.isArchived) {
    return res.status(400).json({ message: 'Cannot post to archived teams' });
  }

  const channel = await Channel.findOne({ _id: channelId, teamId }).select('type isArchived');
  if (!channel) return res.status(404).json({ message: 'Channel not found' });
  if (channel.isArchived) {
    return res.status(400).json({ message: 'Cannot post to archived channels' });
  }
  if (channel.type !== 'announcements') {
    return res.status(403).json({ message: 'Announcements only' });
  }

  const body = String(text || '').trim();
  if (!body) return res.status(400).json({ message: 'Message text is required' });

  const message = await TeamMessage.create({
    teamId,
    channelId,
    senderId: req.user._id,
    text: body
  });
  await message.populate('senderId', 'name email role');
  res.status(201).json(mapMessage(message));
};
