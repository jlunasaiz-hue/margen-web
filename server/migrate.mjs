import {SqliteSwitchRepository} from './sqlite-repository.mjs';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const file=process.env.MARGEN_SWITCH_DB;
if(!file)throw Error('Configura MARGEN_SWITCH_DB con una ruta privada fuera del código publicado.');
mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new SqliteSwitchRepository(file);try{db.migrate();console.log('Esquema de tramitación creado. No se han importado suministros ni contratos.');}finally{db.close();}
