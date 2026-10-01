"use client";

import { useMemo, useState, type FormEvent } from "react";

import type {
  InitiativeDraft,
  InitiativeScopeType,
  PortalArea,
  PortalUnit,
} from "@/types/initiative";

interface InitiativeModalProps {
  monthKey: string;
  areas: PortalArea[];
  units: PortalUnit[];
  initialScopeType?: InitiativeScopeType;
  initialUnitIds?: string[];
  onClose: () => void;
  onSubmit: (draft: InitiativeDraft) => Promise<void>;
}

export function InitiativeModal({
  monthKey,
  areas,
  units,
  initialScopeType = "brand",
  initialUnitIds = [],
  onClose,
  onSubmit,
}: InitiativeModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(`${monthKey}-01`);
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const [scopeType, setScopeType] = useState<InitiativeScopeType>(initialScopeType);
  const [selectedUnits, setSelectedUnits] = useState<string[]>(initialUnitIds);
  const activeAreas = areas.filter((area) => area.active);
  const activeUnits = units.filter((unit) => unit.active);
  const [selected, setSelected] = useState<string[]>(
    activeAreas.length ? [activeAreas[0].id] : [],
  );
  const [saving, setSaving] = useState(false);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
        new Date(`${monthKey}-02T12:00:00`),
      ),
    [monthKey],
  );

  function toggleDepartment(areaId: string) {
    setSelected((current) =>
      current.includes(areaId)
        ? current.filter((item) => item !== areaId)
        : [...current, areaId],
    );
  }

  function toggleUnit(unitId: string) {
    setSelectedUnits((current) =>
      current.includes(unitId)
        ? current.filter((item) => item !== unitId)
        : [...current, unitId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !title.trim() ||
      !owner.trim() ||
      selected.length === 0 ||
      (scopeType === "units" && selectedUnits.length === 0)
    ) return;

    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        eventDate,
        monthKey: eventDate.slice(0, 7),
        location: location.trim(),
        owner: owner.trim(),
        status: "notified",
        scopeType,
        unitIds: scopeType === "brand" ? [] : selectedUnits,
        areas: selected
          .map((areaId) => areas.find((area) => area.id === areaId))
          .filter((area): area is PortalArea => Boolean(area))
          .map((area) => ({
            id: crypto.randomUUID(),
            catalogAreaId: area.id,
            name: area.name,
            status: "notified",
            tasks: [],
          })),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-initiative-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{monthLabel}</p>
            <h2 id="new-initiative-title">Nueva iniciativa</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="initiative-form">
          <label className="field field-wide">
            <span>Nombre de la iniciativa *</span>
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Food Truck en Windsor Eats"
            />
          </label>

          <fieldset className="departments field-wide">
            <legend>Alcance de la iniciativa *</legend>
            <div className="scope-options">
              <label className="scope-card">
                <input type="radio" name="scope" checked={scopeType === "brand"} onChange={() => setScopeType("brand")} />
                <span><strong>Toda la marca</strong><small>Aplica globalmente a Hot Tacos</small></span>
              </label>
              <label className="scope-card">
                <input type="radio" name="scope" checked={scopeType === "units"} onChange={() => setScopeType("units")} />
                <span><strong>Unidades específicas</strong><small>Una o varias sucursales o conceptos</small></span>
              </label>
            </div>
            {scopeType === "units" && (
              <div className="unit-picker">
                {activeUnits.map((unit) => (
                  <label className="check-card" key={unit.id}>
                    <input type="checkbox" checked={selectedUnits.includes(unit.id)} onChange={() => toggleUnit(unit.id)} />
                    <span><strong>{unit.code}</strong><small>{unit.name}</small></span>
                  </label>
                ))}
                {activeUnits.length === 0 && <p className="catalog-help">No hay unidades activas. Agrégalas desde Catálogos.</p>}
              </div>
            )}
          </fieldset>

          <label className="field">
            <span>Fecha *</span>
            <input
              required
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Responsable general *</span>
            <input
              required
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="Nombre"
            />
          </label>

          <label className="field field-wide">
            <span>Ubicación</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ej. Downtown Windsor"
            />
          </label>

          <label className="field field-wide">
            <span>Descripción</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Objetivo, contexto y resultado esperado"
            />
          </label>

          <fieldset className="departments field-wide">
            <legend>Áreas involucradas *</legend>
            <div className="department-grid">
              {activeAreas.map((area) => (
                <label className="check-card" key={area.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(area.id)}
                    onChange={() => toggleDepartment(area.id)}
                  />
                  <span>{area.name}</span>
                </label>
              ))}
            </div>
            {activeAreas.length === 0 && <p className="catalog-help">No hay áreas activas. Agrégalas desde Catálogos.</p>}
          </fieldset>

          <div className="modal-actions field-wide">
            <button className="button button-secondary" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear iniciativa"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
