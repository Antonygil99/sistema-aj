# Formularios y trámites de Sistema AJ

Fecha de revisión: 27 de octubre de 2026. Base documental: ocho PDF entregados por Tony, 23 páginas, revisados mediante texto, estructura de campos y representación visual de todas las páginas. Esta guía define el comportamiento deseado; no certifica la aceptación de un trámite ni una versión vigente para todos los productos.

## 1. Decisión de producto y alcance de esta entrega

Implementar una ficha de trámite con dos modos de captura: **manual desde el CRM** y **asistida por agentes**. Ambos usarán el mismo esquema, validaciones, permisos, historial y generador de PDF. El formulario web sirve para capturar; el documento de salida conserva el formato y las cláusulas de la aseguradora.

Estado actualizado: ya se implementó una ficha administrativa única por cliente, con captura manual, enlace externo de 7 días y código, recepción en CRM y aprobación selectiva. Primer contacto y Siniestros pueden proponer borradores mínimos con confirmación humana. Ver `IMPLEMENTACION-FICHA-CLIENTE.md` para el alcance real. El generador de los ocho PDFs oficiales, firma electrónica, captura clínica y presentación a aseguradoras siguen pendientes. La skill de Codex no se carga automáticamente como instrucciones de los asistentes del CRM.

La skill local está en `C:/Users/Tony/.codex/skills/aj-formularios-seguros/`. Las rutas `assets/templates/` del catálogo se resuelven desde esa raíz; el paquete ZIP permite moverla completa a otro equipo o compartirla con Claude. En `C:/Users/Tony/Desktop/sistema-aj/docs/formularios-aj/` se deja una copia de este contexto y los inventarios, sin los PDF originales. Esas rutas locales son referencias de trabajo, no rutas para usar en Vercel. La futura aplicación necesitará incorporar las plantillas revisadas a su almacenamiento privado.

Confirmación directa de Tony durante esta revisión: **Ale atiende Gastos Médicos y Vida; Joel atiende Autos**. Es la asignación operativa por defecto; el responsable concreto se resuelve por póliza y permisos, con reasignación explícita y trazable. Ser responsable comercial no autoriza a firmar por el cliente o por un médico.

### Catálogo inicial

| ID | Aseguradora / ramo | Documento y código observado | Páginas | Campos lógicos / widgets | Preparación técnica |
| --- | --- | --- | ---: | ---: | --- |
| `bex-aviso-gmm` | BX+ / GMM | Aviso de accidente o enfermedad; SM009 en nombre de archivo | 4 | 190 / 191 | AcroForm; mapeo semántico por validar |
| `bex-informe-gmm` | BX+ / GMM | Informe médico; SM008 en nombre de archivo | 3 | 113 / 113 | AcroForm; sección clínica para médico |
| `bex-desglose-gmm` | BX+ / GMM | Desglose de gastos | 1 | 68 / 68 | AcroForm; tablas limitadas |
| `bex-pago-finiquito` | BX+ / GMM, AP, Vida | Solicitud de pago - finiquito por transferencia | 1 | 34 / 34 | AcroForm; autorización y cuenta requieren revisión |
| `metlife-informe-medico` | MetLife / GMM | CC-1-020 VER. 7 | 4 | 0 / 0 | PDF con texto; necesita mapa de coordenadas |
| `metlife-cambios-gmm` | MetLife / GMM individual | IG-2-020 VER. 11 | 2 | 47 / 47 | AcroForm; casillas con nombres numéricos |
| `metlife-cambios-vida` | MetLife / Vida individual | **IV-1-011 VER. 13**, distinto del nombre del archivo | 2 | 60 / 60 | AcroForm; una casilla viene activada |
| `metlife-reclamacion-gmm` | MetLife / GMM individual o colectiva, según póliza | VG-2-068 VER. 12 | 6 | 0 / 0 | PDF con texto; necesita mapa de coordenadas |

Los seis AcroForms suman 512 campos lógicos y 513 widgets. No son 512 preguntas de negocio: existen casillas, RFC/CLABE divididos por carácter y campos técnicos. En el aviso BX+ el campo de sexo tiene dos widgets bajo un mismo campo padre; la diferencia 190/191 no demuestra un campo perdido. Los dos PDF sin AcroForm no son necesariamente imágenes escaneadas: aquí tienen texto extraíble.

La matriz con hashes SHA-256, nombres originales y rutas portables está en `templates.json`. El inventario de nombres internos y rectángulos está en `pdf-fields.json`; es evidencia técnica, no un mapa semántico autorizado para llenar todo automáticamente.

## 2. Qué trámite corresponde a cada broker

| Situación | Responsable por defecto | Selección documental |
| --- | --- | --- |
| GMM BX+: reembolso, complemento, hospitalización o evento programado | Ale | Aviso + informe por médico; desglose y pago-finiquito cuando correspondan al canal y modalidad |
| GMM MetLife: reembolso, ingreso hospitalario o cirugía programada | Ale | Reclamación GMM + informe por médico; anexos y apartados condicionales |
| Modificar una póliza GMM individual MetLife | Ale | IG-2-020 VER. 11 + anexos del cambio específico |
| Modificar una póliza Vida individual MetLife | Ale | IV-1-011 VER. 13 + anexos del cambio específico |
| Pago de indemnización BX+ de Vida/AP | Ale para Vida; AP según responsable de póliza | El pago-finiquito puede ser parte del expediente; los demás formatos de reclamación de Vida/AP no se aportaron |
| Daños, robo, responsabilidad civil o endosos de Autos | Joel | **No hay plantilla de Autos en este lote**. Solicitar catálogo de cada aseguradora y trámite |
| Accidente vial con lesión y posible reclamación GMM | Ale coordina GMM; Joel la parte de Autos cuando exista | Casos separados y vinculados; confirmar pólizas distintas. Que el aviso GMM pregunte por seguro de auto no lo convierte en una reclamación de Autos |

