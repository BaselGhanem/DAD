const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const BODY_WIDTH = PAGE_WIDTH - 2*MARGIN;
const COLORS = {
  navy:`0.04 0.20 0.34`, teal:`0.03 0.42 0.42`, ink:`0.09 0.15 0.20`,
  muted:`0.28 0.33 0.41`, paper:`0.94 0.97 0.98`, white:`1 1 1`,
};

function ascii(value){
  return String(value).replace(/[−–—]/g,`-`).replace(/·/g,`|`)
    .normalize(`NFKD`).replace(/[^\x20-\x7E]/g,` `).trim();
}
function literal(value){
  return ascii(value).replace(/[\\()]/g,char=>`\\${char}`);
}
function wrap(value,limit){
  const lines=[];
  let line=``;
  for(const word of ascii(value).split(/\s+/)){
    if(line&&line.length+word.length+1>limit){lines.push(line);line=``;}
    line=line?`${line} ${word}`:word;
  }
  return [...lines,line];
}
function documentBytes(pageStreams){
  const pages=pageStreams.map((_,i)=>5+i*2);
  const objects=[
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${pages.map(id=>`${id} 0 R`).join(` `)}] /Count ${pages.length} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
  ];
  pageStreams.forEach((stream,i)=>{
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pages[i]+1} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    );
  });
  // The document is ASCII, so string positions correspond to byte offsets.
  let body=`%PDF-1.4\n`;
  const offsets=[`0000000000 65535 f \n`];
  objects.forEach((object,i)=>{
    offsets.push(`${String(body.length).padStart(10,`0`)} 00000 n \n`);
    body+=`${i+1} 0 obj\n${object}\nendobj\n`;
  });
  const xref=body.length;
  body+=`xref\n0 ${offsets.length}\n${offsets.join(``)}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

export function executivePdf({period,scope,currency,reference},sections){
  const pages=[];
  let content;
  let y;
  const text=(value,x,baseline,size=9,bold=false,color=COLORS.ink)=>{
    content.push(`BT /${bold?`F2`:`F1`} ${size} Tf ${color} rg 1 0 0 1 ${x} ${baseline} Tm (${literal(value)}) Tj ET\n`);
  };
  const rect=(x,base,w,h,color)=>content.push(`${color} rg ${x} ${base} ${w} ${h} re f\n`);
  const newPage=()=>{
    content=[];
    pages.push(content);
    rect(0,PAGE_HEIGHT-110,PAGE_WIDTH,110,COLORS.navy);
    text(`DAR AL DAWA  |  FINANCE`,MARGIN,811,10,true,COLORS.white);
    text(`CFO Executive Summary`,MARGIN,781,23,true,COLORS.white);
    text(`${period} | ${currency} | vs ${reference}`,MARGIN,754,10,false,COLORS.white);
    text(scope,MARGIN,709,10,true,COLORS.teal);
    text(`Page ${pages.length}`,PAGE_WIDTH-73,27,8,false,COLORS.muted);
    y=684;
  };
  newPage();

  for(const section of sections){
    const fractions=section.title===`Priority watchlist`?[.33,.15,.12,.40]:section.columns.length===4?[.34,.22,.22,.22]:[.60,.40];
    const widths=fractions.map(f=>Math.floor(f*BODY_WIDTH));
    const drawRow=(values,heading=false,shade=false)=>{
      const lines=values.map((value,i)=>wrap(value,Math.floor((widths[i]-12)/6)));
      const height=Math.max(21,lines.reduce((max,col)=>Math.max(max,col.length),0)*11+9);
      if(heading||shade)rect(MARGIN,y-height,BODY_WIDTH,height,COLORS.paper);
      let x=MARGIN;
      lines.forEach((column,i)=>{
        column.forEach((line,j)=>text(line,x+6,y-14-j*11,9,heading||i===0,heading?COLORS.teal:COLORS.ink));
        x+=widths[i];
      });
      y-=height;
    };
    const heading=()=>{
      text(section.title,MARGIN,y,13,true,COLORS.teal);
      y-=9;
      drawRow(section.columns,true);
    };
    if(y<112)newPage();
    heading();
    section.rows.forEach((row,index)=>{
      if(y<91){newPage();heading();}
      drawRow(row,false,index%2===1);
    });
    y-=23;
  }

  return documentBytes(pages.map(page=>page.join(``)));
}
