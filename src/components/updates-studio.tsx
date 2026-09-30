import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_DRAFT,
  deleteContent,
  embedFor,
  embedKind,
  listContent,
  mediaTypeOf,
  publicUrl,
  saveContent,
  uploadMedia,
  type Draft,
  type StudioItem,
} from "@/lib/studio-client";

const KINDS = [
  { value: "feature", label: "Feature" },
  { value: "announcement", label: "Announcement" },
  { value: "update", label: "Update" },
  { value: "model", label: "AI Model" },
  { value: "highlight", label: "Highlight" },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10";
const labelClass = "mb-1.5 block text-xs font-semibold tracking-wide text-slate-600";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}

/** Live preview of a pasted link so the owner sees the embed before saving. */
function LinkPreview({ url }: { url: string }) {
  const embed = useMemo(() => embedFor(url), [url]);
  if (!embed) {
    return (
      <p className="text-xs text-slate-400">
        Paste a link and it renders in place. YouTube, Vimeo, Loom, TikTok, X, Spotify,
        SoundCloud, Streamable, or a direct .mp4 / .mp3 / image URL.
      </p>
    );
  }
  const kind = embedKind(embed);
  if (kind === "video") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          <iframe
            src={embed}
            title="Link preview"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <iframe src={embed} title="Link preview" height={120} className="w-full rounded-lg border-0" />
      </div>
    );
  }
  if (kind === "image") {
    return <img src={embed} alt="Link preview" className="w-full rounded-xl border border-slate-200" />;
  }
  return null;
}

/** Uploaded media preview, covering image, video and audio. */
function MediaPreview({ url, kind }: { url: string; kind: "image" | "video" | "audio" }) {
  if (kind === "video") {
    return (
      <video src={url} controls playsInline className="w-full rounded-xl bg-slate-900" />
    );
  }
  if (kind === "audio") {
    return <audio src={url} controls className="w-full" />;
  }
  return <img src={url} alt="Upload preview" className="w-full rounded-xl border border-slate-200" />;
}