Orden de selección: identidad autorizada -> póliza y vigencia concreta -> aseguradora -> ramo/producto -> individual/colectiva -> trámite -> inicial/subsecuente -> versión/canal -> responsable. Si falta cualquiera que cambie el resultado, pedir ese dato; no elegir por el nombre del cliente o del broker. Un cliente puede ser contratante, asegurado o beneficiario de distintas pólizas y tener varios casos.

Una póliza hoy vencida puede estar asociada a hechos de una vigencia anterior. Mostrar las fechas y pedir revisión del asesor; no rechazar automáticamente un trámite histórico ni concluir cobertura solo por comparar fechas.

## 3. Revisión de cada formato

### F01. Aviso de accidente o enfermedad BX+

Original: `01_aviso_accidente_enefermedad_GMM_SM009 (1).pdf`.

**Aplicación.** Declaración de un evento GMM: accidente, enfermedad o embarazo, inicial o complementario. El impreso también distingue pago directo, programación y segunda opinión. La combinación que corresponde debe confirmarse con Ale; no traducir casillas ambiguas a una decisión médica.

- **Pág. 1:** contratante/RFC, póliza/subgrupo/fin de vigencia; asegurado afectado, RFC, certificado, edad, sexo, nacimiento, parentesco, antigüedad y ocupación. Motivo/tipo de reclamación; gastos previos, otras aseguradoras, siniestro previo, fechas de síntomas/accidente y primera consulta; declaración del padecimiento, atención, accidente/autoridad, otra póliza de auto, hospital y días.
- **Pág. 2:** relación de número de factura, concepto e importe; autorización y comienzo del aviso de privacidad; lugar/fecha y firma.
- **Pág. 3:** continuación del aviso, lugar/fecha y nombres/firmas del afectado, contratante y agente.
- **Pág. 4:** hospitalización, estudios, médico/contacto/lugar de atención; relación de médicos de los dos años anteriores; solicitud de segunda opinión, comentarios, firma y checklist.

**Prellenar como propuesta.** Número de la póliza seleccionada y su vigencia; datos de contacto/nombre/RFC únicamente tras confirmar a quién pertenecen. No asumir que el registro `Client` es el contratante o el afectado. Certificado, subgrupo y antigüedad no existen como campos normalizados actuales y requieren fuente.

**Cliente/contratante.** Declara hechos, fechas, otras pólizas, ocupación, antecedentes y sus autorizaciones. Diagnóstico y estudios se capturan literalmente desde declaración/documento confirmado; el agente no los infiere. El médico aporta su informe separado.

**Anexos observados en pág. 4.** Identificación del afectado y contratante, acta en los casos de menores que indica el formato, recibos fiscales, interpretaciones y un informe por médico; actuación de autoridad cuando aplique. No afirmar que todo se exige en cualquier caso sin revisar modalidad.

**Controles.** Sin casillas Sí/No preseleccionadas; desconocido es distinto de No. Mantener las cuatro páginas y sus espacios de firma. No copiar una firma previa ni aceptar automáticamente autorizaciones de salud o publicidad. El agente puede listar faltantes, no convertir una narrativa de WhatsApp en una declaración firmada.

### F02. Informe médico BX+

Original: `02_informe_medico_GMM_SM008.pdf`.

**Aplicación.** Programación de cirugía/tratamiento o reembolso GMM; un informe para cada médico que corresponda. El propio documento exige que lo llene y firme el médico tratante.

- **Pág. 1:** modalidad, identificación del paciente/póliza; causa y referencia a otro médico; antecedentes, padecimiento, signos/fechas, diagnóstico CIE-10, evolución/tipo, exploración/estudios y signos vitales; tratamiento, CPT4, fecha y participantes.
- **Pág. 2:** duración, complicaciones, interconsultas, observaciones; hospitalización/estancia/fechas; identidad, RFC, cédulas/contacto del médico; convenio, aceptación de tabuladores/presupuesto, fecha y hospital de cirugía.
- **Pág. 3:** declaraciones profesionales, lugar/fecha y nombre/firma del médico. Contiene también una declaración de recepción de información comercial que no debe activarse por el sistema.

**Automatización permitida en fase inicial.** Preparar paquete del trámite, solicitar informe al médico y verificar presencia de páginas, firma y campos administrativos. Si se propone prellenar identificación del paciente, conservarla como borrador para que el médico la revise; confirmar que el canal lo acepta.

**Reservado al médico.** Diagnóstico, CIE/CPT, síntomas, antecedentes, fechas clínicas, pronóstico/evolución, tratamiento, técnica, complicaciones, honorarios, convenio y aceptación de tabuladores. El broker no certifica estos datos por él. No generar códigos médicos ni contestar No a lo ausente para completar el PDF.

**Salida del agente.** “Informe médico pendiente de completar/validar por el médico”, con tareas y enlace al trámite. No “informe final válido” por haber llenado casillas.

