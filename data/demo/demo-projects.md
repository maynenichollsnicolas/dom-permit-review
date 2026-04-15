# Demo Projects — DOM Las Condes
**6 test expedients covering every scenario in the workflow**

---

## Overview

| N° | Dirección | Zona | Estado | Escenario | Ronda |
|---|---|---|---|---|---|
| 2024-0847 | Av. Apoquindo 4521 | E-Aa1 | En revisión | 6 infracciones + 2 NEEDS_REVIEW | 1 |
| 2024-0912 | Av. El Bosque 3200 | E-Ab1 | En revisión | 2 infracciones menores | 1 |
| 2024-1023 | Av. Las Condes 12500 | E-Am2 | Admitido | Cumple todo — proyecto limpio | 1 |
| 2024-1105 | Av. Vitacura 5800 | E-Aa2 | Pendiente admisión | Demo Phase 4 — docs incompletos | 1 |
| 2024-1187 | Calle Encomenderos 350 | E-Ab2 | Observado | Demo Round 2 — corrección parcial | 2 |
| 2024-1244 | Av. P. Riesco 5200 | E-e1 | En revisión | Urgente — vence en 3 días | 1 |

---

## Proyecto 1 — 2024-0847 · Av. Apoquindo 4521
**Escenario:** Múltiples infracciones graves. Proyecto de referencia para el demo principal.
**Zona:** E-Aa1 (Edificación Aislada Alta 1)
**Tipo:** Obra Nueva Residencial
**Propietario:** Inmobiliaria Apoquindo S.A.
**Arquitecto:** Arq. Carlos Reyes

### Parámetros

| Parámetro | CIP (límite) | Declarado | Delta | Resultado esperado |
|---|---|---|---|---|
| Constructibilidad | 1.0 | 1.72 | +0.72 | VIOLATION |
| Ocupación de suelo | 0.4 | 0.61 | +0.21 | VIOLATION |
| Altura máx. (m) | 10.5 | 18.5 | +8.0 | NEEDS_REVIEW |
| Densidad (hab/há) | 20 | 312 | +292 | NEEDS_REVIEW |
| Estacionamientos/viv. | 1.0 | 0.8 | -0.2 | VIOLATION |
| Dist. lateral (m) | 6.0 | 3.0 | -3.0 | VIOLATION |
| Dist. fondo (m) | 6.0 | 3.0 | -3.0 | VIOLATION |
| Antejardín (m) | 7.0 | 5.0 | -2.0 | VIOLATION |

**Superficie predio:** 1.200 m² | **Sup. edificada:** 2.064 m² | **Unidades:** 24
**CIP:** CIP-2024-1205 | **Fecha CIP:** 10/01/2024
**RI:** No

### Documentos (`data/demo/2024-0847_apoquindo/`)
- `solicitud_firmada.pdf` ✅
- `cip_vigente.pdf` ✅
- `fue.pdf` ✅
- `planos_arquitectonicos.pdf` ✅
- `memoria_calculo.pdf` ✅

### Notas de demo
- Ya existe en la base de datos con compliance check completado
- Usar para mostrar el flujo completo Phase 5: análisis → observaciones → Acta
- Publicar el Acta y luego usar el Proyecto 5 para mostrar Round 2

---

## Proyecto 2 — 2024-0912 · Av. El Bosque 3200
**Escenario:** Infracciones menores. Fácil de corregir — muestra contraste con Proyecto 1.
**Zona:** E-Ab1 (Edificación Aislada Baja 1)
**Tipo:** Obra Nueva Residencial
**Propietario:** Sociedad El Bosque Ltda.
**Arquitecto:** Arq. Valentina Soto

### Parámetros

