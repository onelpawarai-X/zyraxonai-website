import { createFileRoute } from '@tanstack/react-router';
import { ZEN_FREE_MODELS } from '@/lib/builder/zen.server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export const Route = createFileRoute('/api/public/zyraxon/v1/models')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const created = Math.floor(Date.now() / 1000);
        return Response.json(
          {
            object: 'list',
            data: ZEN_FREE_MODELS.map((model) => ({
              id: model.id,
              object: 'model',
              created,
              owned_by: 'zyraxon',
              name: model.label,
              display_name: model.label,
              description: model.blurb,
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
