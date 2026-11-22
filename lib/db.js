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

let embedSchema;
function ensureEmbedSchema(){
 return embedSchema ||= db().query(`CREATE TABLE IF NOT EXISTS saved_embeds (
  id UUID PRIMARY KEY, guild_id TEXT NOT NULL, config JSONB NOT NULL,
  message_id TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 )`).catch(error=>{embedSchema=undefined;throw error;});
}
export async function listSavedEmbeds(guild){
 await ensureEmbedSchema();
 const {rows}=await db().query('SELECT id,config,message_id FROM saved_embeds WHERE guild_id=$1 ORDER BY updated_at DESC',[guild]);
 return rows;
}
export async function writeSavedEmbed(guild,id,config,send){
 await ensureEmbedSchema();
 const client=await db().connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
  const {rows:[old]}=await client.query('SELECT * FROM saved_embeds WHERE id=$1 AND guild_id=$2',[id,guild]);
  if(old?.message_id && (old.config.channelId!==config.channelId || old.config.format!==config.format)){
   throw Object.assign(new Error('Canal e formato de uma mensagem publicada são fixos. Crie outra embed para alterá-los.'),{status:409});
  }
  const messageId=send ? await send(old?.message_id) : old?.message_id??null;
  await client.query(`INSERT INTO saved_embeds(id,guild_id,config,message_id) VALUES($1,$2,$3,$4)
   ON CONFLICT(id) DO UPDATE SET config=EXCLUDED.config,message_id=EXCLUDED.message_id,updated_at=NOW()
   WHERE saved_embeds.guild_id=EXCLUDED.guild_id RETURNING id`,[id,guild,config,messageId]).then(result=>{
    if(!result.rowCount)throw Object.assign(new Error('Identificador indisponível.'),{status:409});
   });
  await client.query('COMMIT');
  return {id,config,message_id:messageId};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
