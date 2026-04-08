# Flujo de permisos de edificación en Chile y diseño de agentes de pre-revisión

## Resumen ejecutivo

Este documento describe en detalle el ecosistema normativo y procedimental de los permisos de edificación en Chile, con foco en la comuna de Las Condes, y lo conecta con el diseño de un sistema de agentes de IA de pre-revisión normativa para arquitectos. Se analizan los cuerpos legales clave (LGUC, OGUC y PRC), los documentos que intervienen en cada fase, el rol de la Dirección de Obras Municipales (DOM), el Certificado de Informaciones Previas (CIP) y el impacto de la Ley 21.718 en plazos y responsabilidades, articulando todo ello con el diseño de los cuatro agentes propuestos en la especificación DSAIL.[^1][^2][^3][^4]

[^1]

***

## 1. Marco normativo: LGUC, OGUC, PRC y jerarquía

### 1.1. LGUC: Ley General de Urbanismo y Construcciones

La Ley General de Urbanismo y Construcciones (LGUC) es una ley nacional que establece el marco básico para la planificación urbana, la subdivisión de predios y la construcción en todo el territorio de Chile. En ella se definen competencias de los órganos públicos (MINVU, SEREMI, municipalidades y DOM), tipos de permisos y autorizaciones, régimen de reclamaciones y responsabilidades administrativas.[^4][^5]

La LGUC fija principios y reglas generales (por ejemplo, que para construir o ampliar edificaciones se requiere permiso de la DOM) y delega en la Ordenanza General de Urbanismo y Construcciones (OGUC) el detalle procedimental y técnico. La Ley 21.718 agregó a la LGUC plazos perentorios para la DOM (30 o 60 días, según el tipo y escala de proyecto) e introdujo el silencio administrativo negativo para permisos de edificación.[^5][^6][^7][^4]

### 1.2. OGUC: Ordenanza General de Urbanismo y Construcciones

La OGUC es un reglamento nacional dictado por el MINVU que desarrolla las disposiciones de la LGUC con un alto nivel de detalle técnico. Entre otras materias, la OGUC regula:[^6][^4]

- La emisión del Certificado de Informaciones Previas (CIP) y su contenido (art. 1.4.4).[^8][^2]
- Los procedimientos y plazos para la tramitación de permisos de edificación y otros actos (título 5, capítulo 1).[^9][^6]
- El contenido obligatorio del expediente de un permiso de edificación de obra nueva (art. 5.1.6) y otros tipos de permisos.[^3][^9]
- Definiciones de parámetros urbanísticos (coeficientes de constructibilidad y ocupación, alturas, densidades, distanciamientos, rasantes, usos de suelo, etc.).[^8][^9]

En términos de jerarquía, la OGUC tiene rango reglamentario, subordinado a la LGUC pero superior a los instrumentos de planificación territorial locales.[^4]

### 1.3. Plan Regulador Comunal (PRC)

El Plan Regulador Comunal (PRC) es un instrumento normativo local dictado por cada municipalidad, aprobado de acuerdo con la LGUC y OGUC, que regula el uso de suelo, la zonificación y las normas urbanísticas específicas al interior de la comuna. El PRC de Las Condes, por ejemplo, define zonas y subzonas como ZHR2, estableciendo para cada una usos permitidos, sistemas de agrupamiento, alturas máximas, coeficientes de constructibilidad y ocupación, densidades y exigencias de estacionamientos.[^2][^10][^1][^4]

El PRC debe ser coherente con la LGUC y OGUC: no puede autorizar menos que lo que exigen las normas nacionales, ni permitir usos o parámetros incompatibles con las disposiciones de mayor jerarquía.[^10][^4]

### 1.4. Jerarquía normativa y alcance territorial

La jerarquía y ámbito territorial pueden sintetizarse así:[^10][^4]

| Nivel | Instrumento | Alcance | Carácter |
|------|-------------|---------|----------|
| Nacional | LGUC | Todo Chile | Ley (marco general) |
| Nacional | OGUC | Todo Chile | Reglamento (detalle técnico y procedimental) |
| Supra-comunal | Plan Regulador Intercomunal/Metropolitano | Varias comunas | Normas urbanísticas estructurales |
| Comunal | PRC y planes seccionales | Una comuna | Zonificación y normas urbanísticas locales |
| Municipal | Ordenanzas de derechos y tasas | Una comuna | Tarifas, derechos municipales, procedimientos internos |

Este orden determina cómo debe razonar el agente de cumplimiento: en caso de conflicto, prevalece la LGUC, luego la OGUC y finalmente los instrumentos locales.[^4][^10]

***

## 2. Actores clave y rol de la DOM

### 2.1. Actores privados del proceso de permiso

La especificación DSAIL identifica correctamente los principales actores del lado del proyecto:[^1]

- **Propietario / mandante**: titular del predio o su representante legal; firma la solicitud de permiso y asume el pago de derechos y costos de construcción.[^1]
- **Arquitecto proyectista / patrocinante**: responsable del diseño arquitectónico y del cumplimiento integral de la normativa; firma planos, especificaciones y formularios, y declara que el proyecto cumple LGUC, OGUC y el PRC aplicable.[^9][^1]
- **Ingeniero calculista estructural**: desarrolla el proyecto estructural y la memoria de cálculo; su participación es obligatoria según tipo y complejidad de la obra (art. 5.1.7 OGUC).(resumido de)[^9][^1]
- **Ingenieros especialistas (MEP)**: diseñan proyectos de instalaciones (eléctricas, sanitarias, gas, climatización, telecomunicaciones) y emiten certificados de recepción técnica para recepción definitiva.[^6][^1]
- **Revisor Independiente (RI)**: profesional o entidad que emite un informe de revisión independiente del proyecto; su informe favorable reduce a la mitad los plazos de revisión de la DOM según Ley 21.718.[^7][^1]
- **Inspector Técnico de Obra (ITO)**: supervisa en terreno la ejecución de la obra y el cumplimiento del proyecto aprobado, registrando hitos en el Libro de Obras.[^6][^1]