| Parámetro | CIP (límite) | Declarado | Delta | Resultado esperado |
|---|---|---|---|---|
| Constructibilidad | 0.7 | 0.78 | +0.08 | VIOLATION |
| Ocupación de suelo | 0.3 | 0.28 | -0.02 | COMPLIANT |
| Altura máx. (m) | 9.0 | 8.5 | -0.5 | COMPLIANT |
| Densidad (hab/há) | 150 | 120 | -30 | COMPLIANT |
| Estacionamientos/viv. | 1.0 | 1.0 | 0 | COMPLIANT |
| Dist. lateral (m) | 4.0 | 3.5 | -0.5 | VIOLATION |
| Dist. fondo (m) | 4.0 | 4.5 | +0.5 | COMPLIANT |
| Antejardín (m) | 5.0 | 5.0 | 0 | COMPLIANT |

**Superficie predio:** 800 m² | **Sup. edificada:** 624 m² | **Unidades:** 6
**CIP:** CIP-2024-0831 | **Fecha CIP:** 15/03/2024
**RI:** No

### Documentos (`data/demo/2024-0912_bosque/`)
- `solicitud_firmada.pdf` ✅
- `cip_vigente.pdf` ✅
- `fue.pdf` ✅
- `planos_arquitectonicos.pdf` ✅
- `memoria_calculo.pdf` ✅

### Notas de demo
- Ingresarlo via el portal del arquitecto para testear Phase 4 → 5
- Solo 2 infracciones (constructibilidad +0.08, dist. lateral -0.5) — correcciones simples
- Buen contraste con Proyecto 1 para mostrar variedad de severidad

---

## Proyecto 3 — 2024-1023 · Av. Las Condes 12500
**Escenario:** Proyecto completamente cumplidor. Para mostrar que la IA no genera falsos positivos.
**Zona:** E-Am2 (Edificación Aislada Media 2)
**Tipo:** Obra Nueva Residencial
**Propietario:** Familia Rodríguez Morales
**Arquitecto:** Arq. Pedro Fuentes

### Parámetros

| Parámetro | CIP (límite) | Declarado | Delta | Resultado esperado |
|---|---|---|---|---|
| Constructibilidad | 1.2 | 1.05 | -0.15 | COMPLIANT |
| Ocupación de suelo | 0.4 | 0.35 | -0.05 | COMPLIANT |
| Altura máx. (m) | 21.0 | 18.0 | -3.0 | COMPLIANT |
| Densidad (hab/há) | 250 | 200 | -50 | COMPLIANT |
| Estacionamientos/viv. | 1.0 | 1.5 | +0.5 | COMPLIANT |
| Dist. lateral (m) | 5.0 | 6.0 | +1.0 | COMPLIANT |
| Dist. fondo (m) | 5.0 | 5.5 | +0.5 | COMPLIANT |
| Antejardín (m) | 5.0 | 6.0 | +1.0 | COMPLIANT |

**Superficie predio:** 1.500 m² | **Sup. edificada:** 1.575 m² | **Unidades:** 12
**CIP:** CIP-2024-0944 | **Fecha CIP:** 05/04/2024
**RI:** Sí (plazo reducido a 15 días)

### Documentos (`data/demo/2024-1023_lascondes/`)
- `solicitud_firmada.pdf` ✅
- `cip_vigente.pdf` ✅
- `fue.pdf` ✅
- `planos_arquitectonicos.pdf` ✅
- `memoria_calculo.pdf` ✅
- `factibilidad_sanitaria.pdf` ✅

### Notas de demo
- Tiene Revisor Independiente → plazo legal 15 días
- Al ejecutar análisis, debe retornar 0 VIOLATION — muestra el lado positivo del sistema
- Acta debería decir "Sin observaciones — proyecto aprobado para continuar"

---

## Proyecto 4 — 2024-1105 · Av. Vitacura 5800
**Escenario:** Pendiente de admisión con documentos incompletos. Demo de Phase 4 (Admisibilidad).
**Zona:** E-Aa2 (Edificación Aislada Alta 2)
**Tipo:** Ampliación Residencial
**Propietario:** Sr. Andrés Kouyoumdjian
**Arquitecto:** Arq. Marcela Díaz

### Parámetros

