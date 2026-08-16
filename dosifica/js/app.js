'use strict';

/**
 * js/app.js — Lógica de la aplicación Single Page Application (SPA)
 */

let activePlaneacionId = null;

// Función global para marcar botones con advertencia de cambios sin guardar
window.markAsUnsaved = function(btnId) {
    const btn = document.getElementById(btnId);
    if (btn && !btn.classList.contains('btn-warning')) {
        btn.classList.remove('btn-primary', 'btn-secondary');
        btn.classList.add('btn-warning');
        btn.style.backgroundColor = '#ff9800'; 
        btn.style.borderColor = '#ff9800';
        btn.style.color = '#fff';
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.innerText;
        }
        if (!btn.innerText.includes('⚠️')) {
            btn.innerText = "⚠️ " + btn.innerText;
        }
    }
};

window.markAsSaved = function(btnId) {
    const btn = document.getElementById(btnId);
    if (btn && btn.classList.contains('btn-warning')) {
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary'); // Asumiendo que el botón original era primary
        btn.style.backgroundColor = ''; 
        btn.style.borderColor = '';
        btn.style.color = '';
        if (btn.dataset.originalText) {
            btn.innerText = btn.dataset.originalText;
        } else {
            btn.innerText = btn.innerText.replace('⚠️ ', '');
        }
    }
};
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar la Base de Datos SQLite WASM
    try {
        await initDB();
        showToast('Base de datos inicializada.', 'success');
    } catch (e) {
        console.error("Error inicializando DB:", e);
        showToast('Error al inicializar base de datos: ' + e.message, 'error');
    }

    // 2. Configurar Tab Switcher
    initTabSwitcher();

    // 3. Inicializar Componentes de los Formularios
    initSetupForm();
    initCycleForm();
    initPlanCRUD();
    initBackupPanel();
    initSettingsPanel(); // Inicializar configuraciones de Disciplinas y Prompt IA
    initCronoLegendsHandlers(); // Inicializar CRUD de Leyendas del Cronograma

    // Cargar listas iniciales
    loadCyclesDropdowns();
    renderCyclesList();
    renderCronoLegendsList();
    updateHolidayTagChips();
    renderPlaneacionesList();
});

/* =========================================================
   SISTEMA DE TOASTS
   ========================================================= */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* =========================================================
   TAB SWITCHER & GESTIÓN DE VISTAS
   ========================================================= */
function switchTab(target) {
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    const sections = document.querySelectorAll('.tab-section');

    // 1. Quitar activo de todos los botones y ocultar todas las secciones
    tabBtns.forEach(b => b.classList.remove('active'));
    sections.forEach(s => s.style.display = 'none');

    // 2. Activar el botón correspondiente
    const activeBtn = document.querySelector(`.nav-tab-btn[data-target="${target}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // 3. Mostrar la sección destino
    const targetSection = document.getElementById(target);
    if (targetSection) {
        if (target === 'tab-dosificar' && activePlaneacionId) {
            targetSection.style.display = 'flex';
        } else {
            targetSection.style.display = 'block';
        }
    }

    // 4. Control del layout del planificador y background
    if (target !== 'tab-dosificar') {
        setPlannerLayoutActive(false);
        document.body.classList.remove('bg-grid-pattern');
    } else if (!activePlaneacionId) {
        document.body.classList.add('bg-grid-pattern');
    } else {
        document.body.classList.remove('bg-grid-pattern');
    }

    // 5. Refrescar contenido de la pestaña con protección contra errores
    try {
        if (target === 'tab-planeaciones') {
            renderPlaneacionesList();
        } else if (target === 'tab-ciclos') {
            renderCyclesList();
        } else if (target === 'tab-cronograma') {
            if (typeof populateCronoPlanSelect === 'function') populateCronoPlanSelect();
            if (typeof renderCronogramaEscolar === 'function') renderCronogramaEscolar();
        } else if (target === 'tab-ia') {
            renderAIPanel();
        }
    } catch (e) {
        console.error("Error refreshing tab content:", e);
    }
}

function initTabSwitcher() {
    const tabBtns = document.querySelectorAll('.nav-tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            switchTab(target);
        });
    });

    // Inicializar mostrando la pestaña de Planeaciones por defecto
    switchTab('tab-planeaciones');

    window.addEventListener('resize', () => {
        if (activePlaneacionId) fitCompactColumns();
    });
}

/* =========================================================
   PLANIFICADOR: SETUP DE NUEVA PLANEACION
   ========================================================= */
function initSetupForm() {
    const weeklyInput = document.getElementById('setup-weekly-hours');
    const dayInputs = document.querySelectorAll('#setup-plan-form .day-input');
    const errorMsg = document.getElementById('setup-schedule-error');
    const submitBtn = document.getElementById('setup-submit-btn');
    const setupForm = document.getElementById('setup-plan-form');
    if (setupForm) {
        setupForm.addEventListener('input', () => markAsUnsaved('setup-submit-btn'));
    }

    function validateHours() {
        let sum = 0;
        dayInputs.forEach(input => {
            sum += parseInt(input.value) || 0;
        });
        const weekly = parseInt(weeklyInput.value) || 0;

        if (sum !== weekly) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = `⚠️ La suma de las horas del horario semanal (${sum} hs) debe ser exactamente igual a las horas semanales (${weekly} hs).`;
            submitBtn.disabled = true;
        } else {
            errorMsg.style.display = 'none';
            submitBtn.disabled = false;
        }
    }

    if (weeklyInput && dayInputs.length) {
        dayInputs.forEach(input => input.addEventListener('input', validateHours));
        weeklyInput.addEventListener('input', validateHours);
        validateHours();
    }

    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const cycleId = parseInt(document.getElementById('setup-cycle').value);
            const disciplina = document.getElementById('setup-discipline').value;
            const grado = parseInt(document.getElementById('setup-grade').value);
            const weeklyHours = parseInt(weeklyInput.value);

            // Crear JSON del horario
            const schedule = {};
            for (let d = 1; d <= 5; d++) {
                schedule[d] = parseInt(document.getElementById(`setup-day-${d}`).value) || 0;
            }

            try {
                // 1. Obtener PDAs de la biblioteca pre-cargada
                const libPdas = NEM_PHASE6_LIBRARY[disciplina]?.[grado] || [];
                const totalPdas = libPdas.length || 1;

                // 2. Insertar planeación principal
                const pid = await dbRun(
                    `INSERT INTO planeaciones(cycle_id, disciplina, grado, weekly_hours, schedule, total_pdas) VALUES(?,?,?,?,?,?)`,
                    [cycleId, disciplina, grado, weeklyHours, JSON.stringify(schedule), totalPdas]
                );

                // 3. Calcular sesiones estimadas por PDA
                const cycles = dbQuery("SELECT * FROM school_cycles WHERE id = ?", [cycleId]);
                const cycle = cycles[0];
                const holidays = JSON.parse(cycle.holidays || '{}');

                // Calcular sesiones
                const schoolDays = calculateSchoolDays(cycle.start_date, cycle.total_days, holidays);
                const sessions = mapSessions(schoolDays, schedule, cycle.period1_days, cycle.period2_days);
                const totalSessions = sessions.length;

                const baseSessions = Math.floor(totalSessions / totalPdas);
                const remainder = totalSessions % totalPdas;

                // 4. Insertar PDAs iniciales
                if (libPdas.length > 0) {
                    for (let i = 0; i < libPdas.length; i++) {
                        const text = libPdas[i];
                        const isObj = (typeof text === 'object' && text !== null);
                        const pdaTopic = isObj ? text.topic : text;
                        const pdaNum = isObj ? (text.pda_number || (i + 1)) : (i + 1);
                        const verb = isObj ? (text.verbo_rector || getRectorVerb(pdaTopic)) : getRectorVerb(pdaTopic);
                        const sCount = isObj ? (text.sessions_count || (baseSessions + (pdaNum <= remainder ? 1 : 0))) : (baseSessions + (pdaNum <= remainder ? 1 : 0));
                        const pdaContenido = isObj ? (text.contenido || '') : '';
                        const pdaTemas = isObj ? (text.temas || '') : '';
                        const pdaComplejidad = isObj ? (text.complejidad || 'Media') : 'Media';
                        const pdaRango = isObj ? (text.rango_sugerido || '') : '';

                        await dbRun(
                            `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count, contenido, temas, complejidad, rango_sugerido) VALUES(?,?,?,?,?,?,?,?,?)`,
                            [pid, pdaNum, pdaTopic, verb, sCount, pdaContenido, pdaTemas, pdaComplejidad, pdaRango]
                        );
                    }
                } else {
                    // PDA en blanco por si no hay biblioteca
                    await dbRun(
                        `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count, contenido, temas, complejidad, rango_sugerido) VALUES(?,?,?,?,?,?,?,?,?)`,
                        [pid, 1, 'Proceso de Desarrollo de Aprendizaje (PDA) 1', 'Desarrolla', totalSessions, '', '', 'Media', '']
                    );
                }

                showToast('Planeación creada correctamente.', 'success');
                loadPlanification(pid);
                document.getElementById('setup-discipline').value = '';
            } catch (err) {
                console.error(err);
                showToast('Error al crear planeación: ' + err.message, 'error');
            }
        });
    } // Cierra if(setupForm)
}

/* =========================================================
   CARGA Y EDICION DEL PLANIFICADOR DE PDAS (DETALLADO)
   ========================================================= */
async function loadPlanification(planeacionId) {
    activePlaneacionId = planeacionId;
    document.body.classList.remove('bg-grid-pattern');

    // Cargar datos
    const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [planeacionId]);
    if (!plans.length) {
        showToast('Planeación no encontrada.', 'error');
        return;
    }
    const planeacion = plans[0];
    const cycle = dbQuery("SELECT * FROM school_cycles WHERE id = ?", [planeacion.cycle_id])[0];
    const pdas = dbQuery("SELECT * FROM planeacion_pdas WHERE planeacion_id = ? ORDER BY pda_number ASC", [planeacionId]);

    // Ocultar Setup, Mostrar Planner
    const dosificarSetup = document.getElementById('dosificar-setup');
    if (dosificarSetup) dosificarSetup.style.display = 'none';
    setPlannerLayoutActive(true);

    // Rellenar cabecera y resúmenes
    document.getElementById('planner-subject-title').innerText = `Dosificación: ${planeacion.disciplina} — ${planeacion.grado}º Grado`;
    document.getElementById('summary-cycle-name').innerText = cycle.name;
    document.getElementById('summary-weekly-hours').innerText = `${planeacion.weekly_hours} hs/semana`;

    // Calcular sesiones del ciclo
    const holidays = JSON.parse(cycle.holidays || '{}');
    const schoolDays = calculateSchoolDays(cycle.start_date, cycle.total_days, holidays);
    const schedule = JSON.parse(planeacion.schedule || '{}');
    const sessions = mapSessions(schoolDays, schedule, cycle.period1_days, cycle.period2_days);
    const totalSessions = sessions.length;
    document.getElementById('summary-total-sessions').innerText = totalSessions;

    // Renderizar filas de la tabla
    renderPdaRows(pdas, totalSessions);

    // Configurar listeners del planificador
    const saveBtn = document.getElementById('planner-btn-save');
    const exportBtn = document.getElementById('planner-btn-export');
    const backBtn = document.getElementById('planner-btn-back');
    const addPdaBtn = document.getElementById('planner-btn-add-pda');

    // Limpiar listeners antiguos clonando botones
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    const newExportBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    const newAddPdaBtn = addPdaBtn.cloneNode(true);
    addPdaBtn.parentNode.replaceChild(newAddPdaBtn, addPdaBtn);

    newSaveBtn.addEventListener('click', () => savePdaPlannerChanges(planeacionId, totalSessions));
    newExportBtn.addEventListener('click', () => ExcelExport.exportarCronograma(planeacion.cycle_id, planeacionId));
    newBackBtn.addEventListener('click', () => {
        activePlaneacionId = null;
        switchTab('tab-planeaciones');
    });
    newAddPdaBtn.addEventListener('click', () => addNewPdaRow(planeacionId));
}

function setPlannerLayoutActive(active) {
    document.getElementById('tab-dosificar').classList.toggle('planner-active', active);
    document.querySelector('.main-container').classList.toggle('planner-active', active);
    document.body.classList.toggle('planner-active', active);

    const planner = document.getElementById('dosificar-planner');
    if (planner) planner.style.display = active ? 'flex' : 'none';

    if (active) requestAnimationFrame(fitCompactColumns);
}

const _measureCanvas = document.createElement('canvas');
const _measureCtx = _measureCanvas.getContext('2d');

function measureTextPx(text, referenceEl) {
    const style = window.getComputedStyle(referenceEl);
    _measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return _measureCtx.measureText(text || '').width;
}

let isTableManuallyResized = false;

function fitCompactColumns() {
    if (isTableManuallyResized) return;
    const table = document.getElementById('planner-table');
    if (!table) return;

    const setColWidth = (colClass, inputSelector, headerText, minPx = 56) => {
        const col = table.querySelector(`col.${colClass}`);
        const th = table.querySelector(`th.${colClass}`);
        if (!col || !th) return;

        let maxW = measureTextPx(headerText, th) + 28;

        if (inputSelector) {
            table.querySelectorAll(inputSelector).forEach(input => {
                const text = input.value || input.placeholder || '';
                maxW = Math.max(maxW, measureTextPx(text, input) + 28);
            });
        }

        const width = Math.ceil(Math.max(maxW, minPx));
        col.style.width = `${width}px`;
        th.style.width = `${width}px`;
    };

    setColWidth('col-no', null, 'No.', 44);
    setColWidth('col-sesiones', '.pda-sessions', 'Sesiones', 76);
    setColWidth('col-verbo-rector', '.pda-verb', 'Verbo Rector', 96);
    setColWidth('col-complejidad', '.pda-complejidad', 'Complejidad', 96);
    setColWidth('col-accion', null, 'Acción', 72);
}

function bindCompactColumnInput(input) {
    input.addEventListener('input', () => fitCompactColumns());
}

function renderPdaRows(pdas, totalSessions) {
    const tbody = document.getElementById('planner-tbody');
    tbody.innerHTML = '';

    // Load column widths if any
    try {
        const savedWidths = JSON.parse(localStorage.getItem('planner_column_widths') || 'null');
        if (savedWidths && savedWidths.length > 0) {
            isTableManuallyResized = true;
            const table = document.getElementById('planner-table');
            if (table) {
                const colgroup = table.querySelector('colgroup');
                const ths = table.querySelectorAll('thead th');
                if (colgroup) {
                    const cols = colgroup.querySelectorAll('col');
                    cols.forEach((col, index) => {
                        if (savedWidths[index]) {
                            col.style.width = savedWidths[index];
                            if (ths[index]) ths[index].style.width = savedWidths[index];
                        }
                    });
                }
            }
        }
    } catch (e) { }

    initTableResizers();

    pdas.forEach((pda, index) => {
        let hasData = false;
        try {
            const parsed = JSON.parse(pda.detalles_planeacion || '{}');
            hasData = Object.keys(parsed).length > 0;
        } catch (e) {}
        
        const hasDocx = !!(pda.archivo_docx && pda.archivo_docx.trim() !== '');
        const btnClass = hasData ? 'btn-success' : 'btn-secondary';
        const btnText = hasData ? '✅ PDA' : '📝 PDA';

        const tr = document.createElement('tr');
        tr.setAttribute('data-pda-number', pda.pda_number);
        tr.innerHTML = `
            <td class="col-contenido">
                <textarea class="form-control pda-field pda-contenido" placeholder="Contenido" rows="2">${htmlspecialchars(pda.contenido || '')}</textarea>
            </td>
            <td class="col-no">${pda.pda_number}</td>
            <td class="col-pda">
                <textarea class="form-control pda-field pda-topic" placeholder="Proceso de Desarrollo de Aprendizaje (PDA)" rows="2">${htmlspecialchars(pda.topic)}</textarea>
            </td>
            <td class="col-temas">
                <textarea class="form-control pda-field pda-temas" placeholder="Temas a Atender" rows="2">${htmlspecialchars(pda.temas || '')}</textarea>
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                    <input type="checkbox" class="skip-temas-cb" ${pda.temas && pda.temas.trim() !== '' ? 'checked' : ''}> Listo (Omitir en IA)
                </label>
            </td>
            <td class="col-sesiones">
                <input type="number" class="form-control pda-field pda-sessions" value="${pda.sessions_count}" min="0" max="${totalSessions}">
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                    <input type="checkbox" class="skip-sesiones-cb" ${pda.sessions_count > 0 ? 'checked' : ''}> Listo (Omitir)
                </label>
            </td>
            <td class="col-verbo-rector">
                <input type="text" class="form-control pda-field pda-verb" value="${htmlspecialchars(pda.verbo_rector)}" placeholder="Verbo">
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                    <input type="checkbox" class="skip-verbo-cb" ${pda.verbo_rector ? 'checked' : ''}> Listo (Omitir)
                </label>
            </td>
            <td class="col-complejidad">
                <input type="text" class="form-control pda-field pda-complejidad" value="${htmlspecialchars(pda.complejidad || '')}" placeholder="Complejidad">
            </td>
            <td class="col-rango">
                <input type="text" class="form-control pda-field pda-rango" value="${htmlspecialchars(pda.rango_sugerido || '')}" placeholder="Ej. 8 a 10 sesiones">
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                    <input type="checkbox" class="skip-rango-cb" ${pda.rango_sugerido ? 'checked' : ''}> Listo (Omitir)
                </label>
            </td>
            <td class="col-fecha">
                <input type="date" class="form-control pda-field pda-start-date" value="${pda.start_date || ''}">
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                    <input type="checkbox" class="skip-fechas-cb" ${pda.start_date ? 'checked' : ''}> Listo (Omitir)
                </label>
            </td>
            <td class="col-fecha">
                <input type="date" class="form-control pda-field pda-end-date" value="${pda.end_date || ''}">
            </td>
            <td class="col-accion" style="min-width: 140px; padding: 6px 8px; vertical-align: top;">
                <input type="hidden" class="pda-detalles-input" value="${htmlspecialchars(pda.detalles_planeacion || '{}')}">
                <input type="hidden" class="pda-docx-input" value="${htmlspecialchars(pda.archivo_docx || '')}">

                <!-- 1. Planeación IA -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; margin-bottom: 5px;">
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <button type="button" class="btn btn-sm ${hasData ? 'btn-success' : 'btn-secondary'} pda-detail-btn" style="flex: 1; padding: 3px 4px; font-size: 11px;">
                            ${hasData ? '✅ PDA' : '📝 PDA'}
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm pda-clear-plan-btn" style="padding: 3px 5px; font-size: 11px;" title="Borrar información generada con IA de este PDA" ${hasData ? '' : 'disabled'}>
                            🗑️ Plan
                        </button>
                    </div>
                    <label style="font-size: 10px; display: flex; align-items: center; gap: 4px; margin-top: 3px; cursor: pointer; color: #64748b;">
                        <input type="checkbox" class="skip-planeacion-cb" ${hasData ? 'checked' : ''}> Listo (Omitir)
                    </label>
                </div>

                <!-- 2. Archivo Word (.docx) -->
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 4px 6px; margin-bottom: 5px;">
                    <label style="font-size: 10px; display: flex; align-items: center; gap: 4px; color: #0369a1; font-weight: 600; margin-bottom: 3px;">
                        <input type="checkbox" class="has-docx-cb" ${hasDocx ? 'checked' : ''} onclick="return false;"> Archivo Word
                    </label>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <button type="button" class="btn btn-primary btn-sm pda-download-btn" style="flex: 1; padding: 3px 4px; font-size: 11px; ${hasDocx ? '' : 'opacity: 0.4; pointer-events: none;'}" onclick="downloadIndividualPdaDoc(this)">
                            📥 Descargar
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm pda-clear-docx-btn" style="padding: 3px 5px; font-size: 11px;" title="Borrar archivo Word guardado en este PDA" ${hasDocx ? '' : 'disabled'}>
                            🗑️ Doc
                        </button>
                    </div>
                </div>

                <!-- 3. Eliminar Fila Completa -->
                <button type="button" class="btn btn-danger btn-sm pda-delete-btn" style="width: 100%; padding: 2px 4px; font-size: 10px;" title="Eliminar fila completa de la tabla">
                    🗑️ Eliminar fila
                </button>
            </td>
        `;

        // Extraer automáticamente el verbo rector al editar el PDA
        const topicTextarea = tr.querySelector('.pda-topic');
        const verbInput = tr.querySelector('.pda-verb');
        topicTextarea.addEventListener('input', () => {
            verbInput.value = getRectorVerb(topicTextarea.value);
            fitCompactColumns();
            markAsUnsaved('planner-btn-save');
        });

        bindCompactColumnInput(verbInput);
        bindCompactColumnInput(tr.querySelector('.pda-complejidad'));

        bindPdaRowActionEvents(tr, totalSessions);

        // Al cambiar sesiones, actualizar balance
        tr.querySelector('.pda-sessions').addEventListener('input', () => updateSessionsBalance(totalSessions));

        tbody.appendChild(tr);
    });

    fitCompactColumns();
    updateSessionsBalance(totalSessions);
}

function bindPdaRowActionEvents(tr, totalSessions) {
    const detailBtn = tr.querySelector('.pda-detail-btn');
    const clearPlanBtn = tr.querySelector('.pda-clear-plan-btn');
    const clearDocxBtn = tr.querySelector('.pda-clear-docx-btn');
    const deleteBtn = tr.querySelector('.pda-delete-btn');

    if (detailBtn) {
        detailBtn.addEventListener('click', () => openPdaDetailModal(tr));
    }

    if (clearPlanBtn) {
        clearPlanBtn.addEventListener('click', () => {
            if (!confirm('¿Deseas borrar la información generada con IA de este PDA?')) return;
            const input = tr.querySelector('.pda-detalles-input');
            const skipCb = tr.querySelector('.skip-planeacion-cb');
            if (input) input.value = '{}';
            if (skipCb) skipCb.checked = false;
            if (detailBtn) {
                detailBtn.className = 'btn btn-secondary btn-sm pda-detail-btn';
                detailBtn.innerText = '📝 PDA';
            }
            clearPlanBtn.disabled = true;
            markAsUnsaved('planner-btn-save');
            showToast('Información de planeación IA borrada.', 'info');
        });
    }

    if (clearDocxBtn) {
        clearDocxBtn.addEventListener('click', () => {
            if (!confirm('¿Deseas borrar el archivo Word generado de este PDA?')) return;
            const docxInput = tr.querySelector('.pda-docx-input');
            const docxCb = tr.querySelector('.has-docx-cb');
            const downloadBtn = tr.querySelector('.pda-download-btn');
            if (docxInput) docxInput.value = '';
            if (docxCb) docxCb.checked = false;
            if (downloadBtn) {
                downloadBtn.style.opacity = '0.4';
                downloadBtn.style.pointerEvents = 'none';
            }
            clearDocxBtn.disabled = true;
            markAsUnsaved('planner-btn-save');
            showToast('Archivo Word borrado de este PDA.', 'info');
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar este PDA de la tabla?')) {
                tr.remove();
                renumberPdas();
                markAsUnsaved('planner-btn-save');
                fitCompactColumns();
                updateSessionsBalance(totalSessions);
            }
        });
    }
}

function reindexPdaNumbers() {
    const rows = document.querySelectorAll('#planner-tbody tr');
    rows.forEach((row, index) => {
        const newNum = index + 1;
        row.setAttribute('data-pda-number', newNum);
        row.children[1].innerText = newNum;
    });
}

function updateSessionsBalance(totalSessions) {
    const sessionInputs = document.querySelectorAll('#planner-tbody .pda-sessions');
    let sum = 0;
    sessionInputs.forEach(input => {
        sum += parseInt(input.value) || 0;
    });

    const balancePill = document.getElementById('summary-balance-pill');
    const balanceMsg = document.getElementById('planner-balance-msg');

    if (sum === totalSessions) {
        balancePill.className = "summary-pill success";
        balancePill.innerHTML = `⚖️ Balanceado: <strong id="summary-assigned-sessions">${sum} / ${totalSessions}</strong>`;
        if (balanceMsg) balanceMsg.innerHTML = `<span style="color: var(--color-success)">✓ Distribución perfecta. Coincide exactamente con las horas del ciclo.</span>`;
    } else if (sum < totalSessions) {
        const diff = totalSessions - sum;
        balancePill.className = "summary-pill warning";
        balancePill.innerHTML = `⚖️ Faltan: <strong id="summary-assigned-sessions">${diff} hs</strong> (Total: ${sum}/${totalSessions})`;
        if (balanceMsg) balanceMsg.innerHTML = `<span style="color: var(--color-warning)">⚠ Faltan asignar ${diff} sesiones para cubrir el ciclo.</span>`;
    } else {
        const diff = sum - totalSessions;
        balancePill.className = "summary-pill error";
        balancePill.innerHTML = `⚖️ Exceso: <strong id="summary-assigned-sessions">+${diff} hs</strong> (Total: ${sum}/${totalSessions})`;
        if (balanceMsg) balanceMsg.innerHTML = `<span style="color: var(--color-danger)">❌ Exceso de ${diff} sesiones asignadas. Reduce la cantidad de clases de los PDAs.</span>`;
    }
}

function addNewPdaRow(planeacionId) {
    const tbody = document.getElementById('planner-tbody');
    const nextNum = tbody.children.length + 1;
    const totalSessions = parseInt(document.getElementById('summary-total-sessions').innerText) || 190;

    const tr = document.createElement('tr');
    tr.setAttribute('data-pda-number', nextNum);
    tr.innerHTML = `
        <td class="col-contenido">
            <textarea class="form-control pda-field pda-contenido" placeholder="Contenido" rows="2"></textarea>
        </td>
        <td class="col-no">${nextNum}</td>
        <td class="col-pda">
            <textarea class="form-control pda-field pda-topic" placeholder="Proceso de Desarrollo de Aprendizaje (PDA)" rows="2"></textarea>
        </td>
        <td class="col-temas">
            <textarea class="form-control pda-field pda-temas" placeholder="Temas a Atender" rows="2"></textarea>
            <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                <input type="checkbox" class="skip-temas-cb"> Listo (Omitir en IA)
            </label>
        </td>
        <td class="col-sesiones">
            <input type="number" class="form-control pda-field pda-sessions" value="0" min="0" max="${totalSessions}">
            <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                <input type="checkbox" class="skip-sesiones-cb"> Listo (Omitir)
            </label>
        </td>
        <td class="col-verbo-rector">
            <input type="text" class="form-control pda-field pda-verb" value="" placeholder="Verbo">
            <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                <input type="checkbox" class="skip-verbo-cb"> Listo (Omitir)
            </label>
        </td>
        <td class="col-complejidad">
            <input type="text" class="form-control pda-field pda-complejidad" value="" placeholder="Complejidad">
        </td>
        <td class="col-rango">
            <input type="text" class="form-control pda-field pda-rango" value="" placeholder="Ej. 8 a 10 sesiones">
            <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                <input type="checkbox" class="skip-rango-cb"> Listo (Omitir)
            </label>
        </td>
        <td class="col-fecha">
            <input type="date" class="form-control pda-field pda-start-date">
            <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; cursor: pointer; color: #64748b;">
                <input type="checkbox" class="skip-fechas-cb"> Listo (Omitir)
            </label>
        </td>
        <td class="col-fecha">
            <input type="date" class="form-control pda-field pda-end-date">
        </td>
        <td class="col-accion" style="min-width: 140px; padding: 6px 8px; vertical-align: top;">
            <input type="hidden" class="pda-detalles-input" value="{}">
            <input type="hidden" class="pda-docx-input" value="">

            <!-- 1. Planeación IA -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; margin-bottom: 5px;">
                <div style="display: flex; gap: 4px; align-items: center;">
                    <button type="button" class="btn btn-secondary btn-sm pda-detail-btn" style="flex: 1; padding: 3px 4px; font-size: 11px;">
                        📝 PDA
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm pda-clear-plan-btn" style="padding: 3px 5px; font-size: 11px;" title="Borrar información generada con IA de este PDA" disabled>
                        🗑️ Plan
                    </button>
                </div>
                <label style="font-size: 10px; display: flex; align-items: center; gap: 4px; margin-top: 3px; cursor: pointer; color: #64748b;">
                    <input type="checkbox" class="skip-planeacion-cb"> Listo (Omitir)
                </label>
            </div>

            <!-- 2. Archivo Word (.docx) -->
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 4px 6px; margin-bottom: 5px;">
                <label style="font-size: 10px; display: flex; align-items: center; gap: 4px; color: #0369a1; font-weight: 600; margin-bottom: 3px;">
                    <input type="checkbox" class="has-docx-cb" onclick="return false;"> Archivo Word
                </label>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <button type="button" class="btn btn-primary btn-sm pda-download-btn" style="flex: 1; padding: 3px 4px; font-size: 11px; opacity: 0.4; pointer-events: none;" onclick="downloadIndividualPdaDoc(this)">
                        📥 Descargar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm pda-clear-docx-btn" style="padding: 3px 5px; font-size: 11px;" title="Borrar archivo Word guardado en este PDA" disabled>
                        🗑️ Doc
                    </button>
                </div>
            </div>

            <!-- 3. Eliminar Fila Completa -->
            <button type="button" class="btn btn-danger btn-sm pda-delete-btn" style="width: 100%; padding: 2px 4px; font-size: 10px;" title="Eliminar fila completa de la tabla">
                🗑️ Eliminar fila
            </button>
        </td>
    `;

    const topicTextarea = tr.querySelector('.pda-topic');
    const verbInput = tr.querySelector('.pda-verb');
    topicTextarea.addEventListener('input', () => {
        verbInput.value = getRectorVerb(topicTextarea.value);
        fitCompactColumns();
        markAsUnsaved('planner-btn-save');
    });

    bindCompactColumnInput(verbInput);
    bindCompactColumnInput(tr.querySelector('.pda-complejidad'));

    bindPdaRowActionEvents(tr, totalSessions);

    tr.querySelector('.pda-sessions').addEventListener('input', () => updateSessionsBalance(totalSessions));

    tbody.appendChild(tr);
    reindexPdaNumbers();
    fitCompactColumns();
    updateSessionsBalance(totalSessions);
}

async function savePdaPlannerChanges(planeacionId, totalSessions) {
    const rows = document.querySelectorAll('#planner-tbody tr');
    if (!rows.length) {
        showToast('No hay filas de PDAs para guardar.', 'error');
        return;
    }

    try {
        // Iniciar transacción en sql.js borrando los PDAs antiguos
        await dbRun("DELETE FROM planeacion_pdas WHERE planeacion_id = ?", [planeacionId]);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const pdaNum = i + 1;
            const contenido = row.querySelector('.pda-contenido').value.trim();
            const topic = row.querySelector('.pda-topic').value.trim();
            const temas = row.querySelector('.pda-temas').value.trim();
            const sCount = parseInt(row.querySelector('.pda-sessions').value) || 0;
            const verb = row.querySelector('.pda-verb').value.trim();
            const complejidad = row.querySelector('.pda-complejidad').value;
            const rango = row.querySelector('.pda-rango').value.trim();
            const startDate = row.querySelector('.pda-start-date').value;
            const endDate = row.querySelector('.pda-end-date').value;
            const detalles = row.querySelector('.pda-detalles-input').value;
            const archivoDocx = row.querySelector('.pda-docx-input') ? row.querySelector('.pda-docx-input').value : '';

            if (!topic) {
                throw new Error(`El texto del PDA ${pdaNum} no puede estar vacío.`);
            }

            await dbRun(
                `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count, contenido, temas, complejidad, rango_sugerido, start_date, end_date, detalles_planeacion, archivo_docx) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [planeacionId, pdaNum, topic, verb, sCount, contenido, temas, complejidad, rango, startDate, endDate, detalles, archivoDocx]
            );
        }

        // Actualizar total_pdas en la tabla principal
        await dbRun("UPDATE planeaciones SET total_pdas = ? WHERE id = ?", [rows.length, planeacionId]);

        // Save column widths globally
        const table = document.getElementById('planner-table');
        if (table) {
            const colgroup = table.querySelector('colgroup');
            if (colgroup) {
                const cols = colgroup.querySelectorAll('col');
                const widths = Array.from(cols).map(c => c.style.width || window.getComputedStyle(c).width);
                localStorage.setItem('planner_column_widths', JSON.stringify(widths));
            }
        }

        showToast('Cambios de dosificación guardados.', 'success');

        // Resetear botón de guardado
        if (window.markAsSaved) {
            window.markAsSaved('planner-btn-save');
        }

        // Recargar datos
        loadPlanification(planeacionId);

    } catch (e) {
        console.error(e);
        showToast('Error al guardar: ' + e.message, 'error');
    }
}

