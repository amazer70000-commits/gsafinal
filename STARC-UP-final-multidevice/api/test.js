const {passwordFor}=require('./_shared');
module.exports=async(req,res)=>{
  const sampleName='Dharani S', expected='DHAR@1234';
  const generated=passwordFor(sampleName);
  const ok=generated===expected;
  res.status(ok?200:500).json({ok,sample:{name:sampleName,generated,expected,loginCredentialValid:ok},note:'This validates the credential algorithm only. Live login additionally requires the name to exist in the current registration sheet.'});
};
