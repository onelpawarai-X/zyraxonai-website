import { useEffect } from "react";

const MODEL_NAMES: Record<string, string> = {
  "mimo-v2.5-free": "ZYRAXON T10",
  "nemotron-3-super-free": "ZYRAXON PHANTOM",
  "big-pickle": "ZYRAXON VECTOR",
};

function ensurePublishTokenField(modal: HTMLElement) {
  let token = modal.querySelector<HTMLInputElement>('input[type="password"]');
  if (!token) {
    token = document.createElement("input");
    token.type = "password";
    token.autocomplete = "off";
    token.spellcheck = false;
    token.className = "zyraxon-publish-token";
    const repo = modal.querySelector<HTMLInputElement>('input:not([type="password"])');
    repo?.insertAdjacentElement("afterend", token);
  }
  token.classList.add("zyraxon-publish-token");
  token.placeholder = "GitHub Access Token";
  token.setAttribute("aria-label", "GitHub Access Token");
  token.style.display = "";
  token.style.visibility = "visible";
  token.style.opacity = "1";
  token.style.pointerEvents = "auto";
  return token;
}

export default function BuilderRuntimeFixes() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.zyraxonRuntimeFix = "true";
    style.textContent = `
      .zyraxon-builder .zb-topbar,.zyraxon-builder .message,.zyraxon-builder .composer,.zyraxon-builder .studio-pane,.zyraxon-builder .popover,.zyraxon-builder .inline-file,.zyraxon-builder .file-tree,.zyraxon-builder .studio-head{border-color:rgba(255,255,255,.18)!important;box-shadow:inset 0 1px rgba(255,255,255,.12),0 18px 70px rgba(0,0,0,.22)!important}
      .zyraxon-builder .composer{background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.045)),var(--panel)!important}
      .zyraxon-builder .publish-modal input[type="password"],.zyraxon-builder .publish-modal .zyraxon-publish-token{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
      .zyraxon-builder .publish-modal .publish-fields{display:flex!important;visibility:visible!important;opacity:1!important;flex-direction:column!important;gap:8px!important}
      .zyraxon-builder .publish-modal .publish-fields input{width:100%!important;box-sizing:border-box!important}
      .zyraxon-builder .publish-modal .publish-token-note{display:block;color:var(--muted);font-size:10px;line-height:1.45}
      .zyraxon-builder .publish-now:disabled{opacity:.65!important;cursor:wait!important}
    `;
    document.head.appendChild(style);

    const renameModels = () => {
      document
        .querySelectorAll<HTMLElement>(".model-pop button, .zb-models button")
        .forEach((button) => {
          const label = button.querySelector("b");
          if (!label) return;
          const text = label.textContent || "";
          if (/MiMo V2\.5 Free|ZYRAXON TITAN/i.test(text))
            label.textContent = MODEL_NAMES["mimo-v2.5-free"];
          else if (/Nemotron 3 Super Free|Nemotron 3 Ultra Free|ZYRAXON NEXUS/i.test(text))
            label.textContent = MODEL_NAMES["nemotron-3-super-free"];
          else if (/Big Pickle|ZYRAXON OMEGA/i.test(text))
            label.textContent = MODEL_NAMES["big-pickle"];
          const note = button.querySelector("small, em");
          if (note) note.textContent = "ZYRAXON Builder Engine";
        });
      document.querySelectorAll<HTMLElement>(".model-btn").forEach((button) => {
        const text = button.textContent || "";
        if (/MiMo V2\.5 Free|ZYRAXON TITAN/i.test(text))
          button.textContent = `${MODEL_NAMES["mimo-v2.5-free"]}⌄`;
        else if (/Nemotron 3 Super Free|Nemotron 3 Ultra Free|ZYRAXON NEXUS/i.test(text))
          button.textContent = `${MODEL_NAMES["nemotron-3-super-free"]}⌄`;
        else if (/Big Pickle|ZYRAXON OMEGA/i.test(text))
          button.textContent = `${MODEL_NAMES["big-pickle"]}⌄`;
      });
    };

    const decoratePublishModal = () => {
      document.querySelectorAll<HTMLElement>(".publish-modal").forEach((modal) => {
        const token = ensurePublishTokenField(modal);
        if (!modal.querySelector(".publish-token-note")) {
          const note = document.createElement("small");
          note.className = "publish-token-note";
          note.textContent =
            "Your token is used only for this publish request and is not stored by the Builder.";
          token.insertAdjacentElement("afterend", note);
        }
      });
    };

    const publishWithToken = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".publish-now") as HTMLButtonElement | null;
      if (!button) return;
      const modal = button.closest(".publish-modal") as HTMLElement | null;
      if (!modal) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const repoInput = modal.querySelector<HTMLInputElement>('input:not([type="password"])');
      const tokenInput = ensurePublishTokenField(modal);
      const repo = repoInput?.value.trim() || "";
      const token = tokenInput.value.trim();
      const status = modal.querySelector("small:not(.publish-token-note)");

      if (!token) {
        if (status) status.textContent = "Enter your GitHub access token.";
        tokenInput.focus();
        return;
      }
      if (!repo) {
        if (status) status.textContent = "Enter a repository name.";
        repoInput?.focus();
        return;
      }

      const iframe = document.querySelector<HTMLIFrameElement>(
        ".preview-frame iframe,.zb-preview iframe",
      );
      const html = iframe?.getAttribute("srcdoc") || "";
      if (!html) {
        if (status) status.textContent = "Generate a website before publishing.";
        return;
      }

      button.disabled = true;
      const original = button.textContent || "Publish";
      button.textContent = "Publishing…";
      try {
        const response = await fetch("/api/public/builder/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            repo,
            html,
            files: { "index.html": html },
            description: "Built with ZYRAXON AI",
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.ok) {
          if (status)
            status.textContent = data.pagesUrl
              ? `Published: ${data.pagesUrl}`
              : "Published successfully.";
          tokenInput.value = "";
        } else if (status) {
          status.textContent = data.error || "Publish failed.";
        }
      } catch {
        if (status) status.textContent = "Publish failed. Check your connection and try again.";
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };

    const patchPreview = (iframe: HTMLIFrameElement) => {
      const inject = () => {
        try {
          const doc = iframe.contentDocument;
          const win = iframe.contentWindow;
          if (!doc || !win || doc.documentElement.dataset.zyraxonPatched === "1") return;
          doc.documentElement.dataset.zyraxonPatched = "1";
          const css = doc.createElement("style");
          css.textContent = `a,button,[role="button"]{cursor:pointer!important}body{min-height:100vh}`;
          doc.head?.appendChild(css);
          doc.addEventListener(
            "click",
            (event) => {
              const target = event.target as Element | null;
              const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
              if (!anchor) return;
              const href = anchor.getAttribute("href") || "";
              const external =
                /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href);
              if (!external && href && href !== "#") {
                event.preventDefault();
                event.stopPropagation();
                try {
                  const url = new URL(href, win.location.href);
                  win.history.pushState({}, "", url.pathname + url.search + url.hash);
                } catch {
                  /* ignored */
                }
              }
            },
            true,
          );
        } catch {
          /* ignored */
        }
      };
      iframe.addEventListener("load", inject);
      inject();
      return () => iframe.removeEventListener("load", inject);
    };

    const iframeCleanups = new Map<HTMLIFrameElement, () => void>();
    const observe = () => {
      renameModels();
      decoratePublishModal();
      document
        .querySelectorAll<HTMLIFrameElement>(".preview-frame iframe,.zb-preview iframe")
        .forEach((iframe) => {
          if (!iframeCleanups.has(iframe)) iframeCleanups.set(iframe, patchPreview(iframe));
        });
      for (const [iframe, cleanup] of iframeCleanups) {
        if (!document.contains(iframe)) {
          cleanup();
          iframeCleanups.delete(iframe);
        }
      }
    };

    document.addEventListener("click", publishWithToken, true);
    const observer = new MutationObserver(observe);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(observe, 800);
    observe();

    return () => {
      document.removeEventListener("click", publishWithToken, true);
      observer.disconnect();
      window.clearInterval(interval);
      iframeCleanups.forEach((cleanup) => cleanup());
      style.remove();
    };
  }, []);

  return null;
}
