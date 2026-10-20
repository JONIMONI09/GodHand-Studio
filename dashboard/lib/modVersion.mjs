/**
 * Version and URL Resolution Engine for GodHand Studio
 * 
 * Handles SemVer template resolution (${version} -> concrete version),
 * manifest token expansion, and GitHub Actions URL sanitization.
 */

/**
 * Resolves the concrete mod version from manifest version string and gradle.properties.
 * Eliminates unexpanded ${version} or ${mod_version} template placeholders.
 */
export function resolveModVersion(manifestVersion, gradlePropertiesContent, fallback = '1.0.0') {
  if (manifestVersion && typeof manifestVersion === 'string') {
    let trimmed = manifestVersion.trim().replace(/^["']|["']$/g, '');
    if (trimmed && !trimmed.includes('${')) {
      return trimmed;
    }
  }

  if (gradlePropertiesContent && typeof gradlePropertiesContent === 'string') {
    const lines = gradlePropertiesContent.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('!')) {
        continue;
      }
      const match = line.match(/^(?:mod_version|version|modVersion|project\.version)\s*[:=]\s*(.+)$/i);
      if (match) {
        let val = match[1].replace(/\s*(?:#|\/\/).*$/, '').trim();
        val = val.replace(/^["']|["']$/g, '').trim();
        if (val && !val.includes('${')) {
          return val;
        }
      }
    }
  }

  const cleanFallback = typeof fallback === 'string' && !fallback.includes('${') ? fallback : '1.0.0';
  return cleanFallback;
}

/**
 * Resolves archivesBaseName or mod archives name from gradle.properties or falls back to modId.
 * Strips directory prefixes like mods/ to guarantee a valid, clean filename.
 */
export function resolveArchivesBaseName(modId, gradlePropertiesContent) {
  if (gradlePropertiesContent && typeof gradlePropertiesContent === 'string') {
    const lines = gradlePropertiesContent.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('!')) {
        continue;
      }
      const match = line.match(/^(?:archives_base_name|archivesBaseName|archivesName|rootProject\.name)\s*[:=]\s*(.+)$/i);
      if (match) {
        let val = match[1].replace(/\s*(?:#|\/\/).*$/, '').trim();
        val = val.replace(/^["']|["']$/g, '').trim();
        if (val && !val.includes('${')) {
          return val;
        }
      }
    }
  }
  const clean = (modId || 'mod').replace(/^mods[\/\\]/, '').replace(/[\\\/]/g, '');
  return clean || 'mod';
}

/**
 * Extracts a specific property value from gradle.properties content.
 */
export function extractGradleProp(gradlePropertiesContent, propName, fallback = '') {
  if (!gradlePropertiesContent || typeof gradlePropertiesContent !== 'string') {
    return fallback;
  }
  const lines = gradlePropertiesContent.split(/\r?\n/);
  const regex = new RegExp(`^${propName}\\s*[:=]\\s*(.+)$`, 'i');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('!')) continue;
    const match = line.match(regex);
    if (match) {
      let val = match[1].replace(/\s*(?:#|\/\/).*$/, '').trim();
      val = val.replace(/^["']|["']$/g, '').trim();
      if (val) return val;
    }
  }
  return fallback;
}

/**
 * Expands Gradle processResources template tokens (${version}, ${minecraft_version}, etc.)
 * in mod manifests (fabric.mod.json, neoforge.mods.toml, etc.).
 */
export function expandManifestTokens(content, variables = {}) {
  if (!content || typeof content !== 'string') return content;
  const version = variables.version || '1.0.0';
  const mcVersion = variables.minecraftVersion || '1.21.1';
  const modId = variables.modId || 'mod';

  return content
    .replace(/\$\{version\}/g, version)
    .replace(/\$\{mod_version\}/g, version)
    .replace(/\$\{project\.version\}/g, version)
    .replace(/\$\{minecraft_version\}/g, mcVersion)
    .replace(/\$\{project\.minecraft_version\}/g, mcVersion)
    .replace(/\$\{archives_base_name\}/g, modId)
    .replace(/\$\{project\.base\.archivesName\.get\(\)\}/g, modId)
    .replace(/\$\{[^}]*version[^}]*\}/gi, version);
}

/**
 * Sanitizes GitHub Actions URLs by stripping invalid /artifacts suffixes.
 * GitHub Actions run URLs are https://github.com/<owner>/<repo>/actions/runs/<run_id>.
 * Appending /artifacts returns 404 on GitHub.
 */
export function cleanActionsUrl(url) {
  if (!url || typeof url !== 'string') return undefined;
  // Match and strip /artifacts and anything following it on Actions run URLs
  return url.replace(/\/actions\/runs\/(\d+)\/artifacts(?:\/.*|\?.*)?$/, '/actions/runs/$1');
}

/**
 * Resolves the 100% public, token-free direct download URL for a compiled mod from GitHub Releases.
 */
export function resolveReleaseDownloadUrl(targetMod = 'godhand', version = '1.0.0', repo = 'JONIMONI09/GodHand-Studio') {
  const cleanMod = (targetMod || 'godhand').replace(/^mods[\/\\]/, '').replace(/[\\\/]/g, '');
  const baseName = cleanMod.includes('arm32') ? 'arm32-fix' : cleanMod;
  const jarName = `${baseName}-${version}.jar`;
  return `https://github.com/${repo}/releases/download/latest/${jarName}`;
}

