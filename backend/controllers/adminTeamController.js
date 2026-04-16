import Channel from '../models/Channel.js';
import Team from '../models/Team.js';
import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';

const TEAM_MEMBER_ROLES = ['owner', 'manager', 'member'];
const CHANNEL_TYPES = ['general', 'announcements', 'project'];

const normalizeName = (value) => String(value || '').trim();
const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sortChannels = (channels = []) =>
  channels.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    if (a.type === 'announcements') return -1;
    if (b.type === 'announcements') return 1;
    return a.type.localeCompare(b.type);
  });

const mapMember = (member) => {
  const user =
    member.userId && typeof member.userId === 'object'
      ? {
          _id: member.userId._id,
          name: member.userId.name,
          email: member.userId.email,
          role: member.userId.role,
          isActive: member.userId.isActive,
          isDeactivated: member.userId.isDeactivated
        }
      : undefined;
  const teamId = member.teamId?.toString?.() || member.teamId;
  const userId = user?._id?.toString?.() || member.userId?.toString?.() || member.userId;
  return {
    _id: member._id,
    teamId,
    userId,
    role: member.role,
    user
  };
};

const mapChannel = (channel) => ({
  _id: channel._id,
  teamId: channel.teamId?.toString?.() || channel.teamId,
  name: channel.name,
  type: channel.type,
  isArchived: channel.isArchived,
  createdAt: channel.createdAt
});

const buildTeamPayload = async (team) => {
  await team.populate('createdBy', 'name email role');
  const [members, channels] = await Promise.all([
    TeamMember.find({ teamId: team._id })
      .populate('userId', 'name email role isActive isDeactivated')
      .sort({ createdAt: 1 }),
    Channel.find({ teamId: team._id })
  ]);

  return {
    ...team.toObject(),
    members: members.map((member) => mapMember(member)),
    channels: sortChannels(channels.map((channel) => mapChannel(channel)))
  };
};

export const listTeams = async (_req, res) => {
  const teams = await Team.find()
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 });

  if (teams.length === 0) return res.json([]);

  const teamIds = teams.map((team) => team._id);
  const [members, channels] = await Promise.all([
    TeamMember.find({ teamId: { $in: teamIds } })
      .populate('userId', 'name email role isActive isDeactivated')
      .lean(),
    Channel.find({ teamId: { $in: teamIds } }).lean()
  ]);

  const membersByTeam = new Map();
  members.forEach((member) => {
    const key = member.teamId.toString();
    const bucket = membersByTeam.get(key) || [];
    bucket.push(
      mapMember({
        ...member,
        userId: member.userId
      })
    );
    membersByTeam.set(key, bucket);
  });

  const channelsByTeam = new Map();
  channels.forEach((channel) => {
    const key = channel.teamId.toString();
    const bucket = channelsByTeam.get(key) || [];
    bucket.push(mapChannel(channel));
    channelsByTeam.set(key, bucket);
  });

  res.json(
    teams.map((team) => ({
      ...team.toObject(),
      members: membersByTeam.get(team._id.toString()) || [],
      channels: sortChannels(channelsByTeam.get(team._id.toString()) || [])
    }))
  );
};

export const createTeam = async (req, res) => {
  const name = normalizeName(req.body?.name);
  if (!name) {
    return res.status(400).json({ message: 'Team name is required' });
  }

  const team = await Team.create({
    name,
    createdBy: req.user._id,
    isArchived: false
  });

  await TeamMember.create({
    teamId: team._id,
    userId: req.user._id,
    role: 'owner'
  });

  try {
    await Channel.insertMany(
      [
        { teamId: team._id, name: 'general', type: 'general', isArchived: false },
        { teamId: team._id, name: 'announcements', type: 'announcements', isArchived: false }
      ],
      { ordered: false }
    );
  } catch (error) {
    console.warn('Failed to create default channels', error?.message || error);
  }

  const payload = await buildTeamPayload(team);
  res.status(201).json({ team: payload });
};

