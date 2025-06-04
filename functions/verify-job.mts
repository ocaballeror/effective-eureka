import { verifyJob } from '../lib/jobs';
import { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context): Promise<Response> => {
    const active = await verifyJob(context.params.id);
    return new Response(JSON.stringify({ active: active }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export const config: Config = {
    path: "/api/job/:id/verify",
    method: "GET",
};
