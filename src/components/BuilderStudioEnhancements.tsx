import { useEffect } from "react";
import BuilderStudioMulti from "./BuilderStudioMulti";

const NATURAL_SYSTEM_APPEND = `\n\nCONVERSATION UX: Speak naturally like a polished human AI assistant. If the user casually asks what you are doing, answer briefly and naturally (for example: that you are here with them and ready to help). Do not answer casual questions with installation steps, manual file-saving instructions, deployment tutorials, or numbered setup guides unless the user explicitly asks for those instructions. When work is completed, summarize the result briefly and clearly.`;
const MODEL_ALIASES: Record<string, string> = {
  "MiMo V2.5 Free": "ZYRAXON TITAN",
  "Nemotron 3 Super Free": "ZYRAXON NEXUS",
  "Big Pickle": "ZYRAXON OMEGA",
};

type NativeField = HTMLInputElement | HTMLTextAreaElement;
function setNativeValue(el: NativeField, value: string) {
  const proto =
    el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function authState() {
  try {
    const raw = localStorage.getItem("zyraxon_ecosystem_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

async function clearLocalData() {
  try {
    await fetch("/api/public/auth/github/logout", { method: "POST", credentials: "include" });
  } catch {
    /* ignored */
  }
  try {
    localStorage.clear();
  } catch {
    /* ignored */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignored */
  }
  try {
    if ("indexedDB" in window && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      await Promise.all(
        (dbs || []).map((db) =>
          db.name
            ? new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(db.name!);
                req.onsuccess = req.onerror = req.onblocked = () => resolve();
              })
            : Promise.resolve(),
        ),
      );
    }
  } catch {
    /* ignored */
  }
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    /* ignored */
  }
}

function micSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>';
}

