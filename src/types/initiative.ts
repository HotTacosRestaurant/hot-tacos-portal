export type InitiativeStatus =
  | "notified"
  | "in_progress"
  | "under_review"
  | "ready"
  | "blocked";

export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export interface InitiativeTask {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
}

export interface InitiativeArea {
  id: string;
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
  areas: InitiativeArea[];
  createdAt: string;
  updatedAt: string;
}

export type InitiativeDraft = Omit<
  Initiative,
  "id" | "createdAt" | "updatedAt"
>;

