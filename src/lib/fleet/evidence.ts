import { fleetVehicleKey } from './maintenance';

export const PHOTO_BUCKET = 'fleet-entry-photos';
// Two base64 images still fit the hosting limit during extraction.
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export type PhotoKind = 'fuel' | 'odometer';
export function photoFilesError(files: { size: number; type: string }[]) {
  if (!files.length) return 'Choose an odometer or fuel bill photo.';
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size)) return 'Choose non-empty JPG, PNG or WebP photos.';
  if (files.reduce((total, file) => total + file.size, 0) > MAX_PHOTO_BYTES) return 'The photos must total 3 MB or less. Choose smaller images.';
  return '';
}
export function photoSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value);
  return type === 'image/webp' && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
}
export function fleetRowKey(row: { vehicle_id: string; date: string }) {
  return `${fleetVehicleKey(row.vehicle_id)}|${row.date}`;
}
export function cleanFleetEntry(input: Record<string, unknown>) {
  const text = (key: string) => typeof input[key] === 'string' ? input[key].trim() : '';
  const date = text('date'), vehicle = text('vehicle_id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || !fleetVehicleKey(vehicle) || vehicle.length > 128) throw Error('A valid date and full vehicle number are required.');
  if (!['Estate','Personal'].includes(text('vehicle_type')) || !['BVE','HFE','ME','ORE','RSE','SE'].includes(text('account')) || !['Diesel','Petrol'].includes(text('fuel_type'))) throw Error('Check the vehicle type, account and fuel type.');
  const values: Record<string, number> = {};
  for (const key of ['starting_km','closing_km','fuel_filled_l','fuel_cost','maint_cost']) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || Number(input[key]) < 0 || Number(input[key]) > 1e10) throw Error('KM, litres and costs must be valid non-negative numbers.');
    values[key] = input[key] as number;
  }
  if (values.closing_km < values.starting_km && values.closing_km !== 0) throw Error('Closing KM cannot be below Starting KM.');
  const km = Math.max(0, values.closing_km - values.starting_km), total = values.fuel_cost + values.maint_cost;
  return { date, vehicle_id:vehicle, vehicle_type:text('vehicle_type'), account:text('account'), fuel_type:text('fuel_type'),
    month:Number(date.slice(5,7)),year:Number(date.slice(0,4)),...values,km_run:km,total_cost:total,
    avg_mileage:values.fuel_filled_l > 0 ? Number((km / values.fuel_filled_l).toFixed(2)) : 0,
    cost_per_km:km > 0 ? Number((total / km).toFixed(2)) : 0,
    maintenance_performed:text('maintenance_performed').slice(0,10000), remarks:text('remarks').slice(0,10000),
  };
}
