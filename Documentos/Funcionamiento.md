# Funcionamiento del Planificador de PDAs

Este documento describe la lógica y funcionamiento de los botones de herramientas y de Inteligencia Artificial ubicados en la sección **Planear** de la aplicación (en la barra inferior de la tabla de PDAs). 

El flujo ideal diseñado para automatizar una planeación consiste en utilizar los botones de IA primero para analizar los datos, o directamente utilizar la **Generación Masiva** para procesar todo el bloque.

---

## 1. Herramientas de Inteligencia Artificial (Gemini)

Estos botones ejecutan un procesamiento consultando la API de Google Gemini. Para su correcto funcionamiento, requieren que el usuario haya ingresado una **API Key válida** en la pestaña de Configuración.
*   **Nota de Seguridad (Rate Limits):** Tras ejecutar cualquier petición a la IA, el sistema bloquea todos los botones de IA durante 30 segundos mostrando una cuenta regresiva amarilla en pantalla. Esto previene saturar la API y recibir errores "429 Too Many Requests".
*   **Casillas de Omitir:** Todos los campos generados por la IA cuentan con una casilla inferior que dice "Listo (Omitir)". Si el usuario marca esta casilla o si la IA rellena el campo, el sistema ignorará esa fila en futuras peticiones masivas, protegiendo el trabajo ya completado.

### 🤖 Temas a Atender
*   **Función Interna:** `generateTemasAI()`
*   **Comportamiento:** Lee el texto del PDA y la disciplina seleccionada. Considerando el contenido y la fase 6 del plan sintético, le solicita a la IA que deduzca qué temas en específico se deben cubrir en clase para alcanzar los objetivos de ese PDA.

### 🤖 Verbo Rector
*   **Función Interna:** `generateVerboAI()`
*   **Comportamiento:** Envía el texto del PDA a la IA para evaluarlo con la Taxonomía de Bloom. Identifica el verbo principal y determina su nivel de complejidad pedagógica.

### 🤖 Rango Sugerido
*   **Función Interna:** `generateRangoAI()`
*   **Comportamiento:** Estima cuántas sesiones de clase deberían invertirse en el PDA en formato de rango (ej. "8-10"), basándose en su complejidad.

### 🤖 Calcular Sesiones (Ahora con IA)
*   **Función Interna:** `calculatePdaSessions()`
*   **Comportamiento:** Ya no es un simple cálculo estático. Envía la tabla completa de PDAs activos a la IA junto con el número de sesiones faltantes del ciclo escolar. La IA decide el peso de cada PDA evaluando su Verbo Rector, Complejidad y Rango Sugerido.
*   **Ajuste Matemático Seguro:** Dado que la IA puede devolver sumatorias imperfectas, el sistema cuenta con un algoritmo cíclico posterior que absorbe cualquier diferencia. Si faltan horas, las suma al primer PDA; si sobran horas, va restando iterativamente 1 sesión a cada PDA (sin bajar de 0) hasta cuadrar exactamente al número total de sesiones del ciclo escolar de forma perfecta y balanceada.

---

## 2. Herramientas de Cálculo Matemático, Generación de Documentos y UI

Estos botones y elementos de interfaz realizan operaciones locales en el navegador sin requerir la API de IA.