### 2.2. Actores públicos y utilidades

Del lado público y de servicios están:[^3][^1]

- **Dirección de Obras Municipales (DOM)**: órgano municipal encargado de aplicar LGUC, OGUC y PRC, otorgar permisos, fiscalizar obras y emitir certificados como el CIP y la recepción definitiva.[^3][^1]
- **SEREMI MINVU**: instancia regional competente para conocer reclamaciones y recursos, especialmente ante rechazos o silencio administrativo negativo.[^7][^1]
- **Empresas de servicios básicos**: empresas sanitarias, distribuidoras eléctricas, gas y telecomunicaciones, que emiten certificados de factibilidad y recepción de instalaciones, exigidos tanto en la etapa de permiso como en la de recepción definitiva.[^6][^1]

### 2.3. Cambio de rol con Ley 21.718

La Ley 21.718 tiende a desplazar parte de la responsabilidad técnica desde la DOM hacia los profesionales privados, reforzando la responsabilidad solidaria del arquitecto, revisores e ITO. La DOM pasa a enfocarse más en la verificación de normas urbanísticas y la completitud de antecedentes, con plazos de respuesta estrictos (30 o 60 días, reducibles a la mitad con RI), y bajo la amenaza del silencio administrativo negativo.[^11][^5][^7]

***

## 3. Documentos y categorías de proyectos

### 3.1. Documentos del expediente de Permiso de Edificación (obra nueva)

El art. 5.1.6 OGUC define el contenido mínimo del expediente de un permiso de edificación de obra nueva; documentos municipales y resúmenes profesionales reproducen este listado en detalle.[^12][^3][^9]

**Documentación legal y administrativa:**[^3][^9]

- Solicitud de permiso firmada por el propietario y el arquitecto proyectista, indicando o adjuntando:
  - Lista de todos los documentos y planos numerados que conforman el expediente, firmada por el arquitecto.[^12][^3]
  - Declaración simple del propietario manifestando ser titular del dominio del predio.[^3]
  - Disposiciones especiales a las que se acoge el proyecto (normas de excepción, beneficios, etc.).[^3]
- Copia del Certificado de Informaciones Previas (CIP) vigente o usado como base del anteproyecto.[^8][^3]
- Identificación completa de los profesionales que intervienen en el proyecto (arquitecto, calculista, revisores, ITO).[^9][^1]

**Formularios y antecedentes normativos:**[^1][^6]

- Formulario Único de Estadísticas de Edificación (FUE) del MINVU/INE, obligatorio para todos los permisos de edificación.[^6][^1]
- Formularios específicos de MINVU para tipos de permisos (obra nueva, ampliación, urbanización), disponibles en el portal institucional.[^13][^6]
- Informe del arquitecto o del Revisor Independiente que certifique el cumplimiento del proyecto con toda la normativa legal, reglamentaria y técnica aplicable.[^9][^1]

**Estudios de factibilidad y complementos:**[^1][^6][^3]

- Certificado de factibilidad de agua potable y alcantarillado emitido por la empresa sanitaria competente.[^6][^1]
- Estudio de impacto vial (IMIV) o certificado de no exigencia, cuando la escala de proyecto lo requiere.[^1][^3]
- Estudios de mecánica de suelos y memoria de cálculo estructural cuando lo exige el art. 5.1.15 OGUC u otras normas específicas.[^9][^1]

**Proyecto arquitectónico:**[^6][^1]

- Plano de emplazamiento: ubicación de la edificación en el predio, distancias a deslindes, rasantes y accesos peatonales y vehiculares.[^1][^6]
- Plantas de todos los niveles, con designación de recintos y cotas suficientes para cálculo de superficies y ocupación.[^1]
- Cortes y elevaciones, mostrando alturas, niveles, distanciamientos, proyecciones y rasantes.[^6][^1]
- Plano de techumbre y planos de cierros y cierres perimetrales cuando corresponda.[^6][^1]
- Cuadro de superficies, cabida y otros cuadros normativos (constructibilidad, ocupación, densidad, estacionamientos).[^8][^1]

**Proyectos de especialidades y especificaciones técnicas:**[^1][^6]

- Proyecto estructural completo, memoria de cálculo y planos estructurales.[^9][^1]
- Proyectos de instalaciones eléctricas, sanitarias, gas, climatización y telecomunicaciones, según aplique.[^6][^1]
- Especificaciones técnicas de materiales, seguridad contra incendios, condiciones térmicas y acústicas.[^1][^6]
- Documentación de ascensores y otros equipos especiales cuando sean exigibles.[^6][^1]

### 3.2. Tipologías de proyectos y permisos

Aunque la OGUC distingue múltiples tipos de permisos (obra nueva, ampliaciones, modificaciones, demolición, obras menores, urbanización, loteos, regularizaciones especiales), para efectos de producto conviene agruparlos en categorías funcionales.[^14][^9][^6]

**Por tipo de obra y finalidad:**[^9][^6]

- Permiso de Edificación – obra nueva.
- Permiso de Edificación – ampliación.
- Permiso de Edificación – modificación de proyecto.
- Permiso de demolición.
- Permisos de urbanización, subdivisión y loteo.
- Obras menores (que pueden acogerse a declaraciones y no requieren permiso en algunos casos, art. 5.1.2 OGUC).[^15][^9]

**Por uso y escala del proyecto:**[^11][^1]

- Residencial: vivienda unifamiliar, multifamiliar, grandes conjuntos.
- Equipamiento: comercio, servicios, equipamiento público.
- Mixto: residencial + comercio/servicios.
- Grandes proyectos residenciales (carga de ocupación ≥ 1.000 personas), que tienen plazos de revisión más extensos (60 días) y reglas particulares bajo la Ley 21.718.[^5][^11]

