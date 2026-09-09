import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type GenerateRequest = {
  model: string;
  prompt: string;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    negative_prompt?: string;
    width?: number;
    height?: number;
    num_inference_steps?: number;
  };
  type?: "text" | "image" | "audio";
};

async function runHFApiInference(
  model: string,
  inputs: string | object,
  parameters?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs, parameters }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HuggingFace API ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  if (contentType.includes("image/")) {
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { type: "image", contentType, base64 };
  }
  if (contentType.includes("audio/")) {
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { type: "audio", contentType, base64 };
  }

  return await res.text();
}

export const Route = createFileRoute("/api/public/nebula/generate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body: GenerateRequest = await request.json();
          const { model, prompt, parameters, type = "text" } = body;

          if (!model || !prompt) {
            return Response.json(
              { error: "Missing model or prompt" },
              { status: 400, headers: CORS },
            );
          }

          let result: unknown;

          if (type === "image") {
            result = await runHFApiInference(
              model,
              prompt,
              {
                negative_prompt:
                  parameters?.negative_prompt || "blurry, bad quality",
                width: parameters?.width || 512,
                height: parameters?.height || 512,
                num_inference_steps:
                  parameters?.num_inference_steps || 20,
              },
            );
          } else if (type === "audio") {
            result = await runHFApiInference(model, prompt, parameters);
          } else {
            result = await runHFApiInference(
              model,
              prompt,
              {
                max_new_tokens: parameters?.max_new_tokens || 512,
                temperature: parameters?.temperature || 0.7,
                top_p: parameters?.top_p || 0.95,
              },
            );
          }

          return Response.json(
            { success: true, result },
            { headers: CORS },
          );
        } catch (err) {
          return Response.json(
            { success: false, error: String(err) },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
