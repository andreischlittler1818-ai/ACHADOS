export interface Env {
  DB: D1Database;
  MELI_APP_ID: string;
  MELI_CLIENT_SECRET: string;
  OWNER_KEY: string;
  TOKEN_ENCRYPTION_KEY: string;
  PUBLIC_BASE_URL: string;
  FRONTEND_ORIGIN: string;
}
type TokenReply={access_token:string;refresh_token:string;expires_in:number;user_id:number;token_type?:string;scope?:string};
const encoder=new TextEncoder();
function json(data:unknown,status=200,headers:HeadersInit={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function html(s:string,status=200){return new Response(s,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'"}})}
function hex(b:Uint8Array){return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')}
function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function random(){const a=new Uint8Array(32);crypto.getRandomValues(a);return b64url(a)}
async function digest(v:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(v))))}
async function key(env:Env){const raw=Uint8Array.from(atob(env.TOKEN_ENCRYPTION_KEY),c=>c.charCodeAt(0));if(raw.length!==32)throw Error('TOKEN_ENCRYPTION_KEY deve ser 32 bytes em Base64');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt'])}
async function encrypt(env:Env,data:string){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(data)));return btoa(String.fromCharCode(...iv,...ct))}
async function decrypt(env:Env,data:string){const all=Uint8Array.from(atob(data),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:all.slice(0,12)},await key(env),all.slice(12)))}
function safeEqual(a:string,b:string){const aa=encoder.encode(a),bb=encoder.encode(b);let diff=aa.length^bb.length;for(let i=0;i<Math.max(aa.length,bb.length);i++)diff|=(aa[i]||0)^(bb[i]||0);return diff===0}
function authorized(req:Request,env:Env){const k=req.headers.get('x-owner-key')||'';return k.length>0 && env.OWNER_KEY.length>0 && safeEqual(k,env.OWNER_KEY)}
function cors(env:Env,origin:string|null):Record<string,string>{return origin===env.FRONTEND_ORIGIN?{'access-control-allow-origin':env.FRONTEND_ORIGIN,'vary':'Origin','access-control-allow-headers':'content-type,x-owner-key','access-control-allow-methods':'GET,POST,OPTIONS'}:{}}
function callback(env:Env){return env.PUBLIC_BASE_URL.replace(/\/$/,'')+'/oauth/callback'}
function landing(env:Env,ok:boolean){return env.FRONTEND_ORIGIN.replace(/\/$/,'')+'/ACHADOS/?meli='+ (ok?'connected':'error')}
async function exchange(env:Env,params:URLSearchParams):Promise<TokenReply>{const r=await fetch('https://api.mercadolibre.com/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},body:params});if(!r.ok)throw Error('Falha de autorização do Mercado Livre ('+r.status+')');const data=await r.json() as TokenReply;if(!data.access_token||!data.refresh_token||!data.user_id)throw Error('Resposta de token incompleta');return data}
async function save(env:Env,t:TokenReply){await env.DB.prepare('INSERT INTO ml_connection (id,user_id,ciphertext,expires_at,updated_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,ciphertext=excluded.ciphertext,expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(String(t.user_id),await encrypt(env,JSON.stringify(t)),Date.now()+t.expires_in*1000,Date.now()).run()}
async function connected(env:Env){return env.DB.prepare('SELECT user_id,expires_at FROM ml_connection WHERE id=1').first<{user_id:string;expires_at:number}>()}

type MlListing={id:string;title:string;price:number|null;image:string;category:string;permalink:string;kind:'catalog'|'listing'};
function normalizeMlItem(x:any,kind:'catalog'|'listing'):MlListing|null{
 if(!x||typeof x!=='object'||typeof x.id!=='string'||typeof x.name!=='string'&&typeof x.title!=='string')return null;
 const img=x.thumbnail||x.pictures?.[0]?.secure_url||x.pictures?.[0]?.url||x.pictures?.[0]?.max_size||'';
 const title=String(x.title||x.name).slice(0,240);
 const price=typeof x.price==='number'&&Number.isFinite(x.price)?x.price:null;
 return {id:x.id,title,price,image:typeof img==='string'&&img.startsWith('https://')?img:'',category:typeof x.domain_id==='string'?x.domain_id:typeof x.category_id==='string'?x.category_id:'',permalink:typeof x.permalink==='string'&&x.permalink.startsWith('https://')?x.permalink:'',kind};
}
async function accountToken(env:Env){
 const row=await env.DB.prepare('SELECT ciphertext,expires_at FROM ml_connection WHERE id=1').first<{ciphertext:string;expires_at:number}>();
 if(!row)return null;
 let token=JSON.parse(await decrypt(env,row.ciphertext)) as TokenReply;
 if(row.expires_at<Date.now()+60000){
  token=await exchange(env,new URLSearchParams({grant_type:'refresh_token',client_id:env.MELI_APP_ID,client_secret:env.MELI_CLIENT_SECRET,refresh_token:token.refresh_token}));
  await save(env,token);
 }
 return token.access_token;
}

export default {async fetch(request:Request,env:Env):Promise<Response>{
 const u=new URL(request.url);const origin=request.headers.get('origin');const ch=cors(env,origin);
 if(u.pathname.startsWith('/api/')){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:ch});
  if(origin!==env.FRONTEND_ORIGIN)return json({error:'Origem não autorizada'},403,ch);
  if(!authorized(request,env))return json({error:'Chave administrativa inválida'},401,ch);
  if(u.pathname==='/api/status'&&request.method==='GET'){const row=await connected(env);return json({connected:!!row,userId:row?.user_id||null,expiresAt:row?.expires_at||null,affiliateCatalogApiAvailable:false},200,ch)}
  if(u.pathname==='/api/connect/start'&&request.method==='POST'){
   if(!env.MELI_APP_ID||!env.MELI_CLIENT_SECRET||!env.PUBLIC_BASE_URL)return json({error:'Credenciais não configuradas'},503,ch);
   const state=random(),verifier=random();const challenge=b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
   await env.DB.prepare('DELETE FROM oauth_state WHERE expires_at < ?').bind(Date.now()).run();
   await env.DB.prepare('INSERT INTO oauth_state (state_hash, verifier_cipher, expires_at) VALUES (?,?,?)').bind(await digest(state),await encrypt(env,verifier),Date.now()+10*60*1000).run();
   const auth=new URL('https://auth.mercadolivre.com.br/authorization');auth.searchParams.set('response_type','code');auth.searchParams.set('client_id',env.MELI_APP_ID);auth.searchParams.set('redirect_uri',callback(env));auth.searchParams.set('state',state);auth.searchParams.set('code_challenge',challenge);auth.searchParams.set('code_challenge_method','S256');
   return json({authorizationUrl:auth.href},200,ch)
  }
  if(u.pathname==='/api/disconnect'&&request.method==='POST'){await env.DB.prepare('DELETE FROM ml_connection WHERE id=1').run();return json({connected:false},200,ch)}

  if(u.pathname==='/api/products/search'&&request.method==='GET'){
   const query=(u.searchParams.get('q')||'').trim();
   if(query.length<3||query.length>90)return json({error:'Pesquise por 3 a 90 caracteres.'},400,ch);
   const token=await accountToken(env);
   if(!token)return json({error:'Conecte sua conta do Mercado Livre primeiro.'},401,ch);
   const target=new URL('https://api.mercadolibre.com/products/search');
   target.searchParams.set('site_id','MLB');
   target.searchParams.set('status','active');
   target.searchParams.set('q',query);
   target.searchParams.set('limit','12');
   try{
    const resp=await fetch(target.toString(),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
    if(!resp.ok)return json({error:resp.status===403?'Sua aplicação não tem permissão para pesquisar este catálogo.':'A API do Mercado Livre não retornou resultados. Confira as permissões.',code:resp.status},502,ch);
    const body=await resp.json() as {results?:unknown[];paging?:{total?:number}};
    const items=Array.isArray(body.results)?body.results.map(x=>normalizeMlItem(x,'catalog')).filter((x):x is MlListing=>x!==null).slice(0,12):[];
    return json({items,total:body.paging?.total??items.length,source:'Mercado Livre /products/search',affiliateEligible:null,note:'Resultados de catálogo, sem confirmação de comissão ou oferta ativa para o afiliado.'},200,ch);
   }catch{return json({error:'Falha temporária ao consultar a API do Mercado Livre.'},502,ch)}
  }
  if(u.pathname==='/api/products/item'&&request.method==='GET'){
   const id=(u.searchParams.get('id')||'').trim().toUpperCase();
   if(!/^MLB\d{6,16}$/.test(id))return json({error:'Informe um ID de anúncio MLB válido.'},400,ch);
   const token=await accountToken(env);
   if(!token)return json({error:'Conecte sua conta do Mercado Livre primeiro.'},401,ch);
   try{
    const resp=await fetch('https://api.mercadolibre.com/items/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
    if(!resp.ok)return json({error:'Não foi possível consultar este anúncio na API oficial.',code:resp.status},502,ch);
    const raw=await resp.json();
    const item=normalizeMlItem(raw,'listing');
    if(!item)return json({error:'A API retornou um anúncio sem dados suficientes.'},502,ch);
    return json({item,affiliateEligible:null,source:'Mercado Livre /items/{id}',note:'O endereço do anúncio não é necessariamente um link de afiliado.'},200,ch);
   }catch{return json({error:'Falha temporária ao consultar o anúncio.'},502,ch)}
  }
  if(u.pathname==='/api/me'&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT ciphertext,expires_at FROM ml_connection WHERE id=1').first<{ciphertext:string;expires_at:number}>();
    if(!row)return json({error:'Conta não conectada'},404,ch);
    let token=JSON.parse(await decrypt(env,row.ciphertext)) as TokenReply;
    if(row.expires_at<Date.now()+60000){
     token=await exchange(env,new URLSearchParams({grant_type:'refresh_token',client_id:env.MELI_APP_ID,client_secret:env.MELI_CLIENT_SECRET,refresh_token:token.refresh_token}));
     await save(env,token);
    }
    const me=await fetch('https://api.mercadolibre.com/users/me',{headers:{authorization:'Bearer '+token.access_token}});
    if(!me.ok)return json({error:'Não foi possível consultar a conta',code:me.status},502,ch);
    const details=await me.json() as {id?:number;nickname?:string;site_id?:string};
    return json({id:details.id,nickname:details.nickname,siteId:details.site_id},200,ch)
  }
  return json({error:'Rota não encontrada'},404,ch)
 }
 if(u.pathname==='/oauth/callback'){
  const state=u.searchParams.get('state')||'';const code=u.searchParams.get('code')||'';const error=u.searchParams.get('error');
  if(error||!state||!code)return html('<h2>Autorização cancelada ou incompleta.</h2><p>Volte ao ACHADOS e tente novamente.</p>',400);
  const hash=await digest(state);
  const row=await env.DB.prepare('DELETE FROM oauth_state WHERE state_hash=? AND expires_at>? RETURNING verifier_cipher').bind(hash,Date.now()).first<{verifier_cipher:string}>();
  if(!row)return html('<h2>Solicitação inválida ou expirada.</h2><p>Volte ao ACHADOS e inicie uma nova conexão.</p>',400);
  try{
   const verifier=await decrypt(env,row.verifier_cipher);
   const t=await exchange(env,new URLSearchParams({grant_type:'authorization_code',client_id:env.MELI_APP_ID,client_secret:env.MELI_CLIENT_SECRET,code,redirect_uri:callback(env),code_verifier:verifier}));
   await save(env,t);
   return Response.redirect(landing(env,true),303);
  }catch{return html('<h2>Não foi possível concluir a conexão.</h2><p>Confira as permissões e a URL de retorno registrada no Mercado Livre.</p>',502)}
 }
 return json({service:'ACHADOS Mercado Livre OAuth',status:'ready',callback:callback(env)})
}} satisfies ExportedHandler<Env>;
