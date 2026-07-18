"use client";

/**
 * Última red de seguridad (Sprint de Observabilidad, Alpha) — solo se
 * activa si algo se rompe fuera de cualquier error boundary más
 * específico, incluyendo el layout raíz. Debe definir sus propias
 * etiquetas html/body: reemplaza el layout raíz mientras está activo.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ background: "black", color: "white" }}>
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: 300 }}>
            LUZ tuvo un problema inesperado.
          </h2>
          <p style={{ marginTop: "0.75rem", color: "#a1a1aa" }}>
            {error.digest ? `Referencia: ${error.digest}` : null}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: "2rem",
              borderRadius: "9999px",
              background: "white",
              color: "black",
              padding: "0.75rem 2rem",
              fontWeight: 500,
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
