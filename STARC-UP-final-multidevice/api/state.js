const {json}=require('./_shared');
const {get,put,patch,del}=require('./_firebase');
const {bearer,verify}=require('./_auth');
module.exports=async(req,res)=>{
  const s=verify(bearer(req));
  if(!s) return json(res,401,{ok:false,error:'Session expired. Please log in again.'});
  const resource=String(req.query?.resource||'ctl');
  const key=String(req.query?.key||'');
  try{
    if(resource==='ctl'){
      if(req.method==='GET') return json(res,200,{ok:true,data:(await get('/starcup/ctl'))||null});
      if(req.method==='PUT'){ if(s.role!=='a') return json(res,403,{ok:false,error:'Admin permission required.'}); const body=typeof req.body==='string'?JSON.parse(req.body||'null'):req.body; return json(res,200,{ok:true,data:await put('/starcup/ctl',body)}); }
    }
    if(resource==='mem'){
      if(!key) return json(res,400,{ok:false,error:'Participant key required.'});
      if(s.role!=='a' && !(s.role==='p' && s.key===key)) return json(res,403,{ok:false,error:'Not authorized for this participant.'});
      if(req.method==='GET') return json(res,200,{ok:true,data:(await get('/starcup/mem/'+encodeURIComponent(key)))||null});
      if(req.method==='PUT'){ const body=typeof req.body==='string'?JSON.parse(req.body||'null'):req.body; return json(res,200,{ok:true,data:await put('/starcup/mem/'+encodeURIComponent(key),body)}); }
      if(req.method==='DELETE'){ if(s.role!=='a') return json(res,403,{ok:false,error:'Admin permission required.'}); await del('/starcup/mem/'+encodeURIComponent(key)); return json(res,200,{ok:true}); }
    }
    if(resource==='allmem' && req.method==='GET' && s.role==='a') return json(res,200,{ok:true,data:(await get('/starcup/mem'))||{}});
    if(resource==='allmem' && req.method==='PUT' && s.role==='a'){ const body=typeof req.body==='string'?JSON.parse(req.body||'null'):req.body; return json(res,200,{ok:true,data:await put('/starcup/mem',body)}); }
    return json(res,405,{ok:false,error:'Unsupported state operation.'});
  }catch(e){return json(res,503,{ok:false,error:e.message});}
};
