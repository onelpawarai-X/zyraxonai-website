import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/download/zyraxon-agent")({
  head: () => ({
    meta: [
      { title: "Download ZYRAXON Agent" },
      { name: "description", content: "Download the latest ZYRAXON Agent for your platform." },
    ],
  }),
  component: DownloadZyraxonAgent,
});

function DownloadZyraxonAgent() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', -apple-system, sans-serif",
        background: "#ffffff",
        color: "#111827",
      }}
    >
      <div style={{ textAlign: "center", padding: "40px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "12px" }}>
          ZYRAXON Agent
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "8px" }}>
          Starting download for ZYRAXON Agent...
        </p>
        <p style={{ color: "#9ca3af", fontSize: "13px" }}>
          Redirecting back in a moment.
        </p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (async function() {
              try {
                const res = await fetch('https://api.github.com/repos/onelpawarai-X/ZYRAXON-AI/releases?per_page=10', {
                  headers: { Accept: 'application/vnd.github+json' }
                });
                if (res.ok) {
                  const releases = await res.json();
                  const ua = (navigator.userAgent || '') + ' ' + (navigator.platform || '');
                  let os = 'windows';
                  if (/android/i.test(ua)) os = 'android';
                  else if (/mac|iphone|ipad/i.test(ua)) os = 'mac-arm';
                  else if (/linux|x11/i.test(ua)) os = 'linux';

                  const patterns = {
                    windows: [/win.*\\.exe$/i, /setup.*\\.exe$/i, /\\.exe$/i],
                    'mac-arm': [/(mac|osx|darwin).*(arm64|aarch64)/i, /-arm64/i],
                    'mac-intel': [/(mac|osx|darwin).*(x64|x86_64|intel)/i, /-x64/i],
                    linux: [/\\.AppImage$/i, /\\.deb$/i, /\\.rpm$/i]
                  };
                  const noise = /\\.blockmap$|\\.ya?ml$|\\.sha\\d*$|\\.sig$|\\.txt$|^latest/i;

                  for (const rel of releases.filter(r => !r.draft)) {
                    const assets = (rel.assets || []).filter(a => !noise.test(a.name));
                    const platPatterns = patterns[os] || patterns.windows;
                    for (const pat of platPatterns) {
                      const hit = assets.find(a => pat.test(a.name));
                      if (hit) {
                        window.location.href = hit.browser_download_url;
                        setTimeout(() => { window.location.href = '/#download'; }, 2000);
                        return;
                      }
                    }
                  }
                  window.location.href = 'https://github.com/onelpawarai-X/ZYRAXON-AI/releases';
                } else {
                  window.location.href = 'https://github.com/onelpawarai-X/ZYRAXON-AI/releases';
                }
              } catch(e) {
                window.location.href = 'https://github.com/onelpawarai-X/ZYRAXON-AI/releases';
              }
            })();
          `,
        }}
      />
    </div>
  );
}
