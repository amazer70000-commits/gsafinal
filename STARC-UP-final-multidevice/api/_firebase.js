const crypto = require('crypto');
let cached={token:null,exp:0};
const b64=v=>Buffer.from(v).toString('base64url');
function cfg(){
  const database=String(process.env.FIREBASE_DATABASE_URL||'').replace(/\/$/,'');
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=String(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if(!database||!projectId||!clientEmail||!privateKey) throw new Error('Firebase backend is not configured. Set FIREBASE_DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel.');
  return {database,projectId,clientEmail,privateKey};
}
async function accessToken(){
  if(cached.token && cached.exp>Date.now()+60000) return cached.token;
  const c=cfg(), now=Math.floor(Date.now()/1000);
  const header=b64(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claim=b64(JSON.stringify({iss:c.clientEmail,scope:'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const signer=crypto.createSign('RSA-SHA256'); signer.update(header+'.'+claim); signer.end();
  const assertion=header+'.'+claim+'.'+signer.sign(c.privateKey,'base64url');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString()});
  const j=await r.json(); if(!r.ok||!j.access_token) throw new Error('Could not obtain Firebase access token: '+(j.error_description||j.error||r.status));
  cached={token:j.access_token,exp:Date.now()+Number(j.expires_in||3600)*1000}; return cached.token;
}
async function request(path,method='GET',body){
  const c=cfg(), token=await accessToken();
  const r=await fetch(c.database+path+'.json',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
  if(!r.ok) throw new Error(`Firebase ${method} ${path} failed (${r.status}): ${data?.error||text.slice(0,180)}`);
  return data;
}
module.exports={get:(p)=>request(p),put:(p,b)=>request(p,'PUT',b),patch:(p,b)=>request(p,'PATCH',b),del:(p)=>request(p,'DELETE')};
