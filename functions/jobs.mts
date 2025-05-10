import { readJobs, ignoreJob } from '../lib/jobs';

export default async function handler(req: Request): Promise<Response> {
    if (req.method === 'GET') {
        const jobs = (await readJobs()).map((job, i) => ({ id: i, ...job }));

        return new Response(JSON.stringify(jobs), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (req.method === 'DELETE') {
        const url = new URL(req.url);
        const match = url.pathname.match(/.*\/(\d+)$/);
        const idParam = match?.[1];

        if (!idParam) {
            return new Response('Missing job ID', { status: 400 });
        }

        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
            return new Response('Invalid job ID', { status: 400 });
        }

        await ignoreJob(id);
        return new Response("Job deleted", { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 });
}
