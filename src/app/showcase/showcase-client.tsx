"use client";

import { useEffect, useMemo, useState } from "react";

import { KpiDashboard } from "@/components/portal/kpi-dashboard";
import { getPortalErrorDetails } from "@/lib/firebase-errors";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  subscribeToInitiatives,
  subscribeToPeople,
  subscribeToUnits,
} from "@/lib/initiative-repository";
import { DEFAULT_UNITS, mergeCatalog } from "@/lib/portal-catalogs";
import type { Initiative, PortalPerson, PortalUnit } from "@/types/initiative";

type ShowcaseMode = "connecting" | "firebase" | "error";

export function ShowcaseDashboard() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [units, setUnits] = useState<PortalUnit[]>(DEFAULT_UNITS);
  const [people, setPeople] = useState<PortalPerson[]>([]);
  const [selectedScope, setSelectedScope] = useState("brand");
  const [mode, setMode] = useState<ShowcaseMode>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      queueMicrotask(() => {
        setMode("error");
        setErrorMessage("Firebase no está configurado en este despliegue.");
      });
      return;
    }

    setMode("connecting");
    setErrorMessage(null);

    const ready = { initiatives: false, units: false, people: false };
    const unsubscribers: Array<() => void> = [];

    function markReady(key: keyof typeof ready) {
      ready[key] = true;
      if (Object.values(ready).every(Boolean)) {
        setMode("firebase");
        setLastUpdated(new Date());
      }
    }

    function markFailed(source: string, error: Error) {
      const details = getPortalErrorDetails(error);
      console.error(`[Showcase Firestore subscription failed: ${source}]`, error);
      setMode("error");
      setErrorMessage(`${source}: ${details.message} Código: ${details.code}.`);
    }

    try {
      unsubscribers.push(
        subscribeToInitiatives(
          (data) => {
            setInitiatives(data);
            markReady("initiatives");
          },
          (error) => markFailed("Iniciativas", error),
        ),
        subscribeToUnits(
          (data) => {
            setUnits(mergeCatalog(DEFAULT_UNITS, data));
            markReady("units");
          },
          (error) => markFailed("Unidades", error),
        ),
        subscribeToPeople(
          (data) => {
            setPeople(data);
            markReady("people");
          },
          (error) => markFailed("Personal", error),
        ),
      );
    } catch (error) {
      const details = getPortalErrorDetails(error);
      console.error("[Showcase Firestore initialization failed]", error);
      queueMicrotask(() => {
        setMode("error");
        setErrorMessage(`${details.message} Código: ${details.code}.`);
      });
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [refreshToken]);

  const selectedUnit = units.find((unit) => unit.id === selectedScope);
  const scopeTitle =
    selectedScope === "brand"
      ? "Toda la organización"
      : selectedUnit?.name ?? selectedScope;

  const updateLabel = useMemo(() => {
    if (mode === "connecting") return "Actualizando…";
    return "Actualizar";
  }, [mode]);

  return (
    <main className="showcase-shell">
      <header className="showcase-topbar">
        <div>
          <span>Management information</span>
          <strong>KPIs de iniciativas</strong>
        </div>
        <div className="showcase-actions">
          {lastUpdated && mode === "firebase" && (
            <small>
              Actualizado {lastUpdated.toLocaleTimeString("es-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </small>
          )}
          <button
            type="button"
            className="showcase-refresh"
            disabled={mode === "connecting"}
            onClick={() => setRefreshToken((value) => value + 1)}
          >
            {updateLabel}
          </button>
        </div>
      </header>

      <div className="showcase-content">
        {mode === "connecting" && (
          <div className="mode-banner" role="status">
            <span>Conectando</span>
            Actualizando indicadores desde Firestore.
          </div>
        )}

        {mode === "error" && (
          <div className="mode-banner denied" role="alert">
            <span>Error de conexión</span>
            <strong>No se pudieron actualizar los KPIs.</strong> {errorMessage}
          </div>
        )}

        <section className="showcase-heading">
          <div>
            <p className="eyebrow">Management information</p>
            <h1>KPIs</h1>
            <p>Seguimiento de ejecución, cumplimiento, actualización y carga operativa.</p>
          </div>
        </section>

        <section className="scope-navigation showcase-scopes" aria-label="Ámbito de KPIs">
          <button
            className={selectedScope === "brand" ? "active" : ""}
            type="button"
            onClick={() => setSelectedScope("brand")}
          >
            <span className="scope-nav-code">GC</span>
            <span><strong>Global</strong><small>Toda la organización</small></span>
          </button>
          {units.filter((unit) => unit.active).map((unit) => (
            <button
              className={selectedScope === unit.id ? "active" : ""}
              type="button"
              key={unit.id}
              onClick={() => setSelectedScope(unit.id)}
            >
              <span className="scope-nav-code">{unit.code}</span>
              <span><strong>{unit.code}</strong><small>{unit.name}</small></span>
            </button>
          ))}
        </section>

        {mode !== "error" && (
          <KpiDashboard
            initiatives={initiatives}
            units={units}
            people={people}
            selectedScope={selectedScope}
            scopeTitle={scopeTitle}
            onOpenInitiative={() => undefined}
            readOnly
          />
        )}
      </div>
    </main>
  );
}
