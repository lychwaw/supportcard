const MAPKIT_SCRIPT_ID = 'apple-mapkit-js';
const MAPKIT_SCRIPT_URL = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';

let mapkitInitPromise: Promise<typeof mapkit> | null = null;
let cachedMapKitToken: string | null = null;
let tokenExpiresAt: number = 0; // epoch ms

const loadMapKitScript = (): Promise<typeof mapkit> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('MapKit JS is only available in the browser'));
  }

  if (window.mapkit) {
    return Promise.resolve(window.mapkit);
  }

  const existing = document.getElementById(MAPKIT_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.mapkit as typeof mapkit), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load MapKit JS')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = MAPKIT_SCRIPT_ID;
    script.async = true;
    script.src = MAPKIT_SCRIPT_URL;
    script.addEventListener('load', () => resolve(window.mapkit as typeof mapkit), { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load MapKit JS')), { once: true });
    document.head.appendChild(script);
  });
};

const getMapKitToken = async (): Promise<string> => {
  const inlineToken = import.meta.env.VITE_MAPKIT_TOKEN as string | undefined;
  if (inlineToken) {
    cachedMapKitToken = inlineToken;
    return inlineToken;
  }

  // Refresh 2 minutes before expiry (token lifetime is 30 min).
  if (cachedMapKitToken && Date.now() < tokenExpiresAt - 120_000) {
    return cachedMapKitToken;
  }

  const tokenEndpoint =
    (import.meta.env.VITE_MAPKIT_TOKEN_ENDPOINT as string | undefined) || '/api/mapkit-token';

  // Include the Supabase session token so the server-side auth gate passes.
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(tokenEndpoint, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error('Failed to fetch MapKit token');
  }

  const token = await response.text();
  cachedMapKitToken = token;
  tokenExpiresAt = Date.now() + 30 * 60 * 1000; // 30-minute lifetime
  return token;
};

export const initMapKit = async (): Promise<typeof mapkit> => {
  if (!mapkitInitPromise) {
    mapkitInitPromise = loadMapKitScript().then(async (mapkitInstance) => {
      await getMapKitToken();

      mapkitInstance.init({
        authorizationCallback: (done) => {
          if (cachedMapKitToken) {
            done(cachedMapKitToken);
            return;
          }

          getMapKitToken()
            .then((token) => done(token))
            .catch((error) => {
              console.error('MapKit token error:', error);
            });
        },
      });

      return mapkitInstance;
    });
  }

  return mapkitInitPromise;
};

export const getAppleMapsUrl = (lat: number, lng: number) => {
  return `https://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}`;
};

