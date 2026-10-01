"use client";

import { useState, type FormEvent } from "react";

import type { PortalArea, PortalUnit } from "@/types/initiative";

interface CatalogModalProps {
  areas: PortalArea[];
  units: PortalUnit[];
  onClose: () => void;
  onSaveArea: (area: PortalArea) => Promise<void>;
  onSaveUnit: (unit: PortalUnit) => Promise<void>;
}

export function CatalogModal({
  areas,
  units,
  onClose,
  onSaveArea,
  onSaveUnit,
}: CatalogModalProps) {
  const [tab, setTab] = useState<"areas" | "units">("areas");
  const [areaName, setAreaName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!areaName.trim()) return;
    setSaving(true);
    try {
      await onSaveArea({
        id: crypto.randomUUID(),
        name: areaName.trim(),
        active: true,
        sortOrder: (areas.at(-1)?.sortOrder ?? 0) + 10,
      });
      setAreaName("");
    } finally {
      setSaving(false);
    }
  }

  async function addUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = unitCode.trim().toUpperCase();
    if (!code || !unitName.trim()) return;
    setSaving(true);
    try {
      await onSaveUnit({
        id: crypto.randomUUID(),
        code,
        name: unitName.trim(),
        active: true,
        sortOrder: (units.at(-1)?.sortOrder ?? 0) + 10,
      });
      setUnitCode("");
      setUnitName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card catalog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Configuración</p>
            <h2 id="catalog-title">Catálogos del portal</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="catalog-tabs" role="tablist">
          <button className={tab === "areas" ? "active" : ""} type="button" onClick={() => setTab("areas")}>Áreas</button>
          <button className={tab === "units" ? "active" : ""} type="button" onClick={() => setTab("units")}>Unidades y sucursales</button>
        </div>

        {tab === "areas" ? (
          <div className="catalog-panel">
            <p className="catalog-help">Las áreas inactivas dejan de aparecer en iniciativas nuevas, pero permanecen en el historial.</p>
            <div className="catalog-list">
              {areas.map((area) => (
                <div className="catalog-row" key={area.id}>
                  <div><strong>{area.name}</strong><small>{area.active ? "Activa" : "Inactiva"}</small></div>
                  <label className="switch"><input type="checkbox" checked={area.active} onChange={() => void onSaveArea({ ...area, active: !area.active })} /><span /></label>
                </div>
              ))}
            </div>
            <form className="catalog-add" onSubmit={addArea}>
              <label className="field"><span>Nueva área</span><input required value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="Ej. Legal y cumplimiento" /></label>
              <button className="button button-primary" type="submit" disabled={saving}>Agregar área</button>
            </form>
          </div>
        ) : (
          <div className="catalog-panel">
            <p className="catalog-help">Agrega nuevas sucursales, conceptos o unidades operativas sin cambiar el código.</p>
            <div className="catalog-list">
              {units.map((unit) => (
                <div className="catalog-row" key={unit.id}>
                  <div><strong><span className="unit-code">{unit.code}</span>{unit.name}</strong><small>{unit.active ? "Activa" : "Inactiva"}</small></div>
                  <label className="switch"><input type="checkbox" checked={unit.active} onChange={() => void onSaveUnit({ ...unit, active: !unit.active })} /><span /></label>
                </div>
              ))}
            </div>
            <form className="catalog-add unit-add" onSubmit={addUnit}>
              <label className="field"><span>Código</span><input required maxLength={12} value={unitCode} onChange={(event) => setUnitCode(event.target.value)} placeholder="Ej. HTT" /></label>
              <label className="field"><span>Nombre</span><input required value={unitName} onChange={(event) => setUnitName(event.target.value)} placeholder="Ej. Hot Tacos Toronto" /></label>
              <button className="button button-primary" type="submit" disabled={saving}>Agregar unidad</button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
