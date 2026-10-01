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

export interface PortalPerson {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  active: boolean;
  sortOrder: number;
  updatedAt?: string;
}

export interface PortalContact {
  phone: string;
  email: string;
}

export interface TaskNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface InitiativeTask {
  id: string;
  title: string;
  owner: string;
  ownerPersonId?: string;
  ownerContact?: PortalContact;
  dueDate: string;
  status: TaskStatus;
  notes: TaskNote[];
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
  ownerPersonId?: string;
  ownerContact?: PortalContact;
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
