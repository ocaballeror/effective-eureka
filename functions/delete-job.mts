import { Config, Context } from "@netlify/functions";
import { ignoreJob } from '../lib/jobs';

export default async (req: Request, context: Context): Promise<Response> => {
    await ignoreJob(context.params.id);
    return new Response("Job deleted", { status: 200 });
}

export const config: Config = {
    path: "/api/job/:id",
    method: "DELETE",
};
