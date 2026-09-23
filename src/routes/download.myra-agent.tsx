import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/download/myra-agent")({
  head: () => ({
    meta: [
      { title: "Download Myra Agent" },
      { name: "description", content: "Download the latest Myra Agent APK for Android. Voice-enabled mobile AI agent by ZYRAXON AI." },
      { property: "og:title", content: "Download Myra Agent" },
      { property: "og:description", content: "Download the latest Myra Agent APK for Android. Voice-enabled mobile AI agent by ZYRAXON AI." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/download/myra-agent" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadMyraAgent,
});

function DownloadMyraAgent() {
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
          Myra Agent
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "8px" }}>
          Starting download for Myra Agent...
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
                const res = await fetch('https://api.github.com/repos/onelpawarai-X/Myra-Agent/releases?per_page=10', {
                  headers: { Accept: 'application/vnd.github+json' }
                });
                if (res.ok) {
                  const releases = await res.json();
                  for (const rel of releases.filter(r => !r.draft)) {
                    const apk = (rel.assets || []).find(a => /\\.apk$/i.test(a.name));
                    if (apk) {
                      window.location.href = apk.browser_download_url;
                      setTimeout(() => { window.location.href = '/#download'; }, 2000);
                      return;
                    }
                  }
                  window.location.href = 'https://github.com/onelpawarai-X/Myra-Agent/releases';
                } else {
                  window.location.href = 'https://github.com/onelpawarai-X/Myra-Agent/releases';
                }
              } catch(e) {
                window.location.href = 'https://github.com/onelpawarai-X/Myra-Agent/releases';
              }
            })();
          `,
        }}
      />
    </div>
  );
}
