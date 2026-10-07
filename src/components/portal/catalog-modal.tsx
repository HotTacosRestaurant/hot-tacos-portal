"use client";

import { useState, type FormEvent } from "react";

import { getPortalErrorDetails } from "@/lib/firebase-errors";

import type { PortalArea, PortalPerson, PortalUnit } from "@/types/initiative";

export type CatalogTab = "areas" | "units" | "people";

interface CatalogModalProps {
  areas: PortalArea[];
  units: PortalUnit[];
  people: PortalPerson[];
  initialTab?: CatalogTab;
  onClose: () => void;
  onSaveArea: (area: PortalArea) => Promise<void>;
  onSaveUnit: (unit: PortalUnit) => Promise<void>;
  onSavePerson: (person: PortalPerson) => Promise<void>;
}

export function CatalogModal({
  areas,
  units,
  people,
  initialTab = "areas",
  onClose,
  onSaveArea,
  onSaveUnit,
  onSavePerson,
}: CatalogModalProps) {
  const [tab, setTab] = useState<CatalogTab>(initialTab);
  const [areaName, setAreaName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasUnsavedFormData = Boolean(
    areaName.trim() ||
      unitCode.trim() ||
      unitName.trim() ||
      personName.trim() ||
      personRole.trim() ||
      personPhone.trim() ||
      personEmail.trim(),
  );

  function requestClose() {
    if (saving) return;
    if (hasUnsavedFormData && !window.confirm("Hay información sin guardar. ¿Cerrar y descartarla?")) return;
    onClose();
  }

  async function runCatalogWrite(action: string, operation: () => Promise<void>) {
    setSaveError(null);
    setSaving(true);
    try {
      await operation();
      return true;
    } catch (error) {
      const details = getPortalErrorDetails(error);
      setSaveError(
        `${details.message} El cambio de ${action} NO se guardó. Código: ${details.code}.`,
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!areaName.trim()) return;
    const saved = await runCatalogWrite("área", () =>
      onSaveArea({
        id: crypto.randomUUID(),
        name: areaName.trim(),
        active: true,
        sortOrder: (areas.at(-1)?.sortOrder ?? 0) + 10,
      }),
    );
    if (saved) setAreaName("");
  }

  async function addUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = unitCode.trim().toUpperCase();
    if (!code || !unitName.trim()) return;
    const saved = await runCatalogWrite("unidad", () =>
      onSaveUnit({
        id: crypto.randomUUID(),
        code,
        name: unitName.trim(),
        active: true,
        sortOrder: (units.at(-1)?.sortOrder ?? 0) + 10,
      }),
    );
    if (saved) {
      setUnitCode("");
      setUnitName("");
    }
  }

  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!personName.trim()) return;
    const saved = await runCatalogWrite("persona", () =>
      onSavePerson({
        id: crypto.randomUUID(),
        name: personName.trim(),
        role: personRole.trim(),
        phone: personPhone.trim(),
        email: personEmail.trim(),
        active: true,
        sortOrder: (people.at(-1)?.sortOrder ?? 0) + 10,
      }),
    );
    if (saved) {
      setPersonName("");
      setPersonRole("");
      setPersonPhone("");
      setPersonEmail("");
    }
  }

  const visiblePeople = people.filter((person) =>
    `${person.name} ${person.role} ${person.phone} ${person.email}`
      .toLocaleLowerCase("es")
      .includes(peopleQuery.trim().toLocaleLowerCase("es")),
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={requestClose}>
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
          <button className="icon-button" type="button" onClick={requestClose} aria-label="Cerrar">×</button>
        </div>

        <div className="catalog-tabs" role="tablist">
          <button className={tab === "areas" ? "active" : ""} type="button" onClick={() => setTab("areas")}>Áreas</button>
          <button className={tab === "units" ? "active" : ""} type="button" onClick={() => setTab("units")}>Unidades y sucursales</button>
          <button className={tab === "people" ? "active" : ""} type="button" onClick={() => setTab("people")}>Personal</button>
        </div>

        {saveError && (
          <div className="form-save-error catalog-save-error" role="alert">
            <strong>NO SE GUARDÓ EL CAMBIO</strong>
            <p>{saveError}</p>
            <small>La información escrita en el formulario se conserva para que puedas reintentar.</small>
          </div>
        )}

        {tab === "areas" ? (
          <div className="catalog-panel">
            <p className="catalog-help">Las áreas inactivas dejan de aparecer en iniciativas nuevas, pero permanecen en el historial.</p>
            <div className="catalog-list">
              {areas.map((area) => (
                <div className="catalog-row" key={area.id}>
                  <div><strong>{area.name}</strong><small>{area.active ? "Activa" : "Inactiva"}</small></div>
                  <label className="switch"><input type="checkbox" checked={area.active} disabled={saving} onChange={() => void runCatalogWrite("área", () => onSaveArea({ ...area, active: !area.active }))} /><span /></label>
                </div>
              ))}
            </div>
            <form className="catalog-add" onSubmit={addArea}>
              <label className="field"><span>Nueva área</span><input required value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="Ej. Legal y cumplimiento" /></label>
              <button className="button button-primary" type="submit" disabled={saving}>Agregar área</button>
            </form>
          </div>
        ) : tab === "units" ? (
          <div className="catalog-panel">
            <p className="catalog-help">Agrega nuevas sucursales, conceptos o unidades operativas sin cambiar el código.</p>
            <div className="catalog-list">
              {units.map((unit) => (
                <div className="catalog-row" key={unit.id}>
                  <div><strong><span className="unit-code">{unit.code}</span>{unit.name}</strong><small>{unit.active ? "Activa" : "Inactiva"}</small></div>
                  <label className="switch"><input type="checkbox" checked={unit.active} disabled={saving} onChange={() => void runCatalogWrite("unidad", () => onSaveUnit({ ...unit, active: !unit.active }))} /><span /></label>
                </div>
              ))}
            </div>
            <form className="catalog-add unit-add" onSubmit={addUnit}>
              <label className="field"><span>Código</span><input required maxLength={12} value={unitCode} onChange={(event) => setUnitCode(event.target.value)} placeholder="Ej. HTT" /></label>
              <label className="field"><span>Nombre</span><input required value={unitName} onChange={(event) => setUnitName(event.target.value)} placeholder="Ej. Hot Tacos Toronto" /></label>
              <button className="button button-primary" type="submit" disabled={saving}>Agregar unidad</button>
            </form>
          </div>
        ) : (
          <div className="catalog-panel">
            <p className="catalog-help">Usa este directorio para asignar responsables y encontrarlos después por nombre, puesto o contacto.</p>
            <label className="search-box catalog-search">
              <span aria-hidden="true">⌕</span>
              <input value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Buscar personal" />
            </label>
            <div className="catalog-list people-list">
              {visiblePeople.map((person) => (
                <div className="catalog-row person-row" key={person.id}>
                  <div>
                    <strong>{person.name}</strong>
                    <small>{[person.role, person.phone, person.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</small>
                  </div>
                  <label className="switch"><input type="checkbox" checked={person.active} disabled={saving} onChange={() => void runCatalogWrite("persona", () => onSavePerson({ ...person, active: !person.active }))} /><span /></label>
                </div>
              ))}
              {visiblePeople.length === 0 && <p className="catalog-empty">No hay personas que coincidan.</p>}
            </div>
            <form className="catalog-add person-add" onSubmit={addPerson}>
              <label className="field"><span>Nombre *</span><input required value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nombre completo" /></label>
              <label className="field"><span>Puesto o función</span><input value={personRole} onChange={(event) => setPersonRole(event.target.value)} placeholder="Ej. Gerente de Windsor" /></label>
              <label className="field"><span>Teléfono</span><input type="tel" value={personPhone} onChange={(event) => setPersonPhone(event.target.value)} placeholder="Ej. 519 000 0000" /></label>
              <label className="field"><span>Correo</span><input type="email" value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="nombre@hottacos.ca" /></label>
              <button className="button button-primary" type="submit" disabled={saving}>Agregar persona</button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
