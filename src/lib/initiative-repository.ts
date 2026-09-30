import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Initiative, InitiativeDraft } from "@/types/initiative";

const COLLECTION = "portal_initiatives";

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
        .map((item) => ({ id: item.id, ...item.data() }) as Initiative)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      onData(initiatives);
    },
    (error) => onError(error),
  );
}

export async function createInitiative(draft: InitiativeDraft) {
  const database = requireDatabase();
  const now = new Date().toISOString();
  await addDoc(collection(database, COLLECTION), {
    ...draft,
    createdAt: now,
    updatedAt: now,
  });
}

export async function saveInitiative(initiative: Initiative) {
  const database = requireDatabase();
  const { id, ...data } = initiative;
  await setDoc(doc(database, COLLECTION, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function removeInitiative(id: string) {
  const database = requireDatabase();
  await deleteDoc(doc(database, COLLECTION, id));
}

