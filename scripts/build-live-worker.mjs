import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--assets'||args[2]!=='--output')throw Error('Use --assets <source-directory> --output <worker/index.js>');
const root=resolve(args[1]),output=resolve(args[3]);
const sw=readFileSync(resolve(root,'sw.js'),'utf8');const match=sw.match(/const FILES=(\[[^;]*\]);/);if(!match)throw Error('Lista de recursos sin conexión no encontrada.');
const names=[...JSON.parse(match[1].replaceAll("'",'"')),'sw.js','vendor/xlsx.LICENSE'];
const types={html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',LICENSE:'text/plain; charset=utf-8'};
const assets={};for(const name of names){if(name.includes('..')||name.startsWith('/'))throw Error('Ruta de recurso no válida.');const bytes=readFileSync(resolve(root,name)),ext=name.split('.').pop(),binary=ext==='png';assets[name]={body:bytes.toString(binary?'base64':'utf8'),binary,type:types[ext]||'text/plain; charset=utf-8',hash:createHash('sha256').update(bytes).digest('hex')};}
const core=readFileSync(new URL('../server/live-worker.mjs',import.meta.url),'utf8');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,core+'\nconst ASSETS='+JSON.stringify(assets)+';\nexport default createLiveWorker(ASSETS);\n');console.log('Worker preparado con '+names.length+' recursos locales.');
