import {
  closedMonth, months, entities, markets, products, references, range, scopeEntities, tradeRows,
  statement, bridge, financials, intercompany, fyRows, workingCapital, cashSchedule, capexProjects, reportWindows, periodFinancials, cashForPeriods,
} from "./model.js?v=aligned";
import {executivePdf} from "./executive-pdf.js?v=3";

const views = {
  overview:[`Executive Overview`,`dashboard`,`Profitability, liquidity and priorities at a glance.`],
  profit:[`P&L & Profitability`,`monitoring`,`Trace the operating result from revenue and gross margin to EBITDA.`],
  cash:[`Cash & Treasury`,`account_balance`,`Follow cash receipts, payments and closing balances through year-end.`],
  working:[`Working Capital`,`currency_exchange`,`Review receivables, inventory and supplier obligations.`],
  forecast:[`Budget & Forecast`,`query_stats`,`Review the latest full-year outlook and changes since the previous forecast.`],
  manufacturing:[`Manufacturing & Inventory`,`precision_manufacturing`,`Identify the categories driving cost and stock exposure.`],
  capex:[`CapEx & Commitments`,`business_center`,`Review spend, open commitments and headroom against project budgets.`],
  close:[`Financial Close`,`fact_check`,`Track entity close status and reconcile the consolidated figures.`],
};

