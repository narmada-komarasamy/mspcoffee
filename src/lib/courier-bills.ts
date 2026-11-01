import type {CourierBill} from './courier-reconciliation';
export type SavedCourierBill={id:string;invoice:CourierBill;status:'draft'|'approved'|'paid';version:number;original_path:string;original_hash:string;created_by:string;created_at:string;approved_by:string|null;approved_at:string|null;approval_snapshot:unknown};
export type CourierPayment={id:string;bill_id:string;paid_on:string;amount:number;deduction:number;deduction_reason:string;method:string;reference:string;recorded_by:string};
export function validatePayment(input:Record<string,unknown>,total:number){
 const date=typeof input.paidOn==='string'?input.paidOn:'';
 const amount=Number(input.amount),deduction=input.deduction===''||input.deduction==null?0:Number(input.deduction);
 const reason=typeof input.deductionReason==='string'?input.deductionReason.trim().slice(0,2000):'';
 const method=typeof input.method==='string'?input.method:'';
 const reference=typeof input.reference==='string'?input.reference.trim().slice(0,200):'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Enter the actual payment date.');
 if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(deduction)||deduction<0||Math.abs(amount*100-Math.round(amount*100))>0.00001||Math.abs(deduction*100-Math.round(deduction*100))>0.00001||Math.round((amount+deduction)*100)!==Math.round(total*100))throw new Error('Payment plus any documented deduction must settle the full bill.');
 if(deduction>0&&reason.length<10)throw new Error('Explain the deduction; deductions are never calculated automatically.');
 if(!['Bank transfer','Cheque','Cash','Other'].includes(method)||reference.length<3)throw new Error('Enter a payment method and transaction or voucher reference.');
 return {date,amount,deduction,reason,method,reference};
}
export function originalFileType(bytes:Uint8Array,mime:string){
 if(mime==='application/pdf')return Buffer.from(bytes.slice(0,5)).toString('ascii')==='%PDF-';
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(mime==='image/webp')return Buffer.from(bytes.slice(0,4)).toString('ascii')==='RIFF'&&Buffer.from(bytes.slice(8,12)).toString('ascii')==='WEBP';
 return false;
}