| Parámetro | CIP (límite) | Declarado | Delta | Resultado esperado |
|---|---|---|---|---|
| Constructibilidad | 1.5 | 1.82 | +0.32 | VIOLATION (si llega a Phase 5) |
| Ocupación de suelo | 0.45 | 0.50 | +0.05 | VIOLATION |
| Altura máx. (m) | 28.0 | 32.0 | +4.0 | VIOLATION |
| Densidad (hab/há) | 300 | 280 | -20 | COMPLIANT |
| Estacionamientos/viv. | 1.5 | 1.5 | 0 | COMPLIANT |
| Dist. lateral (m) | 7.0 | 8.0 | +1.0 | COMPLIANT |
| Dist. fondo (m) | 7.0 | 7.0 | 0 | COMPLIANT |
| Antejardín (m) | 6.0 | 6.5 | +0.5 | COMPLIANT |

**Superficie predio:** 2.000 m² | **Sup. edificada:** 3.640 m² | **Unidades:** 18
**CIP:** CIP-2024-1089 | **Fecha CIP:** 20/03/2024
**RI:** No

### Documentos (`data/demo/2024-1105_vitacura/`)
- `solicitud_firmada.pdf` ✅
- `cip_vigente.pdf` ✅
- `fue.pdf` ✅
- ~~`planos_arquitectonicos.pdf`~~ ❌ **FALTANTE** (intencional — para demo Admisibilidad)
- ~~`memoria_calculo.pdf`~~ ❌ **FALTANTE** (intencional — para demo Admisibilidad)

### Notas de demo
- **Este proyecto es el demo estrella de Phase 4**
- Claude Vision debe detectar que faltan planos y memoria de cálculo → marcar como `unmet`
- El oficial de Admisibilidad ve el checklist de la IA y confirma → devuelve al arquitecto
- Si se completan los docs y se admite, tiene 3 infracciones graves esperando en Phase 5

---

## Proyecto 5 — 2024-1187 · Calle Encomenderos 350
**Escenario:** Ronda 2 — Arquitecto corrigió parcialmente. Demo del flujo multi-round.
**Zona:** E-Ab2 (Edificación Aislada Baja 2)
**Tipo:** Obra Nueva Residencial
**Propietario:** Constructora Sur S.A.
**Arquitecto:** Arq. Roberto Alarcón

### Parámetros Ronda 1 (original)

| Parámetro | CIP (límite) | Declarado R1 | Delta R1 | Resultado R1 |
|---|---|---|---|---|
| Constructibilidad | 0.8 | 0.95 | +0.15 | VIOLATION |
| Ocupación de suelo | 0.35 | 0.42 | +0.07 | VIOLATION |
| Altura máx. (m) | 12.0 | 11.5 | -0.5 | COMPLIANT |
| Dist. lateral (m) | 4.0 | 3.0 | -1.0 | VIOLATION |
| Dist. fondo (m) | 4.0 | 4.5 | +0.5 | COMPLIANT |
| Antejardín (m) | 5.0 | 4.0 | -1.0 | VIOLATION |

### Parámetros Ronda 2 (corregidos)

| Parámetro | Declarado R1 | Declarado R2 | Delta R2 | Resultado R2 esperado |
|---|---|---|---|---|
| Constructibilidad | 0.95 | **0.78** | -0.02 | COMPLIANT ✓ (resuelto) |
| Ocupación de suelo | 0.42 | **0.34** | -0.01 | COMPLIANT ✓ (resuelto) |
| Dist. lateral (m) | 3.0 | **4.2** | +0.2 | COMPLIANT ✓ (resuelto) |
| Antejardín (m) | 4.0 | **4.5** | -0.5 | VIOLATION ✗ (persiste) |

**Superficie predio:** 600 m² | **Sup. edificada R1:** 570 m² → **R2:** 468 m² | **Unidades:** 4
**CIP:** CIP-2024-1142 | **Fecha CIP:** 01/05/2024
**RI:** No

### Documentos (`data/demo/2024-1187_encomenderos/`)
- `solicitud_firmada.pdf` ✅
- `cip_vigente.pdf` ✅
- `fue.pdf` ✅
- `planos_arquitectonicos.pdf` ✅
- `memoria_calculo.pdf` ✅
- `factibilidad_sanitaria.pdf` ✅