La especificación DSAIL acota el alcance inicial del prototipo a dos subcategorías de alta frecuencia: **Edificación Nueva residencial en zona ZHR2 de Las Condes** y **Ampliación residencial en la misma zona**, reduciendo el espacio normativo que el sistema debe cubrir en la primera versión.[^1]

***

## 4. Documentos que emite la DOM

### 4.1. Certificado de Informaciones Previas (CIP)

El Certificado de Informaciones Previas (CIP) es un documento emitido por la DOM o, en su defecto, por la SEREMI de Vivienda cuando la municipalidad no cuenta con dicha unidad. El art. 1.4.4 OGUC establece que debe emitirse en un plazo máximo de 7 días desde la solicitud y que contiene las condiciones urbanísticas aplicables al predio conforme a los instrumentos de planificación territorial.[^16][^8]

El CIP identifica la zona o subzona del predio y detalla, entre otros, número municipal, líneas de edificación, afectaciones a utilidad pública, requisitos de urbanización y normas urbanísticas como usos de suelo, sistemas de agrupamiento, coeficientes de constructibilidad y ocupación, alturas, distanciamientos, densidades, alturas de cierros, exigencias de estacionamientos y áreas de riesgo o protección.[^2][^16][^8]

### 4.2. Certificados catastrales y urbanísticos

Además del CIP, muchas DOM emiten certificados catastrales y urbanísticos adicionales, tales como:[^17][^10]

- Certificado de número (identificación oficial de la dirección).
- Certificado de afectación a utilidad pública.
- Certificado de uso de suelo o informe de norma urbanística simplificado.

Estos certificados se tramitan a menudo por los mismos canales que el CIP (DOM en Línea u oficinas de atención municipal) y se apoyan en la misma base de información catastral y de planificación territorial.[^17][^10]

### 4.3. Permisos y resoluciones

En el ciclo de vida de un proyecto, la DOM emite además:[^3][^6]

- **Permiso de Edificación**: resolución administrativa que aprueba el proyecto y autoriza la ejecución de las obras, acompañada de planos timbrados físicamente o en formato digital según la comuna.[^3][^6]
- **Permisos de urbanización, subdivisión y loteo**: resoluciones que aprueban proyectos de urbanización o división de predios, con sus propias exigencias de antecedentes (OGUC título 3 y 4).(resumido de)[^6]
- **Autorizaciones especiales**: cambios de destino, prórrogas de permisos, autorizaciones para obras menores o intervenciones puntuales, según regulaciones específicas.(resumido de)[^6]

### 4.4. Actas de Observaciones y Recepción Definitiva

Dos documentos adicionales son centrales para el diseño del agente:[^18][^3][^1]

- **Acta de Observaciones**: documento que la DOM emite durante la revisión técnica cuando detecta infracciones normativas o faltantes documentales; contiene una lista numerada de observaciones, cada una con descripción del problema y cita expresa de los artículos OGUC/PRC aplicables.[^3][^1]
- **Certificado de Recepción Definitiva**: resolución que declara que la obra fue construida conforme al permiso otorgado y que cumple las normas aplicables; es necesario para la plena regularización de la edificación a efectos de venta, hipoteca o conexión definitiva a ciertos servicios.[^18][^6]

El sistema de IA se centra en anticipar el contenido del Acta de Observaciones para reducir ciclos de corrección y tiempo total de tramitación.[^1]

***

## 5. Flujo completo del permiso de edificación

### 5.1. Fases del flujo según práctica y normativa

La especificación DSAIL identifica nueve fases (0 a 8) que se alinean con la práctica observada en Chile y con descripciones doctrinales del procedimiento de permiso de edificación.[^3][^1][^6]

| Fase | Nombre | Hito principal | Actores clave | Soporte Las Condes |
|------|--------|----------------|---------------|--------------------|
| 0 | Due diligence | Evaluación de cabida y normativa del predio | Propietario, arquitecto | Consulta PRC y catastro (online/presencial) |
| 1 | CIP | Emisión del Certificado de Informaciones Previas | Solicitante, DOM | Solicitud y pago en línea, plazo 7 días |
| 2 | Anteproyecto / Revisión Previa | Alineamiento de diseño y factibilidad | Arquitecto, DOM | Revisión Previa formal post Ley 21.718 |
| 3 | Expediente de Permiso | Armado del expediente técnico-legal | Arquitecto, calculista, especialistas, RI | Formularios MINVU + carga digital de archivos |
| 4 | Ingreso y Admisibilidad | Chequeo de completitud del expediente | Arquitecto, DOM | Ingreso digital vía DOM en Línea, timbre de admisibilidad |
| 5 | Revisión Técnica y Observaciones | Revisión normativa y emisión de Actas | DOM, arquitecto, RI | Seguimiento y respuesta vía DOM en Línea |
| 6 | Otorgamiento del Permiso | Resolución de Permiso de Edificación | DOM, propietario | Emisión digital, cobro de derechos (1,5% del presupuesto) |
| 7 | Construcción e Inspecciones | Ejecución y supervisión de la obra | Constructor, ITO, DOM | Inspecciones y Libro de Obras |
| 8 | Recepción Definitiva | Certificación de cumplimiento final | Propietario, arquitecto, ITO, RI, DOM | Gestión por Departamento de Recepción Definitiva |

Esta secuencia resume el paso desde la evaluación inicial del predio hasta la certificación de la obra terminada, destacando en particular la fase 5 como el cuello de botella donde se acumulan retrasos por múltiples rondas de observaciones.[^3][^1]

### 5.2. Detalle de entradas y salidas por fase

**Fase 0: Due diligence**[^2][^1]