### F03. Desglose de gastos BX+

Original: `03_desglose_de_gastos_GMM.pdf`.

**Aplicación.** Relación administrativa de facturas e informes de un evento GMM, especialmente complementos de reembolso según el catálogo público de BX+. Confirmar cuándo también lo requiere el canal para un inicial.

**Campos.** Folio, póliza, certificado, complemento, vigencia con hora impresa de las 12:00, número de siniestro, titular/afectado/parentesco. Tabla de **9 gastos**: número de recibo/factura, proveedor, especialidad, IVA, total. Tabla de **2 informes médicos**: nombre, especialidad, fecha, observaciones. Recepción: atendido por, sello/firma, lugar/fecha.

**Agente/CRM.** Extraer candidatos de facturas autorizadas, preferentemente CFDI XML, y permitir captura manual de exactamente los mismos datos. Detectar duplicados por UUID cuando exista; no usar solo el nombre de archivo. Guardar IVA explícito: no inferir una tasa ni confundir exento con cero. Importes en centavos/Decimal y moneda por factura; no sumar monedas diferentes.

**Revisión.** El asesor valida relación con evento y comprobantes. El total declarado no es monto autorizado por la aseguradora. El sello/firma del receptor y el folio de aseguradora se dejan pendientes hasta recepción real.

**Capacidad.** No reducir la letra hasta hacerla ilegible ni perder la décima factura. Dividir en hojas/formatos relacionados o anexos si el canal los admite, con identificación y totales revisados. Los nombres internos de proveedor/IVA tienen tooltips repetidos: mapear por nombre técnico, fila y rectángulo, no por tooltip únicamente.

### F04. Pago-finiquito BX+

Original: `04_pago_finiquito.pdf`.

**Aplicación.** Solicitud de indemnización por transferencia para AP, GMM y Vida según su título. Puede prepararse como parte del expediente de reembolso; no significa que la indemnización haya sido aprobada ni pagada.

**Campos.** Folio/número, inicial o complemento, póliza, siniestro en complemento, asegurado, lugar/fecha del evento. Banco, plaza, sucursal, cuenta/tipo, **18 posiciones CLABE**, email, fecha de firma y nombre/firma del beneficiario.

**Condición impresa.** La sección bancaria se llena para siniestro inicial o cambio de cuenta. Para un complemento sin cambio, no volver a copiar datos bancarios por defecto. Se piden estado de cuenta e identificación. Si el beneficiario es menor, el formato indica firma de padre o tutor.

**Automatizar.** Prellenado administrativo, comprobación de longitud/dígito verificador de CLABE y conciliación con comprobante por persona autorizada. Un dígito válido no demuestra titularidad ni autoriza transferencias. Nunca pedir PIN, contraseña bancaria, CVV o códigos de acceso.

**Firma y efecto.** Contiene cláusulas de finiquito, declaración de otros seguros y subrogación; conservar íntegramente y presentar al firmante. El texto vincula el finiquito a la recepción de la transferencia total: no registrar “liquidado” por generar o firmar este PDF. La aplicación no interpreta ni acepta esas declaraciones por el beneficiario.

**Separación contable.** Una indemnización de aseguradora no es un recibo de prima del modelo `Payment`. No crear un pago de prima, ejecutar una transferencia ni cerrar un siniestro al exportarlo. Hará falta un registro de liquidación propio con evidencia si AJ desea seguir ese movimiento.

### F05. Informe médico MetLife

Original: `Informe-medico25.pdf`. Código observado: **CC-1-020 VER. 7**. “25” en el nombre no es su versión documental.

- **Pág. 1:** instrucciones, lugar/fecha, paciente (nombre, edad/sexo, causa, peso/talla y primera atención), antecedentes clínicos.
- **Pág. 2:** padecimiento actual, etiología, exploración, CIE/CPT, fechas, técnica/equipos/materiales, complicaciones, estado y tratamiento futuro; hospitalización y observaciones.
- **Pág. 3:** equipo quirúrgico (anestesiólogo, ayudante y otros), cédulas/RFC/contactos; datos del médico, tipo de participación, convenio/tabuladores y presupuesto por profesional.
- **Pág. 4:** autorizaciones/declaraciones profesionales, **nombre y firma autógrafa del médico**, aviso de privacidad.

**Aplicación y responsabilidad.** Un informe por tratante/interconsultante. Indica actualizar cada **6 meses**, por cambio de médico o modificación de tratamiento/padecimiento. Es una regla de este formato; no imponerla automáticamente a BX+ u otras compañías. Sugerir recordatorio según fecha real del informe y verificar el caso con Ale.

**Automatización.** Misma limitación clínica de F02. No existen campos AcroForm en la copia entregada: un futuro generador debe usar coordenadas versionadas o una plantilla editable oficial comprobada; conservar las cuatro páginas. La posibilidad de escribir encima del PDF no reemplaza la validación y firma del médico.

### F06. Cambios GMM individual MetLife

Original: `Solicitud de cambios GMM-IG-2-020 Version 11.pdf`. Código coincide: **IG-2-020 VER. 11**.

**Aplicación.** Endosos/correcciones administrativas o contractuales de GMM individual. No es solicitud de póliza nueva, reclamación ni confirmación de renovación.

