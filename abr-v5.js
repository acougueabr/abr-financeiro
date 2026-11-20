/* ABR Financeiro 5.5 — interface compacta baseada nos dados reais da v4.
 * Mantém o mesmo localStorage, o mesmo banco Supabase e as mesmas IDs.
 * Não inventa separação entre Pix/cartões ou lucro de vendas históricas. */
'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  const moneyBR=x=>money(x);
  const show=(name,sub)=>{
    document.querySelectorAll('main > [data-abr-screen]').forEach(node=>{
      const page=node.dataset.abrScreen;
      const visible = name==='mais' ? page==='mais' && (sub ? node.dataset.abrSub===sub : node.id==='abr-more-hub') : page===name;
      node.classList.toggle('abr-show',visible);
    });
    $('abr-home').classList.toggle('abr-show',name==='inicio');
    document.querySelectorAll('.abr-bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.abrGo===name));
    document.querySelectorAll('.abr-top-nav [data-abr-go]').forEach(b=>b.classList.toggle('active',b.dataset.abrGo===name));
    document.body.classList.toggle('abr-on-register',name==='registrar');
    if(name==='registrar')$('form').classList.remove('hidden');
    if(name==='mais'){
      document.querySelectorAll('#abr-more-hub [data-abr-sub]').forEach(b=>b.classList.toggle('abr-selected',b.dataset.abrSub===sub));
    }
    const label={inicio:'Início',registrar:'Registrar',pendencias:'Débitos',historico:'Histórico',mais:'Mais'}[name];
    document.title=`ABR Financeiro • ${label||'Início'}`;
    window.scrollTo({top:0,behavior:'instant'});
    try {history.replaceState(null,'','#'+(name==='mais'&&sub?sub:name));}catch{}
  };
  const knownPages=new Set(['inicio','registrar','pendencias','historico','mais']);
  function goto(name,sub){show(knownPages.has(name)?name:'inicio',sub||null)}
  function quick(type, preset=''){
    $('tipo').value=type;
    toggleFormType();
    $('form').classList.remove('hidden');
    $('toggle').textContent='Mostrar / ocultar';
    if(type==='compra'){
      $('statusCompra').value='pendente';
    }
    if(preset==='salario'){
      $('descricaoGeral').value='Ajudante — pagamento semanal';
      $('valorGeral').value='400';
      $('statusGeral').value='pendente';
      $('categoriaGeral').value='Equipe / ajudante';
    }else if(preset==='balanca'){
      $('descricaoGeral').value='Aquisição de balança';
      $('statusGeral').value='pendente';
      $('categoriaGeral').value='Equipamentos / balança';
    }
    goto('registrar');
    $('data').focus({preventScroll:true});
  }
  function availableBalances(){return balance()}
  function dashboardFinancial(){
    const regs=state.registros;
    const available= sum(Object.values(availableBalances()));
    const debt= sum(regs.filter(r=>isDebt(r)&&restante(r)>0).map(restante));
    const receivable= sum(regs.filter(r=>isReceivable(r)&&restante(r)>0).map(restante));
    const revenue= sum(regs.filter(r=>r.tipo==='venda'&&!r.semFaturamento).map(r=>r.valor));
    return {available,debt,receivable,revenue};
  }
  function debtRows(cat,from){
    return state.registros.filter(r=>r.tipo==='compra'&&supplierCategory(r)===cat).sort((a,b)=>a.data.localeCompare(b.data));
  }
  // Lista de compras por fornecedor. Simular nunca altera saldos; pagar vincula à compra original.
  function supplierRender(cat){
    const rows=debtRows(cat),due=sum(rows.map(r=>r.status==='pendente'?restante(r):0));
    const already=sum(rows.map(r=>r.status==='quitado'?n(r):paid(r.id)));
    let markup='';
    for(const r of rows){
      const info=supplierInfo(r),left=r.status==='pendente'?restante(r):0;
      const per=Number(info.preco||0),q=Number(info.quantidade||0);
      const val=q>0&&per>0?`${fmtQty(q,info.unidade||'kg')} × ${moneyBR(per)}`:(info.descricao||'Compra');
      if(Array.isArray(info.lotes)&&info.lotes.length){
        // 159 kg de compras consolidadas, com desconto conjunto: nunca registrar duas compras novas.
        for(const lot of info.lotes){
          markup+=`<div class="abr-ledger"><div class="abr-ledger-main"><span><b>${niceDate(lot.data)}</b> • ${fmtQty(lot.quantidade,'kg')} × ${moneyBR(per)}</span><b>${moneyBR(lot.quantidade*per)}</b></div><small class="abr-ok">PAGO • Valores brutos, desconto conjunto abaixo</small></div>`;
        }
        markup+=`<div class="abr-ledger abr-discount-note"><span>Descontos nas duas entregas: −${moneyBR(info.desconto)}<br><b>Efetivamente pago: ${moneyBR(n(r))}</b></span></div>`;
      }else{
        const shownDate=r.id==='c3'&&r.legacy?'17/11/2026':niceDate(r.data);
        const dateNote=r.id==='c3'&&r.legacy?'<small>Data informada: 17/11; o lançamento original estava em 18/11.</small>':'';
        const status=left>0.005?'PENDENTE':'PAGO';
        markup+=`<div class="abr-ledger"><div class="abr-ledger-main"><span><b>${shownDate}</b> • ${esc(val)}</span><b>${moneyBR(n(r))}</b></div>${dateNote}<small class="${left>0.005?'abr-due':'abr-ok'}">${status}${left>0.005?' • Falta '+moneyBR(left):''}${paid(r.id)>0?' • Pago até agora '+moneyBR(paid(r.id)):''}</small>${left>0.005?`<div class="abr-row-buttons"><button class="secondary smallBtn" data-abr-simulate="${esc(r.id)}" type="button">Simular</button><button class="smallBtn abr-paid-button" data-abr-confirm="${esc(r.id)}" type="button">✓ Já paguei</button></div>`:''}</div>`;
      }
    }
    if(!markup)markup='<p class="abr-help">Nenhuma compra cadastrada ainda.</p>';
    const head=`<span class="cat">${esc(cat)}<b>Já pago ${moneyBR(already)}</b></span><span class="sum ${due<0.005?'abr-ok':''}">${moneyBR(due)}</span>`;
    return `<details class="abr-supplier"><summary>${head}</summary><div class="abr-supplier-body">${markup}<div class="abr-row-buttons"><button type="button" class="secondary smallBtn" data-abr-buy="${esc(cat)}">＋ Nova compra</button></div></div></details>`;
  }
  function estimateProfit(){
    const sales=state.registros.filter(r=>r.tipo==='venda'&&Array.isArray(r.itens));
    const purchases=state.registros.filter(r=>r.tipo==='compra').map(supplierInfo);
    let accountedRevenue=0,accountedCost=0,uncosted=0,uncostedValue=0;
    for(const sale of sales)for(const item of sale.itens){
      const q=Number(item.quantidade),v=Number(item.total||0);
      const candidates=purchases.filter(p=>p.produto===item.produto&&p.unidade===(item.unidade||'kg')&&Number(p.preco)>0&&p.data<=sale.data).sort((a,b)=>b.data.localeCompare(a.data));
      // For bovino, a carcass-wide average does not represent margins of different cuts.
      if(item.produto==='Carne bovina'||!candidates.length||q<=0){uncosted++;uncostedValue+=v;continue}
      const p=candidates[0],unitCost=(Number(p.valor)||0)/Number(p.quantidade||1);
      accountedRevenue+=v;accountedCost+=q*unitCost;
    }
    const margin=round2(accountedRevenue-accountedCost);
    const expenses=sum(state.registros.filter(r=>r.tipo==='despesa').map(r=>r.valor));
    const hasLegacy=state.registros.some(r=>r.legacy&&r.tipo==='venda'&&!r.semFaturamento);
    return {margin,accountedRevenue,accountedCost,expenses,uncosted,uncostedValue,hasLegacy};
  }
  let activeAccount=null, paymentContext=null;
  // Simulação apenas em memória: não cria lançamentos nem altera saldos reais.
  let simCustom=false;
  const excludedAccounts=new Set();
  const excludedDebts=new Set();
  const expandedPayables=new Set(['Frango']);
  let showAllReceivables=false;
  let simSelectedIds=new Set();
  function pendingReceivables(){
    return state.registros.filter(r=>isReceivable(r)&&restante(r)>0.005)
      .sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))||String(a.pessoa||a.descricao||'').localeCompare(String(b.pessoa||b.descricao||''),'pt-BR'));
  }
  function selectedReceivables(rows){
    return simCustom?rows.filter(r=>simSelectedIds.has(String(r.id))):rows;
  }
  function payableRows(){return state.registros.filter(r=>isDebt(r)&&restante(r)>0.005)}
  function payableCategory(r){
    if(r.tipo==='compra')return supplierCategory(r)||'Outras mercadorias';
    if(r.tipo==='despesa')return /ajudante|salário|salario|equipe/i.test(r.descricao||'')?'Equipe':'Despesas';
    if(r.tipo==='investimento')return 'Investimentos';
    return 'Outras contas';
  }
  function groupedPayables(){
    const map=new Map();
    for(const r of payableRows()){
      const cat=payableCategory(r);
      if(!map.has(cat))map.set(cat,[]);
      map.get(cat).push(r);
    }
    const priority=['Carne bovina','Frango','Porco','Toscana','Calabresa','Outras mercadorias','Equipe','Despesas','Investimentos','Outras contas'];
    return [...map.entries()].sort((a,b)=>{
      const ia=priority.indexOf(a[0]),ib=priority.indexOf(b[0]);
      return (ia<0?999:ia)-(ib<0?999:ib)||a[0].localeCompare(b[0],'pt-BR');
    });
  }
  function selectedAvailable(f){
    const bal=availableBalances();
    return round2(f.available-sum([...excludedAccounts].map(k=>Number(bal[k]||0))));
  }
  function selectedDebt(){return sum(payableRows().filter(r=>!excludedDebts.has(String(r.id))).map(restante))}
  function selectedReceivableAmount(){return sum(selectedReceivables(pendingReceivables()).map(restante))}
  function updateSimulation(f){
    const available=selectedAvailable(f),debt=selectedDebt(),receivable=selectedReceivableAmount();
    const diff=round2(available-debt),projected=round2(available+receivable),after=round2(projected-debt);
    $('abr-home-caixa').textContent=moneyBR(available);
    $('abr-home-debitos').textContent=moneyBR(debt);
    $('abr-home-lucro').textContent=moneyBR(Math.abs(diff));
    $('abr-home-result-title').textContent=diff>=-0.005?'SOBRA APÓS QUITAR':'FALTA PRA QUITAR';
    $('abr-home-result-card').classList.toggle('abr-surplus',diff>=-0.005);
    $('abr-home-result-card').classList.toggle('abr-shortage',diff<-.005);
    $('abr-home-a-receber').textContent=moneyBR(receivable);
    $('abr-home-quanto-ficaria').textContent=moneyBR(projected);
    $('abr-home-faltaria-receber').textContent=moneyBR(Math.abs(after));
    $('abr-home-after-title').textContent=after>=-0.005?'SOBRA APÓS RECEBER':'FALTA APÓS RECEBER';
    $('abr-home-after-card').classList.toggle('abr-surplus',after>=-0.005);
    $('abr-home-after-card').classList.toggle('abr-shortage',after<-.005);
    const different=excludedAccounts.size>0||excludedDebts.size>0||(simCustom&&selectedReceivables(pendingReceivables()).length!==pendingReceivables().length);
    $('abr-sim-indicator').hidden=!different;
    return {available,debt,receivable,projected,diff,after};
  }
  function renderCleanLists(){
    const groups=groupedPayables();
    const allPending=payableRows();
    for(const id of [...excludedDebts])if(!allPending.some(r=>String(r.id)===id))excludedDebts.delete(id);
    const pay=$('abr-select-payables');
    pay.innerHTML=groups.length?groups.map(([cat,rows])=>{
      const amount=sum(rows.map(restante));
      const checked=rows.filter(r=>!excludedDebts.has(String(r.id))).length;
      const hasChildren=rows.length>1;
      const open=expandedPayables.has(cat);
      return `<div class="abr-clean-group"><div class="abr-clean-line">`+
        `<input type="checkbox" data-abr-debt-group="${esc(cat)}" aria-label="Incluir ${esc(cat)}" ${checked===rows.length?'checked':''}>`+
        `<button type="button" class="abr-clean-group-toggle" data-abr-expand-cat="${esc(cat)}" aria-expanded="${open}" aria-label="${esc(cat)}: ${rows.length} compra(s)"><span>${esc(cat)}${hasChildren?` <small>(${rows.length})</small>`:''}</span><b>${moneyBR(amount)}</b><span class="abr-clean-chevron">${open?'⌃':'⌄'}</span></button>`+
        `</div>`+(open?`<div class="abr-clean-children">${rows.map(r=>`<label class="abr-clean-line abr-clean-child"><input type="checkbox" data-abr-debt-id="${esc(r.id)}" ${excludedDebts.has(String(r.id))?'':'checked'}><span>${niceDate(r.id==='c3'&&r.legacy?'2026-11-17':r.data)}${r.descricao&&!r.legacy?' · '+esc(r.descricao):''}</span><b>${moneyBR(restante(r))}</b></label>`).join('')}</div>`:'')+`</div>`;
    }).join(''):'<p class="abr-clean-empty">Nenhuma conta pendente.</p>';
    pay.querySelectorAll('[data-abr-debt-group]').forEach(box=>{
      const rows=groups.find(([cat])=>cat===box.dataset.abrDebtGroup)?.[1]||[];
      const count=rows.filter(r=>!excludedDebts.has(String(r.id))).length;
      box.indeterminate=count>0&&count<rows.length;
    });
    const recRows=pendingReceivables();
    const shown=showAllReceivables?recRows:recRows.slice(0,4);
    $('abr-select-receivables').innerHTML=shown.length?shown.map(r=>{
      const selected=!simCustom||simSelectedIds.has(String(r.id));
      return `<label class="abr-clean-line abr-clean-receivable-line"><input type="checkbox" data-abr-receivable-inline="${esc(r.id)}" ${selected?'checked':''}><span>${esc(r.pessoa||r.descricao||'A receber')}</span><b>${moneyBR(restante(r))}</b></label>`;
    }).join(''):'<p class="abr-clean-empty">Nada a receber.</p>';
    const more=$('abr-receivable-expand');
    more.hidden=recRows.length<=4;
    more.textContent=showAllReceivables?'Ver menos':`Ver todos (${recRows.length})`;
  }
  function updateCleanHome(){
    const f=dashboardFinancial();
    updateSimulation(f);
    const bal=availableBalances();
    document.querySelectorAll('[data-abr-select-account]').forEach(box=>{box.checked=!excludedAccounts.has(box.dataset.abrSelectAccount)});
    // Existing modal is optional; if open, keep its calculation in sync.
    if($('abr-receivable-dialog').open)updateReceivableScenario(f);
  }
  function updateReceivableScenario(financial){
    const f=financial||dashboardFinancial();
    const rows=pendingReceivables();
    const selected=selectedReceivables(rows);
    const amount=sum(selected.map(restante));
    const projected=round2(selectedAvailable(f)+amount);
    const difference=round2(projected-selectedDebt());
    $('abr-home-a-receber').textContent=moneyBR(f.receivable);
    $('abr-home-quanto-ficaria').textContent=moneyBR(projected);
    $('abr-home-faltaria-receber').textContent=moneyBR(Math.abs(difference));
    $('abr-home-after-title').textContent=difference>=-0.005?'SOBRARIA APÓS QUITAR':'FALTARIA PRA QUITAR APÓS RECEBER';
    $('abr-home-after-note').textContent=difference>=-0.005?'Após pagar as contas pendentes':'Diferença após recebimentos simulados';
    $('abr-home-after-card').classList.toggle('abr-surplus',difference>=-0.005);
    $('abr-home-after-card').classList.toggle('abr-shortage',difference<-.005);
    $('abr-home-sim-note').textContent=rows.length?`Simulação • ${selected.length} de ${rows.length} selecionado${selected.length===1?'':'s'}`:'Sem valores pendentes';
    const count=$('abr-receivable-count');
    if(count)count.textContent=`${selected.length} de ${rows.length} selecionado${selected.length===1?'':'s'}`;
    const preview=$('abr-receivable-preview');
    if(preview)preview.innerHTML=`<div><span>A receber selecionado</span><b class="abr-blue-text">${moneyBR(amount)}</b></div>`+
      `<div><span>Quanto ficaria</span><b class="greenText">${moneyBR(projected)}</b></div>`+
      `<div><span>${difference>=-0.005?'Sobraria após quitar':'Faltaria após receber'}</span><b class="${difference>=-0.005?'greenText':'orange'}">${moneyBR(Math.abs(difference))}</b></div>`;
  }
  function renderReceivableList(){
    const rows=pendingReceivables();
    $('abr-receivable-list').innerHTML=rows.length?rows.map(r=>{
      const selected=!simCustom||simSelectedIds.has(String(r.id));
      const who=r.pessoa||r.descricao||'A receber';
      return `<label class="abr-receivable-row"><input type="checkbox" data-abr-receivable-id="${esc(r.id)}" ${selected?'checked':''}>`+
        `<span class="abr-receivable-person"><b>${esc(who)}</b><small>${r.tipo==='venda'?'Fiado':'Empréstimo'} • ${niceDate(r.data)}</small></span>`+
        `<strong>${moneyBR(restante(r))}</strong></label>`;
    }).join(''):'<p class="abr-receivable-empty">Não há fiados ou empréstimos pendentes.</p>';
    updateReceivableScenario();
  }
  function openReceivable(){
    renderReceivableList();
    $('abr-receivable-dialog').showModal();
  }

  function paint(){
    if(!$('abr-home-caixa'))return;
    const f=dashboardFinancial();
    updateSimulation(f);
    $('abr-home-faturamento').textContent='Faturamento: '+moneyBR(f.revenue);
    $('abr-home-receber').textContent='A receber: '+moneyBR(f.receivable);
    renderCleanLists();
    const bal=availableBalances();
    const categories=[['Espécie cédulas','Cédulas'],['Espécie moedas','Moedas'],['Pix','Pix'],['Maquininha','Maquininha']];
    $('abr-home-composicao').innerHTML=categories.map(([k,title])=>`<div class="abr-money"><span class="abr-money-name">${title}</span><strong>${moneyBR(bal[k]||0)}</strong></div>`).join('');
    const registerGrid=$('abr-reg-composicao');
    if(registerGrid)registerGrid.innerHTML=categories.map(([k,title])=>`<div class="abr-money"><span class="abr-money-name">${title}</span><strong class="${Number(bal[k]||0)<0?'red':''}">${moneyBR(bal[k]||0)}</strong></div>`).join('');
    if($('abr-reg-total'))$('abr-reg-total').textContent=moneyBR(sum(Object.values(bal)));
    paintAccountButtons(bal);
    document.querySelectorAll('[data-abr-select-account]').forEach(box=>{box.checked=!excludedAccounts.has(box.dataset.abrSelectAccount)});

    const other=Object.entries(bal).filter(([k,v])=>!categories.some(([cat])=>cat===k)&&Math.abs(Number(v))>0.005);
    const otherTotal=sum(other.map(([,v])=>v));
    $('abr-home-naoclassificado').innerHTML=other.length?`<b class="orange">Ainda sem separação: ${moneyBR(otherTotal)}</b><br>${other.map(([k,v])=>`${esc(k)}: ${moneyBR(v)}`).join(' • ')}. Use “Organizar” para classificar sem aumentar o caixa.`:'<span class="greenText">Todo o saldo foi distribuído entre os quatro grupos.</span>';
    if($('abr-reg-naoclassificado'))$('abr-reg-naoclassificado').innerHTML=other.length?`<span class="abr-soft">Também há ${moneyBR(otherTotal)} em contas antigas ainda sem separação. <button type="button" class="abr-text-button" id="abr-reg-organizar">Organizar no Início</button></span>`:'';
    if($('abr-reg-organizar'))$('abr-reg-organizar').onclick=()=>{goto('inicio');const d=$('abr-home-organizar');if(d)d.open=true;};
    $('abr-transfer-from').innerHTML=Object.entries(bal).filter(([k,v])=>Number(v)>0.005).map(([k,v])=>`<option value="${esc(k)}">${esc(k)} — ${moneyBR(v)}</option>`).join('');
    const prior=$('abr-transfer-to').value;
    $('abr-transfer-to').innerHTML=categories.map(([k,title])=>`<option value="${k}">${title}</option>`).join('');
    if(categories.some(([k])=>k===prior))$('abr-transfer-to').value=prior;
    const catNames=['Carne bovina','Frango','Porco','Toscana','Calabresa'];
    const cats=catNames.filter(cat=>state.registros.some(r=>r.tipo==='compra'&&supplierCategory(r)===cat));
    $('abr-home-fornecedores').innerHTML=cats.map(cat=>supplierRender(cat)).join('');
    const otherD=state.registros.filter(r=>r.tipo!=='compra'&&isDebt(r)&&restante(r)>0);
    const otherDue=sum(otherD.map(restante));
    if(otherDue>0)$('abr-home-fornecedores').insertAdjacentHTML('beforeend',`<details class="abr-supplier"><summary><span class="cat">Outras contas / equipe</span><span class="sum">${moneyBR(otherDue)}</span></summary><div class="abr-supplier-body">${otherD.map(r=>`<div class="abr-ledger"><div class="abr-ledger-main"><span>${niceDate(r.data)} • ${esc(r.descricao)}</span><b>${moneyBR(restante(r))}</b></div><div class="abr-row-buttons"><button type="button" class="secondary smallBtn" data-abr-simulate="${esc(r.id)}">Simular</button><button type="button" class="smallBtn abr-paid-button" data-abr-confirm="${esc(r.id)}">✓ Já paguei</button></div></div>`).join('')}</div></details>`);
    const remaining=f.available-f.debt;
    $('abr-home-decisao').innerHTML=remaining>=0?`Após quitar tudo, ainda teremos <b class="greenText">${moneyBR(remaining)}</b>`:`Para quitar todos os pagamentos pendentes, <b class="red">faltam ${moneyBR(-remaining)}</b><small>O cálculo não inclui compras futuras ainda não registradas.</small>`;
    const profit=estimateProfit();
    $('abr-home-lucro-detalhe').innerHTML=`Ainda não é possível dizer o lucro total com segurança: as vendas antigas não têm custo por corte/mercadoria detalhado. <b>Não tratamos a compra de estoque como prejuízo imediato.</b>`+
      (profit.accountedRevenue>0?`<div class="abr-ledger"><div class="abr-ledger-main"><span>Margem estimada em vendas detalhadas com custo conhecido</span><b class="${profit.margin>=0?'greenText':'red'}">${moneyBR(profit.margin)}</b></div><small>Receita considerada: ${moneyBR(profit.accountedRevenue)} • Custo da mercadoria vendida: ${moneyBR(profit.accountedCost)}. Não é lucro total.</small></div>`:'')+
      `<div class="abr-ledger"><div class="abr-ledger-main"><span>Despesas operacionais cadastradas</span><b>${moneyBR(profit.expenses)}</b></div><small>Salário do ajudante: R$ 400/semana, para lançar quando for devido. Balança é investimento, separado do custo operacional.</small></div>`;
    paintEvolution();
  }
  const trackedAccounts=[['Pix','Pix'],['Maquininha','Maquininha'],['Espécie cédulas','Cédulas'],['Espécie moedas','Moedas']];
  function effectByAccount(record){
    const effects={};if(record.legacy||record.semCaixa)return effects;
    const add=(name,v)=>{if(!name)return;effects[name]=round2((effects[name]||0)+v)};
    if(record.tipo==='venda'&&Array.isArray(record.recebimentos)){
      for(const p of record.recebimentos)add(p.conta,round2(Number(p.valor||0)-Number(p.taxa||0)));
      for(const p of trocoPartes(record.troco))add(p.conta,-p.valor);
    }else if(['recebimento','ajuste'].includes(record.tipo))add(record.conta,n(record));
    else if(['pagamento','emprestimo'].includes(record.tipo)||(['compra','despesa','investimento'].includes(record.tipo)&&record.status==='quitado'))add(record.conta,-n(record));
    else if(record.tipo==='venda'&&record.status==='quitado')add(record.conta,n(record));
    return effects;
  }
  function paintAccountButtons(bal){
    for(const [key] of trackedAccounts){const value=document.querySelector(`[data-abr-amount="${key}"]`);
      if(value){const v=Number(bal[key]||0);value.textContent=v<-.005?'Conferir':moneyBR(v);value.classList.toggle('abr-balance-review',v<-.005);}
      const button=document.querySelector(`[data-abr-account="${key}"]`);
      if(button){button.classList.toggle('active',activeAccount===key);button.classList.toggle('abr-needs-review',Number(bal[key]||0)<-.005);button.setAttribute('aria-expanded',String(activeAccount===key));}
    }
    const rest=Object.entries(bal).filter(([k,v])=>!trackedAccounts.some(([name])=>name===k)&&Math.abs(Number(v))>0.005);
    const other=$('abr-account-others');
    const negatives=trackedAccounts.filter(([k])=>Number(bal[k]||0)<-.005);
    const totalAntigo=sum(rest.map(([,v])=>v));
    const alerta=[negatives.length?negatives.map(([,name])=>esc(name)).join(', ')+' a conferir':'',rest.length?moneyBR(totalAntigo)+' sem separação':''].filter(Boolean).join(' · ');
    other.innerHTML=alerta?`<button class="abr-balance-compact-alert" type="button" id="abr-reconcile-warning"><span>⚠ ${alerta}</span><b>Conferir ›</b></button>`:'';
    const detail=$('abr-account-detail');
    if(!activeAccount){detail.hidden=true;detail.innerHTML='';return}
    detail.hidden=false;
    const events=state.registros.filter(r=>Math.abs(Number(effectByAccount(r)[activeAccount]||0))>0.005)
      .sort((a,b)=>b.data.localeCompare(a.data)||(b.criadoEm||'').localeCompare(a.criadoEm||''))
      .slice(0,4);
    const title=trackedAccounts.find(([key])=>key===activeAccount)?.[1]||activeAccount;
    detail.innerHTML=`<div class="abr-account-detail-head"><span>${esc(title)}</span><strong>${Number(bal[activeAccount]||0)<-.005?'⚠ A conferir':moneyBR(bal[activeAccount]||0)}</strong></div>`+
      (events.length?events.map(r=>`<div class="abr-account-entry"><span>${niceDate(r.data)} • ${esc(r.descricao||r.tipo)}</span><b class="${effectByAccount(r)[activeAccount]<0?'red':'greenText'}">${effectByAccount(r)[activeAccount]<0?'−':'+'}${moneyBR(Math.abs(effectByAccount(r)[activeAccount]))}</b></div>`).join(''):'<p class="abr-soft">Ainda sem movimentações detalhadas nesta conta.</p>');
  }
  function currentPendingByCat(cat){return state.registros.filter(r=>r.tipo==='compra'&&supplierCategory(r)===cat&&r.status==='pendente'&&restante(r)>0.005)}
  // V5.9: pagamento livre por forma, sem limitar pelas contas/valores exibidos.
  // A conta contabil permanece associada a cada método para abater o caixa acumulado correto.
  const paymentMethods=[
    {conta:'Espécie cédulas',label:'Cédulas'},
    {conta:'Espécie moedas',label:'Moedas'},
    {conta:'Pix',label:'Pix'},
    {conta:'Maquininha',label:'Maquininha'}
  ];
  function paymentParts(){
    return [...$('abr-payment-sources').querySelectorAll('.abr-payment-source')].map(box=>({
      conta:box.querySelector('.abr-pay-method-value').value,
      valor:round2(Number(box.querySelector('.abr-pay-amount').value||0))
    }));
  }
  function addPaymentSource(conta,valor){
    const holder=$('abr-payment-sources');if(holder.children.length>=4)return;
    const choice=paymentMethods.some(m=>m.conta===conta)?conta:paymentMethods[0].conta;
    const box=document.createElement('div');box.className='abr-payment-source';
    box.innerHTML=`<div class="abr-pay-source-head"><b>${holder.children.length?'Outra forma':'Forma 1'}</b><div class="abr-payment-money-entry"><span>R$</span><input type="number" class="abr-pay-amount" inputmode="decimal" step="0.01" min="0.01" placeholder="0,00" value="${Number(valor||0)>0?Number(valor).toFixed(2):''}" aria-label="Valor pago por esta forma"></div><button type="button" class="secondary abr-remove-source" aria-label="Retirar forma" ${holder.children.length?'':'hidden'}>×</button></div><input class="abr-pay-method-value" type="hidden" value="${esc(choice)}"><div class="abr-pay-methods" role="group" aria-label="Como pagou ao fornecedor">${paymentMethods.map(m=>`<button type="button" class="abr-pay-chip ${choice===m.conta?'active':''}" data-abr-method="${esc(m.conta)}" aria-pressed="${choice===m.conta}">${m.label}</button>`).join('')}</div>`;
    holder.appendChild(box);
  }
  function syncPaymentSourcesHead(){
    const boxes=[...$('abr-payment-sources').querySelectorAll('.abr-payment-source')];
    boxes.forEach((box,i)=>{box.querySelector('.abr-pay-source-head b').textContent='Forma '+(i+1);box.querySelector('.abr-remove-source').hidden=i===0});
    $('abr-payment-add-source').hidden=boxes.length>=4;
  }
  function openPayment({id,cat,mode}){
    const purchase=id?state.registros.find(r=>r.id===id):null;
    if(id&&(!purchase||!isDebt(purchase)||restante(purchase)<=0.005)){alert('Essa conta já foi quitada ou não existe mais.');render();return}
    const total=id?restante(purchase):sum(currentPendingByCat(cat).map(restante));
    if(total<=0.005){alert('Não há pendência para simular.');return}
    const sim=mode==='simulate';paymentContext={id:id||null,cat:cat||null,mode};
    $('abr-payment-title').textContent=sim?'SIMULAR ESTA COMPRA':'CONFIRMAR PAGAMENTO';
    $('abr-payment-subtitle').textContent=id?`${purchase.id==='c3'&&purchase.legacy?'17/11/2026':niceDate(purchase.data)} • ${purchase.descricao} • Pendente: ${moneyBR(total)}`:`Fornecedor: ${cat}`;
    $('abr-payment-amount').value=total.toFixed(2);
    $('abr-payment-amount').max=String(total);
    $('abr-payment-date').value=today();
    $('abr-payment-account-wrap').hidden=sim;
    $('abr-payment-confirm').hidden=sim;
    $('abr-payment-sources').innerHTML='';
    addPaymentSource('Espécie cédulas',total);
    syncPaymentSourcesHead();
    paintPaymentPreview();
    const dialog=$('abr-payment-dialog');
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  function paintPaymentPreview(){
    if(!paymentContext)return;
    // Um único lançamento é consultado; nunca usa a dívida total da loja para validar.
    const purchase=paymentContext.id?state.registros.find(r=>r.id===paymentContext.id):null;
    const max=purchase?restante(purchase):sum(currentPendingByCat(paymentContext.cat).map(restante));
    const amount=round2(Number($('abr-payment-amount').value));
    const isValid=Number.isFinite(amount)&&amount>0&&amount<=max+0.001;
    if(paymentContext.mode==='simulate'){
      $('abr-payment-results').hidden=false;
      $('abr-payment-results').innerHTML=`<div class="abr-mini-sim"><span>Valor pendente ${paymentContext.id?'desta compra':'deste fornecedor'}</span><b>${moneyBR(max)}</b></div>`+
        `<div class="abr-mini-sim"><span>Depois deste pagamento</span><b>${moneyBR(round2(max-Math.min(Math.max(amount||0,0),max)))}</b></div>`+
        (!isValid?'<p class="abr-payment-error">Informe um valor válido até o saldo pendente.</p>':'');
      $('abr-payment-remaining').textContent='';
      $('abr-payment-confirm').disabled=true;return;
    }
    $('abr-payment-results').hidden=true;
    $('abr-payment-results').innerHTML='';
    const parts=paymentParts();
    const allocated=round2(sum(parts.map(p=>p.valor)));
    const difference=round2(amount-allocated);
    const repeated=parts.length>1&&new Set(parts.map(p=>p.conta)).size!==parts.length;
    const partsValid=parts.length>0&&parts.every(p=>p.conta&&Number.isFinite(p.valor)&&p.valor>0)&&!repeated&&Math.abs(difference)<0.005;
    const notice=$('abr-payment-remaining');
    if(!Number.isFinite(amount)||amount<=0)notice.textContent='Informe quanto pagou.';
    else if(amount>max+0.001)notice.textContent='Acima do valor pendente desta compra: '+moneyBR(max)+'.';
    else if(repeated)notice.textContent='Escolha formas diferentes.';
    else if(allocated>amount+0.005)notice.textContent='Excedeu em '+moneyBR(allocated-amount)+'.';
    else if(allocated<amount-0.005)notice.textContent='Faltam '+moneyBR(amount-allocated)+'.';
    else if(parts.some(p=>!Number.isFinite(p.valor)||p.valor<=0))notice.textContent='Informe o valor de cada forma.';
    else notice.textContent='';
    notice.classList.toggle('abr-payment-has-error',!!notice.textContent);
    $('abr-payment-confirm').disabled=!isValid||!partsValid||paymentContext.mode!=='confirm';
  }
  let paymentSaving=false;
  function confirmPayment(){
    if(paymentSaving||!paymentContext||paymentContext.mode!=='confirm'||!paymentContext.id)return;
    const parent=state.registros.find(r=>r.id===paymentContext.id);
    if(!parent||!isDebt(parent)||restante(parent)<=0.005){alert('Esta dívida já foi quitada.');closePayment();render();return}
    const amount=round2(Number($('abr-payment-amount').value)),parts=paymentParts();
    const total=sum(parts.map(p=>p.valor));
    if(!Number.isFinite(amount)||amount<=0||amount>restante(parent)+.001||
       parts.length<1||parts.some(p=>!p.conta||!Number.isFinite(p.valor)||p.valor<=0)||
       new Set(parts.map(p=>p.conta)).size!==parts.length||Math.abs(total-amount)>.005){
       alert('Confira o valor pago e a divisão entre contas. A soma deve corresponder ao pagamento.');return;
    }
    const paidDate=$('abr-payment-date').value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)){alert('Informe a data em que realmente pagou.');return}
    const details=parts.map(p=>`${paymentMethods.find(m=>m.conta===p.conta)?.label||p.conta}: ${moneyBR(p.valor)}`).join('\n');
    const question=`Registrar pagamento de ${moneyBR(amount)} em ${niceDate(paidDate)}?\n${parent.descricao}\n\n${details}\n\nA dívida será reduzida e o valor sairá das formas informadas no caixa acumulado.`;
    if(!confirm(question))return;
    paymentSaving=true;
    const old=state.registros.slice(),group=uid(),timestamp=new Date().toISOString();
    parts.forEach((p,i)=>state.registros.push({id:uid(),tipo:'pagamento',data:paidDate,criadoEm:timestamp,
      descricao:`Pagamento — ${parent.descricao}${parts.length>1?' (parte '+(i+1)+')':''}`,
      pessoa:parent.pessoa||'',valor:p.valor,conta:p.conta,status:'quitado',vinculo:parent.id,
      grupoTransferencia:group,origem:'pagamento-compra-v510'}));
    if(!save()){state.registros=old;paymentSaving=false;alert('Não foi possível salvar. Nenhum pagamento foi confirmado.');return}
    paymentSaving=false;closePayment();render();showSaveToast('Pagamento desta compra registrado');
  }
  function closePayment(){const d=$('abr-payment-dialog');if(d.open){if(typeof d.close==='function')d.close();else d.removeAttribute('open')}paymentContext=null}
  function paintEvolution(){
    const root=$('abr-evo-bars');if(!root)return;
    const periods=Number($('abr-evo-range').value)||7;
    const all=$('abr-evo-range').value==='all';
    const base=new Date(today()+'T12:00:00');
    let dates=[];
    const firstDay=all?new Date((state.registros.map(r=>r.data).filter(Boolean).sort()[0]||today())+'T12:00:00'):new Date(base);
    if(!all)firstDay.setDate(firstDay.getDate()-periods+1);
    for(let d=new Date(firstDay);d<=base&&dates.length<365;d.setDate(d.getDate()+1))dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    const daily=new Map(dates.map(d=>[d,0]));
    for(const r of state.registros)if(r.tipo==='venda'&&!r.semFaturamento&&daily.has(r.data))daily.set(r.data,round2(daily.get(r.data)+n(r)));
    const values=[...daily.values()],max=Math.max(1,...values),total=sum(values),f=dashboardFinancial();
    $('abr-evo-stats').innerHTML=`<div><small>Vendas no período</small><strong>${moneyBR(total)}</strong></div><div><small>Disponível agora</small><strong class="greenText">${moneyBR(f.available)}</strong></div><div><small>Contas a pagar</small><strong class="red">${moneyBR(f.debt)}</strong></div>`;
    root.innerHTML=dates.map((d,i)=>`<div class="abr-evo-row"><span>${niceDate(d).slice(0,5)}</span><div class="abr-evo-track"><div class="abr-evo-fill" style="width:${(values[i]/max*100).toFixed(1)}%"></div></div><b>${moneyBR(values[i])}</b></div>`).join('');
  }
  function transfer(e){
    e.preventDefault();
    const from=$('abr-transfer-from').value,to=$('abr-transfer-to').value,amount=round2(Number($('abr-transfer-value').value));
    if(!from||from===to||!Number.isFinite(amount)||amount<=0){alert('Escolha categorias diferentes e valor positivo.');return}
    if((Number(availableBalances()[from])||0)+.001<amount){alert('O valor supera o saldo da conta de origem.');return}
    if(!confirm(`Classificar ${moneyBR(amount)} de ${from} para ${to}? O total disponível não mudará.`))return;
    const current=[...state.registros],group=uid(),timestamp=new Date().toISOString(),day=today();
    state.registros.push({id:uid(),tipo:'ajuste',data:day,descricao:`Transferência de classificação: ${from} → ${to}`,valor:-amount,conta:from,grupoTransferencia:group,criadoEm:timestamp,status:'quitado'});
    state.registros.push({id:uid(),tipo:'ajuste',data:day,descricao:`Transferência de classificação: ${from} → ${to}`,valor:amount,conta:to,grupoTransferencia:group,criadoEm:timestamp,status:'quitado'});
    if(!save()){state.registros=current;return}
    $('abr-transfer-value').value='';render();
    alert('Saldo organizado! O total disponível não mudou.');
  }
  // V5.7: conferência real, sem presumir origem de saldos antigos nem criar vendas.
  const reconciledAccounts=['Espécie cédulas','Espécie moedas','Pix','Maquininha'];
  const reconcileDialog=$('abr-reconcile-dialog');
  function reconcileInputs(){return Array.from(reconcileDialog.querySelectorAll('[data-abr-reconcile]'))}
  function reconcileValues(){
    const values={};
    for(const field of reconcileInputs()){
      const value=Number(field.value);
      if(!field.value.trim()||!Number.isFinite(value)||value<0)return null;
      values[field.dataset.abrReconcile]=round2(value);
    }
    return values;
  }
  function showReconcilePreview(){
    const current=round2(sum(Object.values(balance()))), values=reconcileValues();
    const output=$('abr-reconcile-summary');
    if(!values){output.innerHTML=`Total registrado: <b>${moneyBR(current)}</b><br>Informe os quatro valores para conferir.`;return}
    const total=sum(Object.values(values)),difference=round2(total-current);
    output.innerHTML=`<div>Registrado no app <b>${moneyBR(current)}</b></div><div>Contado nas 4 contas <b>${moneyBR(total)}</b></div><div class="${Math.abs(difference)>0.005?'abr-reconcile-difference':''}">Diferença de conferência <b>${difference>0?'+':''}${moneyBR(difference)}</b></div>`+
      (Math.abs(difference)>0.005?'<p>Há uma diferença entre o caixa registrado e a contagem real. Ela será lançada como ajuste de caixa, <b>não como faturamento</b>, se você confirmar.</p>':'<p>Os saldos serão reorganizados sem mudar o total disponível.</p>');
  }
  function openReconcile(){
    const bal=balance();
    for(const field of reconcileInputs()){
      const current=Number(bal[field.dataset.abrReconcile]||0);
      // Números antigos são referência para digitação, não saldos verificados.
      field.value=String(Math.max(0,round2(current)).toFixed(2));
    }
    showReconcilePreview();
    reconcileDialog.showModal();
  }
  function closeReconcile(){reconcileDialog.close()}
  function commitReconcile(event){
    event.preventDefault();
    const desired=reconcileValues();if(!desired){alert('Informe os quatro saldos corretamente.');return}
    const before=balance();
    const current=sum(Object.values(before)),target=sum(Object.values(desired)),difference=round2(target-current);
    const detail=Object.entries(desired).map(([key,val])=>`${key.replace('Espécie ','')}: ${moneyBR(val)}`).join('\n');
    const question=`Conferir os saldos de hoje?\n\n${detail}\n\nSaldo registrado: ${moneyBR(current)}\nSaldo contado: ${moneyBR(target)}\nDiferença: ${moneyBR(difference)}\n\n`+
      (Math.abs(difference)>0.005?'A diferença será registrada como AJUSTE DE CAIXA, e não como venda. Verifique se faltou lançar alguma entrada/saída antes de continuar.':'O valor disponível total continuará igual.');
    if(!confirm(question))return;
    const oldRecords=state.registros.slice(),group=uid(),time=new Date().toISOString(),date=today();
    const keys=new Set([...Object.keys(before),...reconciledAccounts]);
    for(const key of keys){
      const corrected=reconciledAccounts.includes(key)?desired[key]:0;
      const delta=round2(corrected-(Number(before[key])||0));
      if(Math.abs(delta)<0.005)continue;
      state.registros.push({id:uid(),tipo:'ajuste',data:date,descricao:`Conferência de saldos • ${key}`,valor:delta,conta:key,status:'quitado',criadoEm:time,grupoTransferencia:group,origem:'conferencia-saldos'});
    }
    if(!save()){state.registros=oldRecords;return}
    closeReconcile();activeAccount=null;render();
  }
  $('abr-receivable-close').onclick=()=>$('abr-receivable-dialog').close();
  $('abr-receivable-done').onclick=()=>$('abr-receivable-dialog').close();
  $('abr-receivable-all').onclick=()=>{simCustom=false;simSelectedIds.clear();renderReceivableList();renderCleanLists();updateCleanHome()};
  $('abr-receivable-none').onclick=()=>{simCustom=true;simSelectedIds.clear();renderReceivableList();renderCleanLists();updateCleanHome()};
  $('abr-receivable-list').addEventListener('change',e=>{
    const field=e.target.closest('[data-abr-receivable-id]');if(!field)return;
    if(!simCustom){simSelectedIds=new Set(pendingReceivables().map(r=>String(r.id)));simCustom=true;}
    if(field.checked)simSelectedIds.add(field.dataset.abrReceivableId);
    else simSelectedIds.delete(field.dataset.abrReceivableId);
    updateReceivableScenario();renderCleanLists();updateCleanHome();
  });
  document.querySelectorAll('[data-abr-open-receivable]').forEach(b=>b.addEventListener('click',()=>{goto('inicio');$('abr-select-receivables').scrollIntoView({behavior:'smooth',block:'center'})}));
  document.querySelectorAll('.abr-top-nav [data-abr-go]').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.abrGo)));
  $('abr-back-register').addEventListener('click',()=>goto('inicio'));
  $('abr-reconcile-open').onclick=openReconcile;
  $('abr-reconcile-close').onclick=closeReconcile;
  $('abr-reconcile-cancel').onclick=closeReconcile;
  reconcileInputs().forEach(field=>field.addEventListener('input',showReconcilePreview));
  $('abr-reconcile-form').addEventListener('submit',commitReconcile);
  document.body.classList.add('abr-v5');
  // Home mode is default; anchor links to legacy sections remain navigable.
  document.querySelectorAll('.abr-bottom-nav [data-abr-go]').forEach(b=>b.onclick=()=>goto(b.dataset.abrGo));
  $('abr-account-buttons').addEventListener('click',e=>{
    const button=e.target.closest('[data-abr-account]');if(!button)return;
    activeAccount=activeAccount===button.dataset.abrAccount?null:button.dataset.abrAccount;
    paintAccountButtons(availableBalances());
  });
  $('abr-account-others').addEventListener('click',e=>{if(e.target.closest('#abr-reconcile-warning'))openReconcile()});
  $('abr-account-buttons').addEventListener('change',e=>{
    const box=e.target.closest('[data-abr-select-account]');if(!box)return;
    if(box.checked)excludedAccounts.delete(box.dataset.abrSelectAccount);
    else excludedAccounts.add(box.dataset.abrSelectAccount);
    updateCleanHome();
  });
  $('abr-select-payables').addEventListener('change',e=>{
    const item=e.target.closest('[data-abr-debt-id]');
    if(item){if(item.checked)excludedDebts.delete(item.dataset.abrDebtId);else excludedDebts.add(item.dataset.abrDebtId)}
    const group=e.target.closest('[data-abr-debt-group]');
    if(group){const rows=groupedPayables().find(([cat])=>cat===group.dataset.abrDebtGroup)?.[1]||[];
      for(const r of rows){if(group.checked)excludedDebts.delete(String(r.id));else excludedDebts.add(String(r.id))}
    }
    renderCleanLists();updateCleanHome();
  });
  $('abr-select-payables').addEventListener('click',e=>{
    const button=e.target.closest('[data-abr-expand-cat]');if(!button)return;
    const cat=button.dataset.abrExpandCat;
    if(expandedPayables.has(cat))expandedPayables.delete(cat);else expandedPayables.add(cat);
    renderCleanLists();
  });
  $('abr-select-receivables').addEventListener('change',e=>{
    const box=e.target.closest('[data-abr-receivable-inline]');if(!box)return;
    if(!simCustom){simSelectedIds=new Set(pendingReceivables().map(r=>String(r.id)));simCustom=true}
    if(box.checked)simSelectedIds.add(box.dataset.abrReceivableInline);
    else simSelectedIds.delete(box.dataset.abrReceivableInline);
    updateCleanHome();
  });
  $('abr-receivable-expand').addEventListener('click',()=>{showAllReceivables=!showAllReceivables;renderCleanLists()});

  $('abr-payment-close').onclick=closePayment;
  $('abr-payment-cancel').onclick=closePayment;
  $('abr-payment-dialog').addEventListener('cancel',()=>{paymentContext=null});
  let previousMainPaymentValue=0;
  $('abr-payment-amount').addEventListener('focus',()=>{previousMainPaymentValue=Number($('abr-payment-amount').value||0)});
  $('abr-payment-amount').addEventListener('input',()=>{
    const boxes=$('abr-payment-sources').querySelectorAll('.abr-payment-source');
    if(boxes.length===1){
      const field=boxes[0].querySelector('.abr-pay-amount');
      if(Math.abs(Number(field.value||0)-previousMainPaymentValue)<0.005){
        field.value=$('abr-payment-amount').value;
      }
    }
    previousMainPaymentValue=Number($('abr-payment-amount').value||0);
    paintPaymentPreview();
  });
  $('abr-payment-sources').addEventListener('input',paintPaymentPreview);
  $('abr-payment-sources').addEventListener('change',paintPaymentPreview);
  $('abr-payment-sources').addEventListener('click',e=>{
    const button=e.target.closest('[data-abr-method]');
    if(button){
      const box=button.closest('.abr-payment-source');
      box.querySelector('.abr-pay-method-value').value=button.dataset.abrMethod;
      box.querySelectorAll('.abr-pay-chip').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});
      paintPaymentPreview();return;
    }
    if(!e.target.closest('.abr-remove-source'))return;
    if($('abr-payment-sources').children.length<=1)return;
    e.target.closest('.abr-payment-source').remove();syncPaymentSourcesHead();paintPaymentPreview();
  });
  $('abr-payment-add-source').onclick=()=>{
    if($('abr-payment-sources').children.length>=4)return;
    const amount=round2(Number($('abr-payment-amount').value));
    const parts=paymentParts();
    // A primeira forma deixa de ficar automaticamente com o valor total quando houver divisão.
    if(parts.length===1&&(Math.abs(parts[0].valor-amount)<.005||parts[0].valor>amount)){
      $('abr-payment-sources').querySelector('.abr-pay-amount').value='';
    }
    const used=paymentParts().map(p=>p.conta);
    const choice=paymentMethods.find(m=>!used.includes(m.conta))?.conta||'Pix';
    const remaining=Math.max(0,round2(amount-sum(paymentParts().map(p=>p.valor))));
    addPaymentSource(choice,parts.length===1?0:remaining);syncPaymentSourcesHead();paintPaymentPreview();
  };
  $('abr-payment-confirm').onclick=confirmPayment;
  $('abr-evo-range').onchange=paintEvolution;
  $('abr-fast-week').onclick=()=>quick('despesa','salario');
  $('abr-fast-scale').onclick=()=>quick('investimento','balanca');
  $('abr-transfer-form').addEventListener('submit',transfer);
  $('abr-home').addEventListener('click',e=>{
    const card=e.target.closest('[data-abr-card-action]');
    if(card){
      const action=card.dataset.abrCardAction;
      if(action==='receivable'){$('abr-select-receivables').scrollIntoView({behavior:'smooth',block:'center'});return}
      if(action==='payables'){$('abr-select-payables').scrollIntoView({behavior:'smooth',block:'center'});return}
      if(action==='accounts'){$('abr-account-buttons').scrollIntoView({behavior:'smooth',block:'center'});return}
    }
    const go=e.target.closest('[data-abr-go]');if(go){goto(go.dataset.abrGo,go.dataset.abrSub);return}
    const sim=e.target.closest('[data-abr-simulate]');if(sim){openPayment({id:sim.dataset.abrSimulate,mode:'simulate'});return}
    const simcat=e.target.closest('[data-abr-simulate-cat]');if(simcat){openPayment({cat:simcat.dataset.abrSimulateCat,mode:'simulate'});return}
    const pay=e.target.closest('[data-abr-confirm]');if(pay){openPayment({id:pay.dataset.abrConfirm,mode:'confirm'});return}
    const buy=e.target.closest('[data-abr-buy]');if(buy){quick('compra');$('produtoCompra').value=buy.dataset.abrBuy;updatePurchasePreview()}
  });
  $('abr-more-hub').addEventListener('click',e=>{const b=e.target.closest('[data-abr-sub]');if(b)goto('mais',b.dataset.abrSub)});
  $('painelFornecedores').addEventListener('click',e=>{
    if(e.target.closest('[data-buy-supplier],[data-pay-supplier]'))setTimeout(()=>goto('registrar'),0);
  });
  // Cloud, deletion, and new sales all invoke render() so the new dashboard updates as well.
  const originalRender=render;
  render=function(){originalRender();paint()};
  paint();
  // Do not expose past data by default on shared screens.
  const hash=location.hash.replace('#','');
  if(['relatorios','estoque','sincronizacao','backup'].includes(hash))goto('mais',hash);
  else goto(knownPages.has(hash)?hash:'inicio');
})();
