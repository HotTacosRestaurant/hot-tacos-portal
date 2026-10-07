import type {
  Initiative,
  InitiativeArea,
  InitiativeStatus,
  InitiativeTask,
  PortalPerson,
  PortalUnit,
} from "@/types/initiative";

export type KpiHealth = "green" | "yellow" | "red";

export interface PortalKpiFilters {
  scope: string;
  query?: string;
  area?: string;
  person?: string;
  status?: InitiativeStatus | "all";
  health?: KpiHealth | "all";
}

export interface HealthDetail {
  health: KpiHealth;
  reasons: string[];
  overdueTasks: number;
  blockedTasks: number;
  staleDays: number;
}

export interface BreakdownMetric {
  id: string;
  label: string;
  code?: string;
  initiatives: number;
  tasks: number;
  doneTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  completionRate: number;
  health: KpiHealth;
}

export interface MonthlyMetric {
  key: string;
  label: string;
  total: number;
  ready: number;
  openPast: number;
  future: number;
}

export interface PortalKpiSnapshot {
  initiatives: Initiative[];
  totalInitiatives: number;
  activeInitiatives: number;
  readyInitiatives: number;
  blockedInitiatives: number;
  pastInitiatives: number;
  upcomingInitiatives: number;
  pastOpenInitiatives: number;
  staleInitiatives: number;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  taskCompletionRate: number;
  freshnessRate: number;
  closureRate: number;
  health: Record<KpiHealth, number>;
  status: Record<InitiativeStatus, number>;
  byUnit: BreakdownMetric[];
  byArea: BreakdownMetric[];
  byPerson: BreakdownMetric[];
  monthly: MonthlyMetric[];
  exceptions: Array<{ initiative: Initiative; detail: HealthDetail }>;
}

const STALE_DAYS = 7;

export function buildPortalKpis(
  initiatives: Initiative[],
  units: PortalUnit[],
  people: PortalPerson[],
  filters: PortalKpiFilters,
  now = new Date(),
): PortalKpiSnapshot {
  const filtered = filterInitiativesForKpis(initiatives, people, filters, now);
  const allTasks = filtered.flatMap((initiative) =>
    initiative.areas.flatMap((area) => area.tasks.map((task) => ({ initiative, area, task }))),
  );

  const doneTasks = allTasks.filter(({ task }) => task.status === "done").length;
  const overdueTasks = allTasks.filter(({ task }) => isTaskOverdue(task, now)).length;
  const blockedTasks = allTasks.filter(({ task }) => task.status === "blocked").length;
  const past = filtered.filter((initiative) => isPastDate(initiative.eventDate, now));
  const readyPast = past.filter((initiative) => initiative.status === "ready").length;
  const staleInitiatives = filtered.filter(
    (initiative) => initiative.status !== "ready" && daysSince(initiative.updatedAt, now) > STALE_DAYS,
  ).length;

  const health = filtered.reduce<Record<KpiHealth, number>>(
    (accumulator, initiative) => {
      accumulator[getInitiativeHealth(initiative, now).health] += 1;
      return accumulator;
    },
    { green: 0, yellow: 0, red: 0 },
  );

  const status = filtered.reduce<Record<InitiativeStatus, number>>(
    (accumulator, initiative) => {
      accumulator[initiative.status] += 1;
      return accumulator;
    },
    { notified: 0, in_progress: 0, under_review: 0, ready: 0, blocked: 0 },
  );

  const exceptions = filtered
    .map((initiative) => ({ initiative, detail: getInitiativeHealth(initiative, now) }))
    .filter(({ detail }) => detail.health !== "green")
    .sort((a, b) => {
      const rank = { red: 0, yellow: 1, green: 2 };
      const healthDifference = rank[a.detail.health] - rank[b.detail.health];
      if (healthDifference !== 0) return healthDifference;
      return a.initiative.eventDate.localeCompare(b.initiative.eventDate);
    })
    .slice(0, 10);

  return {
    initiatives: filtered,
    totalInitiatives: filtered.length,
    activeInitiatives: filtered.filter((initiative) => initiative.status !== "ready").length,
    readyInitiatives: filtered.filter((initiative) => initiative.status === "ready").length,
    blockedInitiatives: filtered.filter((initiative) => initiative.status === "blocked").length,
    pastInitiatives: past.length,
    upcomingInitiatives: filtered.filter((initiative) => !isPastDate(initiative.eventDate, now)).length,
    pastOpenInitiatives: past.filter((initiative) => initiative.status !== "ready").length,
    staleInitiatives,
    totalTasks: allTasks.length,
    doneTasks,
    overdueTasks,
    blockedTasks,
    taskCompletionRate: percentage(doneTasks, allTasks.length),
    freshnessRate: percentage(filtered.length - staleInitiatives, filtered.length),
    closureRate: percentage(readyPast, past.length),
    health,
    status,
    byUnit: buildUnitBreakdown(filtered, units, now),
    byArea: buildAreaBreakdown(filtered, now),
    byPerson: buildPersonBreakdown(filtered, people, now),
    monthly: buildMonthlyHistory(filtered, now),
    exceptions,
  };
}

