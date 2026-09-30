import type { InitiativeStatus, TaskStatus } from "@/types/initiative";

export const initiativeStatusLabels: Record<InitiativeStatus, string> = {
  notified: "Notificado",
  in_progress: "En proceso",
  under_review: "En revisión",
  ready: "Listo",
  blocked: "Bloqueado",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  done: "Terminada",
  blocked: "Bloqueada",
};

export const initiativeStatuses = Object.keys(
  initiativeStatusLabels,
) as InitiativeStatus[];

export const taskStatuses = Object.keys(taskStatusLabels) as TaskStatus[];

export function statusTone(status: InitiativeStatus | TaskStatus) {
  if (status === "ready" || status === "done") return "status-green";
  if (status === "blocked") return "status-red";
  if (status === "in_progress" || status === "under_review")
    return "status-yellow";
  return "status-gray";
}

