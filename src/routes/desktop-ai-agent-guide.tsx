import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Section, Tag } from "@/components/site/ui";
import { pageSeo, faqSchema } from "@/lib/seo";

export const Route = createFileRoute("/desktop-ai-agent-guide")({
  head: () =>
    pageSeo({
      path: "/desktop-ai-agent-guide",
      title:
        "How to Choose a Desktop AI Agent in 2026 — A Buyer's Guide (Tools, Modes, Memory, Privacy)",
      description:
        "A practical guide to evaluating desktop AI agents: what to check for, how tools and agent modes differ, why memory matters, how privacy works when the agent runs on your machine, and where a chat assistant stops being enough.",
      type: "article",
      section: "Guide",
      keywords: [
        "desktop AI agent",
        "AI agent comparison",
        "best AI coding agent",
        "AI agent buyer guide",
        "autonomous coding agent",
        "AI agent tools",
        "local AI agent",
        "AI agent memory",
        "agent modes",
        "desktop AI assistant",
      ],
      jsonLd: [
        faqSchema([
          [
            "What is a desktop AI agent?",
            "A program that runs on your own computer and acts on it — reading your files, running commands, editing code and using tools — rather than only answering questions in a chat window. The distinction is that it does the work, not just describes it.",
          ],
          [
            "How is a desktop AI agent different from a chat assistant?",
            "A chat assistant produces text. An agent produces changes: it opens files, runs the tests, reads the error, fixes the code and repeats. It also remembers across sessions, so you do not re-explain your project each time.",
          ],
          [
            "What should I check before choosing one?",
            "Four things: how many real tools it can call, whether it has distinct modes for planning and building, whether it remembers between sessions, and whether it runs locally with your own keys or sends everything to a hosted service.",
          ],
          [
            "Do I need to give an agent my API keys?",
            "With a local agent you choose the provider and hold the key. With a hosted agent the vendor holds it. If the agent supports an OpenAI-compatible base URL, you can point it at any provider — including a self-hosted one.",
          ],
          [
            "Why does agent memory matter?",
            "Without memory every session starts cold: the same explanations, the same mistakes. Memory turns a tool you drive into a collaborator that already knows your codebase, your conventions and what you tried last week.",
          ],
          [
            "Can a desktop AI agent be free?",
            "Yes. ZYRAXON AI is free and source-available, with 888 tools, 11 agent modes and eternal memory, and it can use either a free provider or your own keys.",
          ],
        ]),
      ],
    }),
  component: GuidePage,
});

const CHECKLIST: Array<{ title: string; body: string; good: string }> = [
  {
    title: "Real tools, not just a file reader",
    body: "A tool count is only meaningful if the tools do distinct things. Ask whether it can run shell commands, edit files in place, search a codebase, call an API and control a browser — and whether the list is grouped by purpose or padded.",
    good: "ZYRAXON ships 888 tools across 63 categories, from shell and git to screen vision and control systems.",
  },
  {
    title: "Distinct modes for planning and building",
    body: "One mode cannot be both cautious and autonomous. A planning mode should be read-only so it cannot damage anything while it thinks; a build mode should be able to write, run and test. If there is only one mode, you are the safety mechanism.",
    good: "ZYRAXON has 11 modes, from read-only Plan and Explore to Beast, AUTO and APEX PREDATOR for unattended work.",
  },
  {
    title: "Memory that survives a restart",
    body: "Ask where memory lives and what happens when you close the app. Memory in a session variable is not memory. Look for durable storage — a database on disk — and a way to search it.",
    good: "ZYRAXON keeps a SQLite-backed memory that survives restarts and holds tens of thousands of entries.",
  },
  {
    title: "A provider you choose",
    body: "The model behind the agent decides its cost and its ceiling. An agent that only works with one vendor is that vendor's agent. An agent with a configurable OpenAI-compatible base URL can be pointed anywhere, including at a self-hosted endpoint.",
    good: "ZYRAXON routes 25+ providers behind one interface, and the ZYRAXON provider itself is a free OpenAI-compatible endpoint.",
  },
  {
    title: "Privacy you can describe",
    body: "Understand what leaves the machine. A local agent with your own keys sends only the turns you send. A hosted agent sends what the vendor decides. If you cannot say which, that is the answer.",
    good: "ZYRAXON runs locally: your files stay on disk, and you pick the provider and hold the key.",
  },
  {
    title: "It recovers by itself",
    body: "The test of an agent is what it does when a step fails. Does it stop and ask, or read the error and try again? Self-healing — installing a missing tool, retrying a different way — is what makes unattended work possible.",
    good: "ZYRAXON installs missing tools at runtime, retries failed steps and builds its own tools when it notices a repeated need.",
  },
];

