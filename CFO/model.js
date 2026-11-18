export const closedMonth = 9;
export const months = [`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`];
export const entities = [
  {id:`levant`, name:`Demo Levant Pharma`, currency:`JOD`, rate:.709, size:1, markets:[[`Jordan`,.81],[`Algeria`,.19]]},
  {id:`maghreb`, name:`Demo Maghreb Distribution`, currency:`DZD`, rate:134, size:.61, markets:[[`Algeria`,.87],[`Tunisia`,.13]]},
  {id:`europe`, name:`Demo Europe Commercial`, currency:`RON`, rate:4.53, size:.39, markets:[[`Romania`,1]]},
];
const productNames = [
  `Amuretic`,
  `Angiosar`,
  `Angiosar - Plus`,
  `Aresil`,
  `Azord - Xevaneer`,
  `Capocard`,
  `Ciprodar - Qurex`,
  `Clavodar`,
  `Daroxime`,
  `Deplazen`,
  `Diclogesic`,
  `Dilzacard`,
  `Famodar`,
  `Flucoheal`,
  `Gamcet`,
  `Gamcet Duo`,
  `Glenpa`,
  `Glunorm`,
  `Glunorm M`,
  `Hairgrow`,
  `Histafen Topical`,
  `Ibugesic`,
  `Locan`,
  `Lovista - Evadad`,
  `Matador - Livador`,
  `Mixif - Murex`,
  `Motrinex`,
  `Mycoheal`,
  `Myogesic`,
  `Neobacin`,
  `Nulina`,
  `Omedar`,
  `Oprim`,
  `Pantodar`,
  `Pedexa`,
  `Proctoheal`,
  `Rina`,
  `Rozitta - Robust`,
  `Smooderm`,
  `Tyra 20 Mg`,
  `Tyra 5 Mg`,
  `Vitadad - DivaD`,
  `Xenpa`,
  `Zarlan - Xivar`,
  `Clomifert - Avaklamin`,
  `Dad Teething Gel`,
  `Diclofast-Solvast`,
  `Erythrodar`,
  `Liblab - Avilop`,
  `Ophtamolol`,
  `Pamol`,
  `Trimidar-M`,
  `Amlodar - Amolar`,
  `Xenpa-met`,
  `Amoxydar - Moxidad`,
  `Carbatol`,
  `Domperide`,
  `Doxydar`,
  `Fastikol`,
  `Formit - Gliafor`,
  `Loratan - Loradad`,
  `Volar`,
  `Violet`,
  `Atrenova`,
  `Cephadar`,
  `Dasatinib`,
  `Lincodar`,
  `Procula`,
  `Ambolar`,
  `Claridar`,
  `Cloracef`,
  `Combizart`,
  `Combizart HCT`,
  `Gizlan`,
  `Gizlan Duo - Gizamlo`,
  `Lipodar`,
  `Mozart`,
  `Mozart - HCT`,
  `Ophtamesone`,
  `Anxetin`,
  `Cibramine`,
  `Epigab`,
  `Esperal-Espedar-Tiaqueen`,
  `Mirale`,
  `Olzan`,
];

const demoProfiles = [
  {share:.39, unitPrice:14.2, material:5.25, conversion:2.35},
  {share:.34, unitPrice:11.8, material:4.55, conversion:2.10},
  {share:.27, unitPrice:9.6, material:3.35, conversion:1.80},
];

// Split the existing illustrative financial profiles across display names.
const entries = productNames.map((name,index)=>({
  name, profile:index%demoProfiles.length, weight:1+(index*13)%19,
}));
const weightsByProfile = demoProfiles.map((_,index)=>
  entries.reduce((sum,entry)=>sum+(entry.profile===index?entry.weight:0),0)
);
export const products = entries.map(({name,profile,weight})=>{
  const {share,unitPrice,material,conversion}=demoProfiles[profile];
  return {name,profile,share:share*weight/weightsByProfile[profile],unitPrice,material,conversion};
});
export const references = {budget:`Budget`,prior:`Prior year`,forecast:`Forecast`,actual:`Actual`,previous:`Previous forecast`};
const assumptions = {
  actual: {volume:.976, price:1.012, material:1.039, conversion:1.018, opex:1.018, mix:[.98,1.03,.997]},
  budget: {volume:1, price:1, material:1, conversion:1, opex:1, mix:[1,1,1]},
  prior: {volume:.918, price:.981, material:.973, conversion:.972, opex:.945, mix:[.98,1.01,1.014]},
  forecast: {volume:.989, price:1.008, material:1.025, conversion:1.012, opex:1.011, mix:[.99,1.025,.982]},
  previous: {volume:1.003, price:1.005, material:1.016, conversion:1.009, opex:1.007, mix:[.985,1.021,.995]},
};