- **Pág. 1:** contratante, lugar/fecha, póliza/RFC/nombre/contacto; selección de trámites sin afectación, con afectación, cancelación, devolución, aclaración/aplicación de primas, rehabilitación y conducto de cobro. Incluye autorización de documentos por email.
- **Pág. 2:** detalle del dato nuevo, fecha solicitada, autorización, aceptación sujeta a la aseguradora y tabla de agente/clave/sucursal/promotoría; firmas de asegurado y contratante.

**Condiciones y anexos del propio impreso.** Formato 5/actualización de información en los cambios señalados; identificación de beneficiarios para ese cambio; solicitud adicional de rehabilitación; instrucción de pago para CLABE/tarjeta. No se aportaron esos anexos: pedir el correcto y registrar pendiente, no producir un sustituto inventado.

**Captura guiada.** Preguntar qué quiere cambiar y valor actual/nuevo con fuente. Marcar solo trámites confirmados. Distinguir **forma de pago** (periodicidad) de **conducto de cobro** (cuenta/tarjeta/agente). Un cambio puede afectar primas o aceptación; no recalcular el contrato a partir de la solicitud.

**Resultado.** `solicitado` no significa `aprobado`. Mantener la póliza actual y abrir seguimiento; actualizar solo después de recibir endoso/documentación aceptada y revisión humana, preservando historial. La fecha solicitada no es una fecha de aceptación automática.

### F07. Cambios Vida individual MetLife

Original: `Solicitud de cambios VIDA VV-1-087- VERSIÓN 11.pdf`. **El documento realmente muestra IV-1-011 VER. 13** en pág. 1. Catalogar por código impreso y hash; conservar el nombre recibido como alias, sin renombrar el original del usuario.

- **Pág. 1:** póliza y contratante/asegurado; corrección de identidad, domicilio, RFC, género, estado civil y actualización; beneficiarios, aclaraciones, duplicados, agente y estados de cuenta; cambios de moneda, suma, periodicidad, plan, edad/nacimiento, dictamen, extraprimas/beneficios, no fumador y planes capitalizables; rescates/retiros/cancelación; devolución/aclaración/aplicación de pagos; rehabilitación/conducto de cobro.
- **Pág. 2:** detalle nuevo, autorización/fecha solicitada, privacidad, revisión del agente/clave/promotoría, lugar/fecha y firma del contratante o asegurado según el requerimiento.

**Responsable.** Ale, confirmado por Tony. El firmante depende del trámite y calidad de la persona; no asumir que quien escribe por WhatsApp tiene facultad para pedir rescate, cambiar beneficiarios o cancelar. El formato pide una solicitud por cada póliza.

**Hallazgo técnico bloqueante.** Campo PDF **`20`**, pág. 1, tiene `/V=/On` y `/AS=/On`, sobre la opción **Cambio de conducto de cobro a agente**. No es una respuesta del cliente nuevo. La copia base de trabajo deberá desmarcarlo expresamente y regenerar su apariencia antes de uso, conservando original inmutable; validar visualmente que ningún cambio quede elegido sin instrucción. Las casillas numéricas no se deducen por orden del texto extraído.

**Anexos.** Formato 5, designación/identificación de beneficiarios, rehabilitación e instrucción de pago según opción, además de documentación que confirme el canal. Son pendientes de catálogo. Cambios de suma/plan/moneda o rescates se preparan para revisión de Ale, no se ejecutan ni valoran por IA.

### F08. Reclamación GMM MetLife

Original: `Solicitud de reclamación gastos médicos mayores VG-2-068 VER.12.pdf`. Código observado **VG-2-068 VER. 12**.

- **Pág. 1 (apartados 1-4):** colectiva/individual y contratante; titular (nombre, nacimiento/nacionalidad, ocupación, RFC, ramo, póliza, CURP); afectado (nombre, nacimiento, CURP, ocupación, certificado, parentesco); domicilio/contacto del titular; lugar/fecha.
- **Pág. 2 (5-6):** autorizaciones de notificaciones, otras pólizas, antecedentes de reclamación en MetLife/otra compañía, declaración PEP; hospitalización/programación/reembolso, inicial/subsecuente, número de siniestro, información requerida y folio DCN; causa/fechas y relato del evento.
- **Pág. 3 (continuación de 6, 7-9):** autoridad/comentarios; **solo reembolso**: relación de comprobantes H/M/F/O y total reclamado; resultados/interpretaciones presentados, solicitud de cheque/transferencia y **solo transferencia**: banco/CLABE. La tabla tiene 3 bloques de 7 filas (21 espacios); no recortar excedentes.
- **Pág. 4:** declaraciones y autorizaciones, aceptación y nombre/firma del titular. La firma digital debe usar un sistema avalado por MetLife según el propio formato; una firma dibujada en un canvas del CRM no se presume aceptada.
- **Pág. 5:** privacidad y primer tramo del checklist de reembolso.
- **Pág. 6:** resto del checklist, programación de cirugía y registro documental impreso. Mantener todas las páginas, incluso sin captura.

**Condiciones del impreso.** Nueva solicitud por cada trámite. Subsequente requiere referencia del caso; un requerimiento previo añade DCN. Apartados 7 y 8 para reembolso, 9 para transferencia. Facturas a nombre/RFC del titular con PDF y XML; documentos médicos por cada médico, estudios según corresponda, identificación/representación y comprobantes. El impreso menciona antigüedad bancaria de 3 meses para transferencia y domicilio de 3 meses; las diferencias con el canal público se describen en sección 4. No validar PEP en una búsqueda ni contestar No por ausencia de información: es declaración del titular.

