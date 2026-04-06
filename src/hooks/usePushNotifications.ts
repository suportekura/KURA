import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

// Cache the VAPID key in memory so we only fetch once per session
let cachedVapidKey: string | null = null;

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Check current state
  useEffect(() => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PushPermissionState);

    // Check if already subscribed
    if (user && Notification.permission === 'granted') {
      checkExistingSubscription();
    }
  }, [user]);

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error('[usePush] Check subscription error:', e);
    }
  };

  const fetchVapidKey = async (): Promise<string | null> => {
    if (cachedVapidKey) return cachedVapidKey;

    try {
      const { data, error } = await supabase.functions.invoke('get-vapid-key');
      if (error) {
        console.error('[usePush] Failed to fetch VAPID key:', error);
        return null;
      }
      if (data?.vapidPublicKey) {
        cachedVapidKey = data.vapidPublicKey;
        return cachedVapidKey;
      }
      console.error('[usePush] No VAPID key in response');
      return null;
    } catch (e) {
      console.error('[usePush] Error fetching VAPID key:', e);
      return null;
    }
  };

  const subscribe = useCallback(async () => {
    if (!user || permission === 'unsupported') return false;

    setIsLoading(true);
    try {
      // Register push service worker
      const registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/',
      });

      // Wait for it to be ready
      await navigator.serviceWorker.ready;

      // Clear any existing subscription (may be stale / tied to old VAPID key)
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);

      if (result !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // Get VAPID public key from edge function
      const vapidKey = await fetchVapidKey();
      if (!vapidKey) {
        console.error('[usePush] VAPID public key not available');
        setIsLoading(false);
        return false;
      }

      // Convert VAPID key to Uint8Array (must be Uint8Array, not .buffer)
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      console.log('[usePush] VAPID key length (should be 65):', applicationServerKey.length);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Extract keys
      const p256dh = arrayBufferToBase64url(subscription.getKey('p256dh')!);
      const auth = arrayBufferToBase64url(subscription.getKey('auth')!);

      // Save to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (error) {
        console.error('[usePush] Save subscription error:', error);
        setIsLoading(false);
        return false;
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('[usePush] Subscribe error:', error);
      setIsLoading(false);
      return false;
    }
  }, [user, permission]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);

        // Unsubscribe from push
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch (error) {
      console.error('[usePush] Unsubscribe error:', error);
    }
    setIsLoading(false);
  }, [user]);

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isSupported: permission !== 'unsupported',
  };
}

// Helpers
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
