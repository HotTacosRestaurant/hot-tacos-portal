"use client";

import { useEffect, useMemo, useState } from "react";

import { CatalogModal, type CatalogTab } from "@/components/portal/catalog-modal";
import { InitiativeCard } from "@/components/portal/initiative-card";
import { InitiativeModal } from "@/components/portal/initiative-modal";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  createInitiative,
  removeInitiative,
  saveArea,
  saveInitiative,
  savePerson,
  saveUnit,
  subscribeToAreas,
  subscribeToInitiatives,
  subscribeToPeople,
  subscribeToUnits,
} from "@/lib/initiative-repository";
import { DEFAULT_AREAS, DEFAULT_PEOPLE, DEFAULT_UNITS, mergeCatalog } from "@/lib/portal-catalogs";
import type {
  Initiative,
  InitiativeDraft,
  PortalArea,
  PortalPerson,
  PortalUnit,
} from "@/types/initiative";

const STORAGE_KEY = "hot-tacos-portal-initiatives-v1";
const AREAS_STORAGE_KEY = "hot-tacos-portal-areas-v1";
const UNITS_STORAGE_KEY = "hot-tacos-portal-units-v1";
const PEOPLE_STORAGE_KEY = "hot-tacos-portal-people-v1";
type DataMode = "connecting" | "firebase" | "local";

