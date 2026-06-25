const https=require('https');
const CK=process.env.ANTHROPIC_KEY;
const UT=process.env.B44_TOKEN;
const SI=process.env.SUB_ID;
const APP=process.env.APP_ID;
function g(h,p,t){return new Promise((res,rej)=>{const r=https.request({hostname:h,path:p,method:'GET',headers:{'Authorization':'Bearer '+t}},rs=>{let d='';rs.on('data',x=>d+=x);rs.on('end',()=>{try{res(JSON.parse(d));}catch(e){res({});}});});r.on('error',rej);r.end();});}
function po(h,pa,t,b){return new Promise((res,rej)=>{const d=JSON.stringify(b);const r=https.request({hostname:h,path:pa,method:'POST',headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}},rs=>{let x='';rs.on('data',c=>x+=c);rs.on('end',()=>{try{res({s:rs.statusCode,b:JSON.parse(x)});}catch(e){res({s:rs.statusCode,b:x});}});});r.on('error',rej);r.write(d);r.end();});}
exports.handler=async(ev)=>{
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
if(ev.httpMethod==='OPTIONS')return{statusCode:200,headers:cors,body:''};
try{
const{pdf_base64}=JSON.parse(ev.body||'{}');
if(!pdf_base64)return{statusCode:400,headers:cors,body:JSON.stringify({error:'pdf_base64 required'})};
const cb=JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,messages:[{role:'user',content:[{type:'document',source:{type:'base64',media_type:'application/pdf',data:pdf_base64}},{type:'text',text:'Extraia dados do laudo DGA e retorne APENAS JSON sem markdown. Campos: h2 ch4 c2h2 c2h4 c2h6 co co2 furfural (numeros ppm) data_coleta (YYYY-MM-DD) laboratorio numero_laudo numero_serie identificacao fabricante tipo_oleo (strings) potencia_kva (numero) tensao_kv (string). Use null para campos ausentes.'}]}]});
const cl=await new Promise((res,rej)=>{const r=https.request({hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'x-api-key':CK,'anthropic-version':'2023-06-01','Content-Type':'application/json','Content-Length':Buffer.byteLength(cb)}},rs=>{let d='';rs.on('data',x=>d+=x);rs.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(new Error(d.slice(0,100)));}});});r.on('error',rej);r.write(cb);r.end();});
if(cl.error)throw new Error(cl.error.message);
const data=JSON.parse(cl.content[0].text.replace(/```json|```/g,'').trim());
let tid=null;const ns=data.numero_serie;
if(ns){const f=await g('app.oilssense.com','/api/apps/'+APP+'/entities/Transformer?numero_serie='+encodeURIComponent(ns)+'&limit=1',UT);const a=Array.isArray(f)?f:(f.results||[]);if(a[0]&&a[0].id){tid=a[0].id;}else{const cr=await po('app.oilssense.com','/api/apps/'+APP+'/entities/Transformer',UT,{numero_serie:ns,identificacao:data.identificacao||ns,subscription_id:SI});tid=cr.b&&cr.b.id;}}
const sv=await po('app.oilssense.com','/api/apps/'+APP+'/entities/LabAnalysis',UT,{h2:data.h2,ch4:data.ch4,c2h2:data.c2h2,c2h4:data.c2h4,c2h6:data.c2h6,co:data.co,co2:data.co2,furfural:data.furfural,data_coleta:data.data_coleta,laboratorio:data.laboratorio,numero_laudo:data.numero_laudo,transformer_id:tid,subscription_id:SI});
if(sv.b&&sv.b.message&&!sv.b.id)throw new Error(sv.b.message);
return{statusCode:200,headers:cors,body:JSON.stringify({success:true,data,id:sv.b&&sv.b.id})};
}catch(e){return{statusCode:500,headers:cors,body:JSON.stringify({error:e.message||'Erro interno'})};}
};