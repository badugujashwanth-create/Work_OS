'use client';

import React, { useState, useEffect } from 'react';
import {
  requestMicrophonePermission,
  requestCameraPermission,
  requestBackgroundExecutionPermission,
  requestAllPermissions,
  getCachedPermissionStatus,
  wasPermissionPreviouslyGranted,
  PermissionStatus,
} from '@/lib/permissionManager';
import { Mic, Video, Zap, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface PermissionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName?: string;
}

/**
 * Modal component that requests device and background permissions
 * Appears on first login to ensure employee consent for monitoring
 */
export const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({
  isOpen,
  onClose,
  employeeName = 'Employee',
}) => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    microphone: 'unknown',
    camera: 'unknown',
    backgroundExecution: 'unknown',
  });

  const [isRequesting, setIsRequesting] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkPermissions();
    }
  }, [isOpen]);

  const checkPermissions = async () => {
    const cached = getCachedPermissionStatus();
    if (cached) {
      setPermissionStatus(cached);
    }
  };

  const handleRequestMicrophone = async () => {
    setIsRequesting(true);
    try {
      await requestMicrophonePermission();
      setPermissionStatus(prev => ({ ...prev, microphone: 'granted' }));
    } catch (error) {
      console.error('Error requesting microphone:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestCamera = async () => {
    setIsRequesting(true);
    try {
      await requestCameraPermission();
      setPermissionStatus(prev => ({ ...prev, camera: 'granted' }));
    } catch (error) {
      console.error('Error requesting camera:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestBackground = async () => {
    setIsRequesting(true);
    try {
      await requestBackgroundExecutionPermission();
      setPermissionStatus(prev => ({ ...prev, backgroundExecution: 'granted' }));
    } catch (error) {
      console.error('Error requesting background execution:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestAll = async () => {
    setIsRequesting(true);
    try {
      await requestAllPermissions();
      checkPermissions();
    } catch (error) {
      console.error('Error requesting all permissions:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleClose = () => {
    // If no permissions granted, show warning before closing
    if (
      permissionStatus.microphone !== 'granted' &&
      permissionStatus.camera !== 'granted' &&
      permissionStatus.backgroundExecution !== 'granted'
    ) {
      setShowSkipWarning(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowSkipWarning(false);
    onClose();
  };

  if (!isOpen) return null;

  const getPermissionColor = (status: string) => {
    switch (status) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      case 'prompt':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'denied':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'prompt':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Permissions Required
          </h2>
          <p className="text-blue-100 mt-1 text-sm">
            WorkHub needs your permission to monitor work activity
          </p>
        </div>

        {/* Content */}
        {!showSkipWarning ? (
          <div className="p-6 space-y-4">
            <p className="text-gray-700 text-sm">
              <strong>Hi {employeeName}!</strong> To properly track your work and ensure transparency, we need permission to:
            </p>

            {/* Permissions List */}
            <div className="space-y-3">
              {/* Microphone */}
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Mic className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Microphone</h3>
                      <p className="text-xs text-gray-600">For video calls and meetings</p>
                    </div>
                  </div>
                  {getPermissionIcon(permissionStatus.microphone)}
                </div>
                {permissionStatus.microphone !== 'granted' && (
                  <button
                    onClick={handleRequestMicrophone}
                    disabled={isRequesting}
                    className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition"
                  >
                    {isRequesting ? 'Requesting...' : 'Allow Microphone'}
                  </button>
                )}
              </div>

              {/* Camera */}
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Camera</h3>
                      <p className="text-xs text-gray-600">For video calls and screen verification</p>
                    </div>
                  </div>
                  {getPermissionIcon(permissionStatus.camera)}
                </div>
                {permissionStatus.camera !== 'granted' && (
                  <button
                    onClick={handleRequestCamera}
                    disabled={isRequesting}
                    className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition"
                  >
                    {isRequesting ? 'Requesting...' : 'Allow Camera'}
                  </button>
                )}
              </div>

              {/* Background Execution */}
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Background Execution</h3>
                      <p className="text-xs text-gray-600">To keep monitoring active in background</p>
                    </div>
                  </div>
                  {getPermissionIcon(permissionStatus.backgroundExecution)}
                </div>
                {permissionStatus.backgroundExecution !== 'granted' && (
                  <button
                    onClick={handleRequestBackground}
                    disabled={isRequesting}
                    className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition"
                  >
                    {isRequesting ? 'Enabling...' : 'Allow Background'}
                  </button>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <p>
                <strong>🔒 Your Privacy:</strong> These permissions are used only to verify your presence and
                activity. No recordings are stored permanently.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleRequestAll}
                disabled={isRequesting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
              >
                {isRequesting ? 'Requesting All...' : 'Allow All'}
              </button>
              <button
                onClick={handleClose}
                disabled={isRequesting}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-400 disabled:opacity-50 transition"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          /* Warning when skipping */
          <div className="p-6 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900">Warning</h3>
                <p className="text-sm text-yellow-800 mt-1">
                  Without these permissions, we cannot verify your work activity. This may affect:
                </p>
                <ul className="text-sm text-yellow-800 mt-2 ml-4 list-disc">
                  <li>Presence tracking</li>
                  <li>Work verification</li>
                  <li>Performance reports</li>
                  <li>Task recommendations</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSkipWarning(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Grant Permissions
              </button>
              <button
                onClick={handleConfirmClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-400 transition"
              >
                Continue Without
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionRequestModal;
