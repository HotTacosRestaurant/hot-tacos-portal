"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { AdminLoginModal } from "@/components/portal/admin-login-modal";
import { AdminUsersModal } from "@/components/portal/admin-users-modal";
import { CatalogModal, type CatalogTab } from "@/components/portal/catalog-modal";
import { InitiativeCard } from "@/components/portal/initiative-card";
import { KpiDashboard } from "@/components/portal/kpi-dashboard";
import { InitiativeModal } from "@/components/portal/initiative-modal";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { getPortalErrorDetails } from "@/lib/firebase-errors";
import { isPortalSuperAdminEmail } from "@/lib/portal-admin-access";
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
type DataMode = "connecting" | "firebase" | "local" | "error";
type PortalView = "initiatives" | "kpis";

interface CriticalErrorState {
  title: string;
  message: string;
  code: string;
}

const ALLOW_LOCAL_DEVELOPMENT = process.env.NODE_ENV === "development";

export function PortalDashboard() {
  const months = useMemo(() => getRollingMonths(), []);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [areas, setAreas] = useState<PortalArea[]>(DEFAULT_AREAS);
  const [units, setUnits] = useState<PortalUnit[]>(DEFAULT_UNITS);
  const [people, setPeople] = useState<PortalPerson[]>(DEFAULT_PEOPLE);
  const [mode, setMode] = useState<DataMode>("connecting");
  const [selectedScope, setSelectedScope] = useState("brand");
  const [activeView, setActiveView] = useState<PortalView>("initiatives");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("areas");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [criticalError, setCriticalError] = useState<CriticalErrorState | null>(null);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isPortalAdmin, setIsPortalAdmin] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminUsersOpen, setAdminUsersOpen] = useState(false);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [pendingCatalog, setPendingCatalog] = useState<CatalogTab | null>(null);

  const isPortalSuperAdmin =
    isPortalAdmin && isPortalSuperAdminEmail(adminUser?.email);

  useEffect(() => {
    // Management Information is reserved exclusively for the three
    // super-admin identities. If the session expires or the user signs
    // out while viewing KPIs, immediately return to the operational view.
    if (!isPortalSuperAdmin && activeView === "kpis") {
      setActiveView("initiatives");
    }
  }, [isPortalSuperAdmin, activeView]);

  useEffect(() => {
    const authInstance = auth;
    const database = db;
    if (!authInstance) return;

    return onAuthStateChanged(authInstance, async (user) => {
      setAdminUser(user);
      setIsPortalAdmin(false);

      if (!user || !database) return;

      try {
        const accessDocument = await getDoc(doc(database, "portal_users", user.uid));
        const access = accessDocument.data() as { active?: boolean; role?: string } | undefined;
        const allowed = accessDocument.exists() && access?.active === true && access?.role === "admin";

        if (!allowed) {
          setCriticalError({
            title: "SIN PERMISOS ADMINISTRATIVOS",
            message: "La cuenta inició sesión correctamente, pero no está habilitada como administrador del portal.",
            code: "portal/not-admin",
          });
          await signOut(authInstance);
          return;
        }

        setIsPortalAdmin(true);
      } catch (error) {
        console.error("[Portal admin verification failed]", error);
        setCriticalError({
          title: "NO SE PUDO VALIDAR EL ACCESO",
          message: "Firebase Authentication inició sesión, pero Firestore no pudo confirmar los permisos administrativos.",
          code: "portal/admin-check-failed",
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!isPortalAdmin) return;

    setAuthOpen(false);
    if (pendingMonth) {
      setSelectedMonth(pendingMonth);
      setPendingMonth(null);
    }
    if (pendingCatalog) {
      setCatalogTab(pendingCatalog);
      setCatalogOpen(true);
      setPendingCatalog(null);
    }
  }, [isPortalAdmin, pendingMonth, pendingCatalog]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      queueMicrotask(() => {
        if (ALLOW_LOCAL_DEVELOPMENT) {
          setInitiatives(loadLocalInitiatives());
          setAreas(loadLocalCatalog(AREAS_STORAGE_KEY, DEFAULT_AREAS));
          setUnits(loadLocalCatalog(UNITS_STORAGE_KEY, DEFAULT_UNITS));
          setPeople(loadLocalCatalog(PEOPLE_STORAGE_KEY, DEFAULT_PEOPLE));
          setMode("local");
          return;
        }

        setMode("error");
        setConnectionError(
          "Firebase no está configurado en este despliegue. Los cambios están bloqueados para evitar guardar información sólo en este navegador.",
        );
      });
      return;
    }

    const ready = { initiatives: false, areas: false, units: false, people: false };
    const unsubscribers: Array<() => void> = [];

    function markReady(key: keyof typeof ready) {
      ready[key] = true;
      if (Object.values(ready).every(Boolean)) {
        setConnectionError(null);
        setMode("firebase");
      }
    }

    function markFailed(source: string, error: Error) {
      console.error(`[Firestore subscription failed: ${source}]`, error);
      const details = getPortalErrorDetails(error);
      setMode("error");
      setConnectionError(
        `${source}: no se pudo confirmar la lectura desde Firestore. Código: ${details.code}. Recarga la aplicación después de corregir el problema.`,
      );
    }

    try {
      unsubscribers.push(
        subscribeToInitiatives(
          (data) => {
            setInitiatives(data);
            markReady("initiatives");
          },
          (error) => markFailed("Iniciativas", error),
        ),
        subscribeToAreas(
          (data) => {
            setAreas(mergeCatalog(DEFAULT_AREAS, data));
            markReady("areas");
          },
          (error) => markFailed("Áreas", error),
        ),
        subscribeToUnits(
          (data) => {
            setUnits(mergeCatalog(DEFAULT_UNITS, data));
            markReady("units");
          },
          (error) => markFailed("Unidades", error),
        ),
        subscribeToPeople(
          (data) => {
            setPeople(data);
            markReady("people");
          },
          (error) => markFailed("Personal", error),
        ),
      );
    } catch (error) {
      const details = getPortalErrorDetails(error);
      console.error("[Firestore initialization failed]", error);
      queueMicrotask(() => {
        setMode("error");
        setConnectionError(
          `No se pudo iniciar Firestore. Código: ${details.code}. Recarga la aplicación después de revisar la configuración.`,
        );
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

  function ensureWriteAvailable(action: string) {
    if (mode === "firebase" || mode === "local") return;

    const error = new Error(
      `No se puede ${action} porque la aplicación no tiene una conexión confirmada con Firestore.`,
    ) as Error & { code?: string };
    error.code = "portal/not-ready";
    reportWriteFailure(action, error);
    throw error;
  }

  function reportWriteFailure(action: string, error: unknown) {
    const details = getPortalErrorDetails(error);
    console.error(`[Portal write failed: ${action}]`, error);
    setCriticalError({
      title: details.title,
      message: `${details.message} Acción: ${action}.`,
      code: details.code,
    });
  }

  function ensureAdmin(action: string) {
    if (mode === "local" || isPortalAdmin) return;

    setAuthOpen(true);
    const error = new Error(`Se requiere acceso administrativo para ${action}.`) as Error & { code?: string };
    error.code = "portal/admin-required";
    reportWriteFailure(action, error);
    throw error;
  }

  function requestCreateInitiative(monthKey: string) {
    if (mode === "local" || isPortalAdmin) {
      setSelectedMonth(monthKey);
      return;
    }

    setPendingMonth(monthKey);
    setAuthOpen(true);
  }

  async function addInitiative(draft: InitiativeDraft) {
    ensureWriteAvailable("crear la iniciativa");
    ensureAdmin("crear la iniciativa");
    setCriticalError(null);

    if (mode === "local") {
      const now = new Date().toISOString();
      saveLocalInitiatives([
        ...initiatives,
        { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now },
      ]);
      setToast("Iniciativa creada en modo local de desarrollo");
      return;
    }

    try {
      await createInitiative(draft);
      setToast("Iniciativa guardada en Firestore");
    } catch (error) {
      reportWriteFailure("crear la iniciativa", error);
      throw error;
    }
  }

  async function updateInitiative(updated: Initiative) {
    ensureWriteAvailable("actualizar la iniciativa");
    setCriticalError(null);
    const next = initiatives.map((item) =>
      item.id === updated.id
        ? { ...updated, updatedAt: new Date().toISOString() }
        : item,
    );

    if (mode === "local") {
      saveLocalInitiatives(next);
      return;
    }

    try {
      await saveInitiative(updated);
      setToast("Cambios guardados en Firestore");
    } catch (error) {
      reportWriteFailure("actualizar la iniciativa", error);
      throw error;
    }
  }

  async function deleteInitiative(id: string) {
    ensureWriteAvailable("eliminar la iniciativa");
    ensureAdmin("eliminar la iniciativa");
    setCriticalError(null);
    const next = initiatives.filter((item) => item.id !== id);

    if (mode === "local") {
      saveLocalInitiatives(next);
      setToast("Iniciativa eliminada en modo local de desarrollo");
      return;
    }

    try {
      await removeInitiative(id);
      setToast("Iniciativa eliminada");
    } catch (error) {
      reportWriteFailure("eliminar la iniciativa", error);
      throw error;
    }
  }

  async function updateArea(area: PortalArea) {
    ensureWriteAvailable("actualizar el catálogo de áreas");
    ensureAdmin("actualizar el catálogo de áreas");
    setCriticalError(null);
    const next = upsertCatalog(areas, area, DEFAULT_AREAS);

    if (mode === "local") {
      setAreas(next);
      window.localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(next));
      return;
    }

    try {
      await saveArea(area);
      setToast("Catálogo de áreas actualizado");
    } catch (error) {
      reportWriteFailure("actualizar el catálogo de áreas", error);
      throw error;
    }
  }

  async function updateUnit(unit: PortalUnit) {
    ensureWriteAvailable("actualizar el catálogo de unidades");
    ensureAdmin("actualizar el catálogo de unidades");
    setCriticalError(null);
    const next = upsertCatalog(units, unit, DEFAULT_UNITS);

    if (mode === "local") {
      setUnits(next);
      window.localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(next));
      return;
    }

    try {
      await saveUnit(unit);
      setToast("Catálogo de unidades actualizado");
    } catch (error) {
      reportWriteFailure("actualizar el catálogo de unidades", error);
      throw error;
    }
  }

  async function updatePerson(person: PortalPerson) {
    ensureWriteAvailable("actualizar el catálogo de personal");
    ensureAdmin("actualizar el catálogo de personal");
    setCriticalError(null);
    const next = upsertCatalog(people, person, DEFAULT_PEOPLE);

    if (mode === "local") {
      setPeople(next);
      window.localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(next));
      return;
    }

    try {
      await savePerson(person);
      setToast("Catálogo de personal actualizado");
    } catch (error) {
      reportWriteFailure("actualizar el catálogo de personal", error);
      throw error;
    }
  }

  function openCatalog(tab: CatalogTab) {
    if (mode === "local" || isPortalAdmin) {
      setCatalogTab(tab);
      setCatalogOpen(true);
      return;
    }

    setPendingCatalog(tab);
    setAuthOpen(true);
  }

  async function handleSignOut() {
    const authInstance = auth;
    if (!authInstance) return;
    await signOut(authInstance);
    setCatalogOpen(false);
    setAdminUsersOpen(false);
    setSelectedMonth(null);
    setActiveView("initiatives");
    setToast("Sesión administrativa cerrada");
  }

  return (
    <main className="portal-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Portal del Grupo Corporativo">
          <Image
              className="brand-logo"
              src="/bt-corporate-logo.svg"
              alt=""
              width={42}
              height={42}
              priority
            />
           <span><strong>GRUPO CORPORATIVO</strong><small>PORTAL INTERNO</small></span></a>
        <nav className="main-nav" aria-label="Navegación principal">
          <button className={`nav-button ${activeView === "initiatives" ? "active" : ""}`} type="button" onClick={() => setActiveView("initiatives")}>Iniciativas</button>
          {isPortalSuperAdmin && (
            <button
              className={`nav-button ${activeView === "kpis" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveView("kpis")}
            >
              KPIs
            </button>
          )}
          <button className="nav-button" type="button" onClick={() => openCatalog("areas")}>Catálogos</button>
          <button className="nav-button" type="button" onClick={() => openCatalog("people")}>Equipo</button>
        </nav>
        <div className="user-menu">
          {isPortalAdmin ? (
            <>
              <span className="avatar dark">A</span>
              <span>{adminUser?.email ?? "Administración"}</span>
              {isPortalSuperAdmin && (
                <button
                  className="user-action master-admin-action"
                  type="button"
                  onClick={() => setAdminUsersOpen(true)}
                >
                  Administradores
                </button>
              )}
              <button className="user-action" type="button" onClick={() => void handleSignOut()}>Salir</button>
            </>
          ) : (
            <button className="admin-login-button" type="button" onClick={() => setAuthOpen(true)}>
              <span className="avatar dark">A</span>
              <span>Acceso admin</span>
            </button>
          )}
        </div>
      </header>

      <div className="portal-content" id="top">
        {mode === "connecting" && (
          <div className="mode-banner" role="status">
            <span>Conectando</span>
            Confirmando conexión con Firestore. No cierres la aplicación mientras carga.
          </div>
        )}
        {mode === "local" && (
          <div className="mode-banner" role="status">
            <span>Desarrollo local</span>
            Firestore no está configurado. Este modo sólo está habilitado durante desarrollo y los cambios viven únicamente en este navegador.
          </div>
        )}
        {mode === "error" && (
          <div className="mode-banner denied" role="alert">
            <span>Firestore sin confirmar</span>
            <strong>Los cambios están bloqueados.</strong> {connectionError}
            <button className="banner-action" type="button" onClick={() => window.location.reload()}>Recargar</button>
          </div>
        )}

        <section className="hero" id="initiatives">
          {activeView !== "kpis" || !isPortalSuperAdmin ? (
            <>
              <div><p className="eyebrow">Centro de coordinación</p><h1>Iniciativas</h1><p>Planea eventos y proyectos, asigna responsables y da seguimiento a cada área.</p></div>
              <button className="button button-primary hero-button" type="button" onClick={() => requestCreateInitiative(months[0].key)}><span aria-hidden="true">＋</span> Nueva iniciativa</button>
            </>
          ) : (
            <div><p className="eyebrow">Management information</p><h1>KPIs</h1><p>Detecta retrasos, falta de actualización, carga por área e integrante y tendencias de ejecución.</p></div>
          )}
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

        {activeView === "kpis" && isPortalSuperAdmin ? (
          <KpiDashboard
            initiatives={initiatives}
            units={units}
            people={people}
            selectedScope={selectedScope}
            scopeTitle={scopeTitle}
            onOpenInitiative={(title) => {
              setQuery(title);
              setPersonFilter("all");
              setTaskStatusFilter("all");
              setStatusFilter("all");
              setActiveView("initiatives");
            }}
          />
        ) : (
          <>
        <div className="view-heading"><div><span>Mostrando iniciativas de</span><h2>{scopeTitle}</h2></div><span className={`data-indicator ${mode}`}>{modeLabel(mode)}</span></div>

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
                  <div className="month-heading"><div><h2>{month.label}</h2><span>{monthInitiatives.length} {monthInitiatives.length === 1 ? "iniciativa" : "iniciativas"}</span></div><button className="add-month" type="button" onClick={() => requestCreateInitiative(month.key)}>＋ Agregar</button></div>
                  {monthInitiatives.length ? <div className="initiative-list">{monthInitiatives.map((initiative) => <InitiativeCard key={initiative.id} initiative={initiative} units={units} people={people} canDelete={mode === "local" || isPortalAdmin} onChange={updateInitiative} onDelete={deleteInitiative} />)}</div> : <button className="empty-month" type="button" onClick={() => requestCreateInitiative(month.key)}><span>＋</span><strong>Sin iniciativas planeadas</strong><small>Agrega la primera iniciativa de {month.label.toLowerCase()} para {scopeTitle}</small></button>}
                </div>
              </section>
            );
          })}
        </div>
          </>
        )}
      </div>

      {selectedMonth && (mode === "local" || isPortalAdmin) && <InitiativeModal monthKey={selectedMonth} areas={areas} units={units} people={people} initialScopeType={selectedScope === "brand" ? "brand" : "units"} initialUnitIds={selectedScope === "brand" ? [] : [selectedScope]} onClose={() => setSelectedMonth(null)} onSubmit={addInitiative} />}
      {catalogOpen && (mode === "local" || isPortalAdmin) && <CatalogModal areas={areas} units={units} people={people} initialTab={catalogTab} onClose={() => setCatalogOpen(false)} onSaveArea={updateArea} onSaveUnit={updateUnit} onSavePerson={updatePerson} />}
      {adminUsersOpen && isPortalSuperAdmin && (
        <AdminUsersModal
          currentUserId={adminUser?.uid ?? null}
          onClose={() => setAdminUsersOpen(false)}
        />
      )}
      {authOpen && !isPortalAdmin && <AdminLoginModal onClose={() => { setAuthOpen(false); setPendingMonth(null); setPendingCatalog(null); }} />}
      {criticalError && (
        <div className="critical-alert" role="alert" aria-live="assertive">
          <div className="critical-alert-icon" aria-hidden="true">!</div>
          <div>
            <strong>{criticalError.title}</strong>
            <p>{criticalError.message}</p>
            <small>Código: {criticalError.code}</small>
          </div>
          <button type="button" onClick={() => setCriticalError(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function modeLabel(mode: DataMode) {
  if (mode === "firebase") return "● Firestore conectado";
  if (mode === "connecting") return "● Conectando";
  if (mode === "error") return "● Firestore sin confirmar";
  return "● Local desarrollo";
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
