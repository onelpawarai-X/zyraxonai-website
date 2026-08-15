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
    <main style={{ minHeight: "100vh", background: "#06060e", overflow: "hidden" }}>
      <iframe
        title="ZYRAXON AI"
        src="/zyraxon.html"
        style={{ display: "block", width: "100%", height: "100vh", border: 0 }}
      />
      <GitHubHomeAuth />
    </main>
  );
}
