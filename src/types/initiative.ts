export type InitiativeStatus =
  | "notified"
  | "in_progress"
  | "under_review"
  | "ready"
  | "blocked";

export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export type InitiativeScopeType = "brand" | "units";

export interface PortalArea {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  updatedAt?: string;
}

export interface PortalUnit {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  updatedAt?: string;
}

export interface InitiativeTask {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
}

export interface InitiativeArea {
  id: string;
  catalogAreaId?: string;
  name: string;
  status: InitiativeStatus;
  tasks: InitiativeTask[];
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  monthKey: string;
  eventDate: string;
  location: string;
  owner: string;
  status: InitiativeStatus;
  scopeType: InitiativeScopeType;
  unitIds: string[];
  areas: InitiativeArea[];
  createdAt: string;
  updatedAt: string;
}

export type InitiativeDraft = Omit<
  Initiative,
  "id" | "createdAt" | "updatedAt"
>;
