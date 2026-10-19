/**
 * Centralized API Client for GodHand Studio
 * Handles content-type validation, safe JSON parsing, and dynamic backend URL resolution
 * (supporting localhost:3000 development server and remote web deployments).
 */

const LOCAL_BACKEND_PORT = 3000;
const LOCAL_BACKEND_ORIGIN = `http://localhost:${LOCAL_BACKEND_PORT}`;

// Cache backend availability status
let isLocalBackendAvailable: boolean | null = null;
let lastProbeTime = 0;

export function getApiBaseUrl(): string {
  // If we are already running on localhost on port 3000, use relative paths
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && window.location.port === String(LOCAL_BACKEND_PORT)) {
      return '';
    }
    // If running on a remote host (e.g. Firebase Hosting or different port), check if local backend is preferred
    const customBackend = localStorage.getItem('godhand_backend_url');
    if (customBackend) {
      return customBackend.replace(/\/$/, '');
    }
    // Default to local backend if reachable
    if (isLocalBackendAvailable) {
      return LOCAL_BACKEND_ORIGIN;
    }
  }
  return '';
}

/**
 * Probe local backend at http://localhost:3000 to see if it is online and responsive
 */
export async function probeBackendStatus(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  // Throttle probes to at most once every 5 seconds
  const now = Date.now();
  if (isLocalBackendAvailable !== null && now - lastProbeTime < 5000) {
    return isLocalBackendAvailable;
  }
  
  lastProbeTime = now;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const targetUrl = `${LOCAL_BACKEND_ORIGIN}/api/status`;
    const res = await fetch(targetUrl, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timeoutId);
    
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      isLocalBackendAvailable = true;
      return true;
    }
    isLocalBackendAvailable = false;
    return false;
  } catch (_) {
    isLocalBackendAvailable = false;
    return false;
  }
}

/**
 * Resilient API fetch wrapper that guarantees safe JSON handling and descriptive errors
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = base ? `${base}${normalizedPath}` : normalizedPath;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    // If an endpoint returned HTML (e.g. Firebase SPA fallback or 404), do not crash on JSON.parse
    const textPreview = await res.text().catch(() => '');
    const isHtml = textPreview.trim().startsWith('<');
    if (isHtml) {
      throw new Error(`Endpoint "${normalizedPath}" returned HTML instead of JSON. The backend server might be offline or unreachable on this domain.`);
    }
    throw new Error(`Unexpected non-JSON response from "${normalizedPath}" (status: ${res.status})`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}
