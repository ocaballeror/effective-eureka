import { viewJob } from '../lib/jobs';
import { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context): Promise<Response> => {
    await viewJob(context.params.id);
    return new Response(JSON.stringify({ active: 'OK' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export const config: Config = {
    path: "/api/job/:id/view",
    method: "GET",
};