*   **Pestañas de Navegación:**
    *   📚 **Mis Planeaciones:**
        *   **Tabla de Planeaciones:** Lista todas las planeaciones guardadas en SQLite, indicando disciplina, grado, ciclo escolar, horario semanal y total de PDAs.
        *   **Ordenación de Columnas:** Cada encabezado de columna (**Disciplina**, **Grado**, **Ciclo Escolar**, **Horario Semanal**, **Total PDAs**) es interactivo. Al dar clic, alterna entre orden ascendente (`▲`) y descendente (`▼`), destacando la columna activa con color y estilo visual.
        *   **Acciones:** Permite abrir el planificador (`⚡ Planear`), importar archivos Excel (`📤`), editar parámetros y horarios (`✏️`) o eliminar la planeación (`🗑️`).
        *   **Descarga de Plantilla:** Botón "📥 Descargar Plantilla" que genera un archivo `.xlsx` limpio y compatible en memoria con `ExcelJS`.
    *   📅 **Ciclos Escolares y Gestión de Leyendas del Cronograma:**
        *   **Gestión de Ciclos:** Permite registrar los ciclos escolares, rangos de fechas de inicio y fin, días hábiles totales y días por trimestre (Trimestre 1, 2 y 3).
        *   **🏷️ Administrador CRUD de Leyendas del Cronograma:** Módulo dedicado para crear, editar, eliminar y restaurar las categorías oficiales y personalizadas de eventos y días inhábiles (`crono_legends`). Cada leyenda cuenta con:
            *   *Nombre y Slug ID* (ej. `inhabiles`, `cte`, `calificaciones`, `diagnostico`, `taller`).
            *   *Icono / Emoji* (🔴, 🟡, 🟢, 🔵, 🟦, 🟣, 🟠, ⭐, 📌, 📚, 🎓).
            *   *Color Primario* con autogeneración de fondo y bordes translúcidos.
            *   *Palabras clave de auto-detección* (para importación y prellenado inteligente).
            *   *Interruptor "¿Inhabilita sesiones escolares?"* (Determina si la fecha resta días hábiles lectivos en el calendario matemático de dosificación).
        *   **Gestión de Días Inhábiles y Festivos:** Asignación individual o por rangos de fechas a cada ciclo escolar, con botones chips generados dinámicamente desde el catálogo CRUD de leyendas, prellenado automático y badges de colores en la lista de festivos.
        *   **📥 Exportación e 📤 Importación Excel de Días Inhábiles:**
            *   *Exportación:* Genera un archivo `.xlsx` estructurado que incluye las columnas `Inicio`, `Fin`, `Descripción / Motivo`, `Leyenda del Cronograma`, `Icono` y `¿Inhabilita Clases?`.
            *   *Importación:* Lee las fechas y descripciones, identifica la columna de leyenda o clasifica automáticamente el motivo según las palabras clave configuradas en el CRUD, persistiendo la categorización exacta.
    *   🗓️ **Cronograma y Calendario Escolar:** Permite consultar el calendario escolar interactivo trimestral sincronizado en tiempo real con el catálogo CRUD de Leyendas. Muestra la barra de leyendas con sus colores e iconos, resalta los encabezados de mes y número de día con el color de su leyenda asignada, y despliega en la fila de *Actividades y Seguimiento* las celdas expandidas con su estilo, icono y descripción.
    *   🤖 **Configuración IA:** Pestaña dedicada para personalizar y gestionar todas las instrucciones y prompts que utiliza la IA para cada campo de la Planeación Detallada y cada botón del Planificador. Cuenta con detección automática de cambios en tiempo real que alerta al usuario cambiando el botón de guardar a color ámbar vibrante (`⚠️ 💾 Guardar Cambios Detectados`) y restableciendo su color normal al guardar o restaurar.
    *   💾 **Respaldo:** Permite descargar e importar la base de datos `.sqlite` y gestionar el catálogo de disciplinas.

### 🚀 Generación Masiva
*   **Función Interna:** `openBulkPdaModal()`, `saveBulkProfile()` y `callGeminiForPda()`
*   **Comportamiento:** Permite configurar datos fijos para toda la escuela (Nombre de Escuela, C.C.T., Campo Formativo, Profesor, Sugerencia de Evaluación, Observaciones, Firmas).
*   **Sincronización Total:** Los datos guardados con el botón "💾 Guardar Datos" se almacenan como perfil predeterminado y se reflejan de inmediato en el **Modal para Planeación PDA**, prellenando automáticamente los campos generales de cada fila tanto en la vista individual como en la generación masiva.
*   **Modal de Progreso Dinámico (`bulk-progress-modal`):** Al presionar "🚀 Comenzar Generación Masiva", se despliega un modal superpuesto con barra de progreso animada en color corporativo, título del PDA en procesamiento activo y contador en tiempo real (`X / Y PDAs completados (Z%)`) que informa al usuario paso a paso del avance hasta concluir.

*   **Modal de Perfil:** Permite ingresar datos estáticos (Escuela, CCT, Profesor, Firmas).
*   **Persistencia:** Cuenta con botones de "🧹 Limpiar" y "💾 Guardar Datos". Al guardar, los datos se escriben en `localStorage` (`jokarhe_bulk_profile`) para autocompletarse la próxima vez que se abra.
*   **Bucle de Generación:** Al presionar "Comenzar Generación Masiva", el sistema recorre cada PDA que no tenga su casilla de omitir marcada. Ejecuta la creación del JSON de planeación didáctica llamando a la API, espera de forma obligatoria para no saturar los límites de Gemini, y al finalizar activa el botón de exportación ZIP general.

### 🔙 Botón "← Volver" del Planificador
*   **Función Interna:** `switchTab('tab-planeaciones')`
*   **Comportamiento:** Restablece de forma segura el layout de la ventana (remueve clases del planificador y limpia `activePlaneacionId`), activa la pestaña `📚 Planeaciones` en la barra superior y renderiza de inmediato el listado de planeaciones (`renderPlaneacionesList`) garantizando que la vista `Mis Planeaciones` siempre se muestre completa y visible.

