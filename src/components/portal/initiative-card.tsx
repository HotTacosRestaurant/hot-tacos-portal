"use client";

import { useState, type FormEvent } from "react";

import {
  initiativeStatusLabels,
  initiativeStatuses,
  statusTone,
  taskStatusLabels,
  taskStatuses,
} from "@/components/portal/status";
import type {
  Initiative,
  InitiativeArea,
  InitiativeStatus,
  InitiativeTask,
  PortalPerson,
  PortalUnit,
  TaskStatus,
} from "@/types/initiative";

interface InitiativeCardProps {
  initiative: Initiative;
  units: PortalUnit[];
  people: PortalPerson[];
  canDelete: boolean;
  onChange: (initiative: Initiative) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function InitiativeCard({
  initiative,
  units,
  people,
  canDelete,
  onChange,
  onDelete,
}: InitiativeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const completedTasks = initiative.areas.reduce(
    (total, area) => total + area.tasks.filter((task) => task.status === "done").length,
    0,
  );
  const totalTasks = initiative.areas.reduce(
    (total, area) => total + area.tasks.length,
    0,
  );
  const readyAreas = initiative.areas.filter((area) => area.status === "ready").length;
  const progress = initiative.areas.length
    ? Math.round((readyAreas / initiative.areas.length) * 100)
    : 0;

  async function updateArea(areaId: string, update: (area: InitiativeArea) => InitiativeArea) {
    const now = new Date().toISOString();
    await onChange({
      ...initiative,
      areas: initiative.areas.map((area) => {
        if (area.id !== areaId) return area;
        const updated = update(area);
        return {
          ...updated,
          updatedAt: now,
          completedAt: updated.status === "ready" ? updated.completedAt ?? now : undefined,
        };
      }),
    });
  }

  return (
    <article className="initiative-card">
      <div className="initiative-accent" />
      <div className="initiative-main">
        <div className="initiative-topline">
          <div>
            <div className="initiative-meta">
              <span>{formatDate(initiative.eventDate)}</span>
              {initiative.location && <span>• {initiative.location}</span>}
            </div>
            <div className="scope-badges">
              {initiative.scopeType === "units" && initiative.unitIds.length ? (
                initiative.unitIds.map((unitId) => {
                  const unit = units.find((item) => item.id === unitId);
                  return <span className="scope-badge" key={unitId}>{unit?.code ?? unitId}</span>;
                })
              ) : <span className="scope-badge global">Toda el Grupo</span>}
            </div>
            <h3>{initiative.title}</h3>
          </div>
          <select
            className={`status-select ${statusTone(initiative.status)}`}
            aria-label={`Estado de ${initiative.title}`}
            value={initiative.status}
            onChange={(event) =>
              void onChange({
                ...initiative,
                status: event.target.value as InitiativeStatus,
              }).catch(() => undefined)
            }
          >
            {initiativeStatuses.map((status) => (
              <option key={status} value={status}>
                {initiativeStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        {initiative.description && <p className="initiative-description">{initiative.description}</p>}

        <div className="initiative-summary">
          <div className="owner-chip">
            <span className="avatar">{initials(initiative.owner)}</span>
            <span><small>Responsable</small>{initiative.owner}<OwnerContact contact={contactForOwner(initiative.ownerPersonId, initiative.ownerContact, people)} /></span>
          </div>
          <div className="summary-stat"><strong>{initiative.areas.length}</strong><span>áreas</span></div>
          <div className="summary-stat"><strong>{completedTasks}/{totalTasks}</strong><span>tareas</span></div>
          <div className="progress-wrap" aria-label={`${progress}% de áreas listas`}>
            <div className="progress-label"><span>Avance</span><strong>{progress}%</strong></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </div>

        <button className="details-toggle" type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Ocultar coordinación" : "Ver coordinación por áreas"}
          <span aria-hidden="true">{expanded ? "↑" : "↓"}</span>
        </button>

        {expanded && (
          <div className="area-list">
            {initiative.areas.map((area) => (
              <AreaPanel
                key={area.id}
                area={area}
                people={people}
                onChange={(update) => updateArea(area.id, update)}
              />
            ))}
            {canDelete && (
              <button
                className="danger-link"
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Eliminar “${initiative.title}”?`)) {
                    void onDelete(initiative.id).catch(() => undefined);
                  }
                }}
              >
                Eliminar iniciativa
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function AreaPanel({
  area,
  people,
  onChange,
}: {
  area: InitiativeArea;
  people: PortalPerson[];
  onChange: (update: (area: InitiativeArea) => InitiativeArea) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [ownerSelection, setOwnerSelection] = useState("");
  const [customOwner, setCustomOwner] = useState("");
  const [customOwnerPhone, setCustomOwnerPhone] = useState("");
  const [customOwnerEmail, setCustomOwnerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const activePeople = people.filter((person) => person.active);

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedPerson = activePeople.find((person) => person.id === ownerSelection);
    const owner = selectedPerson?.name ?? customOwner.trim();
    if (!title.trim() || !owner || !dueDate) return;
    try {
      const now = new Date().toISOString();
      await onChange((current) => ({
        ...current,
        status: current.status === "notified" ? "in_progress" : current.status,
        tasks: [
          ...current.tasks,
          {
            id: crypto.randomUUID(),
            title: title.trim(),
            owner,
            ownerPersonId: selectedPerson?.id,
            ownerContact: {
              phone: selectedPerson?.phone ?? customOwnerPhone.trim(),
              email: selectedPerson?.email ?? customOwnerEmail.trim(),
            },
            dueDate,
            status: "pending",
            notes: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
    } catch {
      return;
    }
    setTitle("");
    setOwnerSelection("");
    setCustomOwner("");
    setCustomOwnerPhone("");
    setCustomOwnerEmail("");
    setDueDate("");
    setAdding(false);
  }

  return (
    <section className="area-panel">
      <div className="area-heading">
        <div><strong>{area.name}</strong><span>{area.tasks.length} tareas</span></div>
        <select
          className={`status-select compact ${statusTone(area.status)}`}
          value={area.status}
          aria-label={`Estado de ${area.name}`}
          onChange={(event) =>
            void onChange((current) => ({
              ...current,
              status: event.target.value as InitiativeStatus,
            })).catch(() => undefined)
          }
        >
          {initiativeStatuses.map((status) => <option key={status} value={status}>{initiativeStatusLabels[status]}</option>)}
        </select>
      </div>

      {area.tasks.length > 0 && (
        <div className="task-list">
          {area.tasks.map((task) => (
            <TaskItem key={task.id} task={task} people={people} onChange={onChange} />
          ))}
        </div>
      )}

      {adding ? (
        <form className="task-form" onSubmit={addTask}>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tarea" aria-label="Tarea" />
          <select required value={ownerSelection} onChange={(event) => setOwnerSelection(event.target.value)} aria-label="Responsable">
            <option value="">Responsable</option>
            {activePeople.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}
            <option value="other">Otro…</option>
          </select>
          <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Fecha límite" />
          {ownerSelection === "other" && (
            <div className="task-custom-owner">
              <input required value={customOwner} onChange={(event) => setCustomOwner(event.target.value)} placeholder="Nombre del responsable" aria-label="Nombre del responsable" />
              <input type="tel" value={customOwnerPhone} onChange={(event) => setCustomOwnerPhone(event.target.value)} placeholder="Teléfono" aria-label="Teléfono del responsable" />
              <input type="email" value={customOwnerEmail} onChange={(event) => setCustomOwnerEmail(event.target.value)} placeholder="Correo" aria-label="Correo del responsable" />
            </div>
          )}
          <button className="button button-primary button-small" type="submit">Agregar</button>
          <button className="button button-ghost button-small" type="button" onClick={() => setAdding(false)}>Cancelar</button>
        </form>
      ) : (
        <button className="add-task" type="button" onClick={() => setAdding(true)}>+ Agregar tarea</button>
      )}
    </section>
  );
}

function TaskItem({
  task,
  people,
  onChange,
}: {
  task: InitiativeTask;
  people: PortalPerson[];
  onChange: (update: (area: InitiativeArea) => InitiativeArea) => Promise<void>;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState("");
  const notes = task.notes ?? [];
  const contact = contactForOwner(task.ownerPersonId, task.ownerContact, people);

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    try {
      await onChange((current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                updatedAt: new Date().toISOString(),
                notes: [
                  ...(item.notes ?? []),
                  { id: crypto.randomUUID(), text: note.trim(), createdAt: new Date().toISOString() },
                ],
              }
            : item,
        ),
      }));
    } catch {
      return;
    }
    setNote("");
    setNotesOpen(true);
  }

  return (
    <article className="task-item">
      <div className="task-row">
        <div className="task-copy">
          <strong>{task.title}</strong>
          <span>{task.owner} · vence {formatDate(task.dueDate)}</span>
          <OwnerContact contact={contact} />
        </div>
        <select
          className={`status-select compact ${statusTone(task.status)}`}
          value={task.status}
          aria-label={`Estado de ${task.title}`}
          onChange={(event) =>
            void onChange((current) => ({
              ...current,
              tasks: current.tasks.map((item) => {
                if (item.id !== task.id) return item;
                const nextStatus = event.target.value as TaskStatus;
                const now = new Date().toISOString();
                return {
                  ...item,
                  status: nextStatus,
                  updatedAt: now,
                  completedAt: nextStatus === "done" ? item.completedAt ?? now : undefined,
                };
              }),
            })).catch(() => undefined)
          }
        >
          {taskStatuses.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
        </select>
        <button
          className="remove-task"
          type="button"
          aria-label={`Eliminar ${task.title}`}
          onClick={() =>
            void onChange((current) => ({
              ...current,
              tasks: current.tasks.filter((item) => item.id !== task.id),
            })).catch(() => undefined)
          }
        >×</button>
      </div>
      <button className="notes-toggle" type="button" onClick={() => setNotesOpen((current) => !current)}>
        {notesOpen ? "Ocultar notas" : `Notas y evidencia${notes.length ? ` (${notes.length})` : ""}`}
      </button>
      {notesOpen && (
        <div className="task-notes">
          {notes.length > 0 && (
            <div className="note-list">
              {[...notes].reverse().map((item) => (
                <div className="note-entry" key={item.id}>
                  <p>{item.text}</p>
                  <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                </div>
              ))}
            </div>
          )}
          <form className="note-form" onSubmit={addNote}>
            <textarea required rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Agrega una nota, bloqueo, acuerdo o evidencia…" aria-label={`Nueva nota para ${task.title}`} />
            <button className="button button-primary button-small" type="submit">Guardar nota</button>
          </form>
        </div>
      )}
    </article>
  );
}

function OwnerContact({ contact }: { contact?: { phone: string; email: string } }) {
  if (!contact?.phone && !contact?.email) return null;
  return (
    <span className="owner-contact">
      {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
      {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
    </span>
  );
}

function contactForOwner(
  personId: string | undefined,
  stored: { phone: string; email: string } | undefined,
  people: PortalPerson[],
) {
  const person = people.find((item) => item.id === personId);
  return person ? { phone: person.phone, email: person.email } : stored;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
