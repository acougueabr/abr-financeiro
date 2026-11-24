'use strict';
const KEY='abr-financeiro-v1';const money=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const el=id=>document.getElementById(id);const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());const initial=[
{id:'v14',tipo:'venda',data:'2026-11-14',descricao:'Vendas consolidadas de sábado (detalhamento pendente)',valor:2473.60,status:'quitado',conta:'Espécie',legacy:true,semCaixa:true},
{id:'v15',tipo:'venda',data:'2026-11-15',descricao:'Vendas consolidadas de domingo (detalhamento pendente)',valor:2637.40,status:'quitado',conta:'Espécie',legacy:true,semCaixa:true},
{id:'v17',tipo:'venda',data:'2026-11-17',descricao:'Vendas consolidadas de terça (detalhamento pendente)',valor:1353,status:'quitado',conta:'Espécie',legacy:true,semCaixa:true},
{id:'v18',tipo:'venda',data:'2026-11-18',descricao:'Vendas parciais de quarta (detalhamento pendente)',valor:740.23,status:'quitado',conta:'Espécie',legacy:true,semCaixa:true},
{id:'c1',tipo:'compra',data:'2026-11-14',descricao:'Bovino — 1ª e 2ª bandas (159 kg, descontos R$ 76 + R$ 275)',valor:4021.50,status:'quitado',conta:'Espécie',legacy:true,semCaixa:true},
{id:'c2',tipo:'compra',data:'2026-11-14',descricao:'Frango de sábado (11,65 kg)',valor:145.63,status:'quitado',conta:'Espécie',legacy:true,semCaixa:true},
{id:'c3',tipo:'compra',data:'2026-11-18',descricao:'Bovino — 3ª banda (90 kg × R$ 27,50)',valor:2475,status:'pendente',conta:'Espécie',legacy:true},
{id:'c4',tipo:'compra',data:'2026-11-17',descricao:'Frango de ontem (13,50 kg × R$ 12,50)',valor:168.75,status:'pendente',conta:'Espécie',legacy:true},
{id:'c5',tipo:'compra',data:'2026-11-18',descricao:'Frango de hoje (14,60 kg × R$ 12,50)',valor:182.50,status:'pendente',conta:'Espécie',legacy:true},
{id:'c6',tipo:'compra',data:'2026-11-18',descricao:'Porco (23 kg × R$ 22)',valor:506,status:'pendente',conta:'Espécie',legacy:true},
{id:'f1',tipo:'venda',data:'2026-11-15',descricao:'Bethiane (fiado já incluído no consolidado)',pessoa:'Bethiane',valor:195,status:'pendente',conta:'Espécie',legacy:true,semFaturamento:true},
{id:'e1',tipo:'emprestimo',data:'2026-11-18',descricao:'Pai — empréstimos acumulados',pessoa:'Pai',valor:874.16,status:'pendente',conta:'Espécie',legacy:true,semCaixa:true}
];

