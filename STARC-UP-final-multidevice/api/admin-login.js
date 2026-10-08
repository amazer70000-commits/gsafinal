const crypto = require('crypto');
const {json}=require('./_shared');
const {issue}=require('./_auth');
function digest(s){return crypto.createHash('sha256').update(s).digest('hex');}
module.exports=async(req,res)=>{
  if(req.method!=='POST') return json(res,405,{ok:false,error:'POST required'});
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const u=String(body.username||'').trim(), p=String(body.password||'');
  const expectedUser=process.env.ADMIN_USERNAME || 'gsa';
  const expectedHash=process.env.ADMIN_PASSWORD_SHA256;
  if(!expectedHash) return json(res,503,{ok:false,error:'Admin authentication is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_SHA256 in Vercel Environment Variables.'});
  if(u!==expectedUser || digest(`${u}:${p}`)!==expectedHash) return json(res,401,{ok:false,error:'Access denied.'});
  // This session identifier is deliberately short-lived and is only a login acknowledgement;
  // shared event-state still requires the configured cloud store.
  return json(res,200,{ok:true,session:issue('a',{admin:u})});
};
