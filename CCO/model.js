import {catalog} from './catalog.js';

export const year=2026;
export const latestMonth=10;
export const months=[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`];
export const countries=[`Algeria`,`Bahrain`,`HongKong`,`Iraq`,`Jordan`,`Kuwait`,`Lebanon`,`Libya`,`Morocco`,`Oman`,`Qatar`,`Saudi`,`Somalia`,`South Sudan`,`Sudan`,`UAE`,`Uganda`,`Yemen`,`Zambia`];
export const sectors=[`Private`,`LPO`,`Tender`];
const overdueCountries=new Set([`Iraq`,`Libya`,`Sudan`]);
export const marketDirectory=countries.flatMap(country=>
  ([`Iraq`,`Jordan`,`Saudi`].includes(country)?[`Central`,`North`]:[`National`]).map(area=>({
    country,market:`${country} - ${area}`,manager:`Market Manager - ${country}`,
  })));
export const marketStatus=marketDirectory.flatMap(record=>months.map((_,index)=>({
  ...record,month:index+1,closed:index+1<latestMonth||(index+1===latestMonth&&!overdueCountries.has(record.country)),
})));
const monthStatus=new Map(marketStatus.map(record=>[`${record.month}|${record.market}`,record.closed]));
const dataset=new Map();

export function salesRows(type){
  if(dataset.has(type))return dataset.get(type);
  const rows=marketDirectory.flatMap(({country,market},mi)=>catalog.filter((_,i)=>(i*7+mi*3)%11<3||mi===0).flatMap(([group,sku],pi)=>{
    const sector=sectors[(pi+mi)%sectors.length];
    const budgeted=(pi+mi)%8!==0;
    const launched=(pi+mi)%13===0;
    const launchMonth=launched?5+(pi%4):1;
    const base=50+(mi*107+pi*71)%680;
    return months.slice(launchMonth-1).map((_,index)=>{
      const month=index+launchMonth;
      const closed=monthStatus.get(`${month}|${market}`);
      const targetUnits=Math.round(base*(1+month*.025)*(type===`TMS`?1.13:1));
      const targetPrice=(9+(pi*11+mi*7)%34)*(sector===`Tender`?.78:sector===`LPO`?.87:1)*(type===`TMS`?.91:1);
      const volumeFactor=.78+((pi*3+mi*7+month*5)%31)/100;
      const forecastUnits=Math.round(targetUnits*(volumeFactor+.06));
      const budgetUnits=budgeted?targetUnits:0;
      const budgetUsd=budgetUnits*targetPrice;
      const actualUnits=closed?Math.round(targetUnits*volumeFactor):null;
      const actualPrice=targetPrice*(.96+((pi+mi+month)%9)/100);
      const actualUsd=closed?actualUnits*actualPrice:null;
      const forecastUsd=forecastUnits*targetPrice*.99;
      const priorUnits=launched?0:Math.round(targetUnits*(.77+((pi+mi)%16)/100));
      const priorUsd=priorUnits*targetPrice*.96;
      const margin=.35+(pi%13)/100-(sector===`Tender`?.11:sector===`LPO`?.06:0);
      return {type,month,country,market,sector,group,sku,budgeted,launched,closed,
        actualUnits,actualUsd,budgetUnits,budgetUsd,forecastUnits,forecastUsd,priorUnits,priorUsd,
        forecastPreviousUsd:forecastUsd*(.95+(mi%8)/100),forecastPreviousUnits:Math.round(forecastUnits*(.95+(mi%8)/100)),
        grossProfit:closed?actualUsd*margin:null, discounts:closed?actualUsd*(.035+(pi%6)/100):0,
        bonusUnits:closed?Math.round(actualUnits*(pi%9)/100):0,
        returns:closed?actualUsd*(.006+(pi%7)/1000):0,
      };
    });
  }));
  dataset.set(type,rows);
  return rows;
}
export function periodMonths(month,period){
  if(period===`month`)return [month];
  const start=period===`quarter`?Math.floor((month-1)/3)*3+1:1;
  return Array.from({length:month-start+1},(_,i)=>start+i);
}
export function summarize(rows,unit,mode){
  const total={actual:0,budget:0,prior:0,grossProfit:0,netUsd:0,actualUnits:0,priorUnits:0,priorUsd:0,pvmVolume:0,pvmPrice:0,pvmLaunch:0,discounts:0,bonusUnits:0,returns:0};
  for(const row of rows){
    if(!row.closed)continue;
    total.budget+=row[`budget${unit}`];
    if(mode===`budgeted`&&!row.budgeted)continue;
    total.actual+=row[`actual${unit}`];
    total.prior+=row[`prior${unit}`];
    total.grossProfit+=row.grossProfit;
    total.netUsd+=row.actualUsd;
    total.actualUnits+=row.actualUnits;
    total.priorUnits+=row.priorUnits;
    total.priorUsd+=row.priorUsd;
    if(row.launched)total.pvmLaunch+=row.actualUsd;
    else if(row.priorUnits){
      const priorPrice=row.priorUsd/row.priorUnits;
      total.pvmVolume+=(row.actualUnits-row.priorUnits)*priorPrice;
      total.pvmPrice+=row.actualUsd-row.actualUnits*priorPrice;
    }
    total.discounts+=row.discounts;
    total.bonusUnits+=row.bonusUnits;
    total.returns+=row.returns;
  }
  return {...total,gap:total.actual-total.budget,achievement:total.budget?total.actual/total.budget:null,
    growth:total.prior?(total.actual-total.prior)/total.prior:null,margin:total.netUsd?total.grossProfit/total.netUsd:null};
}
export function outlook(rows,unit,mode){
  return rows.reduce((a,r)=>{
    a.budget+=r[`budget${unit}`];
    if(mode===`budgeted`&&!r.budgeted)return a;
    a.closed+=r.closed?r[`actual${unit}`]:0;
    a.forecast+=r.closed?0:r[`forecast${unit}`];
    a.previous+=r.closed?r[`actual${unit}`]:unit===`Usd`?r.forecastPreviousUsd:r.forecastPreviousUnits;
    return a;
  },{closed:0,forecast:0,budget:0,previous:0});
}
export function groupBy(rows,key){
  const groups=new Map();
  for(const row of rows){
    const name=row[key];
    if(!groups.has(name))groups.set(name,[]);
    groups.get(name).push(row);
  }
  return [...groups];
}
