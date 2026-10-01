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
  PortalUnit,
  TaskStatus,
} from "@/types/initiative";

interface InitiativeCardProps {
  initiative: Initiative;
  units: PortalUnit[];
  onChange: (initiative: Initiative) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function InitiativeCard({
  initiative,
  units,
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
    await onChange({
      ...initiative,
      areas: initiative.areas.map((area) => (area.id === areaId ? update(area) : area)),
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
              ) : <span className="scope-badge global">Toda la marca</span>}
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
              })
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
            <span><small>Responsable</small>{initiative.owner}</span>
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
                onChange={(update) => updateArea(area.id, update)}
              />
            ))}
            <button
              className="danger-link"
              type="button"
              onClick={() => {
                if (window.confirm(`¿Eliminar “${initiative.title}”?`)) void onDelete(initiative.id);
              }}
            >
              Eliminar iniciativa
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function AreaPanel({
  area,
  onChange,
}: {
  area: InitiativeArea;
  onChange: (update: (area: InitiativeArea) => InitiativeArea) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !owner.trim() || !dueDate) return;
    await onChange((current) => ({
      ...current,
      status: current.status === "notified" ? "in_progress" : current.status,
      tasks: [
        ...current.tasks,
        { id: crypto.randomUUID(), title: title.trim(), owner: owner.trim(), dueDate, status: "pending" },
      ],
    }));
    setTitle("");
    setOwner("");
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
            }))
          }
        >
          {initiativeStatuses.map((status) => <option key={status} value={status}>{initiativeStatusLabels[status]}</option>)}
        </select>
      </div>

      {area.tasks.length > 0 && (
        <div className="task-list">
          {area.tasks.map((task) => (
            <div className="task-row" key={task.id}>
              <div className="task-copy"><strong>{task.title}</strong><span>{task.owner} · vence {formatDate(task.dueDate)}</span></div>
              <select
                className={`status-select compact ${statusTone(task.status)}`}
                value={task.status}
                aria-label={`Estado de ${task.title}`}
                onChange={(event) =>
                  void onChange((current) => ({
                    ...current,
                    tasks: current.tasks.map((item) =>
                      item.id === task.id ? { ...item, status: event.target.value as TaskStatus } : item,
                    ),
                  }))
                }
              >
                {taskStatuses.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
              </select>
              <button
                className="remove-task"
                type="button"
                aria-label={`Eliminar ${task.title}`}
                onClick={() => void onChange((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }))}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <form className="task-form" onSubmit={addTask}>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tarea" aria-label="Tarea" />
          <input required value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Responsable" aria-label="Responsable" />
          <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Fecha límite" />
          <button className="button button-primary button-small" type="submit">Agregar</button>
          <button className="button button-ghost button-small" type="button" onClick={() => setAdding(false)}>Cancelar</button>
        </form>
      ) : (
        <button className="add-task" type="button" onClick={() => setAdding(true)}>+ Agregar tarea</button>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