- **Entrada de información**: antecedentes de propiedad (rol, inscripciones), PRC y planes superiores, planos catastrales, información de dominio público o municipal.
- **Actividad principal**: análisis de cabida (qué se puede construir en el predio) en función del PRC y el contexto urbano.
- **Salida de información**: definición preliminar de programa y volumen constructible, decisión de avanzar o no a la solicitud de CIP.

**Fase 1: Solicitud y emisión del CIP**[^2][^8]

- **Entrada de información**: formulario de solicitud, rol de propiedad, dirección, croquis de ubicación con superficie aproximada, datos del solicitante (nombre, RUT, correo y teléfono).[^16][^2]
- **Actividad principal**: verificación catastral del predio y extracción de normas aplicables desde los instrumentos de planificación territorial.
- **Salida de información**: CIP fechado y numerado, que incluye zona/subzona, normas urbanísticas completas, afectaciones y condiciones especiales, con vigencia definida según la OGUC y decretos complementarios.[^16][^8][^2]

**Fase 2: Anteproyecto / Revisión Previa**[^3][^1]

- **Entrada**: CIP vigente, criterios del mandante y restricciones urbanísticas.
- **Actividad principal**: desarrollo de anteproyecto arquitectónico y presentación a DOM para validación de cabida y cumplimiento preliminar.
- **Salida**: resolución de aprobación de anteproyecto o informe con observaciones preliminares que orientan el diseño final.

**Fase 3: Armado del expediente de permiso**[^9][^3][^1]

- **Entrada**: CIP, anteproyecto, toda la documentación exigida en el art. 5.1.6 OGUC (documentos legales, formularios, estudios, planos y proyectos de especialidades).
- **Actividad principal**: compilación, numeración y ordenamiento del expediente; verificación interna de completitud por el equipo proyectista.
- **Salida**: expediente técnico-legal completo, listos los archivos digitales o físicos para ingreso a la DOM.

**Fase 4: Ingreso y admisibilidad**[^17][^3]

- **Entrada**: expediente completo presentado en la oficina de partes de la DOM o vía DOM en Línea.
- **Actividad principal**: revisión formal de completitud, asignación de número de ingreso y registro en sistemas internos.
- **Salida**: expediente admitido a tramitación, lo que activa los plazos de revisión fijados por LGUC y Ley 21.718, o bien devolución por falta de antecedentes sin iniciar el cómputo de plazo.[^7][^3]

**Fase 5: Revisión técnica y emisión de Actas de Observaciones**[^3][^1]

- **Entrada**: expediente admitido, normas LGUC/OGUC/PRC, informes de factibilidad y estudios complementarios.
- **Actividad principal**: revisión detallada de parámetros urbanísticos (constructibilidad, ocupación de suelo, alturas, distancias, densidad, estacionamientos), coherencia entre CIP, PRC y planos, revisión de seguridad, habitabilidad y coherencia estructural y de instalaciones.[^1][^3]
- **Salida**: en caso de hallazgos, Acta de Observaciones con lista numerada de observaciones, descripción, cita de artículos y, a veces, valores esperados vs presentados; en caso favorable, informe sin observaciones que permite el paso al otorgamiento del permiso.[^3][^1]

La experiencia práctica indica que esta fase puede acumular en promedio más de dos rondas de observaciones para proyectos complejos, generando demoras significativas frente a los plazos teóricos de 30 o 60 días.[^1][^3]

**Fase 6: Otorgamiento del Permiso de Edificación**[^6][^3]

- **Entrada**: expediente corregido sin observaciones pendientes, pago de derechos municipales (calculados como un porcentaje del presupuesto de la obra, típicamente 1,5%).(resumido de)[^19][^3]
- **Actividad principal**: emisión de resolución de Permiso de Edificación y timbraje de planos.
- **Salida**: Permiso de Edificación y planos aprobados, que habilitan el inicio de las obras.

**Fase 7: Construcción e inspecciones**[^18][^6]

- **Entrada**: permiso y planos timbrados.
- **Actividad principal**: ejecución de la obra conforme al proyecto aprobado y a la normativa técnica; inspecciones periódicas de la DOM y registros en el Libro de Obras.
- **Salida**: obra materialmente terminada y en condiciones de ser sometida a recepción definitiva.

**Fase 8: Recepción definitiva**[^18][^6]

- **Entrada**: solicitud de recepción, certificados de instalaciones (sanitarias, eléctricas, gas, ascensores), informes del ITO y otros antecedentes exigidos por la OGUC y la DOM.[^18][^6]
- **Actividad principal**: inspección final y verificación de que la obra se ejecutó conforme al permiso y a las normas aplicables.
- **Salida**: Certificado de Recepción Definitiva, que habilita plenamente la edificación para su uso y regularización registral y comercial.[^18][^6]

***

## 6. CIP (CPI): procedimiento, costo y contenido

### 6.1. Cómo y ante quién se solicita el CIP

El CIP se solicita ante la DOM de la comuna donde se emplaza el predio, ya sea directamente a través de la DOM o por intermedio de la SEREMI cuando la municipalidad no cuenta con dicha dirección. Actualmente muchas municipalidades emplean la plataforma **DOM en Línea** del MINVU, que permite tramitar certificados como el CIP de forma electrónica, o bien portales propios (por ejemplo, “Trámites Online – Obras Municipales” en Las Condes).cite:10][^16][^17][^8]

En la plataforma DOM en Línea, el solicitante selecciona la región y comuna, el trámite “Certificado de Informaciones Previas (CIP)” y completa sus antecedentes y los del predio; el certificado se paga en línea y se recibe por correo electrónico o descarga desde el portal.[^20][^17]

### 6.2. Información requerida para la solicitud

La información mínima que se exige, de acuerdo con la OGUC y con las prácticas señaladas por municipalidades y tutoriales de DOM en Línea, incluye:[^8][^2][^16]