/* =========================================================
   MIS PLANEACIONES (CRUD)
   ========================================================= */
function formatDisciplineInput(e) {
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    const newVal = e.target.value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
    if (e.target.value !== newVal) {
        e.target.value = newVal;
        try { e.target.setSelectionRange(start, end); } catch (err) {}
    }
}

function initPlanCRUD() {
    // Event listeners para autocompletar disciplina en mayúsculas y sin acentos
    const editDisciplineInput = document.getElementById('edit-plan-discipline');
    if (editDisciplineInput) editDisciplineInput.addEventListener('input', formatDisciplineInput);
    
    const newDisciplineInput = document.getElementById('new-discipline-input');
    if (newDisciplineInput) newDisciplineInput.addEventListener('input', formatDisciplineInput);

    // Event listeners para la sección de Planeaciones
    const btnDownload = document.getElementById('btn-download-template');
    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (typeof ExcelExport !== 'undefined' && ExcelExport.descargarPlantilla) {
                ExcelExport.descargarPlantilla();
            } else {
                showToast('El módulo de Excel no está disponible.', 'error');
            }
        });
    }

    const importExcelFile = document.getElementById('import-excel-file');
    if (importExcelFile) {
        importExcelFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const planeacionId = e.target.dataset.planeacionId;
            if (!file || !planeacionId) return;

            if (typeof ExcelExport !== 'undefined' && ExcelExport.importarExcel) {
                await ExcelExport.importarExcel(planeacionId, file);
                e.target.value = ''; // Limpiar el input
            } else {
                showToast('El módulo de Excel no está disponible.', 'error');
            }
        });
    }

    const btnImportNewPlan = document.getElementById('btn-import-new-plan');
    const importNewPlanFile = document.getElementById('import-new-plan-file');
    if (btnImportNewPlan && importNewPlanFile) {
        btnImportNewPlan.addEventListener('click', () => importNewPlanFile.click());
        importNewPlanFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const cycles = dbQuery("SELECT id FROM school_cycles ORDER BY start_date DESC LIMIT 1");
                if (!cycles.length) {
                    showToast('Primero debes crear al menos un ciclo escolar en la pestaña Ciclos.', 'error');
                    return;
                }
                const cycleId = cycles[0].id;
                const filename = file.name.replace('.xlsx', '');
                const schedule = { "1": 1, "2": 1, "3": 1, "4": 1, "5": 0 };

                const newId = await dbRun(
                    `INSERT INTO planeaciones(cycle_id, disciplina, grado, weekly_hours, schedule, total_pdas) VALUES(?,?,?,?,?,?)`,
                    [cycleId, filename, 1, 4, JSON.stringify(schedule), 1]
                );

                if (typeof ExcelExport !== 'undefined' && ExcelExport.importarExcel) {
                    await ExcelExport.importarExcel(newId, file);
                }
            } catch (err) {
                console.error(err);
                showToast('Error al importar la plantilla: ' + err.message, 'error');
            } finally {
                e.target.value = '';
            }
        });
    }

    const pdasTbody = document.getElementById('pdas-tbody');
    if (pdasTbody) {
        pdasTbody.addEventListener('input', () => markAsUnsaved('planner-btn-save'));
        pdasTbody.addEventListener('change', () => markAsUnsaved('planner-btn-save'));
    }

    const editPlanForm = document.getElementById('edit-plan-form');
    if (editPlanForm) {
        editPlanForm.addEventListener('input', () => markAsUnsaved('edit-plan-submit-btn'));
    }
    const newPlanBtn = document.getElementById('btn-new-planification');

    // Configurar validación de horario en el modal de edición
    const weeklyInput = document.getElementById('edit-plan-weekly-hours');
    const dayInputs = document.querySelectorAll('#edit-plan-form .day-input');
    const errorMsg = document.getElementById('edit-plan-schedule-error');
    const submitBtn = document.getElementById('edit-plan-submit-btn');

    function validateHours() {
        let sum = 0;
        dayInputs.forEach(input => {
            sum += parseInt(input.value) || 0;
        });
        const weekly = parseInt(weeklyInput.value) || 0;

        if (sum !== weekly) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = `⚠️ La suma de las horas del horario semanal (${sum} hs) debe coincidir con las horas semanales (${weekly} hs).`;
            submitBtn.disabled = true;
        } else {
            errorMsg.style.display = 'none';
            submitBtn.disabled = false;
        }
    }

    if (weeklyInput && dayInputs.length) {
        dayInputs.forEach(input => input.addEventListener('input', validateHours));
        weeklyInput.addEventListener('input', validateHours);
    }

    // Configurar botón "Nueva Planeación"
    if (newPlanBtn) {
        newPlanBtn.addEventListener('click', () => {
            document.getElementById('edit-plan-id').value = '';
            document.getElementById('plan-modal-title').innerText = 'Crear Nueva Planeación';
            document.getElementById('edit-plan-discipline').value = '';
            document.getElementById('edit-plan-grade').value = '1';
            document.getElementById('edit-plan-weekly-hours').value = '4';

            // Rellenar ciclos escolares
            const select = document.getElementById('edit-plan-cycle');
            select.innerHTML = '';
            const list = dbQuery("SELECT * FROM school_cycles ORDER BY start_date DESC");
            if (!list.length) {
                showToast('Primero debes crear al menos un ciclo escolar en la pestaña Ciclos.', 'error');
                return;
            }
            list.forEach(c => {
                select.appendChild(Object.assign(document.createElement('option'), { value: c.id, text: c.name }));
            });

            // Horario inicial por defecto (4hs)
            document.getElementById('edit-plan-day-1').value = 1;
            document.getElementById('edit-plan-day-2').value = 1;
            document.getElementById('edit-plan-day-3').value = 1;
            document.getElementById('edit-plan-day-4').value = 1;
            document.getElementById('edit-plan-day-5').value = 0;

            validateHours();
            document.getElementById('edit-plan-modal').style.display = 'flex';
        });
    }

    if (editPlanForm) {
        editPlanForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const planIdVal = document.getElementById('edit-plan-id').value;
            const cycleId = parseInt(document.getElementById('edit-plan-cycle').value);
            const disciplina = document.getElementById('edit-plan-discipline').value.trim();
            const grado = parseInt(document.getElementById('edit-plan-grade').value);
            const weeklyHours = parseInt(weeklyInput.value);

            const schedule = {};
            for (let d = 1; d <= 5; d++) {
                schedule[d] = parseInt(document.getElementById(`edit-plan-day-${d}`).value) || 0;
            }

            try {
                if (planIdVal) {
                    // Modo EDICION
                    const planId = parseInt(planIdVal);
                    await dbRun(
                        `UPDATE planeaciones SET cycle_id = ?, disciplina = ?, grado = ?, weekly_hours = ?, schedule = ? WHERE id = ?`,
                        [cycleId, disciplina, grado, weeklyHours, JSON.stringify(schedule), planId]
                    );

                    showToast('Parámetros de la planeación actualizados.', 'success');
                } else {
                    // Modo CREACION (CRUD completo)
                    const libPdas = NEM_PHASE6_LIBRARY[disciplina]?.[grado] || [];
                    const totalPdas = libPdas.length || 1;

                    // 1. Insertar planeación
                    const newId = await dbRun(
                        `INSERT INTO planeaciones(cycle_id, disciplina, grado, weekly_hours, schedule, total_pdas) VALUES(?,?,?,?,?,?)`,
                        [cycleId, disciplina, grado, weeklyHours, JSON.stringify(schedule), totalPdas]
                    );

                    // 2. Calcular sesiones del ciclo
                    const cycles = dbQuery("SELECT * FROM school_cycles WHERE id = ?", [cycleId]);
                    const cycle = cycles[0];
                    const holidays = JSON.parse(cycle.holidays || '{}');
                    const schoolDays = calculateSchoolDays(cycle.start_date, cycle.total_days, holidays);
                    const sessions = mapSessions(schoolDays, schedule, cycle.period1_days, cycle.period2_days);
                    const totalSessions = sessions.length;

                    const baseSessions = Math.floor(totalSessions / totalPdas);
                    const remainder = totalSessions % totalPdas;

                    // 3. Insertar PDAs de la asignatura
                    if (libPdas.length > 0) {
                        for (let i = 0; i < libPdas.length; i++) {
                            const text = libPdas[i];
                            const isObj = (typeof text === 'object' && text !== null);
                            const pdaTopic = isObj ? text.topic : text;
                            const pdaNum = isObj ? (text.pda_number || (i + 1)) : (i + 1);
                            const verb = isObj ? (text.verbo_rector || getRectorVerb(pdaTopic)) : getRectorVerb(pdaTopic);
                            const sCount = isObj ? (text.sessions_count || (baseSessions + (pdaNum <= remainder ? 1 : 0))) : (baseSessions + (pdaNum <= remainder ? 1 : 0));
                            const pdaContenido = isObj ? (text.contenido || '') : '';
                            const pdaTemas = isObj ? (text.temas || '') : '';
                            const pdaComplejidad = isObj ? (text.complejidad || 'Media') : 'Media';
                            const pdaRango = isObj ? (text.rango_sugerido || '') : '';

                            await dbRun(
                                `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count, contenido, temas, complejidad, rango_sugerido) VALUES(?,?,?,?,?,?,?,?,?)`,
                                [newId, pdaNum, pdaTopic, verb, sCount, pdaContenido, pdaTemas, pdaComplejidad, pdaRango]
                            );
                        }
                    } else {
                        await dbRun(
                            `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count, contenido, temas, complejidad, rango_sugerido) VALUES(?,?,?,?,?,?,?,?,?)`,
                            [newId, 1, 'Proceso de Desarrollo de Aprendizaje (PDA) 1', 'Desarrolla', totalSessions, '', '', 'Media', '']
                        );
                    }

                    showToast('Planeación creada correctamente.', 'success');

                    // Abrir el planificador automáticamente
                    setTimeout(() => {
                        const tabBtn = document.querySelector('.nav-tab-btn[data-target="tab-dosificar"]');
                        tabBtn.click();
                        loadPlanification(newId);
                    }, 200);
                }

                closeEditPlanModal();
                renderPlaneacionesList();
            } catch (err) {
                showToast('Error al guardar planeación: ' + err.message, 'error');
            }
        });
    } // Cierra el if(editPlanForm)
}

