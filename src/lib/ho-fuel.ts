/** Use the transaction date, never imported month/year fields, for reporting. */
export function fuelPeriod(date: string) {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

export function hoFuelToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

type FuelTransaction = { date: string; fuel_type: string; transaction_type: string; qty_l: number; amount: number };

export function currentFuelRows<T extends FuelTransaction>(rows: T[], asOf: string) {
  return rows.filter(row => row.date <= asOf);
}

export function fuelTotals(rows: FuelTransaction[]) {
  let dP = 0, dI = 0, pP = 0, pI = 0, amt = 0;
  for (const row of rows) {
    const qty = Number(row.qty_l);
    if (row.transaction_type === 'PURCHASE') {
      if (row.fuel_type === 'DIESEL') dP += qty;
      if (row.fuel_type === 'PETROL') pP += qty;
      amt += Number(row.amount);
    } else if (row.transaction_type === 'ISSUE') {
      if (row.fuel_type === 'DIESEL') dI += qty;
      if (row.fuel_type === 'PETROL') pI += qty;
    }
  }
  return { dP, dI, pP, pI, amt, dieselStock: dP - dI, petrolStock: pP - pI,
    totalPurchased: dP + pP, totalIssued: dI + pI };
}
