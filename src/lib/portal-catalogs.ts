import type { PortalArea, PortalUnit } from "@/types/initiative";

export const DEFAULT_AREAS: PortalArea[] = [
  { id: "operations", name: "Operaciones", active: true, sortOrder: 10 },
  { id: "human-resources", name: "Recursos Humanos", active: true, sortOrder: 20 },
  { id: "purchasing", name: "Compras", active: true, sortOrder: 30 },
  { id: "inventory", name: "Inventario", active: true, sortOrder: 40 },
  { id: "finance", name: "Finanzas", active: true, sortOrder: 50 },
  { id: "public-relations", name: "Relaciones Públicas", active: true, sortOrder: 60 },
  { id: "marketing", name: "Marketing", active: true, sortOrder: 70 },
  { id: "technology-systems", name: "Tecnología y Sistemas", active: true, sortOrder: 80 },
];

export const DEFAULT_UNITS: PortalUnit[] = [
  { id: "htl", code: "HTL", name: "Hot Tacos Leamington", active: true, sortOrder: 10 },
  { id: "htw", code: "HTW", name: "Hot Tacos Windsor", active: true, sortOrder: 20 },
  { id: "htft", code: "HTFT", name: "Hot Tacos Food Truck", active: true, sortOrder: 30 },
];

export function mergeCatalog<T extends { id: string }>(defaults: T[], stored: T[]) {
  const items = new Map(defaults.map((item) => [item.id, item]));
  stored.forEach((item) => items.set(item.id, item));
  return [...items.values()];
}

