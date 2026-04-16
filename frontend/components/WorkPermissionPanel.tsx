'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Briefcase,
  Calendar,
  User,
  MessageSquare
} from 'lucide-react';
import { workPermissionService } from '@/services/workPermissionService';

interface WorkPermissionRequest {
  _id: string;
  task: {
    _id: string;
    title: string;
    description: string;
  };
  requestedBy: {
    name: string;
    email: string;
  };
  workType: string;
  estimatedHours: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  requestMessage?: string;
  createdAt: string;
  expiresAt: string;
}

export const WorkPermissionPanel: React.FC = () => {
  const [permissions, setPermissions] = useState<WorkPermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadPermissions();
    const interval = setInterval(loadPermissions, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await workPermissionService.getPendingPermissions();
      setPermissions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (permissionId: string) => {
    try {
      const notes_text = notes || '';
      await workPermissionService.acceptPermission(permissionId, notes_text);
      setPermissions(permissions.filter((p) => p._id !== permissionId));
      setRespondingTo(null);
      setNotes('');
    } catch (err: any) {
      alert(`Error accepting permission: ${err.message}`);
    }
  };

  const handleReject = async (permissionId: string) => {
    try {
      const reason = notes || 'Not available at this time';
      await workPermissionService.rejectPermission(permissionId, reason);
      setPermissions(permissions.filter((p) => p._id !== permissionId));
      setRespondingTo(null);
      setNotes('');
    } catch (err: any) {
      alert(`Error rejecting permission: ${err.message}`);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-blue-500 bg-blue-50',
      medium: 'text-yellow-600 bg-yellow-50',
      high: 'text-orange-600 bg-orange-50',
      critical: 'text-red-600 bg-red-50'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getPriorityBadgeColor = (priority: string) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 text-blue-500"></div>
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-8 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Pending Permissions</h3>
        <p className="text-gray-600">You're all caught up! No work permissions awaiting your response.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Work Permissions</h2>
        <span className="bg-red-100 text-red-800 text-sm font-semibold px-3 py-1 rounded-full">
          {permissions.length} pending
        </span>
      </div>

      {error && (
        <div className="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {permissions.map((permission) => {
          const expired = isExpired(permission.expiresAt);
          const isResponding = respondingTo === permission._id;

          return (
            <div
              key={permission._id}
              className={`rounded-lg border-2 p-6 transition-all ${
                expired
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : `${getPriorityColor(permission.priority)} border-opacity-30 border-current`
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-800">{permission.task.title}</h3>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full uppercase ${getPriorityBadgeColor(
                        permission.priority
                      )}`}
                    >
                      {permission.priority}
                    </span>
                    {expired && <span className="text-xs text-red-600 font-bold">EXPIRED</span>}
                  </div>
                  <p className="text-sm text-gray-600">{permission.task.description}</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 py-4 border-t border-b border-current border-opacity-20">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div className="text-sm">
                    <p className="text-gray-600">Requested by</p>
                    <p className="font-semibold text-gray-800">{permission.requestedBy.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <div className="text-sm">
                    <p className="text-gray-600">Work Type</p>
                    <p className="font-semibold text-gray-800 capitalize">{permission.workType}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div className="text-sm">
                    <p className="text-gray-600">Est. Hours</p>
                    <p className="font-semibold text-gray-800">{permission.estimatedHours}h</p>
                  </div>
                </div>

                {permission.dueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div className="text-sm">
                      <p className="text-gray-600">Due Date</p>
                      <p className="font-semibold text-gray-800">
                        {new Date(permission.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Message */}
              {permission.requestMessage && (
                <div className="mb-4 p-3 bg-white bg-opacity-50 rounded border border-current border-opacity-20 flex gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">{permission.requestMessage}</p>
                </div>
              )}

              {/* Expiry Warning */}
              {!expired && (
                <p className="text-xs text-gray-600 mb-4">
                  ⏰ Expires in {Math.max(0, Math.ceil((new Date(permission.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))} hours
                </p>
              )}

              {/* Response Section */}
              {!expired ? (
                isResponding ? (
                  <div className="mt-4 p-4 bg-white bg-opacity-70 rounded-lg space-y-3">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={
                        respondingTo === permission._id
                          ? 'Add optional notes...'
                          : ''
                      }
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(permission._id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-semibold transition"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(permission._id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-semibold transition"
                      >
                        <XCircle className="h-4 w-4" />
                        Decline
                      </button>
                      <button
                        onClick={() => {
                          setRespondingTo(null);
                          setNotes('');
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setRespondingTo(permission._id);
                        setNotes('');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-semibold transition"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => {
                        setRespondingTo(permission._id);
                        setNotes('');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-semibold transition"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                )
              ) : (
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-red-700 font-semibold">This permission request has expired</p>
                  <p className="text-red-600 text-sm">Expired {Math.abs(Math.floor((new Date(permission.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))} hours ago</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkPermissionPanel;
