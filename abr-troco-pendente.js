/* ABR Financeiro v6.6.9 — reserva e entrega de troco ao cliente.
   Não migra nem altera registros anteriores automaticamente. */
'use strict';
(()=>{
  const list=document.getElementById('abr-sales-list');
  if(!list)return;
  const accountOptions=['Espécie cédulas','Espécie moedas','Pix'];
  const css=document.createElement('style');
  css.textContent='.abr-sales-pending-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.abr-sales-pending-actions button{background:#263b38;border:1px solid #4b9b85;color:#a9f3d9;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:700}.abr-pending-card{border:1px solid #50635d;border-radius:12px;padding:12px;margin:12px 0;background:#17221f}.abr-pending-card h3{margin:0 0 8px;font-size:14px}.abr-pending-card p{margin:5px 0;color:#b7c7c4;font-size:12px}';
  css.textContent += '.abr-pending-inline{margin:12px 0 14px;padding:12px;border:1px solid #344f49;border-radius:10px;background:#17211f}.abr-pending-inline .checkrow{display:flex;align-items:center;gap:8px;font-size:13px}.abr-pending-inline input[type=checkbox]{width:17px;height:17px;accent-color:#5dd4ad}.abr-pending-inline #abr-pending-fields{margin-top:12px}.abr-pending-inline #abr-pending-new{width:100%;margin:6px 0 8px}.abr-pending-preview{display:flex;justify-content:space-between;margin:8px 0;color:#c6d8d2}.abr-pending-inline small{color:#a6b9b3}';
  document.head.append(css);
  const toggle=document.getElementById('abr-pending-toggle');
  const fields=document.getElementById('abr-pending-fields');
  const amount=document.getElementById('abr-pending-new');
  const preview=document.getElementById('abr-pending-now');
  function refreshPending(){
    fields.classList.toggle('hidden',!toggle.checked);
    if(!toggle.checked)amount.value='';
    const total=Number((document.getElementById('trocoPrevisto')?.textContent||'0').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
    const due=toggle.checked?(Number(amount.value)||0):0;
    preview.textContent=money(Math.max(0,Math.round((total-due)*100)/100));
    amount.max=String(total);
  }
  toggle.addEventListener('change',refreshPending);
  amount.addEventListener('input',refreshPending);
  document.getElementById('form')?.addEventListener('reset',()=>{toggle.checked=false;fields.classList.add('hidden');preview.textContent='R$ 0,00'});
  document.getElementById('form')?.addEventListener('input',e=>{if(e.target!==amount)refreshPending()});
  document.getElementById('form')?.addEventListener('change',e=>{if(e.target!==toggle)refreshPending()});
  refreshPending();
  function record(id){return state.registros.find(r=>r.id===id&&r.tipo==='venda'&&!r.legacy)}
  function updateHome(){const e=document.getElementById('abr-pending-home');if(!e)return;const rows=state.registros.filter(r=>r.tipo==='venda'&&trocoPendenteAberto(r)>.005);const total=sum(rows.map(trocoPendenteAberto));e.hidden=!rows.length;e.innerHTML=rows.length?`<h3>Trocos pendentes: ${money(total)}</h3><p>${rows.length} venda(s) com troco a devolver. Esse valor já está fora do Quanto tenho disponível.</p>`:'';}
  function persist(){
    if(!save())return false;
    render();updateHome();
    if(typeof renderSalesDay==='function')renderSalesDay();
    return true;
  }
  function edit(id){
    const r=record(id);if(!r)return;
    const old=Number(r.trocoPendente||0),paid=sum(state.registros.filter(x=>x.tipo==='ajuste'&&x.trocoLiquidacao&&x.vinculo===id).map(x=>-x.valor));
    const total=round2(old+sum(trocoPartes(r.troco).map(p=>p.valor)));
    const raw=prompt(`Quanto do troco desta venda ficou devendo ao cliente?\n\nTroco total: ${money(total)}\nJá entregue depois: ${money(paid)}\n\nDigite o valor TOTAL pendente originalmente (R$):`,old.toFixed(2).replace('.',','));
    if(raw===null)return;
    const value=Number(raw.trim().replace(/\s/g,'').replace(',','.'));
    if(!Number.isFinite(value)||value<paid-.005||value>total+.005){alert(`Informe um valor entre ${money(paid)} e ${money(total)}.`);return}
    const account=prompt('De qual forma de troco você ainda NÃO entregou?\n1 = Cédulas\n2 = Moedas\n3 = Pix','2');
    if(account===null)return;
    const chosen=accountOptions[Number(account)-1];if(!chosen){alert('Escolha 1, 2 ou 3.');return}
    const oldTroco=structuredClone(r.troco),oldValue=r.trocoPendente;
    if(!alterarTrocoPendente(r,round2(value),chosen)){alert('Não é possível reservar mais do que o troco já marcado como entregue. Confira a venda.');return}
    if(!persist()){r.troco=oldTroco;r.trocoPendente=oldValue;return}
    alert('Troco pendente atualizado. O valor ficou reservado fora do Quanto tenho disponível.');
  }
  function pay(id){
    const r=record(id);if(!r)return;
    const due=trocoPendenteAberto(r);if(due<.005){alert('Não existe troco pendente nesta venda.');return}
    const raw=prompt(`Quanto você entregou ao cliente agora?\n\nPendente: ${money(due)}`,due.toFixed(2).replace('.',','));
    if(raw===null)return;
    const amount=Number(raw.trim().replace(/\s/g,'').replace(',','.'));
    if(!Number.isFinite(amount)||amount<=0||amount>due+.005){alert('Informe um valor positivo até o troco pendente.');return}
    const option=prompt('Como você entregou o troco?\n1 = Cédulas\n2 = Moedas\n3 = Pix','2');
    if(option===null)return;
    const conta=accountOptions[Number(option)-1];if(!conta){alert('Escolha 1, 2 ou 3.');return}
    if(!confirm(`Confirmar entrega de ${money(amount)} em ${conta}?\n\nO dinheiro físico sairá desta conta. O Quanto tenho disponível não será descontado novamente.`))return;
    const entry={id:uid(),tipo:'ajuste',data:today(),criadoEm:new Date().toISOString(),descricao:'Troco entregue ao cliente — '+(r.pessoa||r.descricao||'Venda'),valor:-round2(amount),conta,status:'quitado',vinculo:id,trocoLiquidacao:true};
    state.registros.push(entry);
    if(!persist()){state.registros.pop();return}
    alert(`Troco entregue. Restante a devolver: ${money(trocoPendenteAberto(r))}.`);
  }
  const originalRender=render;render=function(...args){const result=originalRender.apply(this,args);updateHome();return result};
  updateHome();
  list.addEventListener('click',e=>{
    const editButton=e.target.closest('[data-abr-pending-edit]');
    if(editButton){e.preventDefault();e.stopPropagation();edit(editButton.dataset.abrPendingEdit);return}
    const payButton=e.target.closest('[data-abr-pending-pay]');
    if(payButton){e.preventDefault();e.stopPropagation();pay(payButton.dataset.abrPendingPay)}
  });
})();
