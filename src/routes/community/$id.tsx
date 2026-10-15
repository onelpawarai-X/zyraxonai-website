import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CommunityAvatar } from "@/components/community/CommunityAvatar";
import { linkLabel, type CommunityMember } from "@/lib/community";

export const Route = createFileRoute("/community/$id")({
  head: () => ({
    meta: [
      { title: "Community profile — ZYRAXON AI" },
      { name: "description", content: "A verified ZYRAXON AI community member profile." },
      { property: "og:title", content: "Community profile — ZYRAXON AI" },
      { property: "og:description", content: "A verified ZYRAXON AI community member profile." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityProfile,
});

function CommunityProfile() {
  const { id } = Route.useParams();
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [state, setState] = useState<"loading" | "found" | "missing">("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    fetch("/api/public/community-act?limit=500")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const found = (d.members ?? []).find((m: CommunityMember) => m.id === id) ?? null;
        setMember(found);
        setState(found ? "found" : "missing");
      })
      .catch(() => active && setState("missing"));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link to="/community-art" className="text-sm text-muted-foreground hover:text-foreground">
          ← Community
        </Link>

        {state === "loading" && (
          <p className="mt-8 text-sm text-muted-foreground">Loading profile…</p>
        )}

        {state === "missing" && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-semibold">Profile not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              এই প্রোফাইলটি নেই বা সরিয়ে ফেলা হয়েছে।
            </p>
            <Link
              to="/community-art"
              className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Back to community
            </Link>
          </div>
        )}

        {state === "found" && member && (
          <article className="mt-8">
            <header className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card p-6">
              <CommunityAvatar name={member.name} seed={member.id} src={member.avatarUrl} size={88} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{member.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[member.role, member.institution, member.country].filter(Boolean).join(" · ")}
                </p>
                {member.joinedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </header>

            {member.participation && (
              <section className="mt-5 rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                  About
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed">{member.participation}</p>
              </section>
            )}

            {member.skills && (
              <section className="mt-5 rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                  Skills
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {member.skills
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium"
                      >
                        {s}
                      </span>
                    ))}
                </div>
              </section>
            )}

            {member.links?.length > 0 && (
              <section className="mt-5 rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                  Links
                </h2>
                <ul className="mt-3 space-y-2">
                  {member.links.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-sm font-semibold text-primary underline break-all"
                      >
                        {linkLabel(l)}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        )}
      </div>
    </main>
  );
}
