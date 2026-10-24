import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import handler from './api/index.js';
const paths={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/api/'))return handler(req,res);
 if(!paths[path]){res.writeHead(404);return res.end();}
 try{const file=await readFile(new URL('./public/'+paths[path],import.meta.url));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(file);}
 catch{res.writeHead(500);res.end('Arquivo indisponível.');}
}).listen(process.env.PORT||3000,()=>console.log('Painel em http://localhost:'+(process.env.PORT||3000)));