let planeacionesSortKey = 'id';
let planeacionesSortDirection = 'desc'; // 'asc' o 'desc'

function sortPlaneacionesBy(key) {
    if (planeacionesSortKey === key) {
        planeacionesSortDirection = (planeacionesSortDirection === 'asc') ? 'desc' : 'asc';
    } else {
        planeacionesSortKey = key;
        planeacionesSortDirection = 'asc';
    }
    renderPlaneacionesList();
}

function updatePlaneacionesSortIcons() {
    const sortKeys = ['disciplina', 'grado', 'cycle_name', 'schedule', 'total_pdas'];
    sortKeys.forEach(k => {
        const iconEl = document.getElementById(`sort-icon-${k}`);
        const thEl = document.querySelector(`.sortable-th[data-sort="${k}"]`);
        if (iconEl && thEl) {
            if (planeacionesSortKey === k) {
                thEl.classList.add('active-sort');
                iconEl.innerText = (planeacionesSortDirection === 'asc') ? '▲' : '▼';
            } else {
                thEl.classList.remove('active-sort');
                iconEl.innerText = '↕';
            }
        }
    });
}

function renderPlaneacionesList() {
    const tbody = document.getElementById('planeaciones-tbody');
    tbody.innerHTML = '';
    updatePlaneacionesSortIcons();

    let list = dbQuery(`
        SELECT p.*, c.name as cycle_name 
        FROM planeaciones p 
        JOIN school_cycles c ON p.cycle_id = c.id
    `);

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay planeaciones guardadas.</td></tr>`;
        return;
    }

    // Ordenar dinámicamente según la columna y dirección activa
    list.sort((a, b) => {
        let valA, valB;
        if (planeacionesSortKey === 'disciplina') {
            valA = (a.disciplina || '').toLowerCase();
            valB = (b.disciplina || '').toLowerCase();
            return planeacionesSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (planeacionesSortKey === 'grado') {
            valA = Number(a.grado) || 0;
            valB = Number(b.grado) || 0;
            return planeacionesSortDirection === 'asc' ? (valA - valB) : (valB - valA);
        } else if (planeacionesSortKey === 'cycle_name') {
            valA = (a.cycle_name || '').toLowerCase();
            valB = (b.cycle_name || '').toLowerCase();
            return planeacionesSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (planeacionesSortKey === 'schedule') {
            valA = Number(a.weekly_hours) || 0;
            valB = Number(b.weekly_hours) || 0;
            return planeacionesSortDirection === 'asc' ? (valA - valB) : (valB - valA);
        } else if (planeacionesSortKey === 'total_pdas') {
            valA = Number(a.total_pdas) || 0;
            valB = Number(b.total_pdas) || 0;
            return planeacionesSortDirection === 'asc' ? (valA - valB) : (valB - valA);
        } else {
            // Predeterminado por ID
            valA = Number(a.id) || 0;
            valB = Number(b.id) || 0;
            return planeacionesSortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
    });

    list.forEach(p => {
        const sched = JSON.parse(p.schedule || '{}');
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
        const schedParts = [];
        for (let d = 1; d <= 5; d++) {
            if (sched[d] > 0) schedParts.push(`${days[d - 1]}: ${sched[d]}h`);
        }
        const schedStr = schedParts.join(', ') || 'Sin horario';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${htmlspecialchars(p.disciplina)}</strong></td>
            <td>${p.grado}º Grado</td>
            <td><span class="badge badge-primary">${htmlspecialchars(p.cycle_name)}</span></td>
            <td><span class="badge badge-warning">${schedStr}</span></td>
            <td><span class="badge badge-success">${p.total_pdas} PDAs</span></td>
            <td style="text-align: right;">
                <div style="display:inline-flex; gap:6px;">
                    <button class="btn btn-primary btn-sm btn-open-planner">⚡ Planear</button>
                    <button class="btn btn-success btn-sm btn-import-excel" title="Importar Excel">📤</button>
                    <button class="btn btn-secondary btn-sm btn-edit-params">✏️</button>
                    <button class="btn btn-danger btn-sm btn-delete-plan">🗑️</button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-open-planner').addEventListener('click', () => {
            loadPlanification(p.id);
            switchTab('tab-dosificar');
        });

        tr.querySelector('.btn-edit-params').addEventListener('click', () => {
            openEditPlanModal(p);
        });

        tr.querySelector('.btn-delete-plan').addEventListener('click', async () => {
            if (confirm(`¿Seguro que deseas eliminar la planeación de ${p.disciplina} (${p.grado}º)?`)) {
                try {
                    await dbRun("DELETE FROM planeaciones WHERE id = ?", [p.id]);
                    showToast('Planeación eliminada.', 'success');
                    renderPlaneacionesList();
                } catch (err) {
                    showToast('Error al eliminar: ' + err.message, 'error');
                }
            }
        });

        tr.querySelector('.btn-import-excel').addEventListener('click', () => {
            const input = document.getElementById('import-excel-file');
            input.dataset.planeacionId = p.id; // Guardamos el id al que se va a importar
            input.click();
        });

        tbody.appendChild(tr);
    });
}

function openEditPlanModal(plan) {
    document.getElementById('edit-plan-id').value = plan.id;
    document.getElementById('edit-plan-discipline').value = plan.disciplina;
    document.getElementById('edit-plan-grade').value = plan.grado;
    document.getElementById('edit-plan-weekly-hours').value = plan.weekly_hours;

    // Rellenar ciclos
    const select = document.getElementById('edit-plan-cycle');
    select.innerHTML = '';
    const list = dbQuery("SELECT * FROM school_cycles ORDER BY start_date DESC");
    list.forEach(c => {
        select.appendChild(Object.assign(document.createElement('option'), { value: c.id, text: c.name }));
    });
    select.value = plan.cycle_id;

    // Rellenar horario
    const sched = JSON.parse(plan.schedule || '{}');
    for (let d = 1; d <= 5; d++) {
        document.getElementById(`edit-plan-day-${d}`).value = sched[d] ?? 0;
    }

    // Activar validación manual de horas
    const weeklyInput = document.getElementById('edit-plan-weekly-hours');
    const dayInputs = document.querySelectorAll('#edit-plan-form .day-input');
    const errorMsg = document.getElementById('edit-plan-schedule-error');
    const submitBtn = document.getElementById('edit-plan-submit-btn');

    let sum = 0;
    dayInputs.forEach(input => { sum += parseInt(input.value) || 0; });
    const weekly = parseInt(weeklyInput.value) || 0;
    if (sum !== weekly) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = `⚠️ La suma de las horas del horario semanal (${sum} hs) debe coincidir con las horas semanales (${weekly} hs).`;
        submitBtn.disabled = true;
    } else {
        errorMsg.style.display = 'none';
        submitBtn.disabled = false;
    }

    document.getElementById('edit-plan-modal').style.display = 'flex';
}

function closeEditPlanModal() {
    document.getElementById('edit-plan-modal').style.display = 'none';
}

/* =========================================================
   CICLOS ESCOLARES (CRUD)
   ========================================================= */
let activeCycleIdForHolidays = null;

function initCycleForm() {
    const form = document.getElementById('cycle-crud-form');
    const totalInput = document.getElementById('cycle-total-days');
    const p1 = document.getElementById('cycle-p1-days');
    const p2 = document.getElementById('cycle-p2-days');
    const p3 = document.getElementById('cycle-p3-days');
    const startInput = document.getElementById('cycle-start-date');
    const endInput = document.getElementById('cycle-end-date');

    function validateSum() {
        const sum = (parseInt(p1.value) || 0) + (parseInt(p2.value) || 0) + (parseInt(p3.value) || 0);
        const total = parseInt(totalInput.value) || 0;

        if (sum !== total) {
            p1.style.borderColor = 'var(--color-danger)';
            p2.style.borderColor = 'var(--color-danger)';
            p3.style.borderColor = 'var(--color-danger)';
        } else {
            p1.style.borderColor = 'var(--border-color)';
            p2.style.borderColor = 'var(--border-color)';
            p3.style.borderColor = 'var(--border-color)';
        }
    }

    function updateCalculatedDays() {
        const startVal = startInput.value;
        const endVal = endInput.value;
        if (!startVal || !endVal) return;

        // Obtener festivos del ciclo activo (si existe)
        let holidays = {};
        const id = document.getElementById('cycle-id').value;
        if (id) {
            const cycles = dbQuery("SELECT holidays FROM school_cycles WHERE id = ?", [id]);
            if (cycles.length) {
                holidays = JSON.parse(cycles[0].holidays || '{}');
            }
        }

        const res = calculateCycleTrimestreDays(toggleDateFormat(startVal), toggleDateFormat(endVal), holidays);
        totalInput.value = res.totalDays;
        p1.value = res.p1Days;
        p2.value = res.p2Days;
        p3.value = res.p3Days;

        validateSum();
    }

    [p1, p2, p3, totalInput].forEach(el => el.addEventListener('input', validateSum));
    startInput.addEventListener('change', updateCalculatedDays);
    endInput.addEventListener('change', updateCalculatedDays);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('cycle-id').value;
        const name = document.getElementById('cycle-name').value.trim();
        const start = toggleDateFormat(startInput.value);
        const end = toggleDateFormat(endInput.value);
        const total = parseInt(totalInput.value);
        const p1Val = parseInt(p1.value);
        const p2Val = parseInt(p2.value);
        const p3Val = parseInt(p3.value);

        if ((p1Val + p2Val + p3Val) !== total) {
            showToast('La suma de los periodos debe ser exactamente igual a los días totales del ciclo.', 'error');
            return;
        }

        try {
            if (id) {
                // Actualizar
                await dbRun(
                    `UPDATE school_cycles SET name = ?, start_date = ?, end_date = ?, total_days = ?, period1_days = ?, period2_days = ?, period3_days = ? WHERE id = ?`,
                    [name, start, end, total, p1Val, p2Val, p3Val, id]
                );
                showToast('Ciclo escolar actualizado.', 'success');
            } else {
                // Crear
                const newId = await dbRun(
                    `INSERT INTO school_cycles(name, start_date, end_date, total_days, period1_days, period2_days, period3_days, holidays) VALUES(?,?,?,?,?,?,?,?)`,
                    [name, start, end, total, p1Val, p2Val, p3Val, JSON.stringify({})]
                );
                showToast('Ciclo escolar creado.', 'success');
                // Habilitar panel de festivos para el nuevo ciclo
                loadCycleHolidaysPanel(newId);
            }

            // Reset form
            form.reset();
            document.getElementById('cycle-id').value = '';
            document.getElementById('cycle-form-title').innerText = 'Agregar Ciclo Escolar';
            document.getElementById('btn-cancel-cycle-edit').style.display = 'none';

            renderCyclesList();
            loadCyclesDropdowns();
        } catch (err) {
            showToast('Error al guardar ciclo: ' + err.message, 'error');
        }
    });

    document.getElementById('btn-cancel-cycle-edit').addEventListener('click', () => {
        form.reset();
        document.getElementById('cycle-id').value = '';
        document.getElementById('cycle-form-title').innerText = 'Agregar Ciclo Escolar';
        document.getElementById('btn-cancel-cycle-edit').style.display = 'none';
        document.getElementById('cycle-holidays-card').style.display = 'none';
        activeCycleIdForHolidays = null;
    });

    // Lógica para gestionar festivos (CRUD + Rangos + Etiquetas de Leyenda)
    const holidayForm = document.getElementById('holiday-add-form');
    const holidaySubmitBtn = document.getElementById('btn-holiday-submit');
    const holidayCancelBtn = document.getElementById('btn-holiday-cancel');
    const holidayOrigInput = document.getElementById('holiday-orig-date');
    const holidayTitle = document.getElementById('holiday-form-title');
    const holidayTagSelect = document.getElementById('holiday-tag-select');
    const holidayChips = document.querySelectorAll('.btn-holiday-chip');
    const holidayLabelInput = document.getElementById('holiday-label');

    function setHolidayActiveChip(type) {
        holidayChips.forEach(chip => {
            if (chip.dataset.type === type) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
        if (holidayTagSelect) {
            holidayTagSelect.value = type;
        }
    }

    holidayChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const type = chip.dataset.type;
            const defText = chip.dataset.default;
            setHolidayActiveChip(type);

            // Si el campo de descripción está vacío o contiene el texto por defecto de otro chip, rellenar
            const currentVal = holidayLabelInput.value.trim();
            const isAnyDefault = Array.from(holidayChips).some(c => c.dataset.default === currentVal);
            if (!currentVal || isAnyDefault) {
                holidayLabelInput.value = defText;
            }
        });
    });

    if (holidayTagSelect) {
        holidayTagSelect.addEventListener('change', () => {
            setHolidayActiveChip(holidayTagSelect.value);
            const activeChip = document.querySelector(`.btn-holiday-chip[data-type="${holidayTagSelect.value}"]`);
            if (activeChip) {
                const currentVal = holidayLabelInput.value.trim();
                const isAnyDefault = Array.from(holidayChips).some(c => c.dataset.default === currentVal);
                if (!currentVal || isAnyDefault) {
                    holidayLabelInput.value = activeChip.dataset.default;
                }
            }
        });
    }

    function resetHolidayForm() {
        holidayForm.reset();
        holidayOrigInput.value = '';
        holidayTitle.innerText = 'Agregar Festivo / Inhábil';
        holidaySubmitBtn.innerText = '➕ Guardar Festivo';
        holidayCancelBtn.style.display = 'none';
        document.getElementById('holiday-date-end').disabled = false;
        setHolidayActiveChip('inhabiles');
    }

    if (holidayCancelBtn) {
        holidayCancelBtn.addEventListener('click', resetHolidayForm);
    }

    holidayForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeCycleIdForHolidays) return;

        const dateStart = document.getElementById('holiday-date').value;
        const dateEnd = document.getElementById('holiday-date-end').value;
        const label = document.getElementById('holiday-label').value.trim();
        const origDate = holidayOrigInput.value;

        try {
            const cycles = dbQuery("SELECT holidays FROM school_cycles WHERE id = ?", [activeCycleIdForHolidays]);
            if (cycles.length) {
                const holidays = JSON.parse(cycles[0].holidays || '{}');

                // Si estábamos editando una fecha individual, borrar la fecha original anterior
                if (origDate) {
                    delete holidays[origDate];
                }

                // Guardar como rango o como fecha individual
                if (dateEnd && dateEnd > dateStart) {
                    let curr = new Date(dateStart + 'T00:00:00');
                    const last = new Date(dateEnd + 'T00:00:00');
                    while (curr <= last) {
                        const dateStr = curr.toISOString().split('T')[0];
                        holidays[dateStr] = label;
                        curr.setDate(curr.getDate() + 1);
                    }
                } else {
                    holidays[dateStart] = label;
                }

                await dbRun("UPDATE school_cycles SET holidays = ? WHERE id = ?", [JSON.stringify(holidays), activeCycleIdForHolidays]);
                await recalculateAndSaveCycleDays(activeCycleIdForHolidays);
                showToast(origDate ? 'Día festivo actualizado.' : 'Día festivo añadido.', 'success');

                resetHolidayForm();
                renderHolidaysList(holidays);
            }
        } catch (err) {
            showToast('Error al guardar festivo: ' + err.message, 'error');
        }
    });

    // Cargar festivos oficiales MX
    document.getElementById('btn-load-mx-holidays').addEventListener('click', async () => {
        if (!activeCycleIdForHolidays) return;

        try {
            const cycles = dbQuery("SELECT start_date, holidays FROM school_cycles WHERE id = ?", [activeCycleIdForHolidays]);
            if (cycles.length) {
                const cycle = cycles[0];
                const yearStart = new Date(cycle.start_date + 'T00:00:00').getFullYear();
                const yearEnd = yearStart + 1;

                const mxDefaults = {
                    [`${yearStart}-09-16`]: "Día de la Independencia",
                    [`${yearStart}-11-02`]: "Día de Muertos",
                    [`${yearStart}-11-16`]: "Revolución Mexicana",
                    // Vacaciones de invierno
                    [`${yearStart}-12-21`]: "Vacaciones de Invierno",
                    [`${yearStart}-12-22`]: "Vacaciones de Invierno",
                    [`${yearStart}-12-23`]: "Vacaciones de Invierno",
                    [`${yearStart}-12-24`]: "Vacaciones de Invierno",
                    [`${yearStart}-12-25`]: "Navidad",
                    [`${yearStart}-12-28`]: "Vacaciones de Invierno",
                    [`${yearStart}-12-29`]: "Vacaciones de Invierno",
                    [`${yearStart}-12-30`]: "Vacaciones de Invierno",
                    [`${yearStart}-12-31`]: "Fin de Año",
                    [`${yearEnd}-01-01`]: "Año Nuevo",
                    [`${yearEnd}-01-04`]: "Vacaciones de Invierno",
                    [`${yearEnd}-01-05`]: "Vacaciones de Invierno",
                    [`${yearEnd}-01-06`]: "Día de Reyes",
                    [`${yearEnd}-01-07`]: "Vacaciones de Invierno",
                    [`${yearEnd}-01-08`]: "Vacaciones de Invierno",
                    [`${yearEnd}-02-01`]: "Día de la Constitución",
                    [`${yearEnd}-03-15`]: "Natalicio de Benito Juárez",
                    // Semana Santa
                    [`${yearEnd}-03-22`]: "Semana Santa",
                    [`${yearEnd}-03-23`]: "Semana Santa",
                    [`${yearEnd}-03-24`]: "Semana Santa",
                    [`${yearEnd}-03-25`]: "Semana Santa",
                    [`${yearEnd}-03-26`]: "Semana Santa",
                    [`${yearEnd}-03-29`]: "Semana Santa",
                    [`${yearEnd}-03-30`]: "Semana Santa",
                    [`${yearEnd}-03-31`]: "Semana Santa",
                    [`${yearEnd}-04-01`]: "Semana Santa",
                    [`${yearEnd}-04-02`]: "Semana Santa",
                    [`${yearEnd}-05-01`]: "Día del Trabajo",
                    [`${yearEnd}-05-05`]: "Batalla de Puebla",
                    [`${yearEnd}-05-15`]: "Día del Maestro"
                };

                const currentHols = JSON.parse(cycle.holidays || '{}');
                const mergedHols = Object.assign({}, mxDefaults, currentHols);

                await dbRun("UPDATE school_cycles SET holidays = ? WHERE id = ?", [JSON.stringify(mergedHols), activeCycleIdForHolidays]);
                await recalculateAndSaveCycleDays(activeCycleIdForHolidays);
                showToast('Festivos oficiales de México cargados.', 'success');
                renderHolidaysList(mergedHols);
            }
        } catch (err) {
            showToast('Error al cargar festivos: ' + err.message, 'error');
        }
    });

    // Exportar festivos
    document.getElementById('btn-export-holidays').addEventListener('click', () => {
        exportHolidaysToExcel();
    });

    // Importar festivos
    const importHolidaysInput = document.getElementById('import-holidays-file-input');
    document.getElementById('btn-import-holidays').addEventListener('click', () => {
        importHolidaysInput.click();
    });

    importHolidaysInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await importHolidaysFromExcel(file);
        importHolidaysInput.value = ''; // Resetear selección
    });
}

async function recalculateAndSaveCycleDays(cycleId) {
    const cycles = dbQuery("SELECT * FROM school_cycles WHERE id = ?", [cycleId]);
    if (!cycles.length) return;
    const cycle = cycles[0];
    const holidays = JSON.parse(cycle.holidays || '{}');

    const res = calculateCycleTrimestreDays(cycle.start_date, cycle.end_date, holidays);

    await dbRun(
        `UPDATE school_cycles SET total_days = ?, period1_days = ?, period2_days = ?, period3_days = ? WHERE id = ?`,
        [res.totalDays, res.p1Days, res.p2Days, res.p3Days, cycleId]
    );

    // Si el formulario actual tiene cargado este ciclo escolar, actualizar inputs en tiempo real
    const formId = document.getElementById('cycle-id').value;
    if (formId && parseInt(formId) === cycleId) {
        document.getElementById('cycle-total-days').value = res.totalDays;
        document.getElementById('cycle-p1-days').value = res.p1Days;
        document.getElementById('cycle-p2-days').value = res.p2Days;
        document.getElementById('cycle-p3-days').value = res.p3Days;

        const p1El = document.getElementById('cycle-p1-days');
        const p2El = document.getElementById('cycle-p2-days');
        const p3El = document.getElementById('cycle-p3-days');
        if (p1El && p2El && p3El) {
            p1El.style.borderColor = 'var(--border-color)';
            p2El.style.borderColor = 'var(--border-color)';
            p3El.style.borderColor = 'var(--border-color)';
        }
    }

    // Actualizar listado de ciclos para reflejar el conteo de días actualizado
    renderCyclesList();
}

function renderCyclesList() {
    const tbody = document.getElementById('cycles-tbody');
    tbody.innerHTML = '';

    const list = dbQuery("SELECT * FROM school_cycles ORDER BY start_date DESC");
    list.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${htmlspecialchars(c.name)}</strong></td>
            <td>${c.start_date}</td>
            <td>${c.end_date}</td>
            <td><span class="badge badge-primary">${c.total_days} días</span></td>
            <td style="text-align: right;">
                <div style="display:inline-flex; gap:4px;">
                    <button class="btn btn-secondary btn-sm btn-edit-cycle">✏️</button>
                    <button class="btn btn-danger btn-sm btn-delete-cycle">🗑️</button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-edit-cycle').addEventListener('click', () => {
            document.getElementById('cycle-id').value = c.id;
            document.getElementById('cycle-name').value = c.name;
            document.getElementById('cycle-start-date').value = toggleDateFormat(c.start_date);
            document.getElementById('cycle-end-date').value = toggleDateFormat(c.end_date);
            document.getElementById('cycle-total-days').value = c.total_days;
            document.getElementById('cycle-p1-days').value = c.period1_days;
            document.getElementById('cycle-p2-days').value = c.period2_days;
            document.getElementById('cycle-p3-days').value = c.period3_days;

            document.getElementById('cycle-form-title').innerText = 'Editar Ciclo Escolar';
            document.getElementById('btn-cancel-cycle-edit').style.display = 'inline-flex';

            loadCycleHolidaysPanel(c.id);
        });

        tr.querySelector('.btn-delete-cycle').addEventListener('click', async () => {
            if (confirm(`¿Seguro que deseas eliminar el ciclo ${c.name}? Se borrarán también todas las planeaciones y PDAs asociados.`)) {
                try {
                    await dbRun("DELETE FROM school_cycles WHERE id = ?", [c.id]);
                    showToast('Ciclo escolar eliminado.', 'success');
                    renderCyclesList();
                    loadCyclesDropdowns();
                    if (activeCycleIdForHolidays === c.id) {
                        document.getElementById('cycle-holidays-card').style.display = 'none';
                        activeCycleIdForHolidays = null;
                    }
                } catch (err) {
                    showToast('Error al eliminar: ' + err.message, 'error');
                }
            }
        });

        tbody.appendChild(tr);
    });
}

function loadCycleHolidaysPanel(cycleId) {
    activeCycleIdForHolidays = cycleId;
    document.getElementById('cycle-holidays-card').style.display = 'block';

    const cycles = dbQuery("SELECT holidays FROM school_cycles WHERE id = ?", [cycleId]);
    if (cycles.length) {
        renderHolidaysList(JSON.parse(cycles[0].holidays || '{}'));
    }
}

function selectQuickEmoji(emoji) {
    const iconInput = document.getElementById('crono-legend-icon');
    if (iconInput) iconInput.value = emoji;
}

function hexToRgba(hex, alpha = 0.2) {
    if (!hex) return `rgba(59, 130, 246, ${alpha})`;
    let c = hex.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return `rgba(59, 130, 246, ${alpha})`;
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildLegendCategoryObj(leg) {
    const color = leg.color || '#3B82F6';
    const bgTrans = hexToRgba(color, 0.18);
    const bgHeader = hexToRgba(color, 0.28);
    return {
        type: leg.id,
        name: leg.name,
        icon: leg.icon || '📌',
        color: color,
        is_inhabile: Number(leg.is_inhabile) !== 0,
        style: `background: ${bgTrans}; color: ${color}; border: 1px solid ${color}; font-weight: 700;`,
        cellStyle: `background: ${bgTrans}; color: ${color}; border: 1px solid ${color}; font-weight: 700;`,
        headerBg: bgHeader,
        headerColor: color
    };
}

function getHolidayCategoryInfo(text) {
    const legends = (typeof getCronoLegends === 'function') ? getCronoLegends() : DEFAULT_CRONO_LEGENDS;
    const textUpper = (text || '').trim().toUpperCase();

    if (!textUpper) {
        const def = legends[0] || DEFAULT_CRONO_LEGENDS[0];
        return buildLegendCategoryObj(def);
    }

    // 1. Coincidencia por ID o Nombre exacto
    for (const leg of legends) {
        if (leg.id.toUpperCase() === textUpper || leg.name.toUpperCase() === textUpper) {
            return buildLegendCategoryObj(leg);
        }
    }

    // 2. Coincidencia por palabras clave
    for (const leg of legends) {
        if (leg.keywords) {
            const kws = leg.keywords.split(',').map(k => k.trim().toUpperCase()).filter(k => k.length > 0);
            for (const kw of kws) {
                if (textUpper.includes(kw)) {
                    return buildLegendCategoryObj(leg);
                }
            }
        }
    }

    // 3. Fallback: primera leyenda
    const fallback = legends[0] || DEFAULT_CRONO_LEGENDS[0];
    return buildLegendCategoryObj(fallback);
}

function updateHolidayTagChips() {
    const container = document.getElementById('holiday-tag-chips');
    const select = document.getElementById('holiday-tag-select');
    if (!container) return;

    const legends = (typeof getCronoLegends === 'function') ? getCronoLegends() : DEFAULT_CRONO_LEGENDS;
    container.innerHTML = '';
    if (select) select.innerHTML = '';

    legends.forEach((leg, index) => {
        const catObj = buildLegendCategoryObj(leg);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn-holiday-chip ${index === 0 ? 'active' : ''}`;
        btn.dataset.type = leg.id;
        btn.dataset.default = leg.name;
        btn.style.cssText = catObj.style;
        btn.innerText = `${leg.icon} ${leg.name}`;

        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-holiday-chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            if (select) select.value = leg.id;

            const holidayLabelInput = document.getElementById('holiday-label');
            if (holidayLabelInput) {
                const currentVal = holidayLabelInput.value.trim();
                const isAnyDefault = legends.some(l => l.name === currentVal);
                if (!currentVal || isAnyDefault) {
                    holidayLabelInput.value = leg.name;
                }
            }
        });

        container.appendChild(btn);

        if (select) {
            const opt = document.createElement('option');
            opt.value = leg.id;
            opt.innerText = `${leg.icon} ${leg.name}`;
            select.appendChild(opt);
        }
    });
}

