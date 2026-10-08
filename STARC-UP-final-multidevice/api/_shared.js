const DEFAULTS = {
  registration: process.env.REGISTRATION_SHEET_URL || 'https://docs.google.com/spreadsheets/d/1HfrtzJy4iMNAbBau30HJFAlb0Boylnr_bS-vj2r5NAU/export?format=csv&gid=1963772888',
  round1: process.env.ROUND1_SHEET_URL || 'https://docs.google.com/spreadsheets/d/1C6sH5FWt7hPv8hZi4VlWlcajAjn11eEVTNlOjigxMxg/export?format=csv',
  round2: process.env.ROUND2_SHEET_URL || 'https://docs.google.com/spreadsheets/d/15Mb8uLsHD6kj5kFpoDZoIcY-jhBHaROeTy3Yj0snLqM/export?format=csv&gid=557978367',
  suffix: process.env.PASSWORD_SUFFIX || '@1234'
};

function norm(s) { return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function passwordFor(name) {
  const words = String(name).split(/[^A-Za-z]+/).filter(Boolean);
  const first = words.find(x => x.length > 2) || words.find(x => x.length > 1) || words[0] || '';
  return first.slice(0, 4).toUpperCase() + DEFAULTS.suffix;
}
function parseCsv(t) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(quoted){ if(ch==='"'){ if(t[i+1]==='"'){field+='"';i++;} else quoted=false;} else field+=ch; }
    else if(ch==='"') quoted=true;
    else if(ch===','){row.push(field);field='';}
    else if(ch==='\n' || ch==='\r'){ if(ch==='\r'&&t[i+1]==='\n')i++; row.push(field); rows.push(row); row=[]; field=''; }
    else field+=ch;
  }
  if(field || row.length){row.push(field);rows.push(row);}
  return rows.filter(r=>r.some(v=>String(v).trim()));
}
function objects(t){
  const rows=parseCsv(t); const headers=(rows.shift()||[]).map(x=>String(x).toLowerCase().trim());
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??'').trim()])));
}
function nameOf(o){
  const k=Object.keys(o).find(k=>/name/.test(k)&&!/college|school|team/.test(k));
  return k ? o[k] : '';
}
function responseUrl(round){ return round===1 ? DEFAULTS.round1 : DEFAULTS.round2; }
async function fetchSheet(url){
  if(!url) throw new Error('Sheet URL is not configured');
  const candidates=[];
  const m=url.match(/\/export\?format=csv(?:&gid=(\d+))?/);
  if(m) candidates.push(url.replace(m[0], '/gviz/tq?tqx=out:csv'+(m[1]?`&gid=${m[1]}`:'')));
  candidates.push(url);
  let last='';
  for(const u of candidates){
    try{
      const r=await fetch(u,{cache:'no-store',headers:{'Accept':'text/csv'}});
      const t=await r.text();
      if(r.ok && t.trim() && !/^\s*<!doctype html/i.test(t) && !/^\s*<html/i.test(t)) return t;
      last=`HTTP ${r.status}`;
    }catch(e){ last=e.message; }
  }
  throw new Error(`Google Sheet could not be read (${last}). Make the response sheet accessible to the server.`);
}
function json(res,status,data){res.status(status).setHeader('Cache-Control','no-store');return res.json(data);}
module.exports={DEFAULTS,norm,passwordFor,parseCsv,objects,nameOf,responseUrl,fetchSheet,json};
