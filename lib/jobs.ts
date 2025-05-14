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


async function withIgnoredJobs(
    callback: ((ignored: Job[]) => void | Promise<void>) | void
): Promise<Job[]> {
    const store = getStore('jobs');

    const ignored = (await store.get('ignored-jobs', { type: 'json' })) || [];
    console.log("Retrieved " + ignored.length + " ignored jobs");

    if (callback) {
        await callback(ignored);

        console.log("Updating list with " + ignored.length + " ignored jobs");
        await store.setJSON('ignored-jobs', ignored);
    }

    return ignored;
}

async function withViewedJobs(
    callback: ((viewed: string[]) => void | Promise<void>) | void
): Promise<string[]> {
    const store = getStore('jobs');

    const viewed: string[] = ((await store.get('viewed', { type: 'json' })) || []).map((item: number | string) => item.toString());
    console.log("Retrieved " + viewed.length + " viewed jobs");

    if (callback) {
        await callback(viewed);

        console.log("Updating list with " + viewed.length + " viewed jobs");
        await store.setJSON('viewed', viewed);
    }

    return viewed;
}

async function withAppliedJobs(
    callback: ((viewed: string[]) => void | Promise<void>) | void
): Promise<string[]> {
    const store = getStore('jobs');

    const applied: string[] = ((await store.get('applied', { type: 'json' })) || []).map((item: number | string) => item.toString());
    console.log("Retrieved " + applied.length + " applied jobs");

    if (callback) {
        await callback(applied);

        console.log("Updating list with " + applied.length + " applied jobs");
        await store.setJSON('applied', applied);
    }

    return applied;
}

export async function readJobs(): Promise<Job[]> {
    const baseJobs: Job[] = JSON.parse(fs.readFileSync(DATA, 'utf8'));

    const ignored = await withIgnoredJobs();
    const viewed = await withViewedJobs();
    const applied = await withAppliedJobs();

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

    await withIgnoredJobs(async (ignored) => {
        if (!ignored.some(item => item.id == jobId)) {
            const job = allJobs.find(j => j.id == jobId);
            job ? ignored.push(job) : console.log("Cannot find job");
        }
        else console.log("Job already ignored");
    });
}


export async function viewJob(jobId: string): Promise<void> {
    console.log("View job " + jobId);
    await withViewedJobs(async (viewed) => {
        if (!viewed.includes(jobId)) {
            console.log("Mark job as viewed " + jobId);
            viewed.push(jobId);
        }
    })
}

export async function unviewJob(jobId: string): Promise<void> {
    console.log("Unview job " + jobId);
    await withViewedJobs(async (viewed) => {
        if (viewed.includes(jobId)) {
            viewed.splice(viewed.indexOf(jobId), 1);
            console.log("Mark job as unviewed " + jobId);
        }
    })
}

export async function applyJob(jobId: string): Promise<void> {
    console.log("Apply job " + jobId);
    await withAppliedJobs(async (applied) => {
        if (!applied.includes(jobId)) {
            console.log("Mark job as applied " + jobId);
            applied.push(jobId);
        }
    })
}

export async function unapplyJob(jobId: string): Promise<void> {
    console.log("Unapply job " + jobId);
    await withAppliedJobs(async (applied) => {
        if (applied.includes(jobId)) {
            applied.splice(applied.indexOf(jobId), 1);
            console.log("Mark job as unapplied " + jobId);
        }
    })
}