function renderCronoLegendsList() {
    const tbody = document.getElementById('crono-legends-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const legends = (typeof getCronoLegends === 'function') ? getCronoLegends() : DEFAULT_CRONO_LEGENDS;
    legends.forEach(leg => {
        const catObj = buildLegendCategoryObj(leg);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="holiday-legend-badge" style="${catObj.style}">
                    ${leg.icon} ${htmlspecialchars(leg.name)}
                </span>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="width:14px; height:14px; border-radius:3px; background:${leg.color}; border:1px solid rgba(0,0,0,0.15);"></div>
                    <code style="font-size:0.75rem;">${leg.color}</code>
                </div>
            </td>
            <td>
                ${Number(leg.is_inhabile) !== 0 ? '<span class="badge badge-danger" style="font-size:10px;">Sí (Inhábil)</span>' : '<span class="badge badge-success" style="font-size:10px;">No (Hábil)</span>'}
            </td>
            <td style="text-align: right;">
                <div style="display:inline-flex; gap:4px;">
                    <button class="btn btn-secondary btn-sm btn-edit-legend" style="padding:2px 6px; font-size:0.75rem;" title="Editar Leyenda">✏️</button>
                    <button class="btn btn-danger btn-sm btn-delete-legend" style="padding:2px 6px; font-size:0.75rem;" title="Eliminar Leyenda">🗑️</button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-edit-legend').addEventListener('click', () => {
            document.getElementById('crono-legend-id').value = leg.id;
            document.getElementById('crono-legend-name').value = leg.name;
            document.getElementById('crono-legend-icon').value = leg.icon;
            document.getElementById('crono-legend-color').value = leg.color;
            document.getElementById('crono-legend-color-picker').value = leg.color;
            document.getElementById('crono-legend-keywords').value = leg.keywords || '';
            document.getElementById('crono-legend-inhabile').checked = Number(leg.is_inhabile) !== 0;

            document.getElementById('crono-legend-form-title').innerText = `✏️ Editar Leyenda (${leg.name})`;
            document.getElementById('btn-crono-legend-submit').innerText = '💾 Actualizar Leyenda';
            document.getElementById('btn-crono-legend-cancel').style.display = 'inline-flex';
            document.getElementById('crono-legend-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        tr.querySelector('.btn-delete-legend').addEventListener('click', async () => {
            if (confirm(`¿Seguro que deseas eliminar la leyenda "${leg.name}"?`)) {
                try {
                    await deleteCronoLegend(leg.id);
                    showToast('Leyenda eliminada.', 'success');
                    renderCronoLegendsList();
                    updateHolidayTagChips();
                    if (activeCycleIdForHolidays) loadCycleHolidaysPanel(activeCycleIdForHolidays);
                    if (typeof renderCronogramaEscolar === 'function') renderCronogramaEscolar();
                } catch (e) {
                    showToast(e.message, 'error');
                }
            }
        });

        tbody.appendChild(tr);
    });
}

