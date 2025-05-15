import { readJobs } from '../lib/jobs';
import { Config } from "@netlify/functions";
import sanitizeHtml from 'sanitize-html';

export default async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    const jobs = await readJobs(url.searchParams.get('profile'));
    jobs.forEach(job => {
        job.html = job.html ? sanitizeHtml(job.html) : job.description ? job.description : '';
    });
    return new Response(JSON.stringify(jobs), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export const config: Config = {
    path: "/api/job",
    method: "GET",
};
