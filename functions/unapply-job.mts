import { unapplyJob } from '../lib/jobs';
import { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context): Promise<Response> => {
    await unapplyJob(context.params.id);
    return new Response(null, { status: 200 });
}

export const config: Config = {
    path: "/api/job/:id/unapply",
    method: "GET",
};
