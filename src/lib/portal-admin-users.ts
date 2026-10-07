import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
  firebaseConfig,
  isFirebaseConfigured,
} from "@/lib/firebase";
import {
  isPortalSuperAdminEmail,
  normalizePortalEmail,
} from "@/lib/portal-admin-access";

export interface PortalAdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin";
  active: boolean;
}

export interface CreatePortalAdminInput {
  name: string;
  email: string;
}

function requirePrimaryServices() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error("Firebase Authentication o Firestore no están disponibles.");
  }

  if (!auth.currentUser || !isPortalSuperAdminEmail(auth.currentUser.email)) {
    const error = new Error(
      "Sólo una cuenta maestra autorizada puede administrar usuarios del portal.",
    ) as Error & { code?: string };
    error.code = "portal/super-admin-required";
    throw error;
  }

  return { primaryAuth: auth, database: db };
}

export async function listPortalAdmins(): Promise<PortalAdminUser[]> {
  const { database } = requirePrimaryServices();
  const snapshot = await getDocs(collection(database, "portal_users"));

  return snapshot.docs
    .map((item) => {
      const data = item.data() as Partial<PortalAdminUser>;
      return {
        id: item.id,
        name: String(data.name ?? ""),
        email: normalizePortalEmail(String(data.email ?? "")),
        role: "admin" as const,
        active: data.active === true,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
}

export async function createPortalAdmin(
  input: CreatePortalAdminInput,
): Promise<{ user: PortalAdminUser; resetEmailSent: boolean }> {
  const { primaryAuth, database } = requirePrimaryServices();
  const name = input.name.trim();
  const email = normalizePortalEmail(input.email);

  if (name.length < 2) {
    throw new Error("El nombre debe tener al menos 2 caracteres.");
  }

  if (!email || !email.includes("@")) {
    throw new Error("Escribe un correo electrónico válido.");
  }

  const secondaryApp = initializeApp(
    firebaseConfig,
    `portal-admin-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>["user"] | null = null;

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      generateTemporaryPassword(),
    );
    createdUser = credential.user;

    const record: PortalAdminUser = {
      id: createdUser.uid,
      name,
      email,
      role: "admin",
      active: true,
    };

    try {
      await setDoc(doc(database, "portal_users", createdUser.uid), {
        active: true,
        role: "admin",
        email,
        name,
      });
    } catch (firestoreError) {
      try {
        await deleteUser(createdUser);
      } catch (rollbackError) {
        console.error("[Portal admin rollback failed]", rollbackError);
      }
      throw firestoreError;
    }

    let resetEmailSent = true;
    try {
      await sendPasswordResetEmail(primaryAuth, email);
    } catch (resetError) {
      resetEmailSent = false;
      console.error("[Portal admin reset email failed]", resetError);
    }

    return { user: record, resetEmailSent };
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {
      // The secondary auth session may already be empty after a rollback.
    }
    await deleteApp(secondaryApp);
  }
}

export async function setPortalAdminActive(userId: string, active: boolean) {
  const { database } = requirePrimaryServices();
  await updateDoc(doc(database, "portal_users", userId), { active });
}

function generateTemporaryPassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint32Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}
