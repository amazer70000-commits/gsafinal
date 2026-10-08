const {fetchSheet,objects,nameOf,norm,passwordFor,json}=require('./_shared');
const {issue}=require('./_auth');
module.exports=async(req,res)=>{
  if(req.method!=='POST') return json(res,405,{ok:false,error:'POST required'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const username=norm(body.username), password=String(body.password||'').trim();
    if(!username || !password) return json(res,400,{ok:false,error:'Enter username and password.'});
    const rows=objects(await fetchSheet(require('./_shared').DEFAULTS.registration));
    const matches=rows.map(nameOf).filter(Boolean).filter(n=>norm(n)===username);
    if(!matches.length) return json(res,401,{ok:false,error:'Name is not present in the current registration sheet.'});
    const name=matches[matches.length-1];
    if(password.toUpperCase()!==passwordFor(name)) return json(res,401,{ok:false,error:'Incorrect password.'});
    return json(res,200,{ok:true,name,key:norm(name).replace(/\W/g,'_'),session:issue('p',{name,key:norm(name).replace(/\W/g,'_')},24*60*60*1000),passwordVersion:'name-prefix-v1',checkedAt:new Date().toISOString()});
  }catch(e){return json(res,502,{ok:false,error:e.message});}
};
