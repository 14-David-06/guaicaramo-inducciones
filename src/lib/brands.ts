/**
 * Configuración de marca por empresa para el certificado.
 *
 * Guaicaramo conserva EXACTAMENTE el diseño original (texto tipográfico, colores
 * verde/naranja definidos en globals.css y cert-html.ts): su entrada no lleva
 * overrides, por lo que el render usa los valores por defecto sin cambios.
 *
 * Tagua reemplaza el texto del nombre por su logo y usa su propia paleta.
 * El certificado se emite según el campo "Empresa" del registro Personal.
 */

export type Empresa = "guaicaramo" | "tagua";

export interface BrandColors {
  /** Verde principal — bandas, chevrons, acentos. Equivale a #2e7d32. */
  primary: string;
  /** Verde oscuro — títulos y textos destacados. Equivale a #1b5e20. */
  primaryDark: string;
  /** Naranja de la línea decorativa (extremos del degradado). Equivale a #e65100. */
  accent: string;
  /** Naranja del centro del degradado. Equivale a #ff8f00. */
  accentAlt: string;
  /**
   * Triplete RGB (sin "rgb()") de la marca de agua, usado a varias opacidades.
   * Equivale a "46,125,50" (el verde de Guaicaramo).
   */
  watermarkRgb: string;
}

/** Paleta por defecto — el verde/naranja original de Guaicaramo. */
export const DEFAULT_COLORS: BrandColors = {
  primary: "#2e7d32",
  primaryDark: "#1b5e20",
  accent: "#e65100",
  accentAlt: "#ff8f00",
  watermarkRgb: "46,125,50",
};

export interface Brand {
  empresa: Empresa;
  /** Nombre de la empresa que se muestra como texto (cuando no hay logo). */
  nombre: string;
  /** Texto que acompaña "proceso de Inducción / Reinducción de …". */
  procesoLabel: string;
  /** Nombre del proceso en el TÍTULO del certificado (sin espacios alrededor del "/"). */
  procesoTitulo: string;
  /** Nombre del proceso en el CUERPO del certificado (con espacios: "Inducción / Reinducción"). */
  procesoCuerpo: string;
  /** Letra de la marca de agua central. */
  watermarkLetter: string;
  /**
   * Logo de la empresa. Cuando está definido, REEMPLAZA el texto del nombre.
   * - logoPublicPath: ruta bajo /public para la vista en pantalla (Certificate.tsx).
   * - logoDataUri: data URI base64 para el PDF (Puppeteer no descarga assets externos de forma fiable).
   */
  logoPublicPath?: string;
  logoDataUri?: string;
  /** Alto del logo en px (pantalla). Ajustable según proporción del archivo. */
  logoHeight?: number;
  /**
   * Overrides de color. Si es undefined, se usan los colores por defecto de
   * globals.css / cert-html.ts (caso Guaicaramo → sin cambios visuales).
   */
  colors?: BrandColors;
}

const BRANDS: Record<Empresa, Brand> = {
  guaicaramo: {
    empresa: "guaicaramo",
    nombre: "Guaicaramo S.A.S.",
    procesoLabel: "de Guaicaramo S.A.S.",
    procesoTitulo: "Inducción/Reinducción",
    procesoCuerpo: "Inducción / Reinducción",
    watermarkLetter: "G",
    // Sin logo ni colores: render idéntico al original.
  },
  tagua: {
    empresa: "tagua",
    nombre: "Agropecuaria La Tagua",
    procesoLabel: "de Agropecuaria La Tagua",
    procesoTitulo: "Inducción",
    procesoCuerpo: "Inducción",
    watermarkLetter: "T",
    // Logo optimizado (óvalo + palma + "AGROPECUARIA LA TAGUA"), fondo transparente.
    // Para el PDF, cert-puppeteer.ts incrusta este mismo archivo como base64 en runtime.
    logoPublicPath: "/logo-tagua.png",
    logoDataUri: undefined,
    logoHeight: 92,
    // Paleta oficial de Agropecuaria La Tagua (la-tagua-design-system).
    colors: {
      primary: "#4a1f0a",      // café oscuro — marco, bandas, fecha
      primaryDark: "#4a1f0a",  // café oscuro — títulos, nombre, firmas, cuerpo
      accent: "#a85c2a",       // terracota — línea decorativa y detalles
      accentAlt: "#a85c2a",    // terracota (línea sólida)
      watermarkRgb: "74,31,10",// café oscuro — marca de agua
    },
  },
};

/** Normaliza el valor del campo "Empresa" de Airtable a un Empresa válido. */
export function resolveEmpresa(raw?: string | null): Empresa {
  return String(raw ?? "").trim().toLowerCase() === "tagua"
    ? "tagua"
    : "guaicaramo";
}

/** Devuelve la marca a aplicar para una empresa dada. */
export function getBrand(empresa: Empresa): Brand {
  return BRANDS[empresa];
}
