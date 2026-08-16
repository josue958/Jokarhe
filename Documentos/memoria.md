# Memoria y Reglas del Proyecto

- **Rol**: Eres un desarrollador experto en HTML, JavaScript, CSS, y en publicación de sitios mediante GitHub Pages.
- **Idioma**: Debes comunicarte siempre en español.
- **Tecnologías**: Nos debemos apegar estricta y únicamente a las tecnologías necesarias y soportadas por GitHub Pages, ya que es el entorno de publicación de este sitio (HTML, CSS y JS del lado del cliente, sin backend propio).
- **Calidad**: Todas las modificaciones deben seguir las mejores prácticas de desarrollo web, priorizando código limpio, modularidad y optimización.
- **Terminología**: Cuando el usuario se refiera al "archivo de Planeación", se refiere específicamente al archivo de Word (.docx) que se genera al exportar el PDA desde la sección Planeación Detallada de PDA.
- **Terminología**: Cuando el usuario se refiera a la "plantilla de dosificación", se refiere al archivo de Excel que se genera en la sección MIS PLANEACIONES al dar clic en el botón "📥 Descargar Plantilla".
- **Terminología**: Cuando el usuario se refiera al "excel docificacion tabla", se refiere al archivo de Excel que se genera al dar clic en el botón "Exportar a Excel" dentro de la pestaña "Planear".
- **Terminología**: Cuando el usuario se refiera a modifica el "cronograma", se refiere específicamente al archivo de Excel (`Cronograma_dosificacion_MATERIA_GRADO.xlsx`) que se genera en la pestaña TAB 4: CRONOGRAMA al dar clic en el botón "📊 Exportar Cronograma a Excel".

## Identidad Visual (Jokarhe Systems)
- **Tipografía**: **Calibri** en todas sus variantes (Calibri Bold como principal).
- **Paleta de Colores (Web/CSS)**:
  - `--primary`: `#0A203E` (Azul Marino Principal)
  - `--secondary`: `#1178C2` (Azul Medio)
  - `--accent`: `#208FF0` (Azul Brillante)
  - `--gold`: `#C9A63A` (Dorado)
  - `--white`: `#FFFFFF` (Blanco)
- **Aplicación UI**:
  - **Fondo principal**: `#FFFFFF`
  - **Texto principal**: `#0A203E`
  - **Botón primario**: `#1178C2` (hover: `#208FF0`)
  - **Botón secundario**: `#0A203E`
  - **Éxito (Success)**: `#28A745`
  - **Advertencia (Warning)**: `#C9A63A`
  - **Error (Danger)**: `#DC3545`
- **Gradiente (Flecha)**: Inicio en `#1178C2`, Centro `#208FF0`, Final `#52B4FF`.
- **Logotipos e Imagen Corporativa**: 
  - Los logotipos de la empresa se tomarán del directorio `Documentos/Logo` (ruta: `/Users/josue/Desktop/Sitios/54/Documentos/Logo`).
  - Cualquier detalle del diseño del logotipo o elementos de la imagen corporativa de la empresa que no se hayan indicado explícitamente en este documento, deberán basarse y tomarse como referencia del archivo `Documentos/Logo/Logo_empressa.png`.

## Desarrollo Local
- **Levantamiento del sitio**: Para visualizar el sitio y probar los cambios localmente, se debe levantar un servidor web estático local desde la raíz del proyecto (la carpeta principal del repositorio, no solo dentro de `dosifica/`).
- **TAREA AUTOMÁTICA**: Siempre que leas este documento de memoria, debes **asegurarte de que el servidor local esté corriendo correctamente en el puerto 8080**. Para ello:
  1. Verifica si ya hay un proceso usando el puerto 8080 (`lsof -ti:8080`).
  2. Si existe un proceso previo, detenlo forzosamente (`lsof -ti:8080 | xargs kill -9`) para evitar procesos colgados o errores de puerto en uso.
  3. Inicia un nuevo servidor ejecutando `python3 -m http.server 8080` en segundo plano desde el **directorio raíz del proyecto**.
  Esto es estrictamente necesario para evitar problemas de CORS y asegurar que tanto el archivo `index.html` de inicio como los proyectos internos (ej. `dosifica/`) funcionen correctamente de forma integrada.

