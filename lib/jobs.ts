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

async function retrieveIgnored(): Promise<Job[]> {
    const store = getStore('jobs');

    const ignored = await store.get('ignored-jobs', { type: 'json' });
    if(ignored) console.log("Retrieved " + ignored.length + " ignored jobs");
    else console.log("New list of ignored jobs");
    return ignored || [];
}

async function updateIgnored(ignored: Job[]): Promise<void> {
    const store = getStore('jobs');

    console.log("Updating list with " + ignored.length + " ignored jobs");
    await store.setJSON('ignored-jobs', ignored);
}

export async function readJobs(): Promise<Job[]> {
    const jobs: Job[] = JSON.parse(fs.readFileSync(DATA, 'utf8'));

    const ignored = await retrieveIgnored();
    return jobs.filter(item1 => !ignored.some(item2 => item2.id === item1.id));
}

export async function ignoreJob(jobId: number): Promise<void> {
    console.log("Ignoring job " + jobId);
    const ignored = await retrieveIgnored();
    const allJobs: Job[] = JSON.parse(fs.readFileSync(DATA, 'utf8'));

    if (!ignored.some(item => item.id == jobId)) {
        const job = allJobs.find(j => j.id == jobId);
        if (job) {
            ignored.push(job);
            await updateIgnored(ignored);
        } else
            console.log("Cannot find job");
    }
    else 
        console.log("Job already ignored");
}
