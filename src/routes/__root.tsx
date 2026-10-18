import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import HelpAgent from "../components/HelpAgent";
import { ThemeProvider, themeInitScript } from "../lib/theme";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--plane)] px-4">
      <div className="zx-sheet w-full max-w-md px-8 py-10 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
          Error 404
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight text-foreground">Not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="zx-chip zx-sheen mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--plane)] px-4">
      <div className="zx-sheet w-full max-w-md px-8 py-10 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
          Something broke
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Something went wrong on our end. Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="zx-chip inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
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
      { name: "google-site-verification", content: "6Jtjtw5XD-55BulMN295zZTRKlS3H9DEePsIaJ2N-6c" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        name: "description",
        content:
          "The World's Most Advanced Desktop AI Agent. 805 tools across 63 categories, 10 agent modes, Screen Vision, Eternal Memory.",
      },
      { name: "author", content: "ZYRAXON AI" },
      {
        property: "og:title",
        content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible.",
      },
      {
        property: "og:description",
        content:
          "The World's Most Advanced Desktop AI Agent. 805 tools across 63 categories, 10 agent modes, Screen Vision, Eternal Memory.",
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
          "The World's Most Advanced Desktop AI Agent. 805 tools across 63 categories, 10 agent modes, Screen Vision, Eternal Memory.",
      },
      {
        property: "og:image",
        content: "https://zyraxonai.lovable.app/zyraxon-logo.png",
      },
      {
        name: "twitter:image",
        content: "https://zyraxonai.lovable.app/zyraxon-logo.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/zyraxon-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <HelpAgent />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
