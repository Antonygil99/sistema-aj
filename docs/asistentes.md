# Asistentes de la Ruta AJ

La pantalla `/asistentes` reúne los ocho asistentes de un solo propósito de la Ruta de implementación IA AJ v1. Cada uno es experto en una parte del proceso, consulta el CRM con los permisos de quien pregunta y responde con datos reales. No cambian nada por su cuenta: lo que modifique el CRM se muestra como propuesta que una persona confirma, y lo que sale hacia un cliente (correo, WhatsApp) sigue necesitando su propio clic.

| Asistente | Qué hace | Herramientas |
| --- | --- | --- |
| Primer contacto por WhatsApp | Redacta respuestas siguiendo la regla de oro (resolver, pedir lo mínimo o derivar a Ale) y registra prospectos a partir de una conversación | clientes, expediente, prospectos, productos, mensajes de WhatsApp · registrar prospecto, crear actividad |
| Captura para cotización | Guía las cinco preguntas del diagnóstico y avanza al prospecto en el embudo | clientes, expediente, prospectos, productos · registrar prospecto, mover prospecto, crear actividad |
| Entrega de póliza | Checklist de entrega activa y seguimientos 7/30/90 | clientes, expediente, tablero de entregas, pólizas, actividades · crear actividad, preparar correo |
| Renovaciones y pagos | Vencimientos, recibos y avisos a clientes | clientes, expediente, pólizas, recibos, avisos · resolver aviso, preparar correo, crear actividad |
| Siniestros y orientación médica | Seguimiento de siniestros y cómo usar la póliza, sin diagnosticar ni determinar cobertura | clientes, expediente, siniestros, pólizas · crear actividad, preparar correo |
| Contenidos y guiones | Ideas y guiones anónimos, sin promesas de cobertura | métricas, siniestros, productos, guía |
| Análisis de casos | Cartera, embudo, cobranza y casos con números del CRM | clientes, expediente, métricas, pólizas, recibos, prospectos, siniestros, entregas, avisos, actividades |
| Aprendizaje interno AJ | Cómo usar el CRM y la Ruta AJ documentada | guía, productos, agenda |

## Cómo funciona

- **Modelo:** Claude por la API de Anthropic (`@anthropic-ai/sdk`). Cada persona elige el modelo en Preferencias → Asistentes de IA (Claude Opus 5.5 por defecto). «Pensar a fondo» usa esfuerzo alto; apagado, esfuerzo bajo para respuestas rápidas. Pensamiento adaptativo siempre activo.
- **Bucle:** `src/agents/loop.ts` (puro, probado en `tests/agents.test.ts`) llama al modelo con streaming, ejecuta las herramientas de consulta, valida cada entrada contra su esquema, devuelve todos los resultados juntos, se detiene ante un rechazo o una entrada cortada y reintenta solo cuando una entrada no se pudo leer. Hasta 8 vueltas por respuesta.
- **Herramientas:** `src/agents/tools.ts`. Las de consulta devuelven JSON compacto con enlaces internos (`/crm/...`). Nunca incluyen el valor de antecedentes médicos ni la descripción de los siniestros. Las de escritura (`crear_actividad`, `registrar_prospecto`, `mover_prospecto`, `resolver_aviso`, `preparar_correo`) solo describen la propuesta; `POST /api/assistant/actions` las ejecuta al confirmar, con los permisos de quien confirma (ADMIN) y validando de nuevo. `preparar_correo` abre el redactor del CRM con el texto: los destinatarios, adjuntos y el envío siguen siendo de la persona. Quien tiene acceso de consulta recibe solo herramientas de lectura.
- **Instrucciones:** `src/agents/prompts.ts`, estables por asistente (se aprovecha la caché). Usan solo lo documentado por el cliente: regla de oro de WhatsApp, las cinco preguntas, el checklist de entrega, las ventanas de avisos. El Método AJ (guiones, criterios) lo está documentando Ale; los asistentes lo dicen en lugar de inventarlo. Los datos de las herramientas y los mensajes de WhatsApp son información, nunca instrucciones.
- **Contexto:** la fecha, el nombre y el rol viajan en un mensaje de sistema a mitad de la conversación, no en las instrucciones. El navegador conserva la conversación (texto de turnos anteriores, con el resultado de las propuestas); el servidor no guarda transcripciones.
- **Rechazos:** respaldo del lado del servidor (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) en Opus 5.5, Sonnet 5.5 y Fable 5.1; Haiku 5.5 no lo admite. Si aun así se rechaza, el chat lo explica.
- **Registro:** cada turno queda en `AgentRun` (asistente, pregunta, respuesta recortada, herramientas usadas, propuestas, tokens, modelo y duración). Las acciones confirmadas se registran como cualquier cambio del CRM (`CrmEvent`).
- **Streaming:** `POST /api/assistant/chat` responde JSON delimitado por líneas (`step`, `text`, `proposal`, `notice`, `done`, `error`). La interfaz (`components/ui/thinking-prompt-input.tsx`, adaptado del componente ThinkingPromptInput al sistema de estilos del CRM) muestra los pasos con «Pensando», la respuesta conforme llega y permite detenerla.

## Configuración

| Variable | Uso |
| --- | --- |
| `ANTHROPIC_API_KEY` | Llave de la API de Anthropic (obligatoria). Sin ella la pantalla avisa que los asistentes no están configurados y `POST /api/assistant/chat` responde 503 `AI_NOT_CONFIGURED`. |

Cada respuesta tiene un límite de 60 segundos (función de Vercel). Los costos dependen del modelo elegido: Opus 5.5 es el recomendado; Haiku 5.5 es el más económico.

## Pendiente

- WhatsApp Business conectado: hoy el asistente de primer contacto redacta mensajes para copiar y lee los mensajes que hayan llegado al webhook; el envío automático y la atención directa esperan a Meta y a la aprobación humana de cada mensaje.
- Guiones y criterios del Método AJ documentados por Ale para afinar las instrucciones.
- Registro de contenido (casos convertidos en contenido) para medir el pilar de Contenido.
