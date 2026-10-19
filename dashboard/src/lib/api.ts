/**
 * Centralized API & Hybrid Cloud/Browser VFS Client for GodHand Studio
 * Seamlessly bridges localhost:3000, free Cloudflare tunnels (*.trycloudflare.com),
 * cloud deployments (*.koyeb.app, *.onrender.com), and In-Browser Virtual File System (VFS).
 */

import { BrowserVFS } from './vfs';

const LOCAL_BACKEND_PORT = 3000;
const LOCAL_BACKEND_ORIGIN = `http://localhost:${LOCAL_BACKEND_PORT}`;

// Cache backend status
let isLocalBackendAvailable: boolean | null = null;
let lastProbeTime = 0;
let isVFSStandalone = false;

export function getCustomBackendUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL query parameters (?backend=https://... or ?server=https://...)
  try {
    const params = new URLSearchParams(window.location.search);
    const backendParam = params.get('backend') || params.get('server');
    if (backendParam) {
      const clean = backendParam.replace(/\/$/, '');
      localStorage.setItem('GODHAND_BACKEND_URL', clean);
      return clean;
    }
  } catch (_) {}

  // 2. Check localStorage
  const stored = localStorage.getItem('GODHAND_BACKEND_URL') || localStorage.getItem('godhand_backend_url');
  if (stored) {
    return stored.replace(/\/$/, '');
  }

  return null;
}

export function setCustomBackendUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  if (!url) {
    localStorage.removeItem('GODHAND_BACKEND_URL');
    localStorage.removeItem('godhand_backend_url');
  } else {
    const clean = url.trim().replace(/\/$/, '');
    localStorage.setItem('GODHAND_BACKEND_URL', clean);
    localStorage.setItem('godhand_backend_url', clean);
  }
  isLocalBackendAvailable = null;
}

export function isVFSMode(): boolean {
  return isVFSStandalone || isLocalBackendAvailable === false;
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const customBackend = getCustomBackendUrl();
  if (customBackend) {
    return customBackend;
  }

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost && window.location.port === String(LOCAL_BACKEND_PORT)) {
    return '';
  }

  if (isLocalBackendAvailable) {
    return LOCAL_BACKEND_ORIGIN;
  }

  return '';
}

/**
 * Probe backend to check if local server or configured tunnel is online
 */
export async function probeBackendStatus(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  if (isLocalBackendAvailable !== null && now - lastProbeTime < 4000) {
    return isLocalBackendAvailable;
  }

  lastProbeTime = now;
  const targetBase = getApiBaseUrl() || (window.location.hostname === 'localhost' ? '' : LOCAL_BACKEND_ORIGIN);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const targetUrl = targetBase ? `${targetBase}/api/status` : '/api/status';

    const res = await (window as any).__originalFetch(targetUrl, {
      signal: controller.signal,
      mode: 'cors'
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      isLocalBackendAvailable = true;
      isVFSStandalone = false;
      return true;
    }
    isLocalBackendAvailable = false;
    isVFSStandalone = true;
    return false;
  } catch (_) {
    isLocalBackendAvailable = false;
    isVFSStandalone = true;
    return false;
  }
}

/**
 * Handle API requests via In-Browser VFS when backend is offline
 */
