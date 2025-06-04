import { applyJob } from '../lib/jobs';
import { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context): Promise<Response> => {
    await applyJob(context.params.id);
    return new Response(JSON.stringify({ status: 'OK' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export const config: Config = {
    path: "/api/job/:id/apply",
    method: "GET",
};
