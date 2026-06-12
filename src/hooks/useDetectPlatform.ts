import { useState } from 'react';

export type InstallPlatform = 'ios' | 'android' | 'desktop-chrome' | 'unsupported';

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  isSupportedBrowser: boolean;
  platform: InstallPlatform;
}

function detectPlatform(): PlatformInfo {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !('MSStream' in window);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  // Chrome/Edge expõem BeforeInstallPromptEvent; Safari/Firefox não
  const isSupportedBrowser = 'BeforeInstallPromptEvent' in window;

  let platform: InstallPlatform;
  if (isIOS) {
    platform = 'ios';
  } else if (isAndroid) {
    platform = isSupportedBrowser ? 'android' : 'unsupported';
  } else if (isSupportedBrowser) {
    platform = 'desktop-chrome';
  } else {
    platform = 'unsupported';
  }

  return { isIOS, isAndroid, isStandalone, isSupportedBrowser, platform };
}

export function useDetectPlatform(): PlatformInfo {
  const [info] = useState(detectPlatform);
  return info;
}
