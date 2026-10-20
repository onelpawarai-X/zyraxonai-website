import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import * as React from "react";
import { ThemeProvider } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="mx-auto max-w-md space-y-4">
        <span className="inline-block rounded-full border border-border/40 bg-muted/30 px-3 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          404 Not Found
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The requested page could not be found or has been moved.
        </p>
        <div className="pt-2">
          <a
            href="/"
            className="zx-chip inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "google-site-verification", content: "uzagX2DqipxT74MOT4dVhJNvojHGiOBY44B4qIYHVG0" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        name: "description",
        content:
          "The World's Most Advanced Desktop AI Agent. 888 tools across 63 categories, 11 agent modes, 108 MCP integrations, Screen Vision, Eternal Memory.",
      },
      { name: "author", content: "ZYRAXON AI" },
      {
        property: "og:title",
        content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible.",
      },
      {
        property: "og:description",
        content:
          "The World's Most Advanced Desktop AI Agent. 888 tools across 63 categories, 11 agent modes, 108 MCP integrations, Screen Vision, Eternal Memory.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@onelpawarai" },
      {
        name: "twitter:title",
        content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible.",
      },
      {
        name: "twitter:description",
        content:
          "The World's Most Advanced Desktop AI Agent. 888 tools across 63 categories, 11 agent modes, 108 MCP integrations, Screen Vision, Eternal Memory.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://zyraxonai.lovable.app" },
      { rel: "icon", href: "/favicon.png" },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "ZYRAXON AI Updates RSS Feed",
        href: "/updates/rss.xml",
      },
      {
        rel: "alternate",
        type: "application/feed+json",
        title: "ZYRAXON AI Updates JSON Feed",
        href: "/updates/feed.json",
      },
    ],
  }),
  notFoundComponent: NotFoundComponent,
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
