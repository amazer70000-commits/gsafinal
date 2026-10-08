const crypto = require('crypto');
function secret(){ return process.env.APP_SESSION_SECRET || process.env.ADMIN_PASSWORD_SHA256 || 'CHANGE_ME_SESSION_SECRET'; }
function b64(v){ return Buffer.from(v).toString('base64url'); }
function sign(payload){ const body=b64(JSON.stringify(payload)); const sig=crypto.createHmac('sha256',secret()).update(body).digest('base64url'); return body+'.'+sig; }
function issue(role, extra={}, ttl=12*60*60*1000){ return sign({role,...extra,exp:Date.now()+ttl}); }
function verify(token){
  if(!token || typeof token!=='string') return null;
  const [body,sig]=token.split('.'); if(!body||!sig) return null;
  const expected=crypto.createHmac('sha256',secret()).update(body).digest('base64url');
  if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
  try{ const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8')); return p.exp>Date.now()?p:null; }catch{return null;}
}
function bearer(req){ const h=req.headers?.authorization||''; return h.startsWith('Bearer ')?h.slice(7):String(req.headers?.['x-session']||''); }
module.exports={issue,verify,bearer};
