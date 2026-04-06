import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const LOCAL_STORAGE_KEY = 'kura_guest_location';

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  city: string | null;
  state: string | null;
  locationUpdatedAt: string;
}

interface GeolocationContextType {
  location: UserLocation | null;
  loading: boolean;
  error: string | null;
  permissionStatus: PermissionState | 'unknown';
  hasLocation: boolean;
  requestLocation: () => Promise<boolean>;
  updateLocation: () => Promise<boolean>;
  clearLocation: () => void;
  showLocationPrompt: boolean;
  setShowLocationPrompt: (show: boolean) => void;
  showLocationBlockedDialog: boolean;
  setShowLocationBlockedDialog: (show: boolean) => void;
  setLocationFromCep: (locationData: UserLocation) => Promise<boolean>;
}

const GeolocationContext = createContext<GeolocationContextType | undefined>(undefined);

// Round coordinates to 4 decimal places for privacy (~11m accuracy)
function roundCoordinate(coord: number, decimals: number = 4): number {
  return Math.round(coord * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Reverse geocoding to get city/state from coordinates
async function reverseGeocode(lat: number, lng: number): Promise<{ city: string | null; state: string | null }> {
  try {
    // Using a free reverse geocoding service (OpenStreetMap Nominatim)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=pt-BR`,
      { headers: { 'User-Agent': 'Kura App' } }
    );
    
    if (!response.ok) return { city: null, state: null };
    
    const data = await response.json();
    const address = data.address || {};
    
    return {
      city: address.city || address.town || address.municipality || address.county || null,
      state: address.state || null,
    };
  } catch {
    console.error('[useGeolocation] Reverse geocoding failed');
    return { city: null, state: null };
  }
}

// Get location from localStorage for guests
function getGuestLocation(): UserLocation | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('[useGeolocation] Error reading guest location:', err);
  }
  return null;
}

// Save location to localStorage for guests
function saveGuestLocation(location: UserLocation): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(location));
  } catch (err) {
    console.error('[useGeolocation] Error saving guest location:', err);
  }
}

// Clear guest location from localStorage
function clearGuestLocation(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.error('[useGeolocation] Error clearing guest location:', err);
  }
}

