import path from 'path';
import { getStore } from '@netlify/blobs';
import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';

import { Database, Tables } from './database.types';

const supabase = createClient<Database>(
    process.env.SUPABASE_DATABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

export type Job = {
    id: number;
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


export async function readJobs(profile: string): Promise<Job[]> {
    const [ignored, viewed, applied] = await Promise.all([
        manageList('ignored'), manageList('viewed'), manageList('applied')
    ]);

    const { data, error } = await supabase
        .from('jobs')
        .select()
        .eq('valid', true)
        .eq('mode', profile);

    if (error) throw new Error(JSON.stringify(error)); 

    const jobs = (data as Tables<'jobs'>[])
        .filter(job => !ignored.hasOwnProperty(job.id) && job.mode == profile)
        .map(job => ({
            ...job,
            "html": job.html || job.description,
            "description": "",
            "viewed": job.id in viewed,
            "applied": job.id in applied,
            "created": new Date(job.created),
            "updated": new Date(job.updated),
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
    const store = getStore('jobs');
    const data = (await store.get(key, { type: 'json' })) || {};
    console.log(`Found ${Object.keys(data).length} jobs at ${key}`)
    if (callback) {
        await callback(data);
        console.log(`Updating list ${key} with ${Object.keys(data).length} items`);
        await store.setJSON(key, data);
    }

    return data;
}

export async function verifyJob(id: string): Promise<boolean | null | undefined> {
    const { data } = await supabase.from('jobs').select().eq('id', id as any).maybeSingle();
    if (!data) {
        console.log(`Asked to verify a job that doesn't exist: ${id}`);
        return;
    }

    const verified = await manageList('verified', async (items: Record<string, Validity>) => {
        const now = Date.now();
        const record = items[id] || { valid: null, when: 0 };

        if (record.when + 60000 < now) {
            try {
                const resp = await fetch(data.link);
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