export function filterInitiativesForKpis(
  initiatives: Initiative[],
  people: PortalPerson[],
  filters: PortalKpiFilters,
  now = new Date(),
) {
  const normalizedQuery = filters.query?.trim().toLocaleLowerCase("es") ?? "";

  return initiatives.filter((initiative) => {
    if (!initiativeBelongsToKpiScope(initiative, filters.scope)) return false;
    if (filters.status && filters.status !== "all" && initiative.status !== filters.status) return false;
    if (filters.health && filters.health !== "all" && getInitiativeHealth(initiative, now).health !== filters.health) return false;

    if (filters.area && filters.area !== "all") {
      const hasArea = initiative.areas.some(
        (area) => area.catalogAreaId === filters.area || normalizeKey(area.name) === filters.area,
      );
      if (!hasArea) return false;
    }

    if (filters.person && filters.person !== "all") {
      const hasPerson =
        initiative.ownerPersonId === filters.person ||
        initiative.areas.some((area) => area.tasks.some((task) => task.ownerPersonId === filters.person));
      if (!hasPerson) return false;
    }

    if (normalizedQuery) {
      const text = initiativeSearchText(initiative, people).toLocaleLowerCase("es");
      if (!text.includes(normalizedQuery)) return false;
    }

    return true;
  });
}

export function getInitiativeHealth(initiative: Initiative, now = new Date()): HealthDetail {
  const tasks = initiative.areas.flatMap((area) => area.tasks);
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task, now)).length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const staleDays = daysSince(initiative.updatedAt, now);
  const reasons: string[] = [];

  if (initiative.status === "blocked") reasons.push("Iniciativa bloqueada");
  if (blockedTasks > 0) reasons.push(`${blockedTasks} ${blockedTasks === 1 ? "actividad bloqueada" : "actividades bloqueadas"}`);
  if (overdueTasks > 0) reasons.push(`${overdueTasks} ${overdueTasks === 1 ? "actividad vencida" : "actividades vencidas"}`);
  if (initiative.status !== "ready" && isPastDate(initiative.eventDate, now)) reasons.push("Fecha de la iniciativa ya pasó");

  if (reasons.length > 0) {
    return { health: "red", reasons, overdueTasks, blockedTasks, staleDays };
  }

  if (initiative.status !== "ready" && staleDays > STALE_DAYS) {
    reasons.push(`Sin actualización hace ${staleDays} días`);
  }

  if (initiative.status !== "ready" && isWithinDays(initiative.eventDate, now, 7)) {
    reasons.push("Ocurre dentro de los próximos 7 días");
  }

  if (reasons.length > 0) {
    return { health: "yellow", reasons, overdueTasks, blockedTasks, staleDays };
  }

  return {
    health: "green",
    reasons: initiative.status === "ready" ? ["Cerrada"] : ["Sin alertas operativas"],
    overdueTasks,
    blockedTasks,
    staleDays,
  };
}

function buildUnitBreakdown(initiatives: Initiative[], units: PortalUnit[], now: Date) {
  const rows: BreakdownMetric[] = [];
  const brandInitiatives = initiatives.filter((initiative) => initiative.scopeType === "brand");
  if (brandInitiatives.length) rows.push(buildBreakdownMetric("brand", "Global", brandInitiatives, now, "GC"));

  for (const unit of units.filter((item) => item.active)) {
    const matching = initiatives.filter(
      (initiative) => initiative.scopeType === "units" && initiative.unitIds.includes(unit.id),
    );
    if (matching.length) rows.push(buildBreakdownMetric(unit.id, unit.name, matching, now, unit.code));
  }

  return rows.sort((a, b) => b.initiatives - a.initiatives || a.label.localeCompare(b.label));
}