const COMPARISON: string[][] = [
  ["Answers questions", "Yes", "Yes"],
  ["Reads your files", "Sometimes", "Yes"],
  ["Writes and edits code", "Rarely", "Yes"],
  ["Runs commands and tests", "No", "Yes"],
  ["Uses your own API key", "Sometimes", "Yes"],
  ["Remembers across sessions", "Rarely", "Yes"],
  ["Works unattended for long runs", "No", "Yes"],
  ["Runs on your machine", "No", "Yes"],
];

function GuidePage() {
  return (
    <PageShell>
      <PageHeader
        label="Guide"
        title="How to choose a desktop AI agent"
        description="A chat assistant answers. An agent acts. This guide is about the second kind: what to check before you commit, and where the differences actually show up once you are using one every day."
      >
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <ButtonAnchor href="/download/zyraxon-agent" variant="primary" external={false}>
            Try ZYRAXON AI
          </ButtonAnchor>
          <ButtonAnchor href="/docs/getting-started" external={false}>
            Read the docs
          </ButtonAnchor>
          <Tag tone="primary">888 tools</Tag>
          <Tag tone="primary">11 agent modes</Tag>
          <Tag tone="success">Free</Tag>
        </div>
      </PageHeader>

      <Section
        label="The distinction"
        title="An assistant answers. An agent acts."
        description="The line between the two is not the model behind it — it is what the software is allowed to do with the answer."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">What a chat assistant does</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              You describe a problem, it describes a solution. You copy the code out, paste it into
              your editor, run it, hit an error, describe the error, and repeat. The model is
              capable; the loop is manual, and you are the loop.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">What an agent does</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              It opens the files itself, makes the edit, runs the tests, reads the failure, fixes it
              and runs them again — then tells you what changed. You review the result instead of
              performing the loop.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        label="Checklist"
        title="Six things worth checking before you choose"
        description="Each of these separates a demo from something you will still be using in a month."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {CHECKLIST.map((item, index) => (
            <Card key={item.title} className="p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/12 font-mono text-[12px] font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                  <p className="mt-2.5 border-l-2 border-primary/40 pl-3 text-[12.5px] leading-relaxed text-foreground">
                    {item.good}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        label="Side by side"
        title="Assistant or agent"
        description="A blunt summary of where the two kinds of tool differ."
      >
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="px-5 py-3 font-semibold text-foreground">Capability</th>
                  <th className="px-5 py-3 font-semibold text-muted-foreground">Chat assistant</th>
                  <th className="px-5 py-3 font-semibold text-primary">Desktop agent</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([label, chat, agent]) => (
                  <tr key={label} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-2.5 text-foreground">{label}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{chat}</td>
                    <td className="px-5 py-2.5 font-medium text-foreground">{agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section
        label="Where ZYRAXON fits"
        title="What ZYRAXON AI is"
        description="It is the second column. A free, source-available desktop agent for Windows, macOS and Linux."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">888 tools</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Across 63 categories: shell, git, files, databases, browsers, media, screen vision and
              224 real control systems.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">11 agent modes</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              From read-only Plan and Explore to Beast, AUTO and APEX PREDATOR for work that must
              finish without you.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Any provider</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              25+ providers behind one interface, plus a free OpenAI-compatible endpoint you can
              point any client at.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Free and source-available</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Licensed under ZSL-X. Free to use and modify; premium tiers add capacity and tools.
            </p>
          </Card>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonAnchor href="/download/zyraxon-agent" variant="primary" external={false}>
            Download for desktop
          </ButtonAnchor>
          <ButtonAnchor href="/providers" external={false}>
            Use the provider API
          </ButtonAnchor>
          <ButtonAnchor href="/docs/agent-modes" external={false}>
            See the agent modes
          </ButtonAnchor>
        </div>
      </Section>

      <Section
        label="Questions"
        title="Common questions"
        description="The things people ask before they commit."
      >
        <div className="space-y-4">
          {[
            [
              "Is a desktop AI agent better than a hosted one?",
              "Not automatically. A desktop agent is better when your work lives on your machine — your files, your keys, your data staying put. A hosted agent is better when the work is remote and you want nothing installed. Many people use both.",
            ],
            [
              "Do I need a paid model to get useful work out of it?",
              "No. ZYRAXON's own provider is free and serves ten models over one OpenAI-compatible endpoint. A paid model helps on the hardest reasoning, but ordinary building, fixing and running works on the free line.",
            ],
            [
              "What does it cost?",
              "ZYRAXON AI itself is free. You pay only for whatever model provider you choose, and you can choose a free one.",
            ],
            [
              "How do I start?",
              "Download the installer for your platform and run it. There is nothing to configure to get a first result; the docs cover the rest if you want to point it at your own provider.",
            ],
          ].map(([q, a]) => (
            <Card key={q} className="p-5">
              <h3 className="text-[14px] font-semibold text-foreground">{q}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{a}</p>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
