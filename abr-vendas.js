/* ABR Financeiro v6.6.6 — filtros simples e correção da lista de vendas. */
'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  const START='2026-11-14';
  let mode='hoje',chosen=today(),channel=null;
  // Preferências VISUAIS, isoladas dos dados financeiros. Não recriar dias abertos
  // automaticamente quando o app sincronizar ou recalcular o painel.
  const UI_KEY='abr-ui-vendas-aberturas-v1';
  const salesUI=(()=>{try{const value=JSON.parse(localStorage.getItem(UI_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}})();
  const hasChoice=key=>Object.prototype.hasOwnProperty.call(salesUI,key);
  function saveChoice(key,open){
    salesUI[key]=!!open;
    try{localStorage.setItem(UI_KEY,JSON.stringify(salesUI))}catch{} // nunca bloquear vendas
  }
  function uiKey(details){
    const day=details.closest('[data-abr-day]');
    if(!day)return null;
    const d=day.dataset.abrDay;
    if(details===day)return `day:${d}`;
    const record=details.closest('[data-abr-record]');
    if(!record)return null;
    return `record:${d}:${record.dataset.abrRecord}${details===record?'':':note'}`;
  }

  const cashNames={'Espécie cédulas':'Espécie','Espécie moedas':'Espécie','Espécie':'Espécie','Dinheiro':'Espécie','Pix':'Pix','Maquininha':'Maquininha'};
  const labelAccount=a=>({'Espécie cédulas':'Cédulas','Espécie moedas':'Moedas','Espécie':'Espécie','Dinheiro':'Espécie','Pix':'Pix','Maquininha':'Maquininha'})[a]||a||'Não informado';
  const realSales=()=>state.registros.filter(r=>r.tipo==='venda'&&!r.semFaturamento&&r.data>=START);
  const dailySales=d=>realSales().filter(r=>r.data===d);
  const detailSales=d=>dailySales(d).filter(r=>!r.legacy).sort((a,b)=>(a.criadoEm||'').localeCompare(b.criadoEm||''));
  const imported=d=>Array.isArray(state.historicoPlanilha)?state.historicoPlanilha.filter(r=>r.data===d):[];
  const shortDate=d=>d.slice(8,10)+'/'+d.slice(5,7);
  const moneySigned=x=>x<-.005?'−'+money(Math.abs(x)):money(x);
  function flow(sales){
    const totals={'Pix':0,'Espécie':0,'Maquininha':0};
    let hasLegacy=false,unmapped=false;
    for(const r of sales){
      if(r.legacy){hasLegacy=true;continue}
      if(!Array.isArray(r.recebimentos)){if(r.status==='quitado')unmapped=true;continue}
      for(const p of r.recebimentos){
        const account=cashNames[p.conta];
        if(account)totals[account]=round2(totals[account]+Number(p.valor||0)-Number(p.taxa||0));
        else if(Number(p.valor||0))unmapped=true;
      }
      for(const part of trocoPartes(r.troco)){
        const account=cashNames[part.conta];
        if(account)totals[account]=round2(totals[account]-Number(part.valor||0));
        else if(Number(part.valor||0))unmapped=true;
      }
    }
    return {totals,hasLegacy,unmapped};
  }
  // Valor efetivamente apresentado em cada cartão de recebimento. Uma venda
  // mista pode aparecer em dois filtros, mas só a sua parcela correspondente
  // é exibida. Não transforma empréstimos, fiados ou pagamentos em vendas.
  const CHANNELS=['Pix','Espécie','Maquininha'];
  function paymentParts(r,old=false){
    const values={'Pix':0,'Espécie':0,'Maquininha':0};
    if(old){
      values['Espécie']=round2(Number(r.notas||0)-Number(r.trocoDinheiro||0));
      values['Pix']=round2(Number(r.pix||0)-Number(r.trocoPix||0));
      values['Maquininha']=round2(Number(r.debito||0)+Number(r.credito||0)+Number(r.cartaoAnterior||0));
    }else if(Array.isArray(r.recebimentos)){
      for(const p of r.recebimentos){
        const key=cashNames[p.conta];
        if(key)values[key]=round2(values[key]+Number(p.valor||0)-Number(p.taxa||0));
      }
      for(const part of trocoPartes(r.troco)){
        const key=cashNames[part.conta];
        if(key)values[key]=round2(values[key]-Number(part.valor||0));
      }
    }
    return values;
  }
  const channelAmount=(r,c,old=false)=>paymentParts(r,old)[c]||0;
  function grossChannel(r,c,old=false){
    if(old){
      if(c==='Pix')return Number(r.pix||0);
      if(c==='Espécie')return Number(r.notas||0);
      return Number(r.debito||0)+Number(r.credito||0)+Number(r.cartaoAnterior||0);
    }
    return Array.isArray(r.recebimentos)?sum(r.recebimentos.filter(p=>cashNames[p.conta]===c).map(p=>p.valor)):0;
  }
  // Troco pago via Pix não transforma uma venda em dinheiro em venda Pix.
  // O troco continua abatido no total do cartão, mas não cria uma venda fictícia.
  const matchesChannel=(r,c,old=false)=>!c||grossChannel(r,c,old)>0.005;
  function paymentMetrics(sales,oldDays){
    const metrics=Object.fromEntries(CHANNELS.map(c=>[c,{in:0,change:0,fees:0}]));
    const add=(c,key,value)=>{if(c)metrics[c][key]=round2(metrics[c][key]+Number(value||0))};
    for(const r of sales.filter(r=>!r.legacy)){
      for(const p of Array.isArray(r.recebimentos)?r.recebimentos:[]){
        const c=cashNames[p.conta];if(!c)continue;
        add(c,'in',p.valor);add(c,'fees',p.taxa);
      }
      for(const part of trocoPartes(r.troco))add(cashNames[part.conta],'change',part.valor);
    }
    for(const d of oldDays)for(const r of imported(d)){
      add('Pix','in',r.pix);add('Pix','change',r.trocoPix);
      add('Espécie','in',r.notas);add('Espécie','change',r.trocoDinheiro);
      add('Maquininha','in',Number(r.debito||0)+Number(r.credito||0)+Number(r.cartaoAnterior||0));
    }
    return metrics;
  }
  function channelRows(d,c){
    const current=detailSales(d).filter(r=>matchesChannel(r,c));
    const previous=privateSales(d).filter(r=>matchesChannel(r,c,true));
    const adjustments=privateAdjustments(d).filter(r=>matchesChannel(r,c,true));
    return {current,previous,adjustments};
  }
  function channelDayTotal(d,c){
    const rows=channelRows(d,c);
    return round2(sum(rows.current.map(r=>channelAmount(r,c)))+
      sum(rows.previous.map(r=>channelAmount(r,c,true)))+
      sum(rows.adjustments.map(r=>channelAmount(r,c,true))));
  }
  function channelDayCount(d,c){
    const rows=channelRows(d,c);
    const n=rows.current.length+rows.previous.length;
    const adj=rows.adjustments.length;
    return `${n} venda${n===1?'':'s'}${adj?' · '+adj+' ajuste'+(adj===1?'':'s'):''}`;
  }
  const channelTag=c=>c?`<small class="abr-sales-portion-tag">${esc(c)} líquido</small>`:'';
  const channelContext=(r,c,old=false)=>c?`<div class="abr-sales-method-context">${esc(c)} nesta venda: <b>${money(channelAmount(r,c,old))}</b> · Venda total: <b>${money(r.valor)}</b>${old?'<br>Valores do histórico, sujeitos à conciliação.':''}</div>`:'';
  const isAdjustment=r=>r&&r.ajusteConciliacao===true;
  const privateSales=d=>imported(d).filter(r=>!isAdjustment(r));
  const privateAdjustments=d=>imported(d).filter(isAdjustment);
  function countLabel(d){
    const details=detailSales(d),old=dailySales(d).some(r=>r.legacy);
    const count=details.length+privateSales(d).length;
    const adjusts=privateAdjustments(d).length;
    if(count)return `${count} venda${count===1?'':'s'}${adjusts?' · '+adjusts+' ajuste'+(adjusts===1?'':'s'):''}`;
    if(adjusts)return `${adjusts} ajuste${adjusts===1?'':'s'}`;
    if(old)return 'Consolidado';
    return '0 vendas';
  }
  function historicalFlow(rows){
    const totals={'Pix':0,'Espécie':0,'Maquininha':0};
    let fiado=0;
    for(const r of rows){
      totals['Espécie']=round2(totals['Espécie']+Number(r.notas||0)-Number(r.trocoDinheiro||0));
      totals['Pix']=round2(totals['Pix']+Number(r.pix||0)-Number(r.trocoPix||0));
      totals['Maquininha']=round2(totals['Maquininha']+Number(r.debito||0)+Number(r.credito||0)+Number(r.cartaoAnterior||0));
      fiado=round2(fiado+Number(r.fiado||0));
    }
    return {totals,fiado};
  }
  function privateSaleDetail(r,index,c=null){
    // A mesma estrutura visual das vendas novas. Não atribuímos taxa, tipo ou canal
    // de cartão que não estejam comprovados no histórico original.
    const line=(label,val,cls='')=>`<div class="abr-sales-detail-line ${cls}"><span>${label}</span><b>${money(val)}</b></div>`;
    let received='';
    if(Number(r.notas)>0)received+=line('Cédulas',r.notas);
    if(Number(r.pix)>0)received+=line('Pix',r.pix);
    if(Number(r.debito)>0)received+=line('Maquininha • Débito',r.debito);
    if(Number(r.credito)>0)received+=line('Maquininha • Crédito',r.credito);
    if(Number(r.cartaoAnterior)>0)received+=line('Maquininha <span class="abr-sales-method-muted">(tipo não informado)</span>',r.cartaoAnterior);
    let change='';
    if(Number(r.trocoDinheiro)>0)change+=line('Troco • Espécie',-Number(r.trocoDinheiro),'abr-sales-change');
    if(Number(r.trocoPix)>0)change+=line('Troco • Pix',-Number(r.trocoPix),'abr-sales-change');
    const due=Number(r.fiado)>0?line('Fiado a receber',r.fiado,'abr-sales-due'):'';
    const client=r.cliente?`<div class="abr-sales-meta">Cliente: ${esc(r.cliente)}</div>`:'';
    const note=String(r.observacoes||'').trim();
    const generic=/^(?:Planilha antiga \+ (?:Mercado Pago|PicPay)|Caderno(?: 15\/11| 17\/11)?(?: \+ (?:Mercado Pago|PicPay|confirmação no chat))?|Chat(?: de 14\/11| \+ Mercado Pago| de 14\/11 \+ PicPay)|Correção no chat \+ Mercado Pago)$/i;
    const observation=note&&!generic.test(note)?`<details class="abr-sale-observation"><summary>Observação da planilha</summary><div>${esc(note)}</div></details>`:'';
    const title=r.produto==='Não detalhado'?'Venda':r.produto||'Mercadoria';
    return `<details class="abr-sale-record abr-sale-private" data-abr-record="private:${esc(r.numero||String(index+1))}"><summary><span class="abr-sale-no">${index+1}</span><span class="abr-sale-name">${esc(title)}</span><strong class="abr-sales-portion">${money(c?channelAmount(r,c,true):r.valor)}${channelTag(c)}</strong><span class="abr-sale-chevron">⌄</span></summary><div class="abr-sale-record-body">${channelContext(r,c,true)}${received||'<div class="abr-sales-meta">Sem pagamento registrado</div>'}${change}${due}${client}${observation}</div></details>`;
  }
  function adjustmentDetail(r,c=null){
    return `<details class="abr-sales-adjustment" data-abr-record="adjustment:${esc(r.numero||String(r.valor))}"><summary><span>Ajuste de conciliação • sem venda comprovada</span><strong>${money(c?channelAmount(r,c,true):r.valor)}</strong><span>⌄</span></summary><div>Este valor consta no fechamento da planilha, mas não possui comprovante individual de venda. Foi mantido para não alterar o total consolidado.${r.observacoes?`<p>${esc(r.observacoes)}</p>`:''}</div></details>`;
  }
  function salesDetail(r,index,c=null){
    const parts=Array.isArray(r.recebimentos)?r.recebimentos:[];
    const received=parts.map(p=>`<div class="abr-sales-detail-line"><span>${esc(labelAccount(p.conta))}${p.conta==='Maquininha'?` • ${esc(p.canal||'Cartão')} / ${esc(p.metodo||'')}`:''}</span><b>${money(p.valor)}</b></div>${Number(p.taxa)>0?`<div class="abr-sales-detail-line abr-sales-fee"><span>Taxa</span><b>−${money(p.taxa)}</b></div>`:''}`).join('');
    const change=trocoPartes(r.troco).map(p=>`<div class="abr-sales-detail-line abr-sales-change"><span>Troco • ${esc(labelAccount(p.conta))}</span><b>−${money(p.valor)}</b></div>`).join('');
    const items=Array.isArray(r.itens)?r.itens:[];
    const title=items.map(i=>i.produto).filter(Boolean).join(' + ')||r.descricao||'Venda';
    const itemRows=items.length>1?items.map(i=>`<div class="abr-sales-detail-line"><span>${esc(i.produto||'Mercadoria')}${i.detalhe?' · '+esc(i.detalhe):''}</span><b>${money(i.total)}</b></div>`).join(''):'';
    const client=r.pessoa?`<div class="abr-sales-meta">Cliente: ${esc(r.pessoa)}</div>`:'';
    const note=r.observacao?`<div class="abr-sales-meta">${esc(r.observacao)}</div>`:'';
    const due=restante(r)>0.005?`<div class="abr-sales-detail-line abr-sales-due"><span>Fiado a receber</span><b>${money(restante(r))}</b></div>`:'';
    return `<details class="abr-sale-record" data-abr-record="sale:${esc(r.id)}"><summary><span class="abr-sale-no">${index+1}</span><span class="abr-sale-name">${esc(title)}</span><strong class="abr-sales-portion">${money(c?channelAmount(r,c):r.valor)}${channelTag(c)}</strong><span class="abr-sale-chevron">⌄</span></summary><div class="abr-sale-record-body">${channelContext(r,c)}${itemRows}${received||'<div class="abr-sales-meta">Sem pagamento registrado</div>'}${change}${due}${client}${note}<div class="abr-sales-cancel-row"><button type="button" data-abr-cancel-sale="${esc(r.id)}">Cancelar venda</button></div></div></details>`;
  }
  function dayDetails(d,c=null){
    const rows=detailSales(d),consolidated=dailySales(d).filter(r=>r.legacy),privateRows=imported(d);
    const privSales=privateSales(d),adjustments=privateAdjustments(d);
    // Nunca passar a função de renderização diretamente ao Array.map:
    // map fornece (registro, índice, ARRAY) e o 3º argumento seria
    // confundido com o canal de pagamento, quebrando título e valor.
    let markup=c?channelRows(d,c).current.map((r,i)=>salesDetail(r,i,c)).join('')+channelRows(d,c).previous.map((r,i)=>privateSaleDetail(r,channelRows(d,c).current.length+i,c)).join('')+channelRows(d,c).adjustments.map(r=>adjustmentDetail(r,c)).join(''):rows.map((r,i)=>salesDetail(r,i,null)).join('')+privSales.map((r,i)=>privateSaleDetail(r,rows.length+i,null)).join('')+adjustments.map(r=>adjustmentDetail(r,null)).join('');
    if(!c&&consolidated.length){
      const base=sum(consolidated.map(n)),history=sum(privateRows.map(n));
      if(!privateRows.length)markup+=`<div class="abr-sales-legacy">Vendas consolidadas: ${money(base)} • sem registros individuais</div>`;
      else if(Math.abs(base-history)>.009)markup+=`<div class="abr-sales-legacy">Diferença de ${money(Math.abs(base-history))}: vendas detalhadas somam ${money(round2(history+sum(rows.map(n))))} e o fechamento registra ${money(round2(base+sum(rows.map(n))))}. Fechamento preservado.</div>`;
    }
    return markup||`<div class="abr-sales-day-empty">Nenhuma venda em ${esc(c||'este dia')} registrada neste dia.</div>`;
  }
  function allDays(){
    const end=[today(),...realSales().map(r=>r.data),chosen].sort().at(-1);
    const days=[];let d=new Date(START+'T12:00:00');const last=new Date(end+'T12:00:00');
    while(d<=last&&days.length<1500){days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);d.setDate(d.getDate()+1)}
    return days.reverse();
  }
  function paint(){
    const date=mode==='hoje'?today():chosen;
    const sales=mode==='todos'?realSales():dailySales(date);
    const total=sum(sales.map(n));
    const count=mode==='todos'?detailSalesCount():countLabel(date);
    const {totals,unmapped}=flow(sales);
    // Os registros antigos já compõem o faturamento consolidado; detalham só os meios de recebimento.
    const oldDays=[...new Set(sales.filter(r=>r.legacy).map(r=>r.data))];
    let fiadoHistorico=0,semHistorico=false,cartaoAntigo=false,ajustes=0;
    for(const d of oldDays){
      const priv=imported(d);
      if(!priv.length){semHistorico=true;continue}
      const f=historicalFlow(priv);
      if(priv.some(r=>Number(r.cartaoAnterior||0)>0))cartaoAntigo=true;
      ajustes+=priv.filter(isAdjustment).length;
      for(const key of Object.keys(totals))totals[key]=round2(totals[key]+f.totals[key]);
      fiadoHistorico=round2(fiadoHistorico+f.fiado);
    }
    $('abr-sales-overview').innerHTML=`<div class="abr-sales-total"><small>${mode==='todos'?'TOTAL VENDIDO DESDE 14/11':'TOTAL VENDIDO'}</small><strong>${money(total)}</strong></div><div class="abr-sales-count"><span>${mode==='todos'?'Histórico completo':niceDate(date)}</span><b>${esc(count)}</b></div>`;
    const icons={'Pix':'◉','Espécie':'▤','Maquininha':'▣'};
    $('abr-sales-channels').innerHTML=CHANNELS.map(c=>`<button type="button" class="abr-sales-channel${channel===c?' active':''}" data-abr-channel="${c}" aria-pressed="${channel===c?'true':'false'}" aria-label="${channel===c?'Mostrar todas as vendas':'Filtrar vendas em '+c}"><span class="abr-sales-channel-label"><span aria-hidden="true">${icons[c]}</span> ${c}</span><strong>${moneySigned(totals[c])}</strong><small class="abr-sales-channel-action">${channel===c?'✓ Filtrando · toque para limpar':'Ver vendas ›'}</small></button>`).join('');
    // Somente os cartões filtram o histórico; nenhuma caixa de explicação
    // financeira aparece entre os cartões e as vendas.
    $('abr-sales-date-picker').hidden=mode!=='dia';
    $('abr-sales-date').value=date;
    document.querySelectorAll('[data-abr-sales-period]').forEach(b=>{const active=b.dataset.abrSalesPeriod===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    // Mostrar somente os dias do filtro ativo. O histórico inteiro pertence
    // exclusivamente à aba 'Todo o período'. Nenhum lançamento é apagado.
    const visibleDays=mode==='todos'?allDays():[date];
    const filteredDays=channel?visibleDays.filter(d=>{
      const rows=channelRows(d,channel);
      return rows.current.length+rows.previous.length+rows.adjustments.length>0;
    }):visibleDays;
    $('abr-sales-list').innerHTML=filteredDays.map(d=>{
      const isOff=!channel&&d==='2026-11-16'&&!dailySales(d).length&&!imported(d).length;
      // Ao filtrar, abrir o dia escolhido (ou o primeiro dia com resultados),
      // sem apagar a preferência original de abrir/fechar os dias.
      const open=!isOff&&(channel?(mode==='todos'?d===filteredDays[0]:true):(hasChoice(`day:${d}`)?salesUI[`day:${d}`]:(mode!=='todos'&&d===date)));
      const dayTotal=channel?channelDayTotal(d,channel):sum(dailySales(d).map(n));
      const label=channel?channelDayCount(d,channel):countLabel(d);
      return `<details class="abr-sales-day${isOff?' abr-sales-day-off':''}" data-abr-day="${d}"${open?' open':''}><summary class="abr-sales-day-summary"><span class="abr-sales-day-date">${shortDate(d)}</span><span class="abr-sales-day-count">${isOff?'Folga':esc(label)}</span><span class="abr-sales-day-total">${isOff?'':channel?money(dayTotal):dailySales(d).length?money(dayTotal):'—'}${channel?`<small class="abr-sales-day-channel-label">${esc(channel)} nas vendas</small>`:''}</span><span class="abr-sales-day-chevron">${isOff?'':'⌄'}</span></summary>${isOff?'':`<div class="abr-sales-day-content">${dayDetails(d,channel)}</div>`}</details>`;
    }).join('')||(channel?`<div class="abr-sales-no-channel">Nenhuma venda em <b>${esc(channel)}</b> neste período. <button type="button" id="abr-sales-empty-reset">Ver todas</button></div>`:'');
    // Restaurar a abertura de cada venda e observação, sem modificar valores.
    $('abr-sales-list').querySelectorAll('details[data-abr-record]').forEach(record=>{
      const key=uiKey(record);
      if(key&&hasChoice(key))record.open=!!salesUI[key];
      record.querySelectorAll('details.abr-sale-observation').forEach(note=>{
        const noteKey=uiKey(note);
        if(noteKey&&hasChoice(noteKey))note.open=!!salesUI[noteKey];
      });
    });
    // Dia de folga é rótulo informativo, não abre lançamentos fictícios.
    $('abr-sales-list').querySelectorAll('.abr-sales-day-off').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)d.open=false}));
  }
  function detailSalesCount(){
    const rows=realSales().filter(r=>!r.legacy);
    const importedCount=allDays().reduce((a,d)=>a+privateSales(d).length,0);
    const adjustments=allDays().reduce((a,d)=>a+privateAdjustments(d).length,0);
    const count=rows.length+importedCount;
    const uncertain=realSales().some(r=>r.legacy&&!imported(r.data).length);
    return count?`${count} vendas${adjustments?' · '+adjustments+' ajuste'+(adjustments===1?'':'s'):''}${uncertain?' identificadas':''}`:uncertain?'Consolidados':'0 vendas';
  }
  // Sobrescreve apenas a exibição, sem mexer no cálculo ou na persistência.
  renderSalesDay=paint;
  $('abr-import-vendas').onclick=()=>$('arquivoPlanilha').click();
  $('abr-sales-date').onchange=()=>{chosen=$('abr-sales-date').value||today();mode='dia';paint()};
  $('abr-sales-today').onclick=()=>{mode='hoje';chosen=today();paint()};
  document.querySelectorAll('[data-abr-sales-period]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.abrSalesPeriod;paint()}));
  $('abr-sales-channels').addEventListener('click',e=>{
    const button=e.target.closest('[data-abr-channel]');
    if(!button)return;
    channel=channel===button.dataset.abrChannel?null:button.dataset.abrChannel;
    paint();
  });
  $('abr-sales-list').addEventListener('click',e=>{
    if(e.target.closest('#abr-sales-empty-reset')){channel=null;paint();return}
    const summary=e.target.closest('summary');
    if(summary&&summary.parentElement?.tagName==='DETAILS'){
      const details=summary.parentElement;
      if(!details.classList.contains('abr-sales-day-off')){
        const key=uiKey(details);
        if(key)saveChoice(key,!details.open); // o clique alternará a abertura
      }
    }
    const b=e.target.closest('[data-abr-cancel-sale]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();removeTransaction(b.dataset.abrCancelSale);
  });
  // Navegar para Vendas NÃO desfaz a seleção nem a abertura escolhida.
  // O dia de hoje só é o padrão na primeira abertura do aplicativo.
  paint();
})();