export default function BuilderStudioEnhancements() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-zyraxon-final-fixes", "true");
    style.textContent = `
      .zyraxon-builder .glass,.zyraxon-builder .message,.zyraxon-builder .composer,.zyraxon-builder .studio-pane,.zyraxon-builder .preview-frame{background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.045) 45%,rgba(0,0,0,.42))!important;border:1.5px solid rgba(255,255,255,.15)!important;backdrop-filter:blur(42px) saturate(155%)!important;-webkit-backdrop-filter:blur(42px) saturate(155%)!important;box-shadow:inset 0 1px rgba(255,255,255,.13),0 24px 80px rgba(0,0,0,.42),0 0 45px rgba(255,255,255,.025)!important}
      .zyraxon-builder .glass-btn,.zyraxon-builder .mode-btn,.zyraxon-builder .model-btn,.zyraxon-builder .send-btn,.zyraxon-builder .voice-btn,.zyraxon-builder .reset-local-btn,.zyraxon-builder .suggestions button,.zyraxon-builder .studio-tabs button,.zyraxon-builder .device-tabs button{border-width:1.5px!important;background:rgba(255,255,255,.055)!important;box-shadow:inset 0 1px rgba(255,255,255,.1),0 10px 30px rgba(0,0,0,.2)!important}
      .zyraxon-builder .composer-row{align-items:center!important;gap:10px!important}.zyraxon-builder .composer-left{flex:1 1 auto!important;min-width:0!important}.zyraxon-builder .zyraxon-voice-actions{display:flex!important;align-items:center!important;gap:7px!important;margin-left:auto!important;flex:0 0 auto!important}.zyraxon-builder .voice-btn{width:37px!important;height:37px!important;padding:0!important;display:grid!important;place-items:center!important;border:1.5px solid rgba(255,255,255,.17)!important;border-radius:12px!important;color:var(--text)!important;cursor:pointer!important}.zyraxon-builder .voice-btn svg{width:18px!important;height:18px!important}.zyraxon-builder .voice-btn.is-listening{background:rgba(255,255,255,.15)!important;box-shadow:0 0 0 3px rgba(255,255,255,.055),0 0 30px rgba(255,255,255,.18)!important}.zyraxon-builder .zyraxon-account-stack{display:flex!important;flex-direction:column!important;align-items:center!important;gap:5px!important;margin-left:8px!important;flex:0 0 auto!important}.zyraxon-builder .github-account-btn{width:36px!important;height:36px!important;padding:0!important;display:grid!important;place-items:center!important;border:1.5px solid rgba(255,255,255,.16)!important;border-radius:11px!important;background:rgba(255,255,255,.055)!important;color:var(--text)!important;cursor:pointer!important}.zyraxon-builder .github-account-btn img{width:25px;height:25px;border-radius:8px;object-fit:cover}.zyraxon-builder .github-account-btn svg{width:18px;height:18px}.zyraxon-builder .reset-local-btn{width:29px!important;height:26px!important;padding:0!important;display:grid!important;place-items:center!important;border:1.5px solid rgba(255,255,255,.13)!important;border-radius:9px!important;background:rgba(255,255,255,.035)!important;color:var(--muted)!important;cursor:pointer!important}.zyraxon-builder .reset-local-btn svg{width:14px;height:14px}.zyraxon-builder .messages{padding-bottom:24px!important}.zyraxon-builder .chat-scroll{scroll-padding-bottom:30px!important}.zyraxon-builder .studio-head{background:rgba(0,0,0,.22)!important}.zyraxon-builder .preview-stage{background:radial-gradient(circle at 50% 20%,rgba(255,255,255,.045),transparent 52%)!important}.zyraxon-builder .publish-modal input[placeholder="GitHub token"]{display:none!important}.zyraxon-builder .connected-publish-note{font-size:11px;color:var(--muted);padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.035)}
    `;
    document.head.appendChild(style);

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (url.includes("/api/public/builder/chat") && init?.body && typeof init.body === "string") {
        try {
          const payload = JSON.parse(init.body);
          if (Array.isArray(payload.messages) && payload.messages[0]?.role === "system") {
            payload.messages[0] = {
              ...payload.messages[0],
              content: `${payload.messages[0].content || ""}${NATURAL_SYSTEM_APPEND}`,
            };
            return originalFetch(input, { ...init, body: JSON.stringify(payload) });
          }
        } catch {
          /* ignored */
        }
      }
      return originalFetch(input, init);
    };

    let scrollTimer: number | undefined;
    let mic: HTMLButtonElement | undefined;
    let recognition: unknown;
    let listening = false;
    let committed = "";
    let languageIndex = 0;
    const languages = [
      "bn-BD",
      "hi-IN",
      "en-US",
      "en-IN",
      "ur-PK",
      "ar-SA",
      "ta-IN",
      "te-IN",
      "ml-IN",
      "es-ES",
      "fr-FR",
      "de-DE",
      "pt-BR",
      "id-ID",
      "tr-TR",
      "it-IT",
      "ja-JP",
      "ko-KR",
      "zh-CN",
      "ru-RU",
    ];

    const applyModelAliases = () => {
      document
        .querySelectorAll<HTMLElement>(
          ".zyraxon-builder .model-btn,.zyraxon-builder .model-pop button",
        )
        .forEach((el) => {
          const original = el.dataset.zyraxonOriginalText || el.textContent || "";
          if (!el.dataset.zyraxonOriginalText) el.dataset.zyraxonOriginalText = original;
          let next = original;
          for (const [from, to] of Object.entries(MODEL_ALIASES)) next = next.replaceAll(from, to);
          if (next !== el.textContent) el.textContent = next;
        });
    };

    const scrollChatToBottom = () => {
      const box = document.querySelector<HTMLElement>(".zyraxon-builder .chat-scroll");
      if (!box) return;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        box.scrollTop = box.scrollHeight;
      }, 0);
    };
    const setVoiceValue = (value: string) => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        ".zyraxon-builder .composer textarea",
      );
      if (textarea) {
        setNativeValue(textarea, value);
        textarea.focus();
      }
    };
    const stopVoice = () => {
      listening = false;
      try {
        recognition?.stop();
      } catch {
        /* ignored */
      }
      mic?.classList.remove("is-listening");
      mic?.setAttribute("aria-label", "Voice input");
    };
    const startVoice = () => {
      const Ctor =
        (window as unknown).SpeechRecognition || (window as unknown).webkitSpeechRecognition;
      if (!Ctor) {
        mic?.setAttribute("title", "Voice input is not supported by this browser");
        return;
      }
      if (listening) {
        stopVoice();
        return;
      }
      committed =
        document.querySelector<HTMLTextAreaElement>(".zyraxon-builder .composer textarea")?.value ||
        "";
      listening = true;
      languageIndex = 0;
      const run = () => {
        if (!listening) return;
        recognition = new Ctor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        const preferred = String(
          (navigator.languages && navigator.languages[0]) || navigator.language || "",
        ).toLowerCase();
        recognition.lang = preferred.startsWith("bn")
          ? "bn-BD"
          : preferred.startsWith("hi")
            ? "hi-IN"
            : preferred.startsWith("en")
              ? (navigator.languages && navigator.languages[0]) || "en-US"
              : languages[languageIndex];
        recognition.onstart = () => {
          mic?.classList.add("is-listening");
          mic?.setAttribute("title", `Listening · ${recognition.lang}`);
        };
        recognition.onresult = (event: unknown) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i],
              t = r?.[0]?.transcript || "";
            if (r?.isFinal) {
              const clean = t.trim();
              if (clean) committed += (committed && !/\s$/.test(committed) ? " " : "") + clean;
            } else interim += t;
          }
          setVoiceValue(
            committed + (interim ? (committed && !/\s$/.test(committed) ? " " : "") + interim : ""),
          );
        };
        recognition.onerror = (event: unknown) => {
          const err = String(event?.error || "");
          if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") {
            stopVoice();
            return;
          }
          if (
            err === "language-not-supported" ||
            err === "language-unavailable" ||
            err === "no-speech" ||
            err === "nomatch"
          )
            languageIndex = (languageIndex + 1) % languages.length;
        };
        recognition.onend = () => {
          if (listening) window.setTimeout(run, 120);
        };
        try {
          recognition.start();
        } catch {
          stopVoice();
        }
      };
      run();
    };

    const setupMic = () => {
      const composer = document.querySelector<HTMLElement>(".zyraxon-builder .composer"),
        row = composer?.querySelector<HTMLElement>(".composer-row"),
        send = row?.querySelector<HTMLButtonElement>(".send-btn");
      if (!row || !send) return;
      let group = row.querySelector<HTMLElement>(".zyraxon-voice-actions");
      if (!group) {
        group = document.createElement("div");
        group.className = "zyraxon-voice-actions";
        row.insertBefore(group, send);
        group.appendChild(send);
      }
      if (!group.querySelector(".voice-btn")) {
        mic = document.createElement("button");
        mic.type = "button";
        mic.className = "voice-btn";
        mic.innerHTML = micSvg();
        mic.title = "Voice input · automatic language fallback";
        mic.setAttribute("aria-label", "Voice input");
        mic.addEventListener("click", startVoice);
        group.insertBefore(mic, send);
      }
    };

    const setupAccount = () => {
      const host = document.querySelector<HTMLElement>(".zyraxon-builder .top-actions");
      if (!host || host.querySelector(".zyraxon-account-stack")) return;
      const stack = document.createElement("div");
      stack.className = "zyraxon-account-stack";
      const login = document.createElement("button");
      login.type = "button";
      login.className = "github-account-btn";
      login.setAttribute("aria-label", "Sign in with GitHub");
      login.addEventListener("click", () => {
        const auth = authState();
        if (auth?.user?.username)
          window.open(
            `https://github.com/${encodeURIComponent(auth.user.username)}`,
            "_blank",
            "noopener,noreferrer",
          );
        else window.location.assign("/api/public/auth/github/start");
      });
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "reset-local-btn";
      reset.title = "Reset local session and data";
      reset.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V4h6v2m-9 0 1 15h10l1-15M10 11v6m4-6v6"/></svg>';
      reset.addEventListener("click", async () => {
        if (!window.confirm("Reset this ZYRAXON session and all local builder data?")) return;
        await clearLocalData();
        window.location.replace("/builder");
      });
      stack.append(login, reset);
      host.appendChild(stack);
      const refresh = () => {
        const auth = authState();
        if (auth?.user?.avatarUrl)
          login.innerHTML = `<img src="${String(auth.user.avatarUrl).replace(/"/g, "&quot;")}" alt="">`;
        else
          login.innerHTML =
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 8.36 23c.58.11.79-.25.79-.56v-2.02c-3.22.7-3.9-1.56-3.9-1.56-.53-1.37-1.29-1.73-1.29-1.73-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.69 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.57-.29-5.28-1.29-5.28-5.73 0-1.27.45-2.3 1.19-3.11.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.19a11 11 0 0 1 5.79 0c2.21-1.5 3.18-1.19 3.18-1.19.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.11 0 4.45-2.71 5.44-5.29 5.72.41.36.78 1.05.78 2.12v3.15c0 .31.21.68.78.56A11.5 11.5 0 0 0 12 .5Z"/></svg>';
      };
      refresh();
    };

    const fillConnectedPublish = () => {
      const auth = authState(),
        modal = document.querySelector<HTMLElement>(".zyraxon-builder .publish-modal"),
        token = modal?.querySelector<HTMLInputElement>('input[placeholder="GitHub token"]');
      if (!auth || !token) return;
      setNativeValue(token, "connected-session");
      if (!modal.querySelector(".connected-publish-note")) {
        const note = document.createElement("div");
        note.className = "connected-publish-note";
        note.textContent = "GitHub connected — no token entry is required.";
        token.insertAdjacentElement("afterend", note);
      }
    };
    const patchPreview = () => {
      document
        .querySelectorAll<HTMLIFrameElement>(".zyraxon-builder .preview-frame iframe")
        .forEach((frame) => {
          frame.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-modals");
          const srcdoc = frame.getAttribute("srcdoc") || "";
          const badSubmit =
            "document.addEventListener('submit',function(e){e.preventDefault();e.stopPropagation()},true);";
          if (srcdoc.includes(badSubmit))
            frame.setAttribute("srcdoc", srcdoc.replace(badSubmit, ""));
        });
    };
    const setup = () => {
      applyModelAliases();
      setupMic();
      setupAccount();
      fillConnectedPublish();
      patchPreview();
      scrollChatToBottom();
    };
    const observer = new MutationObserver(setup);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["srcdoc"],
    });
    setup();
    return () => {
      listening = false;
      try {
        recognition?.stop();
      } catch {
        /* ignored */
      }
      window.clearTimeout(scrollTimer);
      observer?.disconnect();
      style.remove();
      window.fetch = originalFetch;
    };
  }, []);
  return <BuilderStudioMulti />;
}
