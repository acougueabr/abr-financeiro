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
const num=id=>Number(el(id).value)||0;
const fmtQty=(v,u='kg')=>`${Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${u}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const niceDate=d=>d?d.split('-').reverse().join('/'):'—';
const sum=arr=>round2(arr.reduce((a,v)=>a+Number(v||0),0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const productOptions=()=>PRODUCTS.map(p=>`<option value="${p}">${p}</option>`).join('');
let state, recentes=false, itemSequence=0;
function safeStorageGet(key){try{return localStorage.getItem(key)}catch{return null}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch(e){el('armazenamentoAviso').textContent='Falha ao salvar os dados no aparelho. Libere espaço e faça um backup. '+e.message;el('armazenamentoAviso').classList.remove('hidden');return false}}
function initialize(){
  const raw=safeStorageGet(KEY);
  try{if(raw){const parsed=JSON.parse(raw);if(parsed&&Array.isArray(parsed.registros)&&parsed.saldos&&typeof parsed.saldos==='object')state=parsed}}catch{}
  if(!state){state={versao:2,registros:initial,saldos:{'Espécie':926,'Mercado Pago':798.33,'PicPay':234.55},dataBase:'2026-11-18',parcial:['2026-11-18']};save()}
  else if((state.versao||1)<2){
    try{if(!safeStorageGet(KEY+'-antes-v2'))localStorage.setItem(KEY+'-antes-v2',raw)}catch{}
    state.versao=2;
    if(!Array.isArray(state.parcial))state.parcial=['2026-11-18'];
    save();
  }
  if(!Array.isArray(state.parcial))state.parcial=[];
}
const n=r=>round2(r.valor);
const paid=id=>sum(state.registros.filter(r=>['pagamento','recebimento'].includes(r.tipo)&&r.vinculo===id).map(n));
const initialSaleReceived=r=>Array.isArray(r.recebimentos)?round2(sum(r.recebimentos.map(p=>p.valor))-Number(r.troco?.valor||0)):0;
const restante=r=>Math.max(0,round2(n(r)-paid(r.id)-(r.tipo==='venda'?initialSaleReceived(r):0)));
const isDebt=r=>['compra','despesa'].includes(r.tipo)&&r.status==='pendente';
const isReceivable=r=>['emprestimo','venda'].includes(r.tipo)&&r.status==='pendente';
function balance(){
  const b={...state.saldos};
  const delta=(conta,v)=>{if(!conta)return;b[conta]=round2((Number(b[conta])||0)+v)};
  for(const r of state.registros){
    if(r.legacy||r.semCaixa)continue;
    if(r.tipo==='venda'){
      if(Array.isArray(r.recebimentos)){
        for(const p of r.recebimentos)delta(p.conta,round2(n(p)-Number(p.taxa||0)));
        if(r.troco?.valor)delta(r.troco.conta,-Number(r.troco.valor));
      }else if(r.status==='quitado')delta(r.conta,n(r));
    }else if(r.tipo==='recebimento')delta(r.conta,n(r));
    else if(r.tipo==='pagamento'||r.tipo==='emprestimo'||(['compra','despesa'].includes(r.tipo)&&r.status==='quitado'))delta(r.conta,-n(r));
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
  const pago=sum(regs.filter(r=>['compra','despesa'].includes(r.tipo)).map(r=>r.status==='quitado'?n(r):paid(r.id)));
  el('faturamento').textContent=money(faturamento);el('totalVendas').textContent='TOTAL '+money(faturamento);
  el('caixa').textContent=el('caixa2').textContent=money(caixa);
  el('pagar').textContent=el('pendente').textContent=money(pagar);
  el('pago').textContent=money(pago);el('receber').textContent=money(receber);
  el('situacao').textContent=caixa>=pagar?`Após quitar as pendências, sobram ${money(caixa-pagar)}.`:`Ainda faltam ${money(pagar-caixa)} para quitar as pendências.`;
  const dates=[...new Set([...vendas.map(r=>r.data),'2026-11-16'])].sort();
  const latest=dates.at(-1)||'2026-11-18';
  el('periodo').textContent=`14/11/2026 A ${niceDate(latest)}`;
  el('dias').innerHTML=dates.map(d=>{const v=sum(vendas.filter(r=>r.data===d).map(n));const dt=new Date(d+'T12:00:00');const label=dt.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).toUpperCase();return `<div class="tile"><small>${label}</small><strong>${money(v)}</strong>${state.parcial.includes(d)?'<small class="orange">Parcial</small>':''}</div>`}).join('');
  const line=r=>`<div class="entry"><span class="scrollText">${esc(r.descricao)}${r.status==='pendente'?`<br><small class="muted">Restante: ${money(restante(r))}</small>`:''}</span><b>${money(r.status==='pendente'?restante(r):n(r))}</b></div>`;
  el('listaPagos').innerHTML=regs.filter(r=>['compra','despesa'].includes(r.tipo)&&(r.status==='quitado'||paid(r.id)>0)).map(r=>r.status==='quitado'?line(r):`<div class="entry"><span>${esc(r.descricao)} (parcial)</span><b>${money(paid(r.id))}</b></div>`).join('')||'<small class="muted">Nenhum</small>';
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

  el('estoque').innerHTML=PRODUCTS.map(p=>{const a=[...stock.entries()].filter(([k])=>k.startsWith(p+'|'));return `<div class="stocktile"><small>${esc(p)}</small><strong>${a.length?a.map(([k,v])=>fmtQty(v,k.split('|')[1])).join(' + '):'Sem quantidade inicial'}</strong><small>Movimentações detalhadas</small></div>`}).join('');
  const history=[...regs].sort((a,b)=>b.data.localeCompare(a.data)||(b.criadoEm||'').localeCompare(a.criadoEm||''));
  el('historico').innerHTML=(recentes?history.slice(0,12):history).map(r=>{const extra=r.tipo==='venda'&&Array.isArray(r.itens)?`<br><small>${r.itens.map(i=>`${esc(i.produto)} ${fmtQty(i.quantidade,i.unidade)}`).join(' • ')}${r.troco?.valor?` • Troco: ${money(r.troco.valor)} (${esc(r.troco.conta)})`:''}</small>`:r.tipo==='compra'&&r.precoVendaRef?`<br><small>Venda referência: ${money(r.precoVendaRef)}/${esc(r.unidade||'kg')}</small>`:'';
    return `<div class="record"><div class="line"><strong class="scrollText">${esc(r.descricao)}</strong><strong>${r.tipo==='estoque'?fmtQty(r.quantidade,r.unidade):money(n(r))}</strong></div><small>${niceDate(r.data)} • ${esc(r.tipo)} • ${esc(r.status||'')} ${r.legacy?'• Saldo inicial':''} ${r.vinculo?'• vinculado':''}</small>${extra}</div>`}).join('');
  refreshLinks();updateDayStatus();
}
function refreshLinks(){
  const tipo=el('tipo').value;
  const eligible=state.registros.filter(r=>(tipo==='pagamento'?isDebt(r):isReceivable(r))&&restante(r)>0.001);
  const previous=el('vinculo').value;
  el('vinculo').innerHTML='<option value="">Selecione...</option>'+eligible.map(r=>`<option value="${esc(r.id)}">${esc(r.descricao)} — ${money(restante(r))}</option>`).join('');
  if(eligible.some(r=>r.id===previous))el('vinculo').value=previous;
}
function updateDayStatus(){const d=el('diaFechamento').value||'2026-11-18';el('estadoDia').textContent=`${niceDate(d)}: ${state.parcial.includes(d)?'PARCIAL (ainda aberto)':'FECHADO (sem indicação de parcial)'}.`}
function addItem(){
  itemSequence++;
  const id='item'+itemSequence;
  const box=document.createElement('div');box.className='item';box.dataset.itemId=id;
  box.innerHTML=`<div class="itemTop"><b>Mercadoria da venda</b><button type="button" class="secondary smallBtn removeItem">Remover</button></div><div class="formgrid"><div><label>Tipo de mercadoria</label><select class="itemProduto">${productOptions()}</select></div><div><label>Corte / detalhe (opcional)</label><input class="itemDetalhe" placeholder="Ex.: Picanha, coxa, linguiça"></div><div><label>Unidade</label><select class="itemUnidade"><option value="kg">Quilos (kg)</option><option value="un">Unidades (un)</option></select></div><div><label>Peso / quantidade</label><input class="itemQtd" type="number" inputmode="decimal" min="0.001" step="0.001" placeholder="Ex.: 1,250"></div><div><label>Preço de venda por kg/un (R$)</label><input class="itemPreco" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00"></div><div><label>Subtotal</label><div class="formTotal" style="margin:0"><strong class="itemSubtotal">R$ 0,00</strong></div></div></div>`;
  el('itensVenda').appendChild(box);
  if(el('itensVenda').children.length===1)box.querySelector('.removeItem').classList.add('hidden');
  return box;
}
function getItems(){
  return [...el('itensVenda').querySelectorAll('.item')].map(box=>{
    const get=cls=>box.querySelector(cls);
    const quantidade=Number(get('.itemQtd').value),precoVenda=Number(get('.itemPreco').value);
    return {produto:get('.itemProduto').value,detalhe:get('.itemDetalhe').value.trim(),unidade:get('.itemUnidade').value,quantidade,precoVenda,total:round2(quantidade*precoVenda)};
  });
}
function saleTotal(){return sum(getItems().map(i=>i.total))}
function updateSalePreview(autofill=false){
  const items=getItems();
  el('itensVenda').querySelectorAll('.item').forEach((box,i)=>box.querySelector('.itemSubtotal').textContent=money(items[i].total));
  const total=sum(items.map(i=>i.total));el('totalVenda').textContent=money(total);
  if(autofill&&!el('recebido1').dataset.userEdited&&!el('fiadoVenda').checked)el('recebido1').value=total?total.toFixed(2):'';
  const bruto=el('fiadoVenda').checked?0:sum([num('recebido1'),el('pagamentoMisto').checked?num('recebido2'):0]);
  const troco=Math.max(0,round2(bruto-total));const falta=Math.max(0,round2(total-bruto));
  el('trocoPrevisto').textContent=money(troco);
  el('situacaoVenda').innerHTML=total<=0?'Informe o peso e o preço dos produtos.':falta>0?`<b class="orange">Fiado / pagamento parcial:</b> ${money(falta)} ficará a receber. Informe o cliente.`:troco>0?`<b class="greenText">Venda recebida:</b> devolver ${money(troco)} de troco por ${esc(el('contaTroco').selectedOptions[0].textContent)}.`:`<b class="greenText">Venda paga:</b> ${money(total)} recebido, sem troco.`;
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
  el('geralBox').classList.toggle('hidden',!['despesa','emprestimo','recebimento','pagamento','ajuste'].includes(t));
  el('estoqueBox').classList.toggle('hidden',t!=='estoque');
  el('statusGeralBox').classList.toggle('hidden',t!=='despesa');
  el('vinculoBox').classList.toggle('hidden',!['recebimento','pagamento'].includes(t));
  const titles={despesa:'Despesa do açougue',emprestimo:'Empréstimo concedido',recebimento:'Receber fiado / empréstimo',pagamento:'Pagar fornecedor / despesa',ajuste:'Ajuste de caixa'};
  el('tituloGeral').textContent=titles[t]||'Movimentação';
  const hints={despesa:'Se ficar pendente, não reduz o caixa até registrar o pagamento.',emprestimo:'O dinheiro sai do caixa agora e fica como valor a receber.',recebimento:'Selecione o fiado ou empréstimo original. O valor recebido reduz o saldo a receber.',pagamento:'Selecione a compra ou despesa pendente. O valor pago reduz a dívida e o caixa.',ajuste:'Use valor positivo para entrada e negativo para saída. Descreva o motivo.'};
  el('ajudaGeral').textContent=hints[t]||'';refreshLinks();
}
function resetForm(){
  el('form').reset();el('data').value=today();el('itensVenda').innerHTML='';addItem();
  delete el('recebido1').dataset.userEdited;
  el('pagamentoVenda').classList.remove('hidden');el('segundaForma').classList.add('hidden');
  el('tipo').value='venda';toggleFormType();updateSalePreview();updatePurchasePreview();
}
function addRecord(record){
  state.registros.push(record);
  if(!save()){state.registros.pop();alert('Não foi possível salvar no aparelho. Faça um backup e verifique o espaço.');return false}
  render();resetForm();alert('Movimentação salva!');return true;
}
function submitForm(e){
  e.preventDefault();const tipo=el('tipo').value,data=el('data').value;
  if(!data){alert('Escolha a data da movimentação.');return}
  const base={id:uid(),tipo,data,criadoEm:new Date().toISOString()};
  if(tipo==='venda'){
    const itens=getItems();if(!itens.length||itens.some(i=>!Number.isFinite(i.quantidade)||i.quantidade<=0||!Number.isFinite(i.precoVenda)||i.precoVenda<=0)){alert('Informe peso/quantidade e preço de venda positivo em todos os produtos.');return}
    const total=sum(itens.map(i=>i.total));if(total<=0){alert('O valor da venda precisa ser maior que zero.');return}
    const fiado=el('fiadoVenda').checked;
    const entradas=fiado?[]:[{metodo:el('metodo1').value,conta:el('conta1').value,valor:round2(num('recebido1')),taxa:round2(num('taxa1'))},...(el('pagamentoMisto').checked?[{metodo:el('metodo2').value,conta:el('conta2').value,valor:round2(num('recebido2')),taxa:round2(num('taxa2'))}]:[])].filter(p=>p.valor>0);
    const bruto=sum(entradas.map(p=>p.valor)),trocoValor=Math.max(0,round2(bruto-total));
    const liquido=round2(bruto-trocoValor),pendente=Math.max(0,round2(total-liquido));
    const cliente=el('clienteVenda').value.trim();if(pendente>0&&!cliente){alert('Informe o nome do cliente para a parte fiada.');return}
    if(entradas.some(p=>!p.conta||p.taxa<0||p.taxa>p.valor)||!Number.isFinite(bruto)){alert('Confira as formas de pagamento e as taxas. A taxa não pode superar o valor recebido.');return}
    const descricao=itens.map(i=>i.produto+(i.detalhe?' — '+i.detalhe:'')).join(' + ');
    return addRecord({...base,descricao,pessoa:cliente,observacao:el('obsVenda').value.trim(),itens,valor:total,recebimentos:entradas,troco:trocoValor?{valor:trocoValor,conta:el('contaTroco').value}:null,status:pendente>0?'pendente':'quitado'});
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
  return addRecord({...base,descricao,pessoa,valor:round2(valor),conta,status:tipo==='despesa'?el('statusGeral').value:tipo==='emprestimo'?'pendente':'quitado',vinculo});
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
    if(!obj||!Array.isArray(obj.registros)||!obj.saldos||typeof obj.saldos!=='object'||![1,2].includes(Number(obj.versao||1)))throw Error('Formato não reconhecido');
    if(!obj.registros.every(r=>r&&typeof r==='object'&&typeof r.id==='string'&&typeof r.tipo==='string'&&typeof r.data==='string'))throw Error('Registros inválidos');
    if(confirm('Restaurar este backup? Os dados atuais serão SUBSTITUÍDOS. Exporte o backup atual antes de continuar.')){
      const old=state;try{localStorage.setItem(KEY+'-antes-restauracao',JSON.stringify(state))}catch{}
      state={...obj,versao:2,parcial:Array.isArray(obj.parcial)?obj.parcial:[]};
      if(!save()){state=old;return}
      render();resetForm();alert('Backup restaurado.');
    }
  }catch(err){alert('Backup inválido: '+err.message)}finally{e.target.value=''}
}
function bind(){
  el('data').value=today();el('diaFechamento').value='2026-11-18';
  el('produtoCompra').innerHTML=productOptions();el('produtoEstoque').innerHTML=productOptions();
  addItem();
  el('toggle').onclick=()=>el('form').classList.toggle('hidden');
  el('tipo').onchange=toggleFormType;
  el('filtroBtn').onclick=()=>{recentes=!recentes;render()};
  el('alternarParcial').onclick=()=>{const d=el('diaFechamento').value;if(!d)return;state.parcial=state.parcial.includes(d)?state.parcial.filter(x=>x!==d):[...state.parcial,d];save();render()};
  el('diaFechamento').onchange=updateDayStatus;
  el('adicionarItem').onclick=()=>{addItem();el('itensVenda').querySelectorAll('.removeItem').forEach(b=>b.classList.remove('hidden'));updateSalePreview()};
  el('itensVenda').addEventListener('click',e=>{if(!e.target.classList.contains('removeItem'))return;const items=el('itensVenda').querySelectorAll('.item');if(items.length<=1)return;e.target.closest('.item').remove();if(el('itensVenda').children.length===1)el('itensVenda').querySelector('.removeItem').classList.add('hidden');updateSalePreview(true)});
  el('itensVenda').addEventListener('input',e=>{if(e.target.matches('.itemQtd,.itemPreco,.itemDetalhe'))updateSalePreview(true)});
  el('itensVenda').addEventListener('change',e=>{if(e.target.matches('.itemProduto,.itemUnidade')){
    const box=e.target.closest('.item');const product=box.querySelector('.itemProduto').value;
    if(product!=='Carne bovina'&&!box.querySelector('.itemPreco').value){
      const refs=state.registros.filter(r=>r.tipo==='compra'&&r.produto===product&&r.unidade===box.querySelector('.itemUnidade').value&&r.precoVendaRef>0).sort((a,b)=>b.data.localeCompare(a.data));
      if(refs[0])box.querySelector('.itemPreco').value=refs[0].precoVendaRef;
    }
    updateSalePreview(true);
  }});
  el('recebido1').addEventListener('input',()=>{el('recebido1').dataset.userEdited='1';updateSalePreview()});
  el('recebido2').addEventListener('input',()=>updateSalePreview());
  for(const id of ['taxa1','taxa2'])el(id).addEventListener('input',()=>updateSalePreview());
  el('fiadoVenda').onchange=()=>{el('pagamentoVenda').classList.toggle('hidden',el('fiadoVenda').checked);updateSalePreview()};
  el('pagamentoMisto').onchange=()=>{el('segundaForma').classList.toggle('hidden',!el('pagamentoMisto').checked);updateSalePreview()};
  el('contaTroco').onchange=()=>updateSalePreview();
  for(const i of [1,2])el('metodo'+i).onchange=()=>{el('conta'+i).value=el('metodo'+i).value==='Dinheiro'?'Espécie':'Mercado Pago';updateSalePreview()};
  for(const id of ['qtdCompra','custoCompra','precoVendaCompra','descontoCompra','produtoCompra'])el(id).addEventListener('input',updatePurchasePreview);
  el('form').onsubmit=submitForm;
  el('exportar').onclick=exportJSON;el('csv').onclick=exportCSV;
  el('importar').onclick=()=>el('arquivo').click();el('arquivo').onchange=importJSON;
  toggleFormType();updateSalePreview();updatePurchasePreview();
}
initialize();bind();render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js?v=2').catch(()=>{});