export function PortalDashboard() {
  const months = useMemo(() => getRollingMonths(), []);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [areas, setAreas] = useState<PortalArea[]>(DEFAULT_AREAS);
  const [units, setUnits] = useState<PortalUnit[]>(DEFAULT_UNITS);
  const [people, setPeople] = useState<PortalPerson[]>(DEFAULT_PEOPLE);
  const [mode, setMode] = useState<DataMode>("connecting");
  const [selectedScope, setSelectedScope] = useState("brand");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("areas");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      queueMicrotask(() => {
        setInitiatives(loadLocalInitiatives());
        setAreas(loadLocalCatalog(AREAS_STORAGE_KEY, DEFAULT_AREAS));
        setUnits(loadLocalCatalog(UNITS_STORAGE_KEY, DEFAULT_UNITS));
        setPeople(loadLocalCatalog(PEOPLE_STORAGE_KEY, DEFAULT_PEOPLE));
        setMode("local");
      });
      return;
    }

    const unsubscribers: Array<() => void> = [];
    try {
      unsubscribers.push(
        subscribeToInitiatives(
          (data) => {
            setInitiatives(data);
            setMode("firebase");
          },
          () => {
            setInitiatives(loadLocalInitiatives());
            setMode("local");
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
        subscribeToPeople(
          (data) => setPeople(data),
          () => setPeople(DEFAULT_PEOPLE),
        ),
      );
    } catch {
      queueMicrotask(() => {
        setInitiatives(loadLocalInitiatives());
        setMode("local");
      });
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const scopeInitiatives = useMemo(
    () => initiatives.filter((initiative) => initiativeBelongsTo(initiative, selectedScope)),
    [initiatives, selectedScope],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return scopeInitiatives.filter((initiative) => {
      const matchesText =
        !normalizedQuery ||
        initiativeSearchText(initiative, people)
          .toLocaleLowerCase("es")
          .includes(normalizedQuery);
      const matchesPerson =
        personFilter === "all" ||
        initiative.ownerPersonId === personFilter ||
        initiative.areas.some((area) => area.tasks.some((task) => task.ownerPersonId === personFilter));
      const matchesTaskStatus =
        taskStatusFilter === "all" ||
        initiative.areas.some((area) => area.tasks.some((task) => task.status === taskStatusFilter));
      return matchesText && matchesPerson && matchesTaskStatus && (statusFilter === "all" || initiative.status === statusFilter);
    });
  }, [scopeInitiatives, query, statusFilter, taskStatusFilter, personFilter, people]);

  const stats = useMemo(() => {
    const now = new Date();
    const inTwoWeeks = new Date(now);
    inTwoWeeks.setDate(now.getDate() + 14);
    return {
      active: scopeInitiatives.filter((item) => item.status !== "ready").length,
      ready: scopeInitiatives.filter((item) => item.status === "ready").length,
      upcoming: scopeInitiatives.filter((item) => {
        const date = new Date(`${item.eventDate}T23:59:59`);
        return date >= now && date <= inTwoWeeks;
      }).length,
      blocked: scopeInitiatives.filter((item) => item.status === "blocked").length,
    };
  }, [scopeInitiatives]);

  const selectedUnit = units.find((unit) => unit.id === selectedScope);
  const scopeTitle = selectedScope === "brand" ? "Toda el Grupo Corporativo" : selectedUnit?.name ?? selectedScope;

  function saveLocalInitiatives(next: Initiative[]) {
    setInitiatives(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function addInitiative(draft: InitiativeDraft) {
    if (mode === "firebase") {
      try {
        await createInitiative(draft);
        setToast("Iniciativa guardada en Firestore");
      } catch {
        setToast("Firestore rechazó la creación. Revisa las reglas del portal.");
      }
      return;
    }
    const now = new Date().toISOString();
    saveLocalInitiatives([...initiatives, { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now }]);
    setToast("Iniciativa creada en modo local");
  }

  async function updateInitiative(updated: Initiative) {
    const next = initiatives.map((item) => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item);
    if (mode === "firebase") {
      try { await saveInitiative(updated); } catch { setToast("Firestore rechazó el cambio."); }
      return;
    }
    saveLocalInitiatives(next);
  }

  async function deleteInitiative(id: string) {
    const next = initiatives.filter((item) => item.id !== id);
    if (mode === "firebase") {
      try { await removeInitiative(id); setToast("Iniciativa eliminada"); } catch { setToast("Firestore rechazó la eliminación."); }
      return;
    }
    saveLocalInitiatives(next);
  }

  async function updateArea(area: PortalArea) {
    const next = upsertCatalog(areas, area, DEFAULT_AREAS);
    setAreas(next);
    if (mode === "firebase") {
      try { await saveArea(area); setToast("Catálogo de áreas actualizado"); } catch { setToast("Firestore rechazó el cambio de catálogo."); }
    } else {
      window.localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(next));
    }
  }

  async function updateUnit(unit: PortalUnit) {
    const next = upsertCatalog(units, unit, DEFAULT_UNITS);
    setUnits(next);
    if (mode === "firebase") {
      try { await saveUnit(unit); setToast("Catálogo de unidades actualizado"); } catch { setToast("Firestore rechazó el cambio de catálogo."); }
    } else {
      window.localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(next));
    }
  }

  async function updatePerson(person: PortalPerson) {
    const next = upsertCatalog(people, person, DEFAULT_PEOPLE);
    setPeople(next);
    if (mode === "firebase") {
      try { await savePerson(person); setToast("Catálogo de personal actualizado"); } catch { setToast("Firestore rechazó el cambio de personal."); }
    } else {
      window.localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(next));
    }
  }

  function openCatalog(tab: CatalogTab) {
    setCatalogTab(tab);
    setCatalogOpen(true);
  }

  return (
    <main className="portal-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Portal del Grupo Corporativo"><span className="brand-mark">HT</span><span><strong>GRUPO CORPORATIVO</strong><small>PORTAL INTERNO</small></span></a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a className="active" href="#initiatives">Iniciativas</a>
          <button className="nav-button" type="button" onClick={() => openCatalog("areas")}>Catálogos</button>
          <button className="nav-button" type="button" onClick={() => openCatalog("people")}>Equipo</button>
        </nav>
        <div className="user-menu"><span className="avatar dark">A</span><span>Administración</span></div>
      </header>

      <div className="portal-content" id="top">
        {mode === "local" && <div className="mode-banner" role="status"><span>Vista local</span>Firestore todavía no permite acceder a las colecciones del portal. Los cambios se guardan únicamente en este navegador.</div>}

        <section className="hero" id="initiatives">
          <div><p className="eyebrow">Centro de coordinación</p><h1>Iniciativas</h1><p>Planea eventos y proyectos, asigna responsables y da seguimiento a cada área.</p></div>
          <button className="button button-primary hero-button" type="button" onClick={() => setSelectedMonth(months[0].key)}><span aria-hidden="true">＋</span> Nueva iniciativa</button>
        </section>

        <section className="scope-navigation" aria-label="Ámbito de iniciativas">
          <button className={selectedScope === "brand" ? "active" : ""} type="button" onClick={() => setSelectedScope("brand")}><span className="scope-nav-code">GC</span><span><strong>Global</strong><small>Toda el Grupo</small></span></button>
          {units.filter((unit) => unit.active).map((unit) => (
            <button
              className={selectedScope === unit.id ? "active" : ""}
              type="button"
              key={unit.id}
              onClick={() => setSelectedScope(unit.id)}
            >
              <span className="scope-nav-code">{unit.code}</span>

              <span>
                <strong>{unit.code}</strong>
                <small>{unit.name}</small>
              </span>
            </button>
          ))}
        </section>

        <div className="view-heading"><div><span>Mostrando iniciativas de</span><h2>{scopeTitle}</h2></div><span className="data-indicator">{mode === "firebase" ? "● Firestore" : "● Local"}</span></div>

        <section className="stat-grid" aria-label="Resumen">
          <StatCard value={stats.active} label="Iniciativas activas" tone="red" /><StatCard value={stats.upcoming} label="En los próximos 14 días" tone="yellow" /><StatCard value={stats.ready} label="Listas" tone="green" /><StatCard value={stats.blocked} label="Requieren atención" tone="dark" />
        </section>

        <section className="toolbar">
          <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar iniciativa, actividad, nota o contacto`} /></label>
          <select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)} aria-label="Filtrar por responsable"><option value="all">Todos los responsables</option>{people.filter((person) => person.active).map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select>
          <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)} aria-label="Filtrar por estado de actividad"><option value="all">Actividades: todos</option><option value="pending">Actividad pendiente</option><option value="in_progress">Actividad en proceso</option><option value="done">Actividad terminada</option><option value="blocked">Actividad bloqueada</option></select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado de iniciativa"><option value="all">Iniciativas: todos</option><option value="notified">Notificada</option><option value="in_progress">En proceso</option><option value="under_review">En revisión</option><option value="ready">Lista</option><option value="blocked">Bloqueada</option></select>
        </section>

        <div className="timeline">
          {months.map((month) => {
            const monthInitiatives = filtered.filter((item) => item.monthKey === month.key);
            return (
              <section className="month-section" key={month.key}>
                <div className="month-rail"><span>{month.short}</span><strong>{month.year}</strong></div>
                <div className="month-content">
                  <div className="month-heading"><div><h2>{month.label}</h2><span>{monthInitiatives.length} {monthInitiatives.length === 1 ? "iniciativa" : "iniciativas"}</span></div><button className="add-month" type="button" onClick={() => setSelectedMonth(month.key)}>＋ Agregar</button></div>
                  {monthInitiatives.length ? <div className="initiative-list">{monthInitiatives.map((initiative) => <InitiativeCard key={initiative.id} initiative={initiative} units={units} people={people} onChange={updateInitiative} onDelete={deleteInitiative} />)}</div> : <button className="empty-month" type="button" onClick={() => setSelectedMonth(month.key)}><span>＋</span><strong>Sin iniciativas planeadas</strong><small>Agrega la primera iniciativa de {month.label.toLowerCase()} para {scopeTitle}</small></button>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {selectedMonth && <InitiativeModal monthKey={selectedMonth} areas={areas} units={units} people={people} initialScopeType={selectedScope === "brand" ? "brand" : "units"} initialUnitIds={selectedScope === "brand" ? [] : [selectedScope]} onClose={() => setSelectedMonth(null)} onSubmit={addInitiative} />}
      {catalogOpen && <CatalogModal areas={areas} units={units} people={people} initialTab={catalogTab} onClose={() => setCatalogOpen(false)} onSaveArea={updateArea} onSaveUnit={updateUnit} onSavePerson={updatePerson} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function StatCard({ value, label, tone }: { value: number; label: string; tone: string }) { return <article className={`stat-card ${tone}`}><span>{value}</span><p>{label}</p></article>; }

function initiativeBelongsTo(initiative: Initiative, scope: string) {
  if (scope === "brand") return !initiative.scopeType || initiative.scopeType === "brand";
  return initiative.scopeType === "units" && initiative.unitIds.includes(scope);
}

function upsertCatalog<T extends { id: string; sortOrder: number }>(current: T[], updated: T, defaults: T[]) {
  const next = current.some((item) => item.id === updated.id) ? current.map((item) => item.id === updated.id ? updated : item) : [...current, updated];
  return mergeCatalog(defaults, next).sort((a, b) => a.sortOrder - b.sortOrder);
}

function getRollingMonths() {
  const formatter = new Intl.DateTimeFormat("es-MX", { month: "long" });
  return Array.from({ length: 12 }, (_, index) => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() + index); const month = formatter.format(date); return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: month.charAt(0).toUpperCase() + month.slice(1), short: month.slice(0, 3).toUpperCase(), year: date.getFullYear() }; });
}

function loadLocalInitiatives(): Initiative[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return (JSON.parse(stored) as Initiative[]).map(normalizeLocalInitiative); } catch { window.localStorage.removeItem(STORAGE_KEY); } }
  return [createSampleInitiative()];
}

function loadLocalCatalog<T extends { id: string }>(key: string, defaults: T[]): T[] { const stored = window.localStorage.getItem(key); if (!stored) return defaults; try { return mergeCatalog(defaults, JSON.parse(stored) as T[]); } catch { return defaults; } }

function createSampleInitiative(): Initiative {
  const now = new Date(); const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; const eventDate = `${key}-${String(Math.min(now.getDate() + 10, 28)).padStart(2, "0")}`; const stamp = now.toISOString();
  return { id: "local-demo-windsor-eats", title: "Food Truck · Windsor Eats", description: "Preparar la participación de Hot Tacos y coordinar la operación completa del evento.", monthKey: key, eventDate, location: "Downtown Windsor", owner: "Alain", status: "in_progress", scopeType: "units", unitIds: ["htft"], createdAt: stamp, updatedAt: stamp, areas: [
    { id: "demo-ops", catalogAreaId: "operations", name: "Operaciones", status: "in_progress", tasks: [{ id: "demo-task-1", title: "Confirmar equipo y horarios", owner: "Gerencia", dueDate: eventDate, status: "in_progress", notes: [] }] },
    { id: "demo-buy", catalogAreaId: "purchasing", name: "Compras", status: "under_review", tasks: [{ id: "demo-task-2", title: "Cotizar insumos del evento", owner: "Compras", dueDate: eventDate, status: "pending", notes: [] }] },
    { id: "demo-marketing", catalogAreaId: "marketing", name: "Marketing", status: "ready", tasks: [{ id: "demo-task-3", title: "Publicar anuncio", owner: "Marketing", dueDate: eventDate, status: "done", notes: [] }] },
  ] };
}

function normalizeLocalInitiative(item: Initiative): Initiative {
  return {
    ...item,
    scopeType: item.scopeType ?? "brand",
    unitIds: item.unitIds ?? [],
    areas: (item.areas ?? []).map((area) => ({
      ...area,
      tasks: (area.tasks ?? []).map((task) => ({ ...task, notes: task.notes ?? [] })),
    })),
  };
}

function initiativeSearchText(initiative: Initiative, people: PortalPerson[]) {
  const initiativePerson = people.find((person) => person.id === initiative.ownerPersonId);
  return [
    initiative.title,
    initiative.description,
    initiative.location,
    initiative.owner,
    initiativePerson?.role,
    initiativePerson?.phone,
    initiativePerson?.email,
    initiative.ownerContact?.phone,
    initiative.ownerContact?.email,
    ...initiative.areas.flatMap((area) => [
      area.name,
      ...area.tasks.flatMap((task) => {
        const person = people.find((item) => item.id === task.ownerPersonId);
        return [
          task.title,
          task.owner,
          person?.role,
          person?.phone,
          person?.email,
          task.ownerContact?.phone,
          task.ownerContact?.email,
          ...(task.notes ?? []).map((note) => note.text),
        ];
      }),
    ]),
  ].filter(Boolean).join(" ");
}