## Contexto Técnico y Arquitectura de IA
- **Gestión de Estados**: La interfaz (`app.js`) utiliza funciones como `markAsUnsaved()` y `markAsSaved()` para gestionar visualmente si hay cambios no guardados en las tablas.
- **Flujo de Bloqueo de API (Rate Limits)**: Para evitar el error HTTP 429 de Gemini, cada petición a la IA activa un `setTimeout` de 30 segundos (UI amarillo) que desactiva todos los botones con la clase `.ai-btn` e inyecta la cuenta regresiva en el HTML (`#ai-countdown-banner`).
- **Persistencia Temporal (`localStorage`)**:
  - `jokarhe_bulk_profile`: Almacena el perfil estático (nombre de escuela, maestro) para el modal de Generación Masiva.
  - `planner_column_widths`: Guarda en caché las anchuras exactas redimensionadas manualmente por el usuario.
- **Protección de Datos (Casillas "Listo")**: Cada celda generada dinámicamente contiene un `input[type=checkbox]` debajo (`.skip-temas-cb`, `.skip-sesiones-cb`, etc.). Al procesar respuestas en masa (Bulk Generation o "Calcular Sesiones"), el sistema verifica si esta casilla está marcada. Si lo está, OMITE la fila para no sobrescribir el trabajo del usuario.
- **Ajuste Matemático y Reglas de Cálculo de Sesiones por IA (`calculateSessionsWithAI`)**:
  1. *Regla Inquebrantable de Mínimo 1 Sesión*: Ningún PDA activo puede quedar con 0 sesiones. El valor mínimo asignable es 1 sesión.
  2. *Recálculo Automático de Filas en Cero*: Si una fila tenía 0 sesiones o estaba marcada como 'Listo' pero vacía/cero, el sistema desmarca la casilla y la re-incluye automáticamente en la distribución para ser recalculada y ajustada según la complejidad y el verbo rector.
  3. *Balance Exacto*: El algoritmo iterativo distribuye o descuenta el remanente garantizando que la suma cuadre de forma exacta con `totalSessions` sin reducir nunca ningún PDA por debajo de 1.
- **Validación de API Key**: Ya no usamos `.includes()` para revisar la cadena de la API KEY, pues causaba colisiones. Solo se evalúa si está vacía o si es textualmente la de fábrica (`AQUI_VA_TU_CLAVE`).
- **Formato Institucional en Documentos Word (.docx)**:
  - *Nombre de Escuela*: En el encabezado del archivo de Word, si el campo está vacío o solo contiene el nombre/número (ej. `Ingeniero Bravo Ahuja`), se formatea automáticamente como `Escuela Secundaria Técnica No. "Ingeniero Bravo Ahuja"` o `Escuela Secundaria Técnica No. " "` si está en blanco.
  - *Ciclo Escolar*: Se previene cualquier duplicación accidental de prefijos (como `Ciclo Escolar Ciclo Escolar 2026-2027`), asegurando una única leyenda limpia: `Ciclo Escolar 2026-2027`.