function buildAreaBreakdown(initiatives: Initiative[], now: Date) {
  const groups = new Map<string, { label: string; initiatives: Set<string>; tasks: InitiativeTask[]; blockedAreas: number }>();

  for (const initiative of initiatives) {
    for (const area of initiative.areas) {
      const id = area.catalogAreaId ?? normalizeKey(area.name);
      const group = groups.get(id) ?? { label: area.name, initiatives: new Set<string>(), tasks: [], blockedAreas: 0 };
      group.initiatives.add(initiative.id);
      group.tasks.push(...area.tasks);
      if (area.status === "blocked") group.blockedAreas += 1;
      groups.set(id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => {
      const done = group.tasks.filter((task) => task.status === "done").length;
      const overdue = group.tasks.filter((task) => isTaskOverdue(task, now)).length;
      const blocked = group.tasks.filter((task) => task.status === "blocked").length + group.blockedAreas;
      return {
        id,
        label: group.label,
        initiatives: group.initiatives.size,
        tasks: group.tasks.length,
        doneTasks: done,
        overdueTasks: overdue,
        blockedTasks: blocked,
        completionRate: percentage(done, group.tasks.length),
        health: metricHealth(overdue, blocked, percentage(done, group.tasks.length)),
      } satisfies BreakdownMetric;
    })
    .sort((a, b) => b.overdueTasks - a.overdueTasks || b.blockedTasks - a.blockedTasks || a.label.localeCompare(b.label));
}

function buildPersonBreakdown(initiatives: Initiative[], people: PortalPerson[], now: Date) {
  const groups = new Map<string, { label: string; initiativeIds: Set<string>; tasks: InitiativeTask[] }>();

  for (const initiative of initiatives) {
    for (const area of initiative.areas) {
      for (const task of area.tasks) {
        const person = people.find((item) => item.id === task.ownerPersonId);
        const id = task.ownerPersonId ? `person:${task.ownerPersonId}` : `name:${normalizeKey(task.owner)}`;
        const group = groups.get(id) ?? {
          label: person?.name ?? task.owner,
          initiativeIds: new Set<string>(),
          tasks: [],
        };
        group.initiativeIds.add(initiative.id);
        group.tasks.push(task);
        groups.set(id, group);
      }
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => {
      const done = group.tasks.filter((task) => task.status === "done").length;
      const overdue = group.tasks.filter((task) => isTaskOverdue(task, now)).length;
      const blocked = group.tasks.filter((task) => task.status === "blocked").length;
      const completion = percentage(done, group.tasks.length);
      return {
        id,
        label: group.label,
        initiatives: group.initiativeIds.size,
        tasks: group.tasks.length,
        doneTasks: done,
        overdueTasks: overdue,
        blockedTasks: blocked,
        completionRate: completion,
        health: metricHealth(overdue, blocked, completion),
      } satisfies BreakdownMetric;
    })
    .sort((a, b) => b.overdueTasks - a.overdueTasks || b.blockedTasks - a.blockedTasks || a.label.localeCompare(b.label));
}

function buildBreakdownMetric(
  id: string,
  label: string,
  initiatives: Initiative[],
  now: Date,
  code?: string,
): BreakdownMetric {
  const tasks = initiatives.flatMap((initiative) => initiative.areas.flatMap((area) => area.tasks));
  const done = tasks.filter((task) => task.status === "done").length;
  const overdue = tasks.filter((task) => isTaskOverdue(task, now)).length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const completion = percentage(done, tasks.length);
  return {
    id,
    label,
    code,
    initiatives: initiatives.length,
    tasks: tasks.length,
    doneTasks: done,
    overdueTasks: overdue,
    blockedTasks: blocked,
    completionRate: completion,
    health: metricHealth(overdue, blocked, completion),
  };
}

function buildMonthlyHistory(initiatives: Initiative[], now: Date): MonthlyMetric[] {
  const formatter = new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" });
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const items = initiatives.filter((initiative) => initiative.eventDate.startsWith(key));
    return {
      key,
      label: formatter.format(date).replace(" ", " ’"),
      total: items.length,
      ready: items.filter((initiative) => initiative.status === "ready").length,
      openPast: items.filter((initiative) => isPastDate(initiative.eventDate, now) && initiative.status !== "ready").length,
      future: items.filter((initiative) => !isPastDate(initiative.eventDate, now)).length,
    };
  });
}

function metricHealth(overdue: number, blocked: number, completionRate: number): KpiHealth {
  if (blocked > 0 || overdue > 0) return "red";
  if (completionRate < 70) return "yellow";
  return "green";
}

function initiativeBelongsToKpiScope(initiative: Initiative, scope: string) {
  if (scope === "brand") return true;
  if (initiative.scopeType === "brand") return true;
  return initiative.unitIds.includes(scope);
}

function isTaskOverdue(task: InitiativeTask, now: Date) {
  return task.status !== "done" && isPastDate(task.dueDate, now);
}

function isPastDate(value: string, now: Date) {
  const date = new Date(`${value}T23:59:59`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < startOfToday(now).getTime();
}

function isWithinDays(value: string, now: Date, days: number) {
  const date = new Date(`${value}T23:59:59`);
  if (Number.isNaN(date.getTime())) return false;
  const start = startOfToday(now).getTime();
  const end = start + days * 86_400_000;
  return date.getTime() >= start && date.getTime() <= end;
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysSince(value: string | undefined, now: Date) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("es").replace(/\s+/g, "-");
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

export function areaFilterOptions(initiatives: Initiative[]) {
  const values = new Map<string, string>();
  initiatives.forEach((initiative) => initiative.areas.forEach((area) => {
    values.set(area.catalogAreaId ?? normalizeKey(area.name), area.name);
  }));
  return [...values.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function healthLabel(health: KpiHealth) {
  if (health === "red") return "Atención";
  if (health === "yellow") return "Riesgo";
  return "Saludable";
}

export function areaTimestamp(area: InitiativeArea, fallback: string) {
  return area.updatedAt ?? fallback;
}
