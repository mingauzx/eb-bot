import pg from 'pg';
let pool;
export function db() {
 if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
 return pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:8000});
}
export async function getConfig(guild) {
 const {rows}=await db().query('SELECT config FROM welcome_settings WHERE guild_id=$1',[guild]);
 return rows[0]?.config;
}
export async function saveConfig(guild,config) {
 await db().query('INSERT INTO welcome_settings(guild_id,config) VALUES($1,$2) ON CONFLICT(guild_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()',[guild,config]);
}
export async function limit(key,max,seconds) {
 const {rows}=await db().query(`INSERT INTO request_limits(key,hits,expires_at) VALUES($1,1,NOW()+$2*INTERVAL '1 second')
 ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN request_limits.expires_at<NOW() THEN 1 ELSE request_limits.hits+1 END,
 expires_at=CASE WHEN request_limits.expires_at<NOW() THEN EXCLUDED.expires_at ELSE request_limits.expires_at END RETURNING hits`,[key,seconds]);
 return rows[0].hits<=max;
}