// A chave da v1 é mantida de propósito: atualizar os arquivos NÃO reinicia os dados.
const PRODUCTS=['Carne bovina','Porco','Frango','Toscana','Calabresa','Outro'];
const cents=x=>Math.round((Number(x)||0)*100);
const round2=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
// Compatibilidade: vendas antigas têm um único troco {valor, conta}; as novas podem ter partes.
function trocoPartes(t){
  if(!t)return [];
  if(Array.isArray(t.partes)&&t.partes.length)return t.partes.filter(p=>p&&Number(p.valor)>0).map(p=>({conta:p.conta,valor:round2(p.valor)}));
  return Number(t.valor)>0?[{conta:t.conta,valor:round2(t.valor)}]:[];
}
const num=id=>Number(el(id).value)||0;
const fmtQty=(v,u='kg')=>`${Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${u}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const niceDate=d=>d?d.split('-').reverse().join('/'):'—';
const sum=arr=>round2(arr.reduce((a,v)=>a+Number(v||0),0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const productOptions=()=>PRODUCTS.map(p=>`<option value="${p}">${p}</option>`).join('');
// Informações descritivas sobre as compras consolidadas: NÃO são novos lançamentos.
// Em especial, 77 + 82 = 159 kg; a diferença do custo bruto é um desconto conjunto de R$ 351,00.
const SUPPLIER_CATEGORIES=['Carne bovina','Frango','Porco','Toscana','Calabresa'];
const LEGACY_LOTS={
  c1:{produto:'Carne bovina',quantidade:159,preco:27.50,desconto:351,lotes:[{data:'2026-11-14',quantidade:77},{data:'2026-11-15',quantidade:82}]},
  c2:{produto:'Frango',quantidade:11.65,preco:12.50},
  c3:{produto:'Carne bovina',quantidade:90,preco:27.50},
  c4:{produto:'Frango',quantidade:13.50,preco:12.50},
  c5:{produto:'Frango',quantidade:14.60,preco:12.50},
  c6:{produto:'Porco',quantidade:23,preco:22.00}
};
const supplierInfo=r=>r.legacy&&LEGACY_LOTS[r.id]?{...r,...LEGACY_LOTS[r.id]}:r;
const supplierCategory=r=>{
  const data=supplierInfo(r);
  if(SUPPLIER_CATEGORIES.includes(data.produto))return data.produto;
  const s=String(data.produto||data.descricao||'').toLocaleLowerCase('pt-BR');
  if(s.includes('porco')||s.includes('suíno')||s.includes('suino')||s.includes('suína')||s.includes('suina'))return 'Porco';
  if(s.includes('frango'))return 'Frango';
  if(s.includes('carne')||s.includes('bovino')||s.includes('bovina')||s.includes('boi')||s.includes('banda'))return 'Carne bovina';
  return null;
};
const supplierTitle=p=>({'Carne bovina':'FORNECEDOR DA CARNE','Frango':'FORNECEDOR DO FRANGO','Porco':'FORNECEDOR DO PORCO'})[p]||p;
let state, recentes=true, itemSequence=0;
function safeStorageGet(key){try{return localStorage.getItem(key)}catch{return null}}
function save(){try{const antes=safeStorageGet(KEY);localStorage.setItem(KEY,JSON.stringify(state));if(window.ABRCloud&&typeof window.ABRCloud.localSaved==='function')window.ABRCloud.localSaved(antes,state);return true}catch(e){el('armazenamentoAviso').textContent='Falha ao salvar os dados no aparelho. Libere espaço e faça um backup. '+e.message;el('armazenamentoAviso').classList.remove('hidden');return false}}
function initialize(){
  const raw=safeStorageGet(KEY);
  try{if(raw){const parsed=JSON.parse(raw);if(parsed&&Array.isArray(parsed.registros)&&parsed.saldos&&typeof parsed.saldos==='object')state=parsed}}catch{}
  if(!state){state={versao:4,fornecedores:{},registros:initial,saldos:{'Espécie':926,'Mercado Pago':798.33,'PicPay':234.55},dataBase:'2026-11-18',parcial:['2026-11-18']};save()}
  else if((state.versao||1)<4){
    try{if(!safeStorageGet(KEY+'-antes-v21'))localStorage.setItem(KEY+'-antes-v21',raw)}catch{}
    state.versao=4;
    if(!Array.isArray(state.parcial))state.parcial=['2026-11-18'];
    save();
  }
  if(!Array.isArray(state.parcial))state.parcial=[];
  try { if(!safeStorageGet(KEY+'-antes-v5')) localStorage.setItem(KEY+'-antes-v5', JSON.stringify(state)); } catch {}
  if(!state.fornecedores||typeof state.fornecedores!=='object'||Array.isArray(state.fornecedores))state.fornecedores={};
}
const n=r=>round2(r.valor);
const paid=id=>sum(state.registros.filter(r=>['pagamento','recebimento'].includes(r.tipo)&&r.vinculo===id).map(n));
const initialSaleReceived=r=>Array.isArray(r.recebimentos)?round2(sum(r.recebimentos.map(p=>p.valor))-(Number(r.troco?.valor||0)+Number(r.trocoPendente||0))):0;
const restante=r=>Math.max(0,round2(n(r)-paid(r.id)-(r.tipo==='venda'?initialSaleReceived(r):0)));
// Troco prometido ao cliente: reserva no disponível, sem saída física até a entrega.
const trocoPendenteAberto=r=>r&&r.tipo==='venda'?Math.max(0,round2(Number(r.trocoPendente||0)-sum(state.registros.filter(x=>x.tipo==='ajuste'&&x.trocoLiquidacao===true&&x.vinculo===r.id).map(x=>-Number(x.valor||0))))):0;
const trocoReservado=()=>sum(state.registros.filter(r=>r.tipo==='venda').map(trocoPendenteAberto));
// Converte parte do troco previamente registrado como entregue em valor pendente.
function alterarTrocoPendente(r,novo,conta){
  const atual=round2(Number(r.trocoPendente||0));const diferenca=round2(novo-atual);
  const partes=trocoPartes(r.troco);
  if(diferenca>0){
    if(sum(partes.filter(p=>p.conta===conta).map(p=>p.valor))+.005<diferenca)return false;
    let faltando=diferenca;
    const order=[...partes.keys()].filter(i=>partes[i].conta===conta);
    for(const i of order){const take=Math.min(faltando,partes[i].valor);partes[i].valor=round2(partes[i].valor-take);faltando=round2(faltando-take);if(faltando<.005)break}
    if(faltando>.005)return false;
  }else if(diferenca<0){
    const part=partes.find(p=>p.conta===conta);if(part)part.valor=round2(part.valor-diferenca);
    else partes.push({conta,valor:-diferenca});
  }
  r.troco={valor:sum(partes.map(x=>x.valor)),conta:partes[0]?.conta||conta,partes:partes.filter(x=>x.valor>.005)};
  r.trocoPendente=round2(novo);
  r.trocoPendenteConta=conta;
  return true;
}
const isDebt=r=>['compra','despesa','investimento'].includes(r.tipo)&&r.status==='pendente';
const isReceivable=r=>['emprestimo','venda'].includes(r.tipo)&&r.status==='pendente';
function balance(){
  const b={...state.saldos};
  const delta=(conta,v)=>{if(!conta)return;b[conta]=round2((Number(b[conta])||0)+v)};
  for(const r of state.registros){
    if(r.legacy||r.semCaixa)continue;
    if(r.tipo==='venda'){
      if(Array.isArray(r.recebimentos)){
        for(const p of r.recebimentos)delta(p.conta,round2(n(p)-Number(p.taxa||0)));
        for(const parte of trocoPartes(r.troco))delta(parte.conta,-parte.valor);
      }else if(r.status==='quitado')delta(r.conta,n(r));
    }else if(r.tipo==='recebimento')delta(r.conta,n(r));
    else if(r.tipo==='pagamento'||r.tipo==='emprestimo'||(['compra','despesa','investimento'].includes(r.tipo)&&r.status==='quitado'))delta(r.conta,-n(r));
    else if(r.tipo==='ajuste')delta(r.conta,n(r));
  }
  return b;
}
function render(){
  const regs=state.registros;
  const vendas=regs.filter(r=>r.tipo==='venda'&&!r.semFaturamento);
  const faturamento=sum(vendas.map(n));
  const debts=regs.filter(r=>isDebt(r)&&restante(r)>0.001);
  const cobrar=regs.filter(r=>isReceivable(r)&&restante(r)>0.001);
  const pagar=sum(debts.map(restante)),receber=sum(cobrar.map(restante));
  const saldos=balance(),caixa=sum(Object.values(saldos));
  const pago=sum(regs.filter(r=>['compra','despesa','investimento'].includes(r.tipo)).map(r=>r.status==='quitado'?n(r):paid(r.id)));
  el('faturamento').textContent=money(faturamento);el('totalVendas').textContent='TOTAL '+money(faturamento);
  el('caixa').textContent=el('caixa2').textContent=money(caixa);
  el('pagar').textContent=el('pendente').textContent=money(pagar);
  el('pago').textContent=money(pago);el('receber').textContent=money(receber);
  el('situacao').textContent=caixa>=pagar?`Após quitar as pendências, sobram ${money(caixa-pagar)}.`:`Ainda faltam ${money(pagar-caixa)} para quitar as pendências.`;
  const dates=[...new Set([...vendas.map(r=>r.data),'2026-11-16'])].sort();
  const latest=dates.at(-1)||'2026-11-18';
  el('periodo').textContent=`14/11/2026 A ${niceDate(latest)}`;
  el('dias').innerHTML=dates.map(d=>{const v=sum(vendas.filter(r=>r.data===d).map(n));const dt=new Date(d+'T12:00:00');const label=dt.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).toUpperCase();return `<div class="tile"><small>${label}</small><strong>${money(v)}</strong><button type="button" class="secondary smallBtn" style="margin-top:10px;width:100%" data-view-day="${d}">Ver recebimentos</button>${state.parcial.includes(d)?'<small class="orange">Parcial</small>':''}</div>`}).join('');
  const line=r=>`<div class="entry"><span class="scrollText">${esc(r.descricao)}${r.status==='pendente'?`<br><small class="muted">Restante: ${money(restante(r))}</small>`:''}</span><b>${money(r.status==='pendente'?restante(r):n(r))}</b></div>`;
  el('listaPagos').innerHTML=regs.filter(r=>['compra','despesa','investimento'].includes(r.tipo)&&(r.status==='quitado'||paid(r.id)>0)).map(r=>r.status==='quitado'?line(r):`<div class="entry"><span>${esc(r.descricao)} (parcial)</span><b>${money(paid(r.id))}</b></div>`).join('')||'<small class="muted">Nenhum</small>';
  el('listaPendentes').innerHTML=debts.map(line).join('')||'<small class="muted">Nenhum</small>';
  el('contas').innerHTML=Object.entries(saldos).map(([k,v])=>`<div class="entry"><span class="muted">${esc(k)}</span><b>${money(v)}</b></div>`).join('');
  el('receberLista').innerHTML=cobrar.map(r=>`<div class="entry"><span class="muted scrollText">${esc(r.pessoa||r.descricao)} (${r.tipo==='venda'?'fiado':'empréstimo'})</span><b>${money(restante(r))}</b></div>`).join('')||'<small class="muted">Nenhum</small>';
  const fiados=sum(cobrar.filter(r=>r.tipo==='venda').map(restante));
  el('cenarios').innerHTML=[['SOMENTE O CAIXA',caixa],['CAIXA + FIADOS',caixa+fiados],['CAIXA + TODOS A RECEBER',caixa+receber]].map(([label,val],i)=>`<div class="scenario"><small>${i+1} • ${label}</small><strong>${money(val)}</strong><small>${val>=pagar?'SOBRAM':'FALTAM'}</small><div class="${val>=pagar?'greenText':'red'}">${money(Math.abs(pagar-val))}</div></div>`).join('');
  el('resumo').innerHTML=`<span class="orange">RESUMO DA DECISÃO</span><div style="margin-top:7px">${caixa+receber<pagar?`Mesmo após receber todos os ${money(receber)}, ainda faltarão ${money(pagar-caixa-receber)} para quitar as pendências.`:`Se todos pagarem, será possível quitar as pendências e restarão ${money(caixa+receber-pagar)}.`}</div>`;
  const salesByProduct=new Map();const stock=new Map();
  const addStock=(p,u,q)=>{const key=p+'|'+u;stock.set(key,round2((stock.get(key)||0)+q))};
  for(const r of regs){
    if(r.tipo==='compra'&&r.produto&&r.quantidade)addStock(r.produto,r.unidade||'kg',Number(r.quantidade));
    if(r.tipo==='estoque'&&r.produto&&r.quantidade)addStock(r.produto,r.unidade||'kg',Number(r.quantidade));
    if(r.tipo==='venda'&&Array.isArray(r.itens))for(const i of r.itens){
      salesByProduct.set(i.produto,round2((salesByProduct.get(i.produto)||0)+Number(i.total||0)));
      addStock(i.produto,i.unidade||'kg',-Number(i.quantidade||0));
    }
  }
  el('vendasProdutos').innerHTML=PRODUCTS.map(p=>`<div class="stocktile"><small>${esc(p)}</small><strong>${money(salesByProduct.get(p)||0)}</strong><small>Vendas discriminadas</small></div>`).join('');
  const byMethod=new Map();let trocosDetalhados=0,taxasDetalhadas=0;
  for(const r of regs.filter(r=>r.tipo==='venda'&&Array.isArray(r.recebimentos))){
    for(const p of r.recebimentos){byMethod.set(p.metodo||'Não informada',round2((byMethod.get(p.metodo||'Não informada')||0)+Number(p.valor||0)));taxasDetalhadas=round2(taxasDetalhadas+Number(p.taxa||0))}
    trocosDetalhados=round2(trocosDetalhados+Number(r.troco?.valor||0));
  }
  const methods=['Dinheiro','Pix','Débito','Crédito à vista','Crédito parcelado'];
  el('pagamentosPorForma').innerHTML=[...methods,...[...byMethod.keys()].filter(k=>!methods.includes(k))].map(m=>`<div class="stocktile"><small>${esc(m)}</small><strong>${money(byMethod.get(m)||0)}</strong><small>Recebimentos brutos</small></div>`).join('');
  el('recebidoLiquidoDetalhado').textContent=money(sum([...byMethod.values()])-trocosDetalhados-taxasDetalhadas);
  el('trocosDetalhados').textContent='Trocos devolvidos: '+money(trocosDetalhados)+' • Taxas informadas: '+money(taxasDetalhadas)+'.';

  renderDailyMethods();
  renderSuppliers(saldos);
  el('estoque').innerHTML=PRODUCTS.map(p=>{const a=[...stock.entries()].filter(([k])=>k.startsWith(p+'|'));return `<div class="stocktile"><small>${esc(p)}</small><strong>${a.length?a.map(([k,v])=>fmtQty(v,k.split('|')[1])).join(' + '):'Sem quantidade inicial'}</strong><small>Movimentações detalhadas</small></div>`}).join('');
  const history=[...regs].sort((a,b)=>b.data.localeCompare(a.data)||(b.criadoEm||'').localeCompare(a.criadoEm||''));
  const dateFilter=el('filtroHistoricoData').value,typeFilter=el('filtroHistoricoTipo').value;
  const filteredHistory=history.filter(r=>(!dateFilter||r.data===dateFilter)&&(!typeFilter||r.tipo===typeFilter));
  el('filtroBtn').textContent=recentes?'Ver todos':'Ver só recentes';
  el('historico').innerHTML=(recentes?filteredHistory.slice(0,8):filteredHistory).map(r=>{const extra=r.tipo==='venda'&&Array.isArray(r.itens)?`<br><small>${r.itens.map(i=>`${esc(i.produto)}${i.detalhe?' — '+esc(i.detalhe):''}: ${money(i.total)}${Number(i.quantidade)>0?' ('+fmtQty(i.quantidade,i.unidade)+')':''}`).join(' • ')}${r.troco?.valor?` • Troco: ${money(r.troco.valor)} (${trocoPartes(r.troco).map(p=>`${money(p.valor)} em ${esc(p.conta)}`).join(' + ')})`:''}</small>`:r.tipo==='compra'&&r.precoVendaRef?`<br><small>Venda referência: ${money(r.precoVendaRef)}/${esc(r.unidade||'kg')}</small>`:'';
    return `<div class="record"><div class="line"><strong class="scrollText">${esc(r.descricao)}</strong><strong>${r.tipo==='estoque'?fmtQty(r.quantidade,r.unidade):money(n(r))}</strong></div><small>${niceDate(r.data)} • ${esc(r.tipo)} • ${esc(r.status||'')} ${r.legacy?'• Saldo inicial':''} ${r.vinculo?'• vinculado':''}</small>${extra}${r.legacy?'<small class="muted"> • Inicial protegido</small>':`<div class="recordActions"><button type="button" class="secondary smallBtn deleteRecord" data-delete="${esc(r.id)}">Excluir lançamento</button></div>`}</div>`}).join('')||'<p class="hint">Nenhuma movimentação encontrada nesse filtro.</p>';
  refreshLinks();updateDayStatus();renderSpreadsheetHistory();renderSalesDay();
}
function supplierStatus(r){
  const remaining=r.status==='pendente'?restante(r):0;
  if(remaining<0.005)return {label:'PAGO',style:'ok'};
  const done=paid(r.id);
  return done>0.005?{label:'PARCIAL',style:'partial'}:{label:'PENDENTE',style:'due'};
}
function supplierRow(r){
 const info=supplierInfo(r),status=supplierStatus(r),unit=info.unidade||'kg',remaining=supplierDue(r);
 const payments=state.registros.filter(p=>p.tipo==='pagamento'&&p.vinculo===r.id).sort((a,b)=>a.data.localeCompare(b.data));
 const card=(title,date,q,price,total,extra='')=>`<div class="supplierLine abr-purchase-compact"><div class="supplierLineHead"><strong>${esc(title)}</strong><span class="status ${status.style}">${status.label}</span></div><small class="abr-purchase-date">COMPRA EM ${niceDate(date)}</small><div class="abr-purchase-metrics"><strong>${q>0?fmtQty(q,unit):'—'}</strong><span>${price>0?money(price)+' por '+esc(unit):'Preço não informado'}</span></div><div class="entry"><span>Valor da compra</span><b>${money(total)}</b></div>${extra}</div>`;
 if(info.lotes?.length)return info.lotes.map((l,i)=>card(`${i+1}ª banda`,l.data,l.quantidade,info.preco,l.quantidade*info.preco,'<small>Pagamento: data não informada</small>')).join('')+`<div class="supplierLine"><small>Desconto conjunto: −${money(info.desconto)}</small><div class="entry"><span>Total pago</span><b>${money(n(r))}</b></div></div>`;
 const title=r.detalhe||String(r.descricao||info.produto||'Mercadoria').replace(/^Carne bovina — /,'');
 const extra=`${info.desconto>0?`<small>Desconto: ${money(info.desconto)}</small>`:''}<small>Pagamento: ${payments.length?niceDate(payments.at(-1).data):'a informar'}</small>${payments.length?`<details><summary>Pagamentos (${payments.length})</summary>${payments.map(p=>`<div class="entry"><span>${niceDate(p.data)}</span><b>${money(n(p))}</b></div>`).join('')}</details>`:''}${remaining>0?`<div class="entry"><span>Falta pagar</span><b class="red">${money(remaining)}</b></div>`:''}<div class="abr-row-buttons">${remaining>0?`<button type="button" class="secondary smallBtn" data-abr-simulate="${esc(r.id)}">Simular</button><button type="button" class="smallBtn" data-abr-confirm="${esc(r.id)}">Pagar</button>`:''}${!r.legacy?`<button type="button" class="secondary smallBtn" data-edit-purchase="${esc(r.id)}" aria-label="Editar compra">✎</button>`:''}</div>`;
 return card(title,r.data,Number(info.quantidade),Number(info.preco),n(r),extra);
}
function editPurchase(id){
 const r=state.registros.find(x=>x.id===id&&x.tipo==='compra'&&!x.legacy);if(!r)return;
 const d=document.getElementById('abr-edit-purchase');const f=d.querySelector('form');
 for(const k of ['data','quantidade','preco','desconto','pessoa','produto','unidade','descricao'])f.elements[k].value=r[k]??(k==='desconto'?0:'');
 f.onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(f));const quantidade=Number(v.quantidade),preco=Number(v.preco),desconto=Number(v.desconto),valor=round2(quantidade*preco-desconto);if(!v.data||quantidade<=0||preco<=0||desconto<0||valor<=0||valor<paid(id)){alert('Confira os valores. O total não pode ser menor que os pagamentos vinculados.');return;}if(!confirm('Salvar alteração? O valor da compra e os saldos serão recalculados.'))return;const old={...r};Object.assign(r,v,{quantidade,preco,desconto,valor});if(!save()){Object.assign(r,old);return;}d.close();render();};d.showModal();
}
// Fornecedores são separados por nome E mercadoria: não mistura contas de
// dois fornecedores diferentes da mesma categoria em um extrato.
function supplierGroups(){
  const groups=new Map();
  for(const r of state.registros){
    if(r.tipo!=='compra')continue;
    const cat=supplierCategory(r);
    if(!cat)continue;
    const vendor=String(r.pessoa||state.fornecedores[cat]||supplierTitle(cat)).trim();
    const normalized=vendor.toLocaleLowerCase('pt-BR');
    const key=cat+'|'+normalized;
    if(!groups.has(key))groups.set(key,{key,cat,name:vendor,regs:[]});
    groups.get(key).regs.push(r);
  }
  return [...groups.values()].sort((a,b)=>{
    const order=SUPPLIER_CATEGORIES.indexOf(a.cat)-SUPPLIER_CATEGORIES.indexOf(b.cat);
    return order||a.name.localeCompare(b.name,'pt-BR');
  });
}
function supplierPaid(r){return r.status==='quitado'?n(r):paid(r.id)}
function supplierDue(r){return r.status==='pendente'?restante(r):0}
function renderSuppliers(){
  const root=el('painelFornecedores');
  const groups=supplierGroups();
  if(!groups.length){root.innerHTML='<p class="hint">Nenhuma compra cadastrada. Registre uma compra em Lançamentos para começar.</p>';return}
  root.innerHTML=groups.map(group=>{
    const regs=[...group.regs].sort((a,b)=>a.data.localeCompare(b.data)||(a.criadoEm||'').localeCompare(b.criadoEm||''));
    const total=sum(regs.map(n)),pago=sum(regs.map(supplierPaid)),falta=sum(regs.map(supplierDue));
    const label=group.cat==='Carne bovina'?'CARNE BOVINA':group.cat.toLocaleUpperCase('pt-BR');
    return `<article class="abr-supplier-card" data-supplier-category="${esc(group.cat)}" data-supplier-key="${esc(group.key)}">
      <div class="abr-supplier-main"><div class="abr-supplier-identity"><small>${esc(label)}</small><h3>${esc(group.name)}</h3></div>
      <div class="abr-supplier-balance"><small>FALTA PAGAR</small><strong class="${falta>0?'red':'greenText'}">${money(falta)}</strong></div></div>
      <div class="abr-supplier-subtotals"><span>Compramos <b>${money(total)}</b></span><span>Já pagamos <b>${money(pago)}</b></span></div>
      <div class="abr-supplier-actions"><button type="button" class="secondary" data-abr-supplier-statement="${esc(group.key)}">▤ Extrato para fornecedor</button></div>
      <details class="abr-supplier-more" data-abr-ui-key="${esc(group.key)}"><summary>Ver negociação e pagamentos</summary>
        <div class="abr-supplier-more-body">
          <p class="abr-supplier-detail-label">Entregas e pagamentos deste fornecedor</p>
          ${regs.map(supplierRow).join('')}
          <div class="abr-supplier-edit"><label>Nome padrão para novas compras de ${esc(group.cat)}</label>
          <div class="supplierInput"><input class="supplierName" aria-label="Nome padrão de fornecedor" value="${esc(state.fornecedores[group.cat]||'')}" placeholder="Nome do fornecedor"/><button type="button" class="secondary smallBtn saveSupplier" data-save-supplier="${esc(group.cat)}">Salvar</button></div></div>
          <button type="button" class="secondary smallBtn abr-supplier-add" data-buy-supplier="${esc(group.cat)}" data-buy-vendor="${esc(group.name)}">＋ Registrar outra compra</button>
        </div>
      </details>
    </article>`;
  }).join('');
}
// Extrato externo: exclusivamente compras, entregas, descontos e pagamentos
// vinculados ao fornecedor escolhido. Não inclui caixa, Pix, clientes,
// vendas, empréstimos, simulações ou dados de outros fornecedores.
let currentSupplierStatementText='';
function supplierStatementRows(group){
  const purchaseRows=[],paymentRows=[];
  const regs=[...group.regs].sort((a,b)=>a.data.localeCompare(b.data));
  for(const r of regs){
    const info=supplierInfo(r),unit=info.unidade||'kg';
    const quantity=Number(info.quantidade||0),price=Number(info.preco||0);
    const qtyLabel=quantity>0?fmtQty(quantity,unit):'Quantidade não informada';
    const unitPrice=price>0?` • ${money(price)}/${unit}`:'';
    if(Array.isArray(info.lotes)&&info.lotes.length){
      info.lotes.forEach((lot,i)=>purchaseRows.push({date:lot.data,description:`${i+1}ª banda de boi — ${fmtQty(lot.quantidade,unit)} • ${money(price)}/${unit}`,amount:round2(lot.quantidade*price)}));
      if(Number(info.desconto)>0)purchaseRows.push({date:'—',description:'Descontos combinados das duas bandas',amount:-round2(info.desconto)});
    }else{
      const detail=String(r.detalhe||'').trim();
      const label=(r.id==='c3'?'3ª banda de boi':
        r.id==='70ad7b7e-8d7d-4711-a7c9-b270a4de6cdc'?'4ª banda de boi':
        detail?`${info.produto||group.cat} — ${detail}`:info.produto||group.cat);
      purchaseRows.push({date:r.data,description:`${label} — ${qtyLabel}${unitPrice}`,amount:n(r)});
    }
    const related=state.registros.filter(p=>p.tipo==='pagamento'&&p.vinculo===r.id).sort((a,b)=>a.data.localeCompare(b.data));
    if(r.status==='quitado'){
      // A compra foi marcada como quitada, mas não existe data separada
      // do pagamento original. Nunca inventar essa data.
      paymentRows.push({date:'—',description:'Compra registrada como já paga (data do pagamento não informada)',amount:n(r)});
    }else{
      for(const p of related)paymentRows.push({date:p.data,description:'Pagamento registrado',amount:n(p)});
    }
  }
  return {purchaseRows,paymentRows};
}
function showSupplierStatement(key){
  const group=supplierGroups().find(g=>g.key===key);
  if(!group)return;
  const {purchaseRows,paymentRows}=supplierStatementRows(group);
  const total=sum(group.regs.map(n)),pago=sum(group.regs.map(supplierPaid)),falta=sum(group.regs.map(supplierDue));
  const rowHtml=rows=>rows.length?rows.map(r=>`<tr><td>${r.date==='—'?'—':niceDate(r.date)}</td><td>${esc(r.description)}</td><td class="abr-statement-money">${money(r.amount)}</td></tr>`).join(''):'<tr><td colspan="3">Nenhum registro</td></tr>';
  const content=`<div class="abr-statement-brand"><span>AÇOUGUE <b>ABR</b></span><small>EXTRATO PARA CONFERÊNCIA</small></div>
    <h2>${esc(group.name)}</h2><p class="abr-statement-subtitle">${esc(group.cat)} • Gerado em ${niceDate(today())}</p>
    <div class="abr-statement-summary"><div><small>COMPRAS</small><b>${money(total)}</b></div><div><small>PAGAMENTOS</small><b>${money(pago)}</b></div><div><small>SALDO A PAGAR</small><b>${money(falta)}</b></div></div>
    <h3>Entregas e valores combinados</h3><table><thead><tr><th>Data</th><th>Mercadoria / quantidade</th><th>Valor</th></tr></thead><tbody>${rowHtml(purchaseRows)}</tbody></table>
    <h3>Pagamentos registrados</h3><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${rowHtml(paymentRows)}</tbody></table>
    <p class="abr-statement-disclaimer">Extrato de conferência de compras e pagamentos. Não substitui nota fiscal nem recibo de quitação. Valores sujeitos à conferência entre as partes.</p>`;
  currentSupplierStatementText=[
    'AÇOUGUE ABR — EXTRATO PARA CONFERÊNCIA',
    `Fornecedor: ${group.name} (${group.cat})`,
    `Compras: ${money(total)} | Pagamentos: ${money(pago)} | Saldo a pagar: ${money(falta)}`,
    '', 'ENTREGAS E VALORES COMBINADOS',
    ...purchaseRows.map(r=>`${r.date==='—'?'—':niceDate(r.date)} | ${r.description} | ${money(r.amount)}`),
    '', 'PAGAMENTOS REGISTRADOS',
    ...paymentRows.map(r=>`${r.date==='—'?'—':niceDate(r.date)} | ${r.description} | ${money(r.amount)}`),
    '', 'Documento para conferência, não substitui nota fiscal ou recibo.'
  ].join('\n');
  el('abr-statement-content').innerHTML=content;
  const dialog=el('abr-supplier-statement-dialog');
  if(!dialog.open)dialog.showModal();
}
function printSupplierStatement(){
  // Janela isolada: nem mesmo o HTML da tela privada é enviado à impressão.
  const popup=window.open('','_blank');
  if(!popup){alert('O navegador bloqueou a janela. Permita pop-ups para imprimir o extrato.');return}
  const content=el('abr-statement-content').innerHTML;
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Extrato do fornecedor • Açougue ABR</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f2f3f5;color:#111;font:14px Arial,sans-serif}.paper{max-width:790px;margin:25px auto;padding:36px;background:#fff;box-shadow:0 3px 16px #0001}.abr-statement-brand{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #bf2739;padding-bottom:13px}.abr-statement-brand span{font-size:16px;font-weight:700}.abr-statement-brand b{font-size:28px}.abr-statement-brand small{font-size:11px;letter-spacing:1px}.paper h2{font-size:23px;margin:25px 0 4px}.abr-statement-subtitle{color:#666;margin:0 0 22px}.abr-statement-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0}.abr-statement-summary div{padding:12px;border:1px solid #ddd;border-radius:7px}.abr-statement-summary small{display:block;font-size:10px;color:#555;margin-bottom:6px}.abr-statement-summary b{font-size:17px}.paper h3{font-size:15px;margin:25px 0 9px}.paper table{width:100%;border-collapse:collapse}.paper th,.paper td{padding:9px 7px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.paper th{background:#f3f3f3;font-size:12px}.paper td:first-child{white-space:nowrap;width:85px}.abr-statement-money{text-align:right!important;white-space:nowrap}.abr-statement-disclaimer{color:#555;font-size:11px;margin-top:30px;line-height:1.5}.tools{position:sticky;top:0;display:flex;justify-content:center;gap:10px;background:#222;padding:12px}.tools button{border:0;border-radius:7px;padding:10px 18px;font-weight:700;cursor:pointer}.tools button:first-child{background:#36d4a2}.tools button:last-child{background:#ddd}@page{size:A4;margin:14mm}@media print{body{background:#fff}.paper{max-width:none;margin:0;padding:0;box-shadow:none}.tools{display:none}.paper tr{break-inside:avoid}}
  </style></head><body><div class="tools"><button onclick="window.print()">Imprimir / Salvar PDF</button><button onclick="window.close()">Fechar</button></div><div class="paper">${content}</div></body></html>`);
  popup.document.close();
  try{popup.opener=null;popup.focus()}catch{}
}

