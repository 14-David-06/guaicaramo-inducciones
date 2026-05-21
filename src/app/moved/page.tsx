const NEW_URL = "https://guaicaramo-inducciones-reinducciones.vercel.app/";

export const metadata = {
  title: "Página no disponible · Guaicaramo",
  robots: "noindex",
};

export default function MovedPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "2rem",
        background: "var(--color-bg, #1a3a2a)",
        color: "var(--color-paper, #f1ead8)",
        fontFamily: "var(--font-sans, sans-serif)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: "clamp(4rem, 15vw, 8rem)",
          lineHeight: 1,
          fontFamily: "var(--font-display, serif)",
          fontWeight: 300,
          color: "var(--color-sun, #d9b77a)",
        }}
      >
        404
      </span>

      <h1
        style={{
          fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
          fontWeight: 600,
          margin: 0,
        }}
      >
        Esta dirección ya no está disponible
      </h1>

      <p
        style={{
          maxWidth: "32ch",
          opacity: 0.75,
          lineHeight: 1.6,
          margin: 0,
          fontSize: "0.95rem",
        }}
      >
        La aplicación se ha movido a una nueva dirección. Usa el botón de abajo
        para ir al sitio actualizado.
      </p>

      <a
        href={NEW_URL}
        style={{
          marginTop: "0.5rem",
          display: "inline-block",
          padding: "0.75rem 2rem",
          borderRadius: "0.5rem",
          background: "var(--color-sun, #d9b77a)",
          color: "var(--color-ink, #0c1f15)",
          fontWeight: 600,
          fontSize: "0.95rem",
          textDecoration: "none",
          letterSpacing: "0.02em",
        }}
      >
        Ir al sitio actualizado →
      </a>
    </main>
  );
}