export default function UpdatesStudio({ accessKey }: { accessKey: string }) {
  const [items, setItems] = useState<StudioItem[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<"image" | "video" | "audio">("image");

  const flash = useCallback((tone: "ok" | "err", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { items: rows } = await listContent(accessKey);
      setItems(rows);
    } catch (err) {
      flash("err", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accessKey, flash]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openPicker = (kind: "image" | "video" | "audio") => {
    setPendingKind(kind);
    if (fileRef.current) {
      fileRef.current.accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : "audio/*";
      fileRef.current.click();
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadPhase("uploading");
    try {
      const path = await uploadMedia(accessKey, file, (p) => setUploadPhase(p.phase));
      setDraft((d) => ({ ...d, image_url: path }));
      flash("ok", `${file.name} uploaded to the cloud`);
    } catch (err) {
      flash("err", (err as Error).message);
    } finally {
      setUploadPhase(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return flash("err", "A title is required");
    setBusy(true);
    try {
      const res = await saveContent(accessKey, draft, editingId ?? undefined);
      if (res.error) throw new Error(res.error);
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      await refresh();
      flash("ok", editingId ? "Update saved and live" : "Published to the website");
    } catch (err) {
      flash("err", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: StudioItem) => {
    setItems((rows) =>
      rows.map((r) => (r.id === item.id ? { ...r, published: !r.published } : r)),
    );
    try {
      await saveContent(
        accessKey,
        {
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle ?? "",
          body: item.body ?? "",
          badge: item.badge ?? "",
          accent: item.accent ?? "#06b6d4",
          link_url: item.link_url ?? "",
          image_url: item.image_url ?? "",
          published: !item.published,
        },
        item.id,
      );
    } catch (err) {
      flash("err", (err as Error).message);
      refresh();
    }
  };

  const remove = async (item: StudioItem) => {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try {
      await deleteContent(accessKey, item.id);
      await refresh();
      flash("ok", "Deleted");
    } catch (err) {
      flash("err", (err as Error).message);
    }
  };

  const edit = (item: StudioItem) => {
    setEditingId(item.id);
    setDraft({
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle ?? "",
      body: item.body ?? "",
      badge: item.badge ?? "",
      accent: item.accent ?? "#06b6d4",
      link_url: item.link_url ?? "",
      image_url: item.image_url ?? "",
      published: item.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyLink = async (item: StudioItem) => {
    const url = item.publicUrl ?? publicUrl(item);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(item.id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      flash("err", url);
    }
  };

  const mediaKind = mediaTypeOf(draft.image_url);
  const uploadedPreview = draft.image_url && /^https?:\/\//.test(draft.image_url);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      {/* ---------------------------- composer ---------------------------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {editingId ? "Edit update" : "Publish an update"}
          </h2>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY_DRAFT);
              }}
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
            >
              Cancel
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <select
                className={inputClass}
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Accent colour">
              <input
                type="color"
                value={draft.accent}
                onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
                className="h-[42px] w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5"
              />
            </Field>
          </div>

          <Field label="Title">
            <input
              className={inputClass}
              placeholder="e.g. ZYRAXON Voice Bridge v3"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
            />
          </Field>

          <Field label="Subtitle">
            <input
              className={inputClass}
              placeholder="e.g. Ultra-low latency voice pipeline"
              value={draft.subtitle}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
            />
          </Field>

          <Field label="Body">
            <textarea
              rows={5}
              className={inputClass}
              placeholder="What it does and why it matters…"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </Field>

          <Field label="Badge">
            <input
              className={inputClass}
              placeholder="NEW, PRO, AGENT"
              value={draft.badge}
              onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
            />
          </Field>

          {/* media */}
          <div>
            <span className={labelClass}>Media</span>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="grid grid-cols-3 gap-2">
              {(["image", "video", "audio"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => openPicker(k)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 capitalize transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700"
                >
                  {k === "image" ? "Photo" : k === "video" ? "Video" : "Audio"}
                </button>
              ))}
            </div>
            {uploadPhase && (
              <p className="mt-2 text-xs font-medium text-cyan-700">Uploading to the cloud…</p>
            )}
            {draft.image_url && (
              <div className="mt-3 space-y-2">
                {uploadedPreview ? (
                  <MediaPreview url={draft.image_url} kind={mediaKind === "file" ? "image" : mediaKind} />
                ) : (
                  <p className="truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {draft.image_url}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, image_url: "" })}
                  className="text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                >
                  Remove media
                </button>
              </div>
            )}
          </div>

          {/* link */}
          <Field label="Link (renders in place)">
            <input
              className={inputClass}
              placeholder="https://youtube.com/watch?v=…"
              value={draft.link_url}
              onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
            />
          </Field>
          <LinkPreview url={draft.link_url} />

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 accent-cyan-600"
            />
            Publish to the website
          </label>

          {notice && (
            <p
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {notice.text}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : editingId ? "Save changes" : "Publish to website"}
          </button>
        </form>
      </section>

      {/* ------------------------------ list ------------------------------ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Published ({items.length})
          </h2>
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-bold tracking-wide text-cyan-700 uppercase">
            Lovable Cloud
          </span>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading from the cloud…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Nothing published yet. Your first update will appear on the home page and get its own
            permanent link.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => {
              const permalink = item.publicUrl ?? publicUrl(item);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {item.badge && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                            style={{
                              color: item.accent ?? "#06b6d4",
                              background: `${item.accent ?? "#06b6d4"}1a`,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                          {item.kind}
                        </span>
                      </div>
                      <h3 className="truncate text-[15px] font-bold text-slate-900">
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="mt-0.5 truncate text-sm text-slate-600">{item.subtitle}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => toggle(item)}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                          item.published
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                      >
                        {item.published ? "Live" : "Draft"}
                      </button>
                      <button
                        onClick={() => edit(item)}
                        className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(item)}
                        className="rounded-lg bg-rose-100 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                    <a
                      href={permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-700"
                    >
                      Open page
                    </a>
                    <button
                      onClick={() => copyLink(item)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    >
                      {copied === item.id ? "Copied" : "Copy AI link"}
                    </button>
                    <code className="truncate text-[11px] text-slate-400">{permalink}</code>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
