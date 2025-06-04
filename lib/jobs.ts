import path from 'path';
import { getStore } from '@netlify/blobs';
import { promises as fs } from 'fs';

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
    viewed: boolean;
    stale: boolean;
    mode: string;
};

const DATA = path.resolve('./data/jobs.json');
const baseJobs: Job[] = JSON.parse(
    await fs.readFile(DATA, 'utf8'),
    (key, value) => (key == 'created' || key == 'updated') ? new Date(value) : value
);


async function manageList<T>(
    key: string,
    callback?: (items: T[]) => void | Promise<void>
): Promise<T[]> {
    const store = getStore('jobs');
    const data = ((await store.get(key, { type: 'json' })) || []) as T[];
    console.log(`Found ${data.length} jobs at ${key}`)
    if (callback) {
        await callback(data);
        console.log(`Updating list ${key} with ${data.length} items`);
        await store.setJSON(key, data);
    }

    return data;
}

export async function readJobs(profile: string): Promise<Job[]> {
    const [ignored, viewed, applied] = await Promise.all([
        manageList('ignored'), manageList('viewed'), manageList('applied')
    ])

    const jobs = baseJobs
        .filter(job => !ignored.includes(job.id) && job.mode == profile)
        .map(job => ({
            ...job,
            "html": job.html? job.html : job.description,
            "description": "",
            "viewed": viewed.includes(job.id),
            "applied": applied.includes(job.id),
            "created": new Date(job.created),
            "updated": new Date(job.updated),
        }))
        .filter(job => !job.stale || job.applied)
        .sort((a, b) => b.created.getTime() - a.created.getTime());
    console.log(`Found ${jobs.length} jobs to display`);

    return jobs;
}


export async function verifyJob(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return true;
}


async function toggle(
    key: string,
    id: string,
    shouldHave: boolean
): Promise<void> {
    await manageList(key, items => {
        const has = items.includes(id)
        if (shouldHave && !has) items.push(id)
        if (!shouldHave && has) items.splice(items.indexOf(id), 1)
    })
}

export const ignoreJob = (id: string) => toggle('ignored', id, true)
export const viewJob = (id: string) => toggle('viewed', id, true)
export const unviewJob = (id: string) => toggle('viewed', id, false)
export const applyJob = (id: string) => toggle('applied', id, true)
export const unapplyJob = (id: string) => toggle('applied', id, false)
