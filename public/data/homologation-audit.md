# AID-05 — Auditoría de homologación de ubicaciones

Generado automáticamente desde `public/images.json`. Revisión de especificidad, organización y duplicados de cada punto humanitario.

**Resumen:** 18 puntos · con dirección específica: 10 · solo ciudad: 7 · menos específicos (⚠️): 1

| | Tipo | Organización | Especificidad | Ubicación | Coords |
|---|---|---|---|---|---|
| ✓ | Acopio | Global Cargo | Calle/landmark | Global Cargo - San Diego 101, Santiago de Chile | -33.4489,-70.6693 |
| ✓ | Acopio | Austin Venezuelan Association | Ciudad | Cedar Park, Texas, Estados Unidos | 30.5052,-97.8203 |
| ✓ | Acopio | Austin Venezuelan Association | Calle/landmark | Fogonero Restaurante, 800 W Pecan St, Pflugerville, TX 78660 | 30.4394,-97.62 |
| ⚠️ | Acopio | (sin org) | País | Venezuela | 10.4806,-66.9036 |
| ✓ | Acopio | (sin org) | Calle/landmark | Punto de recolección: Redoma Gran Mariscal - CORINSA | 10.1875,-67.4608 |
| ✓ | Acopio | Enfermería Unida | Calle/landmark | Centro Comercial La Pirámide, Cagua | 10.1902,-67.4651 |
| ✓ | Acopio | Universidad de Los Andes | Calle/landmark | Universidad de Los Andes, núcleo Táchira | 7.7669,-72.225 |
| ✓ | Acopio | (sin org) | Ciudad | San Cristóbal, Táchira, Venezuela | 7.7745,-72.2189 |
| ✓ | Acopio | Coral del Táchira | Calle/landmark | Sede oficial de la Coral del Táchira, Urb. Las Acacias, carrera 4, al lado del Colegio José Félix Ribas | 7.772,-72.218 |
| ✓ | Acopio | Drovenplus Táchira C.A. | Ciudad | San Cristóbal, Táchira, Venezuela | 7.77,-72.23 |
| ✓ | Acopio | Línea Unión Rómulo Gallegos A.C. | Calle/landmark | Sede Línea Unión Rómulo Gallegos A.C., Calle 6 entre carreras 9 y 10, N° 6-5, Centro, San Cristóbal | 7.7656,-72.223 |
| ✓ | Acopio | Sofitasa | Calle/landmark | Todas las agencias de Sofitasa en el Táchira | 7.7689,-72.2256 |
| ✓ | Acopio | Rotary, Rotaract, Interact y Cruz Roja | Calle/landmark | Centro de acopio: Revista Rotaria, frente a la Cruz Roja | 7.746,-72.227 |
| ✓ | Acopio | Instituto Tecnológico Antonio José de Sucre | Calle/landmark | Instituto Tecnológico Antonio José de Sucre, Carrera 17 entre calles 9 y 10, N° 7-54, Edif. Doña María, Barrio Obrero, San Cristóbal | 7.7585,-72.231 |
| ✓ | Acopio | Estudiantes de la UNET | Ciudad | San Cristóbal, Táchira, Venezuela | 7.76,-72.221 |
| ✓ | Personal | Colegio de Psicólogos del Estado Anzoátegui | Ciudad | Barcelona, Anzoátegui, Venezuela | 10.134,-64.6836 |
| ✓ | Personal | Nova Clinic | Ciudad | Maracay, Aragua, Venezuela | 10.2469,-67.5958 |
| ✓ | Personal | OBE-UCV (Universidad Central de Venezuela) | Ciudad | Caracas, Distrito Capital, Venezuela | 10.4895,-66.8915 |

## Puntos menos específicos (a mejorar si aparece mejor fuente)

- **(sin org)** (cen-ven.webp): solo nivel País. Venezuela. Coordenada aproximada al centro del área.

## Agrupaciones por coordenada (mismo punto aproximado)

- `7.77,-72.22` (San Cristóbal y alrededores): cen-ula.webp, help-tac-2.png, help-tac-3.png, help-tac-sc.png — direcciones distintas, no son duplicados reales; coordenadas separadas levemente para evitar solapamiento en el mapa.
- `7.77,-72.23` (San Cristóbal y alrededores): help-tac-4.png, help-tac-sofitasa-sc.png — direcciones distintas, no son duplicados reales; coordenadas separadas levemente para evitar solapamiento en el mapa.

## Decisiones de normalización

- Organización añadida donde el actor era claro en la imagen: Global Cargo (cen-cle), Enfermería Unida (help-cga), Estudiantes de la UNET (help-tac).
- `cen-ula` corregido de Mérida → **Táchira** (la imagen dice "ULA Táchira").
- Listas compiladas (cen-ven, help-tac-2) no tienen una organización única: sus sub-puntos viven en `collectionPoints[]` y la fila usa el rótulo "Centro de acopio (sin organización)".
- Normalización de nombres: se ignoran acentos/mayúsculas al comparar; no se detectaron duplicados reales que fusionar.
