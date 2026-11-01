import type {SavedCourierBill,CourierPayment} from './courier-bills';
import type {ReconciliationShipment} from './courier-reconciliation';
export type BillDispatchLink={line_id:string;shipment_id:string;shipment_snapshot:ReconciliationShipment};
function cell(value:unknown){const text=value==null?'':String(value);return '"'+(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';}
export function billReportCSV(bill:SavedCourierBill,payment:CourierPayment|null,links:BillDispatchLink[]){
 const inv=bill.invoice,byLine=new Map(links.map(l=>[l.line_id,l.shipment_snapshot]));
 const rows:unknown[][]=[['Courier bill reconciliation'],['Invoice',inv.invoiceNumber],['Courier',inv.courier],['Account',inv.billedTo],['Currency',inv.currency],['Period',inv.periodFrom,inv.periodTo],['Status',bill.status],['Approved at',bill.approved_at],['Approved by account',bill.approved_by],[],['Freight subtotal',inv.subtotal],['Fuel',inv.fuel],['CGST',inv.cgst],['SGST',inv.sgst],['IGST',inv.igst],['Other',inv.other],['Rounding',inv.rounding],['Invoice total',inv.total],[],['Payment date',payment?.paid_on],['Amount paid',payment?.amount],['Deduction',payment?.deduction],['Deduction reason',payment?.deduction_reason],['Payment method',payment?.method],['Payment reference',payment?.reference],[],['Line','Consignment','Sent date','Destination','Base freight','Printed tax inclusive total','Confirmed recipient','On behalf of']];
 for(const [i,l] of inv.lines.entries()){const ship=byLine.get(l.id);rows.push([i+1,l.tracking,l.sent,l.destination,l.amount,l.totalIncludingTax,ship?.recipientName,ship?.onBehalfOf]);}
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
