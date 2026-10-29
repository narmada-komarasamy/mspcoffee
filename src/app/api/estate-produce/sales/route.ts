import { NextResponse } from 'next/server';
import { validBuyerEmail, isInternalUse } from '@/lib/produce-sales';
import {
  ESTATE_PRODUCE_RECORD_ID_RE,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  SALE_TYPES,
  badRequest,
  estateProduceSetupError,
  numberValue,
  requireEstateProduceUser,
  text,
} from '../_helpers';

type SaleRow = Record<string, unknown>;
type CustomerRow = Record<string, unknown>;

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function mapSale(row: SaleRow) {
  return {
    id: text(row.id),
    date: text(row.sale_date),
    buyerName: text(row.buyer_name),
    buyerPhone: text(row.buyer_phone),
    buyerEmail: text(row.buyer_email),
    buyerAddress: text(row.buyer_address),
    recipientName: text(row.recipient_name),
    dispatchMethod: text(row.dispatch_method),
    batchId: text(row.store_item_id),
    itemCode: text(row.store_item_code),
    estate: text(row.estate),
    product: text(row.product),
    piecesSold: numberValue(row.pieces_sold),
    weightSoldKg: numberValue(row.weight_sold_kg),
    ratePerKg: numberValue(row.rate_per_kg),
    produceAmount: numberValue(row.produce_amount),
    courierPacking: numberValue(row.courier_packing),
    totalAmount: numberValue(row.total_amount),
    saleType: text(row.sale_type) || 'Charged Sale',
    paymentStatus: text(row.payment_status) || 'Pending',
    paymentMode: text(row.payment_mode) || 'Bank',
    paymentNotes: text(row.payment_notes),
    notes: text(row.notes),
    closedAt: text(row.closed_at) || undefined,
    createdAt: text(row.created_at),
  };
}

function mapCustomer(row: CustomerRow) {
  return {
    id: text(row.id),
    phone: text(row.phone),
    email: text(row.email),
    name: text(row.name),
    address: text(row.address),
    defaultDispatchMethod: text(row.default_dispatch_method),
    defaultPaymentMode: text(row.default_payment_mode),
    lastSaleAt: text(row.last_sale_at),
  };
}

export async function GET(request: Request) {
  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const { data: sales, error: salesError } = await auth.supabase
    .from('produce_sales')
    .select([
      'id',
      'store_item_id',
      'sale_date',
      'buyer_name',
      'buyer_phone',
      'buyer_email',
      'store_item_code',
      'buyer_address',
      'recipient_name',
      'dispatch_method',
      'estate',
      'product',
      'pieces_sold',
      'weight_sold_kg',
      'rate_per_kg',
      'produce_amount',
      'courier_packing',
      'total_amount',
      'sale_type',
      'payment_status',
      'payment_mode',
      'payment_notes',
      'notes',
      'closed_at',
      'created_at',
    ].join(', '))
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (salesError) return NextResponse.json({ error: estateProduceSetupError(salesError.message) }, { status: 500 });

  const { data: customers, error: customersError } = await auth.supabase
    .from('produce_customers')
    .select('id, phone, email, name, address, default_dispatch_method, default_payment_mode, last_sale_at')
    .order('last_sale_at', { ascending: false, nullsFirst: false })
    .limit(500);

  if (customersError) return NextResponse.json({ error: estateProduceSetupError(customersError.message) }, { status: 500 });

  return NextResponse.json({
    sales: ((sales ?? []) as unknown as SaleRow[]).map(mapSale),
    customers: ((customers ?? []) as CustomerRow[]).map(mapCustomer),
  });
}

export async function POST(request: Request) {
  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Sale details are required');

  const storeItemId = text(body.batchId);
  const saleDate = text(body.date);
  const saleType = text(body.saleType) || 'Charged Sale';
  const internal = isInternalUse(saleType);
  const recipient = text(body.recipientName);
  const buyerEmail = internal ? '' : text(body.buyerEmail);
  const paymentMode = text(body.paymentMode) || 'Bank';
  const paymentStatus = saleType === 'Charged Sale' ? text(body.paymentStatus) || 'Pending' : 'Paid';
  const piecesSold = Number(body.piecesSold);
  const weightSoldKg = Number(body.weightSoldKg);
  const rate = Number(body.ratePerKg ?? 0);
  const courier = Number(body.courierPacking ?? 0);

  if (!ESTATE_PRODUCE_RECORD_ID_RE.test(storeItemId)) return badRequest('Choose a valid produce store item');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || Number.isNaN(Date.parse(saleDate)) || new Date(saleDate).toISOString().slice(0, 10) !== saleDate) return badRequest('Enter a valid sale date');
  if (!SALE_TYPES.includes(saleType)) return badRequest('Choose a valid sale type');
  if (!PAYMENT_MODES.includes(paymentMode)) return badRequest('Choose a valid payment mode');
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return badRequest('Choose a valid payment status');
  if (!validBuyerEmail(buyerEmail)) return badRequest('Enter a valid buyer email address, or leave it blank');
  if (internal && !recipient) return badRequest('Enter the person receiving the fruit');
  if (![piecesSold, weightSoldKg, rate, courier].every(value => Number.isFinite(value) && value >= 0) || (piecesSold === 0 && weightSoldKg === 0)) return badRequest('Enter valid quantities and charges; at least one quantity must be greater than zero');

  // The database locks the token and saves the record, customer and stock movement
  // in one transaction. A failed save cannot deduct stock, and concurrent requests
  // cannot both claim the same remaining fruit.
  const { data, error } = await auth.supabase.rpc('record_produce_sale', { p_payload: {
    store_item_id: storeItemId,
    sale_date: saleDate,
    sale_type: saleType,
    recipient_name: internal ? recipient : '',
    buyer_name: internal ? recipient : text(body.buyerName) || 'Walk-in Buyer',
    buyer_phone: internal ? '' : normalizePhone(text(body.buyerPhone)),
    buyer_email: buyerEmail,
    email_supplied: Object.hasOwn(body, 'buyerEmail'),
    buyer_address: internal ? '' : text(body.buyerAddress),
    dispatch_method: internal ? 'Internal use' : text(body.dispatchMethod) || 'By Courier Service',
    pieces_sold: piecesSold,
    weight_sold_kg: weightSoldKg,
    rate_per_kg: saleType === 'Charged Sale' ? rate : 0,
    courier_packing: internal ? 0 : courier,
    payment_status: paymentStatus,
    payment_mode: paymentMode,
    payment_notes: internal ? '' : text(body.paymentNotes),
    notes: text(body.notes),
    actor_id: auth.user.id,
    actor_name: auth.user.name,
  } });
  if (error) {
    const inputError = error.code === 'P0001' || error.code === '23514';
    return NextResponse.json({ error: inputError ? error.message : estateProduceSetupError(error.message) }, { status: inputError ? 400 : 500 });
  }
  return NextResponse.json({ sale: mapSale(data as SaleRow) });
}