### Notas de demo
- **Este es el demo estrella del multi-round**
- Flujo: ingresar con parámetros R1 → analizar → publicar Acta → resubmit con R2 → analizar R2
- En R2 se ven: 3 observaciones resueltas (verde ✓) y 1 que persiste (roja ✗)
- Muestra el valor de tracking entre rondas

---

## Proyecto 6 — 2024-1244 · Av. Presidente Riesco 5200
**Escenario:** Revisión urgente — vence en 3 días. Demo del color coding de urgencia.
**Zona:** E-e1 (Edificación Especial 1)
**Tipo:** Obra Nueva Residencial (edificio mixto)
**Propietario:** Inmobiliaria Centro S.A.
**Arquitecto:** Arq. Carmen Ugarte

### Parámetros

| Parámetro | CIP (límite) | Declarado | Delta | Resultado esperado |
|---|---|---|---|---|
| Constructibilidad | 2.5 | 2.8 | +0.3 | VIOLATION |
| Ocupación de suelo | 0.6 | 0.58 | -0.02 | COMPLIANT |
| Altura máx. (m) | 45.0 | 42.0 | -3.0 | COMPLIANT |
| Densidad (hab/há) | 800 | 650 | -150 | COMPLIANT |
| Estacionamientos/viv. | 1.5 | 1.2 | -0.3 | VIOLATION |
| Dist. lateral (m) | 5.0 | 5.0 | 0 | COMPLIANT |
| Dist. fondo (m) | 5.0 | 4.5 | -0.5 | VIOLATION |
| Antejardín (m) | 5.0 | 5.5 | +0.5 | COMPLIANT |

**Superficie predio:** 3.200 m² | **Sup. edificada:** 8.960 m² | **Unidades:** 48
**CIP:** CIP-2024-1198 | **Fecha CIP:** 18/03/2024
**RI:** No — **plazo vence en 3 días (CRÍTICO)**

### Documentos (`data/demo/2024-1244_riesco/`)
- `solicitud_firmada.pdf` ✅
- `cip_vigente.pdf` ✅
- `fue.pdf` ✅
- `planos_arquitectonicos.pdf` ✅
- `memoria_calculo.pdf` ✅

### Notas de demo
- Aparece en rojo en la cola del Revisor Técnico
- 3 infracciones (constructibilidad, estacionamientos, dist. fondo)
- Bueno para mostrar la presión de Ley 21.718 — el DOM tiene que actuar ya

---

## Guión de Demo — Flujo Completo

### Acto 1: Phase 4 — Admisibilidad (5 min)
1. Abrir portal del arquitecto (`/architect`) con cuenta Google de arquitecto
2. Click "Nuevo expediente" → ingresar datos del **Proyecto 4 (2024-1105)**
3. Subir los 3 docs disponibles (solicitud, CIP, FUE) — dejar planos y memoria sin subir
4. Ir a Admisibilidad (`/admisibilidad`) con cuenta DOM
5. Click "Analizar documentos con IA" → Claude Vision detecta docs faltantes
6. Mostrar checklist: 3 verde, 2 rojo (planos, memoria)
7. Seleccionar "Devolver al arquitecto" → expediente no entra a la cola

### Acto 2: Phase 5 — Revisión Técnica (5 min)
1. Ir a la cola del Revisor Técnico (`/`) — mostrar **Proyecto 6 en rojo** (urgente)
2. Abrir **Proyecto 1 (2024-0847)** → ya tiene análisis completado
3. Mostrar tab Análisis: 6 infracciones, 2 NEEDS_REVIEW, artículos citados
4. Aceptar 3 observaciones, editar 1, descartar 1
5. Ir al tab Acta → mostrar borrador en formato oficial
6. Publicar Acta

### Acto 3: Phase 5b + Round 2 — Subsanación (5 min)
1. Volver al portal del arquitecto — ver que **Proyecto 1** está en estado "Observado"
2. Click "Ver Acta y corregir" → leer observaciones
3. Ingresar valores corregidos (bajar constructibilidad, ampliar distanciamientos)
4. Click "Reenviar expediente corregido" → Round 2 se dispara
5. Volver a la cola del DOM → aparece Ronda 2
6. Ejecutar análisis → mostrar comparación R1 vs R2 con observaciones resueltas