function saveSupplierName(cat,value){
  if(!SUPPLIER_CATEGORIES.includes(cat))return;
  const old=state.fornecedores[cat];state.fornecedores[cat]=value.trim();
  if(!save()){state.fornecedores[cat]=old;return}
  render();
}
function startSupplierPurchase(cat,vendor){
  if(!SUPPLIER_CATEGORIES.includes(cat))return;
  el('tipo').value='compra';toggleFormType();
  el('produtoCompra').value=cat;
  el('fornecedorCompra').value=vendor||state.fornecedores[cat]||'';
  el('data').value=today();
  el('form').classList.remove('hidden');
  updatePurchasePreview();
  el('movimentacao').scrollIntoView({behavior:'smooth',block:'start'});
  el('qtdCompra').focus({preventScroll:true});
}
function startSupplierPayment(id){
  const original=state.registros.find(r=>r.id===id);
  if(!original||!isDebt(original)||restante(original)<=0)return;
  el('tipo').value='pagamento';toggleFormType();
  el('vinculo').value=id;
  const cat=supplierCategory(original);
  el('descricaoGeral').value=`Pagamento — ${cat||original.descricao}`;
  el('pessoaGeral').value=original.pessoa||state.fornecedores[cat]||'';
  el('valorGeral').value=restante(original).toFixed(2);
  el('contaGeral').value='Espécie';
  el('data').value=today();
  el('form').classList.remove('hidden');
  el('movimentacao').scrollIntoView({behavior:'smooth',block:'start'});
  el('valorGeral').focus({preventScroll:true});
}
function refreshLinks(){
  const tipo=el('tipo').value;
  const eligible=state.registros.filter(r=>(tipo==='pagamento'?isDebt(r):isReceivable(r))&&restante(r)>0.001);
  const previous=el('vinculo').value;
  el('vinculo').innerHTML='<option value="">Selecione...</option>'+eligible.map(r=>`<option value="${esc(r.id)}">${esc(r.descricao)} — ${money(restante(r))}</option>`).join('');
  if(eligible.some(r=>r.id===previous))el('vinculo').value=previous;
}
function updateDayStatus(){const d=el('diaFechamento').value||'2026-11-18';el('estadoDia').textContent=`${niceDate(d)}: ${state.parcial.includes(d)?'PARCIAL (ainda aberto)':'FECHADO (sem indicação de parcial)'}.`}
// No caixa do açougue o valor já vem calculado da balança.
// O vendedor informa somente o valor efetivamente COBRADO, sem digitar kg ou preço/kg.
// Compras e ajustes de estoque continuam com peso, como antes.
function addItem(){
  itemSequence++;
  const id='item'+itemSequence;
  const box=document.createElement('div');box.className='item abr-item-rapido';box.dataset.itemId=id;
  box.innerHTML=`<div class="abr-item-fields"><div><label>Valor da venda (R$)</label><input class="itemValor" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0,00" aria-label="Valor cobrado"></div><div><label>Mercadoria</label><select class="itemProduto">${productOptions()}</select></div></div><div class="abr-item-foot"><details class="abr-item-opcional"><summary>Corte / detalhe (opcional)</summary><input class="itemDetalhe" placeholder="Ex.: Picanha, coxa, linguiça" aria-label="Detalhe da mercadoria"></details><button type="button" class="secondary smallBtn removeItem">Remover</button></div>`;
  el('itensVenda').appendChild(box);
  if(el('itensVenda').children.length===1)box.querySelector('.removeItem').classList.add('hidden');
  return box;
}
function getItems(){
  return [...el('itensVenda').querySelectorAll('.item')].map(box=>{
    const get=cls=>box.querySelector(cls);
    const valorRaw=get('.itemValor').value;
    const total=valorRaw===''?NaN:round2(Number(valorRaw));
    return {produto:get('.itemProduto').value,detalhe:get('.itemDetalhe').value.trim(),unidade:'valor',quantidade:null,precoVenda:null,total};
  });
}
function saleTotal(){return sum(getItems().map(i=>i.total))}
// As quatro opções visíveis determinam a conta; cartão sempre vai à Maquininha.
function paymentAccount(choice){
  return ({'Espécie':'Espécie cédulas','Moeda':'Espécie moedas','Pix':'Pix','Maquininha':'Maquininha'})[choice]||'';
}
// Mercado Pago: taxas informadas pelo estabelecimento, recebimento na hora.
// Point: débito 1,67%; crédito à vista 3,89%.
// Tap: débito 0,89%; crédito à vista 3,09%.
const ABR_CARD_RATES={Point:{'Débito':1.67,'Crédito à vista':3.89},Tap:{'Débito':0.89,'Crédito à vista':3.09}};
function cardRate(i){
  const channel=el('canal'+i).value,kind=el('cartao'+i).value;
  return ABR_CARD_RATES[channel]?.[kind]??0;
}
function syncCardFee(i){
  const field=el('taxa'+i),isCard=el('metodo'+i).value==='Maquininha';
  const preview=el('abr-fee-preview'+i);
  if(!isCard){field.value='';delete field.dataset.userEdited;preview.textContent='';return}
  const gross=round2(num('recebido'+i)),rate=cardRate(i);
  if(!field.dataset.userEdited)field.value=(Math.round(cents(gross)*rate/100)/100).toFixed(2);
  const fee=round2(num('taxa'+i));
  preview.textContent=`${rate.toFixed(2).replace('.',',')}% • Taxa ${money(fee)} • Líquido ${money(Math.max(0,round2(gross-fee)))}`;
}
function paymentEntry(i){
  const choice=el('metodo'+i).value,isCard=choice==='Maquininha';
  return {metodo:isCard?el('cartao'+i).value:choice==='Pix'?'Pix':'Dinheiro',conta:paymentAccount(choice),valor:round2(num('recebido'+i)),taxa:isCard?round2(num('taxa'+i)):0,...(isCard?{canal:el('canal'+i).value,taxaPercentual:cardRate(i),taxaAutomatica:!el('taxa'+i).dataset.userEdited}: {})};
}
function updatePaymentFields(i){
  const choice=el('metodo'+i).value;
  const attr=i===1?'data-abr-fast-method':'data-abr-fast-method2';
  document.querySelectorAll('['+attr+']').forEach(b=>{
    const active=b.getAttribute(attr)===choice;
    b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
  el('conta'+i).value=paymentAccount(choice);
  const isCard=choice==='Maquininha';
  el('cartaoBox'+i).classList.toggle('hidden',!isCard);
  const fee=el('taxa'+i),wrap=fee.closest('.abr-fee-fold');
  wrap.classList.toggle('hidden',!isCard);
  if(!isCard){fee.value='';delete fee.dataset.userEdited;wrap.open=false}
  syncCardFee(i);
}
function syncCardButtons(i){
  for(const [attr,value] of [['data-abr-card-kind',el('cartao'+i).value],['data-abr-card-channel',el('canal'+i).value]]){
    document.querySelectorAll('['+attr+']').forEach(b=>{
      const active=b.getAttribute(attr)===i+':'+value;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
  }
}
function updateSecondPaymentLayout(){
  const coin=el('metodo1').value==='Moeda';
  if(coin){el('pagamentoMisto').checked=true;if(el('metodo2').value==='Moeda')el('metodo2').value='Espécie'}
  el('pagamentoMistoRow').classList.toggle('hidden',coin);
  el('segundaForma').classList.toggle('hidden',!el('pagamentoMisto').checked);
  updatePaymentFields(1);updatePaymentFields(2);syncCardButtons(1);syncCardButtons(2);
}
function fillRemainderIfCoins(){
  if(el('metodo1').value!=='Moeda'||!el('pagamentoMisto').checked||el('recebido2').dataset.userEdited)return;
  const total=saleTotal();
  const remaining=Math.max(0,round2(total-num('recebido1')));
  el('recebido2').value=total>0?remaining.toFixed(2):'';
}
function syncTrocoButtons(){
  for(const [id,attribute] of [['contaTroco','data-abr-change-method'],['contaTroco2','data-abr-change-method2']]){
    const chosen=el(id).value;
    document.querySelectorAll('['+attribute+']').forEach(b=>{
      const active=b.getAttribute(attribute)===chosen;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
  }
}
// Divisão de troco é opcional. A segunda parcela é calculada, evitando erro de soma.
function showTrocoSplit(troco){
  const temTroco=troco>0.001&&!el('fiadoVenda').checked;
  el('abr-troco-opcoes').classList.toggle('hidden',!temTroco);
  if(!temTroco){el('dividirTroco').checked=false;el('trocoParte1').value=''}
  const dividido=temTroco&&el('dividirTroco').checked;
  el('abr-troco-dividido').classList.toggle('hidden',!dividido);
  el('trocoErro').classList.add('hidden');el('trocoErro').textContent='';
  if(!dividido)return null;
  const input=el('trocoParte1');const raw=input.value;
  if(raw===''){el('trocoParte2').textContent=money(troco);return {valid:false,reason:'Informe o valor da 1ª forma de troco.'}}
  const v1=round2(Number(raw));const v2=round2(troco-v1);
  el('trocoParte2').textContent=money(Math.max(0,v2));
  const invalid=!Number.isFinite(v1)||v1<=0||v2<=0;
  const same=el('contaTroco').value===el('contaTroco2').value;
  if(invalid||same){
    const reason=invalid?'A 1ª forma deve ser maior que zero e menor que o troco total.':'Escolha duas formas diferentes de troco.';
    el('trocoErro').textContent=reason;el('trocoErro').classList.remove('hidden');
    return {valid:false,reason};
  }
  return {valid:true,partes:[{conta:el('contaTroco').value,valor:v1},{conta:el('contaTroco2').value,valor:v2}]};
}
function saleTrocoObject(total){
  if(total<=0)return null;
  if(!el('dividirTroco').checked)return {valor:total,conta:el('contaTroco').value};
  const split=showTrocoSplit(total);
  if(!split||!split.valid){alert(split?.reason||'Confira a divisão do troco.');return false}
  return {valor:total,conta:split.partes[0].conta,partes:split.partes};
}
function updateSalePreview(autofill=false){
  syncTrocoButtons();
  const items=getItems();const invalid=items.some(i=>!Number.isFinite(i.total)||i.total<=0);
  const total=invalid?0:sum(items.map(i=>i.total));
  el('totalVenda').textContent=money(total);
  el('vendaBox').classList.toggle('abr-multi-item',items.length>1);
  el('pagamentoVenda').classList.toggle('abr-has-troco',!el('fiadoVenda').checked&&sum([num('recebido1'),el('pagamentoMisto').checked?num('recebido2'):0])-total>0.005);
  if(autofill&&!el('recebido1').dataset.userEdited&&!el('fiadoVenda').checked)el('recebido1').value=total?total.toFixed(2):'';
  fillRemainderIfCoins();
  syncCardFee(1);syncCardFee(2);
  const bruto=el('fiadoVenda').checked?0:sum([num('recebido1'),el('pagamentoMisto').checked?num('recebido2'):0]);
  const troco=Math.max(0,round2(bruto-total));const falta=Math.max(0,round2(total-bruto));
  el('trocoPrevisto').textContent=money(total?troco:0);
  const split=showTrocoSplit(troco);
  // A previsão informa apenas o troco entregue agora; a reserva não sai fisicamente do caixa.
  const pendenteInformado=el('abr-pending-toggle')?.checked?Math.max(0,round2(num('abr-pending-new'))):0;
  const pendenteValido=pendenteInformado<=troco+.005;
  const entregarAgora=Math.max(0,round2(troco-Math.min(troco,pendenteInformado)));
  const notice=el('situacaoVenda');
  let text='';
  if(total>0&&el('fiadoVenda').checked)text=`Fiado: ${money(total)}. Informe o cliente.`;
  else if(total>0&&falta>0)text=`Falta receber ${money(falta)} — informe o cliente.`;
  else if(total>0&&troco>0){
    if(!pendenteValido)text='O troco pendente não pode ser maior que o troco calculado.';
    else if(el('dividirTroco').checked){
      if(!split?.valid)text=split?.reason||'Confira a divisão do troco.';
      else if(pendenteInformado>.005){
        const restante=[...split.partes];let reservar=pendenteInformado;
        for(const parte of restante){const desconto=Math.min(reservar,parte.valor);parte.valor=round2(parte.valor-desconto);reservar=round2(reservar-desconto)}
        text=restante.filter(p=>p.valor>.005).map(p=>`Devolver ${money(p.valor)} em ${esc(p.conta==='Espécie cédulas'?'Cédulas':p.conta==='Espécie moedas'?'Moedas':p.conta)}`).join(' + ')+(restante.some(p=>p.valor>.005)?'. ':'')+`Pendente: ${money(pendenteInformado)}.`;
      }else text=`Devolver ${money(split.partes[0].valor)} em ${esc(el('contaTroco').selectedOptions[0].textContent)} + ${money(split.partes[1].valor)} em ${esc(el('contaTroco2').selectedOptions[0].textContent)}.`;
    }else text=`${entregarAgora>.005?`Devolver ${money(entregarAgora)} em ${esc(el('contaTroco').selectedOptions[0].textContent)}.`:'Nenhum troco a entregar agora.'}${pendenteInformado>.005?' Pendente: '+money(pendenteInformado)+'.':''}`;
  }
  notice.innerHTML=text;notice.classList.toggle('hidden',!text);
}
function updatePurchasePreview(){
  const qtd=num('qtdCompra'),custo=num('custoCompra'),venda=num('precoVendaCompra'),desconto=num('descontoCompra');
  const total=round2(qtd*custo-desconto);el('totalCompra').textContent=money(Math.max(0,total));
  const aviso=el('lucroPrevisto');
  if(qtd<=0||custo<=0||venda<=0||total<=0){aviso.textContent='Informe peso, custo e preço de venda de referência para estimar a margem bruta. Não é lucro realizado.';return}
  const receita=round2(qtd*venda),lucro=round2(receita-total),margem=receita?100*lucro/receita:0;
  const beef=el('produtoCompra').value==='Carne bovina';
  aviso.innerHTML=`<b>${beef?'Referência teórica para bovino':'Margem bruta estimada do lote'}</b><br>Receita teórica: ${money(receita)} • Custo total: ${money(total)}<br>Diferença: <b class="${lucro>=0?'greenText':'red'}">${money(lucro)}</b> • Margem: ${margem.toFixed(1).replace('.',',')}%.<br>${beef?'Na carne bovina os cortes têm preços diferentes; esta projeção NÃO representa lucro real.':'Não desconta taxas, perdas, despesas e nem significa que o lote já foi vendido.'}`;
}
function toggleFormType(){
  const t=el('tipo').value;
  el('vendaBox').classList.toggle('hidden',t!=='venda');
  el('compraBox').classList.toggle('hidden',t!=='compra');
  if(t==='compra'&&!el('fornecedorCompra').value)el('fornecedorCompra').value=state.fornecedores[el('produtoCompra').value]||'';
  el('geralBox').classList.toggle('hidden',!['despesa','investimento','emprestimo','recebimento','pagamento','ajuste'].includes(t));
  el('estoqueBox').classList.toggle('hidden',t!=='estoque');
  el('statusGeralBox').classList.toggle('hidden',!['despesa','investimento'].includes(t));
  el('categoriaGeralBox').classList.toggle('hidden',!['despesa','investimento'].includes(t));
  el('vinculoBox').classList.toggle('hidden',!['recebimento','pagamento'].includes(t));
  const titles={investimento:'Investimento ou equipamento',despesa:'Despesa do açougue',emprestimo:'Empréstimo concedido',recebimento:'Receber fiado / empréstimo',pagamento:'Pagar fornecedor / despesa',ajuste:'Ajuste de caixa'};
  el('tituloGeral').textContent=titles[t]||'Movimentação';
  const hints={investimento:'Balanças e equipamentos são investimentos: reduzem o caixa quando pagos, mas não entram automaticamente como despesa operacional do período.',despesa:'Se ficar pendente, não reduz o caixa até registrar o pagamento.',emprestimo:'O dinheiro sai do caixa agora e fica como valor a receber.',recebimento:'Selecione o fiado ou empréstimo original. O valor recebido reduz o saldo a receber.',pagamento:'Selecione a compra ou despesa pendente. O valor pago reduz a dívida e o caixa.',ajuste:'Use valor positivo para entrada e negativo para saída. Descreva o motivo.'};
  el('ajudaGeral').textContent=hints[t]||'';refreshLinks();
}
function resetForm(){
  el('form').reset();el('data').value=today();if(el('abr-date-label'))el('abr-date-label').textContent='Hoje';el('itensVenda').innerHTML='';addItem();
  delete el('recebido1').dataset.userEdited;delete el('recebido2').dataset.userEdited;
  for(const i of [1,2]){delete el('taxa'+i).dataset.userEdited;el('canal'+i).value='Point';el('cartao'+i).value='Débito';el('taxa'+i).value='';el('taxa'+i).closest('.abr-fee-fold').open=false;syncCardButtons(i)}
  el('pagamentoVenda').classList.remove('hidden');el('metodo1').value='Espécie';el('metodo2').value='Espécie';
  el('dividirTroco').checked=false;el('trocoParte1').value='';el('contaTroco').value='Espécie cédulas';el('contaTroco2').value='Espécie moedas';
  el('abr-venda-extras').open=false;
  for(const id of ['abr-first-cut','abr-client-toggle']){el(id).setAttribute('aria-expanded','false');el(id).classList.remove('active')}
  updateSecondPaymentLayout();
  el('tipo').value='venda';toggleFormType();updateSalePreview();updatePurchasePreview();
}
function showSaveToast(message){
  let toast=el('abr-save-toast');
  if(!toast){toast=document.createElement('div');toast.id='abr-save-toast';toast.setAttribute('role','status');document.body.appendChild(toast)}
  toast.textContent='✓ '+message;toast.classList.add('show');
  clearTimeout(showSaveToast.timer);showSaveToast.timer=setTimeout(()=>toast.classList.remove('show'),2400);
}
function addRecord(record){
  state.registros.push(record);
  if(!save()){state.registros.pop();alert('Não foi possível salvar no aparelho. Faça um backup e verifique o espaço.');return false}
  render();resetForm();showSaveToast('Movimentação registrada');return true;
}
function submitForm(e){
  e.preventDefault();const tipo=el('tipo').value,data=el('data').value;
  if(!data){alert('Escolha a data da movimentação.');return}
  const base={id:uid(),tipo,data,criadoEm:new Date().toISOString()};
  if(tipo==='venda'){
    const itens=getItems();if(!itens.length||itens.some(i=>!Number.isFinite(i.total)||i.total<=0)){alert('Informe um valor cobrado maior que zero em cada mercadoria.');return}
    const total=sum(itens.map(i=>i.total));if(total<=0){alert('O valor da venda precisa ser maior que zero.');return}
    const fiado=el('fiadoVenda').checked;
    const entradas=fiado?[]:[paymentEntry(1),...(el('pagamentoMisto').checked?[paymentEntry(2)]:[])].filter(p=>p.valor>0);
    const bruto=sum(entradas.map(p=>p.valor)),trocoValor=Math.max(0,round2(bruto-total));
    const liquido=round2(bruto-trocoValor),pendente=Math.max(0,round2(total-liquido));
    const cliente=el('clienteVenda').value.trim();if(pendente>0&&!cliente){alert('Informe o nome do cliente para a parte fiada.');return}
    if(entradas.some(p=>!p.conta||p.taxa<0||p.taxa>p.valor)||!Number.isFinite(bruto)){alert('Confira as formas de pagamento e as taxas. A taxa não pode superar o valor recebido.');return}
    const troco=saleTrocoObject(trocoValor);if(troco===false)return;
    const pendenteTroco=el('abr-pending-toggle').checked?round2(num('abr-pending-new')):0;
    if(pendenteTroco<0||pendenteTroco>trocoValor+.005){alert('O troco pendente não pode superar o troco total da venda.');return}
    const trocoFinal=troco?structuredClone(troco):null;
    if(pendenteTroco>.005){
      const temp={tipo:'venda',troco:trocoFinal,trocoPendente:0};
      if(!alterarTrocoPendente(temp,pendenteTroco,el('contaTroco').value)){alert('Confira o troco pendente.');return}
      Object.assign(trocoFinal,temp.troco);
    }
    const descricao=itens.map(i=>i.produto+(i.detalhe?' — '+i.detalhe:'')).join(' + ');
    return addRecord({...base,descricao,pessoa:cliente,observacao:el('obsVenda').value.trim(),itens,valor:total,recebimentos:entradas,troco:trocoFinal,trocoPendente:pendenteTroco,trocoPendenteConta:pendenteTroco>.005?el('contaTroco').value:null,status:pendente>0?'pendente':'quitado'});
  }
  if(tipo==='compra'){
    const produto=el('produtoCompra').value,quantidade=num('qtdCompra'),preco=num('custoCompra'),desconto=num('descontoCompra'),valor=round2(quantidade*preco-desconto);
    if(quantidade<=0||preco<=0||desconto<0||valor<=0){alert('Confira a quantidade, o custo e o desconto. O total precisa ser positivo.');return}
    const detalhe=el('detalheCompra').value.trim();
    return addRecord({...base,produto,unidade:el('unidadeCompra').value,quantidade,preco,precoVendaRef:num('precoVendaCompra')||null,desconto,valor,descricao:produto+(detalhe?' — '+detalhe:''),pessoa:el('fornecedorCompra').value.trim(),status:el('statusCompra').value,conta:el('contaCompra').value});
  }
  if(tipo==='estoque'){
    const quantidade=num('qtdEstoque'),motivo=el('motivoEstoque').value.trim();
    if(!quantidade||!motivo){alert('Informe quantidade diferente de zero e motivo do ajuste.');return}
    return addRecord({...base,produto:el('produtoEstoque').value,unidade:el('unidadeEstoque').value,quantidade,valor:0,descricao:'Ajuste de estoque — '+motivo,status:'quitado'});
  }
  const valor=num('valorGeral'),descricao=el('descricaoGeral').value.trim(),pessoa=el('pessoaGeral').value.trim(),conta=el('contaGeral').value;
  if(!descricao){alert('Informe uma descrição.');return}
  if(!Number.isFinite(valor)||(!['ajuste'].includes(tipo)&&valor<=0)||(tipo==='ajuste'&&valor===0)){alert('Informe um valor válido. Para ajuste de caixa, use sinal negativo nas saídas.');return}
  let vinculo=null;
  if(['recebimento','pagamento'].includes(tipo)){
    vinculo=el('vinculo').value;const original=state.registros.find(r=>r.id===vinculo);
    if(!original||valor>restante(original)+0.001||((tipo==='pagamento')!==isDebt(original))){alert('Selecione um registro compatível e valor até o saldo pendente.');return}
  }
  if(tipo==='pagamento'){
    const disponivel=Number(balance()[conta])||0;
    if(valor>disponivel+0.001&&!confirm(`A conta ${conta} possui ${money(disponivel)}, mas você vai registrar o pagamento de ${money(valor)}. Isso deixará essa conta negativa. Deseja continuar mesmo assim?`))return;
  }
  return addRecord({...base,descricao,pessoa,valor:round2(valor),conta,categoria:['despesa','investimento'].includes(tipo)?el('categoriaGeral').value:null,status:['despesa','investimento'].includes(tipo)?el('statusGeral').value:tipo==='emprestimo'?'pendente':'quitado',vinculo});
}

// Excluir lançamentos novos: as somas e o estoque são derivados dos registros,
// portanto retirar uma venda reverte automaticamente seu impacto em todos os painéis.
// Nunca excluir consolidados iniciais; são a âncora dos saldos de 14 a 18/11.
function removeTransaction(id){
  const r=state.registros.find(x=>x.id===id);
  if(!r||r.legacy){alert('Os registros consolidados iniciais são protegidos.');return}
  const children=state.registros.filter(x=>x.vinculo===id);
  if(children.length){alert(`Este registro possui ${children.length} pagamento(s)/recebimento(s) vinculados. Exclua primeiro essas baixas para não deixar saldo incorreto.`);return}
  const descricao=String(r.descricao||r.tipo);
  if(!confirm(`EXCLUIR definitivamente esta movimentação?\n\n${niceDate(r.data)} — ${descricao}\nValor: ${money(r.valor)}\n\nO faturamento, caixa, estoque e pendências serão recalculados. Faça backup se quiser conservar uma cópia.`))return;
  const old=state.registros;
  const idsToRemove = r.grupoTransferencia ? new Set(state.registros.filter(x=>x.grupoTransferencia===r.grupoTransferencia).map(x=>x.id)) : new Set([id]);
  try{localStorage.setItem(KEY+'-antes-exclusao',JSON.stringify(state))}catch{}
  state.registros=old.filter(x=>!idsToRemove.has(x.id));
  if(!save()){state.registros=old;return}
  render();alert('Movimentação excluída e indicadores recalculados.');
}
function renderSalesDay(){
  const date=el('abr-sales-date')?.value||today();
  const list=el('abr-sales-list'),overview=el('abr-sales-overview');if(!list||!overview)return;
  const rows=state.registros.filter(r=>r.tipo==='venda'&&!r.legacy&&!r.semFaturamento&&r.data===date).sort((a,b)=>(a.criadoEm||'').localeCompare(b.criadoEm||''));
  const amount=sum(rows.map(n));
  overview.innerHTML=`<span>${rows.length} venda${rows.length===1?'':'s'}</span><strong>${money(amount)}</strong>`;
  const name=account=>({'Espécie cédulas':'Cédulas','Espécie moedas':'Moedas','Maquininha':'Maquininha','Pix':'Pix'})[account]||account||'Não informado';
  list.innerHTML=rows.map((r,index)=>{
    const parts=Array.isArray(r.recebimentos)?r.recebimentos:[];
    const received=parts.map(p=>`<div class="abr-sales-detail-line"><span>${esc(name(p.conta))}${p.conta==='Maquininha'?` • ${esc(p.canal||'Cartão')} / ${esc(p.metodo||'')}`:''}</span><b>${money(p.valor)}</b></div>${p.taxa>0?`<div class="abr-sales-detail-line abr-sales-fee"><span>Taxa descontada</span><b>−${money(p.taxa)}</b></div>`:''}`).join('');
    const change=trocoPartes(r.troco).map(p=>`<div class="abr-sales-detail-line abr-sales-change"><span>Troco • ${esc(name(p.conta))}</span><b>−${money(p.valor)}</b></div>`).join('');
    const items=Array.isArray(r.itens)?r.itens:[];
    const title=items.map(i=>i.produto).filter(Boolean).join(' + ')||r.descricao||'Venda';
    const itemRows=items.length>1?items.map(i=>`<div class="abr-sales-detail-line"><span>${esc(i.produto||'Mercadoria')}${i.detalhe?' · '+esc(i.detalhe):''}</span><b>${money(i.total)}</b></div>`).join(''):'';
    const client=r.pessoa?`<div class="abr-sales-meta">Cliente: ${esc(r.pessoa)}</div>`:'';
    const note=r.observacao?`<div class="abr-sales-meta">${esc(r.observacao)}</div>`:'';
    const status=restante(r)>0.005?`<div class="abr-sales-detail-line abr-sales-due"><span>Fiado a receber</span><b>${money(restante(r))}</b></div>`:'';
    return `<details class="abr-sale-record"><summary><span class="abr-sale-no">${index+1}</span><span class="abr-sale-name">${esc(title)}</span><strong>${money(r.valor)}</strong><span class="abr-sale-chevron">⌄</span></summary><div class="abr-sale-record-body">${itemRows}${received||'<div class="abr-sales-meta">Sem pagamento registrado</div>'}${change}${status}${client}${note}</div></details>`;
  }).join('');
  const consolidated=state.registros.filter(r=>r.tipo==='venda'&&r.legacy&&!r.semFaturamento&&r.data===date);
  if(consolidated.length){list.insertAdjacentHTML('beforeend',`<div class="abr-sales-legacy">${money(sum(consolidated.map(n)))} em vendas antigas consolidadas (sem registros individuais).</div>`)}
  const privateRows=Array.isArray(state.historicoPlanilha)?state.historicoPlanilha.filter(r=>r.data===date):[];
  if(privateRows.length){
    const details=privateRows.map((r,i)=>`<details class="abr-sale-record abr-sale-private"><summary><span class="abr-sale-no">${i+1}</span><span class="abr-sale-name">${esc(r.produto||'Mercadoria')}</span><strong>${money(r.valor)}</strong><span class="abr-sale-chevron">⌄</span></summary><div class="abr-sale-record-body">${r.cliente?`<div class="abr-sales-meta">${esc(r.cliente)}</div>`:''}${r.observacoes?`<div class="abr-sales-meta">${esc(r.observacoes)}</div>`:''}</div></details>`).join('');
    list.insertAdjacentHTML('beforeend',`<details class="abr-sales-private-group"><summary>Planilha privada • ${privateRows.length} vendas (somente conferência)</summary><div>${details}</div></details>`);
  }
  if(!rows.length&&!consolidated.length&&!privateRows.length)list.innerHTML='<div class="abr-sales-empty">Nenhuma venda registrada nesta data.</div>';
}
function renderDailyMethods(){
  const date=el('dataRelatorio').value||today();
  // Exibir a conta REAL escolhida no cadastro. Não atribuir troco de moedas ao Pix.
  const accounts=['Espécie cédulas','Espécie moedas','Pix','Maquininha'];
  const names={'Espécie cédulas':'Cédulas','Espécie moedas':'Moedas','Pix':'Pix','Maquininha':'Maquininha'};
  const flows=new Map();
  const put=(name,key,value)=>{if(!name)return;if(!flows.has(name))flows.set(name,{entrada:0,troco:0,taxa:0});const item=flows.get(name);item[key]=round2(item[key]+(Number(value)||0))};
  let totalVendas=0,count=0,semDetalhe=0;
  for(const r of state.registros.filter(r=>r.tipo==='venda'&&r.data===date&&!r.semFaturamento)){
    totalVendas=round2(totalVendas+Number(r.valor||0));count++;
    if(!Array.isArray(r.recebimentos)){semDetalhe=round2(semDetalhe+Number(r.valor||0));continue}
    for(const p of r.recebimentos){put(p.conta||'Não identificado','entrada',p.valor);put(p.conta||'Não identificado','taxa',p.taxa)}
    for(const p of trocoPartes(r.troco))put(p.conta||'Não identificado','troco',p.valor);
  }
  const show=(name)=>{const v=flows.get(name)||{entrada:0,troco:0,taxa:0},liquido=round2(v.entrada-v.troco-v.taxa);
    const signo=liquido<0?'red':'greenText';
    return `<div class="abr-day-account"><span>${esc(names[name]||name)}</span><strong class="${signo}">${money(liquido)}</strong><small>Entrada ${money(v.entrada)}${v.troco?' · Troco −'+money(v.troco):''}${v.taxa?' · Taxa −'+money(v.taxa):''}</small></div>`;};
  const others=[...flows.keys()].filter(name=>!accounts.includes(name));
  const gross=sum([...flows.values()].map(v=>v.entrada));
  const change=sum([...flows.values()].map(v=>v.troco));
  const fees=sum([...flows.values()].map(v=>v.taxa));
  const received=round2(gross-change-fees);
  let privateHtml='';const imported=(state.historicoPlanilha||[]).filter(r=>r.data===date);
  if(imported.length){
    const fields=[['notas','Dinheiro recebido'],['pix','Pix recebido'],['debito','Débito'],['credito','Crédito'],['cartaoAnterior','Cartão anterior'],['trocoDinheiro','Troco dinheiro'],['trocoPix','Troco Pix'],['fiado','Fiado informado']];
    privateHtml=`<details class="detailsWrap"><summary>Ver conferência da planilha (${imported.length} vendas)</summary><div class="content"><p class="hint">Dados históricos apenas para conferência; não são somados novamente ao caixa.</p><div class="reportGrid">${fields.map(([key,title])=>`<div class="reportCard"><small>${title}</small><strong>${money(sum(imported.map(r=>r[key])))}</strong></div>`).join('')}</div></div></details>`;
  }
  el('resumoPagamentoDia').innerHTML=`<div class="summaryline"><b>${niceDate(date)} · ${count} venda(s)</b><b>Vendido ${money(totalVendas)}</b></div>`+
    `<div class="abr-day-accounts">${accounts.map(show).join('')}${others.length?`<details class="abr-other-day"><summary>Outras contas (${others.length})</summary>${others.map(show).join('')}</details>`:''}</div>`+
    `<div class="abr-day-total">Entrou líquido nas contas pelas vendas: <b>${money(received)}</b></div>`+
    (semDetalhe?`<p class="abr-help">${money(semDetalhe)} de vendas consolidadas sem divisão por conta; não atribuído a nenhuma conta.</p>`:'')+privateHtml;
}

function renderSpreadsheetHistory(){
  const box=el('historicoPlanilha');if(!box)return;
  const rows=Array.isArray(state.historicoPlanilha)?state.historicoPlanilha:[];
  if(!rows.length){box.innerHTML='<p class="hint">Nenhuma venda privada importada. Use o botão acima para importar as linhas da planilha e abri-las individualmente.</p>';return}
  const byDay={};for(const r of rows){const day=r.data;byDay[day]??={q:0,total:0};byDay[day].q++;byDay[day].total=round2(byDay[day].total+Number(r.valor||0))}
  const daily=Object.entries(byDay).sort().reverse().map(([date,x])=>{
    const entries=rows.map((r,i)=>({r,i})).filter(o=>o.r.data===date);
    return `<details class="detailsWrap"><summary>${niceDate(date)} • ${x.q} vendas • ${money(x.total)} ▾</summary><div class="content">${entries.map(({r,i})=>`<div class="record"><div class="line"><strong>${esc(r.produto||'Venda')} #${esc(r.numero||i+1)}</strong><strong>${money(r.valor)}</strong></div><small>Cliente: ${esc(r.cliente||'não informado')} • ${esc(r.observacoes||'')}</small><div class="recordActions"><button type="button" class="secondary smallBtn privateDelete" data-private-delete="${i}">Excluir desta conferência</button></div></div>`).join('')}</div></details>`
  }).join('');
  const compare=state.registros.filter(r=>r.legacy&&r.tipo==='venda'&&!r.semFaturamento).map(r=>{const total=byDay[r.data]?.total;return total!=null&&Math.abs(total-r.valor)>0.001?`<div class="notice">Diferença em ${niceDate(r.data)}: histórico consultável ${money(total)} × painel consolidado ${money(r.valor)}. Nenhum valor foi ajustado automaticamente.</div>`:''}).join('');
  box.innerHTML=`<div class="summaryline"><b>Vendas da planilha (consulta privada)</b><b>${rows.length}</b></div>${daily}${compare}<p class="hint">Excluir aqui remove somente a linha da consulta privada, não mexe no caixa, faturamento ou nos registros consolidados iniciais.</p>`;
}
function removePrivateHistory(index){
  const rows=state.historicoPlanilha;if(!Array.isArray(rows)||!rows[index])return;
  const r=rows[index];if(!confirm(`Excluir do histórico privado a venda ${r.numero||index+1} de ${niceDate(r.data)}, no valor de ${money(r.valor)}?\n\nIsso NÃO altera o faturamento ou o caixa consolidado.`))return;
  const old=[...rows];state.historicoPlanilha=rows.filter((_,i)=>i!==index);
  if(!save()){state.historicoPlanilha=old;return}render();
}
async function importSpreadsheetHistory(e){
 const file=e.target.files?.[0];if(!file)return;
 try{
   const data=JSON.parse(await file.text());
   const isDay=data.formato==='abr-historico-dia-v1';
   const isFull=data.formato==='abr-historico-planilha-v1';
   if((!isDay&&!isFull)||!Array.isArray(data.vendas)||!data.vendas.every(x=>typeof x.data==='string'&&Number.isFinite(Number(x.valor))))throw Error('Arquivo de histórico inválido. Escolha o JSON privado do ABR.');
   const prev=state.historicoPlanilha;
   if(isDay){
     const day=data.dia;
     if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!data.vendas.length||!data.vendas.every(x=>x.data===day))throw Error('O arquivo precisa conter apenas vendas do dia informado.');
     const existing=Array.isArray(prev)?prev:[];
     const previousDay=existing.filter(x=>x.data===day);
     if(!confirm(`Importar ${data.vendas.length} vendas de ${niceDate(day)}?\n\n${previousDay.length?'Os '+previousDay.length+' detalhes desse mesmo dia serão substituídos. Os outros dias ficam intactos.':'Os outros dias ficam intactos.'}\n\nOs valores NÃO serão somados novamente ao caixa ou faturamento.`))return;
     state.historicoPlanilha=[...existing.filter(x=>x.data!==day),...data.vendas];
   }else{
     // Atualizar somente os dias presentes no arquivo. Preservar qualquer outro
     // dia privado já importado, além de todos os lançamentos financeiros.
     const existing=Array.isArray(prev)?prev:[];
     const days=new Set(data.vendas.map(r=>r.data));
     const replaced=existing.filter(r=>days.has(r.data)).length;
     if(!confirm(`Importar ${data.vendas.length} registros históricos de ${days.size} dia(s)?\n\n${replaced?'Serão substituídos '+replaced+' detalhes desses mesmos dias. ':''}Outros dias e lançamentos financeiros serão preservados.\n\nOs valores NÃO serão somados novamente ao caixa ou faturamento.`))return;
     state.historicoPlanilha=[...existing.filter(r=>!days.has(r.data)),...data.vendas];
   }
   if(!save()){state.historicoPlanilha=prev;return}
   render();alert(isDay?'Vendas do dia importadas sem duplicar o caixa.':'Histórico privado importado sem duplicar o caixa.');
 }catch(err){alert(err.message)}finally{e.target.value=''}
}
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000)}
function exportJSON(){download('ABR-backup-'+today()+'.json',JSON.stringify(state,null,2),'application/json')}
function exportCSV(){
  const cols=['data','tipo','descricao','pessoa','produto','unidade','quantidade','preco','precoVendaRef','desconto','valor','conta','status','vinculo','itens','recebimentos','troco'];
  const lines=[cols.join(';'),...state.registros.map(r=>cols.map(k=>'"'+String(typeof r[k]==='object'&&r[k]!==null?JSON.stringify(r[k]):r[k]??'').replace(/"/g,'""')+'"').join(';'))];
  download('ABR-movimentacoes-'+today()+'.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');
}
async function importJSON(e){
  const f=e.target.files?.[0];if(!f)return;
  try{
    const obj=JSON.parse(await f.text());
    if(!obj||!Array.isArray(obj.registros)||!obj.saldos||typeof obj.saldos!=='object'||![1,2,3,4].includes(Number(obj.versao||1)))throw Error('Formato não reconhecido');
    if(!obj.registros.every(r=>r&&typeof r==='object'&&typeof r.id==='string'&&typeof r.tipo==='string'&&typeof r.data==='string'))throw Error('Registros inválidos');
    if(confirm('Restaurar este backup? Os dados atuais serão SUBSTITUÍDOS. Exporte o backup atual antes de continuar.')){
      const old=state;try{localStorage.setItem(KEY+'-antes-restauracao',JSON.stringify(state))}catch{}
      state={...obj,versao:4,parcial:Array.isArray(obj.parcial)?obj.parcial:[],fornecedores:obj.fornecedores&&typeof obj.fornecedores==='object'&&!Array.isArray(obj.fornecedores)?obj.fornecedores:{}};
      if(!save()){state=old;return}
      render();resetForm();alert('Backup restaurado.');
    }
  }catch(err){alert('Backup inválido: '+err.message)}finally{e.target.value=''}
}
function bind(){
  el('data').value=today();el('abr-sales-date').value=today();el('abr-sales-date').onchange=renderSalesDay;el('abr-sales-today').onclick=()=>{el('abr-sales-date').value=today();renderSalesDay()};el('diaFechamento').value='2026-11-18';el('dataRelatorio').value=today();el('dataRelatorio').onchange=renderDailyMethods;
  el('dias').addEventListener('click',e=>{const b=e.target.closest('[data-view-day]');if(!b)return;el('dataRelatorio').value=b.dataset.viewDay;renderDailyMethods();el('resumoDiario').scrollIntoView({behavior:'smooth',block:'start'})});
  el('produtoCompra').innerHTML=productOptions();el('produtoEstoque').innerHTML=productOptions();
  el('produtoCompra').addEventListener('change',()=>{el('fornecedorCompra').value=state.fornecedores[el('produtoCompra').value]||''});
  el('painelFornecedores').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-purchase]');if(edit){editPurchase(edit.dataset.editPurchase);return;}
    const saveBtn=e.target.closest('[data-save-supplier]');
    if(saveBtn){const card=saveBtn.closest('[data-supplier-category]');saveSupplierName(saveBtn.dataset.saveSupplier,card.querySelector('.supplierName').value);return}
    const payBtn=e.target.closest('[data-pay-supplier]');if(payBtn){startSupplierPayment(payBtn.dataset.paySupplier);return}
    const buyBtn=e.target.closest('[data-buy-supplier]');if(buyBtn){startSupplierPurchase(buyBtn.dataset.buySupplier,buyBtn.dataset.buyVendor);return}
    const statement=e.target.closest('[data-abr-supplier-statement]');if(statement){showSupplierStatement(statement.dataset.abrSupplierStatement);return}
  });
  el('abr-statement-close').addEventListener('click',()=>el('abr-supplier-statement-dialog').close());
  el('abr-statement-print').addEventListener('click',printSupplierStatement);
  el('abr-statement-copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(currentSupplierStatementText);el('abr-statement-copy').textContent='Copiado!';setTimeout(()=>{el('abr-statement-copy').textContent='Copiar texto'},1800)}
    catch{alert('Não foi possível copiar automaticamente. Use Imprimir / Salvar PDF.');}
  });
  addItem();
  el('toggle').onclick=()=>el('form').classList.toggle('hidden');
  el('tipo').onchange=toggleFormType;
  el('data').addEventListener('change',()=>{if(el('abr-date-label'))el('abr-date-label').textContent=el('data').value===today()?'Hoje':niceDate(el('data').value)});
  document.querySelector('.abr-fast-methods')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-abr-fast-method]');if(!b)return;
    const select=el('metodo1');select.value=b.dataset.abrFastMethod;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  el('filtroBtn').onclick=()=>{recentes=!recentes;render()};
  el('filtroHistoricoData').onchange=render;el('filtroHistoricoTipo').onchange=render;el('limparHistoricoFiltro').onclick=()=>{el('filtroHistoricoData').value='';el('filtroHistoricoTipo').value='';recentes=true;render()};
  el('historicoPlanilha').addEventListener('click',e=>{const b=e.target.closest('[data-private-delete]');if(b)removePrivateHistory(Number(b.dataset.privateDelete))});
  el('historico').addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(b)removeTransaction(b.dataset.delete)});
  el('importarPlanilha').onclick=()=>el('arquivoPlanilha').click();el('arquivoPlanilha').onchange=importSpreadsheetHistory;
  el('alternarParcial').onclick=()=>{const d=el('diaFechamento').value;if(!d)return;state.parcial=state.parcial.includes(d)?state.parcial.filter(x=>x!==d):[...state.parcial,d];save();render()};
  el('diaFechamento').onchange=updateDayStatus;
  el('abr-first-cut').onclick=()=>{
    const details=el('itensVenda').querySelector('.item .abr-item-opcional');
    if(!details)return;
    details.open=!details.open;
    el('abr-first-cut').setAttribute('aria-expanded',String(details.open));
    el('abr-first-cut').classList.toggle('active',details.open);
    if(details.open)details.querySelector('input')?.focus({preventScroll:true});
  };
  el('abr-client-toggle').onclick=()=>{
    const details=el('abr-venda-extras');details.open=!details.open;
    el('abr-client-toggle').setAttribute('aria-expanded',String(details.open));
    el('abr-client-toggle').classList.toggle('active',details.open);
  };
  el('abr-venda-extras').addEventListener('toggle',()=>{
    const opened=el('abr-venda-extras').open;
    el('abr-client-toggle').setAttribute('aria-expanded',String(opened));
    el('abr-client-toggle').classList.toggle('active',opened);
  });
  el('adicionarItem').onclick=()=>{addItem();el('itensVenda').querySelectorAll('.removeItem').forEach(b=>b.classList.remove('hidden'));updateSalePreview(true)};
  el('itensVenda').addEventListener('click',e=>{if(!e.target.classList.contains('removeItem'))return;const items=el('itensVenda').querySelectorAll('.item');if(items.length<=1)return;e.target.closest('.item').remove();if(el('itensVenda').children.length===1)el('itensVenda').querySelector('.removeItem').classList.add('hidden');
    const firstOpen=Boolean(el('itensVenda').querySelector('.item .abr-item-opcional')?.open);
    el('abr-first-cut').setAttribute('aria-expanded',String(firstOpen));el('abr-first-cut').classList.toggle('active',firstOpen);
    updateSalePreview(true)});
  el('itensVenda').addEventListener('input',e=>{if(e.target.matches('.itemValor,.itemDetalhe'))updateSalePreview(true)});
  el('itensVenda').addEventListener('change',e=>{if(e.target.matches('.itemProduto'))updateSalePreview(true)});
  el('recebido1').addEventListener('input',()=>{el('recebido1').dataset.userEdited='1';updateSalePreview()});
  el('recebido2').addEventListener('input',()=>{el('recebido2').dataset.userEdited='1';updateSalePreview()});
  for(const id of ['taxa1','taxa2'])el(id).addEventListener('input',e=>{e.target.dataset.userEdited='1';updateSalePreview()});
  document.querySelectorAll('[data-abr-card-kind],[data-abr-card-channel]').forEach(b=>b.addEventListener('click',()=>{
    const raw=b.dataset.abrCardKind||b.dataset.abrCardChannel;const colon=raw.indexOf(':');const i=Number(raw.slice(0,colon)),value=raw.slice(colon+1);
    const target=el((b.dataset.abrCardKind?'cartao':'canal')+i);target.value=value;
    delete el('taxa'+i).dataset.userEdited;syncCardButtons(i);updateSalePreview();
  }));
  el('fiadoVenda').onchange=()=>{
    el('pagamentoVenda').classList.toggle('hidden',el('fiadoVenda').checked);
    if(el('fiadoVenda').checked){el('abr-venda-extras').open=true;el('abr-client-toggle').setAttribute('aria-expanded','true');el('abr-client-toggle').classList.add('active')}
    updateSalePreview();
  };
  el('pagamentoMisto').onchange=()=>{updateSecondPaymentLayout();updateSalePreview()};
  // Second payment and both change forms use the same button UI as the first payment.
  for(const [selector,selectId] of [
    ['[data-abr-fast-method2]','metodo2'],
    ['[data-abr-change-method]','contaTroco'],
    ['[data-abr-change-method2]','contaTroco2']
  ]){
    document.querySelectorAll(selector).forEach(b=>b.addEventListener('click',()=>{
      const select=el(selectId);
      select.value=b.getAttribute(selector.slice(1,-1));
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }));
  }
  el('contaTroco').onchange=()=>{
    if(el('dividirTroco').checked&&el('contaTroco2').value===el('contaTroco').value){
      el('contaTroco2').value=['Espécie cédulas','Espécie moedas','Pix'].find(x=>x!==el('contaTroco').value);
    }
    updateSalePreview();
  };
  el('dividirTroco').onchange=()=>{el('trocoParte1').value='';updateSalePreview()};
  el('trocoParte1').oninput=updateSalePreview;
  el('contaTroco2').onchange=updateSalePreview;
  el('metodo1').onchange=()=>{
    if(el('metodo1').value==='Moeda'){
      el('recebido1').value='';el('recebido1').dataset.userEdited='1';
      el('recebido2').value='';delete el('recebido2').dataset.userEdited;
    }else{
      el('pagamentoMisto').checked=false;el('recebido2').value='';
      delete el('recebido1').dataset.userEdited;delete el('recebido2').dataset.userEdited;
      el('recebido1').value=saleTotal()>0?saleTotal().toFixed(2):'';
    }
    updateSecondPaymentLayout();updateSalePreview();
  };
  el('metodo2').onchange=()=>{updateSecondPaymentLayout();updateSalePreview()};
  for(const i of [1,2]){el('cartao'+i).onchange=()=>{delete el('taxa'+i).dataset.userEdited;syncCardButtons(i);updateSalePreview()};el('canal'+i).onchange=()=>{delete el('taxa'+i).dataset.userEdited;syncCardButtons(i);updateSalePreview()}}
  updateSecondPaymentLayout();
  for(const id of ['qtdCompra','custoCompra','precoVendaCompra','descontoCompra','produtoCompra'])el(id).addEventListener('input',updatePurchasePreview);
  el('form').onsubmit=submitForm;
  el('exportar').onclick=exportJSON;el('csv').onclick=exportCSV;
  el('importar').onclick=()=>el('arquivo').click();el('arquivo').onchange=importJSON;
  toggleFormType();updateSalePreview();updatePurchasePreview();
}
initialize();bind();render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js?v=664').catch(()=>{});
