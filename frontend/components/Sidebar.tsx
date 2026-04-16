'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Globe,
  Bot,
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  Layers,
  LayoutDashboard,
  Hash,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Settings,
  Timer,
  Users,
  UserPlus
} from 'lucide-react';
import { teamService } from '@/services/teamService';
import { useAuthStore } from '@/store/useAuthStore';
import type { IChannel, ITeamMembership } from '@/types';

type Props = { role: 'admin' | 'employee' };
type NavLink = { href: Route; label: string; icon: LucideIcon };
type NavSection = { title: string; links: NavLink[] };

const employeeSections: NavSection[] = [
  {
    title: 'Core',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/workmode', label: 'Work Mode', icon: Activity }
    ]
  },
  {
    title: 'Collaboration',
    links: [
      { href: '/calls', label: 'Calls', icon: PhoneCall },
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/announcements', label: 'Announcements', icon: Megaphone }
    ]
  },
  {
    title: 'Workflows',
    links: [
      { href: '/tasks', label: 'Tasks', icon: ClipboardList },
      { href: '/logs', label: 'Logs', icon: Clock },
      { href: '/timesheet', label: 'Timesheet', icon: Timer },
      { href: '/leave', label: 'Leave', icon: Calendar },
      { href: '/documents', label: 'Documents', icon: FileText }
    ]
  },
  {
    title: 'Tools',
    links: [
      { href: '/browser', label: 'Work Browser', icon: Globe },
      { href: '/summary', label: 'AI Summary', icon: Bot }
    ]
  }
];

const adminSections: NavSection[] = [
  {
    title: 'Overview',
    links: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/status', label: 'Status', icon: Activity },
      { href: '/admin/control-center', label: 'Control Center', icon: Activity },
      { href: '/admin/usage', label: 'Usage & Presence', icon: Activity }
    ]
  },
  {
    title: 'People',
    links: [
      { href: '/admin/employees', label: 'Employees', icon: Users },
      { href: '/admin/teams', label: 'Teams', icon: Layers },
      { href: '/admin/leave', label: 'Leave', icon: Calendar },
      { href: '/admin/invites', label: 'Invites', icon: UserPlus }
    ]
  },
  {
    title: 'Operations',
    links: [
      { href: '/admin/tasks', label: 'Tasks', icon: ClipboardList },
      { href: '/admin/calls', label: 'Calls', icon: PhoneCall },
      { href: '/admin/documents', label: 'Documents', icon: FileText },
      { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      { href: '/admin/team-chats', label: 'Team Chats', icon: Hash }
    ]
  },
  {
    title: 'Insights',
    links: [
      { href: '/admin/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/admin/logs', label: 'Logs', icon: Clock },
      { href: '/admin/timesheets', label: 'Timesheets', icon: Timer },
      { href: '/admin/reports', label: 'Reports', icon: FileText }
    ]
  },
  {
    title: 'Controls',
    links: [{ href: '/admin/settings', label: 'Controls', icon: Settings }]
  }
];

export default function Sidebar({ role }: Props) {
  const pathname = usePathname();
  const sections = role === 'admin' ? adminSections : employeeSections;
  const { user, ready } = useAuthStore();
  const [teamMemberships, setTeamMemberships] = useState<ITeamMembership[]>([]);
  const [teamChannels, setTeamChannels] = useState<Record<string, IChannel[]>>({});
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  useEffect(() => {
    if (role !== 'employee' || !ready || !user) return;
    let isMounted = true;
    const loadTeams = async () => {
      try {
        const memberships = await teamService.myTeams();
        if (!isMounted) return;
        setTeamMemberships(memberships);
        if (memberships.length === 0) {
          setTeamChannels({});
          return;
        }
        const results = await Promise.allSettled(
          memberships.map((membership) => teamService.channels(membership.team._id))
        );
        if (!isMounted) return;
        const nextChannels: Record<string, IChannel[]> = {};
        memberships.forEach((membership, index) => {
          const result = results[index];
          nextChannels[membership.team._id] =
            result.status === 'fulfilled' ? result.value : [];
        });
        setTeamChannels(nextChannels);
      } catch {
        if (isMounted) {
          setTeamMemberships([]);
          setTeamChannels({});
        }
      } finally {
        if (isMounted) setTeamsLoaded(true);
      }
    };

    loadTeams();
    return () => {
      isMounted = false;
    };
  }, [role, ready, user]);

  return (
    <aside className="relative w-72 shrink-0 border-r border-slate-200 bg-white/90 px-4 py-6 shadow-xl backdrop-blur">
      <div className="absolute inset-x-8 top-16 h-32 rounded-2xl bg-gradient-to-br from-brand-600/10 via-indigo-500/10 to-slate-900/10 blur-3xl" />
      <div className="relative flex items-center justify-between rounded-2xl bg-slate-50/80 px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">WorkHub</p>
          <h2 className="text-lg font-bold text-slate-900">Command Center</h2>
          <p className="text-xs text-slate-500">Productivity in one glance</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
          Live
        </span>
      </div>

      <nav className="relative mt-6 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              {section.title}
            </p>
            <div className="space-y-2">
              {section.links.map((item) => {
                const active = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'group flex items-center justify-between rounded-xl border px-3 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-700',
                      active
                        ? 'border-brand-200 bg-brand-50 text-brand-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-base shadow-inner transition group-hover:scale-105 group-hover:bg-brand-100">
                        <Icon className="h-5 w-5" strokeWidth={2.5} />
                      </span>
                      {item.label}
                    </span>
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_0_6px_rgba(37,99,235,0.1)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {role === 'employee' && (
          <div className="space-y-2">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Teams
            </p>
            {teamsLoaded && teamMemberships.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                No teams assigned yet.
              </div>
            )}
            {teamMemberships.map((membership) => {
              const channels = teamChannels[membership.team._id];
              return (
                <div
                  key={membership.team._id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>{membership.team.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      {membership.role}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {!channels && (
                      <p className="text-xs text-slate-400">Loading channels...</p>
                    )}
                    {channels && channels.length === 0 && (
                      <p className="text-xs text-slate-400">No channels yet.</p>
                    )}
                    {channels?.map((channel) => (
                      <p key={channel._id} className="text-xs text-slate-500">
                        # {channel.name}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
