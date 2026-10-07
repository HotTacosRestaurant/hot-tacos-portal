"use client";

import { useMemo, useState, type ReactNode } from "react";

import { initiativeStatusLabels } from "@/components/portal/status";
import {
  areaFilterOptions,
  buildPortalKpis,
  type BreakdownMetric,
  type KpiHealth,
} from "@/lib/portal-kpis";
import type { Initiative, InitiativeStatus, PortalPerson, PortalUnit } from "@/types/initiative";

interface KpiDashboardProps {
  initiatives: Initiative[];
  units: PortalUnit[];
  people: PortalPerson[];
  selectedScope: string;
  scopeTitle: string;
  onOpenInitiative: (title: string) => void;
  readOnly?: boolean;
}

export function KpiDashboard({
  initiatives,
  units,
  people,
  selectedScope,
  scopeTitle,
  onOpenInitiative,
  readOnly = false,
}: KpiDashboardProps) {
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InitiativeStatus | "all">("all");
  const [healthFilter, setHealthFilter] = useState<KpiHealth | "all">("all");

  const areas = useMemo(() => areaFilterOptions(initiatives), [initiatives]);
  const snapshot = useMemo(
    () => buildPortalKpis(initiatives, units, people, {
      scope: selectedScope,
      query,
      area: areaFilter,
      person: personFilter,
      status: statusFilter,
      health: healthFilter,
    }),
    [initiatives, units, people, selectedScope, query, areaFilter, personFilter, statusFilter, healthFilter],
  );

  const maxMonthly = Math.max(1, ...snapshot.monthly.map((item) => item.total));

  return (
    <section className="kpi-dashboard" aria-label="Dashboard de KPIs">
      <div className="kpi-heading">
        <div>
          <span>Management information</span>
          <h2>KPIs de ejecución · {scopeTitle}</h2>
          <p>Semáforos y métricas calculados directamente sobre iniciativas y actividades registradas en Firestore.</p>
        </div>
        <div className="kpi-definition-note">Stale = más de 7 días sin actualización</div>
      </div>

      <div className="kpi-toolbar">
        <label className="search-box kpi-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar iniciativa, actividad, nota o contacto" />
        </label>
        <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} aria-label="Filtrar KPIs por área">
          <option value="all">Todas las áreas</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)} aria-label="Filtrar KPIs por integrante">
          <option value="all">Todos los integrantes</option>
          {people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InitiativeStatus | "all")} aria-label="Filtrar KPIs por estado">
          <option value="all">Todos los estados</option>
          {(Object.keys(initiativeStatusLabels) as InitiativeStatus[]).map((status) => <option key={status} value={status}>{initiativeStatusLabels[status]}</option>)}
        </select>
        <select value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as KpiHealth | "all")} aria-label="Filtrar KPIs por semáforo">
          <option value="all">Todos los semáforos</option>
          <option value="green">Verde · saludable</option>
          <option value="yellow">Amarillo · riesgo</option>
          <option value="red">Rojo · atención</option>
        </select>
      </div>

      <div className="kpi-card-grid">
        <KpiCard value={snapshot.totalInitiatives} label="Iniciativas" detail={`${snapshot.activeInitiatives} activas`} />
        <KpiCard value={snapshot.pastOpenInitiatives} label="Ya ocurrieron y siguen abiertas" detail={`${snapshot.pastInitiatives} ya ocurrieron`} tone={snapshot.pastOpenInitiatives ? "red" : "green"} />
        <KpiCard value={snapshot.upcomingInitiatives} label="Por venir" detail="Fecha de iniciativa vigente o futura" tone="blue" />
        <KpiCard value={snapshot.overdueTasks} label="Actividades vencidas" detail={`${snapshot.blockedTasks} bloqueadas`} tone={snapshot.overdueTasks ? "red" : "green"} />
        <KpiCard value={snapshot.staleInitiatives} label="Sin actualización > 7 días" detail="Iniciativas activas" tone={snapshot.staleInitiatives ? "yellow" : "green"} />
        <KpiCard value={snapshot.readyInitiatives} label="Iniciativas listas" detail={`${snapshot.blockedInitiatives} bloqueadas`} tone="green" />
      </div>

      <div className="kpi-gauge-grid">
        <Gauge value={snapshot.taskCompletionRate} label="Cumplimiento de actividades" caption={`${snapshot.doneTasks} de ${snapshot.totalTasks} terminadas`} />
        <Gauge value={snapshot.freshnessRate} label="Actualización vigente" caption="Activas actualizadas en ≤ 7 días" />
        <Gauge value={snapshot.closureRate} label="Cierre de iniciativas pasadas" caption="Eventos pasados marcados como listos" />
        <HealthGauge green={snapshot.health.green} yellow={snapshot.health.yellow} red={snapshot.health.red} />
      </div>

      <div className="kpi-two-column">
        <Panel title="Estatus de iniciativas" subtitle="Distribución actual">
          <StatusDistribution snapshot={snapshot.status} total={snapshot.totalInitiatives} />
        </Panel>
        <Panel title="Excepciones a revisar" subtitle="Primero rojas, después amarillas">
          <div className="exception-list">
            {snapshot.exceptions.length ? snapshot.exceptions.map(({ initiative, detail }) => (
              readOnly ? (
                <div key={initiative.id} className="exception-row read-only">
                  <span className={`traffic-dot ${detail.health}`} aria-hidden="true" />
                  <span className="exception-copy">
                    <strong>{initiative.title}</strong>
                    <small>{detail.reasons.join(" · ")}</small>
                  </span>
                  <span className="exception-date">{formatDate(initiative.eventDate)}</span>
                </div>
              ) : (
                <button key={initiative.id} type="button" className="exception-row" onClick={() => onOpenInitiative(initiative.title)}>
                  <span className={`traffic-dot ${detail.health}`} aria-hidden="true" />
                  <span className="exception-copy">
                    <strong>{initiative.title}</strong>
                    <small>{detail.reasons.join(" · ")}</small>
                  </span>
                  <span className="exception-date">{formatDate(initiative.eventDate)}</span>
                </button>
              )
            )) : <div className="kpi-empty">No hay excepciones con los filtros actuales.</div>}
          </div>
        </Panel>
      </div>

      <div className="kpi-section-grid">
        <MetricPanel title="Por compañía / unidad" subtitle="Iniciativas asignadas directamente a cada ámbito" rows={snapshot.byUnit} />
        <MetricPanel title="Por área" subtitle="Cumplimiento calculado con actividades" rows={snapshot.byArea} />
      </div>

      <Panel title="Por integrante" subtitle="Basado en actividades asignadas; sirve para detectar carga, vencimientos y bloqueos, no para calificar desempeño por sí solo.">
        <MetricTable rows={snapshot.byPerson} empty="No hay actividades asignadas a integrantes con los filtros actuales." />
      </Panel>

      <Panel title="Histórico y próximas iniciativas" subtitle="Mes de la fecha programada. “Abiertas vencidas” identifica iniciativas cuya fecha ya pasó y no están marcadas como listas.">
        <div className="monthly-chart" role="img" aria-label="Iniciativas por mes">
          {snapshot.monthly.map((month) => (
            <div className="month-bar-column" key={month.key}>
              <div className="month-bar-stack" title={`${month.total} iniciativas`}>
                <span className="month-bar total" style={{ height: `${Math.max(4, (month.total / maxMonthly) * 100)}%` }} />
                {month.openPast > 0 && <span className="month-bar overdue" style={{ height: `${Math.max(4, (month.openPast / maxMonthly) * 100)}%` }} />}
              </div>
              <strong>{month.total}</strong>
              <span>{month.label}</span>
              {month.openPast > 0 && <small>{month.openPast} abierta{month.openPast === 1 ? "" : "s"}</small>}
            </div>
          ))}
        </div>
        <div className="chart-legend"><span><i className="legend-total" /> Programadas</span><span><i className="legend-overdue" /> Abiertas después de fecha</span></div>
      </Panel>

      <div className="kpi-footnote">
        <strong>Base para Data Mart:</strong> estos KPIs usan la misma semántica que podremos llevar después a hechos y dimensiones. Los timestamps individuales nuevos se capturan en actividades/áreas desde esta versión; los registros históricos anteriores pueden no tener ese detalle.
      </div>
    </section>
  );
}

