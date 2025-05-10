import { readJobs } from '../lib/jobs';
import { Config } from "@netlify/functions";

export default async (req: Request): Promise<Response> => {
    const jobs = await readJobs();
    return new Response(JSON.stringify(jobs), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export const config: Config = {
    path: "/api/job",
    method: "GET",
};
