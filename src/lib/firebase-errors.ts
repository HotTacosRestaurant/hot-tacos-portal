export interface PortalErrorDetails {
  code: string;
  title: string;
  message: string;
  technicalMessage: string;
}

export function getPortalErrorDetails(error: unknown): PortalErrorDetails {
  const rawCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const code = rawCode.replace(/^firestore\//, "") || "unknown";
  const technicalMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Error desconocido";

  switch (code) {
    case "permission-denied":
      return {
        code,
        title: "NO SE GUARDÓ",
        message:
          "Firestore rechazó la operación por permisos. La información capturada no fue guardada.",
        technicalMessage,
      };
    case "unavailable":
    case "deadline-exceeded":
      return {
        code,
        title: "NO SE GUARDÓ",
        message:
          "No se pudo confirmar la escritura con Firestore. Revisa la conexión y vuelve a intentarlo.",
        technicalMessage,
      };
    case "invalid-argument":
      return {
        code,
        title: "NO SE GUARDÓ",
        message:
          "Firestore rechazó los datos enviados. La información capturada permanece en pantalla para que puedas reintentar.",
        technicalMessage,
      };
    case "portal/not-ready":
      return {
        code,
        title: "CAMBIOS BLOQUEADOS",
        message:
          "La aplicación no tiene una conexión confirmada con Firestore. No se enviaron cambios.",
        technicalMessage,
      };
    case "portal/admin-required":
      return {
        code,
        title: "ACCESO ADMINISTRATIVO REQUERIDO",
        message:
          "Esta acción está reservada para usuarios administrativos. Inicia sesión con una cuenta autorizada.",
        technicalMessage,
      };
    default:
      return {
        code,
        title: "NO SE GUARDÓ",
        message:
          "Ocurrió un error al guardar. La aplicación no confirmó la escritura en Firestore.",
        technicalMessage,
      };
  }
}