function initCronoLegendsHandlers() {
    const legendForm = document.getElementById('crono-legend-form');
    const colorPicker = document.getElementById('crono-legend-color-picker');
    const colorText = document.getElementById('crono-legend-color');
    const cancelBtn = document.getElementById('btn-crono-legend-cancel');
    const resetBtn = document.getElementById('btn-reset-legends');

    if (colorPicker && colorText) {
        colorPicker.addEventListener('input', (e) => {
            colorText.value = e.target.value;
        });
        colorText.addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                colorPicker.value = e.target.value;
            }
        });
    }

    function resetLegendForm() {
        if (!legendForm) return;
        legendForm.reset();
        document.getElementById('crono-legend-id').value = '';
        document.getElementById('crono-legend-icon').value = '📌';
        document.getElementById('crono-legend-color').value = '#3B82F6';
        if (colorPicker) colorPicker.value = '#3B82F6';
        document.getElementById('crono-legend-inhabile').checked = true;
        document.getElementById('crono-legend-form-title').innerText = '➕ Nueva Leyenda';
        document.getElementById('btn-crono-legend-submit').innerText = '💾 Guardar Leyenda';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetLegendForm);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (confirm('¿Restaurar todas las Leyendas del Cronograma a sus valores de fábrica?')) {
                try {
                    await resetDefaultCronoLegends();
                    showToast('Leyendas del cronograma restauradas.', 'success');
                    resetLegendForm();
                    renderCronoLegendsList();
                    updateHolidayTagChips();
                    if (activeCycleIdForHolidays) loadCycleHolidaysPanel(activeCycleIdForHolidays);
                    if (typeof renderCronogramaEscolar === 'function') renderCronogramaEscolar();
                } catch(e) {
                    showToast('Error al restaurar: ' + e.message, 'error');
                }
            }
        });
    }

    if (legendForm) {
        legendForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idInput = document.getElementById('crono-legend-id').value.trim();
            const name = document.getElementById('crono-legend-name').value.trim();
            const icon = document.getElementById('crono-legend-icon').value.trim() || '📌';
            const color = document.getElementById('crono-legend-color').value.trim() || '#3B82F6';
            const keywords = document.getElementById('crono-legend-keywords').value.trim();
            const isInhabile = document.getElementById('crono-legend-inhabile').checked ? 1 : 0;

            const id = idInput || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');

            try {
                await saveCronoLegend({
                    id: id,
                    name: name,
                    icon: icon,
                    color: color,
                    keywords: keywords,
                    is_inhabile: isInhabile,
                    display_order: 10
                });

                showToast(idInput ? 'Leyenda actualizada con éxito.' : 'Leyenda agregada con éxito.', 'success');
                resetLegendForm();
                renderCronoLegendsList();
                updateHolidayTagChips();

                if (activeCycleIdForHolidays) {
                    loadCycleHolidaysPanel(activeCycleIdForHolidays);
                    await recalculateAndSaveCycleDays(activeCycleIdForHolidays);
                }
                if (typeof renderCronogramaEscolar === 'function') {
                    renderCronogramaEscolar();
                }
            } catch(err) {
                showToast('Error al guardar leyenda: ' + err.message, 'error');
            }
        });
    }
}

