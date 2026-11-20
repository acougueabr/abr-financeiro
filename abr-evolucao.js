/* ABR Financeiro 6.6.0 — compras e vendas acumuladas, sem alterar os dados. */
'use strict';
(()=>{
  const START='2026-11-14';
  const root=document.getElementById('abr-business-chart');
  if(!root||typeof state==='undefined'||typeof render!=='function')return;
  const $=id=>document.getElementById(id);
  const BR=x=>money(round2(x));
  const short=d=>d.slice(8,10)+'/'+d.slice(5,7);
  const cents=n=>Math.round((Number(n)||0)*100);
  const fromCents=n=>Math.round(n)/100;
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const daysBetween=(a,b)=>{
    const result=[],end=new Date(b+'T12:00:00');
    for(let date=new Date(a+'T12:00:00');date<=end&&result.length<5000;date.setDate(date.getDate()+1))result.push(iso(date));
    return result;
  };
  let period='all',selected=null;
  const add=(map,date,value)=>map.set(date,(map.get(date)||0)+cents(value));
  function sourceData(){
    const purchases=new Map(),sales=new Map(),counts=new Map(),legacy=new Set();
    const all=state.registros||[];
    for(const r of all){
      if(!r||typeof r.data!=='string'||r.data<START)continue;
      if(r.tipo==='compra'){
        // Lançamento c1 contém DUAS bandas (14 e 15/11). Rateio proporcional
        // ao peso, com arredondamento e fechamento exato do valor do registro.
        const lot=typeof LEGACY_LOTS!=='undefined'&&r.legacy&&r.id==='c1'?LEGACY_LOTS.c1:null;
        if(lot&&Array.isArray(lot.lotes)&&lot.lotes.length){
          const totalCents=cents(r.valor),totalWeight=lot.lotes.reduce((s,x)=>s+Number(x.quantidade||0),0);
          let allocated=0;
          lot.lotes.forEach((item,i)=>{
            const share=i===lot.lotes.length-1?totalCents-allocated:Math.round(totalCents*Number(item.quantidade||0)/totalWeight);
            allocated+=share;
            purchases.set(item.data,(purchases.get(item.data)||0)+share);
          });
        }else add(purchases,r.data,r.valor);
      }else if(r.tipo==='venda'&&!r.semFaturamento){
        add(sales,r.data,r.valor);
        if(r.legacy)legacy.add(r.data);
        else counts.set(r.data,(counts.get(r.data)||0)+1);
      }
    }
    if(Array.isArray(state.historicoPlanilha))for(const r of state.historicoPlanilha){
      if(r&&typeof r.data==='string'&&r.data>=START&&!r.ajusteConciliacao&&legacy.has(r.data))counts.set(r.data,(counts.get(r.data)||0)+1);
    }
    const latest=[today(),...purchases.keys(),...sales.keys()].sort().at(-1);
    const dates=daysBetween(START,latest);
    let buy=0,sell=0;
    const rows=dates.map(date=>{
      const dayBuy=purchases.get(date)||0,daySell=sales.get(date)||0;
      buy+=dayBuy;sell+=daySell;
      return {date,dayBuy,daySell,buy,sell,count:counts.get(date)||0,legacy:legacy.has(date)};
    });
    return rows;
  }
  function compact(v){
    const abs=Math.abs(v);
    if(abs>=1000000)return 'R$ '+(v/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi';
    if(abs>=1000)return 'R$ '+(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';
    return 'R$ '+Math.round(v).toLocaleString('pt-BR');
  }
  function renderGraph(rows){
    const plot=$('abr-business-plot');
    if(!rows.length){plot.innerHTML='<p class="abr-business-warning">Sem movimentações para mostrar.</p>';return}
    const mobile=window.innerWidth<=600;
    const W=mobile?440:960,H=mobile?265:312;
    const left=mobile?58:82,right=mobile?12:18,top=mobile?20:22,bottom=mobile?39:43;
    const w=W-left-right,h=H-top-bottom;
    const maximum=Math.max(1,...rows.map(r=>Math.max(r.buy,r.sell)))/100;
    const scale=Math.pow(10,Math.floor(Math.log10(maximum/4||1)));
    const choices=[1,2,2.5,5,10];
    const step=choices.map(x=>x*scale).find(x=>x*4>=maximum)||10*scale;
    const yMax=Math.max(step*4,maximum);
    const x=i=>left+(rows.length===1?w/2:(i/(rows.length-1))*w);
    const y=v=>top+h-(v/100)/yMax*h;
    const point=(r,i,field)=>`${x(i).toFixed(1)},${y(r[field]).toFixed(1)}`;
    const line=field=>'M '+rows.map((r,i)=>point(r,i,field)).join(' L ');
    let stepPath='M '+point(rows[0],0,'buy');
    for(let i=1;i<rows.length;i++)stepPath+=` H ${x(i).toFixed(1)} V ${y(rows[i].buy).toFixed(1)}`;
    const grid=Array.from({length:5},(_,i)=>{
      const val=yMax*i/4,yy=top+h-i*h/4;
      return `<line x1="${left}" x2="${W-right}" y1="${yy}" y2="${yy}" stroke="#334451" stroke-width="1" stroke-dasharray="3 5"/><text x="${left-9}" y="${yy+4}" text-anchor="end" font-size="${mobile?11:12}" fill="#b0bec9">${compact(val)}</text>`;
    }).join('');
    const count=rows.length;
    const maxLabels=mobile?5:10;
    const labelStep=Math.max(1,Math.ceil((count-1)/Math.max(1,maxLabels-1)));
    const labels=rows.map((r,i)=>i===0||i===count-1||i%labelStep===0?`<text x="${x(i)}" y="${H-12}" font-size="${mobile?12:13}" fill="#b6c5d0" text-anchor="middle">${short(r.date)}</text>`:'').join('');
    const last=rows.at(-1),chosen=rows.find(r=>r.date===selected)||last;
    const idx=rows.indexOf(chosen),chosenX=x(idx);
    const highlights=`<line x1="${chosenX}" x2="${chosenX}" y1="${top}" y2="${top+h}" stroke="#c2d4e1" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="4 5"/>
      <circle cx="${chosenX}" cy="${y(chosen.buy)}" r="6" fill="#ff6675" stroke="#10161c" stroke-width="2.5"/>
      <circle cx="${chosenX}" cy="${y(chosen.sell)}" r="6" fill="#49daa5" stroke="#10161c" stroke-width="2.5"/>`;
    // Hitboxes cover each day. Touch and mouse use the same selection, with
    // keyboard support for accessibility; no financial record is ever modified.
    const hits=rows.map((r,i)=>{
      const half=w/(Math.max(1,rows.length-1))/2;
      const bx=i===0?left-8:x(i)-half;
      const bw=rows.length===1?w+16:i===0||i===rows.length-1?half+8:half*2;
      return `<rect class="abr-business-hit" data-date="${r.date}" tabindex="0" role="button" aria-label="${short(r.date)}: compras ${BR(fromCents(r.dayBuy))}, vendas ${BR(fromCents(r.daySell))}" x="${bx}" y="${top}" width="${bw}" height="${h}"/>`;
    }).join('');
    plot.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="Compras e vendas acumuladas; toque em uma data para ver os valores">${grid}
      <path d="${stepPath}" fill="none" stroke="#ff6675" stroke-width="${mobile?3:3.5}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${line('sell')}" fill="none" stroke="#49daa5" stroke-width="${mobile?3:3.5}" stroke-linecap="round" stroke-linejoin="round"/>
      ${highlights}${labels}${hits}</svg>`;
  }
  function renderDay(rows){
    const day=rows.find(r=>r.date===selected)||rows.at(-1);
    if(!day)return;
    const count=day.count>0?`${day.count} venda${day.count===1?'':'s'} identificada${day.count===1?'':'s'}`:day.legacy?'Vendas consolidadas':'Nenhuma venda identificada';
    $('abr-business-day').innerHTML=`<div class="abr-business-day-title"><b>${short(day.date)} • ${new Date(day.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'})}</b><small>${count}</small></div>
      <div class="abr-business-day-value buy"><span>Compras nesse dia</span><strong>${BR(fromCents(day.dayBuy))}</strong></div>
      <div class="abr-business-day-value sell"><span>Vendas nesse dia</span><strong>${BR(fromCents(day.daySell))}</strong></div>`;
  }
  function paint(){
    const rows=sourceData();if(!rows.length)return;
    const last=rows.at(-1);
    const buy=fromCents(last.buy),sell=fromCents(last.sell);
    $('abr-business-bought').textContent=BR(buy);
    $('abr-business-sold').textContent=BR(sell);
    const diff=round2(Math.abs(buy-sell));
    const story=$('abr-business-story');
    if(buy>sell+.005){
      story.textContent=`As vendas ainda estão ${BR(diff)} abaixo das compras. Parte do dinheiro pode estar em carne no estoque.`;
      story.classList.remove('abr-business-good');
    }else if(sell>buy+.005){
      story.textContent=`As vendas já ultrapassaram as compras em ${BR(diff)}. Isso ainda não é o lucro do açougue.`;
      story.classList.add('abr-business-good');
    }else{
      story.textContent=buy===0?'Registre as compras e vendas para acompanhar o movimento do açougue.':'O valor vendido está igual ao valor comprado. Ainda precisamos conferir o estoque e as despesas.';
      story.classList.remove('abr-business-good');
    }
    const pct=buy>0?sell/buy*100:0;
    $('abr-business-percent').textContent=buy>0?pct.toLocaleString('pt-BR',{maximumFractionDigits:0})+'%':'—';
    $('abr-business-progress').style.width=Math.min(100,Math.max(0,pct))+'%';
    $('abr-business-coverage').hidden=buy<=0;
    const display=period==='all'?rows:rows.slice(-Number(period));
    if(!selected||!display.some(r=>r.date===selected))selected=display.at(-1).date;
    root.querySelectorAll('[data-abr-business-range]').forEach(button=>{
      const active=button.dataset.abrBusinessRange===period;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    renderGraph(display);renderDay(display);
  }
  root.addEventListener('click',e=>{
    const range=e.target.closest('[data-abr-business-range]');
    if(range){period=range.dataset.abrBusinessRange;paint();return}
    const target=e.target.closest('[data-date]');
    if(target){selected=target.dataset.date;paint()}
  });
  root.addEventListener('keydown',e=>{
    const target=e.target.closest('[data-date]');
    if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selected=target.dataset.date;paint();}
  });
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(paint,140)});
  const previousRender=render;
  render=function(){previousRender();paint()};
  paint();
})();
