import {year,latestMonth,months,salesRows,periodMonths,summarize,outlook,marketStatus,groupBy} from './model.js';
import {makeWorkbook} from './workbook.js';
import {executivePdf} from '../CFO/executive-pdf.js?v=3';

const sections={
  overview:[`Commercial Overview`,`dashboard`,`Performance against budget, market closures and the year-end outlook.`],
  markets:[`Markets & Channels`,`language`,`Explore Country → Market → Product Group → SKU and compare Private, LPO and Tender.`],
  products:[`Product Portfolio`,`medication`,`See growth drivers, declines, pricing, volume and launch performance.`],
  spend:[`Commercial OpEx & ROI`,`campaign`,`Compare promotional spend, deductions and sales-force productivity.`],
  working:[`Commercial Working Capital`,`account_balance_wallet`,`Review receivables, returns, expiry and stock availability.`],
  forecast:[`Forecast, Risks & Opportunities`,`query_stats`,`Track the monthly rolling forecast, market closures and commercial risks.`],
};
const $=id=>document.getElementById(id);
const filters=[`country`,`market`,`sector`,`group`,`sku`];
const dimensions=[`country`,`market`,`group`,`sku`];
const labels={country:`Country`,market:`Market`,sector:`Sector`,group:`Product Group`,sku:`SKU`};
const defaults={page:`overview`,type:`IMS`,unit:`Usd`,month:latestMonth,period:`month`,mode:`all`,country:``,market:``,sector:``,group:``,sku:``};
let state={...defaults};
const esc=value=>String(value??``).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const number=(value,digits=0)=>new Intl.NumberFormat(`en-US`,{maximumFractionDigits:digits}).format(value);
const dollars=(value,digits=0)=>`USD ${number(value,digits)}`;
const short=(value,unit=state.unit)=>{
  const abs=Math.abs(value), magnitude=abs>=1e6?1e6:abs>=1e3?1e3:1;
  return `${value<0?`−`:``}${unit===`Usd`?`$`:``}${number(abs/magnitude,magnitude===1?0:2)}${magnitude===1e6?`M`:magnitude===1e3?`K`:``}`;
};
const pct=value=>value==null?`—`:`${(value*100).toFixed(1)}%`;
const sign=value=>`${value>0?`+`:``}${short(value)}`;
const modeName=mode=>mode===`budgeted`?`Budgeted Sales vs Budget`:`All Sales vs Budget`;
const div=(a,b)=>b?a/b:null;
const option=(value,name,selected)=>`<option value="${esc(value)}"${selected?` selected`:``}>${esc(name)}</option>`;
const href=(page,changes={})=>{
  const {page:_,...query}={...state,...changes};
  return `#${page}?${new URLSearchParams(query)}`;
};
function parse(){
  const [page,query]=location.hash.slice(1).split(`?`), q=new URLSearchParams(query);
  const oneOf=(k,values)=>values.includes(q.get(k))?q.get(k):defaults[k];
  const month=Number(q.get(`month`));
  state={...defaults,page:Object.hasOwn(sections,page)?page:defaults.page,
    type:oneOf(`type`,[`IMS`,`TMS`]),unit:oneOf(`unit`,[`Usd`,`Units`]),
    period:oneOf(`period`,[`month`,`quarter`,`ytd`]),mode:oneOf(`mode`,[`all`,`budgeted`]),
    month:month>=1&&month<=latestMonth&&Number.isInteger(month)?month:latestMonth};
  let rows=salesRows(state.type);
  for(const key of filters){
    const available=[...new Set(rows.map(row=>row[key]))].sort((a,b)=>a.localeCompare(b));
    state[key]=available.includes(q.get(key))?q.get(key):``;
    $(key).innerHTML=option(``,`All ${key===`country`?`countries`:key===`group`?`product groups`:key===`sku`?`SKUs`:`${key}s`}`,!state[key])+available.map(name=>option(name,name,state[key]===name)).join(``);
    if(state[key])rows=rows.filter(r=>r[key]===state[key]);
  }
  return rows;
}
const namePeriod=(start,stop)=>`${start===stop?months[stop-1]:`${months[start-1]}–${months[stop-1]}`} ${year}`;
function context(){
  const rows=parse();
  const selected=periodMonths(state.month,state.period);
  const periodRows=rows.filter(r=>selected.includes(r.month));
  const ytdRows=rows.filter(r=>r.month<=state.month);
  const selectedMarkets=new Set(rows.map(r=>r.market));
  const pending=marketStatus.filter(r=>r.month===state.month&&selectedMarkets.has(r.market)&&!r.closed);
  return {rows,periodRows,ytdRows,selected,pending,label:namePeriod(selected[0],selected.at(-1)),scope:filters.map(k=>state[k]).filter(Boolean).join(` / `)||`Dar Al Dawa Group`,
    main:summarize(periodRows,state.unit,state.mode),ytd:summarize(ytdRows,state.unit,state.mode),yearEnd:outlook(rows,state.unit,state.mode)};
}
const link=(page,label,changes={})=>`<a href="${esc(href(page,changes))}">${esc(label)}</a>`;
function table(columns,rows){
  if(!rows.length)return `<p class="empty">No records in the selected scope.</p>`;
  return `<div class="table-wrap cco-table" tabindex="0" aria-label="Scrollable table"><table><thead><tr>${columns.map(name=>`<th scope="col">${esc(name)}</th>`).join(``)}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${value}</td>`).join(``)}</tr>`).join(``)}</tbody></table></div>`;
}
const safeRows=rows=>rows.map(row=>row.map(esc));
const panel=(title,body,caption=``,wide=false)=>`<article class="panel${wide?` full`:``}"><header><div><h2>${esc(title)}</h2>${caption?`<p class="caption">${esc(caption)}</p>`:``}</div></header>${body}</article>`;
const card=(icon,label,value,description,page)=>`<a class="metric" href="${esc(href(page))}"><span class="metric-icon material-symbols-outlined" aria-hidden="true">${icon}</span><span class="metric-label">${esc(label)}</span><strong class="metric-value">${esc(value)}</strong><small>${esc(description)}</small></a>`;
const summaryTable=(rows,headers)=>table(headers,safeRows(rows));
function chart(rows,format=short){
  const max=Math.max(1,...rows.map(([,value])=>Math.abs(value)));
  return `<div class="chart">${rows.map(([label,value])=>`<div class="chart-row"><span>${esc(label)}</span><span class="track" aria-hidden="true"><i class="${value<0?`negative`:``}" style="width:${Math.abs(value)/max*100}%"></i></span><b>${esc(format(value))}</b></div>`).join(``)}</div>`;
}
function trendChart(rows){
  const max=Math.max(1,...rows.flatMap(row=>row.slice(1)));
  return `<div class="cco-trend" role="img" aria-label="${esc(rows.map(([label,a,b,p])=>`${label}: actual ${short(a)}, budget ${short(b)}, prior year ${short(p)}`).join(`; `))}">
    ${rows.map(([label,...values])=>`<div><div class="cco-trend-bars">${values.map((value,i)=>`<i class="series-${i}" style="height:${value/max*100}%" title="${esc(short(value))}"></i>`).join(``)}</div><span>${label}</span></div>`).join(``)}
  </div><div class="cco-legend"><span>Actual</span><span>Budget</span><span>Prior year</span></div>`;
}
function statusFor(d){
  return d.pending.length?`Preliminary · ${d.pending.length} ${d.pending.length===1?`market pending`:`markets pending`}`:`Closed markets`;
}
function closure(d){
  return panel(`Market Close Tracker`,table([`Market`,`Owner`,`Month`,`Status`],d.pending.map(r=>[
    link(`markets`,r.market,{country:r.country,market:r.market}),esc(r.manager),esc(months[r.month-1]),`Awaiting close`,
  ])),d.pending.length?`Follow up with the market manager for each open market.`:`All markets in scope have closed.`,true);
}
function overview(d){
  const a=d.main, y=d.ytd, fy=d.yearEnd;
  const openOnly=d.periodRows.every(r=>!r.closed);
  const label=state.unit===`Usd`?`Net Sales`:`Net Sales Units`;
  const compared=[`all`,`budgeted`].map(mode=>{
    const s=summarize(d.periodRows,state.unit,mode);
    return [modeName(mode),openOnly?`—`:short(s.actual),openOnly?`—`:short(s.budget),openOnly?`—`:sign(s.gap),pct(s.achievement)];
  });
  const scope=groupBy(d.periodRows,`country`).map(([name,rows])=>[name,summarize(rows,state.unit,state.mode)])
    .filter(([,v])=>v.gap<0).sort((a,b)=>a[1].gap-b[1].gap).slice(0,5);
  const trend=months.slice(0,state.month).map((label,i)=>{
    const values=summarize(d.ytdRows.filter(r=>r.month===i+1),state.unit,state.mode);
    return [label,values.actual,values.budget,values.prior];
  });
  return `<div class="cards cco-cards">
    ${card(`payments`,label,openOnly?`—`:short(a.actual),`YTD ${short(y.actual)} · YoY ${pct(a.growth)}`,`markets`)}
    ${card(`track_changes`,`Target Achievement`,pct(a.achievement),`YTD ${pct(y.achievement)} · Variance ${pct(div(a.gap,a.budget))}`,`markets`)}
    ${card(`bar_chart`,`Gross Margin`,pct(a.margin),`${short(a.grossProfit,`Usd`)} gross profit · USD`,`products`)}
    ${card(`query_stats`,`FY Outlook`,short(fy.closed+fy.forecast),`${pct(div(fy.closed+fy.forecast,fy.budget))} vs FY budget`,`forecast`)}
  </div><div class="details cco-details">
    ${panel(`Actual vs Budget`,summaryTable(compared,[`Comparison`,`Actual`,`Budget`,`Variance`,`Ach. %`]),`Both views use the same budget for closed markets.`,true)}
    ${panel(`YTD Performance`,summaryTable([[short(y.actual),short(y.prior),pct(y.growth),pct(y.achievement)]],[`Actual`,`Prior year`,`YoY growth`,`Ach. %`]),`January to ${months[state.month-1]} · matched market-months`)}
    ${panel(`Largest Country Gaps`,table([`Country`,`Budget gap`],scope.map(([name,s])=>[link(`markets`,name,{country:name,market:``,group:``,sku:``}),esc(sign(s.gap))])),`Closed-market actuals vs budget`)}
    ${panel(`Monthly Sales Trend`,trendChart(trend),`Actual, budget and prior year use matched closed market-months.`,true)}
    ${closure(d)}
  </div>`;
}
function marketView(d){
  const depth=dimensions.findIndex(k=>!state[k]);
  const key=depth<0?`sku`:dimensions[depth];
  const breadcrumb=dimensions.filter(k=>state[k]).map(k=>{
    const clear=Object.fromEntries(dimensions.slice(dimensions.indexOf(k)).map(x=>[x,``]));
    return link(`markets`,`${labels[k]}: ${state[k]}`,clear);
  }).join(``);
  const result=groupBy(d.periodRows,key).map(([name,rows])=>[name,summarize(rows,state.unit,state.mode),rows.some(r=>!r.closed)])
    .sort((a,b)=>b[1].actual-a[1].actual);
  const compare=table([labels[key],`Actual`,`Budget`,`Gap`,`Ach. %`,`Coverage`],result.map(([name,s,open])=>[
    depth<0?esc(name):link(`markets`,name,{[key]:name}),esc(short(s.actual)),esc(short(s.budget)),esc(sign(s.gap)),esc(pct(s.achievement)),open?`Preliminary`:`Closed`,
  ]));
  const channel=groupBy(d.periodRows,`sector`).map(([name,rows])=>{
    const s=summarize(rows,state.unit,state.mode);
    return [name,short(s.actual),short(s.budget),pct(s.achievement),short(s.grossProfit,`Usd`),pct(s.margin)];
  });
  return `<div class="details cco-details">${panel(`Budget Variance by ${labels[key]}`,`<div class="cco-drill">${link(`markets`,`All markets`,{country:``,market:``,group:``,sku:``})}${breadcrumb}</div>${compare}`,`Country → Market → Product Group → SKU`,true)}
  ${panel(`Sales by Channel`,summaryTable(channel,[`Sector`,`Actual`,`Budget`,`Ach. %`,`Gross profit USD`,`Gross margin`]),`Private, LPO and Tender are reported separately.`,true)}${closure(d)}</div>`;
}
function portfolio(d){
  const sku=groupBy(d.periodRows,`sku`).map(([name,rows])=>[name,summarize(rows,state.unit,state.mode),rows[0].group]);
  const rankings=(title,rows)=>panel(title,table([`SKU`,`Actual`,`Change vs PY`,`Growth`],rows.slice(0,10).map(([name,s,group])=>[
    link(`markets`,name,{group,sku:name}),esc(short(s.actual)),esc(sign(s.actual-s.prior)),esc(pct(s.growth)),
  ])));
  const mix=groupBy(d.periodRows,`group`).map(([name,rows])=>[name,summarize(rows,`Usd`,state.mode)])
    .sort((a,b)=>b[1].netUsd-a[1].netUsd).slice(0,10).map(([name,a])=>[
      link(`markets`,name,{group:name,sku:``}),esc(pct(div(a.netUsd,d.main.netUsd))),esc(pct(div(a.priorUsd,d.main.priorUsd))),esc(pct(a.margin)),esc(short(a.grossProfit,`Usd`)),
    ]);
  const l=d.periodRows.filter(r=>r.launched&&r.closed&&(state.mode===`all`||r.budgeted));
  const launches=groupBy(l,`sku`).map(([name,rows])=>{
    const a=summarize(rows,state.unit,state.mode);
    const target=rows.reduce((n,row)=>n+row[`forecast${state.unit}`],0);
    return [link(`markets`,name,{group:rows[0].group,sku:name}),esc(short(a.actual)),esc(short(target)),esc(pct(div(a.actual,target)))];
  });
  return `<div class="details cco-details">
    ${rankings(`Top 10 SKUs by Sales`,[...sku].sort((a,b)=>b[1].actual-a[1].actual))}
    ${rankings(`Top 10 Growth Drivers`,sku.filter(([,s])=>s.actual>s.prior).sort((a,b)=>(b[1].actual-b[1].prior)-(a[1].actual-a[1].prior)))}
    ${rankings(`Largest Sales Declines`,sku.filter(([,s])=>s.actual<s.prior).sort((a,b)=>(a[1].actual-a[1].prior)-(b[1].actual-b[1].prior)))}
    ${panel(`Price, Volume & Launch Bridge`,chart([[`Volume effect`,d.main.pvmVolume],[`Price effect`,d.main.pvmPrice],[`New launches`,d.main.pvmLaunch]],v=>short(v,`Usd`)),`USD · Current net sales less prior year on matching market-months`)}
    ${panel(`Product Mix & Margin`,table([`Product Group`,`Current sales mix`,`Prior sales mix`,`Gross margin`,`Gross profit (USD)`],mix),`Top 10 groups by net sales · matched closed market-months`,true)}
    ${panel(`Launches vs Forecast`,table([`SKU`,`Actual`,`Forecast`,`Ach. %`],launches),`Launch SKUs in the selected closed periods`,true)}
  </div>`;
}
function spend(d){
  const m=d.main;
  const categories=[[`Free samples`,.012], [`Conferences`,.009], [`Sponsorships`,.007], [`Medical activities`,.008]];
  const total=categories.reduce((sum,[,rate])=>sum+m.netUsd*rate,0);
  const reps=new Set(d.periodRows.filter(r=>r.closed).map(r=>r.market)).size*5;
  const execution=groupBy(d.periodRows.filter(r=>r.closed),`sector`).map(([name,rows],i)=>{
    const a=summarize(rows,`Usd`,state.mode);
    const count=new Set(rows.map(r=>r.market)).size*2;
    const calls=count*d.selected.length*(86-i*8), callTarget=count*d.selected.length*100;
    return [name,number(count),dollars(count?a.netUsd/count:0),number(calls),pct(div(calls,callTarget))];
  });
  return `<div class="details cco-details">
    ${panel(`A&P Spend`,summaryTable(categories.map(([name,rate])=>[name,dollars(m.netUsd*rate),pct(rate)]),[`Category`,`Spend (USD)`,`% of net sales`]),`Total ${dollars(total)} · ${pct(div(total,m.netUsd))} of net sales`)}
    ${panel(`Bonuses, Rebates & Discount Effect`,summaryTable([
      [`Discounts & rebates`,dollars(m.discounts)], [`Bonus units`,number(m.bonusUnits)],
      [`Net selling price / unit`,m.actualUnits?dollars(m.netUsd/m.actualUnits,2):`—`],
      [`Discount effect / billed unit`,m.actualUnits?dollars(m.discounts/m.actualUnits,2):`—`],
    ],[`Measure`,`Value`]))}
    ${panel(`Field Force Economics`,summaryTable([[
      number(reps),dollars(reps*d.selected.length*1850),reps?dollars(m.netUsd/reps):`—`,
    ]],[`Active reps`,`Cost (USD)`,`Sales / rep (USD)`]),`Headcount reflects the selected market scope.`)}
    ${panel(`Sales Force Effectiveness`,summaryTable(execution,[`Channel`,`Reps`,`Sales / rep`,`Calls`,`Call target coverage`]),`Coverage = completed calls ÷ planned calls`,true)}
  </div>`;
}
function working(d){
  const last=d.periodRows.filter(r=>r.month===state.month&&r.closed);
  const channel=groupBy(last,`sector`).map(([name,rows])=>{
    const sales=summarize(rows,`Usd`,state.mode).netUsd;
    const days=name===`Tender`?93:name===`LPO`?66:44;
    return [name,sales*days/30,days];
  });
  const ar=channel.reduce((sum,[,value])=>sum+value,0);
  const inventory=groupBy(last.filter(r=>state.mode===`all`||r.budgeted),`sku`).map(([name,rows])=>{
    const sales=rows.reduce((sum,r)=>sum+r.actualUsd,0);
    const i=rows[0].sku.length;
    return [name,i%7===0?`Out of stock`:i%5===0?`Slow-moving`:`Available`,sales*(i%7===0?.14:0),sales*(i%5===0?.08:.018)];
  });
  return `<div class="details cco-details">
    ${panel(`Returns & Near-Expiry`,summaryTable([
      [`Returns (USD)`,dollars(d.main.returns)],[`Returns / net sales`,pct(div(d.main.returns,d.main.netUsd))],
      [`Near-expiry provision (USD)`,dollars(inventory.reduce((sum,r)=>sum+r[3],0))],
    ],[`Measure`,`Value`]),`Returns follow the period. Expiry provision is a month-end snapshot.`)}
    ${panel(`AR Aging`,chart([[`Current`,ar*.55],[`1–30 days`,ar*.21],[`31–60 days`,ar*.14],[`Over 60 days`,ar*.10]],v=>short(v,`Usd`)),`Selected month-end · USD`)}
    ${panel(`DSO by Channel`,summaryTable(channel.map(([name,balance,days])=>[name,dollars(balance),`${days} days`]),[`Channel`,`AR (USD)`,`DSO`]),`Modeled from closing AR and monthly sales`)}
    ${panel(`Overdue Accounts`,summaryTable(channel.map(([name,balance],i)=>[`Account ${i+1} - ${name}`,dollars(balance*.1)]),[`Account`,`Over 60 days (USD)`]),`Illustrative account allocations`)}
    ${panel(`Stock Availability`,summaryTable(inventory.filter(r=>r[1]!==`Available`).sort((a,b)=>b[2]-a[2]).map(([name,status,lost,expiry])=>[name,status,dollars(lost),dollars(expiry)]),[`SKU`,`Status`,`Estimated lost sales`,`Near-expiry provision`]),`Month-end snapshot · USD`,true)}
  </div>`;
}
function forecast(d){
  const fy=d.yearEnd, total=fy.closed+fy.forecast;
  const monthsView=months.map((label,i)=>{
    const o=outlook(d.rows.filter(r=>r.month===i+1),state.unit,state.mode);
    return [label,short(o.closed),short(o.forecast),short(o.closed+o.forecast),short(o.budget),sign(o.closed+o.forecast-o.budget)];
  });
  const risks=d.pending.map(r=>[
    `Pending market close`,r.market,r.manager,`Forecast used for the open market-month`,
  ]);
  const sectorScope=state.sector||`Tender`;
  risks.push([
    `Opportunity`,sectorScope,`Commercial planning`,`Review upcoming orders and expected intake`,
  ],[
    `Supply risk`,state.group||`Portfolio`,`Demand planning`,`Review availability for constrained items`,
  ]);
  return `<div class="cards cco-cards">
    ${card(`done_all`,`Closed Actual`,short(fy.closed),`Closed market-months across FY ${year}`,`forecast`)}
    ${card(`timeline`,`Remaining Forecast`,short(fy.forecast),`Forecast for open market-months`,`forecast`)}
    ${card(`query_stats`,`FY Outlook`,short(total),`Gap ${sign(total-fy.budget)} vs budget`,`forecast`)}
    ${card(`flag`,`FY Budget`,short(fy.budget),`${pct(div(total,fy.budget))} expected achievement`,`forecast`)}
  </div><div class="details cco-details">
    ${panel(`Monthly Rolling Outlook`,summaryTable(monthsView,[`Month`,`Closed actual`,`Open forecast`,`FY outlook component`,`Budget`,`Gap`]),`Closed market-months use actuals. Open market-months use forecast.`,true)}
    ${panel(`Latest Estimate vs Budget`,chart([[`FY outlook`,total],[`FY budget`,fy.budget],[`Previous estimate`,fy.previous]]),`FY ${year} · ${modeName(state.mode)}`)}
    ${panel(`Risks & Opportunities`,summaryTable(risks,[`Type`,`Scope`,`Owner`,`Follow-up`]))}
    ${closure(d)}
  </div>`;
}
const renderers={overview,markets:marketView,products:portfolio,spend,working,forecast};
let activeContext;
function render(){
  const d=context();
  activeContext=d;
  const [title,,subtitle]=sections[state.page];
  $(`page-title`).textContent=title;
  $(`section-title`).textContent=title;
  $(`subtitle`).textContent=subtitle;
  $(`scope-label`).textContent=`${d.scope} · ${state.type} · ${d.label}`;
  $(`month`).innerHTML=months.slice(0,latestMonth).map((m,i)=>option(i+1,`${m} ${year}`,state.month===i+1)).join(``);
  $(`period`).value=state.period;
  $(`mode`).value=state.mode;
  $(`sales-type`).querySelectorAll(`button`).forEach(b=>b.setAttribute(`aria-pressed`,b.dataset.type===state.type));
  $(`sales-unit`).querySelectorAll(`button`).forEach(b=>b.setAttribute(`aria-pressed`,b.dataset.unit===state.unit));
  $(`sections`).innerHTML=Object.entries(sections).map(([key,[name,icon]])=>`<a href="${esc(href(key))}" aria-label="${esc(name)}" title="${esc(name)}"${key===state.page?` aria-current="page"`:``}><span class="nav-icon material-symbols-outlined" aria-hidden="true">${icon}</span><span class="nav-label">${esc(name)}</span></a>`).join(``);
  $(`close-note`).innerHTML=d.pending.length?`<div class="close-banner"><span><strong>${esc(statusFor(d))}.</strong> ${esc(months[state.month-1])} and YTD compare closed market-months only. ${esc(d.pending.map(r=>r.market).join(`, `))}.</span>${link(`forecast`,`See owners and actions →`)}</div>`:``;
  $(`view`).innerHTML=renderers[state.page](d);
}
function updateFilter(changes){
  history.replaceState(null,``,href(state.page,changes));
  render();
}
function runSwitch(event){
  const {type,unit}=event.target.dataset;
  if(type)updateFilter({type});
  if(unit)updateFilter({unit});
}
function download(blob,extension){
  const url=URL.createObjectURL(blob);
  const a=document.createElement(`a`);
  a.href=url;
  a.download=`DAD-CCO-${state.type}-${year}-${String(state.month).padStart(2,`0`)}.${extension}`;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function downloadPdf(){
  const d=activeContext,s=d.main,y=d.ytd,fy=d.yearEnd;
  const comparisons=[`all`,`budgeted`].map(mode=>{
    const total=summarize(d.periodRows,state.unit,mode);
    return [modeName(mode),short(total.actual),short(total.budget),pct(total.achievement)];
  });
  const bytes=executivePdf({role:`CCO`,period:`${d.label} | ${state.type}`,scope:d.scope,currency:state.unit===`Usd`?`USD`:`Units`,reference:`Budget`},[
    {title:`Reporting Scope`,columns:[`Item`,`Selection`],rows:[[`A & B view`,modeName(state.mode)],[`Market close`,statusFor(d)]]},
    {title:`Executive KPIs`,columns:[`Measure`,`Period`,`YTD`,`Basis`],rows:[
      [`Net Sales`,short(s.actual),short(y.actual),state.unit===`Usd`?`USD`:`Units`],[`Growth vs prior year`,pct(s.growth),pct(y.growth),`Like for like`],
      [`Gross Profit`,short(s.grossProfit,`Usd`),short(y.grossProfit,`Usd`),`USD`],[`Gross Margin`,pct(s.margin),pct(y.margin),`Percentage`],
    ]},
    {title:`Actual vs Budget`,columns:[`Comparison`,`Actual`,`Budget`,`Achievement`],rows:comparisons},
    {title:`Year-end Outlook`,columns:[`Measure`,`Value`],rows:[[`Closed actual`,short(fy.closed)],[`Open forecast`,short(fy.forecast)],[`FY Outlook`,short(fy.closed+fy.forecast)],[`FY Budget`,short(fy.budget)],[`Variance to budget`,sign(fy.closed+fy.forecast-fy.budget)]]},
    ...(d.pending.length?[{title:`Markets Awaiting Close`,columns:[`Market`,`Follow-up owner`],rows:d.pending.map(r=>[r.market,r.manager])}]:[]),
  ]);
  download(new Blob([bytes],{type:`application/pdf`}),`pdf`);
}
function downloadExcel(){
  const d=activeContext;
  const metadata=[[`Setting`,`Value`],[`Sales basis`,state.type],[`Display`,state.unit===`Usd`?`Value (USD)`:`Units`],
    [`Period`,d.label],[`Scope`,d.scope],[`A & B view`,modeName(state.mode)],[`Status`,statusFor(d)],
    [`Period comparison rule`,`Actual and budget use closed market-months only.`],[`FY outlook rule`,`Closed actual + forecast for open market-months.`],[`Budget and Forecast tabs`,`Full fiscal year; Sales tab covers the selected closed periods.`],
    [`Scenario`,`Illustrative figures used for presentation.`]];
  const dimensions=[`Month`,`Country`,`Market`,`Sector`,`Product Group`,`SKU`,`Budget Type`];
  const keys=r=>[`${year}-${String(r.month).padStart(2,`0`)}`,r.country,r.market,r.sector,r.group,r.sku,r.budgeted?`Budgeted`:`Not Budgeted`];
  const included=r=>state.mode===`all`||r.budgeted;
  const actualRows=d.periodRows.filter(r=>r.closed&&included(r));
  const sales=[[...dimensions,`Actual Units`,`Actual USD`,`Prior Units`,`Prior USD`,`Gross Profit USD`],
    ...actualRows.map(r=>[...keys(r),r.actualUnits,r.actualUsd,r.priorUnits,r.priorUsd,r.grossProfit])];
  const budget=[[...dimensions,`Close Status`,`Budget Units`,`Budget USD`],...d.rows.filter(r=>r.budgeted).map(r=>[...keys(r),r.closed?`Closed`:`Open`,r.budgetUnits,r.budgetUsd])];
  const approved=[[...dimensions,`Forecast Units`,`Forecast USD`,`FY Source`,`FY Outlook Units`,`FY Outlook USD`],
    ...d.rows.filter(included).map(r=>[...keys(r),r.forecastUnits,r.forecastUsd,r.closed?`Actual`:`Forecast`,r.closed?r.actualUnits:r.forecastUnits,r.closed?r.actualUsd:r.forecastUsd])];
  const scopedMarkets=new Set(d.rows.map(row=>row.market));
  const closureRows=[[`Country`,`Market`,`Month`,`Owner`,`Close Status`],...marketStatus.filter(r=>r.month===state.month&&scopedMarkets.has(r.market)).map(r=>[r.country,r.market,months[r.month-1],r.manager,r.closed?`Closed`:`Open`])];
  download(makeWorkbook([{name:`Summary & Scope`,rows:metadata},{name:`Sales`,rows:sales},{name:`Budget`,rows:budget},{name:`Forecast`,rows:approved},{name:`Market Close`,rows:closureRows}]),`xlsx`);
}
function menu(open){
  $(`navigation`).classList.toggle(`open`,open);
  $(`scrim`).hidden=!open;
  $(`menu`).setAttribute(`aria-expanded`,open);
}
$(`sales-type`).addEventListener(`click`,runSwitch);
$(`sales-unit`).addEventListener(`click`,runSwitch);
for(const key of [`month`,`period`,`mode`,...filters]){
  $(key).addEventListener(`change`,event=>{
    const clear=key===`country`?{market:``,group:``,sku:``}:key===`market`||key===`sector`?{group:``,sku:``}:key===`group`?{sku:``}:{};
    updateFilter({...clear,[key]:event.target.value});
  });
}
$(`filters`).addEventListener(`submit`,event=>event.preventDefault());
$(`menu`).addEventListener(`click`,()=>menu($(`menu`).getAttribute(`aria-expanded`)!==`true`));
$(`scrim`).addEventListener(`click`,()=>{menu(false);$(`menu`).focus();});
document.addEventListener(`keydown`,event=>{
  if(event.key===`Escape`&&$(`menu`).getAttribute(`aria-expanded`)===`true`){menu(false);$(`menu`).focus();}
});
$(`collapse`).addEventListener(`click`,()=>{
  const collapsed=$(`navigation`).parentElement.classList.toggle(`sidebar-collapsed`);
  $(`collapse`).setAttribute(`aria-expanded`,!collapsed);
  $(`collapse`).setAttribute(`aria-label`,collapsed?`Expand navigation`:`Collapse navigation`);
});
function theme(dark){
  document.documentElement.classList.toggle(`dark`,dark);
  $(`theme`).setAttribute(`aria-pressed`,dark);
  $(`theme-icon`).textContent=dark?`light_mode`:`dark_mode`;
}
try{theme(localStorage.getItem(`dad-cco-theme`)===`dark`);}catch{theme(false);}
$(`theme`).addEventListener(`click`,()=>{
  const dark=!document.documentElement.classList.contains(`dark`);
  theme(dark);
  try{localStorage.setItem(`dad-cco-theme`,dark?`dark`:`light`);}catch{}
});
$(`sections`).addEventListener(`click`,event=>{if(event.target.closest(`a`))menu(false);});
$(`excel`).addEventListener(`click`,downloadExcel);
$(`pdf`).addEventListener(`click`,downloadPdf);
window.addEventListener(`hashchange`,()=>{render();menu(false);window.scrollTo(0,0);});
render();
