/* ABR Financeiro 6.1 — histórico privado por dia: NÃO cria novas receitas. */
'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const e=window.esc || (x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const fmt=x=>money(Number(x)||0);
  const amt=x=>Math.round((Number(x)||0)*100)/100;
  const add=xs=>amt(xs.reduce((n,x)=>n+(Number(x)||0),0));
  const normal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const datesOf=()=>{
    const out=new Set((state.abrFechamentoPrivado?.dias||[]).map(x=>x.data));
    (state.registros||[]).filter(r=>r.tipo==='venda'&&!r.semFaturamento).forEach(r=>out.add(r.data));
    return [...out].filter(x=>/^20\d{2}-\d\d-\d\d$/.test(x)).sort();
  };
  const isArchived=d=>state.abrFechamentoPrivado?.dias?.find(x=>x.data===d);
  const liveSales=d=>(state.registros||[]).filter(r=>r.tipo==='venda'&&!r.legacy&&!r.semFaturamento&&r.data===d);
  const entryChannel=p=>{
    const s=normal((p.conta||'')+' '+(p.metodo||''));
    if(s.includes('moed')||s.includes('cedula')||s.includes('especie')||s.includes('dinheiro'))return 'especie';
    if(s.includes('pix')||s.includes('picpay'))return 'pix';
    if(s.includes('maquininha')||s.includes('mercado pago')||s.includes('debito')||s.includes('credito')||s.includes('cartao'))return 'maquininha';
    return 'outras';
  };
  function liveSummary(rows){
    const r={situacao:'REGISTRADO NO APP',numeroVendas:rows.length,faturamento:0,especieVendas:0,pixLiquido:0,pixRecebido:0,trocoPix:0,cartaoCaderno:0,cartaoLiquido:0,taxasCartao:0,fiado:0,outras:0};
    for(const v of rows){
      r.faturamento+=Number(v.valor)||0;
      const parts=Array.isArray(v.recebimentos)?v.recebimentos:[];
      let collected=0,changeSum=0;
      for(const p of parts){
        const value=Number(p.valor)||0,col=entryChannel(p);collected+=value;
        if(col==='especie')r.especieVendas+=value;
        else if(col==='pix'){r.pixRecebido+=value;r.pixLiquido+=value}
        else if(col==='maquininha'){r.cartaoCaderno+=value;r.cartaoLiquido+=value-(Number(p.taxa)||0);r.taxasCartao+=Number(p.taxa)||0}
        else r.outras+=value;
      }
      const changes=typeof trocoPartes==='function' ? trocoPartes(v.troco) : (v.troco?.partes||[]);
      for(const p of changes){
        const value=Number(p.valor)||0,col=entryChannel(p);changeSum+=value;
        if(col==='especie')r.especieVendas-=value;
        else if(col==='pix'){r.pixLiquido-=value;r.trocoPix+=value}
        else if(col==='maquininha')r.cartaoCaderno-=value;
        else r.outras-=value;
      }
      if(v.status==='pendente')r.fiado+=Math.max(0,(Number(v.valor)||0)-(collected-changeSum));
    }
    for(const key of ['faturamento','especieVendas','pixLiquido','pixRecebido','trocoPix','cartaoCaderno','cartaoLiquido','taxasCartao','fiado','outras'])r[key]=amt(r[key]);
    return r;
  }
  let selected='',showAll=false;
  function formatSale(v,fromPlan){
    const p=[];const x=(label,value)=>{if(Math.abs(Number(value)||0)>.005)p.push(`<div><span>${label}</span><b>${fmt(value)}</b></div>`)};
    if(fromPlan){
      x('Espécie retida',v.especieRetida);x('Pix recebido',v.pixRecebido);x('Troco Pix',-v.trocoPix);
      x('Maquininha',v.cartaoCaderno);x('Maquininha após taxas',v.cartaoLiquido);
      x('Fiado',v.fiado);
      if(v.notasRecebidas||v.trocoNotas)x('Notas recebidas / troco',v.notasRecebidas);
      if(v.trocoNotas)x('Troco em notas',-v.trocoNotas);
    }else{
      for(const pa of v.recebimentos||[])x((pa.metodo||'Recebido')+' • '+(pa.conta||'Conta'),pa.valor);
      const change=typeof trocoPartes==='function'?trocoPartes(v.troco):[];
      for(const pa of change)x('Troco • '+(pa.conta||'Conta'),-pa.valor);
    }
    const note=fromPlan?`${v.observacoes||''}${v.situacao?' • '+v.situacao:''}`:`${v.status||''} • Lançamento novo do app`;
    return `<details class="abr-hist-sale"><summary><span><b>${fromPlan?'#'+e(v.numero)+' ':''}${e(fromPlan?v.mercadoria:(v.descricao||'Venda'))}</b><small>${fromPlan?'Caderno / planilha':'Registrada no sistema'}</small></span><b>${fmt(v.valor)}</b></summary><div class="abr-hist-sale-body">${p.join('')||'<p>Forma não detalhada</p>'}${note?`<p>${e(note)}</p>`:''}</div></details>`;
  }
  function drawRows(rows,fromPlan,title){
    const visible=showAll?rows:rows.slice(0,7);
    return `<div class="abr-hist-sales-head"><b>${title} • ${rows.length}</b>${rows.length>7?`<button type="button" class="secondary" id="abr-hist-showall">${showAll?'Mostrar menos':'Ver todas'}</button>`:''}</div>${visible.map(r=>formatSale(r,fromPlan)).join('')||'<p class="abr-hist-footnote">Nenhuma venda para este dia.</p>'}`;
  }
  function paint(){
    const selector=$('abr-hist-data'); if(!selector)return;
    const list=datesOf(); const prev=selector.value;
    const d=selected&&list.includes(selected)?selected:(prev&&list.includes(prev)?prev:(state.abrFechamentoPrivado?.atualizadoAte||list.at(-1)));
    if(!list.length){$('abr-hist-summary').innerHTML='<strong>Sem vendas registradas</strong>';selector.innerHTML='';$('abr-hist-breakdown').innerHTML='';$('abr-hist-list').innerHTML='';$('abr-hist-note').textContent='Importe o arquivo privado da planilha para visualizar os fechamentos antigos.';return}
    selector.innerHTML=list.map(date=>`<option value="${e(date)}">${niceDate(date)}${isArchived(date)?' • Planilha':''}</option>`).join('');
    selector.value=list.includes(d)?d:list.at(-1);selected=selector.value;
    const old=isArchived(selected),live=liveSales(selected),v=old||(live.length?liveSummary(live):{faturamento:0,numeroVendas:0,situacao:'SEM VENDAS'});
    const stateName=v.situacao||'—',isPartial=normal(stateName).includes('parcial');
    $('abr-hist-summary').innerHTML=`<div><small>VENDAS DE ${niceDate(selected)}</small><strong>${fmt(v.faturamento)}</strong><small>${v.numeroVendas||0} venda(s)</small></div><span class="abr-hist-pill ${isPartial?'partial':''}">${e(stateName)}</span>`;
    const blocks=[['Espécie',v.especieVendas,'Valor das vendas em dinheiro, após trocos'],['Pix',v.pixLiquido,'Recebido menos troco via Pix'],['Maquininha',v.cartaoCaderno,`Líquido após taxas: ${fmt(v.cartaoLiquido||0)}`],['Fiado',v.fiado,'Vendas a prazo do dia']];
    if(!old&&!live.length&&selected)blocks.splice(0);
    $('abr-hist-breakdown').innerHTML=blocks.map(([n,value,desc])=>`<div class="abr-hist-money"><span>${n}</span><strong>${fmt(value)}</strong><small>${e(desc)}</small></div>`).join('');
    const historicalRows=old?(state.abrFechamentoPrivado?.vendas||[]).filter(r=>r.data===selected):[];
    $('abr-hist-list').innerHTML=(old?drawRows(historicalRows,true,'Vendas da planilha'):'') +
      (!old||live.length?drawRows(live,false,old?'Vendas registradas depois no site':'Vendas do aplicativo'):'');
    const note=old?'Fechamento histórico para consulta: não é somado novamente ao faturamento nem ao caixa.':
      'Lançamentos registrados no aplicativo: estes já participam dos totais financeiros.';
    $('abr-hist-note').innerHTML=note + (old&&live.length?'<br><span class="abr-hist-warning">Há vendas adicionais cadastradas neste dia no app. Confira possíveis duplicidades antes de somar os dois históricos.</span>':'')+
     (old&&selected==='2026-11-18'?'<br><span class="abr-hist-warning">18/11 é parcial na planilha (R$ 534,05). Fechamento anterior: R$ 740,23 — diferença R$ 206,18 ainda por conferir.</span>':'');
    const b=$('abr-hist-showall');if(b)b.onclick=()=>{showAll=!showAll;paint()};
  }
  const dateSelector=$('abr-hist-data');if(!dateSelector)return;
  const mode=val=>{
    document.body.classList.toggle('abr-hist-day-view',val==='dia');
    document.body.classList.toggle('abr-hist-app-view',val==='app');
    document.querySelectorAll('[data-abr-hist-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.abrHistTab===val)});
    if(val==='dia')paint();
  };
  document.querySelectorAll('[data-abr-hist-tab]').forEach(b=>b.addEventListener('click',()=>mode(b.dataset.abrHistTab)));
  dateSelector.addEventListener('change',()=>{selected=dateSelector.value;showAll=false;paint()});
  $('abr-hist-importar').addEventListener('click',()=>{
    // A tela de fechamento existente já tem importador com validação (5 dias / 96 vendas) e salva no Supabase.
    const input=$('abr-dia-arquivo');if(!input){alert('Importador não carregou. Atualize a página.');return}
    input.click();
  });
  $('abr-dia-arquivo')?.addEventListener('change',()=>{setTimeout(()=>{const after=state.abrFechamentoPrivado; if(after){selected=after.atualizadoAte||selected;showAll=false;paint()}},250)});
  const prevRender=render;
  render=function(){prevRender();if(document.getElementById('abr-hist-painel'))paint()};
  mode('dia');paint();
})();