export const updateTeam = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'team id')) return;
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: 'Team not found' });

  const name = normalizeName(req.body?.name);
  if (req.body?.name !== undefined && !name) {
    return res.status(400).json({ message: 'Team name is required' });
  }
  if (name) team.name = name;
  if (typeof req.body?.isArchived === 'boolean') {
    team.isArchived = req.body.isArchived;
  }

  await team.save();
  const payload = await buildTeamPayload(team);
  res.json({ team: payload });
};

export const upsertTeamMember = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'team id')) return;
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: 'Team not found' });

  const { userId, role, action } = req.body || {};
  if (!userId || respondIfInvalidObjectId(res, userId, 'user id')) return;

  const normalizedAction = String(action || '').toLowerCase();
  const removeRequested = normalizedAction === 'remove' || req.body?.remove === true;

  const member = await TeamMember.findOne({ teamId: team._id, userId });
  if (removeRequested) {
    if (!member) return res.status(404).json({ message: 'Member not found' });
    await member.deleteOne();
    return res.json({ success: true });
  }

  const normalizedRole = normalizeRole(role || 'member');
  if (!TEAM_MEMBER_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ message: 'Invalid member role' });
  }

  const user = await User.findById(userId).select('isActive isDeactivated');
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.isDeactivated || user.isActive === false) {
    return res.status(400).json({ message: 'User is deactivated' });
  }

  if (member) {
    member.role = normalizedRole;
    await member.save();
    await member.populate('userId', 'name email role isActive isDeactivated');
    return res.json({ member: mapMember(member) });
  }

  const created = await TeamMember.create({
    teamId: team._id,
    userId,
    role: normalizedRole
  });
  await created.populate('userId', 'name email role isActive isDeactivated');
  return res.status(201).json({ member: mapMember(created) });
};

export const createTeamChannel = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'team id')) return;
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: 'Team not found' });
  if (team.isArchived) {
    return res.status(400).json({ message: 'Cannot add channels to archived teams' });
  }

  const name = normalizeName(req.body?.name);
  if (!name) {
    return res.status(400).json({ message: 'Channel name is required' });
  }

  const type = normalizeRole(req.body?.type || 'general');
  if (!CHANNEL_TYPES.includes(type)) {
    return res.status(400).json({ message: 'Invalid channel type' });
  }
  if (req.user.role !== 'admin') {
    if (type !== 'project') {
      return res.status(403).json({ message: 'Only admins can create core channels' });
    }
    const membership = await TeamMember.findOne({
      teamId: team._id,
      userId: req.user._id,
      role: { $in: ['owner', 'manager'] }
    }).select('_id');
    if (!membership) {
      return res.status(403).json({ message: 'Manager access required' });
    }
  }

  const existing = await Channel.findOne({
    teamId: team._id,
    name: new RegExp(`^${escapeRegex(name)}$`, 'i')
  }).select('_id');
  if (existing) {
    return res.status(400).json({ message: 'Channel already exists' });
  }

  const channel = await Channel.create({
    teamId: team._id,
    name,
    type,
    isArchived: false
  });

  res.status(201).json({ channel: mapChannel(channel) });
};

export const updateChannel = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'channel id')) return;
  const channel = await Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ message: 'Channel not found' });

  const name = normalizeName(req.body?.name);
  if (req.body?.name !== undefined && !name) {
    return res.status(400).json({ message: 'Channel name is required' });
  }
  if (name) {
    const existing = await Channel.findOne({
      teamId: channel.teamId,
      _id: { $ne: channel._id },
      name: new RegExp(`^${escapeRegex(name)}$`, 'i')
    }).select('_id');
    if (existing) {
      return res.status(400).json({ message: 'Channel already exists' });
    }
    channel.name = name;
  }

  if (typeof req.body?.isArchived === 'boolean') {
    channel.isArchived = req.body.isArchived;
  }

  await channel.save();
  res.json({ channel: mapChannel(channel) });
};
