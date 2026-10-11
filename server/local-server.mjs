import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {SqliteSwitchRepository} from './sqlite-repository.mjs';
import {createSwitchHandler} from './switch-api.mjs';
export function createLocalServer({handler}){
 return createServer(async(req,res)=>{
  try{
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"TOO_LARGE"}');return;}chunks.push(chunk);}
   const uri=new URL(req.url,'http://127.0.0.1');
   if(uri.hostname!=='127.0.0.1'){res.writeHead(400);res.end();return;}
   const request=new Request(uri,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"SERVER_ERROR"}');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.env.MARGEN_SWITCH_DB;if(!file)throw Error('Configura MARGEN_SWITCH_DB y ejecuta switch:migrate antes de iniciar.');
 const repository=new SqliteSwitchRepository(file),origin='http://127.0.0.1:3002';
 const handler=createSwitchHandler({repository,origin,contractingEnabled:false});const server=createLocalServer({handler});
 server.listen(3002,'127.0.0.1',()=>console.log('Servicio local de pruebas en 127.0.0.1:3002. Contratación deshabilitada.'));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{repository.close();process.exit(0)}));
}