- Identificación del predio: rol de avalúo fiscal, dirección, comuna y croquis de ubicación que grafique el lote, sus límites y superficie aproximada.[^2][^16]
- Identificación del solicitante: nombre o razón social, RUT, teléfono y correo electrónico.[^17]
- Antecedentes adicionales cuando corresponde, como planos de subdivisión recientes o información sobre proyectos de loteo a los que pertenezca el predio.[^16][^2]

El art. 1.4.4 OGUC autoriza a la DOM a exigir, en el propio CIP, que se acompañe informe sobre la calidad del subsuelo en la solicitud de permiso si lo estima pertinente.[^8]

### 6.3. Plazos y costo del CIP

La OGUC fija un plazo máximo de 7 días para que la DOM emita el CIP, que puede ampliarse a 15 días cuando la DOM no cuenta con información catastral suficiente del predio. muchas municipalidades replican este plazo en sus sitios institucionales al describir el trámite.[^17][^16][^8]

El costo del CIP no es nacional, sino que se fija en la ordenanza municipal de derechos de cada comuna; por ejemplo, Las Condes indica un arancel específico para el certificado de informaciones previas en su sección de trámites de obras municipales, mientras que otras comunas fijan montos en UTM o fracciones de ésta.[^21][^17]

### 6.4. Contenido detallado del CIP

El contenido del CIP está descrito de manera explícita en el art. 1.4.4 OGUC y se refleja en los formularios tipo utilizados por MINVU y municipalidades.[^22][^2][^8]

Según estas fuentes, el CIP debe contener, al menos:[^2][^8]

- Identificación del predio: número municipal, rol de propiedad, ubicación, región y comuna.[^22][^2]
- Información sobre instrumentos de planificación aplicables: PRC, planes intercomunales o metropolitanos, y normas supletorias cuando no exista PRC.[^8][^2]
- Declaración de utilidad pública, si el predio está afecto a expropiaciones o ensanches viales.[^2][^8]
- Requisitos de urbanización que se deben cumplir para edificar (conexiones a redes, pavimentación, etc.).[^2]
- Normas urbanísticas específicas del predio, incluyendo:
  - Usos de suelo permitidos.
  - Sistemas de agrupamiento.
  - Coeficiente de constructibilidad.
  - Coeficiente de ocupación de suelo.
  - Alturas máximas de edificación (en metros y/o pisos).
  - Adosamientos, distanciamientos, antejardines, ochavos y rasantes.
  - Superficie mínima predial.
  - Densidades máximas autorizadas.
  - Alturas de cierros.
  - Exigencias de estacionamientos para cada uso permitido.
  - Áreas de riesgo, protección, zonas de conservación histórica o típicas y monumentos nacionales, con sus reglas especiales.
  - Exigencias de plantaciones y obras de ornato en áreas afectas a utilidad pública.
  - Límite urbano o de extensión urbana aplicable.[^8][^2]

Formularios tipo de CIP publicados por el MINVU muestran cómo esta información se estructura en secciones numeradas y tablas, lo que los hace especialmente adecuados para alimentar de forma estructurada el agente de parsing de parámetros de proyecto.[^22]

### 6.5. Rol del CIP en el diseño y en el agente de IA

En la práctica, el CIP define el “envolvente constructiva” (cabida) del predio: lo que puede o no puede hacerse desde el punto de vista urbanístico. Para el sistema de agentes, el CIP es la principal fuente de verdad para parámetros de entrada como zona, coeficientes de constructibilidad y ocupación, alturas, densidades y exigencias de estacionamientos; el Input Parser debe asegurar que lo que declara el arquitecto coincide con lo permitido por el CIP antes de pasar al análisis normativo.[^2][^1]

***

## 7. Ley 21.718: plazos, silencio administrativo y efectos en el producto

### 7.1. Plazos de revisión de la DOM

La Ley 21.718, publicada en 2024 y con entrada en vigencia prevista para 2025, modificó la LGUC para establecer plazos máximos vinculantes para que la DOM se pronuncie sobre solicitudes de permisos de construcción.[^5][^11][^7]

Las reglas generales son:[^23][^11][^5]

- Plazo de 30 días para la mayoría de los permisos de construcción, contados desde la presentación completa de la solicitud y antecedentes.
- Plazo de 60 días para proyectos con carga de ocupación igual o superior a 1.000 personas (grandes proyectos residenciales o de equipamiento).[^11][^5]
- Reducción de estos plazos a la mitad cuando la solicitud se acompaña de un informe favorable de revisor independiente (15 y 30 días, respectivamente).[^23][^5][^11]

### 7.2. Silencio administrativo negativo

La misma ley introduce el principio de silencio administrativo negativo: si la DOM no se pronuncia dentro del plazo legal, el solicitante puede hacer valer que su solicitud se entiende rechazada, habilitando recursos ante instancias superiores.[^23][^5][^7]

Este efecto no opera de pleno derecho, sino que requiere una presentación expresa del solicitante manifestando su voluntad de tener la solicitud por rechazada, a partir de lo cual se detiene la posibilidad de que la DOM emita una resolución tardía y se abren plazos para reclamar ante la SEREMI u otros órganos competentes.[^5][^7][^23]

### 7.3. Cambio en la distribución de responsabilidades

Informes técnicos y notas de difusión sobre la Ley 21.718 destacan que la DOM pasará gradualmente a centrar su revisión en aspectos urbanísticos y de completitud de antecedentes, delegando más responsabilidad en los profesionales respecto de la corrección técnica y constructiva de los proyectos. Esto refuerza la necesidad de herramientas de pre-revisión como la que propone el proyecto DSAIL, que permitan a arquitectos presentar expedientes más limpios, minimizar observaciones y evitar que los plazos legales se consuman en ciclos correctivos.[^11][^5][^1]

***

