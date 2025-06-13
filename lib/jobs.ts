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
    logo: string | null;
};


export async function readJobs(profile: string): Promise<Job[]> {
    const { data, error } = await supabase
        .from('jobs')
        .select()
        .eq('valid', true)
        .eq('mode', profile)
        .eq('ignored', false)
        .or('stale.eq.false, applied.eq.true')
        ;

    if (error) throw new Error(JSON.stringify(error)); 

    const jobs = (data as Tables<'jobs'>[])
        .map(job => ({
            ...job,
            "html": job.html || job.description,
            "description": "",
            "created": new Date(job.created),
            "updated": new Date(job.updated),
        }))
        .sort((a, b) => b.created.getTime() - a.created.getTime());
    console.log(`Found ${jobs.length} jobs to display`);

    return jobs;
}

export async function verifyJob(id: string): Promise<boolean | null | undefined> {
    const { data } = await supabase.from('jobs').select().eq('id', id as any).maybeSingle();
    if (!data) {
        console.log(`Asked to verify a job that doesn't exist: ${id}`);
        return;
    }

    const store = getStore('jobs');
    const items = (await store.get('verified', { type: 'json' })) || {};

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

    await store.setJSON('verified', items);

    return record.valid;
}


async function toggle(
    key: string,
    id: string,
    shouldHave: boolean
): Promise<void> {
    await supabase.from('jobs').update({ [key]: shouldHave }).eq('id', id as any);
}

export const ignoreJob = (id: string) => toggle('ignored', id, true)
export const viewJob = (id: string) => toggle('viewed', id, true)
export const unviewJob = (id: string) => toggle('viewed', id, false)
export const applyJob = (id: string) => toggle('applied', id, true)
export const unapplyJob = (id: string) => toggle('applied', id, false)
