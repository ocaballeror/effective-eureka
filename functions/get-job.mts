import { Config, Context } from "@netlify/functions";
import { viewJob } from '../lib/jobs';


export default async (req: Request, context: Context): Promise<Response> => {
    const job = await viewJob(context.params.id);
    if (!job) {
        return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });
    }
    return new Response(JSON.stringify(job), {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const config: Config = {
    path: "/api/job/:id",
    method: "GET",
}; 
