// Writes the minimal Open XML parts and stores them in an uncompressed ZIP container.
const encoder=new TextEncoder();
const xmlEscape=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[c]);
const xml=body=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
const ns=`http://schemas.openxmlformats.org/spreadsheetml/2006/main`;
const rel=`http://schemas.openxmlformats.org/officeDocument/2006/relationships`;
const packageRel=`http://schemas.openxmlformats.org/package/2006/relationships`;
const crcTable=Uint32Array.from({length:256},(_,i)=>{
  for(let bit=0;bit<8;bit++)i=i&1?0xedb88320^(i>>>1):i>>>1;
  return i;
});
function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
function header(length, fields){
  const bytes=new Uint8Array(length), view=new DataView(bytes.buffer);
  for(const [offset,n,size] of fields)size===2?view.setUint16(offset,n,true):view.setUint32(offset,n,true);
  return bytes;
}
function zip(parts){
  const local=[], central=[];
  let offset=0, directorySize=0;
  for(const [path,content] of parts){
    const name=encoder.encode(path), data=encoder.encode(content), crc=crc32(data);
    const record=header(30,[[0,0x04034b50],[4,20,2],[10,0,2],[12,0x21,2],[14,crc],[18,data.length],[22,data.length],[26,name.length,2]]);
    const entry=header(46,[[0,0x02014b50],[4,20,2],[6,20,2],[12,0,2],[14,0x21,2],[16,crc],[20,data.length],[24,data.length],[28,name.length,2],[42,offset]]);
    local.push(record,name,data);
    central.push(entry,name);
    offset+=record.length+name.length+data.length;
    directorySize+=entry.length+name.length;
  }
  const end=header(22,[[0,0x06054b50],[8,parts.length,2],[10,parts.length,2],[12,directorySize],[16,offset]]);
  return new Blob([...local,...central,end],{type:`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`});
}
function columnName(index){
  let name=``;
  for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;
  return name;
}
function cell(value,column,row){
  if(value==null)return ``;
  const address=`${columnName(column)}${row}`;
  if(typeof value===`number`&&Number.isFinite(value))return `<c r="${address}"><v>${value}</v></c>`;
  return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}
function worksheet(rows){
  return xml(`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((value,column)=>cell(value,column,i+1)).join(``)}</row>`).join(``)}</sheetData><autoFilter ref="A1:${columnName(rows[0].length-1)}${rows.length}"/></worksheet>`);
}
export function makeWorkbook(sheets){
  const sheetLinks=sheets.map(({name},i)=>`<sheet name="${xmlEscape(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join(``);
  const overrides=sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join(``);
  const relations=sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join(``);
  return zip([
    [`[Content_Types].xml`,xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`)],
    [`_rels/.rels`,xml(`<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)],
    [`xl/workbook.xml`,xml(`<workbook xmlns="${ns}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets>${sheetLinks}</sheets></workbook>`)],
    [`xl/_rels/workbook.xml.rels`,xml(`<Relationships xmlns="${packageRel}">${relations}</Relationships>`)],
    ...sheets.map(({rows},i)=>[`xl/worksheets/sheet${i+1}.xml`,worksheet(rows)]),
  ]);
}
