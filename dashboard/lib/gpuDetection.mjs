/**
 * Pure ESM GPU Detection helper for testing and runtime
 */

export function detectGpuSupport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      supported: false,
      renderer: 'Headless / No Display',
      vendor: 'None',
      isSoftware: true,
      webglVersion: null,
      error: 'Headless environment (window/document undefined)'
    };
  }

  try {
    const canvas = document.createElement('canvas');
    let gl = null;
    let version = null;

    try {
      gl = canvas.getContext('webgl2');
      if (gl) version = 'webgl2';
    } catch (_) {}

    if (!gl) {
      try {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) version = 'webgl';
      } catch (_) {}
    }

    if (!gl) {
      return {
        supported: false,
        renderer: 'None (CPU only)',
        vendor: 'None',
        isSoftware: true,
        webglVersion: null,
        error: 'WebGL not supported or disabled in browser'
      };
    }

    let renderer = 'WebGL GPU';
    let vendor = 'Generic Vendor';

    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        if (unmaskedRenderer) renderer = String(unmaskedRenderer);
        if (unmaskedVendor) vendor = String(unmaskedVendor);
      } else {
        const r = gl.getParameter(gl.RENDERER);
        const v = gl.getParameter(gl.VENDOR);
        if (r) renderer = String(r);
        if (v) vendor = String(v);
      }
    } catch (_) {}

    const lower = renderer.toLowerCase();
    const isSoftware = lower.includes('swiftshader') ||
      lower.includes('llvmpipe') ||
      lower.includes('software rasterizer') ||
      lower.includes('microsoft basic render') ||
      lower.includes('cpu');

    return {
      supported: !isSoftware,
      renderer,
      vendor,
      isSoftware,
      webglVersion: version,
      error: isSoftware ? 'Software rasterizer detected (No dedicated GPU acceleration)' : undefined
    };
  } catch (err) {
    return {
      supported: false,
      renderer: 'Error',
      vendor: 'Error',
      isSoftware: true,
      webglVersion: null,
      error: err?.message || 'Error initializing WebGL context'
    };
  }
}

export function getGpuTooltip(language, gpu) {
  if (!gpu || !gpu.supported) {
    const errorDetail = gpu?.renderer ? ` (${gpu.renderer})` : '';
    return language === 'de'
      ? `Keine GPU-Hardwarebeschleunigung verfügbar${errorDetail}. Gameplay-Vorschau erfordert funktionierende WebGL-Hardware.`
      : `No dedicated GPU hardware acceleration available${errorDetail}. Gameplay preview requires functional WebGL hardware.`;
  }
  return language === 'de'
    ? `Hardware-GPU erkannt: ${gpu.renderer} (${gpu.webglVersion?.toUpperCase() || 'WebGL'})`
    : `Hardware GPU active: ${gpu.renderer} (${gpu.webglVersion?.toUpperCase() || 'WebGL'})`;
}