## 8. Diseño de agentes de IA: información necesaria y entrenamiento

### 8.1. Input Parser Agent

El Input Parser Agent actúa como una capa de validación de datos de entrada, transformando formularios municipales y parámetros declarados por el arquitecto en un objeto estructurado con tipos correctos y reglas de negocio básicas.[^1]

**Información necesaria:**

- Campo a campo de los formularios municipales y del CIP: dirección, rol, zona/subzona, coeficiente de constructibilidad, coeficiente de ocupación de suelo, altura máxima, número de pisos, densidad, exigencias mínimas de estacionamientos.[^22][^2][^1]
- Esquemas de validación (Pydantic) que definan campos obligatorios, rangos numéricos aceptables, valores por defecto y enums para zonas y usos.
- Ejemplos reales de proyectos en Las Condes, idealmente en formato JSON derivado de formularios o de DOM en Línea, para probar y ajustar el parser.[^17][^1]

Al no requerir razonamiento lingüístico complejo, este agente se implementa como validación determinista (sin LLM), lo que reduce latencia y costos.[^1]

### 8.2. Regulatory Retriever Agent

El Regulatory Retriever Agent es el componente de RAG que consulta una base de datos vectorial (pgvector en Supabase) que contiene artículos de OGUC, LGUC y PRC pre-chunkeados.[^1]

**Datos y documentos necesarios:**

- Corpus completo de OGUC y de los artículos y tablas del PRC de Las Condes relevantes para los tipos de proyectos manejados (p. ej. tabla de zona ZHR2, normas de altura, coeficientes y densidades).[^10][^1]
- Metadatos para cada chunk: fuente (OGUC, LGUC, PRC), número de artículo, zona, tipo de contenido (tabla, texto, definición) y vector de embedding.
- Set de queries de validación: preguntas típicas que el Reasoner podría formular (“altura máxima en ZHR2”, “coeficiente de ocupación de suelo para vivienda en ZHR2”, “tabla de estacionamientos para uso habitacional”), asociadas a los chunks que deberían recuperarse, permitiendo medir Recall@k para distintos modelos de embeddings.[^1]

El agente debe incluir guardas para detectar resultados nulos o de baja similitud y señalarlos al Reasoner como NO_RESULTS o LOW_CONFIDENCE, en lugar de entregar información engañosa.[^1]

### 8.3. Compliance Reasoner Agent

El Compliance Reasoner Agent recibe parámetros del proyecto y los chunks normativos relevantes, y debe determinar, por parámetro, si hay VIOLATION, COMPLIANT o NEEDS_REVIEW, con citas exactas de artículos y niveles de confianza.[^1]

**Información para “entrenar” vía prompt y few-shots:**

- Ejemplos reales de Actas de Observaciones donde se vea claramente la relación entre un parámetro (p. ej., altura) y el artículo infraccionado (p. ej., art. de PRC que fija altura máxima), con su descripción.[^3][^1]
- Casos sintéticos cuidadosamente diseñados que ilustren:
  - Casos de violación clara (ej. altura declarada mayor a la altura máxima de la tabla de zona).
  - Casos de cumplimiento claro.
  - Casos donde falta información o los artículos no coinciden con la zona (NEEDS_REVIEW / INSUFFICIENT_DATA).
- Reglas de incertidumbre explícitas en el prompt: no dictar VIOLATION ni COMPLIANT si no se encuentra un artículo aplicable o si la similitud del chunk es baja, y siempre producir NEEDS_REVIEW en esos casos.[^1]

### 8.4. Report Generator Agent

El Report Generator Agent toma la evaluación estructurada del Reasoner y la transforma en una Acta de Observaciones con formato y estilo equivalentes a los utilizados por la DOM.[^1]

**Fuentes y ejemplos necesarios:**

- Múltiples Actas de Observaciones reales de Las Condes y/o de comunas con formatos similares, idealmente anonimizadas.[^3][^1]
- Plantilla oficial de Acta del MINVU o una plantilla municipal estándar para usar como few-shot y como referencia de formato (secciones, numeración, encabezados, campos fijos).[^13]
- Criterios de redacción: texto objetivo, citación explícita de artículos, ausencia de juicios de valor, indicación precisa de lo que se exige corregir.

Los ejemplos deben mostrar cómo se redactan observaciones correctas (ej.: “La altura proyectada de 18,50 m excede la altura máxima de 15,00 m establecida para la zona ZHR2 por el PRC comunal, Tabla ZHR2, por lo que debe ajustarse a dicha limitación.”), incluyendo el número de artículo o tabla relevante.

### 8.5. Conexión con la arquitectura técnica

La arquitectura descrita en la especificación DSAIL se apoya en LangGraph para orquestar estos cuatro agentes como un grafo con bucles de refinamiento de recuperación, un backend FastAPI, un frontend React y Supabase como base de datos y vector store.[^1]

Los datos estructurados que se definan para alimentar a estos agentes (parámetros del proyecto, chunks normativos, observaciones y evaluaciones) deben reflejar, de forma fiel, los documentos y procedimientos descritos en las secciones anteriores, de modo que el sistema no solamente sea técnicamente correcto, sino que hable el mismo “idioma” que la DOM y que los profesionales del país.

***

## 9. Conclusiones y lineamientos para el producto

### 9.1. Información mínima para un MVP fiable

Para un MVP centrado en Las Condes y proyectos residenciales en zona ZHR2, la información prioritaria a modelar y normalizar es:[^10][^2][^1]

- Parámetros de CIP más relevantes para cabida: zona, usos, alturas, coeficientes de constructibilidad y ocupación, densidad, estacionamientos.
- Artículos OGUC y tablas del PRC que gobiernan esos parámetros específicos.
- Esquema de expediente art. 5.1.6 OGUC para Permiso de Edificación de obra nueva, al menos en lo que afecte a arquitectura y urbanismo.
- Actas de Observaciones reales que muestren cómo la DOM traduce estos incumplimientos en lenguaje administrativo.

