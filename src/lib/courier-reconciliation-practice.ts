import type {CourierBill, ReconciliationShipment} from './courier-reconciliation';

export function practiceData(clean=false): {bill:CourierBill;shipments:ReconciliationShipment[]} {
  const shipments:ReconciliationShipment[]=Array.from({length:5},(_,i)=>({id:'practice-'+(i+1),sent:'2026-11-'+String(i+2).padStart(2,'0'),recipientName:'Practice recipient '+(i+1),courier:'Professional Courier',tracking:'EXAMPLE-NOV-00'+(i+1),city:['Chennai','Bangalore','Coimbatore','Salem','Madurai'][i],address:'Practice address only',onBehalfOf:'Practice estate',cost:null,status:'Dispatched'}));
  const amounts=[150,200,100,80,60];
  let lines=shipments.map((s,i)=>({id:'practice-line-'+i,tracking:s.tracking!,sent:s.sent,destination:s.city!,amount:amounts[i],totalIncludingTax:amounts[i]}));
  if(!clean){lines=[...lines.slice(0,4),{...lines[3],id:'practice-duplicate'},{id:'practice-unmatched',tracking:'EXAMPLE-NOV-099',sent:'2026-11-07',destination:'Chennai',amount:60,totalIncludingTax:60}];}
  const total=lines.reduce((n,l)=>n+l.amount,0);
  return {shipments,bill:{courier:'Professional Courier',currency:'INR',invoiceNumber:'PRACTICE-NOV-2026',invoiceDate:'2026-12-01',periodFrom:'2026-11-01',periodTo:'2026-11-30',billedTo:'Practice account only',subtotal:total,fuel:0,cgst:0,sgst:0,igst:0,other:0,rounding:0,total,lines,warnings:[],sourceLabel:'Illustrative November practice data · no real dispatches or charges'}};
}