export function range(end, ytd = false) {
  return ytd ? Array.from({length:end+1}, (_,i)=>i) : [end];
}
export function scopeEntities(scope) {
  return scope.company ? entities.filter(entity=>entity.id===scope.company) : entities;
}
export function tradeRows(scope, periods, reference = `actual`) {
  const rules = assumptions[reference];
  return scopeEntities(scope).flatMap((entity)=>periods.flatMap(month=>entity.markets.flatMap(([market, share],mi)=>{
    if (scope.market && market !== scope.market) return [];
    return products.map(product=>{
      const seasonal = 1 + month*.019 + [0,.025,-.018,.012][month%4];
      const quantity = 290000 * entity.size * share * product.share * seasonal * rules.volume * rules.mix[product.profile];
      return {
        company:entity.name, market, product:product.name, month,
        quantity, price:product.unitPrice*rules.price*(1+mi*.013),
        material:product.material*rules.material*(1+month*.0015),
        conversion:product.conversion*rules.conversion,
        commercial:quantity*1.02*rules.opex,
        admin:quantity*.54*rules.opex,
        research:quantity*.32*rules.opex,
      };
    });
  })));
}
export function statement(rows) {
  const total = rows.reduce((acc,r)=>{
    acc.revenue+=r.quantity*r.price;
    acc.material+=r.quantity*r.material;
    acc.conversion+=r.quantity*r.conversion;
    acc.commercial+=r.commercial;
    acc.admin+=r.admin;
    acc.research+=r.research;
    return acc;
  },{revenue:0,material:0,conversion:0,commercial:0,admin:0,research:0});
  const cogs=total.material+total.conversion;
  const gross=total.revenue-cogs;
  const opex=total.commercial+total.admin+total.research;
  return {...total,cogs,gross,margin:total.revenue?gross/total.revenue:0,opex,ebitda:gross-opex};
}
export function bridge(actual, base) {
  const qty = rows=>rows.reduce((sum,r)=>sum+r.quantity,0);
  const factor = qty(actual)/qty(base);
  const contributions = {Volume:0,["Product mix"]:0,["Net price"]:0,Materials:0,Manufacturing:0,["Commercial expenses"]:0,Administration:0,["R&D"]:0};
  actual.forEach((a,i)=>{
    const b=base[i];
    const margin=b.price-b.material-b.conversion;
    contributions.Volume+=(b.quantity*factor-b.quantity)*margin;
    contributions[`Product mix`]+=(a.quantity-b.quantity*factor)*margin;
    contributions[`Net price`]+=a.quantity*(a.price-b.price);
    contributions.Materials-=a.quantity*(a.material-b.material);
    contributions.Manufacturing-=a.quantity*(a.conversion-b.conversion);
    contributions[`Commercial expenses`]+=b.commercial-a.commercial;
    contributions.Administration+=b.admin-a.admin;
    contributions[`R&D`]+=b.research-a.research;
  });
  return Object.entries(contributions);
}
export function intercompany(scope, periods, reference = `actual`) {
  if(scope.company) return tradeRows(scope,periods,reference).reduce((s,r)=>s+r.quantity*r.price*.047,0);
  return entities.reduce((s,e)=>s+intercompany({company:e.id},periods,reference),0);
}
export function financials(scope, periods, reference = `actual`) {
  const external=statement(tradeRows(scope,periods,reference));
  if(!scope.company || scope.market) return external;
  // The demo prices intragroup transfers at cost. Sales and COGS offset in consolidation.
  const internal=intercompany(scope,periods,reference);
  const revenue=external.revenue+internal;
  return {...external,revenue,cogs:external.cogs+internal,margin:external.gross/revenue};
}
export function fyRows(scope, version) {
  return tradeRows(scope,range(closedMonth,true)).concat(tradeRows(scope,[10,11],version));
}
export function workingCapital(scope, month, reference = `actual`) {
  const f=statement(tradeRows(scope,[month],reference));
  const scenario={actual:1,budget:.95,prior:1.045,forecast:.976,previous:.986}[reference];
  const ar=f.revenue*(1.51+month*.012)*scenario;
  const inventory=f.cogs*(2.2+month*.014)*scenario;
  const ap=f.cogs*(1.45+month*.003)/scenario;
  return {ar,inventory,ap,nwc:ar+inventory-ap,dso:ar/f.revenue*30,dio:inventory/f.cogs*30,dpo:ap/f.cogs*30,ccc:ar/f.revenue*30+inventory/f.cogs*30-ap/f.cogs*30};
}
export function cashSchedule(scope, reference = `actual`, cutoff = closedMonth) {
  let opening=scopeEntities(scope).reduce((s,e)=>s+2_720_000*e.size,0);
  return months.map((label,month)=>{
    const source=reference===`actual`&&month>cutoff?`forecast`:reference;
    const p=statement(tradeRows(scope,[month],source));
    const receipts=p.revenue*(month===10?.83:month===11?1.05:.957);
    const suppliers=p.cogs*(month===10?1.16:.978);
    const payroll=p.opex*.71;
    const taxes=p.revenue*(month%3===2?.055:.024);
    const other=p.opex*.29;
    const operating=receipts-suppliers-payroll-taxes-other;
    const capex=p.revenue*(month===10?.12:.074);
    const debt=p.revenue*(month%3===2?.112:.055);
    const closing=opening+operating-capex-debt;
    const row={month,label,opening,receipts,suppliers,payroll,taxes,other,operating,capex,debt,closing,forecast:month>cutoff};
    opening=closing;
    return row;
  });
}
export function capexProjects(scope,month,reference = `actual`) {
  const plan=statement(tradeRows(scope,range(11,true),`budget`)).revenue*.084;
  const spent=cashSchedule(scope,reference,month).slice(0,month+1).reduce((s,r)=>s+r.capex,0);
  return [[`Packaging line upgrade`,.45,.49,.27],[`Warehouse cold chain`,.32,.30,.20],[`ERP finance rollout`,.23,.21,.18]].map(([name,b,s,o])=>{
    const budget=plan*b, actual=spent*s, committed=budget*o;
    return {name,budget,actual,committed,remaining:budget-actual-committed};
  });
}