### 9.2. Ventajas de un enfoque de pre-revisión

Un sistema de pre-revisión que se alinea estrechamente con LGUC, OGUC, PRC y las prácticas de la DOM ofrece ventajas claras:

- Reduce el número de rondas de observaciones y, por tanto, el riesgo de agotar los plazos legales introducidos por la Ley 21.718.[^5][^1]
- Mejora la calidad de los expedientes presentados por arquitectos, redistribuyendo carga de trabajo desde la DOM hacia el lado privado sin perder trazabilidad normativa.[^5][^1]
- Facilita la adopción de herramientas digitales tanto para profesionales como para administraciones municipales, ya que el formato de salida (Acta de Observaciones) refleja exactamente los documentos que la DOM ya utiliza.[^3][^1]

### 9.3. Próximos pasos recomendados

Desde la perspectiva de diseño de producto y de datos, los próximos pasos lógicos son:[^3][^1]

1. Completar y validar el corpus OGUC/PRC, asegurando que los artículos críticos (CIP, contenido de expediente, normas de zona ZHR2) estén correctamente chunked y libres de errores.
2. Diseñar y poblar un set de evaluación con proyectos reales (al menos uno con Acta de Observaciones conocida), midiendo recall, precisión y exactitud de citas.
3. Definir con mayor granularidad los esquemas JSON de entrada y salida de cada agente, basados en los documentos analizados (CIP, formularios MINVU, Actas reales).
4. Construir el grafo de agentes con LangGraph, incorporando desde el inicio las reglas de incertidumbre y el bucle de refinamiento de recuperación.

Estos pasos permiten que el sistema de agentes no sólo sea técnicamente sólido, sino también jurídicamente alineado y comprensible para los usuarios finales del sector construcción en Chile.

---

## References

1. [DSAIL-Project-Complete-Specification.pdf](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/122495671/2c39849f-fcfa-48f2-9394-e9dbac093454/DSAIL-Project-Complete-Specification.pdf?AWSAccessKeyId=ASIA2F3EMEYE2HGFLIEF&Signature=iJIOMAYpwJo7txQ7N3TXtHEN7bU%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJH%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJIMEYCIQDs1gyVaPL3DsOrqo611n%2BlVXsouMANs%2F0LTtOVzLhBwgIhALRqoj4FtyJzQV6NwinohiBMXzHUaLko5KrhcMwQ6J7MKvMECFoQARoMNjk5NzUzMzA5NzA1IgxSQP6doAQzlOTVmEQq0ARutXWWN%2FI9q1IaGPvNwnFfpHfeGX9ZTF89HBoV9ZBXKwMaEGdXgs41Ona7ZNm0vSiTzjlUHb4Vm9hVvJHk5gElTnmKs8%2FT28H%2F3YJWBjB17ZsbCTAdLbqfe0YwsXQD5KzZyHrJ4G2%2FXFv5NipIHLgZW9Hm%2FtdZqQD2zL44ijwQbzmFW3DnpOsneKmH7WSKxcH1xFeTdImUKAwMfoHLB03rok094S0YnVT82%2F0IUyINYQs%2FWXvayoAtPqOV1TfHU8bkS7ga%2FpBiru1Qbs2eLQZPiV0wBp3uPavSEsfRcni7GvJUw8UFuJ5dHB168oxhE5o0oVS7pWOd26TIbt1km9NFOPpDP7g9RZsFmTkQlk20N4YYSNOI4bAd117NZSnOILWtV9fuIMeNDkWQyMiIccluoSyWuj0sTuyKLeeQnJdCb3tuDwd1vDh%2Bd28jxzRKHsrHlVrS6s49Qi94IkmnTFKGcMpvhmfI2RsdcyMVktvPvEF8FZcQ8Oqzo8qJuJV1kJoTt6Lo3MsfSEFa7YYwqWkSS2kLILIxSGu4OnXmnT0z%2Fn0x5GgdTMB97RCTNBqZuxN1ltxCb3yr8ekgB3aJ8m64d2mzKHsm3RkqdWGfabl43u52s38wHIiRUuQb0oUJCeL3qCzJ%2F1HKWZKOFmvZPILMcS%2Bg4xPIrxjzVbuU58gD10%2Fk8pcHir1wd%2FXW047Pnc9NHCAgfO7iuVcfr123nk2Df9lHmMqvrHcpxqhHqntS5twtUQCN15nMCQqQTG%2Ba0%2FTN%2B5HlMDu5NxpaQ7uJyLaUMJqNtc4GOpcBZmdkFe3VrlAR6N8zqKA7bLWtuiBV%2F0%2FpTwiUoRivYtUgZtYepznUxNf9VAky9%2FozeEVqTLudsvihsRP0WSWB2ZqaGZyunP8Gjs4VU0MQKOjlddxEzWPEspjKpcfCw9nAo9vyZLkXzUM0HDGwkYDF3DGRzy4QV0DlPiBscTVpvGIalmkhTz9y2gZ5LXfOMTkDU%2B1TggMdTw%3D%3D&Expires=1775064173) - DSAIL Project - Complete Specification
DSAIL Project: AI Building Permit Pre-Review Agent —
Complete...

