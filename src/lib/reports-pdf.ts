import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { financialYearLabel, periodLabel, reportMoney, reportNumber, REPORT_LABELS, type ReportSnapshot } from './reports';

const clean = (value: string) => value.replace(/[–—]/g,'-').replace(/₹/g,'Rs ').replace(/[‘’]/g,"'").replace(/[^\x20-\x7e\xa0-\xff]/g,' ');
function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []; let line = '';
  for (const word of clean(value).split(/\s+/)) {
    if (font.widthOfTextAtSize(`${line} ${word}`.trim(), size) > width && line) { lines.push(line); line = ''; }
    if (font.widthOfTextAtSize(word, size) > width) {
      for (const char of word) { if (font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; } line += char; }
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}
export async function renderReportPdf(snapshot: ReportSnapshot) {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(await readFile(`${process.cwd()}/public/msp-logo.png`));
  const green = rgb(.14,.30,.19), ink = rgb(.17,.23,.18), muted = rgb(.39,.42,.36), cream = rgb(.985,.97,.93), border = rgb(.87,.84,.76), blue = rgb(.30,.49,.60);
  const write = (page: PDFPage, value: string, x: number, y: number, size = 9, strong = false, color = ink) => page.drawText(clean(value), { x,y,size,font: strong ? bold : font,color });
  function base(detail = false) {
    const page = doc.addPage([595.28,841.89]);
    page.drawRectangle({ x:0,y:0,width:595.28,height:841.89,color:cream });
    page.drawRectangle({ x:28,y:811,width:539,height:5,color:green });
    const scaled = logo.scaleToFit(46,46); page.drawImage(logo,{x:29,y:749,width:scaled.width,height:scaled.height});
    write(page,'MSP COFFEE | MOGANAD & STANMORE ESTATES',89,792,8,true,muted);
    const titleLines = wrap(detail ? 'Period details & source coverage' : snapshot.config.title,bold,18,475);
    titleLines.forEach((line,i)=>write(page,line,89,770-i*21,18,true,green));
    const y = 770 - titleLines.length*21;
    write(page,`${periodLabel(snapshot.period)} | ${financialYearLabel(snapshot.period.financialYear)}`,30,y-8,10,true);
    write(page,`${REPORT_LABELS[snapshot.config.type]} report | Generated ${new Date(snapshot.generatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST`,30,y-25,7.5,false,muted);
    page.drawLine({start:{x:28,y:36},end:{x:567,y:36},thickness:.5,color:border});
    write(page,snapshot.reference,30,23,7,false,muted);
    write(page,'Saved report versions retain the figures available when generated.',30,12,6.5,false,muted);
    return { page, top:y-43 };
  }
  const {page,top} = base(); const {current,previous,config} = snapshot;
  const rain = current.rainfall.estates.filter(e=>e.mm!==null).sort((a,b)=>b.mm!-a.mm!);
  const range = rain.length ? `${reportNumber(Math.min(...rain.map(e=>e.mm!)))} - ${reportNumber(Math.max(...rain.map(e=>e.mm!)))} mm` : 'No entries';
  const cards = [
    { module:'rainfall', label:'RAINFALL BY ESTATE', value:range, context:`${rain.length} reporting estates | Not added across locations` },
    { module:'fleet_fuel', label:'FLEET FUEL SPEND', value:reportMoney(current.fleet.spend), context:`${reportNumber(current.fleet.litres,'L filled')} | Fuel cost only` },
    { module:'ho_fuel', label:'HO FUEL ISSUED', value:reportNumber(current.ho.issued,'L'), context:`Purchases: ${reportNumber(current.ho.purchased,'L')} | Separate from issues` },
    { module:'distance', label:'ALL-VEHICLE DISTANCE', value:reportNumber(current.fleet.km,'km'), context:`${current.fleet.vehicles} distinct vehicles with entries` },
  ].filter(card=>config.modules.some(m=>m===card.module));
  cards.forEach((card,index)=>{
    const x = 28 + index%2*276, y = top - Math.floor(index/2)*90;
    page.drawRectangle({x,y:y-78,width:263,height:78,color:rgb(1,.995,.978),borderColor:border,borderWidth:.5});
    write(page,card.label,x+12,y-18,8,true,muted);
    write(page,card.value,x+12,y-43,20,true,green);
    write(page,card.context,x+12,y-63,7,false,muted);
  });
  let y = top - Math.ceil(cards.length/2)*90 - 13;
  if(config.modules.includes('rainfall')) {
    write(page,'Where the rain fell',30,y,14,true,green); y-=15;
    write(page,`Recorded totals in millimetres${rain.length>8 ? ' | Eight highest estate totals shown' : ''}`,30,y,7.5,false,muted); y-=19;
    const max = Math.max(1,...rain.map(r=>r.mm!));
    if(!rain.length) { write(page,'No rainfall entries recorded for this period.',32,y,9); y-=20; }
    rain.slice(0,8).forEach(estate=>{
      write(page,estate.estate,32,y,8);
      page.drawRectangle({x:150,y:y-1,width:340,height:8,color:rgb(.88,.91,.91)});
      if(estate.mm!>0) page.drawRectangle({x:150,y:y-1,width:340*estate.mm!/max,height:8,color:blue});
      write(page,`${reportNumber(estate.mm)} mm`,500,y,8,true); y-=17;
    });
    y-=13;
  }
  const comparisons = [
    ...(config.modules.includes('fleet_fuel') ? [{label:'Fleet fuel spend',now:current.fleet.spend,before:previous.fleet.spend,money:true}] : []),
    ...(config.modules.includes('distance') ? [{label:'Vehicle distance',now:current.fleet.km,before:previous.fleet.km,money:false}] : []),
  ];
  if(comparisons.length){
    write(page,'Compared with the previous period',30,y,12,true,green); y-=15;
    comparisons.forEach((comparison,index)=>{
      const x=30+index*275, max=Math.max(1,comparison.now||0,comparison.before||0);
      write(page,comparison.label,x,y,9,true);
      [[comparison.now,'This period'],[comparison.before,'Previous']].forEach(([value,label],i)=>{
        const numeric=value as number|null, cy=y-19-i*23;
        write(page,String(label),x,cy,7.5,false,muted);
        page.drawRectangle({x:x+65,y:cy-1,width:85,height:7,color:rgb(.88,.90,.85)});
        if(numeric!==null&&numeric>0)page.drawRectangle({x:x+65,y:cy-1,width:85*numeric/max,height:7,color:i?rgb(.63,.70,.60):green});
        write(page,comparison.money?reportMoney(numeric):reportNumber(numeric,'km'),x+156,cy,7.5);
      });
    }); y-=76;
  }
  if(config.modules.includes('ho_fuel')){
    write(page,'HO stock replenishment',30,y,11,true,green); y-=16;
    write(page,`${reportNumber(current.ho.purchased,'litres purchased')} | ${reportMoney(current.ho.spend)}`,30,y,10,true); y-=15;
    write(page,'Purchases replenish stock. Issues are reported separately; these figures are not added together.',30,y,7.5,false,muted); y-=24;
  }
  const coverage = `Latest entries: Rainfall ${current.rainfall.latest||'none'} | Fleet ${current.fleet.latest||'none'} | HO ${current.ho.latest||'none'}`;
  const notes = [coverage,...snapshot.warnings,`Comparison period: ${periodLabel(snapshot.comparisonPeriod)}`];
  write(page,'Reporting notes',30,y,9,true,green); y-=14;
  for(const note of notes) for(const line of wrap(note,font,7.5,535)){write(page,line,30,y,7.5,false,muted);y-=11;}
  if(y<45) throw new Error('The selected information does not fit legibly on one page. Reduce the selected sections.');
  if(config.detail){
    const detail=base(true), p=detail.page; let dy=detail.top;
    write(p,'Monthly activity within the selected period',30,dy,14,true,green);dy-=28;
    const headings=['Month','Fleet spend','Distance','HO issued','HO purchases']; const x=[30,123,245,342,435];
    headings.forEach((label,i)=>write(p,label,x[i],dy,8,true,muted));dy-=20;
    for(const month of snapshot.months){
      const values=[month.month,config.modules.includes('fleet_fuel')?reportMoney(month.summary.fleet.spend):'Not selected',config.modules.includes('distance')?reportNumber(month.summary.fleet.km,'km'):'Not selected',config.modules.includes('ho_fuel')?reportNumber(month.summary.ho.issued,'L'):'Not selected',config.modules.includes('ho_fuel')?reportMoney(month.summary.ho.spend):'Not selected'];
      values.forEach((value,i)=>write(p,value,x[i],dy,8));dy-=28;
    }
    dy-=18;write(p,'Rainfall coverage',30,dy,14,true,green);dy-=24;
    for(const estate of rain){write(p,`${estate.estate}: ${reportNumber(estate.mm,'mm')} | ${estate.days} dates with entries`,30,dy,9);dy-=18;}
    if(!rain.length)write(p,'Rainfall not selected or no rainfall entries for this period.',30,dy,9);
  }
  for(const [index,p] of doc.getPages().entries())write(p,`${index+1} / ${doc.getPageCount()}`,539,23,8,false,muted);
  doc.setTitle(snapshot.config.title);doc.setAuthor('MSP Coffee');
  return { bytes:Buffer.from(await doc.save()), pages:doc.getPageCount() };
}