- **Almacenamiento de Archivos Word (.docx) en Base de Datos**: La tabla `planeacion_pdas` incluye la columna `archivo_docx` (TEXT). Al presionar el botón "📄 Generar archivos" (`generateAllPdaDocFiles`), se genera el archivo `.docx` de cada PDA mediante `html-docx-js`, se codifica en Base64 y se guarda en la fila y en la base de datos SQLite.
- **Administrador CRUD de Leyendas del Cronograma (`crono_legends`)**: En TAB 3 (Ciclos Escolares) se incorporó un módulo CRUD completo respaldado por la tabla SQLite `crono_legends` (`id`, `name`, `icon`, `color`, `keywords`, `is_inhabile`, `display_order`). Permite crear leyendas personalizadas, editar existentes, eliminarlas o restaurar los valores de fábrica.
- **Matriz de Impacto Transversal de Leyendas**: Cualquier cambio en el CRUD de Leyendas impacta automáticamente en:
  1. *Formulario de Festivos (TAB 3)*: Chips de selección rápida (`#holiday-tag-chips`) y selector generados dinámicamente desde el catálogo activo.
  2. *Lista de Festivos (TAB 3)*: Badges visuales coloreados (`.holiday-legend-badge`) con icono y nombre exacto.
  3. *Cálculo de Días Hábiles y Sesiones (TAB 1 y TAB 3)*: La función `isDateInhabile()` evalúa el campo `is_inhabile` de la leyenda. Fechas con `is_inhabile = 0` (ej. Diagnóstico) se conservan como días hábiles lectivos para las sesiones del planificador, mientras que aquellas con `is_inhabile = 1` se excluyen de la dosificación.
  4. *Calendario Trimestral y Leyenda (TAB 4)*: La barra `.crono-legend` se dibuja dinámicamente leyendo `getCronoLegends()`. Los días de cada mes y las celdas de *Actividades y Seguimiento* se colorean con el fondo, borde, icono y texto de la leyenda correspondiente.
  5. *Exportación e Importación Excel de Festivos*: `exportHolidaysToExcel` exporta con diseño institucional las columnas `Inicio`, `Fin`, `Descripción / Motivo`, `Leyenda del Cronograma`, `Icono` y `¿Inhabilita Clases?`. `importHolidaysFromExcel` lee la columna de leyenda o clasifica el motivo contra las `keywords` del catálogo para mantener la asociación sin pérdida de información.
