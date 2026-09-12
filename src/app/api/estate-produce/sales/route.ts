import { NextResponse } from 'next/server';
import {
  ESTATES,
  ESTATE_PRODUCE_RECORD_ID_RE,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  SALE_TYPES,
  badRequest,
  estateProduceSetupError,
  nullableText,
  numberValue,
  requireEstateProduceUser,
  text,
} from '../_helpers';

type SaleRow = Record<string, unknown>;
type CustomerRow = Record<string, unknown>;
type StoreItemRow = {
  id: string;
  estate: string;
  product: string;
  unit: string;
  quantity: number;
  weight_kg: number;
  status: string;
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function mapSale(row: SaleRow) {
  return {
    id: text(row.id),
    date: text(row.sale_date),
    buyerName: text(row.buyer_name),
    buyerPhone: text(row.buyer_phone),
    buyerAddress: text(row.buyer_address),
    dispatchMethod: text(row.dispatch_method),
    batchId: text(row.store_item_id),
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
      'buyer_address',
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
    .select('id, phone, name, address, default_dispatch_method, default_payment_mode, last_sale_at')
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
  const buyerName = text(body.buyerName) || 'Walk-in Buyer';
  const buyerPhone = normalizePhone(text(body.buyerPhone));
  const buyerAddress = text(body.buyerAddress);
  const dispatchMethod = text(body.dispatchMethod) || 'By Courier Service';
  const saleType = text(body.saleType) || 'Charged Sale';
  const paymentMode = text(body.paymentMode) || 'Bank';
  const paymentStatusInput = text(body.paymentStatus) || 'Pending';
  const piecesSold = numberValue(body.piecesSold);
  const weightSoldKg = numberValue(body.weightSoldKg);
  const ratePerKg = saleType === 'Charged Sale' ? numberValue(body.ratePerKg) : 0;
  const courierPacking = numberValue(body.courierPacking);
  const produceAmount = saleType === 'Charged Sale' ? weightSoldKg * ratePerKg : 0;
  const totalAmount = produceAmount + courierPacking;
  const paymentStatus = saleType === 'Charged Sale' ? paymentStatusInput : 'Paid';

  if (!ESTATE_PRODUCE_RECORD_ID_RE.test(storeItemId)) return badRequest('Choose a valid produce store item');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return badRequest('Enter a valid sale date');
  if (!SALE_TYPES.includes(saleType)) return badRequest('Choose a valid sale type');
  if (!PAYMENT_MODES.includes(paymentMode)) return badRequest('Choose a valid payment mode');
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return badRequest('Choose a valid payment status');

  const { data: storeItem, error: storeError } = await auth.supabase
    .from('produce_store_items')
    .select('id, estate, product, unit, quantity, weight_kg, status')
    .eq('id', storeItemId)
    .single<StoreItemRow>();

  if (storeError) return NextResponse.json({ error: estateProduceSetupError(storeError.message) }, { status: 500 });
  if (!storeItem) return NextResponse.json({ error: 'Produce store item was not found' }, { status: 404 });
  if (!ESTATES.includes(storeItem.estate)) return badRequest('Store item estate is not valid');
  if (storeItem.status === 'Sold') return badRequest('This produce store item is already sold');
  if (piecesSold > numberValue(storeItem.quantity) || weightSoldKg > numberValue(storeItem.weight_kg)) {
    return badRequest('Sale quantity is more than available store stock');
  }

  let customerId: string | null = null;
  if (buyerPhone) {
    const { data: customer, error: customerError } = await auth.supabase
      .from('produce_customers')
      .upsert({
        phone: buyerPhone,
        name: buyerName,
        address: buyerAddress || null,
        default_dispatch_method: dispatchMethod,
        default_payment_mode: paymentMode,
        last_sale_at: new Date().toISOString(),
        updated_by: auth.user.id,
        created_by: auth.user.id,
        created_by_name: auth.user.name,
      }, { onConflict: 'phone' })
      .select('id')
      .single<{ id: string }>();

    if (customerError) return NextResponse.json({ error: estateProduceSetupError(customerError.message) }, { status: 500 });
    customerId = customer?.id ?? null;
  }

  const { data: sale, error: saleError } = await auth.supabase
    .from('produce_sales')
    .insert([{
      store_item_id: storeItem.id,
      customer_id: customerId,
      sale_date: saleDate,
      buyer_name: buyerName,
      buyer_phone: buyerPhone || null,
      buyer_address: buyerAddress || null,
      dispatch_method: dispatchMethod,
      estate: storeItem.estate,
      product: storeItem.product,
      pieces_sold: piecesSold,
      weight_sold_kg: weightSoldKg,
      rate_per_kg: ratePerKg,
      produce_amount: produceAmount,
      courier_packing: courierPacking,
      total_amount: totalAmount,
      sale_type: saleType,
      payment_status: paymentStatus,
      payment_mode: paymentMode,
      payment_notes: nullableText(body.paymentNotes),
      notes: nullableText(body.notes),
      closed_at: paymentStatus === 'Paid' ? new Date().toISOString() : null,
      created_by: auth.user.id,
      created_by_name: auth.user.name,
      updated_by: auth.user.id,
    }])
    .select('*')
    .single<SaleRow>();

  if (saleError) return NextResponse.json({ error: estateProduceSetupError(saleError.message) }, { status: 500 });

  const { error: itemError } = await auth.supabase
    .from('produce_store_items')
    .update({
      status: 'Sold',
      updated_by: auth.user.id,
      notes: nullableText(body.notes) || `Sale recorded for ${buyerName}`,
    })
    .eq('id', storeItem.id);

  if (itemError) return NextResponse.json({ error: estateProduceSetupError(itemError.message) }, { status: 500 });

  await auth.supabase.from('produce_store_movements').insert([{
    store_item_id: storeItem.id,
    movement_type: 'Status Change',
    from_status: storeItem.status,
    to_status: 'Sold',
    notes: `${saleType} invoice for ${buyerName} on ${saleDate}.`,
    actor_id: auth.user.id,
    actor_name: auth.user.name,
  }]);

  return NextResponse.json({ sale: mapSale(sale) });
}
