import type {CourierBill} from './courier-reconciliation';

// Manually transcribed excerpts from supplied scans. No historical dates are shifted to November.
export function sampleBill(key:string): CourierBill {
  const header={currency:'INR',invoiceDate:'2026-10-01',periodFrom:'2026-09-01',periodTo:'2026-09-30',igst:0,other:0};
  if(key==='dtdc')return {...header,courier:'DTDC',invoiceNumber:'SLM/FR/1237',billedTo:'MSP Coffee, Salem',subtotal:19940,fuel:0,cgst:1794.60,sgst:1794.60,rounding:0,total:23529,
    sourceLabel:'DDTC Courier.pdf · page 1, rows 1–5 · excerpt of 77 rows',
    warnings:['Only five line items have been transcribed for this preview. Read all 77 lines before approval.','The printed subtotal and GST calculate to ₹23,529.20, while the printed grand total is ₹23,529.00. Confirm the rounding on the original bill. Handwritten payment deductions are not applied.'],
    lines:[['7X118303330','GURGAON',180],['7X118303331','GURGAON',180],['7X118303332','NOIDA',150],['7X118303333','PALAMPUR',150],['7X118303334','GURGAON',180]].map(([tracking,destination,amount],i)=>({id:'dtdc-'+i,tracking:String(tracking),sent:'2026-09-01',destination:String(destination),amount:Number(amount)}))};
  return {...header,courier:'Professional Courier',invoiceNumber:'SINV823087',billedTo:'MSP Coffee P Ltd, Moganad Estate, Yercaud',subtotal:2180,fuel:436,cgst:78.04,sgst:78.04,rounding:-0.08,total:2772,
    sourceLabel:'Professional Courier Bill.pdf · page 2 · 3 parcel lines from a 12-line invoice',
    warnings:['This preview includes the three TPC parcel lines only. The nine GTA lines on page 3 must be read before approval.','The abstract heading says August 2026, while the cover and line dates say September 2026. Confirm the period from the original invoice.'],
    lines:[{id:'tpc-1',tracking:'SLM408430510',sent:'2026-09-09',destination:'MAA',amount:50},{id:'tpc-2',tracking:'SLM409471590',sent:'2026-09-28',destination:'BTU',amount:55},{id:'tpc-3',tracking:'SLM409057326',sent:'2026-09-21',destination:'MHP',amount:57}]};
}
