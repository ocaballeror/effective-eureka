import fs from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';

export type Job = {
    id: number;
    title: string;
    company: string;
    location: string;
    description?: string;
    html?: string;
    link?: string;
};

const DATA = path.resolve('./data/jobs.json');

async function withIgnoredJobs(
    callback: ((ignored: Job[]) => void | Promise<void>) | void
): Promise<Job[]> {
    const store = getStore('jobs');

    const ignored = (await store.get('ignored-jobs', { type: 'json' })) || [];
    if (ignored.length) console.log("Retrieved " + ignored.length + " ignored jobs");
    else console.log("New list of ignored jobs");

    if (callback) {
        await callback(ignored);

        console.log("Updating list with " + ignored.length + " ignored jobs");
        await store.setJSON('ignored-jobs', ignored);
    }

    return ignored;
}

export async function readJobs(): Promise<Job[]> {
    const jobs: Job[] = JSON.parse(fs.readFileSync(DATA, 'utf8'));

    const ignored = await withIgnoredJobs();
    return jobs.filter(item1 => !ignored.some(item2 => item2.id == item1.id));
}

export async function ignoreJob(jobId: number): Promise<void> {
    console.log("Ignoring job " + jobId);
    const allJobs: Job[] = JSON.parse(fs.readFileSync(DATA, 'utf8'));

    await withIgnoredJobs(async (ignored) => {
        if (!ignored.some(item => item.id == jobId)) {
            const job = allJobs.find(j => j.id == jobId);
            job ? ignored.push(job) : console.log("Cannot find job");
        }
        else console.log("Job already ignored");
    });
}
