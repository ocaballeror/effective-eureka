import { getStore } from '@netlify/blobs';

import { Tables } from './database.types';
import { fetchLinkedin } from './linkedin';
import { supabase } from './supabase';


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

export type JobHeader = {
    id: number;
    title: string;
    company: string;
    location: string;
    applied: boolean;
    viewed: boolean;
    logo: string | null;
}

export type PaginatedJobs = {
    items: JobHeader[];
    total: number;
    hasMore: boolean;
};

export async function listJobs(
    profile: string,
    page: number = 0,
    limit: number = 20,
    search: string = '',
    viewedState: number = 0,
    appliedState: number = 0,
    locationState: string = 'all'
): Promise<PaginatedJobs> {
    let query = supabase
        .from('jobs')
        .select('id,title,company,location,applied,viewed,logo', { count: 'exact' })
        .eq('valid', true)
        .eq('mode', profile)
        .eq('ignored', false)
        .or('stale.eq.false, applied.eq.true')
        .order('created', { ascending: false });

    // Apply viewed filter
    if (viewedState === 1) {
        query = query.eq('viewed', false);
    } else if (viewedState === 2) {
        query = query.eq('viewed', true);
    }

    // Apply applied filter
    if (appliedState === 1) {
        query = query.eq('applied', false);
    } else if (appliedState === 2) {
        query = query.eq('applied', true);
    }

    // Apply location filter
    if (locationState !== 'all') {
        if (locationState === 'remote') {
            query = query.ilike('location', '%remote%');
        } else {
            query = query.ilike('location', `%${locationState}%`);
        }
    }

    // Apply search filter
    if (search) {
        query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,location.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query
        .range(page * limit, (page + 1) * limit - 1)
        .order('created', { ascending: false });

    if (error) throw new Error(JSON.stringify(error));

    const jobs = (data as Tables<'jobs'>[]);

    console.log(`Found ${jobs.length} jobs to display (page ${page})`);

    return {
        items: jobs,
        total: count || 0,
        hasMore: count ? (page + 1) * limit < count : false
    };
}

export async function viewJob(id: string): Promise<Job | undefined> {
    const { data } = await supabase.from('jobs').select().eq('id', id as any).maybeSingle();
    if (!data) {
        console.log(`Job doesn't exist: ${id}`);
        return;
    }

    toggle('viewed', id, true);

    const job = {
        ...data,
        "html": data.html || data.description,
        "description": "",
        "created": new Date(data.created),
        "updated": new Date(data.updated),
    };

    return job;
}

export async function verifyJob(jobid: string): Promise<boolean | null | undefined> {
    const store = getStore('jobs');
    const items = (await store.get('verified', { type: 'json' })) || {};

    const now = Date.now();
    const record = items[jobid] || { valid: null, when: 0 };

    if (record.valid === null || record.when + 60000 < now) {
        try {
            const body = await fetchLinkedin(`/graphql?variables=(cardSectionTypes:List(TOP_CARD),jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A${jobid},includeSecondaryActionsV2:true)&queryId=voyagerJobsDashJobPostingDetailSections.d5e26c6a0b129827c0cfd9d5a714c5e7`);
            const jobData = body.data.jobsDashJobPostingDetailSectionsByCardSectionTypes.elements[0];
            const jobState = jobData.jobPostingDetailSection[0].topCard.jobPosting.jobState;
            items[jobid] = {
                valid: jobState !== 'CLOSED',
                when: now
            };
        } catch (err) {
            console.log(`Error checking linkedin job: ${err}`);
            items[jobid] = record;
        }
    }

    if (record.valid !== null)
        await store.setJSON('verified', items);

    return items[jobid].valid;
}


async function toggle(
    key: string,
    id: string,
    shouldHave: boolean
): Promise<void> {
    await supabase.from('jobs').update({ [key]: shouldHave }).eq('id', id as any);
}

export const ignoreJob = (id: string) => toggle('ignored', id, true)
export const unviewJob = (id: string) => toggle('viewed', id, false)
export const applyJob = (id: string) => toggle('applied', id, true)
export const unapplyJob = (id: string) => toggle('applied', id, false)
