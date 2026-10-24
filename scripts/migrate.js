import {db} from '../lib/db.js';
try {
 await db().query(`CREATE TABLE IF NOT EXISTS welcome_settings(guild_id TEXT PRIMARY KEY,config JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS request_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL);`);
 console.log('Banco preparado.');
} finally {await db().end();}