2. [CERTIFICADO INFORMACIONES PREVIAS : que es? - arqydom](https://www.arqydom.cl/certificado-informaciones-previas-que-es/) - El Certificado de Informaciones Previas (CIP) es uno de los primeros documentos que se deben obtener...

3. [Permiso de Edificación en Chile: Problemas, Derechos y ...](https://www.aguilaycia.cl/post/navegaci%C3%B3n-del-permiso-de-edificaci%C3%B3n-en-chile-problemas-derechos-y-procedimientos-para-el-propiet) - Fase Preliminar: El Certificado de Informes Previas (CIP) · Fase de Solicitud: Conformación y Presen...

4. [Conoce la Ley General de Urbanismo y Construcciones (LGUC)](https://www.cerronavia.cl/conoce-la-ley-general-de-urbanismo-y-construcciones-lguc/) - La Ley General de Urbanismo y Construcciones (LGUC) es la principal normativa que regula cómo se con...

5. [¿Qué es el CIP? El Certificado de Informaciones Previas ... - Instagram](https://www.instagram.com/reel/DNBjx9MxAsh/) - ... información evitas cometer errores que pueden resultar en multas, rechazo del proyecto o costos ...

6. [Etapas de un proyecto de construcción - Blog Captiva](https://www.captivaingenieria.cl/etapas-de-un-proyecto-de-construccion) - Una vez finalizado el proyecto, se debe solicitar al DOM la inspección de la construcción a través d...

7. [Que dice la LGUC - OGUC #silvanaariela - YouTube](https://www.youtube.com/watch?v=sHFnix3PZq4) - ... OGUC, ordenanza y ley general de urbanismo y construcción de Chile, principalnente tenemos 3 niv...

8. [¿Qué es el Certificado de Informaciones Previas? - SCS Arquitecto](https://scsarquitecto.cl/certificado-informaciones-previas-cip/) - Es un certificado emitido por la Dirección de Obras de cada Municipalidad. En él figuran las condici...

9. [Guía Completa para Obtener tu Recepción Definitiva - Arquitectura DG](https://www.arquitecturadg.com/blog/guia-completa-recepcion-definitiva) - 1. Permiso de edificación aprobado · 2. Obra terminada según proyecto aprobado · 3. Certificados de ...

10. [Ley Chile - Resolución 1546 Exenta (08-ene-2026) M. de Vivienda y ...](https://www.bcn.cl/leychile/navegar?idNorma=1220143) - Al respecto, el artículo 116 de la LGUC se refiere a densidades máximas, mientras que la OGUC se ref...

11. [NORMA VIGENTE DE LA OGUC A MODIFICAR ...](https://participacionciudadana.minvu.cl/sites/default/files/respuestas_contribuciones_decreto_cip.pdf)

12. [2 - Formularios de Permisos de Edificación - Ministerio de Vivienda ...](https://www.minvu.gob.cl/elementos-tecnicos/formularios/formularios-de-permisos-de-edificacion/) - PDF - (1665 Kb) 2-7.5 Solicitud de Recepción Definitiva de Obras de Edificación, Reparación. PDF - (...

13. [[PDF] artículo 50 de la ley general de urbanismo y construcciones](https://www.camara.cl/verDoc.aspx?prmID=215966&prmTipo=DOCUMENTO_COMISION) - MARCO LEGAL. ¿Qué es el artículo 50 LGUC? ARTICULO 50 LEY GENERAL DE. URBANISMO Y CONSTRUCCIONES. DA...

14. [¿Qué es el Certificado de Informaciones Previas (CIP ... - Instagram](https://www.instagram.com/p/DM1H4nLt9B4/) - 🏛️ Es un documento emitido por la Dirección de Obras Municipales (DOM) que indica: El uso permitido ...

15. [Permiso de Edificación y Recepción Final en Chile - TikTok](https://www.tiktok.com/@cennyarquitecturaa/video/7542680908520770822) - Permiso de Edificación y Recepción Final en Chile. Aprende sobre el proceso de permiso de edificació...

16. [[PDF] RESUMEN DE MODIFICACIONES Y RECTIFICACIONES ... - Minvu](https://www.minvu.gob.cl/wp-content/uploads/2019/05/Ley-General-Enero-2025-Ley-21.718-D.O.-29-11-2024-revision-del-13-02-2025-MFGC.pdf) - La Ley General, que contiene los principios, atribuciones, potestades, facultades, responsabilidades...

17. [Trámites OnLine - Obras Municipales - Las Condes](https://www.lascondes.cl/tramites/obras-municipales/tramites-online/) - En esta página Ud. puede solicitar, consultar y pagar los siguientes certificados: · Certificado de ...

18. [guía para solicitar el certificado de informaciones previas (CIP)](https://www.youtube.com/watch?v=0QXoyqzjefQ) - ... DOM en Línea, a través de la cual la ciudadanía podrá realizar en forma remota 80 trámites ... (...

19. [El Municipio sigue contigo - Dirección de Obras (DOM) - Viña Del Mar](https://www.munivina.cl/el-municipio-sigue-contigo/el-municipio-sigue-contigo-direccion-de-obras-dom/) - Requisitos para solicitar certificados vía internet, Sección Topografía DOM. Requisitos Generales. –...

20. [Certificado de Informaciones Previas Las Condes | PDF - Scribd](https://es.scribd.com/document/638322971/Untitled) - (C.I.P.-1.4. 4) CERTIFICADO DE INFORMACIONES PREVIAS 1/3. DIRECCIÓN DE OBRAS MUNICIPALES. FORMULARIO...

21. [DOM en Línea - Construye2025](https://construye2025.cl/iniciativa/dom-en-linea/) - DOM en Línea es una plataforma que permite solicitar, gestionar y otorgar permisos, autorizaciones y...

22. [Trámites En Dirección De Obras Municipales](https://www.muniquintero.cl/index.php/tramites-dom/) - CONTáctanos aquí Correos dom@muniquintero.cl teléfono +56322379674 PREGUNTAS FRECUENTES En esta secc...

23. [CERTIFICADO DE INFORMACIONES PREVIAS | PDF | Calle - Scribd](https://es.scribd.com/document/1013517596/CERTIFICADO-DE-INFORMACIONES-PREVIAS) - El documento es un certificado de informaciones previas emitido por la Dirección de Obras Municipale...

