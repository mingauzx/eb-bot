import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true})){if(f.name.startsWith('.')||f.name==='node_modules')continue;const p=dir+'/'+f.name;if(f.isDirectory())walk(p);else if(p.endsWith('.js'))execFileSync(process.execPath,['--check',p],{stdio:'inherit'});}}
walk('.');console.log('Sintaxe verificada.');

import {readFileSync} from 'node:fs';
if(readFileSync('lib/config.js','utf8')!==readFileSync('public/config.js','utf8'))throw new Error('Configurações compartilhadas divergiram.');
