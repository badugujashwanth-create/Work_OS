import Channel from '../models/Channel.js';
import Team from '../models/Team.js';
import TeamMember from '../models/TeamMember.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';

const mapChannel = (channel) => ({
  _id: channel._id,
  teamId: channel.teamId?.toString?.() || channel.teamId,
  name: channel.name,
  type: channel.type
});

export const listMyTeams = async (req, res) => {
  const memberships = await TeamMember.find({ userId: req.user._id })
    .populate('teamId', 'name isArchived')
    .sort({ createdAt: 1 });

  const teams = memberships
    .filter((membership) => membership.teamId && !membership.teamId.isArchived)
    .map((membership) => ({
      team: {
        _id: membership.teamId._id?.toString?.() || membership.teamId._id,
        name: membership.teamId.name,
        isArchived: membership.teamId.isArchived
      },
      role: membership.role
    }));

  res.json(teams);
};

export const listTeamChannels = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'team id')) return;
  const team = await Team.findById(req.params.id).select('isArchived');
  if (!team || team.isArchived) {
    return res.status(404).json({ message: 'Team not found' });
  }

  const membership = await TeamMember.findOne({
    teamId: team._id,
    userId: req.user._id
  }).select('_id');
  if (!membership) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const channels = await Channel.find({ teamId: team._id, isArchived: false });
  const sorted = channels.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    if (a.type === 'announcements') return -1;
    if (b.type === 'announcements') return 1;
    return a.type.localeCompare(b.type);
  });
  res.json(sorted.map((channel) => mapChannel(channel)));
};