**Agente.** Prepara identificación y relación de gastos desde fuentes revisadas; pregunta faltantes no clínicos y deriva los clínicos a captura protegida por el cliente o médico. Resultados de estudios no se diagnostican ni resumen como una nueva opinión. El campo de CLABE debe compararse con el titular autorizado; excepciones contractuales se revisan, no se rechazan o aceptan por conjetura.

## 4. Versiones y requisitos externos: comprobaciones y discrepancias

Consulta oficial al corte; las páginas públicas no sustituyen las condiciones de la póliza ni la validación del canal.

1. [BX+: catálogo de siniestros](https://www.vepormas.com/fwpf/portal/documents/seguros-siniestros) lista aviso, informe, desglose para complemento y pago-finiquito para transferencia. También contiene identificación/conoce-a-tu-cliente no incluidos aquí. No asumir que los cuatro archivos forman un expediente universal completo.
2. [MetLife: reembolso](https://www.metlife.com.mx/tramites-y-servicios/tramites-de-seguros-de-gastos-medicos/reembolso/) enlaza [VG-2-068 VER.12](https://www.metlife.com.mx/content/dam/metlifecom/mx/pdfs/common-files/reclamacion-gmm/solicitud-de-reclamacion-gastos-medicos-mayores-vg-2-068-ver-12-pdf-editable.pdf). Coincide el código con la copia recibida; el nombre remoto dice “editable”, pero **la copia local tiene cero campos**. No atribuir editabilidad sin inspeccionar el archivo concreto.
3. [MetLife: evento programado](https://www.metlife.com.mx/tramites-y-servicios/tramites-de-seguros-de-gastos-medicos/evento-programado/) enlazaba al corte una solicitud **VER.10**, mientras reembolso enlaza VER.12. No degradar ni cambiar mapas automáticamente. Ale debe confirmar el archivo/canal del trámite. La página también solicita un [consentimiento informado adicional](https://www.metlife.com.mx/content/dam/metlifecom/mx/pdfs/formato-consentimiento-informado.pdf), no aportado entre estos ocho.
4. La página de reembolso señala estado de cuenta hasta **6 meses**; el PDF VER.12 entregado dice **3 meses**. Mostrar `requisito_por_confirmar`, fuentes y fecha; pedir confirmación o un comprobante que satisfaga ambos cuando sea posible. No afirmar una única regla universal. El nombre/código de los cambios de Vida también requiere validación antes de activar una plantilla para salida real.
5. El aviso de privacidad de la solicitud VER.12 menciona finalidades de IA de la aseguradora. Eso **no es permiso automático para AJ**, sus proveedores o entrenamiento de sus agentes. No convertir una autorización de MetLife en consentimiento para enviar expedientes médicos a un modelo.

## 5. Datos y responsabilidad por campo

| Grupo | Fuente propuesta | Confirmación/autoría | Tratamiento en IA inicial |
| --- | --- | --- | --- |
| Número de póliza, aseguradora, producto, fechas de vigencia | `Policy` seleccionado | Asesor y documento contractual | Consulta administrativa mínima |
| Nombre/contacto/RFC | `Client`, contactos y documentos confirmados | Identificar contratante, titular, afectado y beneficiario por separado | Solo lo necesario; no inferir identidades |
| Nombres separados, nacimiento, CURP, certificado, subgrupo, domicilio, nacionalidad | Falta normalización; preguntar/importar con evidencia | Titular/representante y revisión | No adivinar apellidos ni completar con datos de otro familiar |
| Fecha/evento, inicial/complemento, otros seguros, PEP | Declaración y referencias del trámite | Persona que declara | Agente identifica faltantes; no decide respuestas |
| Historia clínica, diagnóstico, CIE/CPT, estudios, tratamiento | Médico y documentos clínicos | Médico para informe; cliente para su propia declaración | Fuera del chat genérico y de sus logs; captura protegida |
| Facturas/IVA/importes | CFDI/documentos y captura | Cliente/asesor revisa | Extracción acotada opcional; suma determinista, no cobertura |
| Banco/CLABE/cuenta | Estado de cuenta y declaración | Beneficiario/titular autorizado; cotejo humano | Captura protegida; mostrar solo terminación fuera de esa vista |
| Consentimientos, firma y fecha de firma | Acto específico del firmante | Cliente, contratante, representante o médico | Nunca los genera el agente; no usar el nombre como firma |
| Sello de recepción, folio de aseguradora, DCN, decisión | Acuse/documento externo | Asesor registra evidencia real | Sin inventar folios ni estados |

No normalizar respuestas ausentes como No, 0, “sin antecedentes” o “no aplica”. Registrar `missing`, `provided`, `verified`, `not_applicable` con motivo y autor. “No aplica” no se imprime en un formato sin confirmar que es aceptable en ese campo.

Cada valor necesita origen (`crm`, `client`, `broker`, `doctor`, `document`, `extraction`), referencia de fuente/página, quién lo confirmó y fecha. Un valor extraído sigue pendiente aunque el OCR tenga confianza alta. Mantener originales; diferencias entre fuentes se presentan para resolver.

## 6. UX deseada: manual, cliente y agente

### Entrada desde expediente

Botón **Nuevo trámite** en póliza/expediente y en un siniestro existente. Mostrar aseguradora, ramo, vigencia, titular/afectado y responsable antes de empezar. Elegir objetivo en lenguaje natural: reembolso, complemento, cirugía programada, cambios de póliza o datos para indemnización. Después proponer la plantilla aplicable y sus anexos; no mostrar ocho PDF indistintos.

Ficha en pasos: **Caso -> Personas -> Datos del trámite -> Documentos -> Revisión -> PDF y firmas -> Seguimiento**. Las secciones condicionales solo aparecen cuando corresponden. Los campos prellenados indican su fuente y permiten corregir el borrador sin cambiar silenciosamente el dato maestro del CRM. Guardado parcial, faltantes visibles y progreso por secciones, no “100% enviado” por completar captura.

### Manual

El asesor puede completar la ficha sin un proveedor IA. Asignar apartados de cliente o médico y recibir documentos. Antes de exportar, mostrar vista previa y pendientes, y exigir validación de las secciones críticas. Es posible descargar un **borrador parcial** identificado como tal; no etiquetarlo listo para presentar si faltan firmas, anexos o reglas de versión.

### Autocaptura por cliente (fase posterior)

Enlace de alcance limitado a un trámite, rol y persona; vencimiento/revocación, token aleatorio almacenado con hash, control de intentos y verificación de identidad proporcional al dato. No basta conocer un `clientId` ni reutilizar el token global de integración. El cliente no ve la cartera ni otros expedientes. Separar el enlace del médico del cliente. Nunca exponer CLABE, CURP o contenido de salud en URL, analítica, vista previa de WhatsApp o notificaciones.

El envío del enlace por correo/WhatsApp es una acción específica revisable, no consecuencia de crear el trámite. El formulario médico puede mantenerse inicialmente como descarga/subida firmada por médico hasta validar un portal y su aceptación. Los menores requieren identificar al representante; un contacto no se convierte automáticamente en tutor.

### Asistido por agente

El asistente identifica modalidad, consulta datos mínimos y propone un borrador. El asesor abre la misma ficha manual para confirmarlo/corregirlo. El agente muestra qué falta y quién debe proporcionarlo; tareas automáticas propuestas para Ale o Joel según ramo. No entra a portales de aseguradoras ni representa al cliente sin una integración y autorización específicas.

Herramientas futuras propuestas: `consultar_plantillas`, `consultar_estado_tramite`, `proponer_borrador_tramite`, `proponer_solicitud_faltantes`. La generación determinista del PDF usa un snapshot confirmado, no texto libre producido por el modelo. No incluir herramientas de firma, pagos, aprobación de cobertura o envío libre. Esos nombres son propuestas futuras. Las herramientas administrativas implementadas son `estado_ficha_cliente` y `preparar_ficha_cliente`; no generan PDF ni aceptan datos clínicos/bancarios.

## 7. Encaje con los agentes actuales

| Agente actual | Aporte futuro |
| --- | --- |
| `primer-contacto` | Identificar intención y enviar a asesor; enlace mínimo al trámite tras autorización. No pedir historia clínica en WhatsApp |
| `captura-cotizacion` | No mezclar diagnóstico comercial con reclamación. Estos formatos no son solicitudes de emisión nueva |
| `entrega-poliza` | Explicar qué trámite usar y registrar documentos de entrega; no firmar formularios |
| `renovaciones-pagos` | Preparar cambio de periodicidad/conducto, separar propuesta de endoso y pago de prima de indemnización |
| `siniestros-orientacion` | Principal orquestador de GMM: paquete por aseguradora, faltantes, médico, acuse y seguimiento, sin dictamen clínico |
| `aprendizaje-interno` | Explicar formularios y responsabilidades usando esta guía |
| `analisis-casos` | Solo métricas de trámites/tiempos/faltantes; sin narrativas clínicas ni cuentas |
| `contenidos-guiones` | Ningún acceso a respuestas médicas, cuentas, firmas o expedientes; ejemplos sintéticos/anónimos |

Los prompts existentes dicen Ale para GMM y Joel para Autos; Vida debe añadirse con la confirmación de Tony. Hay frases antiguas sobre WhatsApp aún desconectado: el envío manual desde CRM fue confirmado por el usuario; no usarlas como estado actual. Revisar textos en un cambio dedicado, sin confundir este contexto con código publicado.

El código actual prohíbe pedir/guardar/repetir detalles médicos en los chats generales y sus herramientas omiten descripciones de siniestros. **Conservar esa barrera.** `src/agents/server.ts` guarda parte de la pregunta y respuesta en `AgentRun`: por ello no se habilita captura clínica pegando estos formularios en el chat actual. Un acceso clínico futuro exige diseño de permisos, minimización, consentimiento aplicable y eliminación de contenido sensible en logs antes de activarlo. Mientras tanto el agente recibe estados como `informe_medico_pendiente`, nunca su texto.

## 8. Arquitectura propuesta, todavía no implementada

### Entidades

Este es el objetivo del módulo completo de trámites. La fase ya implementada usa `ClientIntake` y `ClientIntakeRevision`, separados de los datos maestros del cliente. No confundir estas entidades propuestas con tablas existentes.

- `FormTemplate`: aseguradora, ramo/producto, tipo individual/colectivo, trámite, código/versión impresa, nombre recibido, hash, páginas, ubicación privada del PDF, modo AcroForm/overlay, esquema y mapa de campos, validación de canal y estado draft/active/retired. Los formatos se activan por revisión; no basta subir un archivo.
- `ServiceRequest`: cliente, póliza/vigencia y siniestro opcional; tipo, responsable, personas/roles, estado y referencias **separadas** (ID interno, folio aseguradora, siniestro aseguradora, DCN). Referencias externas no se inventan ni se rellenan con el CUID interno.
- `FormDraft` / `FormRevision`: plantilla/hash/esquema congelados, respuestas y procedencia, número de versión, validador, snapshot de entidades consultadas, errores/faltantes. Control optimista `expectedUpdatedAt` e idempotencia al crear/exportar.
- `RequestAttachment`: vínculo entre trámite, `Document` y requisito, clasificación administrativa/salud/financiera/identidad/firma; recibido, revisado, sustituido y motivo. No declarar “validado” solo por existir un archivo.
- `RequestConsent` y evidencia de firma: firmante, facultad, finalidad, versión de texto, fecha y evidencia; permisos distintos de aceptación de documentos comerciales. No guardar una firma reutilizable para aplicarla a cualquier solicitud.
- `RequestEvent`: estados, actor, fecha, motivo y referencias a versiones/documentos; sin duplicar valores médicos o bancarios en auditoría.

Las respuestas sensibles deben tener almacenamiento y acceso segregados; un único JSON general legible por todo el equipo no resuelve esto. R2 privado por sí solo no limita el acceso de cada persona. Reusar `Document` con controles del trámite y evaluar la descarga actual, no poner documentos en `public/`.

### Estados

`BORRADOR -> ESPERANDO_DATOS / ESPERANDO_MEDICO -> EN_REVISION -> PENDIENTE_FIRMA -> LISTO_PARA_PRESENTAR -> PRESENTADO -> REQUERIDO / RESUELTO / RETIRADO`.

Se permiten iteraciones de borrador; después de firma/presentación el snapshot queda inmutable. Correcciones crean nueva revisión o trámite, vinculados al anterior, con nueva validación/firma cuando corresponda. El propio formato puede no admitir cambios posteriores; no reescribir el firmado.

`PRESENTADO` exige evidencia del canal/acuse/fecha real. Exportar/descargar/enviar al cliente no lo activa. `RESUELTO` requiere resultado de aseguradora; no equivale a pagado ni a siniestro cerrado. `Claim.status` actual (OPEN/IN_REVIEW/CLOSED) no debe ampliarse de hecho con valores de este flujo; los estados son del trámite propuesto.

### Servicios y rutas sugeridas

`src/modules/tramites/` para catálogo, validaciones y servicios; adaptadores PDF por aseguradora. `GET /api/form-templates`, `POST /api/service-requests`, `GET/PATCH /api/service-requests/:id`, `POST .../:id/export`, `POST .../:id/mark-submitted` y futuros enlaces de captura. Son nombres propuestos, no rutas disponibles hoy.

Roles actuales USER/ADMIN/SUPERADMIN se conservan, añadiendo autorización por trámite, persona y clase documental en cada lectura/descarga/mutación. USER no implica acceso general a información de salud. Doctor/cliente externos no son roles globales de la cartera. El owner se resuelve en servidor, no se confía en el email enviado por el navegador.

## 9. Generación PDF y adjuntos

1. Guardar original inmutable y hash; cada salida registra plantilla y versión de respuestas. Nunca sobrescribir los ocho originales de Tony ni un PDF ya firmado.
2. Completar solo campos con mapeo semántico revisado (nombre técnico, página, rectángulo, opción/export value, tipo y responsable). No adivinar `undefined`, `1`, `20`, `MAIL1` o campos de firma por su orden.
3. En AcroForm revisar árbol de campos y widgets, valores `/V`, `/AS` y apariencias `/AP`; generar apariencias visibles. El caso `Sexo` tiene padre e hijos; no reconstruir duplicados sin inspección. El campo 20 de Vida exige neutralización en la copia de trabajo validada, no heredar la marca.
4. En PDFs estáticos versionar coordenadas y fuentes con el hash del original. No borrar páginas legales ni usar el mapa de VER.10 sobre VER.12. Texto extenso debe caber o ir a anexo admitido; nunca truncarlo silenciosamente.
5. Validar dígitos por casilla (CLABE/RFC), acentos, fechas DD/MM/AAAA, tablas, nombres largos, casillas mutuamente excluyentes y total por moneda. Fechas de síntomas, ocurrencia, primera atención, diagnóstico, vigencia y firma son campos distintos; no rellenarlos todos con hoy.
6. Renderizar todas las páginas y verificar visualmente; volver a abrir los valores lógicos si el PDF sigue editable. No marcar `listo` solo por un render correcto. El mecanismo de firma debe aceptarlo el canal; firma médica, consentimientos y revisión del asegurado siguen siendo personales.
7. Guardar salida en R2 privado, registrar el `Document` del trámite y revisión; descarga con autorización y enlace temporal. Escanear adjuntos y controlar tamaño/tipo. Mostrar borrador/final y pendientes fuera de los campos oficiales.

**Brecha real de adjuntos.** El CRM actual acepta PDF, imágenes, audio y video hasta 4 MiB, pero **no XML** (`src/modules/documentos/file-types.ts` y `file-policy.ts`). El expediente de reembolso MetLife pide PDF y XML: antes de implementarlo hay que añadir tratamiento seguro de CFDI, parser sin entidades externas/DTD, límites y validación de formato, retención del original, deduplicación por UUID y descarga como adjunto. No cambiar la extensión para forzar la carga ni decir al usuario que el requisito ya se cumple. Un conjunto puede exceder límites del canal; preparar división permitida sin comprimir ni alterar firmas de PDFs ya firmados.

## 10. Plan de implementación y aceptación

### Fase A: captura manual y PDFs administrativos

Catálogo privado con activación revisada, expediente/trámite con personas y propietario, borradores y documentos. Primer piloto sugerido: solicitud de cambios GMM o Vida simple y desglose BX+ con datos sintéticos. Validar con Ale la plantilla Vida y neutralizar la casilla previa. Resolver identidad de contratante/titular/afectado y anexos antes de presentar casos reales.

### Fase B: paquete de siniestro y firma externa

Reclamación/aviso condicionales, informes por médico como descarga/subida firmada, CFDI XML, datos bancarios protegidos y checklist por modalidad. Verificar con aseguradora qué salida digital y firma acepta. Validar un paquete real con revisión humana y acuse; no subir información a portales por el solo hecho de probar la app.

### Fase C: agentes y autocaptura

Conectar herramientas acotadas a la misma ficha, estado de faltantes y solicitud de revisión. Enlaces temporales para cliente y médico, roles por caso, consentimiento y logs sin contenido sensible. Probar acceso cruzado antes de abrirlos. Mantener opción manual cuando no haya clave de IA o el proveedor falle.

### Casos mínimos de aceptación

- Cliente con dos pólizas de distintas compañías: no mezclar personas, vigencias ni anexos.
- Ale: GMM y Vida; Joel: Autos sin plantilla en este lote -> escalamiento, no reutilización GMM.
- BX+ complemento sin cambio de cuenta -> datos bancarios no se solicitan automáticamente; con cambio -> comprobante y revisión.
- MetLife cirugía -> apartados de reembolso/banco no requeridos; MetLife reembolso por cheque -> no requerir CLABE; transferencia -> validar y cotejar.
- Asegurado afectado menor o distinto del titular -> representante y firmas correctas, sin asumir que contratante es tutor.
- Informe médico ausente/incompleto/antiguo -> pendiente, no informe generado por IA; recordar regla de 6 meses solo donde se identificó.
- Vida nuevo borrador sin instrucción -> campo 20 apagado en datos y apariencia. Cambio no solicitado nunca aparece seleccionado.
- PEP, otros seguros, avisos comerciales y consentimientos sin respuesta -> pendientes, no “No” o “Sí” predeterminados.
- Factura repetida, moneda diferente o décima fila BX+ -> aviso/división revisada, sin doble conteo ni truncamiento. Gastos reclamados nunca crean recibos de prima.
- Otra persona intenta abrir, exportar o descargar el trámite -> rechazo en servidor, sin filtrar metadatos sensibles.
- Doble clic/reintento -> una revisión/salida por llave; edición simultánea -> conflicto visible.
- Copia de plantilla con hash o versión distinta -> exigir nuevo mapa y revisión; conservar el original anterior.
- PDF exportado sin acuse -> no marcar presentado; cambio solicitado sin endoso -> no cambiar contrato; finiquito sin evidencia bancaria -> no declarar pagado.
- El agente solo recibe metadatos y faltantes; ninguna historia clínica, CLABE, firma o narrativa de reclamación termina en `AgentRun`, URLs, métricas o mensajes generales.

## 11. Decisiones pendientes para Ale y Joel

Confirmar lista de aseguradoras/productos y canales usados, plantillas vigentes por trámite, datos de agente/promotoría, anexos que faltan, método de firma aceptado, alcance de acceso del equipo y conservación/consentimiento para datos sensibles. Solicitar específicamente catálogo de Autos para Joel; formatos de emisión nueva, beneficiarios, identificación/Formato 5, rehabilitación e instrucciones de pago no están completos en este lote.

No hace falta resolver todo para crear el catálogo y la captura manual administrativa. Sí hace falta resolver el canal y firma antes de afirmar que un PDF se puede presentar, y controles de salud/banco antes de habilitar autocaptura sensible.

## 12. Contexto corto para iniciar una tarea con otro agente

Estamos preparando el módulo de formularios/trámites de Sistema AJ (Next.js + TypeScript, Prisma/PostgreSQL, R2 privado). Ale atiende MEDICAL y LIFE; Joel AUTO, confirmado por Tony el 27/10/2026. Revisamos ocho PDFs, 23 páginas: cuatro BX+ GMM/AP/Vida y cuatro MetLife GMM/Vida. Hay seis AcroForms y dos PDF sin campos. El archivo de cambios Vida tiene un nombre engañoso: el código impreso es IV-1-011 VER.13, y trae el campo 20 activado para cambiar conducto a agente: no heredarlo. Implementar una misma ficha manual y asistida con estados, fuentes, faltantes, revisión, PDF oficial y firmas de sus titulares. Los informes clínicos los completa/firma el médico. Mantener las restricciones de salud de los chats actuales y no usar logs de AgentRun para respuestas sensibles. No confundir indemnizaciones con pagos de prima, exportación con presentación ni solicitud de cambio con endoso aprobado. La ficha administrativa externa/manual ya existe; los trámites oficiales y el generador PDF todavía son especificación. Leer IMPLEMENTACION-FICHA-CLIENTE.md antes de continuar. Empezar por leer este documento y el catálogo técnico; no publicar PDFs originales ni datos de clientes en el repositorio público.
