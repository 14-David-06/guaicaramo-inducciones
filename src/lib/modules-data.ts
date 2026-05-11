/* Pure module data — no React/client imports so this is safe for server components */

export type TopicGroup = {
  title: string;
  items: string[];
};

export type ModuleData = {
  slug: string;
  num: string;
  title: string;
  duration: string;
  chip: string;
  bg: string;
  bgPosition?: string;
  span: 4 | 6;
  blurb: string;
  topics: string[];
  topicGroups?: TopicGroup[];
  objective: string;
};

export const MODULES: ModuleData[] = [
  {
    slug: "introduccion",
    num: "01",
    title: "Introducción",
    duration: "10 min",
    chip: "Propósito",
    bg: "/vlcsnap-2026-04-27-09h11m19s291.png",
    span: 6,
    blurb:
      "Conozca quiénes somos, de dónde venimos y qué nos hace únicos. Esta es la puerta de entrada a la casa Guaicaramo.",
    topics: [
      "Generalidades",
      "Misión y Visión",
      "Principales procesos",
      "Valores Corporativos / Código de Ética y Conducta",
      "RIT (Reglamento Interno de Trabajo)",
      "Sagrilaft y Protección de datos personales",
    ],
    objective:
      "Comprender el propósito de Guaicaramo y los seis pilares que sostienen cada decisión.",
  },
  {
    slug: "bienestar-social",
    num: "02",
    title: "Bienestar integral",
    duration: "20 min",
    chip: "Comunidad",
    bg: "/Gente%20de%20Campo.jpg.jpeg",
    span: 6,
    blurb:
      "Cuidar a la gente es cuidar a Guaicaramo. Aquí conocerá nuestras prácticas de convivencia, equidad y desarrollo humano.",
    topics: [
      "Política de Derechos · Comité de Género",
      "Comité de Bienestar y empoderamiento de la mujer",
      "Canales de comunicación · Mecanismo de RPQRD",
      "Beneficios pacto colectivo / Fondo de empleados",
    ],
    objective:
      "Apropiar las prácticas de cuidado humano y comunitario que vivimos a diario.",
  },
  {
    slug: "seguridad-y-salud",
    num: "03",
    title: "Seguridad y salud en el trabajo",
    duration: "30 min",
    chip: "Cuidado",
    bg: "/vlcsnap-2026-04-27-07h37m20s775.png",
    span: 4,
    blurb:
      "Cero accidentes no es una meta, es un acuerdo. Conozca los protocolos que protegen su vida y la de su equipo.",
    topics: [
      "Sistema de Gestión de SST (SGSST): objetivo y alcance",
      "Política Integral de Seguridad y Salud en el Trabajo",
      "Prevención del consumo de alcohol, sustancias psicoactivas y medicamentos no formulados",
      "Plan Estratégico de Seguridad Vial",
      "Obligaciones de la ARL y de los empleadores",
      "Responsabilidades de los trabajadores",
      "Identificación de peligros, medidas de prevención y de control",
      "Definiciones: peligro, riesgo, incidente, accidente de trabajo, enfermedad laboral, actos y condiciones inseguras, procedimiento para el reporte",
      "Investigación de incidentes, accidentes de trabajo y enfermedades laborales",
      "COPASST, Comité de Convivencia Laboral, Comité de Seguridad Vial y Comité de Emergencias",
      "Plan de prevención, preparación y respuesta ante emergencias",
      "Elementos de Protección Individual (EPI)",
      "Enfermería (seguimiento a condiciones especiales)",
      "Sala amiga de la familia lactante",
    ],
    topicGroups: [
      {
        title: "Marco del SGSST",
        items: [
          "Sistema de Gestión de SST (SGSST): objetivo y alcance",
          "Política Integral de Seguridad y Salud en el Trabajo",
          "Obligaciones de la ARL y de los empleadores",
          "Responsabilidades de los trabajadores",
        ],
      },
      {
        title: "Prevención y control de riesgos",
        items: [
          "Identificación de peligros, medidas de prevención y de control",
          "Definiciones: peligro, riesgo, incidente, accidente de trabajo, enfermedad laboral, actos y condiciones inseguras, procedimiento para el reporte",
          "Prevención del consumo de alcohol, sustancias psicoactivas y medicamentos no formulados",
          "Plan Estratégico de Seguridad Vial",
        ],
      },
      {
        title: "Comités, emergencias e investigación",
        items: [
          "COPASST, Comité de Convivencia Laboral, Comité de Seguridad Vial y Comité de Emergencias",
          "Plan de prevención, preparación y respuesta ante emergencias",
          "Investigación de incidentes, accidentes de trabajo y enfermedades laborales",
        ],
      },
      {
        title: "Cuidado y bienestar en operación",
        items: [
          "Elementos de Protección Individual (EPI)",
          "Enfermería (seguimiento a condiciones especiales)",
          "Sala amiga de la familia lactante",
        ],
      },
    ],
    objective:
      "Reconocer riesgos, aplicar controles y responder ante emergencias en la operación.",
  },
  {
    slug: "gestion-ambiental",
    num: "04",
    title: "Gestión ambiental",
    duration: "20 min",
    chip: "Ecosistema",
    bg: "/DSC_2854.jpg",
    bgPosition: "55% center",
    span: 4,
    blurb:
      "Regenerar el llano es nuestra forma de producir. Aprenda cómo cuidamos suelo, agua, fauna y flora todos los días.",
    topics: [
      "Política y objetivo de gestión ambiental (No tala, No pesca, No quema, No caza)",
      "Identificación de impactos ambientales y Plan de Manejo Ambiental (PGIRS, PUEAA, PUEAE, PGRMV)",
      "AVC (Altos Valores de Conservación)",
      "Especies RAP (raras, amenazadas o en peligro de extinción)",
      "Manejo adecuado de residuos",
      "Obligaciones y responsabilidades en gestión ambiental",
    ],
    objective:
      "Operar bajo prácticas que regeneran el ecosistema en cada hectárea de Guaicaramo.",
  },
  {
    slug: "sistemas-integrados-de-gestion",
    num: "05",
    title: "Sistemas Integrados de Gestión",
    duration: "20 min",
    chip: "Excelencia",
    bg: "/tractomulas.jpg.jpeg",
    span: 4,
    blurb:
      "Lo que se mide, se mejora. Conozca las certificaciones y procesos que nos hacen únicos ante el mundo.",
    topics: [
      "Política Integral de Calidad · Objetivos de calidad · Responsabilidades",
      "Esquemas de certificación (RSPO, ISCC y APSColombia)",
    ],
    objective:
      "Sostener los estándares y certificaciones que acreditan nuestra excelencia.",
  },
];
