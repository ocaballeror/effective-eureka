import { getStore } from '@netlify/blobs';

import { fetchLinkedin } from './linkedin';
import { pool } from './postgres';


export type Job = {
    id: number;
    title: string;
    company: string;
    locations: string[];
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
    locations: string[];
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
    const offset = page * limit;
    const values: any[] = [profile];
    let where = `WHERE valid = true AND mode = $1 AND ignored = false AND (stale = false OR applied = true)`;

    if (viewedState === 1) where += ` AND viewed = false`;
    else if (viewedState === 2) where += ` AND viewed = true`;

    if (appliedState === 1) where += ` AND applied = false`;
    else if (appliedState === 2) where += ` AND applied = true`;

    if (locationState !== 'all') {
        values.push(`%${locationState}%`);
        where += ` AND array_to_string(locations, ' ') ILIKE $${values.length}`;
    }

    if (search) {
        values.push(`%${search}%`);
        where += ` AND (title ILIKE $${values.length} OR company ILIKE $${values.length} OR description ILIKE $${values.length} OR EXISTS (SELECT 1 FROM unnest(locations) l WHERE l ILIKE $${values.length}))`;
    }

    values.push(limit, offset);
    const sql = `
        SELECT id, title, company, locations, applied, viewed, logo
        FROM jobs
        ${where}
        ORDER BY created DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}
    `;

    const { rows } = await pool.query(sql, values);

    const countSql = `SELECT COUNT(*) FROM jobs ${where}`;
    const { rows: countRows } = await pool.query(countSql, values.slice(0, values.length - 2));
    const total = parseInt(countRows[0].count, 10);

    return {
        items: rows,
        total,
        hasMore: (page + 1) * limit < total
    };
}

export async function viewJob(id: string): Promise<Job | undefined> {
    const { rows } = await pool.query('select * from jobs where id = $1', [id]);
    if (!rows) {
        console.log(`Job doesn't exist: ${id}`);
        return;
    }

    toggle('viewed', id, true);

    const record = rows[0];
    const job = {
        ...record,
        "html": record.html || record.description,
        "description": "",
        "created": new Date(record.created),
        "updated": new Date(record.updated),
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
    await pool.query(`update jobs set ${key} = $1, updated = now() where id = $2`, [shouldHave, id]);
}

export const ignoreJob = (id: string) => toggle('ignored', id, true)
export const unviewJob = (id: string) => toggle('viewed', id, false)
export const applyJob = (id: string) => toggle('applied', id, true)
export const unapplyJob = (id: string) => toggle('applied', id, false)
