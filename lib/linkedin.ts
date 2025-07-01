import { supabase } from './supabase';

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
    const { data, error } = await supabase.storage.from('bucket').download('cookies.json');
    if (!data || error) {
        throw new Error(JSON.stringify(error));
    }

    return JSON.parse(await data.text());
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