export function GeolocationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, profileStatus } = useAuth();
  
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | 'unknown'>('unknown');
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showLocationBlockedDialog, setShowLocationBlockedDialog] = useState(false);
  
  const fetchingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // Check permission status
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state);
        result.onchange = () => setPermissionStatus(result.state);
      }).catch(() => {
        setPermissionStatus('unknown');
      });
    }
  }, []);

  // Fetch location from database
  const fetchStoredLocation = useCallback(async (userId: string): Promise<UserLocation | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_locations')
        .select('latitude, longitude, accuracy, city, state, location_updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('[useGeolocation] Fetch error:', fetchError);
        return null;
      }

      if (data) {
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy: data.accuracy ? Number(data.accuracy) : null,
          city: data.city,
          state: data.state,
          locationUpdatedAt: data.location_updated_at,
        };
      }
      
      return null;
    } catch (err) {
      console.error('[useGeolocation] Fetch stored location failed:', err);
      return null;
    }
  }, []);

  // Save location to database (for authenticated users)
  const saveLocationToDb = useCallback(async (
    userId: string, 
    locationData: UserLocation
  ): Promise<boolean> => {
    try {
      const { error: upsertError } = await supabase
        .from('user_locations')
        .upsert({
          user_id: userId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          city: locationData.city,
          state: locationData.state,
          location_updated_at: locationData.locationUpdatedAt,
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        console.error('[useGeolocation] Save error:', upsertError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[useGeolocation] Save location failed:', err);
      return false;
    }
  }, []);

  // Request location from browser
  const requestBrowserLocation = useCallback((): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada pelo navegador'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (err) => {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              reject(new Error('Permissão de localização negada'));
              break;
            case err.POSITION_UNAVAILABLE:
              reject(new Error('Localização indisponível'));
              break;
            case err.TIMEOUT:
              reject(new Error('Tempo limite para obter localização'));
              break;
            default:
              reject(new Error('Erro ao obter localização'));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Cache for 1 minute
        }
      );
    });
  }, []);

  // Main request location function - works for both logged and non-logged users
  const requestLocation = useCallback(async (): Promise<boolean> => {
    if (fetchingRef.current) return false;
    fetchingRef.current = true;
    
    setLoading(true);
    setError(null);

    try {
      const coords = await requestBrowserLocation();
      
      const latitude = roundCoordinate(coords.latitude);
      const longitude = roundCoordinate(coords.longitude);
      const accuracy = coords.accuracy ? roundCoordinate(coords.accuracy, 2) : null;
      
      // Get city/state from coordinates
      const { city, state } = await reverseGeocode(latitude, longitude);
      
      const now = new Date().toISOString();
      
      const locationData: UserLocation = {
        latitude,
        longitude,
        accuracy,
        city,
        state,
        locationUpdatedAt: now,
      };
      
      // If user is authenticated, save to database
      if (user) {
        await saveLocationToDb(user.id, locationData);
        // Also clear any guest location
        clearGuestLocation();
      } else {
        // Save to localStorage for guests
        saveGuestLocation(locationData);
      }
      
      setLocation(locationData);
      setShowLocationPrompt(false);
      setShowLocationBlockedDialog(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao obter localização';
      setError(message);
      
      // If permission denied, show blocked dialog
      if (message.includes('negada')) {
        setShowLocationBlockedDialog(true);
      }
      
      return false;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, requestBrowserLocation, saveLocationToDb]);

  // Set location from CEP - works for both logged and non-logged users
  const setLocationFromCep = useCallback(async (locationData: UserLocation): Promise<boolean> => {
    try {
      // If user is authenticated, save to database
      if (user) {
        const saved = await saveLocationToDb(user.id, locationData);
        if (!saved) {
          return false;
        }
        // Clear any guest location
        clearGuestLocation();
      } else {
        // Save to localStorage for guests
        saveGuestLocation(locationData);
      }
      
      setLocation(locationData);
      setShowLocationPrompt(false);
      setShowLocationBlockedDialog(false);
      return true;
    } catch (err) {
      console.error('[useGeolocation] setLocationFromCep failed:', err);
      return false;
    }
  }, [user, saveLocationToDb]);

  // Update location (refresh)
  const updateLocation = useCallback(async (): Promise<boolean> => {
    return requestLocation();
  }, [requestLocation]);

  // Clear location state (for logout)
  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
    initialLoadDoneRef.current = false;
  }, []);

  // Load stored location on auth change or for guests
  useEffect(() => {
    // Don't proceed if auth is still loading
    if (authLoading) return;
    
    // Prevent duplicate fetches
    if (initialLoadDoneRef.current) return;
    
    const loadLocation = async () => {
      setLoading(true);
      
      try {
        if (user) {
          // User is logged in
          // Only load from DB if email is verified and profile is completed
          if (profileStatus?.emailVerified && profileStatus?.profileCompleted) {
            initialLoadDoneRef.current = true;
            
            const storedLocation = await fetchStoredLocation(user.id);
            
            if (storedLocation) {
              setLocation(storedLocation);
              // Clear any guest location since we're now using DB
              clearGuestLocation();
            } else {
              // Check if there's a guest location to migrate
              const guestLocation = getGuestLocation();
              if (guestLocation) {
                // Migrate guest location to database
                const saved = await saveLocationToDb(user.id, guestLocation);
                if (saved) {
                  setLocation(guestLocation);
                  clearGuestLocation();
                }
              } else {
                // No stored location - show prompt after a short delay
                timer = setTimeout(() => {
                  setShowLocationPrompt(true);
                }, 500);
              }
            }
          }
        } else {
          // User is not logged in - check localStorage
          initialLoadDoneRef.current = true;
          const guestLocation = getGuestLocation();
          if (guestLocation) {
            setLocation(guestLocation);
          }
        }
      } catch (err) {
        console.error('[useGeolocation] Initial load failed:', err);
      } finally {
        setLoading(false);
      }
    };

    let timer: ReturnType<typeof setTimeout>;
    loadLocation();
    return () => clearTimeout(timer);
  }, [user, authLoading, profileStatus, fetchStoredLocation, saveLocationToDb]);

  // Handle logout - clear location and reset for guest mode
  useEffect(() => {
    if (!authLoading && !user && initialLoadDoneRef.current) {
      // User just logged out, check for guest location
      const guestLocation = getGuestLocation();
      if (guestLocation) {
        setLocation(guestLocation);
      } else {
        setLocation(null);
      }
    }
  }, [user, authLoading]);

  const hasLocation = location !== null;

  return (
    <GeolocationContext.Provider value={{
      location,
      loading,
      error,
      permissionStatus,
      hasLocation,
      requestLocation,
      updateLocation,
      clearLocation,
      showLocationPrompt,
      setShowLocationPrompt,
      showLocationBlockedDialog,
      setShowLocationBlockedDialog,
      setLocationFromCep,
    }}>
      {children}
    </GeolocationContext.Provider>
  );
}

export function useGeolocation() {
  const context = useContext(GeolocationContext);
  if (context === undefined) {
    throw new Error('useGeolocation must be used within a GeolocationProvider');
  }
  return context;
}