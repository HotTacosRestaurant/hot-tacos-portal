"use client";

import { useEffect, useMemo, useState } from "react";

import { InitiativeCard } from "@/components/portal/initiative-card";
import { InitiativeModal } from "@/components/portal/initiative-modal";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  createInitiative,
  removeInitiative,
  saveInitiative,
  subscribeToInitiatives,
} from "@/lib/initiative-repository";
import type { Initiative, InitiativeDraft } from "@/types/initiative";

const STORAGE_KEY = "hot-tacos-portal-initiatives-v1";
type DataMode = "connecting" | "firebase" | "local";

export function PortalDashboard() {
  const months = useMemo(() => getRollingMonths(), []);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [mode, setMode] = useState<DataMode>("connecting");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      queueMicrotask(() => {
        setInitiatives(loadLocal());
        setMode("local");
      });
      return;
    }

    try {
      return subscribeToInitiatives(
        (data) => {
          setInitiatives(data);
          setMode("firebase");
        },
        () => {
          setInitiatives(loadLocal());
          setMode("local");
        },
      );
    } catch {
      queueMicrotask(() => {
        setInitiatives(loadLocal());
        setMode("local");
      });
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return initiatives.filter((initiative) => {
      const matchesText =
        !normalizedQuery ||
        `${initiative.title} ${initiative.location} ${initiative.owner}`
          .toLocaleLowerCase("es")
          .includes(normalizedQuery);
      return matchesText && (statusFilter === "all" || initiative.status === statusFilter);
    });
  }, [initiatives, query, statusFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const inTwoWeeks = new Date(now);
    inTwoWeeks.setDate(now.getDate() + 14);
    return {
      active: initiatives.filter((item) => item.status !== "ready").length,
      ready: initiatives.filter((item) => item.status === "ready").length,
      upcoming: initiatives.filter((item) => {
        const date = new Date(`${item.eventDate}T23:59:59`);
        return date >= now && date <= inTwoWeeks;
      }).length,
      blocked: initiatives.filter((item) => item.status === "blocked").length,
    };
  }, [initiatives]);

  function saveLocal(next: Initiative[]) {
    setInitiatives(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function switchToLocal(message: string, data = initiatives) {
    setMode("local");
    saveLocal(data.length ? data : loadLocal());
    setToast(message);
  }

  async function addInitiative(draft: InitiativeDraft) {
    if (mode === "firebase") {
      try {
        await createInitiative(draft);
        setToast("Iniciativa creada");
        return;
      } catch {
        switchToLocal("No se pudo escribir en Firebase. Se guardó en este dispositivo.");
      }
    }
    const now = new Date().toISOString();
    saveLocal([...initiatives, { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now }]);
    setToast("Iniciativa creada en modo local");
  }

  async function updateInitiative(updated: Initiative) {
    const next = initiatives.map((item) =>
      item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item,
    );
    setInitiatives(next);
    if (mode === "firebase") {
      try {
        await saveInitiative(updated);
        return;
      } catch {
        switchToLocal("Firebase rechazó el cambio. Continuamos en modo local.", next);
        return;
      }
    }
    saveLocal(next);
  }

  async function deleteInitiative(id: string) {
    const next = initiatives.filter((item) => item.id !== id);
    setInitiatives(next);
    if (mode === "firebase") {
      try {
        await removeInitiative(id);
        setToast("Iniciativa eliminada");
        return;
      } catch {
        switchToLocal("Firebase rechazó el cambio. Continuamos en modo local.", next);
        return;
      }
    }
    saveLocal(next);
    setToast("Iniciativa eliminada");
  }

  return (
    <main className="portal-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Hot Tacos Portal">
          <span className="brand-mark">HT</span>
          <span><strong>HOT TACOS</strong><small>PORTAL INTERNO</small></span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a className="active" href="#initiatives">Iniciativas</a>
          <span>Documentos</span>
          <span>Equipo</span>
        </nav>
        <div className="user-menu"><span className="avatar dark">A</span><span>Administración</span></div>
      </header>

      <div className="portal-content" id="top">
        {mode === "local" && (
          <div className="mode-banner" role="status">
            <span>Vista local</span>
            Firebase todavía no permite acceder a <code>portal_initiatives</code>. Tus cambios se guardan únicamente en este navegador.
          </div>
        )}

        <section className="hero" id="initiatives">
          <div>
            <p className="eyebrow">Centro de coordinación</p>
            <h1>Iniciativas</h1>
            <p>Planea eventos y proyectos, asigna responsables y da seguimiento a cada área.</p>
          </div>
          <button className="button button-primary hero-button" type="button" onClick={() => setSelectedMonth(months[0].key)}>
            <span aria-hidden="true">＋</span> Nueva iniciativa
          </button>
        </section>

        <section className="stat-grid" aria-label="Resumen">
          <StatCard value={stats.active} label="Iniciativas activas" tone="red" />
          <StatCard value={stats.upcoming} label="En los próximos 14 días" tone="yellow" />
          <StatCard value={stats.ready} label="Listas" tone="green" />
          <StatCard value={stats.blocked} label="Requieren atención" tone="dark" />
        </section>

        <section className="toolbar">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar iniciativa, lugar o responsable" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado">
            <option value="all">Todos los estados</option>
            <option value="notified">Notificado</option>
            <option value="in_progress">En proceso</option>
            <option value="under_review">En revisión</option>
            <option value="ready">Listo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </section>

        <div className="timeline">
          {months.map((month) => {
            const monthInitiatives = filtered.filter((item) => item.monthKey === month.key);
            return (
              <section className="month-section" key={month.key}>
                <div className="month-rail"><span>{month.short}</span><strong>{month.year}</strong></div>
                <div className="month-content">
                  <div className="month-heading">
                    <div><h2>{month.label}</h2><span>{monthInitiatives.length} {monthInitiatives.length === 1 ? "iniciativa" : "iniciativas"}</span></div>
                    <button className="add-month" type="button" onClick={() => setSelectedMonth(month.key)}>＋ Agregar</button>
                  </div>
                  {monthInitiatives.length ? (
                    <div className="initiative-list">
                      {monthInitiatives.map((initiative) => (
                        <InitiativeCard key={initiative.id} initiative={initiative} onChange={updateInitiative} onDelete={deleteInitiative} />
                      ))}
                    </div>
                  ) : (
                    <button className="empty-month" type="button" onClick={() => setSelectedMonth(month.key)}>
                      <span>＋</span><strong>Sin iniciativas planeadas</strong><small>Agrega la primera iniciativa de {month.label.toLowerCase()}</small>
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {selectedMonth && <InitiativeModal monthKey={selectedMonth} onClose={() => setSelectedMonth(null)} onSubmit={addInitiative} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function StatCard({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <article className={`stat-card ${tone}`}><span>{value}</span><p>{label}</p></article>;
}

function getRollingMonths() {
  const formatter = new Intl.DateTimeFormat("es-MX", { month: "long" });
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + index);
    const month = formatter.format(date);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: month.charAt(0).toUpperCase() + month.slice(1),
      short: month.slice(0, 3).toUpperCase(),
      year: date.getFullYear(),
    };
  });
}

function loadLocal(): Initiative[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Initiative[];
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  return [createSampleInitiative()];
}

function createSampleInitiative(): Initiative {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const eventDate = `${key}-${String(Math.min(now.getDate() + 10, 28)).padStart(2, "0")}`;
  const stamp = now.toISOString();
  return {
    id: "local-demo-windsor-eats",
    title: "Food Truck · Windsor Eats",
    description: "Preparar la participación de Hot Tacos y coordinar la operación completa del evento.",
    monthKey: key,
    eventDate,
    location: "Downtown Windsor",
    owner: "Alain",
    status: "in_progress",
    createdAt: stamp,
    updatedAt: stamp,
    areas: [
      { id: "demo-ops", name: "Operaciones", status: "in_progress", tasks: [{ id: "demo-task-1", title: "Confirmar equipo y horarios", owner: "Gerencia", dueDate: eventDate, status: "in_progress" }] },
      { id: "demo-buy", name: "Compras", status: "under_review", tasks: [{ id: "demo-task-2", title: "Cotizar insumos del evento", owner: "Compras", dueDate: eventDate, status: "pending" }] },
      { id: "demo-marketing", name: "Marketing", status: "ready", tasks: [{ id: "demo-task-3", title: "Publicar anuncio", owner: "Marketing", dueDate: eventDate, status: "done" }] },
    ],
  };
}
