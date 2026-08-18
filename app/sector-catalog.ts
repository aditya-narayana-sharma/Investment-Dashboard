export type SectorCatalogEntry = {
  id: string;
  name: string;
  color: string;
};

/** Canonical S-2 / S-3 industry identity. Every sectoral surface must use this list. */
export const SECTOR_CATALOG = [
  { id: "it", name: "IT / Tech", color: "#4c8fff" },
  { id: "pharma", name: "Pharma", color: "#52d6a3" },
  { id: "power", name: "Power", color: "#ffd166" },
  { id: "infrastructure", name: "Infrastructure", color: "#ff9f6e" },
  { id: "auto", name: "Auto", color: "#64b5ff" },
  { id: "telecom", name: "Telecom", color: "#b794f6" },
  { id: "banking", name: "Banking", color: "#4f8cff" },
  { id: "nbfc", name: "NBFC", color: "#35c2d6" },
  { id: "fmcg", name: "FMCG", color: "#f58fd2" },
  { id: "consumer", name: "Consumer", color: "#ff7b87" },
  { id: "energy", name: "Energy", color: "#f3a83b" },
  { id: "metals", name: "Metals", color: "#9aa6b2" },
  { id: "defence", name: "Defence", color: "#e76f51" },
] as const satisfies readonly SectorCatalogEntry[];

export type SectorCatalogId = (typeof SECTOR_CATALOG)[number]["id"];

export const sectorCatalogIds: readonly SectorCatalogId[] = SECTOR_CATALOG.map((sector) => sector.id);

export function assertCatalogIds(ids: readonly string[], label: string) {
  if (ids.length !== sectorCatalogIds.length || ids.some((id, index) => id !== sectorCatalogIds[index])) {
    throw new Error(`${label} must match sectorCatalogIds in order`);
  }
}
