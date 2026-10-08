const {fetchSheet,objects,nameOf,norm,json}=require('./_shared');
module.exports=async(req,res)=>{
  try{
    const rows=objects(await fetchSheet(process.env.REGISTRATION_SHEET_URL || require('./_shared').DEFAULTS.registration));
    const seen=new Set(), participants=[];
    for(const o of rows){const name=nameOf(o), k=norm(name); if(name && !seen.has(k)){seen.add(k);participants.push({name});}}
    if(!participants.length) return json(res,502,{ok:false,error:'The registration sheet was read, but no name column/registrations were found.'});
    return json(res,200,{ok:true,count:participants.length,participants,updatedAt:new Date().toISOString()});
  }catch(e){return json(res,502,{ok:false,error:e.message});}
};
