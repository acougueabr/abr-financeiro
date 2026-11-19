/* ABR Financeiro 5.1 — fechamento diário com base privada, sem duplicar receitas.
 * Dados detalhados são importados pelo usuário e sincronizados em abr_config (RLS).
 * Nunca inclua o arquivo JSON privado no repositório público do GitHub. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const fmt = value => money(Number(value) || 0);
  const sumValues = items => items.reduce((acc,x)=>acc+(Number(x)||0),0);
  const row = (title,val,style='')=>`<div class="abr-dia-row"><span>${esc(title)}</span><b class="${style}">${fmt(val)}</b></div>`;
  const validateDate = d => typeof d==='string'&&/^20\d\d-\d\d-\d\d$/.test(d);
  const select = $('abr-dia-data');
  if(!select) return;
  let initialDaySet=false;
  let selected='';
  const bank = () => state.abrFechamentoPrivado;

  function imported(date){return (bank()?.dias||[]).find(r=>r.data===date) || null}
  function calculateFromApp(date) {
    const rows=state.registros.filter(r=>r.tipo==='venda'&&!r.legacy&&!r.semFaturamento&&r.data===date);
    const details={faturamento:0,especieVendas:0,pixRecebido:0,trocoPix:0,pixLiquido:0,cartaoCaderno:0,cartaoLiquido:0,taxasCartao:0,fiado:0,outros:0,numeroVendas:rows.length};
    for(const r of rows) {
      const sale=Number(r.valor)||0; details.faturamento+=sale;
      const received=Array.isArray(r.recebimentos)?r.recebimentos:(r.status==='quitado'?[{metodo:'Outro',conta:r.conta,valor:sale}]:[]);
      let receivedSum=0;
      for(const p of received){
        const gross=Number(p.valor)||0, tax=Number(p.taxa)||0;
        receivedSum+=gross;
        const method=String(p.metodo||'').toLocaleLowerCase('pt-BR'), account=String(p.conta||'').toLocaleLowerCase('pt-BR');
        if(method.includes('dinheiro')||account.includes('espécie')||account.includes('especie')) details.especieVendas+=gross;
        else if(method.includes('pix')||account.includes('pix')||account.includes('picpay')) details.pixRecebido+=gross;
        else if(method.includes('crédito')||method.includes('credito')||method.includes('débito')||method.includes('debito')||account.includes('maquininha')||account.includes('mercado pago')){
          details.cartaoCaderno+=gross;details.taxasCartao+=tax;
        }else details.outros+=gross;
      }
      for(const changePart of trocoPartes(r.troco)){
        const change=Number(changePart.valor)||0;const account=String(changePart.conta||'').toLocaleLowerCase('pt-BR');
        if(account.includes('pix')||account.includes('picpay')) details.trocoPix+=change;
        else if(account.includes('espécie')||account.includes('especie')) details.especieVendas-=change;
        else if(account.includes('maquininha')) details.cartaoCaderno-=change;
        else details.outros-=change;
      }
      // Fiado da data original; recebimentos posteriores não contam como nova venda.
      if(r.status==='pendente')details.fiado+=Math.max(0,sale-(receivedSum-Number(r.troco?.valor||0)));
    }
    details.pixLiquido=details.pixRecebido-details.trocoPix;
    details.cartaoLiquido=details.cartaoCaderno-details.taxasCartao;
    return Object.fromEntries(Object.entries(details).map(([k,v])=>[k,Number(v.toFixed(2))]));
  }
  function getDates(){
    const dates=new Set([...(bank()?.dias||[]).map(d=>d.data),...state.registros.filter(r=>r.tipo==='venda'&&!r.semFaturamento).map(r=>r.data)]);
    dates.add(today());return [...dates].filter(validateDate).sort();
  }
  function fillSelector(){
    const dates=getDates(); const current=select.value;
    // Do not reset the chosen day whenever a sale is entered or synchronized.
    const chosen=dates.includes(current)?current:(initialDaySet?(dates.includes(selected)?selected:dates.at(-1)):(bank()?.atualizadoAte||dates.at(-1)));
    select.innerHTML=dates.map(d=>`<option value="${d}">${niceDate(d)}${imported(d)?' • Planilha':''}</option>`).join('');
    select.value=dates.includes(chosen)?chosen:dates.at(-1);
    selected=select.value;initialDaySet=true;
  }
  const archiveSaleRow=s=>{
    const forms=[];
    if(s.especieRetida)forms.push(`Espécie ${fmt(s.especieRetida)}`);
    if(s.pixRecebido)forms.push(`Pix ${fmt(s.pixRecebido)}`);
    if(s.trocoPix)forms.push(`Troco Pix −${fmt(s.trocoPix)}`);
    if(s.cartaoCaderno)forms.push(`Cartão ${fmt(s.cartaoCaderno)}`);
    if(s.fiado)forms.push(`Fiado ${fmt(s.fiado)}`);
    return `<div class="abr-dia-sale"><div class="abr-dia-sale-top"><span><small>#${esc(String(s.numero||'—'))}</small> ${esc(s.mercadoria||'Venda')}</span><b>${fmt(s.valor)}</b></div><small>${forms.map(esc).join(' • ')||'Forma não discriminada'}</small></div>`;
  };
  function supplierDetails(date){
    const purchases=(bank()?.compras||[]).filter(c=>c.data===date);
    const payments=(bank()?.pagamentos||[]).filter(c=>c.data===date);
    if(!purchases.length&&!payments.length)return '';
    const buys=purchases.map(c=>`<div class="abr-dia-row"><span>${esc(c.tipo)} • ${esc(c.descricao||'Mercadoria')}<small>${c.peso>0?`${c.peso.toLocaleString('pt-BR')} kg × ${fmt(c.custoKg)}/kg • `:''}${esc(c.situacao||'')}</small></span><b>${fmt(c.valor)}</b></div>`).join('');
    const pays=payments.map(p=>`<div class="abr-dia-row"><span>Pagamento ${esc(p.tipo||'')}<small>${esc(p.forma||'')}</small></span><b>${fmt(p.valor)}</b></div>`).join('');
    return `<details class="abr-dia-more"><summary>Compras e pagamentos registrados na planilha</summary>${buys}${pays}<p class="abr-dia-help">Compras, pagamentos e abatimentos são informações de conferência: não geram novos lançamentos no caixa.</p></details>`;
  }
  function paint(){
    fillSelector();const date=select.value;
    const day=imported(date),live=calculateFromApp(date),cash=(bank()?.caixaFisico||[]).find(r=>r.data===date);
    const show=day||live;
    const hasSource=!!day;
    $('abr-dia-estado').textContent=hasSource?'PLANILHA • '+day.situacao:(live.numeroVendas?'LANÇAMENTOS DO APP':'SEM VENDAS');
    $('abr-dia-total').textContent=fmt(show.faturamento);
    $('abr-dia-composicao').innerHTML=[
      ['Espécie das vendas',show.especieVendas],['Pix após trocos',show.pixLiquido],['Cartão nas vendas',show.cartaoCaderno],['Fiados do dia',show.fiado]
    ].map(([label,value])=>`<div class="abr-dia-mini"><small>${label}</small><strong>${fmt(value)}</strong></div>`).join('');
    const cardNet=Number(show.cartaoLiquido)||0;
    const pixIn=Number(show.pixRecebido)||0;
    $('abr-dia-detalhe').innerHTML=
      row('Pix recebidos',pixIn)+row('Troco devolvido via Pix',-Number(show.trocoPix||0))+
      row('Pix após trocos',show.pixLiquido,'greenText')+
      row('Cartão antes das taxas',show.cartaoCaderno)+row('Taxas / ajustes de cartão',-Number(show.taxasCartao||0))+
      row('Cartão líquido',cardNet,'greenText')+
      (hasSource&&show.cartaoPorModalidade ?
        '<div class="abr-dia-modalidades"><b>Divisão da maquininha</b>'+
        ['Débito','Crédito'].map(k=>`<div class="abr-dia-row"><span>${k} (caderno)<small>Líquido recebido: ${fmt(show.cartaoPorModalidade[k]?.liquido)}</small></span><b>${fmt(show.cartaoPorModalidade[k]?.brutoCaderno)}</b></div>`).join('')+
        (show.cartaoSemModalidade>0.001?`<p class="abr-dia-help">Ainda não classificado entre débito e crédito: <b>${fmt(show.cartaoSemModalidade)}</b>.</p>`:'')+'</div>': '')+
      (show.outros?row('Outras formas',show.outros):'')+
      (cash?`<div class="abr-dia-cash">Caixa físico contado ao final de ${niceDate(date)}: <b>${fmt(cash.contado)}</b><small>${esc(cash.nota||'')}</small></div>`:'');
    const archivedSales=hasSource?(bank()?.vendas||[]).filter(s=>s.data===date):[];
    const localSales=state.registros.filter(r=>r.tipo==='venda'&&!r.legacy&&!r.semFaturamento&&r.data===date);
    const archiveHtml=archivedSales.map(archiveSaleRow).join('');
    const localHtml=localSales.map(r=>`<div class="abr-dia-sale"><div class="abr-dia-sale-top"><span>${esc(r.descricao||'Venda do app')}</span><b>${fmt(r.valor)}</b></div><small>Registrada no aplicativo • aparece no Histórico</small></div>`).join('');
    $('abr-dia-vendas').innerHTML=hasSource?
      `<details class="abr-dia-more"><summary>${archivedSales.length} vendas da planilha • abrir detalhes</summary>${archiveHtml||'<p class="abr-dia-help">Nenhuma venda neste dia.</p>'}</details>`+
      (localSales.length?`<details class="abr-dia-more"><summary>${localSales.length} lançamento(s) novo(s) do site • conferir separadamente</summary>${localHtml}</details>`:''):
      `<details class="abr-dia-more"><summary>${localSales.length} vendas do aplicativo • abrir detalhes</summary>${localHtml||'<p class="abr-dia-help">Ainda não foram registradas vendas neste dia.</p>'}</details>`;
    $('abr-dia-fornecedores').innerHTML=hasSource?supplierDetails(date):'';
    const subtotal=Number(show.especieVendas||0)+Number(show.pixLiquido||0)+Number(show.cartaoCaderno||0)+Number(show.fiado||0)+(Number(show.outros)||0);
    const diff=Number(show.faturamento||0)-subtotal;
    $('abr-dia-conferencia').innerHTML=hasSource?
      `<span class="abr-dia-ok">Conferência da planilha: ${Math.abs(diff)<0.011?'valores das formas de pagamento batem com o faturamento.':`diferença de ${fmt(diff)} — revisar.`}</span><br>Arquivo até 18/11 (parcial). <b>Este histórico não é somado novamente ao caixa.</b>`:
      (localSales.length?`Movimentos novos do sistema • ${Math.abs(diff)<0.011?'formas conciliadas':'diferença a conferir de '+fmt(diff)}.`:'Escolha um dia que tenha vendas registradas.');
    const source=bank();
    $('abr-dia-origem').textContent=source?`${source.confereTotais.quantidadeVendas} vendas históricas importadas e sincronizáveis. Origem: planilha 18/11.`:'Importe o arquivo privado preparado a partir da planilha para ver a divisão dos dias 14 a 18/11.';
    $('abr-dia-alerta').textContent=hasSource&&date==='2026-11-18'?'ATENÇÃO: a planilha soma R$ 534,05 (10 vendas) em 18/11, enquanto o fechamento antigo mostrava R$ 740,23. Diferença: R$ 206,18. Nenhum valor do caixa foi alterado.':'';
  }
  async function loadFile(e){
    const f=e.target.files?.[0];if(!f)return;
    try{
      if(f.size>2000000)throw Error('Arquivo muito grande para o histórico do dia.');
      const obj=JSON.parse(await f.text());
      if(obj.formato!=='abr-fechamento-privado-v1'||!Array.isArray(obj.dias)||!Array.isArray(obj.vendas)||obj.dias.length!==5||obj.vendas.length!==96)throw Error('Formato ou quantidade de registros inesperados. Use o arquivo preparado a partir da planilha do ABR.');
      if(!obj.dias.every(x=>validateDate(x.data)&&Number.isFinite(Number(x.faturamento)))||!obj.vendas.every(x=>validateDate(x.data)&&Number.isFinite(Number(x.valor))))throw Error('Datas ou valores inválidos.');
      for(const d of obj.dias){
        const total=sumValues(obj.vendas.filter(v=>v.data===d.data).map(v=>v.valor));
        if(Math.abs(total-d.faturamento)>.01)throw Error('Conferência falhou em '+d.data+'. Nada foi importado.');
      }
      if(!confirm(`Importar ${obj.vendas.length} vendas históricas e 5 fechamentos?\n\nNÃO será somado ao faturamento nem ao caixa. O resumo privado será sincronizado com o iPhone via sua conta, se a nuvem estiver ativa.`))return;
      const previous=state.abrFechamentoPrivado;
      state.abrFechamentoPrivado=obj;
      if(!save()){state.abrFechamentoPrivado=previous;throw Error('Não foi possível salvar os dados locais.');}
      select.value=obj.atualizadoAte;
      paint();
      alert('Base diária importada! As vendas anteriores permanecem intactas. Confira o dia 18/11 e a diferença de R$ 206,18.');
      if(window.ABRCloud?.syncNow)window.ABRCloud.syncNow();
    }catch(err){alert('Importação não realizada: '+err.message)}
    finally{e.target.value=''}
  }
  $('abr-dia-importar').addEventListener('click',()=> $('abr-dia-arquivo').click());
  $('abr-dia-arquivo').addEventListener('change',loadFile);
  select.addEventListener('change',()=>{selected=select.value;paint()});
  // Shared render pipeline also updates after cloud downloads and deletion.
  const lastRender=render;
  render=function(){lastRender();paint()};
  paint();
})();
