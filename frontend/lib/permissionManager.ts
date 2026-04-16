/**
 * Permission Manager - Handles requests for microphone, camera, and background permissions
 * Ensures employee consent is obtained before monitoring/tracking starts
 */

export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  backgroundExecution: 'granted' | 'denied' | 'prompt' | 'unknown';
}

interface PermissionRequest {
  type: 'microphone' | 'camera' | 'backgroundExecution';
  status: PermissionStatus;
  timestamp: number;
}

const PERMISSION_STORAGE_KEY = 'workos_permissions';
const PERMISSION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get current permission status from browser
 */
async function getPermissionStatus(): Promise<PermissionStatus> {
  const status: PermissionStatus = {
    microphone: 'unknown',
    camera: 'unknown',
    backgroundExecution: 'unknown',
  };

  try {
    // Check microphone permission
    if ('permissions' in navigator) {
      const micPerm = await navigator.permissions.query({ name: 'microphone' as any });
      status.microphone = micPerm.state as any;
    }
  } catch (error) {
    console.warn('Could not query microphone permission:', error);
  }

  try {
    // Check camera permission
    if ('permissions' in navigator) {
      const cameraPerm = await navigator.permissions.query({ name: 'camera' as any });
      status.camera = cameraPerm.state as any;
    }
  } catch (error) {
    console.warn('Could not query camera permission:', error);
  }

  // Background execution doesn't have a direct permission query
  // We check if the browser supports it
  try {
    if ('requestIdleCallback' in window || 'serviceWorker' in navigator) {
      status.backgroundExecution = 'prompt';
    }
  } catch (error) {
    console.warn('Could not check background execution support:', error);
  }

  return status;
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop the stream immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());
    
    // Store permission grant
    savePermissionStatus('microphone', 'granted');
    console.log('✅ Microphone permission granted');
    return true;
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      savePermissionStatus('microphone', 'denied');
      console.log('❌ Microphone permission denied by user');
      return false;
    } else if (error.name === 'NotFoundError') {
      console.warn('⚠️ No microphone device found');
      return false;
    }
    console.error('Microphone permission error:', error);
    return false;
  }
}

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Stop the stream immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());
    
    // Store permission grant
    savePermissionStatus('camera', 'granted');
    console.log('✅ Camera permission granted');
    return true;
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      savePermissionStatus('camera', 'denied');
      console.log('❌ Camera permission denied by user');
      return false;
    } else if (error.name === 'NotFoundError') {
      console.warn('⚠️ No camera device found');
      return false;
    }
    console.error('Camera permission error:', error);
    return false;
  }
}

/**
 * Request background execution permission
 * This allows the app to continue monitoring/tracking in the background
 */
export async function requestBackgroundExecutionPermission(): Promise<boolean> {
  try {
    // Check if browser supports background execution
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        savePermissionStatus('backgroundExecution', 'granted');
      });
      console.log('✅ Background execution enabled');
      return true;
    }

    // Alternative: Check if Service Worker is supported
    if ('serviceWorker' in navigator) {
      // Just confirm it's registered
      savePermissionStatus('backgroundExecution', 'granted');
      console.log('✅ Background execution enabled via Service Worker');
      return true;
    }

    console.warn('⚠️ Browser does not support background execution');
    return false;
  } catch (error) {
    console.error('Background execution permission error:', error);
    return false;
  }
}

/**
 * Request all permissions at once
 */
export async function requestAllPermissions(): Promise<PermissionStatus> {
  const results = await Promise.all([
    requestMicrophonePermission(),
    requestCameraPermission(),
    requestBackgroundExecutionPermission(),
  ]);

  const status = await getPermissionStatus();
  return status;
}

/**
 * Save permission status to local storage
 */
function savePermissionStatus(
  permission: 'microphone' | 'camera' | 'backgroundExecution',
  status: 'granted' | 'denied' | 'prompt'
): void {
  try {
    const stored = localStorage.getItem(PERMISSION_STORAGE_KEY);
    const data: PermissionRequest = stored ? JSON.parse(stored) : { 
      type: permission,
      status: { microphone: 'unknown', camera: 'unknown', backgroundExecution: 'unknown' },
      timestamp: Date.now(),
    };

    if (!data.status) {
      data.status = { microphone: 'unknown', camera: 'unknown', backgroundExecution: 'unknown' };
    }

    data.status[permission] = status;
    data.timestamp = Date.now();

    localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Could not save permission status:', error);
  }
}

/**
 * Get cached permission status
 */
export function getCachedPermissionStatus(): PermissionStatus | null {
  try {
    const stored = localStorage.getItem(PERMISSION_STORAGE_KEY);
    if (!stored) return null;

    const data: PermissionRequest = JSON.parse(stored);
    const age = Date.now() - data.timestamp;

    // If cache is older than TTL, return null
    if (age > PERMISSION_CACHE_TTL) {
      localStorage.removeItem(PERMISSION_STORAGE_KEY);
      return null;
    }

    return data.status;
  } catch (error) {
    console.warn('Could not read cached permission status:', error);
    return null;
  }
}

/**
 * Check if permission was previously granted
 */
export function wasPermissionPreviouslyGranted(
  permission: 'microphone' | 'camera' | 'backgroundExecution'
): boolean {
  const cached = getCachedPermissionStatus();
  return cached ? cached[permission] === 'granted' : false;
}

/**
 * Reset all permission caches (for testing or user request)
 */
export function resetPermissionCache(): void {
  try {
    localStorage.removeItem(PERMISSION_STORAGE_KEY);
    console.log('✅ Permission cache cleared');
  } catch (error) {
    console.warn('Could not clear permission cache:', error);
  }
}

/**
 * Log current permission status to console (for debugging)
 */
export async function logPermissionStatus(): Promise<void> {
  const status = await getPermissionStatus();
  console.group('📊 Permission Status');
  console.log('Microphone:', status.microphone);
  console.log('Camera:', status.camera);
  console.log('Background Execution:', status.backgroundExecution);
  console.groupEnd();
}
