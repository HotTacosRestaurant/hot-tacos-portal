"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { InitiativeDraft } from "@/types/initiative";

const DEPARTMENTS = [
  "Operaciones",
  "Recursos Humanos",
  "Compras",
  "Inventario",
  "Finanzas",
  "Relaciones Públicas",
  "Marketing",
  "Tecnología y Sistemas",
];

interface InitiativeModalProps {
  monthKey: string;
  onClose: () => void;
  onSubmit: (draft: InitiativeDraft) => Promise<void>;
}

export function InitiativeModal({
  monthKey,
  onClose,
  onSubmit,
}: InitiativeModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(`${monthKey}-01`);
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const [selected, setSelected] = useState<string[]>(["Operaciones"]);
  const [saving, setSaving] = useState(false);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
        new Date(`${monthKey}-02T12:00:00`),
      ),
    [monthKey],
  );

  function toggleDepartment(department: string) {
    setSelected((current) =>
      current.includes(department)
        ? current.filter((item) => item !== department)
        : [...current, department],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !owner.trim() || selected.length === 0) return;

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
        areas: selected.map((name) => ({
          id: crypto.randomUUID(),
          name,
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
              {DEPARTMENTS.map((department) => (
                <label className="check-card" key={department}>
                  <input
                    type="checkbox"
                    checked={selected.includes(department)}
                    onChange={() => toggleDepartment(department)}
                  />
                  <span>{department}</span>
                </label>
              ))}
            </div>
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

