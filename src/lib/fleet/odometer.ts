type OdometerRow = {
  id?: number;
  vehicle_id: string;
  date: string;
  closing_km: number | string | null;
};

const vehicleKey = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "");

// Same-day entries and future readings cannot be the previous day's closing KM.
export function previousOdometerRow<T extends OdometerRow>(rows: T[], vehicle: string, date: string): T | null {
  const key = vehicleKey(vehicle);
  if (!key || !date) return null;
  let previous: T | null = null;
  for (const row of rows) {
    const km = Number(row.closing_km);
    if (vehicleKey(row.vehicle_id) !== key || row.date >= date || !Number.isFinite(km) || km <= 0) continue;
    if (!previous || row.date > previous.date || (row.date === previous.date && (row.id ?? 0) > (previous.id ?? 0))) previous = row;
  }
  return previous;
}

export function startingKmFor(rows: OdometerRow[], vehicle: string, date: string) {
  const previous = previousOdometerRow(rows, vehicle, date);
  return previous ? Number(previous.closing_km) : 0;
}
