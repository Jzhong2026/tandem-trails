export const TRUCKS = {
  scania: { name: 'Scania 770 S', brand: 'SCANIA', badge: '770 S · V8' },
  volvo: { name: 'Volvo FH', brand: 'VOLVO', badge: 'FH' },
  sitrak: { name: '中国重汽 · 汕德卡 C7H', brand: 'SITRAK', badge: 'C7H' },
  man: { name: 'MAN TGX', brand: 'MAN', badge: 'TGX' },
} as const;
export type TruckId = keyof typeof TRUCKS;
export function isTruckId(value: unknown): value is TruckId {
  return typeof value === 'string' && Object.hasOwn(TRUCKS, value);
}