function renderHolidaysList(holidays) {
    const list = document.getElementById('cycle-holidays-list');
    if (!list) return;
    list.innerHTML = '';

    const dates = Object.keys(holidays).sort();
    if (!dates.length) {
        list.innerHTML = `<div class="empty-state" style="padding:15px 0; font-size:12px; text-align:center; color:var(--text-secondary);">No hay días festivos registrados.</div>`;
        return;
    }

    dates.forEach(d => {
        const val = holidays[d];
        const catInfo = getHolidayCategoryInfo(val);

        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justify = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px 12px';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = 'var(--radius-md)';
        item.style.backgroundColor = 'var(--card-bg)';
        item.style.fontSize = '0.85rem';
        item.style.marginBottom = '6px';
        item.style.gap = '8px';

        item.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:3px; flex:1;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <strong style="color: var(--text-color); font-size:0.85rem;">${d}</strong>
                    <span class="holiday-legend-badge" style="${catInfo.style}">${catInfo.icon} ${catInfo.name}</span>
                </div>
                <span style="color: var(--text-secondary); font-size: 0.78rem;">${htmlspecialchars(val)}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn btn-secondary btn-sm btn-edit-holiday" style="padding: 3px 8px; font-size: 0.75rem;">✏️</button>
                <button class="btn btn-danger btn-sm btn-delete-holiday" style="padding: 3px 8px; font-size: 0.75rem;">🗑️</button>
            </div>
        `;

        // Botón Editar Festivo
        item.querySelector('.btn-edit-holiday').addEventListener('click', () => {
            document.getElementById('holiday-orig-date').value = d;
            document.getElementById('holiday-date').value = d.includes('-') && d.split('-')[0].length === 4 ? d : toggleDateFormat(d);
            document.getElementById('holiday-date-end').value = '';
            document.getElementById('holiday-date-end').disabled = true;
            document.getElementById('holiday-label').value = val;

            const detectedCat = getHolidayCategoryInfo(val);
            document.querySelectorAll('.btn-holiday-chip').forEach(chip => {
                if (chip.dataset.type === detectedCat.type) {
                    chip.classList.add('active');
                } else {
                    chip.classList.remove('active');
                }
            });

            document.getElementById('holiday-form-title').innerText = 'Editar Festivo / Inhábil';
            document.getElementById('btn-holiday-submit').innerText = '💾 Actualizar Festivo';
            document.getElementById('btn-holiday-cancel').style.display = 'inline-flex';

            document.getElementById('holiday-add-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        // Botón Eliminar Festivo
        item.querySelector('.btn-delete-holiday').addEventListener('click', async () => {
            if (confirm(`¿Eliminar el festivo del día ${d}?`)) {
                try {
                    const cycles = dbQuery("SELECT holidays FROM school_cycles WHERE id = ?", [activeCycleIdForHolidays]);
                    if (cycles.length) {
                        const hols = JSON.parse(cycles[0].holidays || '{}');
                        delete hols[d];
                        await dbRun("UPDATE school_cycles SET holidays = ? WHERE id = ?", [JSON.stringify(hols), activeCycleIdForHolidays]);
                        await recalculateAndSaveCycleDays(activeCycleIdForHolidays);
                        showToast('Día festivo eliminado.', 'success');
                        renderHolidaysList(hols);

                        if (document.getElementById('holiday-orig-date').value === d) {
                            document.getElementById('holiday-add-form').reset();
                            document.getElementById('holiday-orig-date').value = '';
                            document.getElementById('holiday-form-title').innerText = 'Agregar Festivo / Inhábil';
                            document.getElementById('btn-holiday-submit').innerText = '➕ Guardar Festivo';
                            document.getElementById('btn-holiday-cancel').style.display = 'none';
                            document.getElementById('holiday-date-end').disabled = false;
                        }
                    }
                } catch (err) {
                    showToast('Error al eliminar festivo: ' + err.message, 'error');
                }
            }
        });

        list.appendChild(item);
    });
}

function loadCyclesDropdowns() {
    try {
        const list = dbQuery("SELECT * FROM school_cycles ORDER BY start_date DESC");

        // Select del Setup (si existe)
        const setupSelect = document.getElementById('setup-cycle');
        if (setupSelect) {
            setupSelect.innerHTML = '<option value="">Seleccionar ciclo...</option>';
            list.forEach(c => {
                setupSelect.appendChild(Object.assign(document.createElement('option'), { value: c.id, text: c.name }));
            });
        }

        // Select del Modal Editar Planeación
        const editPlanCycleSelect = document.getElementById('edit-plan-cycle');
        if (editPlanCycleSelect) {
            const currentVal = editPlanCycleSelect.value;
            editPlanCycleSelect.innerHTML = '<option value="">Seleccionar ciclo...</option>';
            list.forEach(c => {
                editPlanCycleSelect.appendChild(Object.assign(document.createElement('option'), { value: c.id, text: c.name }));
            });
            if (currentVal) editPlanCycleSelect.value = currentVal;
        }

        // Select del Cronograma
        if (typeof populateCronoPlanSelect === 'function') {
            populateCronoPlanSelect();
        }
    } catch(e) {
        console.error("Error al cargar dropdowns de ciclos:", e);
    }
}

/* =========================================================
   COPIA DE SEGURIDAD Y CONFIGURACION (PANEL)
   ========================================================= */
function initBackupPanel() {
    const fileInput = document.getElementById('import-db-file');
    const triggerBtn = document.getElementById('btn-trigger-import');
    const restoreBtn = document.getElementById('btn-import-db');
    const fileNameSpan = document.getElementById('import-file-name');

    const authForm = document.getElementById('admin-auth-form');
    const defaultDbFileInput = document.getElementById('default-db-file-input');

    // Funciones globales de apertura y cierre de modal
    window.openAdminAuthModal = function () {
        document.getElementById('auth-username').value = '';
        document.getElementById('auth-password').value = '';
        document.getElementById('admin-auth-modal').style.display = 'flex';
    };

    window.closeAdminAuthModal = function () {
        document.getElementById('admin-auth-modal').style.display = 'none';
    };

    document.getElementById('btn-export-db').addEventListener('click', exportDatabase);

    triggerBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            fileNameSpan.innerText = file.name;
            restoreBtn.disabled = false;
        } else {
            fileNameSpan.innerText = 'Ningún archivo seleccionado';
            restoreBtn.disabled = true;
        }
    });

    restoreBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (confirm('¿Restaurar base de datos? Esto sobreescribirá toda tu información actual.')) {
            try {
                await importDatabase(file);
                showToast('Base de datos restaurada correctamente.', 'success');

                // Limpiar inputs
                fileInput.value = '';
                fileNameSpan.innerText = 'Ningún archivo seleccionado';
                restoreBtn.disabled = true;

                // Refrescar vistas
                loadCyclesDropdowns();
                renderCyclesList();
                renderPlaneacionesList();

                // Regresar a la pestaña dosificar
                document.querySelector('.nav-tab-btn[data-target="tab-dosificar"]').click();
                if (activePlaneacionId) {
                    loadPlanification(activePlaneacionId);
                }

            } catch (err) {
                showToast('Error al importar base de datos: ' + err.message, 'error');
            }
        }
    });

    // Evento de clic en restablecer base de datos
    document.getElementById('btn-reset-db').addEventListener('click', () => {
        openAdminAuthModal();
    });

    // Formulario de autenticación de administrador
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value;

        if (user === 'josue958' && pass === 'Yoshi985') {
            closeAdminAuthModal();
            showToast('Autenticación correcta. Selecciona el archivo .sqlite para establecer como predeterminado.', 'success');
            defaultDbFileInput.click();
        } else {
            showToast('Usuario o contraseña incorrectos.', 'error');
        }
    });

    // Al seleccionar el archivo de base de datos por defecto
    defaultDbFileInput.addEventListener('change', async () => {
        const file = defaultDbFileInput.files[0];
        if (!file) return;

        try {
            const buf = await file.arrayBuffer();

            // 1. Guardar en localStorage como semilla predeterminada
            saveDefaultSeed(buf);

            // 2. Cargar en base de datos activa
            await importDatabase(file);

            showToast('Base de datos predeterminada establecida y cargada con éxito.', 'success');

            // Refrescar vistas
            loadCyclesDropdowns();
            renderCyclesList();
            renderPlaneacionesList();

            // Limpiar selector y regresar a vista de configuración inicial
            defaultDbFileInput.value = '';
            activePlaneacionId = null;
            setPlannerLayoutActive(false);
            const dosificarSetup = document.getElementById('dosificar-setup');
            if (dosificarSetup) dosificarSetup.style.display = 'block';
            document.body.classList.add('bg-grid-pattern');

        } catch (err) {
            console.error(err);
            showToast('Error al establecer base de datos por defecto: ' + err.message, 'error');
        }
    });
}

/* =========================================================
   HELPERS & UTILERIAS GENERALES
   ========================================================= */
function htmlspecialchars(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function toggleDateFormat(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

function parseDateDMY(dmyStr) {
    if (!dmyStr) return null;
    const str = String(dmyStr).trim();
    if (!str.includes('-')) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;

    let day, month, year;
    if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
    } else {
        return null;
    }

    const d = new Date(year, month, day, 0, 0, 0, 0);
    if (isNaN(d.getTime())) return null;
    return d;
}

function formatDateDMY(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function isDateInhabile(dateStr, holidays = {}) {
    if (!dateStr || !holidays) return false;
    let reason = holidays[dateStr];
    if (!reason) {
        // Soporte bidireccional DD-MM-YYYY y YYYY-MM-DD
        const alt = toggleDateFormat(dateStr);
        if (alt) reason = holidays[alt];
    }
    if (!reason) return false;
    const cat = getHolidayCategoryInfo(reason);
    return !!cat.is_inhabile;
}

function calculateCycleTrimestreDays(startDateStr, endDateStr, holidays = {}) {
    if (!startDateStr || !endDateStr) {
        return { totalDays: 0, p1Days: 0, p2Days: 0, p3Days: 0 };
    }

    const start = parseDateDMY(startDateStr);
    const end = parseDateDMY(endDateStr);
    if (start > end) {
        return { totalDays: 0, p1Days: 0, p2Days: 0, p3Days: 0 };
    }

    const startYear = start.getFullYear();
    // Límites de los 3 trimestres según el calendario oficial escolar (Agosto-Noviembre, Diciembre-Marzo, Abril-Julio/Fin)
    const t1End = new Date(startYear, 10, 30); // 30 de Noviembre
    const t2Start = new Date(startYear, 11, 1); // 1 de Diciembre
    const t2End = new Date(startYear + 1, 2, 31); // 31 de Marzo
    const t3Start = new Date(startYear + 1, 3, 1); // 1 de Abril

    let p1Days = 0;
    let p2Days = 0;
    let p3Days = 0;

    let current = new Date(start);
    while (current <= end) {
        const w = current.getDay();
        if (w !== 0 && w !== 6) {
            const dateStr = formatDateDMY(current);
            if (!isDateInhabile(dateStr, holidays)) {
                if (current <= t1End) {
                    p1Days++;
                } else if (current >= t2Start && current <= t2End) {
                    p2Days++;
                } else {
                    p3Days++;
                }
            }
        }
        current.setDate(current.getDate() + 1);
    }

    const totalDays = p1Days + p2Days + p3Days;
    return { totalDays, p1Days, p2Days, p3Days };
}

// Re-declaración de funciones de fechas para el ámbito del app.js
function calculateSchoolDays(startDate, totalDays, holidays) {
    const days = [];
    let current = parseDateDMY(startDate);
    let count = 0;
    let limit = 0;

    while (count < totalDays && limit < 1000) {
        limit++;
        const w = current.getDay();
        const dateStr = formatDateDMY(current);

        if (w !== 0 && w !== 6 && !isDateInhabile(dateStr, holidays)) {
            days.push(dateStr);
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return days;
}

function mapSessions(schoolDays, schedule, p1Days, p2Days) {
    const sessions = [];
    const p1Limit = p1Days;
    const p2Limit = p1Days + p2Days;

    schoolDays.forEach((dateStr, idx) => {
        const date = parseDateDMY(dateStr);
        const dayOfWeek = date.getDay();

        const hours = schedule[dayOfWeek] || 0;
        if (hours > 0) {
            let period = 1;
            if (idx >= p2Limit) period = 3;
            else if (idx >= p1Limit) period = 2;

            for (let h = 0; h < hours; h++) {
                sessions.push({ date: dateStr, period });
            }
        }
    });
    return sessions;
}

function calculateDaysInRange(startDateStr, endDateStr, holidays) {
    if (!startDateStr || !endDateStr) return 0;

    let start = parseDateDMY(startDateStr);
    let end = parseDateDMY(endDateStr);

    if (start > end) return 0;

    let count = 0;
    let current = new Date(start);

    while (current <= end) {
        const w = current.getDay(); // 0 = Dom, 6 = Sáb
        if (w !== 0 && w !== 6) {
            const dateStr = formatDateDMY(current);
            if (!isDateInhabile(dateStr, holidays)) {
                count++;
            }
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

async function exportHolidaysToExcel() {
    if (!activeCycleIdForHolidays) {
        showToast('No hay ningún ciclo escolar seleccionado para exportar.', 'error');
        return;
    }

    try {
        const cycles = dbQuery("SELECT * FROM school_cycles WHERE id = ?", [activeCycleIdForHolidays]);
        if (!cycles.length) return;
        const cycle = cycles[0];
        const holidays = JSON.parse(cycle.holidays || '{}');

        // Agrupar fechas consecutivas con el mismo motivo
        const dates = Object.keys(holidays).sort();
        const ranges = [];

        if (dates.length > 0) {
            let currentRange = {
                inicio: dates[0],
                fin: dates[0],
                desc: holidays[dates[0]]
            };

            for (let i = 1; i < dates.length; i++) {
                const nextD = dates[i];
                const diffDays = (parseDateDMY(nextD) - parseDateDMY(currentRange.fin)) / (1000 * 60 * 60 * 24);

                if (diffDays === 1 && holidays[nextD] === currentRange.desc) {
                    currentRange.fin = nextD;
                } else {
                    ranges.push(Object.assign({}, currentRange));
                    currentRange = {
                        inicio: nextD,
                        fin: nextD,
                        desc: holidays[nextD]
                    };
                }
            }
            ranges.push(currentRange);
        }

        // Crear libro Excel con estilo institucional
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Días Inhábiles y Eventos');
        sheet.views = [{ showGridLines: true }];

        sheet.columns = [
            { header: 'Inicio', key: 'inicio', width: 16 },
            { header: 'Fin', key: 'fin', width: 16 },
            { header: 'Descripción / Motivo', key: 'desc', width: 36 },
            { header: 'Leyenda del Cronograma', key: 'categoria', width: 28 },
            { header: 'Icono', key: 'icono', width: 10 },
            { header: '¿Inhabilita Clases?', key: 'inhabile', width: 20 }
        ];

        const headerRow = sheet.getRow(1);
        headerRow.height = 28;
        headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        for (let col = 1; col <= 6; col++) {
            const cell = headerRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A203E' } };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF0A203E' } },
                bottom: { style: 'medium', color: { argb: 'FF0A203E' } },
                left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        }

        ranges.forEach((r, idx) => {
            const catInfo = getHolidayCategoryInfo(r.desc);
            const row = sheet.addRow({
                inicio: r.inicio,
                fin: r.inicio === r.fin ? '' : r.fin,
                desc: r.desc,
                categoria: catInfo.name,
                icono: catInfo.icon,
                inhabile: catInfo.is_inhabile ? 'Sí' : 'No'
            });

            row.height = 22;
            for (let c = 1; c <= 6; c++) {
                const cell = row.getCell(c);
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: (c === 1 || c === 2 || c === 5 || c === 6) ? 'center' : 'left'
                };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement('a'), {
            href: url,
            download: `festivos-${cycle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`
        });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Festivos y leyendas exportados con éxito a Excel.', 'success');
    } catch (e) {
        console.error(e);
        showToast('Error al exportar festivos: ' + e.message, 'error');
    }
}

async function importHolidaysFromExcel(file) {
    if (!activeCycleIdForHolidays) {
        showToast('No hay ningún ciclo escolar seleccionado para importar.', 'error');
        return;
    }

    try {
        const buf = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buf);
        const sheet = workbook.worksheets[0];

        const newHolidays = {};

        const formatDate = (val) => {
            if (val instanceof Date) {
                return formatDateDMY(val);
            }
            if (val && typeof val === 'object' && val.result) {
                val = val.result;
            }
            if (typeof val === 'string') {
                const matchYMD = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (matchYMD) return `${matchYMD[3]}-${matchYMD[2]}-${matchYMD[1]}`;
                const matchDMY = val.match(/^(\d{2})-(\d{2})-(\d{4})/);
                if (matchDMY) return val;
            }
            try {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return formatDateDMY(d);
            } catch (e) { }
            return null;
        };

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Saltar cabeceras

            const startVal = row.getCell(1).value;
            const endVal = row.getCell(2).value;
            const descVal = row.getCell(3).value;
            const catVal = row.getCell(4).value; // Leyenda / Categoría opcional en Excel

            if (!startVal || (!descVal && !catVal)) return;

            const startStr = formatDate(startVal);
            let descStr = typeof descVal === 'object' ? (descVal.richText ? descVal.richText.map(t => t.text).join('') : JSON.stringify(descVal)) : (descVal ? String(descVal).trim() : '');
            const catStr = catVal ? (typeof catVal === 'object' ? (catVal.richText ? catVal.richText.map(t => t.text).join('') : JSON.stringify(catVal)) : String(catVal).trim()) : '';

            if (!descStr && catStr) {
                descStr = catStr;
            }

            if (!startStr || !descStr) return;

            const endStr = endVal ? formatDate(endVal) : null;

            if (endStr && parseDateDMY(endStr) > parseDateDMY(startStr)) {
                let curr = parseDateDMY(startStr);
                const last = parseDateDMY(endStr);
                let limit = 0;
                while (curr <= last && limit < 150) {
                    limit++;
                    const dateStr = formatDateDMY(curr);
                    newHolidays[dateStr] = descStr;
                    curr.setDate(curr.getDate() + 1);
                }
            } else {
                newHolidays[startStr] = descStr;
            }
        });

        const countImported = Object.keys(newHolidays).length;
        if (countImported === 0) {
            showToast('No se encontraron registros de festivos válidos en el archivo.', 'error');
            return;
        }

        const cycles = dbQuery("SELECT holidays FROM school_cycles WHERE id = ?", [activeCycleIdForHolidays]);
        if (cycles.length) {
            const currentHolidays = JSON.parse(cycles[0].holidays || '{}');
            const merged = Object.assign({}, currentHolidays, newHolidays);

            await dbRun("UPDATE school_cycles SET holidays = ? WHERE id = ?", [JSON.stringify(merged), activeCycleIdForHolidays]);
            await recalculateAndSaveCycleDays(activeCycleIdForHolidays);

            showToast(`Se importaron ${countImported} fechas con sus leyendas correspondientes.`, 'success');
            renderHolidaysList(merged);
        }
    } catch (e) {
        console.error(e);
        showToast('Error al importar festivos: ' + e.message, 'error');
    }
}

let currentPdaDetailRow = null;

function openPdaDetailModal(tr) {
    currentPdaDetailRow = tr;
    const detallesInput = tr.querySelector('.pda-detalles-input').value;
    let data = {};
    try {
        data = JSON.parse(detallesInput || '{}');
    } catch (e) { }

    let bulkProfile = {};
    try {
        bulkProfile = JSON.parse(localStorage.getItem('jokarhe_bulk_profile') || '{}');
    } catch (e) {}

    // Datos generales heredados del Modal para Generación Masiva
    document.getElementById('pda-escuela').value = data.escuela || bulkProfile.escuela || document.getElementById('bulk-escuela')?.value || '';
    document.getElementById('pda-cct').value = data.cct || bulkProfile.cct || document.getElementById('bulk-cct')?.value || '';
    document.getElementById('pda-campo-formativo').value = data.campo_formativo || data.campo || bulkProfile.campo || document.getElementById('bulk-campo-formativo')?.value || '';
    document.getElementById('pda-profesor').value = data.profesor || bulkProfile.profesor || document.getElementById('bulk-profesor')?.value || '';
    document.getElementById('pda-sugerencia-eval').value = data.sugerencia_eval || data.eval || bulkProfile.eval || document.getElementById('bulk-sugerencia-eval')?.value || '';
    document.getElementById('pda-observaciones').value = data.observaciones || data.obs || bulkProfile.obs || document.getElementById('bulk-observaciones')?.value || '';
    document.getElementById('pda-firma-realizo').value = data.firma_realizo || data.realizo || bulkProfile.realizo || document.getElementById('bulk-firma-realizo')?.value || '';
    document.getElementById('pda-firma-reviso').value = data.firma_reviso || data.reviso || bulkProfile.reviso || document.getElementById('bulk-firma-reviso')?.value || '';

    // Campos pedagógicos del PDA
    document.getElementById('pda-ejes').value = data.ejes || '';
    document.getElementById('pda-nombre-proyecto').value = data.nombre_proyecto || '';
    document.getElementById('pda-producto').value = data.producto || '';
    document.getElementById('pda-problematica').value = data.problematica || '';
    document.getElementById('pda-proposito').value = data.proposito || '';
    document.getElementById('pda-desarrollo-sesiones').value = data.desarrollo_sesiones || '';
    document.getElementById('pda-rubrica').value = data.rubrica || '';
    document.getElementById('pda-teoria').value = data.teoria || '';

    document.getElementById('pda-detail-modal').style.display = 'flex';
}

function closePdaDetailModal() {
    document.getElementById('pda-detail-modal').style.display = 'none';
    currentPdaDetailRow = null;
}

document.getElementById('pda-detail-form').addEventListener('input', () => {
    markAsUnsaved('pda-modal-save-btn');
});

document.getElementById('pda-detail-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentPdaDetailRow) return;

    const data = {
        escuela: document.getElementById('pda-escuela').value,
        cct: document.getElementById('pda-cct').value,
        campo_formativo: document.getElementById('pda-campo-formativo').value,
        profesor: document.getElementById('pda-profesor').value,
        sugerencia_eval: document.getElementById('pda-sugerencia-eval').value,
        ejes: document.getElementById('pda-ejes').value,
        nombre_proyecto: document.getElementById('pda-nombre-proyecto').value,
        producto: document.getElementById('pda-producto').value,
        problematica: document.getElementById('pda-problematica').value,
        proposito: document.getElementById('pda-proposito').value,
        desarrollo_sesiones: document.getElementById('pda-desarrollo-sesiones').value,
        rubrica: document.getElementById('pda-rubrica').value,
        teoria: document.getElementById('pda-teoria').value,
        observaciones: document.getElementById('pda-observaciones').value,
        firma_realizo: document.getElementById('pda-firma-realizo').value,
        firma_reviso: document.getElementById('pda-firma-reviso').value
    };

    currentPdaDetailRow.querySelector('.pda-detalles-input').value = JSON.stringify(data);
    
    // Actualizar icono y botones de estado
    const actionBtn = currentPdaDetailRow.querySelector('.pda-detail-btn');
    const clearPlanBtn = currentPdaDetailRow.querySelector('.pda-clear-plan-btn');
    const skipCb = currentPdaDetailRow.querySelector('.skip-planeacion-cb');
    if (actionBtn && Object.keys(data).length > 0) {
        actionBtn.innerText = '✅ PDA';
        actionBtn.classList.remove('btn-secondary');
        actionBtn.classList.add('btn-success');
        if (clearPlanBtn) clearPlanBtn.disabled = false;
        if (skipCb) skipCb.checked = true;
    }

    closePdaDetailModal();
    showToast('Detalles guardados en la fila. ¡No olvides Guardar Cambios en la tabla principal!', 'success');
});

// IMPORTANTE: Coloca aquí tu clave API de Gemini
const GEMINI_API_KEY = "AQ.Ab8RN6J9Cxu1ROOwyWabQxj1rdEnZVBB0pLxvoPO2KgynMPBlQ";

async function generateWithGeminiAI() {
    if (!currentPdaDetailRow || !activePlaneacionId) return;
    const apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey === "AQUI_VA_TU_CLAVE") {
        showToast('Error: Debes colocar tu API Key válida.', 'error');
        return;
    }

    const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
    if (!plans.length) return;
    const plan = plans[0];

    const pdaTopic = currentPdaDetailRow.querySelector('.pda-topic').value;
    const temas = currentPdaDetailRow.querySelector('.pda-temas').value;
    const sesiones = currentPdaDetailRow.querySelector('.pda-sessions').value;

    const btn = document.querySelector('#pda-detail-modal .btn-primary[onclick="generateWithGeminiAI()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Generando...";
    }

    try {
        const data = await callGeminiForPda(pdaTopic, temas, sesiones, plan.disciplina, apiKey);
        
        document.getElementById('pda-campo-formativo').value = data.campo_formativo || '';
        document.getElementById('pda-ejes').value = data.ejes || '';
        document.getElementById('pda-nombre-proyecto').value = data.nombre_proyecto || '';
        document.getElementById('pda-problematica').value = data.problematica || '';
        document.getElementById('pda-proposito').value = data.proposito || '';
        document.getElementById('pda-producto').value = data.producto || '';
        document.getElementById('pda-desarrollo-sesiones').value = data.desarrollo_sesiones || '';
        document.getElementById('pda-rubrica').value = data.rubrica || '';
        document.getElementById('pda-teoria').value = data.teoria || '';

        showToast('Planeación generada exitosamente.', 'success');
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "✨ Generar con Gemini AI";
        }
    }
}

// ==========================================
// LÓGICA DE GENERACIÓN MASIVA (BULK)
// ==========================================

function openBulkPdaModal() {
    if (!activePlaneacionId) {
        showToast('Debes tener una planeación activa.', 'error');
        return;
    }
    
    // Validar si hay filas sin completar
    const tbody = document.getElementById('planner-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const uncompletedRows = rows.filter(tr => {
        const actionBtn = tr.querySelector('.pda-detail-btn');
        return actionBtn && !actionBtn.innerText.includes('✅');
    });

    if (uncompletedRows.length === 0) {
        showToast('Todas las filas ya están completadas con detalles (✅ PDA).', 'warning');
        return;
    }

    // Cargar datos estáticos predeterminados
    let profile = {};
    try {
        profile = JSON.parse(localStorage.getItem('jokarhe_bulk_profile') || '{}');
    } catch (e) {}

    document.getElementById('bulk-escuela').value = profile.escuela || document.getElementById('pda-escuela').value || '';
    document.getElementById('bulk-cct').value = profile.cct || document.getElementById('pda-cct').value || '';
    document.getElementById('bulk-campo-formativo').value = profile.campo || document.getElementById('pda-campo-formativo').value || '';
    document.getElementById('bulk-profesor').value = profile.profesor || document.getElementById('pda-profesor').value || '';
    document.getElementById('bulk-sugerencia-eval').value = profile.eval || document.getElementById('pda-sugerencia-eval').value || '';
    document.getElementById('bulk-observaciones').value = profile.obs || '';
    document.getElementById('bulk-firma-realizo').value = profile.realizo || document.getElementById('pda-firma-realizo').value || '';
    document.getElementById('bulk-firma-reviso').value = profile.reviso || document.getElementById('pda-firma-reviso').value || '';

    document.getElementById('bulk-pda-modal').style.display = 'flex';
}

function closeBulkPdaModal() {
    document.getElementById('bulk-pda-modal').style.display = 'none';
}

function clearBulkForm() {
    if (!confirm('¿Seguro que quieres limpiar todos los campos del formulario?')) return;
    document.getElementById('bulk-escuela').value = '';
    document.getElementById('bulk-cct').value = '';
    document.getElementById('bulk-campo-formativo').value = '';
    document.getElementById('bulk-profesor').value = '';
    document.getElementById('bulk-sugerencia-eval').value = '';
    document.getElementById('bulk-observaciones').value = '';
    document.getElementById('bulk-firma-realizo').value = '';
    document.getElementById('bulk-firma-reviso').value = '';
}

function saveBulkProfile() {
    const profile = {
        escuela: document.getElementById('bulk-escuela').value,
        cct: document.getElementById('bulk-cct').value,
        campo: document.getElementById('bulk-campo-formativo').value,
        profesor: document.getElementById('bulk-profesor').value,
        eval: document.getElementById('bulk-sugerencia-eval').value,
        obs: document.getElementById('bulk-observaciones').value,
        realizo: document.getElementById('bulk-firma-realizo').value,
        reviso: document.getElementById('bulk-firma-reviso').value
    };
    localStorage.setItem('jokarhe_bulk_profile', JSON.stringify(profile));

    // Sincronizar de inmediato los inputs del modal individual
    if (document.getElementById('pda-escuela')) document.getElementById('pda-escuela').value = profile.escuela || '';
    if (document.getElementById('pda-cct')) document.getElementById('pda-cct').value = profile.cct || '';
    if (document.getElementById('pda-campo-formativo')) document.getElementById('pda-campo-formativo').value = profile.campo || '';
    if (document.getElementById('pda-profesor')) document.getElementById('pda-profesor').value = profile.profesor || '';
    if (document.getElementById('pda-sugerencia-eval')) document.getElementById('pda-sugerencia-eval').value = profile.eval || '';
    if (document.getElementById('pda-observaciones')) document.getElementById('pda-observaciones').value = profile.obs || '';
    if (document.getElementById('pda-firma-realizo')) document.getElementById('pda-firma-realizo').value = profile.realizo || '';
    if (document.getElementById('pda-firma-reviso')) document.getElementById('pda-firma-reviso').value = profile.reviso || '';

    showToast('Datos capturados guardados como perfil predeterminado.', 'success');
}

async function callGeminiForPda(pdaTopic, temas, sesiones, disciplina, apiKey) {
    const instRol = getAIInstruction('rol');
    const instEjes = getAIInstruction('ejes');
    const instCampo = getAIInstruction('campo');
    const instEval = getAIInstruction('eval');
    const instProyecto = getAIInstruction('proyecto');
    const instProducto = getAIInstruction('producto');
    const instProblematica = getAIInstruction('problematica');
    const instProposito = getAIInstruction('proposito');
    const instSesiones = getAIInstruction('sesiones_detalle');
    const instRubrica = getAIInstruction('rubrica');
    const instTeoria = getAIInstruction('teoria');
    const instObservaciones = getAIInstruction('observaciones');

    const promptText = `${instRol}

Desarrolla una planeación didáctica detallada para el siguiente PDA y contexto:
- Disciplina: ${disciplina}
- PDA: ${pdaTopic}
- Temas a Atender: ${temas || 'Acorde al PDA'}
- Total de Sesiones asignadas: ${sesiones} sesiones

Debes generar cada uno de los siguientes elementos cumpliendo estrictamente estas indicaciones:
1. CAMPO FORMATIVO: ${instCampo} (Asignar acorde a ${disciplina}).
2. EJES ARTICULADORES: ${instEjes}
3. SUGERENCIA DE EVALUACIÓN: ${instEval}
4. NOMBRE DEL PROYECTO: ${instProyecto}
5. PRODUCTO FINAL: ${instProducto}
6. PROBLEMÁTICA: ${instProblematica}
7. PROPÓSITO: ${instProposito}
8. DESARROLLO DE SESIONES: ${instSesiones} (Desarrollar exactamente para ${sesiones} sesiones de 50 minutos).
9. RÚBRICA DE EVALUACIÓN: ${instRubrica}
10. TEORÍA PARA EL DOCENTE: ${instTeoria}
11. OBSERVACIONES: ${instObservaciones}

Debes responder ESTRICTAMENTE con un objeto JSON válido con la siguiente estructura (NO agregues bloques de código markdown ni texto adicional, SOLO el JSON puro):
{
  "campo_formativo": "Campo formativo asignado",
  "ejes": "Ejes articuladores separados por coma",
  "sugerencia_eval": "Sugerencia de evaluación formativa",
  "nombre_proyecto": "Nombre creativo del proyecto",
  "problematica": "Contexto de la problemática",
  "proposito": "Propósito educativo",
  "producto": "Producto final entregable",
  "desarrollo_sesiones": "Desarrollo completo de las sesiones y momentos",
  "rubrica": "Tabla en formato Markdown con Criterios de Evaluación, Indicadores de Logro y Calificación",
  "teoria": "Marco teórico y 5 ejemplos prácticos para el docente",
  "observaciones": "Observaciones pedagógicas"
}`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { response_mime_type: "application/json" }
        })
    });

    if (!response.ok) {
        const errResult = await response.json();
        throw new Error('Error en la API de Gemini: ' + (errResult.error?.message || response.statusText));
    }

    const result = await response.json();
    const content = result.candidates[0].content.parts[0].text;
    return JSON.parse(content);
}

document.getElementById('bulk-pda-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey === "AQUI_VA_TU_CLAVE") {
        showToast('Error: Debes colocar tu API Key válida.', 'error');
        return;
    }

    const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
    if (!plans.length) return;
    const plan = plans[0];

    // Recoger y preservar campos globales en el modal principal para el export ZIP
    document.getElementById('pda-escuela').value = document.getElementById('bulk-escuela').value;
    document.getElementById('pda-cct').value = document.getElementById('bulk-cct').value;
    document.getElementById('pda-campo-formativo').value = document.getElementById('bulk-campo-formativo').value;
    document.getElementById('pda-profesor').value = document.getElementById('bulk-profesor').value;
    document.getElementById('pda-sugerencia-eval').value = document.getElementById('bulk-sugerencia-eval').value;
    document.getElementById('pda-firma-realizo').value = document.getElementById('bulk-firma-realizo').value;
    document.getElementById('pda-firma-reviso').value = document.getElementById('bulk-firma-reviso').value;

    const tbody = document.getElementById('planner-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const uncompletedRows = rows.filter(tr => {
        const skipCb = tr.querySelector('.skip-planeacion-cb');
        if (skipCb && skipCb.checked) return false;
        
        const actionBtn = tr.querySelector('.pda-detail-btn');
        return actionBtn && !actionBtn.innerText.includes('✅');
    });

    const btn = document.getElementById('bulk-modal-save-btn');
    btn.disabled = true;

    // Mostrar el modal de progreso y ocultar el modal de configuración
    const progressModal = document.getElementById('bulk-progress-modal');
    const progressBar = document.getElementById('bulk-progress-bar');
    const progressText = document.getElementById('bulk-progress-text');
    const progressCount = document.getElementById('bulk-progress-count');

    closeBulkPdaModal();
    if (progressModal) {
        progressModal.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.innerText = 'Iniciando generación con IA...';
        progressCount.innerText = `0 / ${uncompletedRows.length} PDAs completados (0%)`;
    }

    try {
        for (let i = 0; i < uncompletedRows.length; i++) {
            const tr = uncompletedRows[i];
            const pdaTopic = tr.querySelector('.pda-topic')?.value || '';
            const temas = tr.querySelector('.pda-temas')?.value || '';
            const sesiones = tr.querySelector('.pda-sessions')?.value || '';

            const shortTopic = pdaTopic.length > 40 ? pdaTopic.substring(0, 40) + '...' : pdaTopic;
            if (progressText) {
                progressText.innerText = `Generando PDA ${i + 1} de ${uncompletedRows.length}: ${shortTopic}`;
            }

            // Extraer y construir la respuesta con IA
            const aiData = await callGeminiForPda(pdaTopic, temas, sesiones, plan.disciplina, apiKey);

            // Agregar datos fijos del modal de Generación Masiva
            aiData.escuela = document.getElementById('bulk-escuela').value;
            aiData.cct = document.getElementById('bulk-cct').value;
            if (document.getElementById('bulk-campo-formativo').value) {
                aiData.campo_formativo = document.getElementById('bulk-campo-formativo').value;
            }
            aiData.profesor = document.getElementById('bulk-profesor').value;
            if (document.getElementById('bulk-sugerencia-eval').value) {
                aiData.sugerencia_eval = document.getElementById('bulk-sugerencia-eval').value;
            }
            aiData.firma_realizo = document.getElementById('bulk-firma-realizo').value;
            aiData.firma_reviso = document.getElementById('bulk-firma-reviso').value;

            // Agregar Observaciones opcionales si se llenaron en el bulk
            const bulkObservaciones = document.getElementById('bulk-observaciones').value;
            if (bulkObservaciones) {
                aiData.observaciones = bulkObservaciones;
            }
            
            // Guardar en la fila
            tr.querySelector('.pda-detalles-input').value = JSON.stringify(aiData);
            
            // Actualizar interfaz visual
            const actionBtn = tr.querySelector('.pda-detail-btn');
            const clearPlanBtn = tr.querySelector('.pda-clear-plan-btn');
            if (actionBtn) {
                actionBtn.innerText = '✅ PDA';
                actionBtn.classList.remove('btn-secondary');
                actionBtn.classList.add('btn-success');
            }
            if (clearPlanBtn) clearPlanBtn.disabled = false;
            
            const skipCb = tr.querySelector('.skip-planeacion-cb');
            if (skipCb) skipCb.checked = true;

            // Actualizar barra de progreso
            const finishedPct = Math.round(((i + 1) / uncompletedRows.length) * 100);
            if (progressBar) progressBar.style.width = `${finishedPct}%`;
            if (progressCount) progressCount.innerText = `${i + 1} / ${uncompletedRows.length} PDAs completados (${finishedPct}%)`;

            // Pausa breve para evitar Rate Limits de la API
            if (i < uncompletedRows.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        if (progressText) progressText.innerText = '¡Generación masiva completada con éxito!';
        await new Promise(r => setTimeout(r, 600));

        showToast(`✅ Se han generado ${uncompletedRows.length} planeaciones exitosamente. No olvides dar en 'Guardar Cambios'.`, 'success');
        markAsUnsaved('planner-btn-save');

    } catch (err) {
        console.error(err);
        showToast('Error durante la generación masiva: ' + err.message, 'error');
    } finally {
        if (progressModal) progressModal.style.display = 'none';
        btn.disabled = false;
        btn.innerText = "🚀 Comenzar Generación Masiva";
        startAICountdown();
    }
});

/* =========================================================
   CONFIGURACIONES Y CATÁLOGOS LOCALES (localStorage)
   ========================================================= */
const DEFAULT_DISCIPLINES = [
    "Español",
    "Matemáticas",
    "Ciencias (Biología/Física/Química)",
    "Historia",
    "Geografía",
    "Inglés"
];

// ==========================================
// DICCIONARIO DE INSTRUCCIONES DE IA POR DEFECTO (CRUD)
// ==========================================
const DEFAULT_AI_INSTRUCTIONS = {
    rol: `ROL:\nEres un profesor de secundaria en México, ubicada en Estado de México. Tus alumnos presentan estilos de aprendizaje kinestésico y visual, por lo que los proyectos deben ser actividades lúdicas enfocadas en estos tipos de aprendizaje, debe enfocarse en combatir la apatía en clase, considera que los materiales para trabajar son solo pizarrón, plumón, borrador y los alumnos solo ocupan cuaderno, pluma, juego geométrico, colores para trabajar en cada sesión, no debes pedir recursos distintos a estos; deben ser prácticos y en ocasiones grupales, que fomenten el uso de valores que deberían aprender en casa como disciplina, honestidad, respeto, lealtad, respeto al labor patrio, trabajo en equipo, etc.`,
    
    ejes: `Selecciona entre 2 y 4 ejes articuladores de la NEM (Inclusión, Pensamiento Crítico, Interculturalidad Crítica, Igualdad de Género, Vida Saludable, Apropiación de las Culturas, Artes y Experiencias Estéticas) que tengan relación directa y coherente con el PDA. Sepáralos por comas.`,
    
    campo: `Indica con exactitud el Campo Formativo de la Nueva Escuela Mexicana al que pertenece la disciplina (ej. Saberes y Pensamiento Científico, Lenguajes, Ética Naturaleza y Sociedades, De lo Humano y lo Comunitario).`,
    
    eval: `Propón una sugerencia de evaluación formativa pertinente, continua y procesual (por ejemplo: Rúbrica analítica formativa, Lista de cotejo con coevaluación, Guía de observación directa).`,
    
    proyecto: `Redacta un nombre atractivo, creativo e innovador para el proyecto escolar, formulado como un reto, pregunta generadora o título motivador que despierte el interés de los adolescentes.`,
    
    producto: `Define un producto final tangible, demostrable o de aplicación comunitaria (ej. Prototipo geométrico, Tríptico informativo, Demostración práctica, Cartel de divulgación, Maqueta con materiales reciclados) realizable en el aula.`,
    
    problematica: `Describe una situación problemática real, del entorno escolar o de la comunidad (ej. gestión del tiempo, convivencia escolar, cuidado del medio ambiente, aplicación práctica de conceptos en el hogar) que dé sentido y pertinencia al aprendizaje del PDA.`,
    
    proposito: `Redacta el propósito general del proyecto en un párrafo claro, iniciando con un verbo en infinitivo, especificando qué aprenderán los estudiantes, cómo lo desarrollarán y para qué les servirá en su vida cotidiana.`,
    
    sesiones_detalle: `Desarrolla las sesiones de 50 minutos organizadas en los 4 Momentos de la NEM:\n- Momento 1: Planteamiento y recuperación de saberes previos.\n- Momento 2: Implementación, indagación y construcción de actividades prácticas (Inicio, Desarrollo y Cierre con tiempos específicos para cada sesión).\n- Momento 3: Presentación o socialización del producto final.\n- Momento 4: Evaluación formativa y metacognición.\nEspecifica qué hace el docente y qué hacen los alumnos con instrucciones claras y dinámicas.`,
    
    rubrica: `Genera una tabla Markdown estricta con las columnas: | Criterios de Evaluación | Indicadores de Logro | Calificación |.\nIncluye al menos 3 criterios fundamentales (Conceptual, Procedimental y Actitudinal) con niveles de desempeño claros y ponderaciones.`,
    
    teoria: `Redacta un marco teórico conciso y claro de los conceptos esenciales para que el docente domine el tema en clase, seguido de exactamente 5 ejemplos prácticos resueltos paso a paso con explicaciones didácticas.`,
    
    observaciones: `Proporciona recomendaciones breves para adecuaciones curriculares, atención a la diversidad, seguimiento a alumnos con rezago o ajustes razonables durante el desarrollo de las sesiones.`,
    
    btn_temas: `Considerando la fase 6 del plan sintético, la disciplina de {disciplina}, el siguiente contenido: "{contenido}" y este PDA: "{pda}".\nIndica cuáles son los temas específicos que deben cubrirse para lograr el cumplimiento de este proceso de desarrollo de aprendizaje.\nResponde ESTRICTAMENTE con un JSON con la estructura: {"temas": "Lista de temas sugeridos separados por coma o viñetas"}`,
    
    btn_verbo: `Lee el siguiente PDA: "{pda}".\nCon base a la taxonomía de Bloom, indica cuál es el verbo rector principal y su nivel de complejidad pedagógica (Baja, Media o Alta).\nResponde ESTRICTAMENTE con un JSON con la estructura: {"verbo": "verbo rector", "complejidad": "Baja, Media o Alta"}`,
    
    btn_rango: `Analiza el PDA: "{pda}".\nConsiderando la taxonomía de Bloom, que el ciclo escolar tiene {totalSessions} sesiones en total y hay {totalPdas} PDAs.\nEstima el rango sugerido de sesiones que debería tener este PDA basándose en su complejidad pedagógica.\nResponde ESTRICTAMENTE con un JSON con la estructura: {"rango": "Baja complejidad - 6-8" o "Media complejidad - 8-10" o "Alta complejidad - 10-12"}`,
    
    btn_sesiones: `Eres un experto en planeación educativa. Tienes un total de {remainingSessions} sesiones que DEBES distribuir EXACTAMENTE entre los siguientes {activeCount} PDAs de la disciplina de {disciplina}.\nConsidera el rango sugerido, el verbo rector y la complejidad para darle más sesiones a los temas difíciles y menos a los fáciles.\nREGLAS ESTRICTAS E INQUEBRANTABLES:\n1. NINGÚN PDA PUEDE QUEDAR EN 0 SESIONES. El valor mínimo obligatorio para cada PDA es 1 sesión.\n2. Cada uno de los {activeCount} PDAs DEBE recibir al menos 1 sesión (sesiones >= 1).\n3. La suma total exacta de las sesiones asignadas DEBE ser estrictamente igual a {remainingSessions}.\nAquí están los PDAs:\n{pdasJson}\nResponde ESTRICTAMENTE con un JSON con la estructura: {"distribucion": [{"pdaNum": 1, "sesiones": 5}]}`
};

function getAIInstructions() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem('jokarhe_ai_instructions') || '{}');
    } catch (e) {}
    return Object.assign({}, DEFAULT_AI_INSTRUCTIONS, saved);
}

function getAIInstruction(key) {
    const all = getAIInstructions();
    return all[key] || DEFAULT_AI_INSTRUCTIONS[key] || '';
}

function updateAISaveButtonsState(isDirty) {
    const saveButtons = document.querySelectorAll('.btn-save-ai-all');
    saveButtons.forEach(btn => {
        if (isDirty) {
            btn.classList.add('btn-save-dirty');
            btn.classList.remove('btn-primary');
            btn.innerHTML = '⚠️ 💾 Guardar Cambios Detectados';
            btn.title = 'Hay modificaciones sin guardar en las instrucciones de IA.';
        } else {
            btn.classList.remove('btn-save-dirty');
            btn.classList.add('btn-primary');
            btn.innerHTML = '💾 Guardar Todas las Instrucciones';
            btn.title = 'Todas las instrucciones de IA están guardadas.';
        }
    });
}

function checkAIInstructionsDirty() {
    const currentSaved = getAIInstructions();
    let hasChanges = false;

    for (let k of Object.keys(DEFAULT_AI_INSTRUCTIONS)) {
        const el = document.getElementById(`ai-inst-${k.replace(/_/g, '-')}`);
        if (el) {
            const currentVal = el.value.trim();
            const savedVal = (currentSaved[k] || DEFAULT_AI_INSTRUCTIONS[k] || '').trim();
            if (currentVal !== savedVal) {
                hasChanges = true;
                break;
            }
        }
    }

    updateAISaveButtonsState(hasChanges);
}

function saveAllAIInstructions() {
    const keys = Object.keys(DEFAULT_AI_INSTRUCTIONS);
    const newInstructions = {};

    for (let k of keys) {
        const el = document.getElementById(`ai-inst-${k.replace(/_/g, '-')}`);
        if (el) {
            const val = el.value.trim();
            if (!val) {
                showToast(`El campo "${k}" no puede quedar vacío. Debe contener una indicación para la IA.`, 'error');
                el.focus();
                return;
            }
            newInstructions[k] = val;
        }
    }

    localStorage.setItem('jokarhe_ai_instructions', JSON.stringify(newInstructions));
    updateAISaveButtonsState(false);
    showToast('✅ Todas las instrucciones de IA se han guardado exitosamente.', 'success');
}

function resetAllAIInstructions() {
    if (!confirm('¿Deseas restablecer todas las instrucciones de IA a sus valores de fábrica?')) return;
    localStorage.removeItem('jokarhe_ai_instructions');
    renderAIPanel();
    updateAISaveButtonsState(false);
    showToast('Instrucciones de IA restablecidas por defecto.', 'info');
}

function renderAIPanel() {
    const instructions = getAIInstructions();
    for (let k of Object.keys(DEFAULT_AI_INSTRUCTIONS)) {
        const el = document.getElementById(`ai-inst-${k.replace(/_/g, '-')}`);
        if (el) {
            el.value = instructions[k] || DEFAULT_AI_INSTRUCTIONS[k] || '';
            if (!el.dataset.listenerBound) {
                el.addEventListener('input', checkAIInstructionsDirty);
                el.dataset.listenerBound = 'true';
            }
        }
    }
    updateAISaveButtonsState(false);
}

function initSettingsPanel() {
    // Inicializar panel de IA
    renderAIPanel();

    // Inicializar Disciplinas
    renderDisciplinesSettings();
    populateDisciplinesSelect();

    const btnAddDiscipline = document.getElementById('btn-add-discipline');
    const inputDiscipline = document.getElementById('new-discipline-input');

    if (btnAddDiscipline && inputDiscipline) {
        btnAddDiscipline.addEventListener('click', () => {
            const newDiscipline = inputDiscipline.value.trim();
            if (newDiscipline) {
                let disciplines = getStoredDisciplines();
                if (!disciplines.includes(newDiscipline)) {
                    disciplines.push(newDiscipline);
                    saveDisciplines(disciplines);
                    inputDiscipline.value = '';
                    renderDisciplinesSettings();
                    populateDisciplinesSelect();
                    showToast('Disciplina agregada exitosamente.', 'success');
                } else {
                    showToast('La disciplina ya existe en el catálogo.', 'error');
                }
            }
        });
    }
}

function getStoredDisciplines() {
    const data = localStorage.getItem('jokarhe_disciplinas');
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return DEFAULT_DISCIPLINES;
        }
    }
    return DEFAULT_DISCIPLINES;
}

function saveDisciplines(arr) {
    localStorage.setItem('jokarhe_disciplinas', JSON.stringify(arr));
}

function renderDisciplinesSettings() {
    const list = document.getElementById('disciplines-list');
    if (!list) return;

    list.innerHTML = '';
    const disciplines = getStoredDisciplines();

    disciplines.forEach(d => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '8px 12px';
        li.style.background = '#fff';
        li.style.border = '1px solid var(--border-color)';
        li.style.borderRadius = 'var(--radius-md)';

        const span = document.createElement('span');
        span.textContent = d;

        const btnDelete = document.createElement('button');
        btnDelete.textContent = '❌';
        btnDelete.className = 'btn btn-outline';
        btnDelete.style.padding = '4px 8px';
        btnDelete.style.borderColor = '#ff4d4f';
        btnDelete.style.color = '#ff4d4f';
        btnDelete.style.fontSize = '12px';

        btnDelete.addEventListener('click', () => {
            if (confirm(`¿Seguro que deseas eliminar "${d}"?`)) {
                let updated = getStoredDisciplines().filter(x => x !== d);
                saveDisciplines(updated);
                renderDisciplinesSettings();
                populateDisciplinesSelect();
                showToast('Disciplina eliminada.', 'success');
            }
        });

        li.appendChild(span);
        li.appendChild(btnDelete);
        list.appendChild(li);
    });
}

function populateDisciplinesSelect() {
    const select = document.getElementById('setup-discipline');
    if (!select) return;

    // Preservar el valor actual si es posible
    const currentValue = select.value;

    select.innerHTML = '<option value="">Seleccionar disciplina...</option>';
    const disciplines = getStoredDisciplines();

    disciplines.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        select.appendChild(option);
    });

    if (disciplines.includes(currentValue)) {
        select.value = currentValue;
    }
}

/* =========================================================
   NUEVAS FUNCIONES DE CÁLCULO E IA (PLANIFICADOR)
   ========================================================= */

async function calculatePdaSessions() {
    if (!activePlaneacionId) return;

    const totalSessions = parseInt(document.getElementById('summary-total-sessions').innerText) || 0;
    const rows = document.querySelectorAll('#planner-tbody tr');
    if (!rows.length || totalSessions <= 0) return;

    const apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey === "AQUI_VA_TU_CLAVE") {
        showToast('Error: Debes colocar tu API Key válida.', 'error');
        return;
    }

    const btn = document.getElementById('planner-btn-calc-sessions');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Generando...";
    }

    let remainingSessions = totalSessions;
    let activeRowsData = [];
    let rowData = [];

    rows.forEach((row, index) => {
        const cb = row.querySelector('.skip-sesiones-cb');
        const currentVal = parseInt(row.querySelector('.pda-sessions').value) || 0;
        const isSkipped = cb && cb.checked;
        const pdaNum = index + 1;

        // Si la fila está marcada como 'Listo' pero tiene 0 sesiones o está vacía, se incluye obligatoriamente para recalcular
        if (isSkipped && currentVal > 0) {
            remainingSessions -= currentVal;
            rowData.push({ row, isSkipped: true, fixed: currentVal, pdaNum });
        } else {
            if (cb) cb.checked = false; // Desmarcar casilla para recalcular y no dejar en 0
            const contenido = row.querySelector('.pda-contenido').value.trim();
            const topic = row.querySelector('.pda-topic').value.trim();
            const verbo = row.querySelector('.pda-verb').value.trim();
            const complejidad = row.querySelector('.pda-complejidad').value.trim();
            const rango = row.querySelector('.pda-rango').value.trim();
            
            activeRowsData.push({ pdaNum, contenido, topic, verbo, complejidad, rango });
            rowData.push({ row, isSkipped: false, fixed: 0, pdaNum });
        }
    });

    if (remainingSessions < 0) remainingSessions = 0;

    if (activeRowsData.length === 0 || remainingSessions === 0) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🤖 Calcular Sesiones";
        }
        return;
    }

    const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
    const plan = plans[0];

    const templatePrompt = getAIInstruction('btn_sesiones');
    const promptText = templatePrompt
        .replace(/{remainingSessions}/g, remainingSessions)
        .replace(/{activeCount}/g, activeRowsData.length)
        .replace(/{disciplina}/g, plan.disciplina)
        .replace(/{pdasJson}/g, JSON.stringify(activeRowsData, null, 2));

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) throw new Error('Error en la respuesta de la API de Gemini');

        const result = await response.json();
        const content = result.candidates[0].content.parts[0].text;
        const data = JSON.parse(content);
        let distribucion = data.distribucion || [];

        // Validar y ajustar matemáticamente garantizando que NINGUNA fila quede en 0 (Mínimo 1 sesión)
        let pdaMap = {};
        
        // 1. Inicializar cada PDA activo con mínimo 1 sesión
        activeRowsData.forEach(rd => pdaMap[rd.pdaNum] = 1);

        // 2. Cargar respuestas de la IA respetando el mínimo de 1
        distribucion.forEach(d => {
            let val = parseInt(d.sesiones);
            if (!isNaN(val) && val >= 1) {
                if (pdaMap.hasOwnProperty(d.pdaNum)) {
                    pdaMap[d.pdaNum] = val;
                }
            }
        });

        // 3. Garantizar estrictamente que no exista ningún 0
        activeRowsData.forEach(rd => {
            if (!pdaMap[rd.pdaNum] || pdaMap[rd.pdaNum] < 1) {
                pdaMap[rd.pdaNum] = 1;
            }
        });

        // 4. Calcular suma y ajustar diferencia exacta con remainingSessions
        let sum = activeRowsData.reduce((acc, rd) => acc + (pdaMap[rd.pdaNum] || 0), 0);
        let diff = remainingSessions - sum;

        if (diff > 0 && activeRowsData.length > 0) {
            // Faltan sesiones: repartir +1 iterativamente a los PDAs
            let needed = diff;
            let idx = 0;
            while (needed > 0) {
                let num = activeRowsData[idx % activeRowsData.length].pdaNum;
                pdaMap[num]++;
                needed--;
                idx++;
            }
        } else if (diff < 0 && activeRowsData.length > 0) {
            // Sobran sesiones (la IA asignó más de lo permitido): restar progresivamente SIN bajar de 1
            let excess = -diff;
            while (excess > 0) {
                let didRemove = false;
                for (let i = activeRowsData.length - 1; i >= 0; i--) {
                    let num = activeRowsData[i].pdaNum;
                    if (pdaMap[num] > 1) { // ¡NUNCA bajar de 1!
                        pdaMap[num]--;
                        excess--;
                        didRemove = true;
                        if (excess === 0) break;
                    }
                }
                if (!didRemove) break; // Si todos están en 1
            }
        }

        // Aplicar a la interfaz
        rowData.forEach(rd => {
            if (!rd.isSkipped) {
                let s = pdaMap[rd.pdaNum] || 1;
                rd.row.querySelector('.pda-sessions').value = s;
                const cb = rd.row.querySelector('.skip-sesiones-cb');
                if (cb) cb.checked = true;
            }
        });

        updateSessionsBalance(totalSessions);
        markAsUnsaved('planner-btn-save');
        showToast('Sesiones calculadas por IA exitosamente (mínimo 1 por PDA).', 'success');
    } catch (err) {
        console.error("Error AI Sessions:", err);
        showToast('Error calculando sesiones por IA: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🤖 Calcular Sesiones";
        }
        startAICountdown();
    }
}

function calculatePdaDates() {
    if (!activePlaneacionId) return;

    const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
    if (!plans.length) return;
    const planeacion = plans[0];
    const cycle = dbQuery("SELECT * FROM school_cycles WHERE id = ?", [planeacion.cycle_id])[0];
    const holidays = JSON.parse(cycle.holidays || '{}');
    const schoolDays = calculateSchoolDays(cycle.start_date, cycle.total_days, holidays);
    const schedule = JSON.parse(planeacion.schedule || '{}');
    const sessionsList = mapSessions(schoolDays, schedule, cycle.period1_days, cycle.period2_days);

    let currentSessionIndex = 0;
    const rows = document.querySelectorAll('#planner-tbody tr');
    let hasError = false;

    // Helper para convertir DD-MM-YYYY a YYYY-MM-DD para <input type="date">
    const formatForInput = (dmy) => {
        if (!dmy) return '';
        const parts = dmy.split('-');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return dmy;
    };

    rows.forEach(row => {
        const pdaSessions = parseInt(row.querySelector('.pda-sessions').value) || 0;
        const cb = row.querySelector('.skip-fechas-cb');
        const isSkipped = cb && cb.checked;

        if (pdaSessions > 0) {
            if (currentSessionIndex < sessionsList.length) {
                const startDate = sessionsList[currentSessionIndex].date;
                let endDateIndex = currentSessionIndex + pdaSessions - 1;

                if (endDateIndex >= sessionsList.length) {
                    endDateIndex = sessionsList.length - 1;
                    hasError = true;
                }

                const endDate = sessionsList[endDateIndex].date;

                if (!isSkipped) {
                    row.querySelector('.pda-start-date').value = formatForInput(startDate);
                    row.querySelector('.pda-end-date').value = formatForInput(endDate);
                    if (cb) cb.checked = true;
                }

                currentSessionIndex += pdaSessions;
            } else {
                if (!isSkipped) {
                    row.querySelector('.pda-start-date').value = '';
                    row.querySelector('.pda-end-date').value = '';
                }
            }
        } else {
            if (!isSkipped) {
                row.querySelector('.pda-start-date').value = '';
                row.querySelector('.pda-end-date').value = '';
            }
        }
    });

    if (hasError) {
        showToast('Atención: Algunas sesiones superan las fechas disponibles en el ciclo.', 'warning');
    } else {
        showToast('Fechas calculadas exitosamente.', 'success');
    }

    markAsUnsaved('planner-btn-save');
}

let aiCountdownInterval = null;

function startAICountdown() {
    const banner = document.getElementById('ai-countdown-banner');
    const timerSpan = document.getElementById('ai-countdown-timer');
    if (!banner) return;

    if (aiCountdownInterval) {
        clearInterval(aiCountdownInterval);
    }

    const aiButtons = [
        document.getElementById('planner-btn-ai-temas'),
        document.getElementById('planner-btn-ai-verbo'),
        document.getElementById('planner-btn-ai-rango'),
        document.getElementById('planner-btn-calc-sessions'),
        document.getElementById('planner-btn-ai-bulk')
    ];

    aiButtons.forEach(btn => { if (btn) btn.disabled = true; });

    let timeLeft = 30;
    timerSpan.innerText = timeLeft;
    banner.style.display = 'block';

    aiCountdownInterval = setInterval(() => {
        timeLeft--;
        timerSpan.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(aiCountdownInterval);
            aiCountdownInterval = null;
            banner.style.display = 'none';
            aiButtons.forEach(btn => { if (btn) btn.disabled = false; });
        }
    }, 1000);
}

async function runGeminiBulkPrompt(promptTemplateFn, buttonId, buttonOriginalText, updateRowFn, skipCheckFn = null) {
    if (!activePlaneacionId) return;
    const apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey === "AQUI_VA_TU_CLAVE") {
        showToast('Error: Debes colocar tu API Key válida.', 'error');
        return;
    }

    const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
    if (!plans.length) return;
    const plan = plans[0];

    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Generando...";
    }

    const rows = Array.from(document.querySelectorAll('#planner-tbody tr'));
    if (!rows.length) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = buttonOriginalText;
        }
        return;
    }

    const totalSessions = parseInt(document.getElementById('summary-total-sessions').innerText) || 190;

    try {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const pdaTopic = row.querySelector('.pda-topic').value;
            const pdaContenido = row.querySelector('.pda-contenido').value;
            if (!pdaTopic) continue;

            if (skipCheckFn && skipCheckFn(row)) continue;

            const promptText = promptTemplateFn(plan, pdaTopic, pdaContenido, rows.length, totalSessions);

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });

            if (!response.ok) continue;

            const result = await response.json();
            const content = result.candidates[0].content.parts[0].text;

            try {
                const data = JSON.parse(content);
                updateRowFn(row, data);
            } catch (e) {
                console.error("Error parsing JSON for row", i, content);
            }
        }

        showToast('Proceso de IA completado.', 'success');
        fitCompactColumns();
        markAsUnsaved('planner-btn-save');
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = buttonOriginalText;
        }
        startAICountdown();
    }
}

function generateTemasAI() {
    runGeminiBulkPrompt(
        (plan, pda, contenido) => {
            const template = getAIInstruction('btn_temas');
            return template
                .replace(/{disciplina}/g, plan.disciplina || '')
                .replace(/{contenido}/g, contenido || '')
                .replace(/{pda}/g, pda || '');
        },
        'planner-btn-ai-temas',
        '🤖 Temas a Atender',
        (row, data) => {
            if (data.temas) {
                row.querySelector('.pda-temas').value = data.temas;
                const cb = row.querySelector('.skip-temas-cb');
                if (cb) cb.checked = true;
            }
        },
        (row) => {
            const cb = row.querySelector('.skip-temas-cb');
            return cb && cb.checked;
        }
    );
}

function generateVerboAI() {
    runGeminiBulkPrompt(
        (plan, pda) => {
            const template = getAIInstruction('btn_verbo');
            return template
                .replace(/{pda}/g, pda || '');
        },
        'planner-btn-ai-verbo',
        '🤖 Verbo Rector',
        (row, data) => {
            if (data.verbo) row.querySelector('.pda-verb').value = data.verbo;
            if (data.complejidad) row.querySelector('.pda-complejidad').value = data.complejidad;
            const cb = row.querySelector('.skip-verbo-cb');
            if (cb) cb.checked = true;
        },
        (row) => {
            const cb = row.querySelector('.skip-verbo-cb');
            return cb && cb.checked;
        }
    );
}

function generateRangoAI() {
    runGeminiBulkPrompt(
        (plan, pda, contenido, totalPdas, totalSessions) => {
            const template = getAIInstruction('btn_rango');
            return template
                .replace(/{pda}/g, pda || '')
                .replace(/{totalSessions}/g, totalSessions || '')
                .replace(/{totalPdas}/g, totalPdas || '');
        },
        'planner-btn-ai-rango',
        '🤖 Rango Sugerido',
        (row, data) => {
            if (data.rango) row.querySelector('.pda-rango').value = data.rango;
            const cb = row.querySelector('.skip-rango-cb');
            if (cb) cb.checked = true;
        },
        (row) => {
            const cb = row.querySelector('.skip-rango-cb');
            return cb && cb.checked;
        }
    );
}

function clearPlannerColumn(colName) {
    if (!confirm('¿Seguro que deseas limpiar todos los datos y desmarcar las casillas de esta columna?')) return;

    const rows = document.querySelectorAll('#planner-tbody tr');
    let hasChanges = false;

    rows.forEach(row => {
        if (colName === 'temas') {
            const input = row.querySelector('.pda-temas');
            const cb = row.querySelector('.skip-temas-cb');
            if (input) input.value = '';
            if (cb) cb.checked = false;
            hasChanges = true;
        } else if (colName === 'sesiones') {
            const input = row.querySelector('.pda-sessions');
            const cb = row.querySelector('.skip-sesiones-cb');
            if (input) input.value = '0';
            if (cb) cb.checked = false;
            hasChanges = true;
        } else if (colName === 'verbo') {
            const input = row.querySelector('.pda-verb');
            const cb = row.querySelector('.skip-verbo-cb');
            if (input) input.value = '';
            if (cb) cb.checked = false;
            hasChanges = true;
        } else if (colName === 'complejidad') {
            const input = row.querySelector('.pda-complejidad');
            if (input) input.value = '';
            hasChanges = true;
        } else if (colName === 'rango') {
            const input = row.querySelector('.pda-rango');
            const cb = row.querySelector('.skip-rango-cb');
            if (input) input.value = '';
            if (cb) cb.checked = false;
            hasChanges = true;
        } else if (colName === 'fechas') {
            const startInput = row.querySelector('.pda-start-date');
            const endInput = row.querySelector('.pda-end-date');
            const cb = row.querySelector('.skip-fechas-cb');
            if (startInput) startInput.value = '';
            if (endInput) endInput.value = '';
            if (cb) cb.checked = false;
            hasChanges = true;
        } else if (colName === 'accion') {
            const input = row.querySelector('.pda-detalles-input');
            const docxInput = row.querySelector('.pda-docx-input');
            const cb = row.querySelector('.skip-planeacion-cb');
            const docxCb = row.querySelector('.has-docx-cb');
            const btn = row.querySelector('.pda-detail-btn');
            const clearPlanBtn = row.querySelector('.pda-clear-plan-btn');
            const clearDocxBtn = row.querySelector('.pda-clear-docx-btn');
            const downloadBtn = row.querySelector('.pda-download-btn');
            if (input) input.value = '{}';
            if (docxInput) docxInput.value = '';
            if (cb) cb.checked = false;
            if (docxCb) docxCb.checked = false;
            if (btn) {
                btn.className = 'btn btn-secondary btn-sm pda-detail-btn';
                btn.innerText = '📝 PDA';
            }
            if (clearPlanBtn) clearPlanBtn.disabled = true;
            if (clearDocxBtn) clearDocxBtn.disabled = true;
            if (downloadBtn) {
                downloadBtn.style.opacity = '0.4';
                downloadBtn.style.pointerEvents = 'none';
            }
            hasChanges = true;
        }
    });

    if (hasChanges) {
        if (colName === 'sesiones') {
            const totalSessions = parseInt(document.getElementById('summary-total-sessions').innerText) || 0;
            updateSessionsBalance(totalSessions);
        }
        markAsUnsaved('planner-btn-save');
        showToast('Columna limpiada exitosamente.', 'success');
    }
}

function initTableResizers() {
    const table = document.getElementById('planner-table');
    if (!table) return;
    const ths = table.querySelectorAll('thead th');
    
    ths.forEach((th, index) => {
        if (th.querySelector('.table-resizer')) return;
        
        const resizer = document.createElement('div');
        resizer.classList.add('table-resizer');
        th.appendChild(resizer);
        th.style.position = 'sticky'; 

        let startX, startWidth;
        const col = table.querySelectorAll('colgroup col')[index];

        resizer.addEventListener('mousedown', function(e) {
            e.preventDefault();
            startX = e.pageX;
            startWidth = th.offsetWidth;
            resizer.classList.add('resizing');
            
            function onMouseMove(e) {
                const newWidth = startWidth + (e.pageX - startX);
                if (newWidth > 30) {
                    th.style.width = `${newWidth}px`;
                    if (col) {
                        col.style.width = `${newWidth}px`;
                    }
                }
            }
            
            function onMouseUp(e) {
                resizer.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                isTableManuallyResized = true;
                markAsUnsaved('planner-btn-save');
            }
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}
