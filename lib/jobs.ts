import fs from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';

export type Job = {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    html: string;
    link: string;
    created: Date;
    updated: Date;
    viewed?: boolean;
};

const DATA = path.resolve('./data/jobs.json');


async function manageList<T>(
    key: string,
    callback?: (items: T[]) => void | Promise<void>
): Promise<T[]> {
    const store = getStore('jobs');

    const data = ((await store.get(key, { type: 'json' })) || []) as T[];
    if (callback) {
        await callback(data);
        console.log(`Updating list ${key} with ${data.length} items`);
        await store.setJSON(key, data);
    }

    return data;
}


export async function readJobs(): Promise<Job[]> {
    const baseJobs: Job[] = JSON.parse(fs.readFileSync(DATA, 'utf8'));

    const ignored = await manageList<Job>('ignored-jobs');
    const viewed = await manageList<string>('viewed');
    const applied = await manageList<string>('applied');

    const jobs = baseJobs
        .filter(item1 => !ignored.some(item2 => item2.id == item1.id))
        .map(item => ({
            "viewed": viewed.includes(item.id),
            "applied": applied.includes(item.id),
            ...item,
            "created": new Date(item.created),
            "updated": new Date(item.updated),
        }))
        .sort((a, b) => b.created.getTime() - a.created.getTime());

    return jobs;
}

export async function ignoreJob(jobId: string): Promise<void> {
    console.log("Ignoring job " + jobId);
    const allJobs: Job[] = JSON.parse(fs.readFileSync(DATA, 'utf8'));

    await manageList<Job>('ignored-jobs', async (ignored) => {
        if (!ignored.some(item => item.id == jobId)) {
            const job = allJobs.find(j => j.id == jobId);
            job ? ignored.push(job) : console.log("Cannot find job");
        }
        else console.log("Job already ignored");
    });
}


export async function viewJob(jobId: string): Promise<void> {
    console.log("View job " + jobId);
    await manageList<string>('viewed', async (viewed) => {
        if (!viewed.includes(jobId)) {
            console.log("Mark job as viewed " + jobId);
            viewed.push(jobId);
        }
    })
}

export async function unviewJob(jobId: string): Promise<void> {
    console.log("Unview job " + jobId);
    await manageList<string>('viewed', async (viewed) => {
        if (viewed.includes(jobId)) {
            viewed.splice(viewed.indexOf(jobId), 1);
            console.log("Mark job as unviewed " + jobId);
        }
    })
}

export async function applyJob(jobId: string): Promise<void> {
    console.log("Apply job " + jobId);
    await manageList<string>('applied', async (applied) => {
        if (!applied.includes(jobId)) {
            console.log("Mark job as applied " + jobId);
            applied.push(jobId);
        }
    })
}

export async function unapplyJob(jobId: string): Promise<void> {
    console.log("Unapply job " + jobId);
    await manageList<string>('applied', async (applied) => {
        if (applied.includes(jobId)) {
            applied.splice(applied.indexOf(jobId), 1);
            console.log("Mark job as unapplied " + jobId);
        }
    })
}
