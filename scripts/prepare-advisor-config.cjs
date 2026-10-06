'use strict';
const fs=require('fs'),path=require('path');
const defaults=require('../斯诺德跑团/advisor-service.js');
function validate(value){
 let u;try{u=new URL(String(value||'').trim());}catch(_){throw new Error('Invalid public advisor service configuration');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new Error('Advisor production service requires a public HTTPS base URL');
 return u.href.replace(/\/+$/,'');
}
function loadConfig(value=process.env.ADVISOR_API_BASE){
 const fallback=validate(defaults.baseUrl);
 return {version:1,baseUrl:validate(value||fallback),fallbackBaseUrl:fallback};
}
function browserSource(config){
 const json=JSON.stringify(config).replace(/</g,'\\u003c');
 return '// Public connection information only. API credentials stay on the server.\n'+
  '(function(root){var config='+json+';if(typeof module==="object"&&module.exports)module.exports=config;if(root)root.SnowdAdvisorService=config;})(typeof window==="object"?window:null);\n';
}
module.exports={validate,loadConfig,browserSource};
if(require.main===module){
 const root=path.resolve(__dirname,'..'),dest=path.resolve(root,process.argv[2]||'');
 if(!process.argv[2]||!dest.startsWith(root+path.sep))throw new Error('Choose a generated deployment file inside the repository');
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,browserSource(loadConfig()),'utf8');
 console.log('Prepared public advisor service configuration');
}
