/** The endpoints doc page, generated from the endpoint catalogue.
 *
 *  Written as a generator rather than by hand so it cannot drift from the
 *  provider page: both read `src/lib/providers/endpoints.ts`, so adding an
 *  endpoint there adds it to the docs too, with the same URL, the same fields
 *  and the same snippet. Three hand-copied descriptions of one API was how this
 *  documentation became unreliable in the first place. */

import type { DocBlock, DocPage } from "./content";
import { ENDPOINTS, ENDPOINT_GROUPS, endpointUrl } from "@/lib/providers/endpoints";

function blocksForPage(): DocBlock[] {
  const blocks: DocBlock[] = [
    {
      t: "p",
      text: `Every endpoint the provider serves, grouped by what you are doing. There are ${ENDPOINTS.length} of them, and **none needs a key of any kind** — not a key to buy, not a key to paste. That is the point of the provider: nothing here can be switched off by someone else's billing decision.`,
    },
    {
      t: "note",
      kind: "success",
      title: "One list, three places",
      text: "This page, the provider page's endpoint catalogue, and the machine-readable `GET` on each endpoint are all generated from one file, `src/lib/providers/endpoints.ts`. If a URL here is wrong, it is wrong in exactly one place — and that place is the source of truth.",
    },
    { t: "h2", text: "How a call is shaped" },
    {
      t: "p",
      text: "Model endpoints are OpenAI-shaped, so an existing client works with a base-URL change. Speech endpoints are shaped for the job: text in and MP3 out, audio in and text out. Where an endpoint takes JSON, it takes JSON; where it takes bytes, it takes bytes.",
    },
    {
      t: "table",
      head: ["You want to", "Call", "Send"],
      rows: ENDPOINTS.map((e) => [
        `**${e.name}** — ${e.blurb.split(".")[0]}.`,
        `\`${e.method} ${e.path}\``,
        e.fields
          ? e.fields
              .filter((f) => f.required)
              .map((f) => `\`${f.name}\``)
              .join(", ") || "—"
          : "—",
      ]),
    },
  ];

  for (const group of ENDPOINT_GROUPS) {
    const endpoints = ENDPOINTS.filter((e) => e.group === group);
    if (endpoints.length === 0) continue;
    blocks.push({ t: "h2", text: group });
    for (const endpoint of endpoints) {
      blocks.push({ t: "h3", text: `${endpoint.method} ${endpoint.path}` });
      blocks.push({ t: "p", text: endpoint.blurb });
      blocks.push({ t: "p", text: `**Returns** ${endpoint.returns}` });
      if (endpoint.fields && endpoint.fields.length > 0) {
        blocks.push({
          t: "table",
          head: ["Field", "Required", "What it does"],
          rows: endpoint.fields.map((f) => [`\`${f.name}\``, f.required ? "yes" : "no", f.note]),
        });
      }
      const first = endpoint.snippets?.[0];
      if (first) {
        blocks.push({ t: "code", lang: first.lang, code: first.code });
      }
      if (endpoint.notes && endpoint.notes.length > 0) {
        blocks.push({ t: "list", items: endpoint.notes });
      }
    }
  }

  blocks.push({ t: "h2", text: "Errors, and what they mean" });
  blocks.push({
    t: "table",
    head: ["Status", "Means", "What to do"],
    rows: [
      [
        "`400`",
        "The request is malformed — a missing body, bad JSON, or an upload that is not audio.",
        "Read `error` in the response; it names the field.",
      ],
      [
        "`413`",
        "The upload is over 25 MiB.",
        "Split it, or use the live mode of `/api/public/stt`.",
      ],
      [
        "`422`",
        "A required field is missing — most often `language` on the speech endpoint.",
        "Send it. The endpoint does not guess.",
      ],
      [
        "`499`",
        "You disconnected while the transcript was being produced.",
        "Nothing; it is reported only so a log is complete.",
      ],
      [
        "`502`",
        "The speech or model engine refused the connection.",
        "Retry once; it is usually transient.",
      ],
    ],
  });

  blocks.push({ t: "h2", text: "Checking an endpoint is alive" });
  blocks.push({
    t: "p",
    text: "Every endpoint answers a plain `GET` with a description of itself, so you can confirm what is deployed without reading any documentation — including the one you are reading now.",
  });
  blocks.push({
    t: "code",
    lang: "shell",
    code: `# The speech endpoint describes its own contract
curl -s ${endpointUrl(ENDPOINTS.find((e) => e.id === "stt")!)} | jq '{modes, containers, limits}'

# The models the pool is serving right now
curl -s ${endpointUrl(ENDPOINTS.find((e) => e.id === "models")!)} | jq -r '.data[] | .id'

# Which voices exist, and how many
curl -s ${endpointUrl(ENDPOINTS.find((e) => e.id === "voices")!)} | jq '{count, languages: (.languages|length)}'`,
  });

  return blocks;
}

export const ENDPOINT_DOCS: DocPage[] = [
  {
    slug: "endpoints",
    title: "Endpoints",
    group: "ZYRAXON Provider",
    desc: `Every endpoint in one place — ${ENDPOINTS.length} of them, grouped by task, none needing a key. Chat, models, speech in, speech out, and the live transcription stream.`,
    blocks: blocksForPage(),
  },
];
