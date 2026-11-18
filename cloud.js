/* ABR Financeiro 4.0 — sincronização por registro, com exclusões persistidas.
 * GitHub Pages só serve os arquivos; Supabase armazena os dados privados sob RLS.
 * Não contém credenciais de usuário. O publishable key em config.js é público. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const JSONcopy=x=>JSON.parse(JSON.stringify(x));
 const CLOUD_TAG='abr-cloud-';
 let client=null, user=null, attached=false, busy=false, rerun=false, interval=null;
 let offlineUserId=null;
 let queue={ops:{},meta:null};
 const banner=msg=>{const n=$('nuvemAviso');n.textContent=msg;n.classList.remove('hidden')};
 const status=(msg,success=false)=>{
  $('nuvemStatus').textContent=msg;
  $('nuvemSelo').textContent=success?'SINCRONIZADO':attached?'PENDENTE':'LOCAL';
  $('nuvemSelo').classList.toggle('active',success);
 };
 const string=x=>JSON.stringify(x);
 const equal=(a,b)=>string(a)===string(b);
 const metaOf=s=>{const {registros,...meta}=s;return JSONcopy(meta)};
 const readJSON=(key,fallback)=>{try{const s=localStorage.getItem(key);return s?JSON.parse(s):fallback}catch{return fallback}};
 const currentUserId=()=>user?.id||offlineUserId;
 const queueKey=()=>CLOUD_TAG+'fila-'+currentUserId();
 const attachedKey=()=>CLOUD_TAG+'vinculado-'+currentUserId();
 const retainQueue=()=>{try{localStorage.setItem(queueKey(),string(queue))}catch(e){status('Falha ao salvar a fila de sincronização local: '+e.message)}};
 const hasPending=()=>Object.keys(queue.ops).length>0||queue.meta!==null;
 const countPending=()=>Object.keys(queue.ops).length+(queue.meta!==null?1:0);
 const authView=()=>{
  $('nuvemAcesso').classList.toggle('hidden',!client||!!user);
  $('nuvemEscolha').classList.add('hidden');
  $('nuvemAtiva').classList.add('hidden');
 };
 const errorText=e=>(e&&e.message)||String(e);
 const endpointOk=()=>{
  const settings=window.ABR_SUPABASE||{};
  return typeof settings.url==='string'&&/^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(settings.url.trim())&&
   typeof settings.key==='string'&&settings.key.length>20&&!settings.key.includes('COLE_');
 };
 function localSaved(previousRaw,current){
  if(!attached||!currentUserId())return;
  let previous;try{previous=previousRaw?JSON.parse(previousRaw):null}catch{return}
  if(!previous||!Array.isArray(previous.registros))return;
  const old=new Map(previous.registros.map(r=>[r.id,r]));
  const currentMap=new Map(current.registros.map(r=>[r.id,r]));
  for(const [id,item] of currentMap){if(!old.has(id)||!equal(old.get(id),item))queue.ops[id]={apagado:false,registro:JSONcopy(item)}}
  for(const [id] of old){if(!currentMap.has(id))queue.ops[id]={apagado:true,registro:{}}}
  const a=metaOf(previous),b=metaOf(current);
  if(!equal(a,b))queue.meta=b;
  retainQueue();
  status('Alterações salvas neste aparelho • '+countPending()+' item(ns) para enviar.');
  // Debounce: movimentos rápidos não disparam várias consultas ao mesmo tempo.
  clearTimeout(window.__abrCloudFlushTimer);
  window.__abrCloudFlushTimer=setTimeout(()=>{syncNow()},450);
 }
 async function fetchCloud(){
  const {data:cfg,error:ce}=await client.from('abr_config').select('dados').eq('user_id',user.id).maybeSingle();
  if(ce)throw ce;
  const rows=[];let start=0;
  while(true){
   const {data,error}=await client.from('abr_movimentos').select('id,registro,apagado').eq('user_id',user.id).order('id').range(start,start+499);
   if(error)throw error;
   rows.push(...(data||[]));
   if(!data||data.length<500)break;
   start+=500;
  }
  return {rows,cfg:cfg?.dados||null};
 }
 async function sendEntries(entries){
  for(let start=0;start<entries.length;start+=100){
   const part=entries.slice(start,start+100).map(([id,op])=>({
    id, user_id:user.id, registro:op.registro, apagado:!!op.apagado, modificado_em:new Date().toISOString()
   }));
   const {error}=await client.from('abr_movimentos').upsert(part,{onConflict:'user_id,id'});
   if(error)throw error;
  }
 }
 async function sendConfig(meta){
  const {error}=await client.from('abr_config').upsert({user_id:user.id,dados:meta,modificado_em:new Date().toISOString()},{onConflict:'user_id'});
  if(error)throw error;
 }
 function applyRemote(remote){
  const byId=new Map(remote.rows.map(row=>[row.id,row]));
  // Mudanças ainda NÃO enviadas sempre vencem temporariamente a cópia recebida.
  for(const [id,op] of Object.entries(queue.ops))byId.set(id,{id,registro:op.registro,apagado:op.apagado});
  const regs=[...byId.values()].filter(r=>!r.apagado&&r.registro&&r.registro.id).map(r=>r.registro);
  // Não substitua metadados editados offline por valores remotos antigos.
  const config=queue.meta??remote.cfg??metaOf(state);
  const next={...config,registros:regs};
  const oldState=state;
  state=next;
  // Grava no mesmo localStorage de v1-v3, mas sem registrar a leitura da nuvem como alteração local.
  try{localStorage.setItem(KEY,string(state));render()}catch(e){state=oldState;throw e}
 }
 async function pushQueue(){
  const ops=Object.entries(queue.ops);
  if(ops.length){
   await sendEntries(ops);
   for(const [id,op] of ops){if(equal(queue.ops[id],op))delete queue.ops[id]}
   retainQueue();
  }
  if(queue.meta!==null){
   const snap=JSONcopy(queue.meta);
   await sendConfig(snap);
   if(equal(queue.meta,snap))queue.meta=null;
   retainQueue();
  }
 }
 async function syncNow(){
  if(!attached||!client)return;
  if(!user&&offlineUserId){
   try{const result=await client.auth.getUser();if(result.error||!result.data?.user||result.data.user.id!==offlineUserId)throw Error('Faça login novamente.');user=result.data.user;}
   catch{status('Alterações locais preservadas; faça login novamente para sincronizar.');return}
  }
  if(!user)return;
  if(busy){rerun=true;return}
  busy=true;rerun=false;
  $('nuvemAgora').disabled=true;
  try{
   if(!navigator.onLine)throw new Error('Sem internet no momento. Os lançamentos continuam salvos aqui.');
   status('Sincronizando...');
   await pushQueue();
   const remote=await fetchCloud();
   applyRemote(remote);
   status(hasPending()?`Aguardando envio de ${countPending()} alteração(ões).`:'Dados atualizados no notebook e iPhone • última verificação '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),!hasPending());
  }catch(e){status('Nuvem indisponível: '+errorText(e)+' • dados locais preservados.');}
  finally{
   busy=false;$('nuvemAgora').disabled=false;
   if(rerun){rerun=false;setTimeout(syncNow,0)}
  }
 }
 async function startCloud(){
  const active=!!user&&attached;
  $('nuvemAcesso').classList.toggle('hidden',!!user);
  $('nuvemEscolha').classList.toggle('hidden',!user||attached);
  $('nuvemAtiva').classList.toggle('hidden',!active);
  if(!user)return;
  $('nuvemAviso').classList.add('hidden');
  if(attached){status('Conta conectada; buscando registros...');await syncNow()}
  else {
   try{
    const remote=await fetchCloud();
    $('nuvemContagem').textContent=`Na nuvem: ${remote.rows.filter(r=>!r.apagado).length} registros; neste aparelho: ${state.registros.length} registros. Escolha como começar, sem apagar dados sem backup.`;
    $('nuvemEnviar').disabled=!!remote.cfg;
    $('nuvemBaixar').disabled=remote.rows.length===0;
    $('nuvemMesclar').disabled=remote.rows.length===0;
    status('Conta conectada. Escolha como iniciar.');
   }catch(e){banner('Falha ao consultar o banco. Verifique se executou o SQL: '+errorText(e));$('nuvemEscolha').classList.add('hidden')}
  }
 }
 function setAttached(){
  attached=true;
  localStorage.setItem(attachedKey(),'1');
  queue=readJSON(queueKey(),{ops:{},meta:null});
  if(!queue||!queue.ops)queue={ops:{},meta:null};
  $('nuvemEscolha').classList.add('hidden');$('nuvemAtiva').classList.remove('hidden');
 }
 async function sendLocalFirst(){
  if(!user)return;
  if(!confirm('IMPORTANTE: faça backup JSON antes de continuar.\n\nEnviar o histórico completo deste notebook/aparelho para criar a primeira cópia na nuvem? Escolha isto SOMENTE no aparelho que contém os registros corretos.'))return;
  $('nuvemEnviar').disabled=true;
  try{
   const remote=await fetchCloud();
   if(remote.cfg)throw Error('A nuvem já possui dados. Use Carregar ou Mesclar. Nenhum registro foi sobrescrito.');
   await sendEntries(state.registros.map(r=>[r.id,{registro:r,apagado:false}]));
   await sendConfig(metaOf(state));
   setAttached();await syncNow();
  }catch(e){banner('Não foi possível criar a cópia na nuvem: '+errorText(e))}
  finally{$('nuvemEnviar').disabled=false}
 }
 async function downloadCloud(){
  if(!user)return;
  if(!confirm('ATENÇÃO: baixar a nuvem substitui os dados apresentados neste aparelho.\n\nJá exportou o backup JSON deste aparelho? Caso tenha vendas locais que ainda não estão na nuvem, use MESCLAR, não Carregar.'))return;
  try{
   const remote=await fetchCloud();
   if(!remote.rows.length||!remote.cfg)throw Error('Nuvem incompleta ou vazia; nada foi substituído.');
   // Salva um ponto de recuperação local, inclusive para dados que ainda não estavam no backup manual.
   try{localStorage.setItem(KEY+'-antes-primeira-nuvem',string(state))}catch{}
   setAttached();queue={ops:{},meta:null};retainQueue();
   applyRemote(remote);
   await syncNow();
  }catch(e){banner('Falha ao carregar: '+errorText(e))}
 }
 async function mergeCloud(){
  if(!user)return;
  if(!confirm('MESCLAR registros: serão enviados apenas IDs que ainda não estão na nuvem. Registros com o MESMO ID permanecem na versão da nuvem.\n\nJá exportou o backup deste aparelho?'))return;
  try{
   const remote=await fetchCloud();
   if(!remote.cfg)throw Error('Primeiro crie a cópia inicial na nuvem usando o notebook principal.');
   const existing=new Set(remote.rows.map(r=>r.id)); // inclui lápides: não restaura exclusões acidentalmente
   const missing=state.registros.filter(r=>!existing.has(r.id));
   await sendEntries(missing.map(r=>[r.id,{registro:r,apagado:false}]));
   try{localStorage.setItem(KEY+'-antes-mescla-nuvem',string(state))}catch{}
   setAttached();queue={ops:{},meta:null};retainQueue();
   const updated=await fetchCloud();applyRemote(updated);await syncNow();
   alert(`Mescla concluída: ${missing.length} registro(s) exclusivos deste aparelho enviados. Verifique o histórico.`);
  }catch(e){banner('Falha ao mesclar: '+errorText(e))}
 }
 async function login(create){
  if(!client)return;
  const email=$('nuvemEmail').value.trim();const password=$('nuvemSenha').value;
  if(!email.includes('@')||password.length<8){alert('Informe e-mail válido e senha de pelo menos 8 caracteres.');return}
  $('nuvemEntrar').disabled=$('nuvemCriar').disabled=true;
  try{
   let result;
   if(create){result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}})}
   else result=await client.auth.signInWithPassword({email,password});
   if(result.error)throw result.error;
   $('nuvemSenha').value='';
   if(create&&!result.data.session){banner('Conta solicitada. Confira seu e-mail e clique no link de confirmação. Depois volte ao site e entre com a senha.');return}
   user=result.data.user;offlineUserId=user.id;localStorage.setItem(CLOUD_TAG+'ultimo-usuario',user.id);
   attached=localStorage.getItem(attachedKey())==='1';
   queue=readJSON(queueKey(),{ops:{},meta:null});if(!queue?.ops)queue={ops:{},meta:null};
   await startCloud();
  }catch(e){banner('Erro de acesso: '+errorText(e))}
  finally{$('nuvemEntrar').disabled=$('nuvemCriar').disabled=false}
 }
 async function logout(){
  if(hasPending()&&!confirm('Há alterações que ainda NÃO foram sincronizadas. Sair agora mantém os dados neste aparelho, mas não os envia até entrar novamente. Continuar?'))return;
  try{await client.auth.signOut()}catch(e){banner('Falha ao sair: '+errorText(e));return}
  user=null;offlineUserId=null;localStorage.removeItem(CLOUD_TAG+'ultimo-usuario');attached=false;queue={ops:{},meta:null};
  authView();banner('Você saiu da conta. ATENÇÃO: os dados locais ainda permanecem visíveis neste aparelho; sair da conta não os apaga.');
  $('nuvemSelo').textContent='LOCAL';$('nuvemSelo').classList.remove('active');
 }
 async function init(){
  // Preserva a fila de alterações mesmo quando a página abre sem internet e o SDK não carrega.
  offlineUserId=localStorage.getItem(CLOUD_TAG+'ultimo-usuario');
  if(offlineUserId&&localStorage.getItem(CLOUD_TAG+'vinculado-'+offlineUserId)==='1'){
   attached=true;queue=readJSON(CLOUD_TAG+'fila-'+offlineUserId,{ops:{},meta:null});
   if(!queue?.ops)queue={ops:{},meta:null};
   status('Modo local: aguardando autenticação/conexão para enviar alterações.');
  }
  window.ABRCloud={localSaved,syncNow};
  if(!endpointOk()){
   authView();banner('Sincronização ainda não configurada: falta preencher config.js com a URL e a chave publicável do projeto Supabase. O aplicativo continua funcionando localmente.');return;
  }
  if(!window.supabase?.createClient){
   authView();banner('Biblioteca Supabase não carregou (possível falta de internet). Lançamentos continuam locais.');return;
  }
  try{
   client=window.supabase.createClient(window.ABR_SUPABASE.url,window.ABR_SUPABASE.key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
   $('nuvemEntrar').onclick=()=>login(false);
   $('nuvemCriar').onclick=()=>login(true);
   $('nuvemEnviar').onclick=sendLocalFirst;
   $('nuvemBaixar').onclick=downloadCloud;
   $('nuvemMesclar').onclick=mergeCloud;
   $('nuvemAgora').onclick=syncNow;
   $('nuvemSair').onclick=logout;
   const {data,error}=await client.auth.getUser();
   if(error||!data?.user){
    user=null;authView();banner(attached?'Sem acesso à conta agora. Os lançamentos continuam na fila deste aparelho; entre novamente quando tiver internet.':'Entre na conta para ativar a sincronização. Se ainda não tem uma, toque em Criar conta.');return}
   user=data.user;offlineUserId=user.id;localStorage.setItem(CLOUD_TAG+'ultimo-usuario',user.id);attached=localStorage.getItem(attachedKey())==='1';
   queue=readJSON(queueKey(),{ops:{},meta:null});if(!queue?.ops)queue={ops:{},meta:null};
   await startCloud();
  }catch(e){authView();banner('Não foi possível inicializar a nuvem: '+errorText(e))}
 }
 // Eventos de retorno à página precisam funcionar também após login manual.
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&attached)syncNow()});
 window.addEventListener('online',()=>{if(attached)syncNow()});
 interval=setInterval(()=>{if(attached&&document.visibilityState==='visible')syncNow()},15000);
 init();
})();
