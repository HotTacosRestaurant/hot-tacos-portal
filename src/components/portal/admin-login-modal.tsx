"use client";

import { useState, type FormEvent } from "react";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

interface AdminLoginModalProps {
  onClose: () => void;
}

export function AdminLoginModal({ onClose }: AdminLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) {
      setError("Firebase Authentication no está disponible en este despliegue.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onClose();
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!auth) {
      setError("Firebase Authentication no está disponible en este despliegue.");
      return;
    }
    if (!email.trim()) {
      setError("Escribe primero el correo de la cuenta administrativa.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Si la cuenta existe, Firebase enviará las instrucciones para restablecer la contraseña.");
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card admin-login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Administración</p>
            <h2 id="admin-login-title">Acceso administrativo</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <p className="admin-login-help">
          El equipo puede consultar y actualizar el seguimiento sin iniciar sesión. Este acceso se usa para crear o eliminar iniciativas y administrar catálogos.
        </p>

        {error && (
          <div className="form-save-error" role="alert">
            <strong>NO SE PUDO INICIAR SESIÓN</strong>
            <p>{error}</p>
          </div>
        )}

        {message && <div className="auth-message" role="status">{message}</div>}

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Correo</span>
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@empresa.com"
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
            />
          </label>

          <div className="admin-login-actions">
            <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Validando…" : "Entrar"}</button>
          </div>

          <button className="password-reset-link" type="button" onClick={() => void handlePasswordReset()} disabled={busy}>
            Restablecer contraseña
          </button>
        </form>

        <small className="admin-login-note">No existe registro público de cuentas. Los usuarios administrativos se dan de alta desde Firebase.</small>
      </section>
    </div>
  );
}

function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Hay demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
    case "auth/user-disabled":
      return "Esta cuenta está deshabilitada.";
    case "auth/network-request-failed":
      return "No se pudo contactar Firebase Authentication. Revisa la conexión.";
    default:
      return error instanceof Error ? error.message : "Error desconocido de autenticación.";
  }
}
