import { readJobs } from '../lib/jobs';
import { Config } from "@netlify/functions";
import sanitizeHtml from 'sanitize-html';

export default async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';

    const jobs = await readJobs(url.searchParams.get('profile'), page, limit, search);
    jobs.items.forEach(job => {
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