- **Pestaña '🗓️ Cronograma y Calendario Escolar'**: Muestra el resumen de periodos y horarios de la materia seleccionada, el calendario escolar interactivo trimestral con días festivos, CTE, evaluaciones y talleres docentes con normalización bidireccional de formatos de fecha (`DD-MM-YYYY` y `YYYY-MM-DD`). La **Leyenda del Cronograma** sincroniza visualmente cada categoría coloreando tanto los números de día como las celdas de actividades con sus respectivos iconos y fondos, y cuenta con acceso directo al planificador mediante el botón `⚡ Abrir en Planificador`.
- **Ordenación de Columnas en 'Mis Planeaciones'**: La tabla de planeaciones permite ordenar de forma ascendente (`▲`) y descendente (`▼`) por cualquiera de sus columnas (**Disciplina**, **Grado**, **Ciclo Escolar**, **Horario Semanal** y **Total PDAs**), con resaltado visual del encabezado activo e iconos interactivos.
- **Modal de Progreso de Generación Masiva (`bulk-progress-modal`)**: Al hacer clic en "🚀 Comenzar Generación Masiva", se presenta un modal visual con barra de progreso azul institucional (`#1178C2`), visualización del nombre del PDA en procesamiento y porcentaje numérico dinámico (`X / Y PDAs completados (Z%)`), cerrándose automáticamente al finalizar con una notificación de confirmación.
- **Exportación a Excel ("excel docificacion tabla") y Descarga de Plantilla**: Tanto la función `exportarCronograma` como `descargarPlantilla` construyen libros `.xlsx` 100% nativos mediante `ExcelJS` estructurados con la tipografía y paleta institucional (Calibri, Azul Marino `#0A203E` y Azul Medio `#1178C2`), anchos calculados y combinación limpia de celdas en la columna "Contenido". No utilizan tablas OpenXML conflictivas (`<table1.xml>`), garantizando apertura directa y sin advertencias en Microsoft Excel.
- **Pestaña '🤖 Configuración IA' y Prompts Dinámicos**: Pestaña dedicada con interfaz CRUD para personalizar las indicaciones que la IA utiliza en cada campo de la Planeación Detallada (Rol, Ejes, Campo, Sugerencia Eval, Proyecto, Producto, Problemática, Propósito, Sesiones 50min, Rúbrica, Teoría, Observaciones) y en cada botón del planificador (Temas, Verbo, Rango, Calcular Sesiones). Se guardan en `localStorage.jokarhe_ai_instructions` y no permiten campos vacíos. Incluye detector de cambios en tiempo real que cambia el botón de guardar a color ámbar (`.btn-save-dirty` con animación de pulso) indicando que hay modificaciones pendientes por guardar.
- **Transiciones de Pestañas Robustas (`switchTab`)**: Se implementó una función centralizada `switchTab(targetId)` que gestiona la visibilidad (`display: block / flex`), la activación visual del botón en el navbar y la ejecución segura de las funciones de renderizado, evitando pantallas en blanco al salir del planificador mediante el botón "← Volver".
- **Sincronización Modal Masivo ↔ Modal Individual PDA**: Toda la información institucional configurada en el Modal para Generación Masiva (Escuela, CCT, Campo Formativo, Profesor, Sugerencia de Evaluación, Observaciones, Firmas) se sincroniza y prellena automáticamente en el Modal para Planeación PDA de cada fila individual y persiste en la base de datos al guardar o generar.
- **Exportación Completa del Cronograma a Excel (`Cronograma_dosificacion_MATERIA_GRADO.xlsx`)**:
  - En TAB 4 (Cronograma) se implementó la función `exportCronogramaExcel()` vinculada al botón "📊 Exportar Cronograma a Excel".
  - Genera un libro Excel con 2 hojas:
    1. *`Cronograma Escolar`*: Réplica fiel y estructurada del calendario trimestral (Trimestres 1, 2 y 3) con los encabezados de mes, letras y números de día, fila de actividades/seguimiento con colores de leyendas, fila de sesiones de clase (`PDA X S1/Y`), bloques horizontales combinados de PDAs y sección inicial de leyendas con formato institucional.
    2. *`Dosificación de PDAs`*: Tabla completa de PDAs con contenidos, temas, número de sesiones, verbo rector, complejidad, rango sugerido y fechas de inicio/fin con combinación de celdas y estilos de cabecera.
  - Formato de nombre estandarizado: `Cronograma_dosificacion_{MATERIA}_{GRADO}.xlsx` (ej. `Cronograma_dosificacion_Matematicas_1.xlsx`).
- **Cálculo y Ajuste de Días Hábiles por Trimestres en Tiempo Real (`calculateCycleTrimestreDays`)**: Al agregar, editar, eliminar o importar días festivos/inhábiles en un ciclo escolar, el sistema recalcula en tiempo real los días hábiles lectivos correspondientes a cada periodo oficial (Trimestre 1: Ago-Nov, Trimestre 2: Dic-Mar, Trimestre 3: Abr-Fin) y los días totales del ciclo. Los campos del formulario (`cycle-total-days`, `cycle-p1-days`, `cycle-p2-days`, `cycle-p3-days`), la base de datos y la tabla de ciclos se actualizan de forma instantánea sin requerir recargar la página.
- **Corrección en Guardado de Ciclos Escolares (`loadCyclesDropdowns`)**: Se corrigió el error `TypeError: Cannot set properties of null (setting 'innerHTML')` que ocurría al guardar o actualizar un ciclo escolar debido a una referencia al antiguo elemento `#setup-cycle`. La función ahora valida de forma segura la existencia de cada selector (`#setup-cycle`, `#edit-plan-cycle` y `#crono-plan-select`) sincronizando todos los dropdowns sin interrupciones.
- **Asistente de Guardado de Archivos**: La exportación ZIP (`exportAllCompletedPdas`) usa la API nativa `window.showSaveFilePicker()` para desplegar la ventana de explorador ("Guardar como...") en el sistema operativo del usuario, con fallback a descarga tradicional en caso de incompatibilidad.

