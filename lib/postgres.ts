import { Pool } from 'pg';

export const dbid = process.env.SUPABASE_URL.replace("https://", '').replace(".supabase.co", '');
export const pool = new Pool({
    user: `postgres.${dbid}`,
    password: process.env.SUPABASE_PASSWORD,
    database: "postgres",
    host: "aws-0-eu-central-1.pooler.supabase.com",
}); 
