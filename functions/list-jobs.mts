import { listJobs } from '../lib/jobs';
import { Config } from "@netlify/functions";

export default async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const viewedState = parseInt(url.searchParams.get('viewed') || '0');
    const appliedState = parseInt(url.searchParams.get('applied') || '0');
    const locationState = url.searchParams.get('location') || 'all';
    const profile = url.searchParams.get('profile') || 'pm';

    const jobs = await listJobs(profile, page, limit, search, viewedState, appliedState, locationState);
    return new Response(JSON.stringify(jobs), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export const config: Config = {
    path: "/api/job",
    method: "GET",
};
