// Platform detection utility
export const getPlatformInfo = () => {
  if (typeof window === 'undefined') {
    return {
      platform: 'unknown',
      userAgent: '',
      isWindows: false,
      isMac: false,
      isLinux: false,
      isAndroid: false,
      isIOS: false,
      isMobile: false
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';

  return {
    platform,
    userAgent,
    isWindows: userAgent.includes('win') || platform.includes('win'),
    isMac: userAgent.includes('mac') || platform.includes('mac'),
    isLinux: userAgent.includes('linux') || platform.includes('linux'),
    isAndroid: userAgent.includes('android'),
    isIOS: userAgent.includes('iphone') || userAgent.includes('ipad'),
    isMobile: /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent),
    isTablet: /ipad|android(?!.*mobi)|tablet/i.test(userAgent)
  };
};

export const getBrowserInfo = () => {
  if (typeof window === 'undefined') {
    return { name: 'unknown', version: '' };
  }

  const ua = navigator.userAgent;
  let browserName = 'Unknown';
  let version = '';

  if (ua.includes('Edge')) {
    browserName = 'Edge';
    version = ua.split('Edge/')[1]?.split(' ')[0] || '';
  } else if (ua.includes('Chrome')) {
    browserName = 'Chrome';
    version = ua.split('Chrome/')[1]?.split(' ')[0] || '';
  } else if (ua.includes('Safari')) {
    browserName = 'Safari';
    version = ua.split('Version/')[1]?.split(' ')[0] || '';
  } else if (ua.includes('Firefox')) {
    browserName = 'Firefox';
    version = ua.split('Firefox/')[1]?.split(' ')[0] || '';
  }

  return { name: browserName, version };
};

export const canUseWebRTC = () => {
  if (typeof window === 'undefined') return false;

  return (
    !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection
    ) || !!(window.webkitRTCPeerConnection || window.mozRTCPeerConnection)
  );
};

export const canUseWebSockets = () => {
  if (typeof window === 'undefined') return false;
  return 'WebSocket' in window;
};

export const getDeviceCapabilities = () => {
  if (typeof window === 'undefined') {
    return {
      supportsAudio: false,
      supportsVideo: false,
      supportsWebRTC: false,
      supportsWebSockets: false
    };
  }

  return {
    supportsAudio: !!navigator.mediaDevices?.getUserMedia,
    supportsVideo: !!navigator.mediaDevices?.getUserMedia,
    supportsWebRTC: canUseWebRTC(),
    supportsWebSockets: canUseWebSockets(),
    screenSharingSupported: !!(
      navigator.mediaDevices?.getDisplayMedia ||
      (window as any).getDisplayMedia
    )
  };
};