### ⚙️ Columna de Acción (Organización y Borrado Individual)
La columna de Acción está organizada en dos módulos visuales compactos para facilitar su uso sin ocupar espacio excesivo:
1. **Módulo de Planeación IA:**
   - Botón `[ 📝 PDA / ✅ PDA ]`: Abre el modal para editar o ver los detalles pedagógicos.
   - Botón `[ 🗑️ Plan ]`: Borra exclusivamente los datos de la planeación didáctica generados con IA de ese PDA específico.
   - Casilla `Listo (Omitir)`: Marca el PDA para no ser sobrescrito en ejecuciones masivas de IA.
2. **Módulo de Archivo Word (.docx):**
   - Casilla `Archivo Word`: Indica visualmente si el archivo ya fue generado y almacenado en la base de datos.
   - Botón `[ 📥 Descargar ]`: Permite descargar el documento Word individualmente.
   - Botón `[ 🗑️ Doc ]`: Borra exclusivamente el archivo Word almacenado de ese PDA específico.
3. **Botón `[ 🗑️ Eliminar fila ]`:** Elimina la fila completa del planificador.

### 🗂️ Exportar PDAs (ZIP)
*   **Función Interna:** `exportAllCompletedPdas()`
*   **Comportamiento:** Recolecta todos los archivos Word (.docx) generados (leyéndolos directamente de la base de datos o generándolos al vuelo si están completos). Los comprime en un archivo `.zip` y abre el **asistente de explorador de archivos nativo ("Guardar como...")** para que el usuario elija exactamente la carpeta y nombre donde desea guardarlo. Incluye barra de progreso durante la compresión.

### 🗑️ Limpieza Rápida de Columnas
*   **Comportamiento:** Cada título de columna en la tabla posee un pequeño icono de papelera. Al presionarlo (y confirmar), el sistema limpia todo el texto de esa columna en todas las filas y desmarca simultáneamente las casillas "Listo (Omitir)", reiniciando el estado de la columna de manera instantánea.

### 📐 Columnas Redimensionables y Cabecera Fija
*   **Comportamiento:** Las líneas divisorias en los títulos de las columnas se pueden arrastrar con el mouse para ajustar su ancho personalizado. Este ancho se guarda en la caché (`planner_column_widths`) al presionar "Guardar Cambios". Además, la fila de los encabezados es un "Sticky Header", manteniéndose fija en la parte superior al desplazarse hacia abajo en la tabla de dosificación.

---

## 3. Matriz de Impacto Transversal: Modificaciones en Leyendas del Cronograma

Cualquier cambio, adición o eliminación en el **CRUD de Leyendas del Cronograma** (TAB 3: Ciclos Escolares) impacta de manera integral en los siguientes módulos del sistema:

| Módulo / Sección | Impacto Directo y Comportamiento |
| :--- | :--- |
| **TAB 3: Ciclos Escolares (Chips de Festivos)** | Actualiza al instante los botones chips (`#holiday-tag-chips`) y el selector oculto del formulario de festivos, reflejando nuevos nombres, iconos y colores. |
| **TAB 3: Ciclos Escolares (Lista de Festivos)** | Los badges de las fechas registradas (`.holiday-legend-badge`) se re-renderizan con el color, borde, icono y nombre de la leyenda configurada. |
| **TAB 3: Ciclos Escolares (Días Hábiles del Ciclo)** | Si una leyenda se marca como `¿Inhabilita sesiones escolares? = No` (ej. Diagnóstico), los días asignados a esa categoría se computan como días lectivos hábiles y no reducen el total de días del ciclo escolar. |
| **TAB 4: Cronograma (Barra de Leyendas)** | La barra horizontal `.crono-legend` se construye dinámicamente listando todas las leyendas activas con sus muestras de color e iconos. |
| **TAB 4: Cronograma (Calendario Trimestral)** | Los números y letras de los días de cada mes adoptan el color de encabezado de la leyenda asignada. La fila *Actividades y Seguimiento* formatea las celdas con el icono, texto y colores exactos. |
| **TAB 1: Planear (Cálculo de Fechas de PDAs)** | El motor `calculateSchoolDays()` y `calculateDaysInRange()` consulta la bandera `is_inhabile` de la leyenda para determinar si debe saltar la fecha al distribuir las sesiones en el calendario. |
| **TAB 2: Mis Planeaciones (Días y Horarios)** | Mantiene coherencia absoluta con los días hábiles del ciclo seleccionado y el número total de sesiones calculadas. |
| **Exportación a Excel de Festivos** | El archivo `.xlsx` exportado incluye columnas explícitas para la Leyenda, Icono y estado de inhabilitación de clases. |
| **Importación desde Excel de Festivos** | El parser lee la columna de Leyenda o clasifica el motivo contra las palabras clave (`keywords`) del catálogo de leyendas para asignar la categoría correcta sin perder datos. |

