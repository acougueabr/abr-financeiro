/* ABR Financeiro 5.0 — interface compacta baseada nos dados reais da v4.
 * Mantém o mesmo localStorage, o mesmo banco Supabase e as mesmas IDs.
 * Não inventa separação entre Pix/cartões ou lucro de vendas históricas. */
'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  const moneyBR=x=>money(x);
  const show=(name,sub)=>{
    document.querySelectorAll('main > [data-abr-screen]').forEach(node=>{
      const page=node.dataset.abrScreen;
      const visible = name==='mais' ? page==='mais' && (node.id==='abr-more-hub' || (!!sub && node.dataset.abrSub===sub)) : page===name;
      node.classList.toggle('abr-show',visible);
    });
    $('abr-home').classList.toggle('abr-show',name==='inicio');
    document.querySelectorAll('.abr-bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.abrGo===name));
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
  function supplierRender(cat,available){
    const rs=debtRows(cat);
    const balanceDue=sum(rs.map(r=>r.status==='pendente'?restante(r):0));
    const paidAmount=sum(rs.map(r=>r.status==='quitado'?Number(r.valor):paid(r.id)));
    const names={'Carne bovina':'Carne bovina','Frango':'Frango','Porco':'Porco','Toscana':'Toscana','Calabresa':'Calabresa'};
    const items=rs.map(r=>{
      const info=supplierInfo(r);
      const status=r.status==='pendente'&&restante(r)>0.001?'PENDENTE':'PAGO';
      const value=status==='PAGO'?n(r):restante(r);
      if(Array.isArray(info.lotes)&&info.lotes.length){
        return info.lotes.map(l=>{
          const g=Number(l.quantidade)*Number(info.preco);
          return `<div class="abr-ledger"><div class="abr-ledger-main"><span>${niceDate(l.data)} • ${fmtQty(l.quantidade,'kg')} × ${moneyBR(info.preco)}</span><b>${moneyBR(g)}</b></div><small class="abr-ok">PAGO • Valor bruto antes dos descontos</small></div>`;
        }).join('')+`<div class="abr-ledger"><small>Desconto das duas entregas: −${moneyBR(info.desconto)}. <b>Efetivamente pago: ${moneyBR(n(r))}</b> (não duplicado).</small></div>`;
      }
      const date=r.id==='c3'&&r.legacy?'17/11 (informado)':' '+niceDate(r.data);
      const discrep=r.id==='c3'&&r.legacy?'<small>O registro inicial traz 18/11; você informou 17/11. Data ainda não alterada.</small>':'';
      const qtd=info.quantidade>0?`${fmtQty(info.quantidade,info.unidade||'kg')} × ${moneyBR(info.preco)}`:(info.descricao||'Compra');
      return `<div class="abr-ledger"><div class="abr-ledger-main"><span>${date} • ${qtd}</span><b>${moneyBR(n(r))}</b></div><small class="${status==='PAGO'?'abr-ok':'abr-due'}">${status}${status==='PENDENTE'?` • Restam ${moneyBR(value)}`:''}</small>${discrep}</div>`;
    }).join('')||'<p class="abr-help">Nenhuma compra cadastrada.</p>';
    let availableAfter=available-balanceDue;
    const action=availableAfter>=0?`Se quitar este fornecedor, sobram ${moneyBR(availableAfter)}.`:`Se quitar este fornecedor, faltam ${moneyBR(-availableAfter)}.`;
    const extra=cat==='Carne bovina'?'<p class="abr-help">Nova entrega de 18/11? Registre o peso real. Não incluímos uma compra ainda sem quantidade e valor.</p>':'';
    return `<details class="abr-supplier"><summary><span class="cat">${names[cat]||cat}<b>Já pago ${moneyBR(paidAmount)}</b></span><span class="sum">${moneyBR(balanceDue)}</span></summary><div class="abr-supplier-body">${items}<p class="abr-help">${action}</p>${extra}<button type="button" class="secondary smallBtn" data-abr-buy="${cat}">＋ Nova compra</button></div></details>`;
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
  function paint(){
    if(!$('abr-home-caixa'))return;
    const f=dashboardFinancial();
    $('abr-home-caixa').textContent=moneyBR(f.available);
    $('abr-home-debitos').textContent=moneyBR(f.debt);
    $('abr-home-lucro').textContent='A apurar';
    $('abr-home-faturamento').textContent='Faturamento: '+moneyBR(f.revenue);
    $('abr-home-receber').textContent='A receber: '+moneyBR(f.receivable);
    const bal=availableBalances();
    const categories=[['Espécie cédulas','Cédulas'],['Espécie moedas','Moedas'],['Pix','Pix'],['Maquininha','Maquininha']];
    $('abr-home-composicao').innerHTML=categories.map(([k,title])=>`<div class="abr-money"><span class="abr-money-name">${title}</span><strong>${moneyBR(bal[k]||0)}</strong></div>`).join('');
    const registerGrid=$('abr-reg-composicao');
    if(registerGrid)registerGrid.innerHTML=categories.map(([k,title])=>`<div class="abr-money"><span class="abr-money-name">${title}</span><strong class="${Number(bal[k]||0)<0?'red':''}">${moneyBR(bal[k]||0)}</strong></div>`).join('');
    if($('abr-reg-total'))$('abr-reg-total').textContent=moneyBR(sum(Object.values(bal)));

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
    $('abr-home-fornecedores').innerHTML=cats.map(cat=>supplierRender(cat,f.available)).join('');
    const otherD=state.registros.filter(r=>r.tipo!=='compra'&&isDebt(r)&&restante(r)>0);
    const otherDue=sum(otherD.map(restante));
    if(otherDue>0)$('abr-home-fornecedores').insertAdjacentHTML('beforeend',`<details class="abr-supplier"><summary><span class="cat">Outras contas / equipe</span><span class="sum">${moneyBR(otherDue)}</span></summary><div class="abr-supplier-body">${otherD.map(r=>`<div class="abr-ledger"><div class="abr-ledger-main"><span>${niceDate(r.data)} • ${esc(r.descricao)}</span><b>${moneyBR(restante(r))}</b></div></div>`).join('')}</div></details>`);
    const remaining=f.available-f.debt;
    $('abr-home-decisao').innerHTML=remaining>=0?`Após quitar tudo, ainda teremos <b class="greenText">${moneyBR(remaining)}</b>`:`Para quitar todos os pagamentos pendentes, <b class="red">faltam ${moneyBR(-remaining)}</b><small>O cálculo não inclui compras futuras ainda não registradas.</small>`;
    const profit=estimateProfit();
    $('abr-home-lucro-detalhe').innerHTML=`Ainda não é possível dizer o lucro total com segurança: as vendas antigas não têm custo por corte/mercadoria detalhado. <b>Não tratamos a compra de estoque como prejuízo imediato.</b>`+
      (profit.accountedRevenue>0?`<div class="abr-ledger"><div class="abr-ledger-main"><span>Margem estimada em vendas detalhadas com custo conhecido</span><b class="${profit.margin>=0?'greenText':'red'}">${moneyBR(profit.margin)}</b></div><small>Receita considerada: ${moneyBR(profit.accountedRevenue)} • Custo da mercadoria vendida: ${moneyBR(profit.accountedCost)}. Não é lucro total.</small></div>`:'')+
      `<div class="abr-ledger"><div class="abr-ledger-main"><span>Despesas operacionais cadastradas</span><b>${moneyBR(profit.expenses)}</b></div><small>Salário do ajudante: R$ 400/semana, para lançar quando for devido. Balança é investimento, separado do custo operacional.</small></div>`;
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
  document.body.classList.add('abr-v5');
  // Home mode is default; anchor links to legacy sections remain navigable.
  document.querySelectorAll('.abr-bottom-nav [data-abr-go]').forEach(b=>b.onclick=()=>goto(b.dataset.abrGo));
  $('abr-fast-sale').onclick=()=>quick('venda');
  $('abr-fast-buy').onclick=()=>quick('compra');
  $('abr-fast-week').onclick=()=>quick('despesa','salario');
  $('abr-fast-scale').onclick=()=>quick('investimento','balanca');
  $('abr-transfer-form').addEventListener('submit',transfer);
  $('abr-home').addEventListener('click',e=>{
    const go=e.target.closest('[data-abr-go]');if(go){goto(go.dataset.abrGo,go.dataset.abrSub);return}
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
