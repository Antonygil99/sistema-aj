export const modules = [
  {
    "slug": "prospectos",
    "label": "Prospectos",
    "description": "Captación y seguimiento comercial"
  },
  {
    "slug": "clientes",
    "label": "Clientes",
    "description": "Relaciones y datos de asegurados"
  },
  {
    "slug": "productos",
    "label": "Productos",
    "description": "Catálogo de seguros con sus datos básicos"
  },
  {
    "slug": "polizas",
    "label": "Pólizas",
    "description": "Coberturas y vigencias"
  },
  {
    "slug": "entregas",
    "label": "Entregas",
    "description": "Activación y seguimiento de cada póliza"
  },
  {
    "slug": "cotizaciones",
    "label": "Cotizaciones",
    "description": "Propuestas para prospectos y clientes"
  },
  {
    "slug": "pagos",
    "label": "Pagos",
    "description": "Cobranza y control de vencimientos"
  },
  {
    "slug": "renovaciones",
    "label": "Renovaciones",
    "description": "Continuidad de la cartera"
  },
  {
    "slug": "siniestros",
    "label": "Siniestros",
    "description": "Acompañamiento y seguimiento de casos"
  },
  {
    "slug": "documentos",
    "label": "Documentos",
    "description": "Expedientes y metadatos de archivos"
  },
  {
    "slug": "actividades",
    "label": "Actividades",
    "description": "Tareas y próximos pasos"
  }
] as const;
export type ModuleSlug = typeof modules[number]['slug'];
