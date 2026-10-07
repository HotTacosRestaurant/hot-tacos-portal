"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { getPortalErrorDetails } from "@/lib/firebase-errors";
import {
  createPortalAdmin,
  listPortalAdmins,
  setPortalAdminActive,
  type PortalAdminUser,
} from "@/lib/portal-admin-users";

interface AdminUsersModalProps {
  currentUserId: string | null;
  onClose: () => void;
}

export function AdminUsersModal({ currentUserId, onClose }: AdminUsersModalProps) {
  const [admins, setAdmins] = useState<PortalAdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listPortalAdmins()
      .then((data) => {
        if (!cancelled) setAdmins(data);
      })
      .catch((loadError) => {
        if (!cancelled) {
          const details = getPortalErrorDetails(loadError);
          setError(`${details.message} Código: ${details.code}.`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(
    () => admins.filter((admin) => admin.active).length,
    [admins],
  );

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createPortalAdmin({ name, email });
      setAdmins((current) =>
        [...current, result.user].sort(
          (a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
        ),
      );
      setName("");
      setEmail("");
      setMessage(
        result.resetEmailSent
          ? `Administrador creado. Firebase envió a ${result.user.email} un correo para establecer su contraseña.`
          : `Administrador creado, pero Firebase no pudo enviar el correo de contraseña. La persona puede usar “Restablecer contraseña” desde Acceso admin.`,
      );
    } catch (createError) {
      setError(formatAdminError(createError));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(admin: PortalAdminUser) {
    if (admin.id === currentUserId) {
      setError("No puedes desactivar tu propia cuenta desde esta ventana.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await setPortalAdminActive(admin.id, !admin.active);
      setAdmins((current) =>
        current.map((item) =>
          item.id === admin.id ? { ...item, active: !item.active } : item,
        ),
      );
      setMessage(
        admin.active
          ? `${admin.name} quedó sin acceso administrativo.`
          : `${admin.name} volvió a quedar habilitado como administrador.`,
      );
    } catch (toggleError) {
      setError(formatAdminError(toggleError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card admin-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-users-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Administración maestra</p>
            <h2 id="admin-users-title">Administradores del portal</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <p className="admin-login-help">
          Crea la cuenta de Firebase Authentication y su autorización en <strong>portal_users</strong> en un solo paso. El nuevo administrador recibirá un correo para definir su contraseña.
        </p>

        {error && (
          <div className="form-save-error" role="alert">
            <strong>NO SE PUDO COMPLETAR LA OPERACIÓN</strong>
            <p>{error}</p>
          </div>
        )}

        {message && <div className="auth-message" role="status">{message}</div>}

        <form className="admin-user-create" onSubmit={handleCreate}>
          <label className="field">
            <span>Nombre *</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre completo"
              disabled={busy}
            />
          </label>

          <label className="field">
            <span>Correo *</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@empresa.com"
              disabled={busy}
            />
          </label>

          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Procesando…" : "＋ Crear administrador"}
          </button>
        </form>

        <div className="admin-users-heading">
          <div>
            <strong>Administradores registrados</strong>
            <small>{activeCount} activos · {admins.length} registrados</small>
          </div>
        </div>

        {loading ? (
          <div className="admin-users-empty">Cargando administradores…</div>
        ) : admins.length === 0 ? (
          <div className="admin-users-empty">No se encontraron registros en portal_users.</div>
        ) : (
          <div className="admin-users-list">
            {admins.map((admin) => (
              <div className="admin-user-row" key={admin.id}>
                <div>
                  <strong>{admin.name || "Sin nombre"}</strong>
                  <small>{admin.email}</small>
                </div>
                <div className="admin-user-row-actions">
                  <span className={admin.active ? "admin-status active" : "admin-status inactive"}>
                    {admin.active ? "Activo" : "Inactivo"}
                  </span>
                  <button
                    className="button button-secondary admin-user-toggle"
                    type="button"
                    disabled={busy || admin.id === currentUserId}
                    onClick={() => void handleToggle(admin)}
                  >
                    {admin.id === currentUserId
                      ? "Tu cuenta"
                      : admin.active
                        ? "Desactivar"
                        : "Activar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <small className="admin-login-note">
          Sólo las tres cuentas maestras autorizadas pueden abrir esta administración. Los demás administradores pueden crear/eliminar iniciativas y administrar catálogos, pero no pueden dar de alta otros administradores.
        </small>
      </section>
    </div>
  );
}

function formatAdminError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Ese correo ya existe en Firebase Authentication. Si necesita acceso, revisa si ya tiene un registro portal_users o usa Firebase Console para recuperar su UID.";
    case "auth/invalid-email":
      return "El correo electrónico no tiene un formato válido.";
    case "auth/operation-not-allowed":
      return "Email/Password no está habilitado en Firebase Authentication.";
    case "auth/network-request-failed":
      return "No se pudo contactar Firebase Authentication. Revisa la conexión.";
    case "permission-denied":
    case "firestore/permission-denied":
      return "Firestore rechazó la operación. Confirma que las reglas nuevas estén publicadas y que tu cuenta maestra esté activa en portal_users.";
    default: {
      const details = getPortalErrorDetails(error);
      return `${details.message} Código: ${details.code}.`;
    }
  }
}
