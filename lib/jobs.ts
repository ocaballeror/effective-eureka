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
    applied: boolean;
    viewed: boolean;
    stale: boolean;
    mode: string;
};

type Validity = {
    valid: boolean | null;
    when: number;
};


const DATA = path.resolve('./data/jobs.json');
const baseJobs: Job[] = JSON.parse(
    await fs.readFile(DATA, 'utf8'),
    (key, value) => (key == 'created' || key == 'updated') ? new Date(value) : value
);

async function migrate() {
    const store = getStore('jobs');
    await Promise.all(
        ['ignored', 'viewed', 'applied'].map(async key => {
            const data = await store.get(key, { type: 'json' });
            if (!Array.isArray(data)) return;

            console.log('Migrating blob key', key);
            await store.setJSON(key + '-old', data);
            await store.setJSON(key, data.reduce((acc, val) => ({ ...acc, [val]: true }), {}));
        })
    );
}


export async function readJobs(profile: string): Promise<Job[]> {
    const [ignored, viewed, applied] = await Promise.all([
        manageList('ignored'), manageList('viewed'), manageList('applied')
    ])

    const jobs = baseJobs
        .filter(job => !ignored.hasOwnProperty(job.id) && job.mode == profile)
        .map(job => ({
            ...job,
            "html": job.html || job.description,
            "description": "",
            "viewed": job.id in viewed,
            "applied": job.id in applied,
            // "created": new Date(job.created),
            // "updated": new Date(job.updated),
        }))
        .filter(job => !job.stale || job.applied)
        .sort((a, b) => b.created.getTime() - a.created.getTime());
    console.log(`Found ${jobs.length} jobs to display`);

    return jobs;
}

async function manageList<T>(
    key: string,
    callback?: (items: Record<string, T>) => void | Promise<void>
): Promise<Record<string, T>> {
    await migrate();
    const store = getStore('jobs');
    const data = (await store.get(key, { type: 'json' })) || {};
    console.log(`Found ${Object.keys(data).length} jobs at ${key}`)
    if (callback) {
        await callback(data);
        console.log(`Updating list ${key} with ${Object.keys(data).length} items: ${JSON.stringify(data)}`);
        await store.setJSON(key, data);
    }

    return data;
}

export async function verifyJob(id: string): Promise<boolean | null | undefined> {
    const job = baseJobs.find(j => j.id == id);
    if (!job) return;

    const verified = await manageList('verified', async (items: Record<string, Validity>) => {
        const now = Date.now();
        const record = items[id] || { valid: null, when: 0 };

        if (record.when + 60000 < now) {
            try {
                const resp = await fetch(job.link);
                const body = await resp.text();
                items[id] = {
                    valid: !body.includes('No longer accepting applications'),
                    when: now
                };
            } catch (err) {
                console.log(`Error checking linkedin job: ${err}`);
                items[id] = record;
            }
        }
    });

    return verified[id].valid;
}


async function toggle(
    key: string,
    id: string,
    shouldHave: boolean
): Promise<void> {
    await manageList(key, items => {
        const has = id in items;
        if (shouldHave && !has) items[id] = true;
        if (!shouldHave && has) delete items[id];
    });
}

export const ignoreJob = (id: string) => toggle('ignored', id, true)
export const viewJob = (id: string) => toggle('viewed', id, true)
export const unviewJob = (id: string) => toggle('viewed', id, false)
export const applyJob = (id: string) => toggle('applied', id, true)
export const unapplyJob = (id: string) => toggle('applied', id, false)
