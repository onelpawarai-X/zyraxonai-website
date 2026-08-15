import { createFileRoute } from "@tanstack/react-router";
import { GitHubHomeAuth } from "../components/home/GitHubHomeAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        name: "description",
        content:
          "The most powerful free & open-source desktop AI coding agent. 50+ tools, Beast Mode, Screen Vision, Unlimited Memory.",
      },
      { property: "og:title", content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        property: "og:description",
        content: "The most powerful free & open-source desktop AI coding agent. 50+ tools, Beast Mode, Screen Vision, Unlimited Memory.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main style={{ minHeight: "100vh", height: "100vh", display: "flex", flexDirection: "column", background: "#06060e", overflow: "hidden" }}>
      <GitHubHomeAuth />
      <iframe
        title="ZYRAXON AI"
        src="/zyraxon.html"
        style={{ display: "block", width: "100%", flex: "1 1 auto", minHeight: 0, border: 0 }}
      />
    </main>
  );
}
