import JSZip from 'jszip';

export type TargetBrowser = 'firefox' | 'chrome' | 'edge' | 'universal';

export async function packageExtensionZip(
  files: Record<string, string>, 
  binaryFiles: Record<string, string>,
  targetBrowser: TargetBrowser = 'firefox',
  appOrigin?: string,
  authToken?: string
): Promise<Blob> {
  const zip = new JSZip();

  // Clone files to allow browser-specific manifest customization and live URL injection
  const bundleFiles: Record<string, string> = {};
  const originToInject = appOrigin && appOrigin !== 'null' && !appOrigin.startsWith('file:') 
    ? appOrigin.replace(/\/+$/, '') 
    : 'http://localhost:3000';

  for (const [filename, content] of Object.entries(files)) {
    let modified = content;

    // Replace default localhost:3000 with actual live app origin so extension talks to this app directly
    if (originToInject && originToInject !== 'http://localhost:3000') {
      modified = modified.replace(/http:\/\/localhost:3000/g, originToInject);
    }

    // Inject authentication token into extension scripts and HTML defaults
    if (authToken && authToken.trim()) {
      const cleanToken = authToken.trim();
      if (filename === 'content.js' || filename === 'background.js') {
        modified = modified.replace(/authToken:\s*['"][^'"]*['"]/g, `authToken: '${cleanToken}'`);
      }
      if (filename === 'popup.html') {
        modified = modified.replace(
          /id="auth-token"\s*placeholder="sh_live_\.\.\."/g,
          `id="auth-token" value="${cleanToken}" placeholder="sh_live_..."`
        );
      }
      if (filename === 'options.html') {
        modified = modified.replace(
          /id="authToken"\s*placeholder="sh_live_\.\.\."/g,
          `id="authToken" value="${cleanToken}" placeholder="sh_live_..."`
        );
      }
      if (filename === 'options.js' || filename === 'popup.js') {
        modified = modified.replace(/stored\?\.authToken\s*\|\|\s*''/g, `stored?.authToken || '${cleanToken}'`);
      }
    }

    bundleFiles[filename] = modified;
  }

  if (bundleFiles['manifest.json']) {
    try {
      const manifest = JSON.parse(bundleFiles['manifest.json']);
      if (targetBrowser === 'chrome' || targetBrowser === 'edge') {
        manifest.background = {
          service_worker: 'background.js'
        };
        delete manifest.browser_specific_settings;
        if (targetBrowser === 'edge') {
          manifest.name = 'SoroTrack Extension (Microsoft Edge)';
        }
      } else if (targetBrowser === 'firefox') {
        manifest.background = {
          scripts: ['background.js']
        };
        manifest.browser_specific_settings = {
          gecko: {
            id: 'sorotrack@dashboard.local',
            strict_min_version: '109.0'
          }
        };
      }

      // Ensure live app origin is explicitly allowed in host permissions
      if (originToInject) {
        if (!manifest.host_permissions) {
          manifest.host_permissions = [];
        }
        const permPattern = `${originToInject}/*`;
        if (!manifest.host_permissions.includes(permPattern)) {
          manifest.host_permissions.push(permPattern);
        }
      }

      bundleFiles['manifest.json'] = JSON.stringify(manifest, null, 2);
    } catch (err) {
      console.warn('Failed to customize manifest for target browser:', err);
    }
  }

  // Add text files
  for (const [filename, content] of Object.entries(bundleFiles)) {
    zip.file(filename, content);
  }

  // Add binary files (icons)
  for (const [filename, base64Content] of Object.entries(binaryFiles)) {
    zip.file(filename, base64Content, { base64: true });
  }

  return await zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