async function handleVfsFallback(normalizedPath: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const [pathname, search] = normalizedPath.split('?');
  const query = new URLSearchParams(search || '');

  // Parse JSON body if present
  let body: any = {};
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch (_) {}
  }

  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  // Status & Health
  if (pathname === '/api/status') {
    return jsonResponse({
      javaInstalled: true,
      buildStatus: 'idle',
      serverStatus: 'offline',
      builtJarName: null,
      vfsActive: true,
      optimizations: []
    });
  }

  if (pathname === '/api/client/status') {
    return jsonResponse({ status: 'stopped', vfsActive: true });
  }

  if (pathname === '/api/client/logs') {
    return jsonResponse({ logs: ['[VFS] In-Browser Standalone VFS active.'] });
  }

  if (pathname === '/api/logs') {
    return jsonResponse({ buildLogs: ['[VFS] In-Browser Standalone VFS active. Local Gradle server not connected.'] });
  }

  if (pathname === '/api/sdk/progress') {
    return jsonResponse({ isDownloading: false, percent: 100, status: 'idle' });
  }

  // File System API
  if (pathname === '/api/fs/tree') {
    const tree = await BrowserVFS.getTree('godhand');
    return jsonResponse({ tree });
  }

  if (pathname === '/api/fs/file') {
    if (method === 'GET') {
      const filePath = query.get('path') || '';
      try {
        const content = await BrowserVFS.getFile(filePath, 'godhand');
        return jsonResponse({ content });
      } catch (e: any) {
        return jsonResponse({ error: e.message || 'File not found' }, 404);
      }
    }
    if (method === 'POST') {
      const { path: filePath, content } = body;
      await BrowserVFS.saveFile(filePath, content || '', 'godhand');
      return jsonResponse({ success: true, message: 'File saved successfully' });
    }
    if (method === 'DELETE') {
      const filePath = query.get('path') || body.path || '';
      await BrowserVFS.deleteFile(filePath, 'godhand');
      return jsonResponse({ success: true, message: 'File deleted successfully' });
    }
  }

  if (pathname === '/api/fs/move' && method === 'POST') {
    const { sourcePath, destinationPath } = body;
    await BrowserVFS.moveFile(sourcePath, destinationPath, 'godhand');
    return jsonResponse({ success: true, message: 'Moved successfully' });
  }

  if (pathname === '/api/fs/folders') {
    const folders = await BrowserVFS.getFolders('godhand');
    return jsonResponse({ folders });
  }

  // System Core Mods API
  if (pathname === '/api/system-mods') {
    const mods = await BrowserVFS.listProjects();
    return jsonResponse({ mods });
  }

  if (pathname === '/api/system-mods/create' && method === 'POST') {
    await BrowserVFS.scaffoldMod(body);
    return jsonResponse({ success: true, message: 'Mod scaffolded in VFS' });
  }

  const systemModTreeMatch = pathname.match(/^\/api\/system-mods\/([^/]+)\/tree$/);
  if (systemModTreeMatch) {
    const modId = systemModTreeMatch[1];
    const tree = await BrowserVFS.getTree(modId);
    return jsonResponse({ tree });
  }

  const systemModFileMatch = pathname.match(/^\/api\/system-mods\/([^/]+)\/file$/);
  if (systemModFileMatch) {
    const modId = systemModFileMatch[1];
    if (method === 'GET') {
      const filePath = query.get('path') || '';
      try {
        const content = await BrowserVFS.getFile(filePath, modId);
        return jsonResponse({ content });
      } catch (e: any) {
        return jsonResponse({ error: e.message || 'File not found' }, 404);
      }
    }
    if (method === 'POST') {
      const { path: filePath, content } = body;
      await BrowserVFS.saveFile(filePath, content || '', modId);
      return jsonResponse({ success: true, message: 'File saved successfully' });
    }
    if (method === 'DELETE') {
      const filePath = query.get('path') || body.path || '';
      await BrowserVFS.deleteFile(filePath, modId);
      return jsonResponse({ success: true, message: 'File deleted successfully' });
    }
  }

  // Download endpoints in VFS mode: return simulated blob
  if (pathname === '/api/download-jar' || pathname.endsWith('/download')) {
    const blob = await BrowserVFS.exportJar('godhand');
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/java-archive',
        'Content-Disposition': 'attachment; filename="godhand-mod.jar"'
      }
    });
  }

  return jsonResponse({ error: 'Endpoint routed through VFS standalone fallback' }, 200);
}

/**
 * Resilient API fetch wrapper that guarantees safe JSON handling and VFS fallback
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = base ? `${base}${normalizedPath}` : normalizedPath;

  try {
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
      // Returned HTML (e.g. Firebase Hosting SPA rewrite or 404), fall back to In-Browser VFS
      const vfsRes = await handleVfsFallback(normalizedPath, options);
      return (await vfsRes.json()) as T;
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }

    return data as T;
  } catch (err: any) {
    // If network connection failed or server is offline, fallback to In-Browser VFS
    if (normalizedPath.startsWith('/api/')) {
      const vfsRes = await handleVfsFallback(normalizedPath, options);
      return (await vfsRes.json()) as T;
    }
    throw err;
  }
}

/**
 * Install transparent browser window.fetch wrapper for seamless VFS routing
 */
if (typeof window !== 'undefined' && !(window as any).__vfsFetchInstalled) {
  const origFetch = window.fetch.bind(window);
  (window as any).__originalFetch = origFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any).url || '';

    // Only intercept local /api/ routes
    if (urlString.startsWith('/api/') || urlString.includes('/api/')) {
      const apiPath = urlString.includes('/api/') ? '/api/' + urlString.split('/api/')[1] : urlString;
      const base = getApiBaseUrl();
      const targetUrl = base ? `${base}${apiPath}` : apiPath;

      try {
        const response = await origFetch(targetUrl, init);
        const ct = response.headers.get('content-type') || '';
        // If server responded with JSON, let it pass through
        if (response.ok && ct.includes('application/json')) {
          return response;
        }
        // If server responded with HTML (Firebase 404 SPA fallback), route to VFS
        if (ct.includes('text/html')) {
          return await handleVfsFallback(apiPath, init);
        }
        return response;
      } catch (_) {
        // Network error / localhost offline -> seamlessly handle via VFS
        return await handleVfsFallback(apiPath, init);
      }
    }

    return origFetch(input, init);
  };

  (window as any).__vfsFetchInstalled = true;
}
