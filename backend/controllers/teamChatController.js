import Channel from '../models/Channel.js';
import Team from '../models/Team.js';
import TeamMember from '../models/TeamMember.js';
import TeamMessage from '../models/TeamMessage.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';
import { getSettings } from '../services/settingsService.js';

const MAX_MESSAGE_LENGTH = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

const resolveRetentionCutoff = async () => {
  const settings = await getSettings();
  const days = Number(settings.chatRetentionDays || 0);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() - days * DAY_MS);
};

const ensureMembership = async (req, res, teamId, channelId) => {
  if (respondIfInvalidObjectId(res, teamId, 'team id')) return null;
  if (respondIfInvalidObjectId(res, channelId, 'channel id')) return null;

  const team = await Team.findById(teamId).select('isArchived');
  if (!team || team.isArchived) {
    res.status(404).json({ message: 'Team not found' });
    return null;
  }

  const channel = await Channel.findOne({ _id: channelId, teamId }).select('type isArchived');
  if (!channel || channel.isArchived) {
    res.status(404).json({ message: 'Channel not found' });
    return null;
  }

  const membership = await TeamMember.findOne({
    teamId,
    userId: req.user._id
  }).select('role');
  if (!membership) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }

  return { team, channel, membership };
};

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

export const listChannelMessages = async (req, res) => {
  const { teamId, channelId } = req.query || {};
  if (!teamId || !channelId) {
    return res.status(400).json({ message: 'teamId and channelId are required' });
  }

  const context = await ensureMembership(req, res, teamId, channelId);
  if (!context) return;

  const limitValue = Number(req.query?.limit);
  const limit = Number.isFinite(limitValue) ? Math.min(limitValue, 200) : 0;
  const retentionCutoff = await resolveRetentionCutoff();
  const query = { teamId, channelId };
  if (retentionCutoff) query.createdAt = { $gte: retentionCutoff };

  let cursor = TeamMessage.find(query).populate('senderId', 'name email role');

  if (limit > 0) {
    const messages = await cursor.sort({ createdAt: -1 }).limit(limit);
    return res.json(messages.reverse().map((message) => mapMessage(message)));
  }

  const messages = await cursor.sort({ createdAt: 1 });
  res.json(messages.map((message) => mapMessage(message)));
};

export const postChannelMessage = async (req, res) => {
  const { teamId, channelId, text } = req.body || {};
  if (!teamId || !channelId) {
    return res.status(400).json({ message: 'teamId and channelId are required' });
  }

  const context = await ensureMembership(req, res, teamId, channelId);
  if (!context) return;

  const body = String(text || '').trim();
  if (!body) return res.status(400).json({ message: 'Message text is required' });
  if (body.length > MAX_MESSAGE_LENGTH) {
    return res
      .status(400)
      .json({ message: `Message must be under ${MAX_MESSAGE_LENGTH} characters` });
  }

  if (
    context.channel.type === 'announcements' &&
    !['admin', 'manager'].includes(req.user.role) &&
    !['owner', 'manager'].includes(context.membership.role)
  ) {
    return res.status(403).json({ message: 'Insufficient permissions for announcements' });
  }

  const message = await TeamMessage.create({
    teamId,
    channelId,
    senderId: req.user._id,
    text: body
  });
  await message.populate('senderId', 'name email role');
  res.status(201).json(mapMessage(message));
};

export const listUnreadSummary = async (req, res) => {
  const teamId = req.query?.teamId;
  if (teamId && respondIfInvalidObjectId(res, teamId, 'team id')) return;

  const memberships = await TeamMember.find({
    userId: req.user._id,
    ...(teamId ? { teamId } : {})
  }).select('teamId');
  if (memberships.length === 0) return res.json([]);

  const teamIds = memberships.map((membership) => membership.teamId);
  const channels = await Channel.find({
    teamId: { $in: teamIds },
    isArchived: false
  }).select('_id teamId');
  if (channels.length === 0) return res.json([]);

  const channelIds = channels.map((channel) => channel._id);
  const retentionCutoff = await resolveRetentionCutoff();
  const matchStage = {
    channelId: { $in: channelIds }
  };
  if (retentionCutoff) matchStage.createdAt = { $gte: retentionCutoff };
  const aggregates = await TeamMessage.aggregate([
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$channelId',
        lastMessageAt: { $first: '$createdAt' }
      }
    }
  ]);

  const lastMessageMap = new Map(
    aggregates.map((entry) => [entry._id.toString(), entry.lastMessageAt])
  );

  res.json(
    channels.map((channel) => ({
      channelId: channel._id,
      teamId: channel.teamId,
      lastMessageAt: lastMessageMap.get(channel._id.toString()) || null
    }))
  );
};
