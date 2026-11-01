export type ReconciliationShipment = {
  id: string; sent: string; recipientName: string; courier: string;
  tracking?: string; city?: string; address?: string; onBehalfOf?: string;
  cost?: number | string | null; status?: string; invoiceNumber?: string; reconciledInvoiceNumber?: string;
};
export type BillLine = {
  id: string; tracking: string; sent: string; destination: string;
  amount: number | null; totalIncludingTax?: number | null;
};
export type CourierBill = {
  courier: string; currency: string; invoiceNumber: string; invoiceDate: string;
  periodFrom: string; periodTo: string; billedTo: string;
  subtotal: number | null; fuel: number | null; cgst: number | null;
  sgst: number | null; igst: number | null; other: number | null;
  rounding: number | null; total: number | null; lines: BillLine[];
  sourceLabel?: string; warnings: string[];
};
export type MatchStatus = 'matched' | 'duplicate' | 'missing_tracking' | 'not_found' | 'ambiguous' | 'date_difference' | 'cost_difference' | 'destination_difference' | 'invalid_line' | 'already_billed';
export type MatchRow = {line: BillLine; status: MatchStatus; shipment?: ReconciliationShipment; reason: string};
export function courierKey(value: string) {
  const key=value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  if(['professionalcourier','professionalcouriers','theprofessionalcouriers','tpc'].includes(key))return 'professional';
  if(['dtdc','ddtc'].includes(key))return 'dtdc';
  return key;
}
export function trackingKey(value: string) { return value.toUpperCase().replace(/\s+/g,''); }
export function cleanBill(input: unknown): CourierBill {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('The bill reader returned an invalid document.');
  const raw=input as Record<string,unknown>;
  const text=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
  const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.round(v*100)/100:null;
  if(!Array.isArray(raw.lines)||raw.lines.length>500)throw new Error('Read one invoice with no more than 500 lines per upload.');
  const lines=raw.lines.map((item:unknown,i:number)=>{
    const line=item&&typeof item==='object'?item as Record<string,unknown>:{};
    return {id:'bill-line-'+i,tracking:text(line.tracking,100),sent:text(line.sent,10),destination:text(line.destination,300),amount:amount(line.amount),totalIncludingTax:amount(line.totalIncludingTax)};
  });
  const warnings=Array.isArray(raw.warnings)?raw.warnings.filter((v):v is string=>typeof v==='string').slice(0,30).map(v=>v.slice(0,1000)):[];
  return {courier:text(raw.courier,100),currency:text(raw.currency,3).toUpperCase(),invoiceNumber:text(raw.invoiceNumber,200),invoiceDate:text(raw.invoiceDate,10),periodFrom:text(raw.periodFrom,10),periodTo:text(raw.periodTo,10),billedTo:text(raw.billedTo),subtotal:amount(raw.subtotal),fuel:amount(raw.fuel),cgst:amount(raw.cgst),sgst:amount(raw.sgst),igst:amount(raw.igst),other:amount(raw.other),rounding:amount(raw.rounding),total:amount(raw.total),lines,warnings};
}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function cents(value: unknown): number | null {
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);return Number.isFinite(number)?Math.round(number*100):null;
}
export function reconciliation(bill: CourierBill, shipments: ReconciliationShipment[]) {
  const issues:string[]=[];
  if(bill.currency!=='INR')issues.push('This preview supports INR bills. Confirm the currency; do not treat foreign-currency amounts as rupees.');
  if(!['professional','dtdc','dhl'].includes(courierKey(bill.courier)))issues.push('Choose Professional Courier, DTDC or DHL.');
  if(!bill.invoiceNumber.trim())issues.push('Confirm the invoice number.');
  if(!validDate(bill.invoiceDate))issues.push('Confirm the invoice date.');
  if(!validDate(bill.periodFrom)||!validDate(bill.periodTo)||bill.periodFrom>bill.periodTo)issues.push('Confirm the billing period.');
  if(!bill.billedTo.trim())issues.push('Confirm the company or account named on this bill.');
  if(!bill.lines.length)issues.push('Add the bill line items.');
  const subtotal=cents(bill.subtotal),total=cents(bill.total);
  const components=[bill.fuel,bill.cgst,bill.sgst,bill.igst,bill.other,bill.rounding].map(cents);
  if(subtotal===null||total===null||components.some(v=>v===null))issues.push('Confirm the freight subtotal, fuel, taxes, other charges, rounding and final total. Enter zero only where confirmed absent.');
  if([bill.subtotal,bill.total,bill.fuel,bill.cgst,bill.sgst,bill.igst,bill.other].some(v=>v!==null&&(!Number.isFinite(v)||v<0)))issues.push('Bill amounts must be non-negative numbers; rounding may be negative.');
  const lineSum=bill.lines.reduce((n,line)=>n+(cents(line.amount)??0),0);
  const lineDifference=subtotal===null?null:lineSum-subtotal;
  if(lineDifference!==null&&lineDifference!==0)issues.push('Line items do not add up to the freight subtotal. Check for missing pages or unreadable amounts.');
  const calculated=subtotal===null||components.some(v=>v===null)?null:subtotal+components.reduce<number>((n,v)=>n+(v??0),0);
  const totalDifference=calculated===null||total===null?null:calculated-total;
  if(totalDifference!==null&&totalDifference!==0)issues.push('Freight plus invoice-level charges does not equal the final bill total.');
  const counts=new Map<string,number>();
  for(const line of bill.lines){const key=trackingKey(line.tracking);if(key)counts.set(key,(counts.get(key)??0)+1);}
  const rows:MatchRow[]=bill.lines.map(line=>{
    const result=(status:MatchStatus,reason:string,shipment?:ReconciliationShipment):MatchRow=>({line,status,reason,shipment});
    const tracking=trackingKey(line.tracking);
    if(!tracking)return result('missing_tracking','Read and enter this consignment number from the original bill.');
    if((counts.get(tracking)??0)>1)return result('duplicate','This consignment number appears more than once on this bill. Verify a duplicate or separate charge with the courier.');
    if(!validDate(line.sent)||cents(line.amount)===null||Number(line.amount)<0||(line.totalIncludingTax!=null&&line.totalIncludingTax<0)||!line.destination.trim())return result('invalid_line','Confirm the dispatch date, destination and freight amount from the original line.');
    if(line.sent<bill.periodFrom||line.sent>bill.periodTo)return result('date_difference','The bill line falls outside the selected billing period.');
    const candidates=shipments.filter(s=>courierKey(s.courier)===courierKey(bill.courier)&&trackingKey(s.tracking??'')===tracking);
    if(!candidates.length)return result('not_found','No courier and consignment match. Search the dispatch register; names alone are not an automatic match.');
    if(candidates.length>1)return result('ambiguous','More than one register entry has this courier and consignment number. Resolve it before approval.');
    const shipment=candidates[0];
    if(shipment.reconciledInvoiceNumber&&shipment.reconciledInvoiceNumber!==bill.invoiceNumber)return result('already_billed','This dispatch has already been linked to another monthly invoice. Check for double billing.',shipment);
    if(shipment.sent!==line.sent)return result('date_difference','Consignment matches, but the dispatch date differs. Check the booking receipt.',shipment);
    const destination=line.destination.trim().toLowerCase(),city=(shipment.city??'').trim().toLowerCase();
    if(city&&city!==destination)return result('destination_difference','Consignment matches, but the destination differs from the register. Check spelling or routing before approval.',shipment);
    const recorded=cents(shipment.cost),billed=cents(line.totalIncludingTax);
    if(recorded!==null&&billed!==null&&recorded!==billed)return result('cost_difference','The recorded GST-inclusive charge differs from the bill line GST-inclusive total.',shipment);
    return result('matched',recorded===null?'Consignment and date matched. Charge will come from the approved bill.':billed===null?'Consignment and date matched. Invoice-level GST and fuel are checked separately; no like-for-like line cost comparison is available.':'Consignment, date and GST-inclusive charge matched.',shipment);
  });
  const billedTracking=new Set(bill.lines.map(l=>trackingKey(l.tracking)).filter(Boolean));
  const unbilled=shipments.filter(s=>(!s.reconciledInvoiceNumber||s.reconciledInvoiceNumber===bill.invoiceNumber)&&courierKey(s.courier)===courierKey(bill.courier)&&s.sent>=bill.periodFrom&&s.sent<=bill.periodTo&&(!s.tracking||!billedTracking.has(trackingKey(s.tracking))));
  const matched=rows.filter(r=>r.status==='matched').length;
  const unresolved=rows.length-matched;
  return {rows,matched,unresolved,unbilled,issues,lineSum:lineSum/100,lineDifference:lineDifference===null?null:lineDifference/100,calculatedTotal:calculated===null?null:calculated/100,totalDifference:totalDifference===null?null:totalDifference/100,
    canApprove:rows.length>0&&unresolved===0&&unbilled.length===0&&issues.length===0&&bill.warnings.length===0};
}
export function dispatchReadiness(shipments: ReconciliationShipment[], from='2026-11-01', to='2026-11-30') {
  const rows=shipments.filter(s=>s.sent>=from&&s.sent<=to&&!['handdelivered'].includes(courierKey(s.courier)));
  return {total:rows.length,missingTracking:rows.filter(s=>!s.tracking?.trim()).length,missingCourier:rows.filter(s=>!s.courier||courierKey(s.courier)==='notrecorded').length,
    missingRecipientDetails:rows.filter(s=>!s.recipientName?.trim()||!s.address?.trim()||!s.city?.trim()).length,missingSender:rows.filter(s=>!s.onBehalfOf?.trim()).length,
    ready:rows.filter(s=>s.tracking?.trim()&&['professional','dtdc','dhl'].includes(courierKey(s.courier))&&s.recipientName?.trim()&&s.address?.trim()&&s.city?.trim()&&s.onBehalfOf?.trim()).length};
}