function KpiCard({ value, label, detail, tone = "dark" }: { value: number; label: string; detail: string; tone?: "dark" | "red" | "yellow" | "green" | "blue" }) {
  return <article className={`kpi-card ${tone}`}><strong>{value}</strong><span>{label}</span><small>{detail}</small></article>;
}

function Gauge({ value, label, caption }: { value: number; label: string; caption: string }) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <article className="gauge-card">
      <div className="gauge-ring" style={{ background: `conic-gradient(#27875d ${bounded * 3.6}deg, #ebe7e0 0deg)` }}>
        <div><strong>{bounded}%</strong></div>
      </div>
      <div><strong>{label}</strong><span>{caption}</span></div>
    </article>
  );
}

function HealthGauge({ green, yellow, red }: { green: number; yellow: number; red: number }) {
  const total = green + yellow + red;
  const greenDegrees = total ? (green / total) * 360 : 0;
  const yellowDegrees = total ? (yellow / total) * 360 : 0;
  const background = total
    ? `conic-gradient(#27875d 0deg ${greenDegrees}deg, #f2b843 ${greenDegrees}deg ${greenDegrees + yellowDegrees}deg, #c8382d ${greenDegrees + yellowDegrees}deg 360deg)`
    : "#ebe7e0";
  return (
    <article className="gauge-card health-gauge-card">
      <div className="gauge-ring" style={{ background }}><div><strong>{total}</strong></div></div>
      <div><strong>Semáforo operativo</strong><span><i className="traffic-dot green" /> {green} &nbsp; <i className="traffic-dot yellow" /> {yellow} &nbsp; <i className="traffic-dot red" /> {red}</span></div>
    </article>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="kpi-panel"><header><div><h3>{title}</h3><p>{subtitle}</p></div></header>{children}</section>;
}

function MetricPanel({ title, subtitle, rows }: { title: string; subtitle: string; rows: BreakdownMetric[] }) {
  return <Panel title={title} subtitle={subtitle}><MetricTable rows={rows} empty="No hay datos con los filtros actuales." compact /></Panel>;
}

function MetricTable({ rows, empty, compact = false }: { rows: BreakdownMetric[]; empty: string; compact?: boolean }) {
  const visibleRows = compact ? rows.slice(0, 8) : rows.slice(0, 12);
  if (!visibleRows.length) return <div className="kpi-empty">{empty}</div>;
  return (
    <div className="metric-table">
      <div className="metric-table-head"><span>Entidad</span><span>Inic.</span><span>Tareas</span><span>Venc.</span><span>Bloq.</span><span>Cumpl.</span></div>
      {visibleRows.map((row) => (
        <div className="metric-table-row" key={row.id}>
          <span className="metric-name"><i className={`traffic-dot ${row.health}`} /><strong>{row.code ? `${row.code} · ` : ""}{row.label}</strong></span>
          <span>{row.initiatives}</span><span>{row.tasks}</span><span>{row.overdueTasks}</span><span>{row.blockedTasks}</span>
          <span className="metric-progress"><b style={{ width: `${row.completionRate}%` }} /><em>{row.completionRate}%</em></span>
        </div>
      ))}
    </div>
  );
}

function StatusDistribution({ snapshot, total }: { snapshot: Record<InitiativeStatus, number>; total: number }) {
  return (
    <div className="status-distribution">
      {(Object.keys(initiativeStatusLabels) as InitiativeStatus[]).map((status) => {
        const count = snapshot[status];
        const width = total ? Math.round((count / total) * 100) : 0;
        return <div className="status-bar-row" key={status}><span>{initiativeStatusLabels[status]}</span><div><b className={`status-fill status-${status}`} style={{ width: `${width}%` }} /></div><strong>{count}</strong></div>;
      })}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