const $ = id=>document.getElementById(id);
const state={page:`overview`,month:closedMonth,window:``,product:``,compare:`budget`,company:``,market:``,local:false,metric:``};
let blocks=[];
const periodLabel=()=>reportWindows[state.window]?.label||`${months[state.month]} 2026`;
const currentLabel=()=>state.window===`Q4`?`Oct actual + Nov–Dec forecast`:`Actual`;
const entity=()=>entities.find(e=>e.id===state.company);
const availableMarkets=company=>company?markets.filter(name=>company.markets.some(([market])=>market===name)):markets;
const currency=()=>state.local&&entity()?entity().currency:`USD`;
const rate=()=>state.local&&entity()?entity().rate:1;
const fmt=new Intl.NumberFormat(`en-US`,{maximumFractionDigits:0});
const cash=(value,full=false)=>{
  const amount=value*rate();
  const prefix=amount<0?`−`:``;
  const n=Math.abs(amount);
  if(full)return `${prefix}${fmt.format(n)}`;
  if(n>=1e6)return `${prefix}${(n/1e6).toFixed(2)}M`;
  if(n>=1e3)return `${prefix}${(n/1e3).toFixed(1)}K`;
  return `${prefix}${fmt.format(n)}`;
};
const percent = n=>`${(n*100).toFixed(1)}%`;
const points = n=>`${(n*100).toFixed(1)} pp`;
const days = n=>`${n.toFixed(1)} days`;
const sign = (value, format)=>`${value>0?`+`:``}${format(value)}`;
const esc = value=>String(value).replace(/[&<>"']/g,c=>({["&"]:`&amp;`,["<"]:`&lt;`,[">"]:`&gt;`,[`"`]:`&quot;`,[`'`]:`&#39;`})[c]);
const column=(label,format)=>({label,format});
const money=label=>column(label,cash);
const plain=label=>column(label,String);
const percentage=label=>column(label,percent);
const dayColumn=label=>column(label,days);
const fmtCell=(col,value)=>col.format(value);
const itemLink=(label, filter)=>({label,filter});
const hashFor=(page,overrides={})=>{
  const s={...state,...overrides};
  return `#${page}?${new URLSearchParams({period:s.window||s.month+1,compare:s.compare,company:s.company,market:s.market,currency:s.local?`local`:`usd`,metric:s.metric,product:page===`profit`?s.product:``})}`;
};

function table(title, columns, rows, productSearch=false){
  blocks.push({title,columns,rows});
  const search=productSearch?`<div class="product-tools"><label>Search products <input type="search" placeholder="Enter a product name" data-product-search></label><span class="caption" role="status" data-product-count>${rows.length} products</span></div>`:``;
  return `${search}<div class="table-wrap${productSearch?` product-table`:``}"${productSearch?` tabindex="0" role="region" aria-label="${esc(title)} rows"`:``}><table aria-label="${esc(title)}"><thead><tr>${columns.map(col=>`<th scope="col" ${col.format===String?``:`data-number`}>${esc(col.label)}</th>`).join(``)}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((value,index)=>{
    const col=columns[index];
    const display=typeof value===`object`?`<a href="${esc(hashFor(state.page,value.filter))}">${esc(value.label)}</a>`:esc(fmtCell(col,value));
    return `<td ${col.format===String?``:`data-number`}>${display}</td>`;
  }).join(``)}</tr>`).join(``)}</tbody></table></div>`;
}
function panel(title,body,caption=``,wide=false,emphasized=false){
  return `<article class="panel${wide?` full`:``}${emphasized?` panel-emphasis`:``}"><header><div><h2>${esc(title)}</h2>${caption?`<p class="caption">${esc(caption)}</p>`:``}</div></header>${body}</article>`;
}
function bars(title,rows,format=cash){
  blocks.push({title,columns:[plain(`Category`),column(`Value`,format)],rows});
  const max=Math.max(1,...rows.map(([,n])=>Math.abs(n)));
  return `<div class="chart" aria-label="${esc(title)}">${rows.map(([label,n])=>`<div class="chart-row"><span>${esc(label)}</span><span class="track" aria-hidden="true"><i class="${n<0?`negative`:``}" style="width:${Math.abs(n)/max*100}%"></i></span><b>${esc(format(n))}</b></div>`).join(``)}</div>`;
}
function waterfall(start, contributions, end, title, labels=[`Reference EBITDA`,`Actual EBITDA`]){
  const steps=[[labels[0],0,start,start]];
  let subtotal=start;
  for(const [label,delta] of contributions){
    steps.push([label,subtotal,subtotal+delta,delta]);
    subtotal+=delta;
  }
  steps.push([labels[1],0,end,end]);
  const heights=steps.flatMap(([,from,to])=>[from,to]);
  const min=Math.min(...heights), span=Math.max(1,Math.max(...heights)-min);
  blocks.push({title,columns:[plain(`Driver`),money(`EBITDA impact`)],rows:steps.map(([label,,,value])=>[label,value])});
  return `<div class="waterfall">${steps.map(([label,from,to,value],i)=>{
    const offset=(Math.min(from,to)-min)/span*100;
    const width=Math.abs(to-from)/span*100;
    return `<div class="chart-row"><span>${esc(label)}</span><span class="track" aria-hidden="true"><i class="${value<0?`negative`:``}" style="margin-left:${offset}%;width:${width}%"></i></span><b>${i===0||i===steps.length-1?cash(value):sign(value,cash)}</b></div>`;
  }).join(``)}</div>`;
}
const noMarket = text=>panel(text,`<p class="empty">This measure is reported at company and group level.</p><a href="${esc(hashFor(state.page,{market:``}))}">${state.company?`View company totals`:`View group totals`}</a>`);
const stat=(label,value)=>`<div class="statline"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
const aggregate=(rows, key, value)=>Array.from(rows.reduce((m,r)=>m.set(r[key],(m.get(r[key])||0)+value(r)),new Map()));
const merchants = [`Pharmacy Network`,`Hospital Supply`,`Wholesale Group`,`Other customer accounts`];
const dateAt=(month,day)=>Date.UTC(2026,month,day);
const displayDate=new Intl.DateTimeFormat(`en-GB`,{day:`numeric`,month:`short`,timeZone:`UTC`});
const metricInfo=[
  {key:`revenue`,icon:`monetization_on`,label:`Net Revenue`,page:`profit`,format:cash},
  {key:`margin`,icon:`pie_chart`,label:`Gross Margin`,page:`profit`,format:percent,delta:points},
  {key:`ebitda`,icon:`monitoring`,label:`EBITDA`,page:`profit`,format:cash},
  {key:`operating`,icon:`payments`,label:`Operating Cash Flow`,page:`cash`,format:cash,entityOnly:true},
  {key:`closing`,icon:`account_balance_wallet`,label:`Available Cash`,page:`cash`,format:cash,entityOnly:true,stock:true},
  {key:`nwc`,icon:`currency_exchange`,label:`Net Working Capital`,page:`working`,format:cash,entityOnly:true,stock:true},
];
function sectionData(){
  const month=state.month;
  const periods=reportWindows[state.window]?.months||[month];
  const {rows,figures:actual,internal}=periodFinancials(state,periods);
  const {rows:base,figures:target}=periodFinancials(state,periods,state.compare);
  const {figures:ytd}=periodFinancials(state,range(month,true));
  const schedule=cashSchedule(state);
  const baseCash=cashSchedule(state,state.compare);
  const wc=workingCapital(state,month,state.window===`Q4`?`forecast`:`actual`);
  const baseWC=workingCapital(state,month,state.compare);
  return {rows,base,actual,target,ytd,schedule,baseCash,wc,baseWC,periods,internal,contributions:bridge(rows,base)};
}

function alerts(data){
  const next=data.schedule[state.month+1];
  const items=[
    {label:`Review overdue receivables`,impact:data.wc.ar*.22,due:dateAt(state.month+1,21),reason:`Balances more than 60 days overdue`,page:`working`,metric:`nwc`},
    {label:`Review inventory expiry exposure`,impact:data.wc.inventory*.13,due:dateAt(state.month+1,25),reason:`Stock expiring within 90 days`,page:`working`,metric:`inventory`},
  ];
  if(next && !state.market && next.closing<next.opening){
    items.push({label:`Prepare for a forecast cash decline`,impact:next.opening-next.closing,due:dateAt(state.month+1,20),reason:`Forecast payments exceed receipts`,page:`cash`,metric:`closing`});
  }
  if(data.actual.ebitda<data.target.ebitda){
    items.push({label:`Investigate EBITDA variance`,impact:data.target.ebitda-data.actual.ebitda,due:dateAt(state.month+1,23),reason:`EBITDA below the selected reference`,page:`profit`,metric:`ebitda`});
  }
  return items.map(item=>({...item,priority:item.impact/Math.max(1,(item.due-dateAt(state.month+1,0))/86400000)})).sort((a,b)=>b.priority-a.priority);
}

function overview(d){
  const current={...d.actual,...cashForPeriods(d.schedule,d.periods),...d.wc};
  const reference={...d.target,...cashForPeriods(d.baseCash,d.periods),...d.baseWC};
  const ytd={...d.ytd,operating:d.schedule.slice(0,state.month+1).reduce((sum,row)=>sum+row.operating,0)};
  const cards=metricInfo.map(m=>{
    const visible=!state.market||!m.entityOnly;
    const delta=current[m.key]-reference[m.key];
    const marker=m.key===`nwc`?``:delta<0?`bad`:`good`;
    return `<a class="metric" href="${esc(hashFor(m.page,{metric:m.key}))}"><span class="metric-icon material-symbols-outlined" aria-hidden="true">${m.icon}</span><span class="metric-label">${esc(m.label)}</span><strong class="metric-value">${visible?m.format(current[m.key]):`—`}</strong><small class="${marker}">${visible?`${sign(delta,m.delta||m.format)} vs ${references[state.compare]}`:`Company-level measure`}</small><small>${visible?m.stock?`Month-end balance`:`YTD ${m.format(ytd[m.key])}`:`Clear market to view`}</small></a>`;
  }).join(``);
  const summaries=alerts(d);
  blocks.push({title:`Executive KPIs`,columns:[plain(`KPI`),plain(currentLabel()),plain(`Reference`),plain(`YTD`)],rows:metricInfo.filter(m=>!state.market||!m.entityOnly).map(m=>[m.label,m.format(current[m.key]),m.format(reference[m.key]),m.stock?`Month-end`:m.format(ytd[m.key])])});
  blocks.push({title:`Priority watchlist`,columns:[plain(`Issue`),money(`Impact`),plain(`Due`),plain(`Reason`)],rows:summaries.map(a=>[a.label,a.impact,displayDate.format(a.due),a.reason])});
  return `<div class="cards">${cards}</div><div class="rail">${panel(`Profitability vs ${references[state.compare]}`,bars(`EBITDA comparison`,[[state.window===`Q4`?`Q4 EBITDA outlook`:`Actual EBITDA`,d.actual.ebitda],[references[state.compare],d.target.ebitda]])+`<a class="inline" href="${esc(hashFor(`profit`,{metric:`ebitda`}))}">Explore EBITDA drivers →</a>`,`Variance ${sign(d.actual.ebitda-d.target.ebitda,cash)} ${currency()}`)}
  ${state.market?noMarket(`Cash through year-end`):panel(`Cash through year-end`,bars(`Closing cash`,d.schedule.slice(state.month).map(r=>[`${r.label} ${r.forecast?`Fcst`:`Act`}`,r.closing]))+`<a class="inline" href="${esc(hashFor(`cash`,{metric:`closing`}))}">View cash schedule →</a>`,`Closing cash · ${currency()}`)}
  ${panel(`Needs attention`,summaries.slice(0,3).map(a=>`<a class="flag" href="${esc(hashFor(a.page,{metric:a.metric}))}"><strong><span class="material-symbols-outlined" aria-hidden="true">warning</span>${esc(a.label)}</strong><span>${cash(a.impact)} ${currency()} · ${displayDate.format(a.due)}</span><span>${esc(a.reason)}</span></a>`).join(``),`Ranked by financial impact and days to due date`,false,true)}</div>`;
}

function profit(d){
  const lines=[[`Net revenue`,`revenue`],[`Materials & manufacturing COGS`,`cogs`],[`Gross profit`,`gross`],[`Gross margin`,`margin`],[`Commercial expenses`,`commercial`],[`Administration`,`admin`],[`R&D`,`research`],[`EBITDA`,`ebitda`]];
  const rows=lines.map(([label,key])=>[label,key===`margin`?percent(d.actual[key]):cash(d.actual[key]),key===`margin`?percent(d.target[key]):cash(d.target[key]),sign(d.actual[key]-d.target[key],key===`margin`?points:cash)]);
  const groupBy=state.market?`product`:state.company?`market`:`company`;
  const breakdown=aggregate(d.rows,groupBy,r=>r.quantity*r.price).map(([label,value])=>[groupBy===`company`?itemLink(label,{company:entities.find(e=>e.name===label).id,market:``}):groupBy===`market`?itemLink(label,{market:label}):label,value]);
  const productRows=products.filter(product=>!state.product||product.name===state.product).map(product=>{
    const actual=statement(d.rows.filter(r=>r.product===product.name));
    const ref=statement(d.base.filter(r=>r.product===product.name));
    return [product.name,actual.revenue,actual.margin,actual.material,actual.conversion,actual.ebitda-ref.ebitda];
  });
  const internal=d.internal;
  if(internal)breakdown.push([`Intragroup sales at cost`,internal]);
  return `${state.product?`<p class="product-scope">Product <strong>${esc(state.product)}</strong> · <a href="${esc(hashFor(`profit`,{product:``}))}">Show all products</a></p>`:``}<div class="details">${panel(`Income statement`,table(`Income statement`,[`Line item`,currentLabel(),references[state.compare],`Difference`].map(plain),rows),`P&L · ${currency()}`)}
  ${panel(`EBITDA variance bridge`,waterfall(d.target.ebitda,d.contributions,d.actual.ebitda,`EBITDA variance bridge`,[`Reference EBITDA`,state.window===`Q4`?`Q4 EBITDA outlook`:`Actual EBITDA`]),`${references[state.compare]} to ${state.window===`Q4`?`outlook`:`actual`} · ${currency()}`)}
  ${panel(`Revenue by ${groupBy}`,table(`Revenue by ${groupBy}`,[plain(`Scope`),money(`Net revenue`)],breakdown,groupBy===`product`),groupBy===`product`?`External net revenue by product · ${currency()}`:`Select a company or market to drill down`)}
  ${panel(`Product profitability`,table(`Product profitability`,[plain(`Product`),money(`External net revenue`),percentage(`GM`),money(`Materials`),money(`Manufacturing`),money(`EBITDA variance`)],productRows,true),`External sales and production costs · ${currency()}`,true)}</div>`;
}
function treasury(d){
  if(state.market)return noMarket(`Cash & Treasury`);
  const dates=d.schedule.slice(d.periods[0]);
  const periodCash=cashForPeriods(d.schedule,d.periods);
  const cashRows=dates.map(r=>[`${r.label} ${r.forecast?`Forecast`:`Actual`}`,r.opening,r.receipts,r.suppliers,r.payroll,r.taxes,r.other,r.operating,r.capex,r.debt,r.closing]);
  const lines=[[`Customer collections`,`receipts`],[`Supplier payments`,`suppliers`],[`Payroll`,`payroll`],[`Tax payments`,`taxes`],[`Other operating payments`,`other`],[`Investing / CapEx`,`capex`],[`Debt service`,`debt`]];
  return `<div class="details">${panel(`Selected-period cash summary`,table(`Cash summary`,[plain(`Measure`),money(`Period value`)],[[`Operating Cash Flow`,periodCash.operating],[`Available Cash at Period End`,periodCash.closing]]),`${periodLabel()} · ${currency()}`,true)}
  ${panel(`Month-end cash`,bars(`Monthly closing cash`,dates.map(r=>[`${r.label} ${r.forecast?`Forecast`:`Actual`}`,r.closing])),`Closed actuals, then forecast after ${months[closedMonth]}`)}
  ${panel(`Closing cash vs ${references[state.compare]}`,table(`Closing cash comparison`,[plain(`Month`),money(`Closing cash`),money(references[state.compare])],dates.map(r=>[r.label,r.closing,d.baseCash[r.month].closing])),`Balances · ${currency()}`)}
  ${panel(`Monthly cash flow schedule`,table(`Cash flow schedule`,[plain(`Month`),...`Opening|Collections|Suppliers|Payroll|Taxes|Other operating|Operating cash flow|CapEx|Debt service|Closing`.split(`|`).map(money)],cashRows),`Payments shown as outflows · ${currency()}`,true)}
  ${panel(`Selected-period sources and uses`,table(`Cash sources and uses`,[plain(`Cash line`),money(currentLabel()),money(references[state.compare])],lines.map(([label,key])=>[label,d.periods.reduce((sum,m)=>sum+d.schedule[m][key],0),d.periods.reduce((sum,m)=>sum+d.baseCash[m][key],0)])),`Detail by cash-flow category · ${currency()}`)}</div>`;
}

function inventoryRows(d){
  const categories=aggregate(d.rows,`product`,r=>r.quantity*(r.material+r.conversion));
  const externalCogs=statement(d.rows).cogs;
  return categories.map(([product,cost],index)=>{
    const value=d.wc.inventory*cost/externalCogs;
    const slow=index%3===1?.26:.13;
    return [product,value,value*slow,value*.13];
  });
}
function working(d){
  const debt=[
    [`Current`,d.wc.ar*.52],[`1–30 days`,d.wc.ar*.16],[`31–60 days`,d.wc.ar*.10],[`61–90 days`,d.wc.ar*.13],[`90+ days`,d.wc.ar*.09],
  ];
  const overdue=d.wc.ar*.22;
  return `<div class="details">
  ${state.market?noMarket(`Cash conversion cycle`):panel(`Cash conversion cycle`,table(`Cash conversion cycle`,[plain(`Metric`),dayColumn(currentLabel()),dayColumn(references[state.compare])],[`dso`,`dio`,`dpo`,`ccc`].map(k=>[k.toUpperCase(),d.wc[k],d.baseWC[k]])),`Month-end balances divided by current-month activity × 30`)}
  ${panel(`Accounts receivable aging`,bars(`Receivable aging`,debt),`Aged by days past due · ${currency()}`)}
  ${panel(`Largest overdue customers`,table(`Overdue customers`,[plain(`Account`),money(`Past due >60 days`)],merchants.map((name,i)=>[name,overdue*[.34,.27,.22,.17][i]])),`Reconciles to the 61+ day buckets`)}
  ${panel(`Supplier obligations`,table(`Supplier obligations`,[plain(`Payment window`),money(`Payables`)],[[`Next 7 days`,d.wc.ap*.22],[`8–30 days`,d.wc.ap*.39],[`31–60 days`,d.wc.ap*.27],[`Later`,d.wc.ap*.12]]),`Open amounts by due window · ${currency()}`)}
  ${panel(`Inventory health`,table(`Inventory health`,[plain(`Product`),money(`Stock value`),money(`Slow-moving`),money(`Expires in 90 days`)],inventoryRows(d),true),`Risk categories can overlap · ${currency()}`,true)}</div>`;
}
function forecast(){
  const latest=fyRows(state,`forecast`), previous=fyRows(state,`previous`);
  const a=statement(latest), b=statement(previous), plan=statement(tradeRows(state,range(11,true),`budget`));
  const lines=[[`External net revenue`,`revenue`],[`Gross profit`,`gross`],[`Operating expenses`,`opex`],[`EBITDA`,`ebitda`]];
  return `<div class="details">${panel(`FY 2026 outlook`,table(`Full-year outlook`,[plain(`Measure`),money(`Current`),money(`Previous`),money(`Movement`),money(`Budget`),money(`vs Budget`)],lines.map(([label,k])=>[label,a[k],b[k],a[k]-b[k],plan[k],a[k]-plan[k]])),`Actuals through Oct plus Nov–Dec forecast · ${currency()}`,true)}
  ${panel(`What moved the forecast`,waterfall(b.ebitda,bridge(latest,previous),a.ebitda,`Forecast EBITDA bridge`,[`Previous EBITDA`,`Current EBITDA`]),`Previous to current forecast · ${currency()}`)}
  ${panel(`Forecast basis`,stat(`Closed actuals`,`Jan–Oct 2026`)+stat(`Forward months`,`Nov–Dec 2026`)+stat(`Current comparison`,`Previous forecast and budget`)+`<p class="caption">The full-year comparison uses the latest forecast for the selected company and market.</p>`)}</div>`;
}
function manufacturing(d){
  const categories=products.map(product=>{
    const a=statement(d.rows.filter(r=>r.product===product.name));
    const b=statement(d.base.filter(r=>r.product===product.name));
    return [product.name,a.material,b.material,a.material-b.material,a.conversion,b.conversion,a.conversion-b.conversion];
  });
  return `<div class="details">${panel(`Material and manufacturing costs`,table(`Production costs`,[plain(`Product`),...`Materials period value|Materials reference|Materials difference|Manufacturing period value|Manufacturing reference|Manufacturing difference`.split(`|`).map(money)],categories,true),`Compared with ${references[state.compare]} · ${currency()}`,true)}
  ${panel(`Inventory exposure`,table(`Inventory exposure`,[plain(`Product`),money(`Stock value`),money(`Slow-moving`),money(`Expires in 90 days`)],inventoryRows(d),true),`Risk categories can overlap · ${currency()}`,true)}</div>`;
}
function capex(){
  if(state.market)return noMarket(`CapEx & Commitments`);
  const p=capexProjects(state,Math.min(state.month,closedMonth));
  return `<div class="details">${panel(`Capital projects`,table(`Capital projects`,[plain(`Project`),money(`Annual budget`),money(`YTD spend`),money(`Open commitments`),money(`Headroom`)],p.map(row=>[row.name,row.budget,row.actual,row.committed,row.remaining])),`Headroom = budget − spend − open commitments · ${currency()}`,true)}
  ${panel(`Budget headroom by project`,bars(`CapEx headroom`,p.map(r=>[r.name,r.remaining])),`Negative headroom flags a potential overrun`)}</div>`;
}
function close(){
  if(state.market)return noMarket(`Financial Close`);
  const population=scopeEntities(state);
  const closeMonth=Math.min(state.month,closedMonth);
  const period=[closeMonth];
  const input=population.map(e=>[itemLink(e.name,{company:e.id}),`Closed`,displayDate.format(dateAt(closeMonth+1,5+entities.indexOf(e)*2)),financials({company:e.id},period).revenue,intercompany({company:e.id},period)]);
  const combined=population.reduce((acc,e)=>{
    const f=financials({company:e.id},period);
    return {revenue:acc.revenue+f.revenue,cogs:acc.cogs+f.cogs,ebitda:acc.ebitda+f.ebitda};
  },{revenue:0,cogs:0,ebitda:0});
  const elimination=intercompany(state,period);
  const closed=financials(state,period);
  const consolidated=state.company
    ? [[`Entity as reported`,combined.revenue,combined.cogs,combined.ebitda],[`Included intragroup transfers at cost`,elimination,elimination,0],[`Entity external sales view`,combined.revenue-elimination,combined.cogs-elimination,combined.ebitda]]
    : [[`Combined entity submissions`,combined.revenue,combined.cogs,combined.ebitda],[`Intercompany eliminations`,-elimination,-elimination,0],[`Consolidated group`,closed.revenue,closed.cogs,closed.ebitda]];
  return `<div class="details">${panel(`Entity close status`,table(`Entity submissions`,[plain(`Company`),plain(`Status`),plain(`Closed on`),money(`Reported revenue`),money(`Intercompany`)],input),`${months[closeMonth]} 2026 close · ${currency()}`,true)}
  ${panel(`Consolidation reconciliation`,table(`Consolidation reconciliation`,[plain(`Step`),money(`Net revenue`),money(`COGS`),money(`EBITDA`)],consolidated),state.company?`Intragroup amounts are included in the entity submission`:`Transfers at cost are removed from both revenue and COGS`,true)}</div>`;
}
const renderers={overview,profit,cash:treasury,working,forecast,manufacturing,capex,close};
const option=(value,label,selected=false)=>`<option value="${esc(value)}"${selected?` selected`:``}>${esc(label)}</option>`;
function parse(){
  const [page,query]=location.hash.slice(1).split(`?`);
  const q=new URLSearchParams(query);
  const period=q.get(`period`);
  const n=Number(period)-1;
  const window=Object.hasOwn(reportWindows,period)?period:``;
  const company=entities.find(e=>e.id===q.get(`company`));
  Object.assign(state,{
    page:Object.hasOwn(views,page)?page:`overview`,
    window,
    month:window?reportWindows[window].months.at(-1):Number.isInteger(n)&&n>=0&&n<=closedMonth?n:closedMonth,
    product:page===`profit`&&products.some(p=>p.name===q.get(`product`))?q.get(`product`):``,
    compare:[`budget`,`prior`,`forecast`].includes(q.get(`compare`))?q.get(`compare`):`budget`,
    company:company?.id||``,
    market:availableMarkets(company).includes(q.get(`market`))?q.get(`market`):``,
    local:Boolean(company&&q.get(`currency`)===`local`),
    metric:metricInfo.some(m=>m.key===q.get(`metric`))||q.get(`metric`)===`inventory`?q.get(`metric`):``,
  });
}
function update(){
  parse();
  blocks=[];
  const d=sectionData();
  const [title,,subtitle]=views[state.page];
  const label=metricInfo.find(m=>m.key===state.metric)?.label||(state.metric===`inventory`?`Inventory exposure`:``);
  $(`scope-label`).textContent=[entity()?.name||`Dar Al Dawa Group`,state.market,state.product].filter(Boolean).join(` / `);
  $(`page-title`).textContent=state.page===`overview`?`CFO Dashboard`:title;
  $(`section-title`).textContent=title;
  $(`subtitle`).textContent=`${label?`${label} · `:``}${subtitle}`;
  $(`period`).innerHTML=months.slice(0,closedMonth+1).map((m,i)=>option(i+1,`${m} 2026${i===closedMonth?` · latest close`:``}`,!state.window&&state.month===i)).join(``)+Object.entries(reportWindows).map(([key,period])=>option(key,period.label,state.window===key)).join(``);
  $(`compare`).value=state.compare;
  $(`company`).innerHTML=option(``,`Consolidated group`,!entity())+entities.map(e=>option(e.id,`${e.code} · ${e.name}`,e.id===state.company)).join(``);
  $(`market`).innerHTML=option(``,`All markets`,!state.market)+availableMarkets(entity()).map(m=>option(m,m,m===state.market)).join(``);
  $(`currency`).innerHTML=option(`usd`,`USD`,!state.local)+(entity()?option(`local`,`${entity().currency} · local`,state.local):``);
  $(`currency`).disabled=!entity();
  $(`sections`).innerHTML=Object.entries(views).map(([key,[name,icon]])=>`<a href="${esc(hashFor(key,{metric:``}))}" aria-label="${esc(name)}" title="${esc(name)}"${key===state.page?` aria-current="page"`:``}><span class="nav-icon material-symbols-outlined" aria-hidden="true">${icon}</span><span class="nav-label">${esc(name)}</span></a>`).join(``);
  $(`view`).innerHTML=renderers[state.page](d);

  $(`csv`).disabled=!blocks.length;
}
function setFilter(e){
  const value=e.target.value;
  const change={
    period:Object.hasOwn(reportWindows,value)?{window:value}:{window:``,month:Number(value)-1},compare:{compare:value},
    company:{company:value,local:false},
    market:{market:value},currency:{local:value===`local`},
  }[e.target.id];
  if(change)history.replaceState(null,``,hashFor(state.page,change));
  update();
  if(change)e.target.focus();
}
function setMenu(open){
  $(`navigation`).classList.toggle(`open`,open);
  $(`scrim`).hidden=!open;
  $(`menu`).setAttribute(`aria-expanded`,String(open));
}
const exportValue=(col,value)=>{
  if(typeof value===`object`)return value.label;
  if(col.format===cash)return (value*rate()).toFixed(2);
  return col.format(value);
};
const csvCell=value=>`"${String(value).replaceAll(`"`,`""`)}"`;
function exportCsv(){
  const metadata=[periodLabel(),$(`scope-label`).textContent,currency(),references[state.compare]];
  const output=blocks.flatMap(({title,columns,rows})=>[
    [...metadata,title],columns.map(c=>c.label),...rows.map(row=>row.map((v,i)=>exportValue(columns[i],v))),[],
  ]).map(row=>row.map(csvCell).join(`,`)).join(`\r\n`);
  downloadFile(new Blob([`\uFEFF`,output],{type:`text/csv;charset=utf-8`}),`DAD-CFO-${state.page}-${downloadPeriod()}.csv`);
  $(`status`).textContent=`Analysis exported as CSV.`;
}
const downloadPeriod=()=>`2026-${state.window||String(state.month+1).padStart(2,`0`)}`;
function downloadFile(blob,filename){
  const url=URL.createObjectURL(blob);
  const link=document.createElement(`a`);
  link.href=url;
  link.download=filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function downloadExecutivePdf(){
  const original=blocks;
  let reportBlocks;
  try{
    blocks=[];
    overview(sectionData());
    reportBlocks=blocks;
  }finally{
    blocks=original;
  }
  const sections=reportBlocks.map(({title,columns,rows})=>({
    title,
    columns:columns.map(col=>col.label),
    rows:rows.map(row=>row.map((value,index)=>fmtCell(columns[index],value))),
  }));
  const pdf=executivePdf({
    period:periodLabel(),scope:$(`scope-label`).textContent,currency:currency(),reference:references[state.compare],
  },sections);
  downloadFile(new Blob([pdf],{type:`application/pdf`}),`DAD-CFO-Executive-${downloadPeriod()}.pdf`);
  $(`status`).textContent=`Executive PDF downloaded.`;
}
const applyTheme=dark=>{
  document.documentElement.classList.toggle(`dark`,dark);
  $(`theme`).setAttribute(`aria-pressed`,String(dark));
  $(`theme-icon`).textContent=dark?`light_mode`:`dark_mode`;
};
try{applyTheme(localStorage.getItem(`dad-cfo-theme`)===`dark`);}catch{}
$(`theme`).addEventListener(`click`,()=>{
  const dark=!document.documentElement.classList.contains(`dark`);
  applyTheme(dark);
  try{localStorage.setItem(`dad-cfo-theme`,dark?`dark`:`light`);}catch{}
});
$(`filters`).addEventListener(`change`,setFilter);
$(`filters`).addEventListener(`submit`,e=>e.preventDefault());
$(`menu`).addEventListener(`click`,()=>{
  const open=$(`menu`).getAttribute(`aria-expanded`)!==`true`;
  setMenu(open);
  if(open)$(`sections`).querySelector(`[aria-current]`)?.focus();
});
$(`collapse`).addEventListener(`click`,()=>{
  const collapse=$(`collapse`);
  const collapsed=collapse.getAttribute(`aria-expanded`)===`true`;
  $(`navigation`).parentElement.classList.toggle(`sidebar-collapsed`,collapsed);
  collapse.setAttribute(`aria-expanded`,String(!collapsed));
  collapse.setAttribute(`aria-label`,collapsed?`Expand navigation`:`Collapse navigation`);
});
$(`scrim`).addEventListener(`click`,()=>{setMenu(false);$(`menu`).focus();});
document.addEventListener(`keydown`,e=>{
  if(e.key===`Escape`&&$(`menu`).getAttribute(`aria-expanded`)===`true`){setMenu(false);$(`menu`).focus();}
});
$(`sections`).addEventListener(`click`,e=>{if(e.target.closest(`a`))setMenu(false);});
$(`view`).addEventListener(`input`,event=>{
  if(!event.target.matches(`[data-product-search]`))return;
  const panel=event.target.closest(`.panel`);
  const query=event.target.value.trim().toLowerCase();
  let visible=0;
  for(const row of panel.querySelectorAll(`tbody tr`)){
    row.hidden=!row.cells[0].textContent.toLowerCase().includes(query);
    if(!row.hidden)visible++;
  }
  panel.querySelector(`[data-product-count]`).textContent=`${visible} products`;
});
$(`csv`).addEventListener(`click`,exportCsv);
$(`pdf`).addEventListener(`click`,downloadExecutivePdf);
window.addEventListener(`hashchange`,()=>{update();setMenu(false);window.scrollTo(0,0);});
update();
