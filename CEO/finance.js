import {markets,products,reportWindows,periodFinancials,cashSchedule,cashForPeriods,statement} from "../CFO/model.js?v=aligned";

export {markets};
const windows=Object.values(reportWindows);
const usdM=value=>`$${(value/1e6).toFixed(2)}M`;
const growth=(a,b)=>b?(a-b)/b*100:0;
const metric=(label,format,values)=>[label,format,values];

export function financeSeries(){
  const totals=windows.map(period=>periodFinancials({},period.months).figures);
  const schedule=cashSchedule({});
  const cash=windows.map(period=>cashForPeriods(schedule,period.months));
  const amounts=key=>totals.map(x=>x[key]/1e6);
  return {
    metrics:[
      metric(`Net Revenue`,`usdExactM`,amounts(`revenue`)),
      metric(`Gross Margin`,`percent`,totals.map(x=>x.margin*100)),
      metric(`EBITDA`,`usdExactM`,amounts(`ebitda`)),
      metric(`Operating Cash Flow`,`usdExactM`,cash.map(x=>x.operating/1e6)),
      metric(`Available Cash`,`usdExactM`,cash.map(x=>x.closing/1e6)),
    ],
    revenue:metric(`Net Revenue`,`usdExactM`,amounts(`revenue`)),
    expenses:metric(`Operating Expenses`,`usdExactM`,amounts(`opex`)),
  };
}
export function salesSeries(market){
  const scope={market};
  const values=windows.map(({months})=>{
    const {figures,rows}=periodFinancials(scope,months);
    const budget=periodFinancials(scope,months,`budget`).figures;
    const prior=periodFinancials(scope,months,`prior`).figures;
    return {figures,budget,prior,markets:new Set(rows.map(row=>row.market)).size};
  });
  return [
    metric(`Net Revenue`,`usdExactM`,values.map(x=>x.figures.revenue/1e6)),
    metric(`Revenue vs Budget`,`percent`,values.map(x=>growth(x.figures.revenue,x.budget.revenue))),
    metric(`Markets in Scope`,`count`,values.map(x=>x.markets)),
    metric(`Sales Growth YoY`,`percent`,values.map(x=>growth(x.figures.revenue,x.prior.revenue))),
  ];
}
export function financeBreakdown(quarter){
  const periods=reportWindows[quarter].months;
  const a=periodFinancials({},periods).figures;
  const b=periodFinancials({},periods,`budget`).figures;
  return {
    spend:[[`Commercial expenses`,a.commercial],[`Administration`,a.admin],[`R&D`,a.research]],
    costs:[[`Materials`,a.material],[`Manufacturing`,a.conversion],[`Operating expenses`,a.opex]],
    comparison:[[`Revenue`,a.revenue,b.revenue],[`EBITDA`,a.ebitda,b.ebitda]],
  };
}
export function marketRanking(quarter,market){
  const months=reportWindows[quarter].months;
  const {rows}=periodFinancials({market},months);
  const totals=new Map();
  for(const r of rows)totals.set(r.market,(totals.get(r.market)||0)+r.quantity*r.price);
  return [...totals].sort((a,b)=>b[1]-a[1]);
}
export function productRankings(quarter,market){
  const periods=reportWindows[quarter].months;
  const actual=periodFinancials({market},periods).rows;
  const budget=periodFinancials({market},periods,`budget`).rows;
  const performance=products.map(({name})=>{
    const a=statement(actual.filter(r=>r.product===name));
    const b=statement(budget.filter(r=>r.product===name));
    return {name,revenue:a.revenue,variance:a.ebitda-b.ebitda};
  });
  return {
    sales:performance.sort((a,b)=>b.revenue-a.revenue).slice(0,5).map(x=>[x.name,x.revenue]),
    downside:performance.filter(x=>x.variance<0).sort((a,b)=>a.variance-b.variance).slice(0,5).map(x=>[x.name,x.variance]),
  };
}
export function cfoLink(page,quarter,{market=``,product=``,metric=``}={}){
  return `../CFO/?v=aligned#${page}?${new URLSearchParams({period:quarter,compare:`budget`,market,product,metric})}`;
}
export function dollars(value){
  return value<0?`−${usdM(-value)}`:usdM(value);
}
export function itemAmount(value){
  return Math.abs(value)>=1e6?dollars(value):`${value<0?`−`:``}$${(Math.abs(value)/1000).toFixed(1)}K`;
}
