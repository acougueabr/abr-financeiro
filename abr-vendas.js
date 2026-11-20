/* ABR Financeiro v6.5 — somente apresentação do histórico; dados reais do state. */
'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  const START='2026-11-14';
  let mode='hoje',chosen=today();
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
  function countLabel(d){
    const details=detailSales(d),old=dailySales(d).some(r=>r.legacy),priv=imported(d);
    if(details.length)return `${details.length} venda${details.length===1?'':'s'}`;
    if(priv.length)return `${priv.length} venda${priv.length===1?'':'s'}`;
    if(old)return 'Consolidado';
    return '0 vendas';
  }
  function salesDetail(r,index){
    const parts=Array.isArray(r.recebimentos)?r.recebimentos:[];
    const received=parts.map(p=>`<div class="abr-sales-detail-line"><span>${esc(labelAccount(p.conta))}${p.conta==='Maquininha'?` • ${esc(p.canal||'Cartão')} / ${esc(p.metodo||'')}`:''}</span><b>${money(p.valor)}</b></div>${Number(p.taxa)>0?`<div class="abr-sales-detail-line abr-sales-fee"><span>Taxa</span><b>−${money(p.taxa)}</b></div>`:''}`).join('');
    const change=trocoPartes(r.troco).map(p=>`<div class="abr-sales-detail-line abr-sales-change"><span>Troco • ${esc(labelAccount(p.conta))}</span><b>−${money(p.valor)}</b></div>`).join('');
    const items=Array.isArray(r.itens)?r.itens:[];
    const title=items.map(i=>i.produto).filter(Boolean).join(' + ')||r.descricao||'Venda';
    const itemRows=items.length>1?items.map(i=>`<div class="abr-sales-detail-line"><span>${esc(i.produto||'Mercadoria')}${i.detalhe?' · '+esc(i.detalhe):''}</span><b>${money(i.total)}</b></div>`).join(''):'';
    const client=r.pessoa?`<div class="abr-sales-meta">Cliente: ${esc(r.pessoa)}</div>`:'';
    const note=r.observacao?`<div class="abr-sales-meta">${esc(r.observacao)}</div>`:'';
    const due=restante(r)>0.005?`<div class="abr-sales-detail-line abr-sales-due"><span>Fiado a receber</span><b>${money(restante(r))}</b></div>`:'';
    return `<details class="abr-sale-record"><summary><span class="abr-sale-no">${index+1}</span><span class="abr-sale-name">${esc(title)}</span><strong>${money(r.valor)}</strong><span class="abr-sale-chevron">⌄</span></summary><div class="abr-sale-record-body">${itemRows}${received||'<div class="abr-sales-meta">Sem pagamento registrado</div>'}${change}${due}${client}${note}<div class="abr-sales-cancel-row"><button type="button" data-abr-cancel-sale="${esc(r.id)}">Cancelar venda</button></div></div></details>`;
  }
  function dayDetails(d){
    const rows=detailSales(d),consolidated=dailySales(d).filter(r=>r.legacy),privateRows=imported(d);
    let markup=rows.map(salesDetail).join('');
    if(consolidated.length)markup+=`<div class="abr-sales-legacy">Vendas consolidadas: ${money(sum(consolidated.map(n)))} • sem registros individuais</div>`;
    if(privateRows.length){
      const entries=privateRows.map((r,i)=>`<details class="abr-sale-record abr-sale-private"><summary><span class="abr-sale-no">${i+1}</span><span class="abr-sale-name">${esc(r.produto||'Mercadoria')}</span><strong>${money(r.valor)}</strong><span class="abr-sale-chevron">⌄</span></summary><div class="abr-sale-record-body">${r.cliente?`<div class="abr-sales-meta">${esc(r.cliente)}</div>`:''}${r.observacoes?`<div class="abr-sales-meta">${esc(r.observacoes)}</div>`:''}</div></details>`).join('');
      markup+=`<details class="abr-sales-private-group"><summary>Histórico importado • ${privateRows.length} vendas (conferência)</summary>${entries}</details>`;
    }
    return markup||'<div class="abr-sales-day-empty">Nenhuma venda registrada neste dia.</div>';
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
    const {totals,hasLegacy,unmapped}=flow(sales);
    $('abr-sales-overview').innerHTML=`<div class="abr-sales-total"><small>${mode==='todos'?'TOTAL VENDIDO DESDE 14/11':'TOTAL VENDIDO'}</small><strong>${money(total)}</strong></div><div class="abr-sales-count"><span>${mode==='todos'?'Histórico completo':niceDate(date)}</span><b>${esc(count)}</b></div>`;
    const icons={'Pix':'◉','Espécie':'▤','Maquininha':'▣'};
    $('abr-sales-channels').innerHTML=['Pix','Espécie','Maquininha'].map(c=>`<div class="abr-sales-channel"><span class="abr-sales-channel-label"><span aria-hidden="true">${icons[c]}</span> ${c}</span><strong>${moneySigned(totals[c])}</strong></div>`).join('');
    const clarity=$('abr-sales-clarity');
    const notes=[];
    if(hasLegacy)notes.push('Vendas antigas: pagamentos não detalhados');
    if(unmapped)notes.push('Algumas formas de recebimento não classificadas');
    clarity.textContent=notes.join(' · ');clarity.hidden=!notes.length;
    $('abr-sales-date-picker').hidden=mode!=='dia';
    $('abr-sales-date').value=date;
    document.querySelectorAll('[data-abr-sales-period]').forEach(b=>{const active=b.dataset.abrSalesPeriod===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    $('abr-sales-list').innerHTML=allDays().map(d=>{
      const isOff=d==='2026-11-16'&&!dailySales(d).length&&!imported(d).length;
      const open=mode!=='todos'&&d===date&&!isOff;
      const dayTotal=sum(dailySales(d).map(n));
      return `<details class="abr-sales-day${isOff?' abr-sales-day-off':''}" data-abr-day="${d}"${open?' open':''}><summary class="abr-sales-day-summary"><span class="abr-sales-day-date">${shortDate(d)}</span><span class="abr-sales-day-count">${isOff?'Folga':esc(countLabel(d))}</span><span class="abr-sales-day-total">${isOff?'':dailySales(d).length?money(dayTotal):'—'}</span><span class="abr-sales-day-chevron">${isOff?'':'⌄'}</span></summary>${isOff?'':`<div class="abr-sales-day-content">${dayDetails(d)}</div>`}</details>`;
    }).join('');
    // Dia de folga é rótulo informativo, não abre lançamentos fictícios.
    $('abr-sales-list').querySelectorAll('.abr-sales-day-off').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)d.open=false}));
  }
  function detailSalesCount(){
    const rows=realSales().filter(r=>!r.legacy),privateOnly=new Set();
    for(const d of allDays())if(!detailSales(d).length&&imported(d).length)privateOnly.add(d);
    const importedCount=[...privateOnly].reduce((a,d)=>a+imported(d).length,0);
    const count=rows.length+importedCount;
    const uncertain=realSales().some(r=>r.legacy&&!(detailSales(r.data).length||imported(r.data).length));
    return count?`${count} vendas${uncertain?' identificadas':''}`:uncertain?'Consolidados':'0 vendas';
  }
  // Sobrescreve apenas a exibição, sem mexer no cálculo ou na persistência.
  renderSalesDay=paint;
  $('abr-sales-date').onchange=()=>{chosen=$('abr-sales-date').value||today();mode='dia';paint()};
  $('abr-sales-today').onclick=()=>{mode='hoje';chosen=today();paint()};
  document.querySelectorAll('[data-abr-sales-period]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.abrSalesPeriod;if(mode==='hoje')chosen=today();paint()}));
  $('abr-sales-list').addEventListener('click',e=>{
    const b=e.target.closest('[data-abr-cancel-sale]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();removeTransaction(b.dataset.abrCancelSale);
  });
  // Toda nova abertura de Vendas começa pelo dia atual, inclusive no celular.
  document.addEventListener('click',e=>{const b=e.target.closest('[data-abr-go="vendasdia"]');if(b){mode='hoje';chosen=today();paint()}},true);
  paint();
})();
