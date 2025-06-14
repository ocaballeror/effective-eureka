import { readJobs } from '../lib/jobs';
import { Config } from "@netlify/functions";
import sanitizeHtml from 'sanitize-html';

export default async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const viewedState = parseInt(url.searchParams.get('viewed') || '0');
    const appliedState = parseInt(url.searchParams.get('applied') || '0');
    const locationState = url.searchParams.get('location') || 'all';
    const profile = url.searchParams.get('profile') || 'pm';

    const jobs = await readJobs(profile, page, limit, search, viewedState, appliedState, locationState);
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
