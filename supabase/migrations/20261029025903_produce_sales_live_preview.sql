-- Store customer emails and snapshot the selected produce token on each invoice.
alter table public.produce_customers add column if not exists email text not null default '';
alter table public.produce_sales
  add column if not exists buyer_email text not null default '',
  add column if not exists store_item_code text not null default '';

-- Preserve token references for existing invoices while store items are still linked.
update public.produce_sales as sale
set store_item_code = item.item_code
from public.produce_store_items as item
where sale.store_item_id = item.id and sale.store_item_code = '';
