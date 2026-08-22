import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

// Public ZYRAXON aliases. Provider IDs stay server-side and match the
// established PR #95 Console model mapping exactly.
const MODELS = [
  {
    id: "zyraxon-t10",
    label: "ZYRAXON T10",
    description: "MiMo-V2.5 Free · multimodal",
    upstream: "mimo-v2.5-free",
  },
  {
    id: "zyraxon-vector",
    label: "ZYRAXON VECTOR",
    description: "Big Pickle · fast autonomous building",
    upstream: "big-pickle",
  },
  {
    id: "zyraxon-phantom",
    label: "ZYRAXON PHANTOM",
    description: "Nemotron 3 Ultra Free · deep reasoning builder",
    upstream: "nemotron-3-ultra-free",
  },
] as const;

export const Route = createFileRoute("/api/public/zyraxon/v1/models")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const created = Math.floor(Date.now() / 1000);
        return Response.json(
          {
            object: "list",
            data: MODELS.map((model) => ({
              id: model.id,
              object: "model",
              created,
              owned_by: "zyraxon",
              name: model.label,
              display_name: model.label,
              description: model.description,
              permission: [],
              root: model.id,
              parent: null,
            })),
          },
          { headers: CORS },
        );
      },
    },
  },
});
