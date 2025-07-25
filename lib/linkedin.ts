import { getStore } from '@netlify/blobs';
import { dbid } from './postgres';

type Cookie = {
    name: string;
    value: string;
    path: string;
    domain: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: boolean;
    expiry: number;
}

function buildAuth(raw_cookies: Cookie[]) {
    const cookies = raw_cookies
        .filter(c => c.domain?.includes('linkedin.com'))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

    // The CSRF token is literally JSESSIONID minus the quote marks
    const jsession = raw_cookies.find(c => c.name === 'JSESSIONID')?.value ?? '';
    const csrf = jsession.replace(/"/g, '');

    return { cookies, csrf };
}

async function getCookies(): Promise<Cookie[]> {
    const store = getStore('cache');
    const cookies = await store.get('cookies', { type: 'json' });
    if (cookies) return cookies;

    const data = await fetch(`https://${dbid}.supabase.co/storage/v1/object/public/bucket/cookies.json`)
    // const { data, error } = await supabase.storage.from('bucket').download('cookies.json');
    // if (!data || error) {
    //     throw new Error(JSON.stringify(error));
    // }

    const newcookies = JSON.parse(await data.text());
    await store.setJSON('cookies', newcookies);
    return newcookies;
}

export async function fetchLinkedin(url: string, method: string = 'GET'): Promise<any> {
    const { cookies, csrf } = buildAuth(await getCookies());
    const res = await fetch("https://www.linkedin.com/voyager/api" + url, {
        method: method,
        headers: { 'cookie': cookies, 'csrf-token': csrf }
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}