---

## Datos para Ingreso Rápido (copiar/pegar en formulario)

### Proyecto 2 — 2024-0912 El Bosque
```
Propietario: Sociedad El Bosque Ltda.
Dirección: Av. El Bosque 3200, Las Condes
Zona: E-Ab1
Tipo: obra_nueva_residencial
RI: No
CIP N°: CIP-2024-0831
Fecha CIP: 2024-03-15
CIP constructibilidad máx: 0.7
CIP ocupación suelo máx: 0.3
CIP altura máx (m): 9.0
CIP densidad máx (hab/há): 150
CIP estacionamientos mín: 1.0
CIP dist. lateral mín (m): 4.0
CIP dist. fondo mín (m): 4.0
CIP antejardín mín (m): 5.0
Declarado constructibilidad: 0.78
Declarado ocupación suelo: 0.28
Declarado altura (m): 8.5
Declarado densidad (hab/há): 120
Declarado estacionamientos: 1.0
Declarado dist. lateral (m): 3.5
Declarado dist. fondo (m): 4.5
Declarado antejardín (m): 5.0
Superficie predio (m²): 800
Superficie edificada (m²): 624
N° unidades vivienda: 6
```

### Proyecto 4 — 2024-1105 Vitacura (Phase 4 demo)
```
Propietario: Sr. Andrés Kouyoumdjian
Dirección: Av. Vitacura 5800, Las Condes
Zona: E-Aa2
Tipo: ampliacion_residencial
RI: No
CIP N°: CIP-2024-1089
Fecha CIP: 2024-03-20
CIP constructibilidad máx: 1.5
CIP ocupación suelo máx: 0.45
CIP altura máx (m): 28.0
CIP densidad máx (hab/há): 300
CIP estacionamientos mín: 1.5
CIP dist. lateral mín (m): 7.0
CIP dist. fondo mín (m): 7.0
CIP antejardín mín (m): 6.0
Declarado constructibilidad: 1.82
Declarado ocupación suelo: 0.50
Declarado altura (m): 32.0
Declarado densidad (hab/há): 280
Declarado estacionamientos: 1.5
Declarado dist. lateral (m): 8.0
Declarado dist. fondo (m): 7.0
Declarado antejardín (m): 6.5
Superficie predio (m²): 2000
Superficie edificada (m²): 3640
N° unidades vivienda: 18
```

### Proyecto 5 — 2024-1187 Encomenderos (Round 2 demo — ingresar R1 primero)
```
Propietario: Constructora Sur S.A.
Dirección: Calle Encomenderos 350, Las Condes
Zona: E-Ab2
Tipo: obra_nueva_residencial
RI: No
CIP N°: CIP-2024-1142
Fecha CIP: 2024-05-01
CIP constructibilidad máx: 0.8
CIP ocupación suelo máx: 0.35
CIP altura máx (m): 12.0
CIP densidad máx (hab/há): 200
CIP estacionamientos mín: 1.0
CIP dist. lateral mín (m): 4.0
CIP dist. fondo mín (m): 4.0
CIP antejardín mín (m): 5.0
--- RONDA 1 ---
Declarado constructibilidad: 0.95
Declarado ocupación suelo: 0.42
Declarado altura (m): 11.5
Declarado densidad (hab/há): 160
Declarado estacionamientos: 1.0
Declarado dist. lateral (m): 3.0
Declarado dist. fondo (m): 4.5
Declarado antejardín (m): 4.0
Superficie predio (m²): 600
Superficie edificada (m²): 570
N° unidades vivienda: 4
--- RONDA 2 (correcciones) ---
Declarado constructibilidad: 0.78
Declarado ocupación suelo: 0.34
Declarado dist. lateral (m): 4.2
Declarado antejardín (m): 4.5   ← sigue bajo el mínimo de 5.0 (persiste)
Superficie edificada (m²): 468
```
