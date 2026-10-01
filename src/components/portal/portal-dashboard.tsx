"use client";

import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { CatalogModal } from "@/components/portal/catalog-modal";
import { InitiativeCard } from "@/components/portal/initiative-card";
import { InitiativeModal } from "@/components/portal/initiative-modal";
import { auth, googleAuthProvider, isFirebaseConfigured } from "@/lib/firebase";
import {
  createInitiative,
  removeInitiative,
  saveArea,
  saveInitiative,
  saveUnit,
  subscribeToAreas,
  subscribeToInitiatives,
  subscribeToUnits,
} from "@/lib/initiative-repository";
import { DEFAULT_AREAS, DEFAULT_UNITS, mergeCatalog } from "@/lib/portal-catalogs";
import type {
  Initiative,
  InitiativeDraft,
  PortalArea,
  PortalUnit,
} from "@/types/initiative";

const STORAGE_KEY = "hot-tacos-portal-initiatives-v1";
const AREAS_STORAGE_KEY = "hot-tacos-portal-areas-v1";
const UNITS_STORAGE_KEY = "hot-tacos-portal-units-v1";
type DataMode = "connecting" | "firebase" | "local" | "denied";

export function PortalDashboard() {
  const months = useMemo(() => getRollingMonths(), []);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [areas, setAreas] = useState<PortalArea[]>(DEFAULT_AREAS);
  const [units, setUnits] = useState<PortalUnit[]>(DEFAULT_UNITS);
  const [mode, setMode] = useState<DataMode>("connecting");
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      queueMicrotask(() => {
        setInitiatives(loadLocalInitiatives());
        setAreas(loadLocalCatalog(AREAS_STORAGE_KEY, DEFAULT_AREAS));
        setUnits(loadLocalCatalog(UNITS_STORAGE_KEY, DEFAULT_UNITS));
        setMode("local");
      });
      return;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setInitiatives([]);
        setMode("connecting");
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;

    const unsubscribers: Array<() => void> = [];
    try {
      unsubscribers.push(
        subscribeToInitiatives(
          (data) => {
            setInitiatives(data);
            setMode("firebase");
          },
          () => {
            setInitiatives([]);
            setMode("denied");
          },
        ),
        subscribeToAreas(
          (data) => setAreas(mergeCatalog(DEFAULT_AREAS, data)),
          () => setAreas(DEFAULT_AREAS),
        ),
        subscribeToUnits(
          (data) => setUnits(mergeCatalog(DEFAULT_UNITS, data)),
          () => setUnits(DEFAULT_UNITS),
        ),
      );
    } catch {
      queueMicrotask(() => setMode("denied"));
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return initiatives.filter((initiative) => {
      const unitText = unitLabel(initiative, units);
      const matchesText =
        !normalizedQuery ||
        `${initiative.title} ${initiative.location} ${initiative.owner} ${unitText}`
          .toLocaleLowerCase("es")
          .includes(normalizedQuery);
      return matchesText && (statusFilter === "all" || initiative.status === statusFilter);
    });
  }, [initiatives, query, statusFilter, units]);

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

  async function handleSignIn() {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch {
      setToast("No fue posible iniciar sesión con Google.");
    }
  }

  async function handleSignOut() {
    if (auth) await signOut(auth);
  }

  function saveLocalInitiatives(next: Initiative[]) {
    setInitiatives(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function addInitiative(draft: InitiativeDraft) {
    if (mode === "firebase") {
      try {
        await createInitiative(draft);
        setToast("Iniciativa guardada en Firestore");
        return;
      } catch {
        setToast("Firestore rechazó la creación. Revisa el usuario y las reglas.");
        return;
      }
    }
    if (mode !== "local") return;
    const now = new Date().toISOString();
    saveLocalInitiatives([...initiatives, { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now }]);
    setToast("Iniciativa creada en modo local");
  }

  async function updateInitiative(updated: Initiative) {
    const next = initiatives.map((item) =>
      item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item,
    );
    if (mode === "firebase") {
      try {
        await saveInitiative(updated);
        return;
      } catch {
        setToast("Firestore rechazó el cambio.");
        return;
      }
    }
    if (mode === "local") saveLocalInitiatives(next);
  }

  async function deleteInitiative(id: string) {
    const next = initiatives.filter((item) => item.id !== id);
    if (mode === "firebase") {
      try {
        await removeInitiative(id);
        setToast("Iniciativa eliminada");
        return;
      } catch {
        setToast("Firestore rechazó la eliminación.");
        return;
      }
    }
    if (mode === "local") saveLocalInitiatives(next);
  }

  async function updateArea(area: PortalArea) {
    const next = mergeCatalog(DEFAULT_AREAS, areas.map((item) => item.id === area.id ? area : item));
    if (!areas.some((item) => item.id === area.id)) next.push(area);
    setAreas(sortCatalog(next));
    if (mode === "firebase") {
      try {
        await saveArea(area);
        setToast("Catálogo de áreas actualizado");
      } catch {
        setToast("Solo un administrador autorizado puede modificar catálogos.");
      }
    } else if (mode === "local") {
      window.localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(next));
    }
  }

  async function updateUnit(unit: PortalUnit) {
    const next = mergeCatalog(DEFAULT_UNITS, units.map((item) => item.id === unit.id ? unit : item));
    if (!units.some((item) => item.id === unit.id)) next.push(unit);
    setUnits(sortCatalog(next));
    if (mode === "firebase") {
      try {
        await saveUnit(unit);
        setToast("Catálogo de unidades actualizado");
      } catch {
        setToast("Solo un administrador autorizado puede modificar catálogos.");
      }
    } else if (mode === "local") {
      window.localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(next));
    }
  }

  const displayName = user?.displayName || user?.email || "Administración";

  return (
    <main className="portal-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Hot Tacos Portal">
          <span className="brand-mark">HT</span>
          <span><strong>HOT TACOS</strong><small>PORTAL INTERNO</small></span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a className="active" href="#initiatives">Iniciativas</a>
          <button className="nav-button" type="button" onClick={() => setCatalogOpen(true)}>Catálogos</button>
          <span>Equipo</span>
        </nav>
        <div className="user-menu">
          <span className="avatar dark">{displayName.charAt(0).toUpperCase()}</span>
          <span>{displayName}</span>
          {user && <button type="button" onClick={() => void handleSignOut()}>Salir</button>}
        </div>
      </header>

      {!authReady ? (
        <div className="auth-gate"><div className="auth-card"><p>Verificando acceso…</p></div></div>
      ) : isFirebaseConfigured && !user ? (
        <div className="auth-gate">
          <div className="auth-card">
            <span className="brand-mark large">HT</span>
            <p className="eyebrow">Portal interno</p>
            <h1>Acceso a Hot Tacos</h1>
            <p>Inicia sesión con una cuenta autorizada para consultar y modificar iniciativas.</p>
            <button className="button button-primary" type="button" onClick={() => void handleSignIn()}>Continuar con Google</button>
          </div>
        </div>
      ) : (
        <div className="portal-content" id="top">
          {mode === "local" && (
            <div className="mode-banner" role="status"><span>Vista local</span>Firebase no está configurado. Los cambios se guardan únicamente en este navegador.</div>
          )}
          {mode === "denied" && (
            <div className="mode-banner denied" role="alert"><span>Sin acceso</span>La cuenta inició sesión, pero no está autorizada en <code>portal_users</code>. No se guardarán datos.</div>
          )}

          <section className="hero" id="initiatives">
            <div><p className="eyebrow">Centro de coordinación</p><h1>Iniciativas</h1><p>Planea eventos y proyectos, asigna responsables y da seguimiento a cada área.</p></div>
            <button className="button button-primary hero-button" type="button" disabled={mode === "denied" || mode === "connecting"} onClick={() => setSelectedMonth(months[0].key)}><span aria-hidden="true">＋</span> Nueva iniciativa</button>
          </section>

          <section className="stat-grid" aria-label="Resumen">
            <StatCard value={stats.active} label="Iniciativas activas" tone="red" />
            <StatCard value={stats.upcoming} label="En los próximos 14 días" tone="yellow" />
            <StatCard value={stats.ready} label="Listas" tone="green" />
            <StatCard value={stats.blocked} label="Requieren atención" tone="dark" />
          </section>

          <section className="toolbar">
            <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar iniciativa, unidad o responsable" /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado">
              <option value="all">Todos los estados</option><option value="notified">Notificado</option><option value="in_progress">En proceso</option><option value="under_review">En revisión</option><option value="ready">Listo</option><option value="blocked">Bloqueado</option>
            </select>
          </section>

          <div className="timeline">
            {months.map((month) => {
              const monthInitiatives = filtered.filter((item) => item.monthKey === month.key);
              return (
                <section className="month-section" key={month.key}>
                  <div className="month-rail"><span>{month.short}</span><strong>{month.year}</strong></div>
                  <div className="month-content">
                    <div className="month-heading"><div><h2>{month.label}</h2><span>{monthInitiatives.length} {monthInitiatives.length === 1 ? "iniciativa" : "iniciativas"}</span></div><button className="add-month" type="button" disabled={mode === "denied" || mode === "connecting"} onClick={() => setSelectedMonth(month.key)}>＋ Agregar</button></div>
                    {monthInitiatives.length ? (
                      <div className="initiative-list">{monthInitiatives.map((initiative) => <InitiativeCard key={initiative.id} initiative={initiative} units={units} onChange={updateInitiative} onDelete={deleteInitiative} />)}</div>
                    ) : (
                      <button className="empty-month" type="button" disabled={mode === "denied" || mode === "connecting"} onClick={() => setSelectedMonth(month.key)}><span>＋</span><strong>Sin iniciativas planeadas</strong><small>Agrega la primera iniciativa de {month.label.toLowerCase()}</small></button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {selectedMonth && <InitiativeModal monthKey={selectedMonth} areas={areas} units={units} onClose={() => setSelectedMonth(null)} onSubmit={addInitiative} />}
      {catalogOpen && <CatalogModal areas={areas} units={units} onClose={() => setCatalogOpen(false)} onSaveArea={updateArea} onSaveUnit={updateUnit} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function StatCard({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <article className={`stat-card ${tone}`}><span>{value}</span><p>{label}</p></article>;
}

function unitLabel(initiative: Initiative, units: PortalUnit[]) {
  if (!initiative.scopeType || initiative.scopeType === "brand") return "Toda la marca";
  return initiative.unitIds.map((id) => units.find((unit) => unit.id === id)?.code ?? id).join(" ");
}

function getRollingMonths() {
  const formatter = new Intl.DateTimeFormat("es-MX", { month: "long" });
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + index);
    const month = formatter.format(date);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: month.charAt(0).toUpperCase() + month.slice(1), short: month.slice(0, 3).toUpperCase(), year: date.getFullYear() };
  });
}

function loadLocalInitiatives(): Initiative[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return (JSON.parse(stored) as Initiative[]).map((item) => ({ ...item, scopeType: item.scopeType ?? "brand", unitIds: item.unitIds ?? [] }));
    } catch { window.localStorage.removeItem(STORAGE_KEY); }
  }
  return [createSampleInitiative()];
}

function loadLocalCatalog<T extends { id: string }>(key: string, defaults: T[]): T[] {
  const stored = window.localStorage.getItem(key);
  if (!stored) return defaults;
  try { return mergeCatalog(defaults, JSON.parse(stored) as T[]); } catch { return defaults; }
}

function sortCatalog<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function createSampleInitiative(): Initiative {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const eventDate = `${key}-${String(Math.min(now.getDate() + 10, 28)).padStart(2, "0")}`;
  const stamp = now.toISOString();
  return {
    id: "local-demo-windsor-eats", title: "Food Truck · Windsor Eats", description: "Preparar la participación de Hot Tacos y coordinar la operación completa del evento.", monthKey: key, eventDate, location: "Downtown Windsor", owner: "Alain", status: "in_progress", scopeType: "units", unitIds: ["htft"], createdAt: stamp, updatedAt: stamp,
    areas: [
      { id: "demo-ops", catalogAreaId: "operations", name: "Operaciones", status: "in_progress", tasks: [{ id: "demo-task-1", title: "Confirmar equipo y horarios", owner: "Gerencia", dueDate: eventDate, status: "in_progress" }] },
      { id: "demo-buy", catalogAreaId: "purchasing", name: "Compras", status: "under_review", tasks: [{ id: "demo-task-2", title: "Cotizar insumos del evento", owner: "Compras", dueDate: eventDate, status: "pending" }] },
      { id: "demo-marketing", catalogAreaId: "marketing", name: "Marketing", status: "ready", tasks: [{ id: "demo-task-3", title: "Publicar anuncio", owner: "Marketing", dueDate: eventDate, status: "done" }] },
    ],
  };
}
