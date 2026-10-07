import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  Initiative,
  InitiativeDraft,
  PortalArea,
  PortalPerson,
  PortalUnit,
} from "@/types/initiative";

const COLLECTION = "portal_initiatives";
const AREAS_COLLECTION = "portal_areas";
const UNITS_COLLECTION = "portal_units";
const PEOPLE_COLLECTION = "portal_people";

function requireDatabase() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

export function subscribeToInitiatives(
  onData: (initiatives: Initiative[]) => void,
  onError: (error: Error) => void,
) {
  const database = requireDatabase();

  return onSnapshot(
    collection(database, COLLECTION),
    (snapshot) => {
      const initiatives = snapshot.docs
        .map((item) => normalizeInitiative({ id: item.id, ...item.data() } as Initiative))
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      onData(initiatives);
    },
    (error) => onError(error),
  );
}

export function subscribeToAreas(
  onData: (areas: PortalArea[]) => void,
  onError: (error: Error) => void,
) {
  const database = requireDatabase();
  return onSnapshot(
    collection(database, AREAS_COLLECTION),
    (snapshot) =>
      onData(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as PortalArea)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      ),
    onError,
  );
}

export function subscribeToUnits(
  onData: (units: PortalUnit[]) => void,
  onError: (error: Error) => void,
) {
  const database = requireDatabase();
  return onSnapshot(
    collection(database, UNITS_COLLECTION),
    (snapshot) =>
      onData(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as PortalUnit)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
      ),
    onError,
  );
}

export function subscribeToPeople(
  onData: (people: PortalPerson[]) => void,
  onError: (error: Error) => void,
) {
  const database = requireDatabase();
  return onSnapshot(
    collection(database, PEOPLE_COLLECTION),
    (snapshot) =>
      onData(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as PortalPerson)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      ),
    onError,
  );
}

export async function saveArea(area: PortalArea) {
  const database = requireDatabase();
  const { id, ...data } = area;
  await setDoc(
    doc(database, AREAS_COLLECTION, id),
    sanitizeForFirestore({
      ...data,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function saveUnit(unit: PortalUnit) {
  const database = requireDatabase();
  const { id, ...data } = unit;
  await setDoc(
    doc(database, UNITS_COLLECTION, id),
    sanitizeForFirestore({
      ...data,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function savePerson(person: PortalPerson) {
  const database = requireDatabase();
  const { id, ...data } = person;
  await setDoc(
    doc(database, PEOPLE_COLLECTION, id),
    sanitizeForFirestore({
      ...data,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function createInitiative(draft: InitiativeDraft) {
  const database = requireDatabase();
  const now = new Date().toISOString();
  await addDoc(
    collection(database, COLLECTION),
    sanitizeForFirestore({
      ...draft,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

export async function saveInitiative(initiative: Initiative) {
  const database = requireDatabase();
  const { id, ...data } = initiative;
  await setDoc(
    doc(database, COLLECTION, id),
    sanitizeForFirestore({
      ...data,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function removeInitiative(id: string) {
  const database = requireDatabase();
  await deleteDoc(doc(database, COLLECTION, id));
}

function normalizeInitiative(initiative: Initiative): Initiative {
  return {
    ...initiative,
    scopeType: initiative.scopeType ?? "brand",
    unitIds: initiative.unitIds ?? [],
    areas: (initiative.areas ?? []).map((area) => ({
      ...area,
      tasks: (area.tasks ?? []).map((task) => ({
        ...task,
        notes: task.notes ?? [],
      })),
    })),
  };
}


function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as T;
  }

  if (value && typeof value === "object") {
    const cleanEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, sanitizeForFirestore(item)]);
    return Object.fromEntries(cleanEntries) as T;
  }

  return value;
}
