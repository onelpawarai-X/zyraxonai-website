import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CommunityAvatar } from "@/components/community/CommunityAvatar";
import { linkLabel, linkHost, type CommunityMember } from "@/lib/community";
import { PageShell } from "@/components/site/PageShell";
import { ButtonAnchor, ButtonLink, Card, Tag } from "@/components/site/ui";

export const Route = createFileRoute("/community/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Community profile — ZYRAXON AI" },
      { name: "description", content: "A verified ZYRAXON AI community member profile." },
      { property: "og:title", content: "Community profile — ZYRAXON AI" },
      { property: "og:description", content: "A verified ZYRAXON AI community member profile." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `https://zyraxonai.lovable.app/community/${params.id}` }],
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

  if (state === "loading") {
    return (
      <PageShell>
        <div className="zx-glass h-40 animate-pulse rounded-2xl" />
      </PageShell>
    );
  }

  if (state === "missing" || !member) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md py-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile not found</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            This profile does not exist or has been removed.
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink to="/community-art" size="md">
              Back to community
            </ButtonLink>
          </div>
        </div>
      </PageShell>
    );
  }

  const skillList = (member.skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <PageShell>
      <div className="mb-6">
        <ButtonLink to="/community-art" variant="ghost" size="sm">
          ← Back to community
        </ButtonLink>
      </div>

      <Card className="relative overflow-hidden p-7 sm:p-9">
        <div className="pointer-events-none absolute inset-0 zx-grid-lines opacity-[0.25]" />
        <div className="relative flex flex-wrap items-center gap-6">
          <CommunityAvatar name={member.name} seed={member.id} src={member.avatarUrl} size={104} />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{member.name}</h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              {[member.role, member.institution, member.country].filter(Boolean).join(" · ")}
            </p>
            {member.joinedAt && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Joined{" "}
                {new Date(member.joinedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
            {member.links?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {member.links.slice(0, 3).map((l) => (
                  <ButtonAnchor key={l.url} href={l.url} variant="glass" size="sm">
                    {linkLabel(l)}
                  </ButtonAnchor>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-5">
          {member.participation && (
            <Card className="p-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                About
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {member.participation}
              </p>
            </Card>
          )}

          {skillList.length > 0 && (
            <Card className="p-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                Skills
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {skillList.map((s) => (
                  <Tag key={s} tone="muted">
                    {s}
                  </Tag>
                ))}
              </div>
            </Card>
          )}
        </div>

        {member.links?.length > 0 && (
          <Card className="p-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Links</h2>
            <ul className="mt-3 grid gap-2">
              {member.links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="zx-chip flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-foreground">
                        {linkLabel(l)}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {linkHost(l.url)}
                      </span>
                    </span>
                    <svg
                      className="shrink-0 text-muted-foreground"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
