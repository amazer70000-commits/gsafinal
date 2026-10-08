const assert = require('assert');
const {passwordFor} = require('./api/_shared');
const login = require('./api/login');
const evaluate = require('./api/evaluate');

function mockRes(){return {statusCode:200,headers:{},status(n){this.statusCode=n;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return v}}}
async function call(fn,req){const res=mockRes();await fn(req,res);return res}
(async()=>{
  assert.equal(passwordFor('Dharani S'),'DHAR@1234');
  const oldFetch=global.fetch;
  global.fetch=async()=>({ok:true,text:async()=>`Name,Email\nDharani S,dharani@example.com\nArun Kumar,arun@example.com\n`});
  let r=await call(login,{method:'POST',body:{username:'Dharani S',password:'DHAR@1234'}});
  assert.equal(r.statusCode,200); assert.equal(r.body.name,'Dharani S');
  r=await call(login,{method:'POST',body:{username:'Dharani S',password:'WRONG'}});
  assert.equal(r.statusCode,401);

  global.fetch=async()=>({ok:true,text:async()=>`Name,Prompt,Email\nDharani S,"A cinematic portrait of a lonely child with dramatic lighting and hope",x\nArun Kumar,"a simple cat picture",y\nDharani S,"cinematic realistic wide portrait, emotion, hope, shadow",x\n`});
  r=await call(evaluate,{method:'GET',query:{round:'1'}});
  assert.equal(r.statusCode,200); assert.equal(r.body.count,2); assert.equal(r.body.criteria.length,3);

  global.fetch=async()=>({ok:true,text:async()=>`Name,Brand Name,Tagline,Product,Problem,Solution,Target Audience,USP,Story,Stall,Identity,Image\nDharani S,FreshBox,Fresh for all,produce delivery,food waste,smart delivery,families,local freshness,farmer story,fest booth,green identity,https://example.com/a.jpg\nArun Kumar,CatCo,Cats for all,pet service,,cat care,pet owners,care,brand story,stall design,visual identity,`});
  r=await call(evaluate,{method:'GET',query:{round:'2'}});
  assert.equal(r.statusCode,200); assert.equal(r.body.count,2); assert.equal(r.body.criteria.length,4);

  global.fetch=oldFetch;
  console.log('PASS: Dharani S login credential algorithm');
  console.log('PASS: live-roster login accepts registered user and rejects wrong password');
  console.log('PASS: Round 1 evaluator reads, deduplicates, and scores live responses');
  console.log('PASS: Round 2 evaluator reads and scores live responses');
})();
