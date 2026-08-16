'use strict';

/**
 * js/cronograma.js
 * Visualización del cronograma escolar y de las tablas de dosificación de las materias con fechas asignadas.
 */

function populateCronoPlanSelect(preferredPlanId = null) {
    const select = document.getElementById('crono-plan-select');
    if (!select) return;

    const plans = dbQuery(`
        SELECT p.*, c.name as cycle_name 
        FROM planeaciones p 
        JOIN school_cycles c ON p.cycle_id = c.id 
        ORDER BY p.id DESC
    `);

    select.innerHTML = '';
    if (!plans.length) {
        select.innerHTML = '<option value="">No hay planeaciones creadas</option>';
        return;
    }

    let firstWithDates = null;
    let optionsHtml = '';

    plans.forEach(p => {
        const countQuery = dbQuery(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN start_date != '' AND end_date != '' THEN 1 ELSE 0 END) as with_dates
            FROM planeacion_pdas 
            WHERE planeacion_id = ?
        `, [p.id])[0] || { total: 0, with_dates: 0 };

        const withDates = countQuery.with_dates || 0;
        const total = countQuery.total || 0;
        const hasDates = withDates > 0;

        if (hasDates && !firstWithDates) {
            firstWithDates = p.id;
        }

        const badgeText = hasDates ? `✅ (${withDates}/${total} PDAs con fechas)` : `⚠️ (Sin fechas calculadas)`;
        optionsHtml += `<option value="${p.id}">${p.disciplina} ${p.grado}º Grado (${p.cycle_name}) — ${badgeText}</option>`;
    });

    select.innerHTML = optionsHtml;

    if (preferredPlanId && plans.some(p => p.id == preferredPlanId)) {
        select.value = preferredPlanId;
    } else if (firstWithDates) {
        select.value = firstWithDates;
    } else if (plans.length > 0) {
        select.value = plans[0].id;
    }
}

function onCronoPlanSelectChange(planId) {
    if (!planId) return;
    renderCronogramaEscolar(parseInt(planId));
}

function renderCronogramaEscolar(selectedPlanId = null) {
    const container = document.getElementById('cronograma-wrapper');
    if (!container) return;

    try {
        const select = document.getElementById('crono-plan-select');
        let planId = selectedPlanId || (select ? parseInt(select.value) : null);

        if (!planId) {
            populateCronoPlanSelect();
            if (select && select.value) {
                planId = parseInt(select.value);
            }
        }

        if (!planId) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-gray-600);">
                    <h3>📚 No hay planeaciones registradas</h3>
                    <p>Ve a la pestaña <strong>Planeaciones</strong> y crea una planeación para visualizar su cronograma de dosificación.</p>
                </div>
            `;
            return;
        }

        const plans = dbQuery("SELECT p.*, c.name as cycle_name, c.start_date as cycle_start, c.end_date as cycle_end, c.holidays FROM planeaciones p JOIN school_cycles c ON p.cycle_id = c.id WHERE p.id = ?", [planId]);
        if (!plans.length) {
            container.innerHTML = `<div class="alert alert-error">Planeación no encontrada.</div>`;
            return;
        }

        const plan = plans[0];
        const pdas = dbQuery("SELECT * FROM planeacion_pdas WHERE planeacion_id = ? ORDER BY pda_number ASC", [planId]);
        
        const pdasWithDates = pdas.filter(p => p.start_date && p.end_date && p.start_date.trim() !== '' && p.end_date.trim() !== '');
        const hasDates = pdasWithDates.length > 0;

        // Horario semanal
        const sched = JSON.parse(plan.schedule || '{}');
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
        const schedParts = [];
        for (let d = 1; d <= 5; d++) {
            if (sched[d] > 0) schedParts.push(`${days[d - 1]}: ${sched[d]}h`);
        }
        const schedStr = schedParts.join(', ') || 'Sin horario';

        // Renderizar Calendario Trimestral de Días Hábiles del Ciclo
        const rawHolidays = JSON.parse(plan.holidays || '{}');
        const holidaysMap = {};
        
        // Mapear todas las variantes de formato de fecha (DD-MM-YYYY, YYYY-MM-DD, con/sin ceros)
        for (const [k, v] of Object.entries(rawHolidays)) {
            if (!k || !v) continue;
            const cleanKey = k.trim();
            holidaysMap[cleanKey] = v;
            
            if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanKey)) {
                const [d, m, y] = cleanKey.split('-');
                const dPad = String(parseInt(d)).padStart(2, '0');
                const mPad = String(parseInt(m)).padStart(2, '0');
                holidaysMap[`${dPad}-${mPad}-${y}`] = v;
                holidaysMap[`${y}-${mPad}-${dPad}`] = v;
                holidaysMap[`${parseInt(d)}-${parseInt(m)}-${y}`] = v;
            } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanKey)) {
                const [y, m, d] = cleanKey.split('-');
                const dPad = String(parseInt(d)).padStart(2, '0');
                const mPad = String(parseInt(m)).padStart(2, '0');
                holidaysMap[`${y}-${mPad}-${dPad}`] = v;
                holidaysMap[`${dPad}-${mPad}-${y}`] = v;
                holidaysMap[`${parseInt(d)}-${parseInt(m)}-${y}`] = v;
            }
        }

        // Análisis integral de cobertura y colisiones de cada PDA
        const pdaAnalysisMap = analyzePdasScheduleCoverage(pdas, sched, holidaysMap);
        const dailyPdaSessionsMap = buildPdaDailySessionMap(pdas, sched, holidaysMap, pdaAnalysisMap);

        let okCount = 0;
        let warningCount = 0;
        Object.values(pdaAnalysisMap).forEach(a => {
            if (a.status === 'ok') okCount++;
            else if (a.status !== 'no_dates') warningCount++;
        });

        // Rango de fechas
        let fechaInicioMateria = pdasWithDates[0]?.start_date || 'Sin fecha';
        let fechaFinMateria = pdasWithDates[pdasWithDates.length - 1]?.end_date || 'Sin fecha';

        let html = `
            <!-- Tarjeta de Resumen de la Materia -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-lg); padding: 18px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <h3 style="margin: 0; color: #0f172a;">${htmlspecialchars(plan.disciplina)} — ${plan.grado}º Grado</h3>
                        <span class="badge badge-primary">${htmlspecialchars(plan.cycle_name)}</span>
                        <span class="badge badge-warning">${schedStr}</span>
                    </div>
                    <p style="margin: 0; font-size: 0.88rem; color: #475569;">
                        📅 <strong>Periodo:</strong> ${fechaInicioMateria} al ${fechaFinMateria} &nbsp;|&nbsp; 
                        ⏱️ <strong>Sesiones:</strong> ${pdas.reduce((acc, x) => acc + (x.sessions_count || 0), 0)} hs &nbsp;|&nbsp; 
                        📋 <strong>PDAs con Fechas:</strong> ${pdasWithDates.length} de ${pdas.length} &nbsp;|&nbsp;
                        <span style="color: #166534; font-weight: 700;">✅ ${okCount} cubiertos</span> &nbsp;|&nbsp;
                        ${warningCount > 0 ? `<span style="color: #dc2626; font-weight: 700;">⚠️ ${warningCount} con inconsistencias</span>` : `<span style="color: #166534;">Todo en orden</span>`}
                    </p>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-success btn-sm" onclick="exportCronogramaExcel(${plan.id})">📊 Exportar a Excel</button>
                    <button class="btn btn-primary btn-sm" onclick="openPlannerFromCrono(${plan.id})">⚡ Abrir en Planificador</button>
                </div>
            </div>
        `;

        // Obtener el año inicial del ciclo escolar de forma robusta
        let startYear = 2026;
        if (plan.cycle_start) {
            const rawStart = plan.cycle_start.trim();
            if (rawStart.includes('-')) {
                const parts = rawStart.split('-');
                if (parts[0].length === 4) {
                    startYear = parseInt(parts[0]);
                } else if (parts[2] && parts[2].length === 4) {
                    startYear = parseInt(parts[2]);
                }
            }
        }

        const trimesters = [
            { name: "TRIMESTRE 1", months: [ {name: "AGOSTO", m: 7}, {name: "SEPTIEMBRE", m: 8}, {name: "OCTUBRE", m: 9}, {name: "NOVIEMBRE", m: 10} ] },
            { name: "TRIMESTRE 2", months: [ {name: "DICIEMBRE", m: 11}, {name: "ENERO", m: 0}, {name: "FEBRERO", m: 1}, {name: "MARZO", m: 2} ] },
            { name: "TRIMESTRE 3", months: [ {name: "ABRIL", m: 3}, {name: "MAYO", m: 4}, {name: "JUNIO", m: 5}, {name: "JULIO", m: 6} ] }
        ];

        const activeLegends = (typeof getCronoLegends === 'function') ? getCronoLegends() : DEFAULT_CRONO_LEGENDS;

        html += `
            <div>
                <h3 style="margin-bottom: 12px; color: #1e293b;">🗓️ Calendario Escolar y Días Inhábiles (${htmlspecialchars(plan.cycle_name)})</h3>
                <div class="crono-legend" style="margin-bottom: 16px;">
                    <span class="crono-legend-title">Leyenda del Cronograma:</span>
                    ${activeLegends.map(leg => {
                        return `<div class="crono-legend-item"><div class="crono-legend-color" style="background: ${leg.color}; border-color: ${leg.color};"></div><span>${leg.icon} ${htmlspecialchars(leg.name)}</span></div>`;
                    }).join('')}
                    <div class="crono-legend-item" style="border-left: 2px solid #e2e8f0; padding-left: 8px;"><span class="crono-legend-title">Estado PDAs:</span></div>
                    <div class="crono-legend-item"><span style="color: #166534; font-weight: 700;">✅ Sesiones Cubiertas</span></div>
                    <div class="crono-legend-item"><span style="color: #d97706; font-weight: 700;">⚠️ Sesiones Faltantes/Excedidas</span></div>
                    <div class="crono-legend-item"><span style="color: #dc2626; font-weight: 700;">⚠️ Choca con Inhábil / Error Fechas</span></div>
                </div>

                <div class="crono-tabs-header">
                    ${trimesters.map((t, i) => `<button class="crono-tab-btn ${i===0?'active':''}" onclick="switchCronoTab(${i}, this)">${t.name}</button>`).join('')}
                </div>
                
                <div class="crono-trimesters-container">
        `;

        trimesters.forEach((t, tIndex) => {
            html += `<div id="crono-trim-${tIndex}" class="crono-trimester-content ${tIndex===0?'active':''}">`;
            
            t.months.forEach(monthObj => {
                const year = monthObj.m >= 7 ? startYear : startYear + 1;
                const daysInMonth = new Date(year, monthObj.m + 1, 0).getDate();
                const weekdays = [];
                for(let d=1; d<=daysInMonth; d++) {
                    const date = new Date(year, monthObj.m, d);
                    const wd = date.getDay();
                    if(wd >= 1 && wd <= 5) {
                        const dateStrIso = `${year}-${String(monthObj.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const dateStrDmy = `${String(d).padStart(2,'0')}-${String(monthObj.m+1).padStart(2,'0')}-${year}`;
                        const event = holidaysMap[dateStrIso] || holidaysMap[dateStrDmy] || null;

                        weekdays.push({ 
                            day: d, 
                            letter: ['D','L','M','M','J','V','S'][wd],
                            wdNum: wd,
                            dateStr: dateStrIso,
                            dateStrDmy: dateStrDmy,
                            dateObj: date,
                            event: event
                        });
                    }
                }
                
                html += `
                    <div class="crono-month-card">
                        <div class="crono-month-header" style="display:flex; justify-content:space-between; align-items:center;">
                            <span>📅 ${monthObj.name} ${year}</span>
                            <span style="font-size:0.75rem; font-weight:normal; color:#64748b;">${weekdays.length} días de semana hábiles en el mes</span>
                        </div>
                        <div class="crono-table-wrapper">
                            <table class="crono-table">
                                <tr>
                                    <th>MES</th>
                                    ${weekdays.map(wd => {
                                        const cat = (typeof getHolidayCategoryInfo === 'function') ? getHolidayCategoryInfo(wd.event) : null;
                                        const thStyle = (wd.event && cat) ? `background: ${cat.headerBg}; color: ${cat.headerColor}; font-weight: 700;` : '';
                                        return `<th style="${thStyle}" title="${wd.event ? htmlspecialchars(wd.event) : ''}">${wd.letter}</th>`;
                                    }).join('')}
                                </tr>
                                <tr>
                                    <th>${monthObj.name} ${year}</th>
                                    ${weekdays.map(wd => {
                                        const cat = (typeof getHolidayCategoryInfo === 'function') ? getHolidayCategoryInfo(wd.event) : null;
                                        const thStyle = (wd.event && cat) ? `background: ${cat.headerBg}; color: ${cat.headerColor}; font-weight: 800;` : '';
                                        return `<th style="${thStyle}" title="${wd.event ? htmlspecialchars(wd.event) : ''}">${wd.day}</th>`;
                                    }).join('')}
                                </tr>
                                <tr>
                                    <th>ACTIVIDADES Y SEGUIMIENTO</th>
                                    ${generateEventsRowHtml(weekdays)}
                                </tr>
                                <tr>
                                    <th>SESIONES DE CLASE (HORARIO)</th>
                                    ${generateSessionsRowHtml(weekdays, sched, holidaysMap, dailyPdaSessionsMap)}
                                </tr>
                                <tr>
                                    <th>PROCESOS DE DESARROLLO (PDAs)</th>
                                    ${generatePdasRowHtml(weekdays, pdas, pdaAnalysisMap)}
                                </tr>
                            </table>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        });
        
        html += `</div></div>`;
        container.innerHTML = html;
        
    } catch(e) {
        container.innerHTML = `<div class="alert alert-error">Error al renderizar cronograma: ${e.message}</div>`;
        console.error(e);
    }
}

function parseRobustDate(str) {
    if (!str) return null;
    str = String(str).trim();
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

function buildPdaDailySessionMap(pdas, sched, holidaysMap, pdaAnalysisMap) {
    const dailyMap = {};

    pdas.forEach(pda => {
        const pdaNum = pda.pda_number;
        const reqSessions = parseInt(pda.sessions_count) || 0;
        const startStr = (pda.start_date || '').trim();
        const endStr = (pda.end_date || '').trim();

        if (!startStr || !endStr) return;

        const startD = parseRobustDate(startStr);
        const endD = parseRobustDate(endStr);
        if (!startD || !endD || startD > endD) return;

        const analysis = pdaAnalysisMap ? pdaAnalysisMap[pdaNum] : null;

        let sessionCounter = 0;
        let curr = new Date(startD);

        while (curr <= endD) {
            const wd = curr.getDay(); // 0..6
            if (wd >= 1 && wd <= 5) {
                const dateStrIso = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
                const dateStrDmy = `${String(curr.getDate()).padStart(2, '0')}-${String(curr.getMonth() + 1).padStart(2, '0')}-${curr.getFullYear()}`;
                const event = holidaysMap[dateStrIso] || holidaysMap[dateStrDmy] || null;

                const isInhabile = event && (typeof isDateInhabile === 'function' ? isDateInhabile(dateStrDmy, holidaysMap) : true);

                if (!isInhabile) {
                    const dayHours = sched[wd] || 0;
                    if (dayHours > 0) {
                        let sessionLabel = '';
                        if (dayHours === 1) {
                            sessionCounter += 1;
                            sessionLabel = `S${sessionCounter}/${reqSessions}`;
                        } else {
                            const sStart = sessionCounter + 1;
                            const sEnd = sessionCounter + dayHours;
                            sessionCounter += dayHours;
                            sessionLabel = `S${sStart}-${sEnd}/${reqSessions}`;
                        }

                        let badgeClass = 'badge-session-tag';
                        if (analysis) {
                            if (analysis.status === 'collision' || analysis.status === 'invalid_range') {
                                badgeClass = 'badge-session-tag badge-session-tag-danger';
                            } else if (analysis.status === 'under' || analysis.status === 'over') {
                                badgeClass = 'badge-session-tag badge-session-tag-warn';
                            }
                        }

                        const sessionInfo = {
                            pdaNum,
                            pda,
                            sessionLabel,
                            fullTag: `PDA ${pdaNum} ${sessionLabel}`,
                            hours: dayHours,
                            badgeClass,
                            analysis
                        };

                        dailyMap[dateStrIso] = sessionInfo;
                        dailyMap[dateStrDmy] = sessionInfo;
                    }
                }
            }
            curr.setDate(curr.getDate() + 1);
        }
    });

    return dailyMap;
}

function analyzePdasScheduleCoverage(pdas, sched, holidaysMap) {
    const analysisMap = {};

    pdas.forEach(pda => {
        const pdaNum = pda.pda_number;
        const reqSessions = parseInt(pda.sessions_count) || 0;
        const startStr = (pda.start_date || '').trim();
        const endStr = (pda.end_date || '').trim();

        if (!startStr || !endStr) {
            analysisMap[pdaNum] = {
                pda,
                status: 'no_dates',
                badgeClass: 'badge-secondary',
                icon: '⚪',
                reqSessions,
                actualSessions: 0,
                hasCollision: false,
                inhabilesInside: [],
                message: 'Sin fechas asignadas en el planificador'
            };
            return;
        }

        const startD = parseRobustDate(startStr);
        const endD = parseRobustDate(endStr);

        if (!startD || !endD || startD > endD) {
            analysisMap[pdaNum] = {
                pda,
                status: 'invalid_range',
                badgeClass: 'badge-danger',
                icon: '⚠️',
                reqSessions,
                actualSessions: 0,
                hasCollision: true,
                inhabilesInside: ['Fecha de inicio posterior a fecha fin'],
                message: '⚠️ Fechas mal asignadas: La fecha de inicio es posterior a la de fin.'
            };
            return;
        }

        let actualSessions = 0;
        const inhabilesInside = [];
        let curr = new Date(startD);

        while (curr <= endD) {
            const wd = curr.getDay(); // 0..6
            if (wd >= 1 && wd <= 5) {
                const dateStrIso = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
                const dateStrDmy = `${String(curr.getDate()).padStart(2, '0')}-${String(curr.getMonth() + 1).padStart(2, '0')}-${curr.getFullYear()}`;
                const event = holidaysMap[dateStrIso] || holidaysMap[dateStrDmy] || null;

                const isInhabile = event && (typeof isDateInhabile === 'function' ? isDateInhabile(dateStrDmy, holidaysMap) : true);

                if (isInhabile) {
                    inhabilesInside.push(`${dateStrDmy} (${event})`);
                } else {
                    const dayHours = sched[wd] || 0;
                    actualSessions += dayHours;
                }
            }
            curr.setDate(curr.getDate() + 1);
        }

        let status = 'ok';
        let icon = '✅';
        let message = `Sesiones cubiertas exactamente (${actualSessions} de ${reqSessions} sesiones).`;
        let badgeClass = 'badge-success';

        // Regla: Si las sesiones se cubren exactamente sin considerar el día inhábil intermedio, el periodo es correcto
        if (actualSessions === reqSessions) {
            status = 'ok';
            icon = '✅';
            badgeClass = 'badge-success';
            if (inhabilesInside.length > 0) {
                message = `✅ Periodo correcto: ${actualSessions} de ${reqSessions} sesiones cubiertas. (Incluye ${inhabilesInside.length} día(s) inhábil(es) intermedio(s) omitido(s): ${inhabilesInside.slice(0, 2).join(', ')}).`;
            } else {
                message = `✅ Periodo correcto: ${actualSessions} de ${reqSessions} sesiones cubiertas.`;
            }
        } else if (actualSessions < reqSessions) {
            status = 'under';
            icon = '⚠️';
            badgeClass = 'badge-warning';
            message = `⚠️ Sesiones no cubiertas: Se requieren ${reqSessions} sesiones pero solo se imparten ${actualSessions} en el periodo ${startStr} al ${endStr}. Revisa si se están considerando días inhábiles o diagnósticos que restan días de clase.`;
        } else {
            status = 'over';
            icon = '⚠️';
            badgeClass = 'badge-warning';
            message = `⚠️ Exceso de sesiones: Se requieren ${reqSessions} sesiones pero en el periodo ${startStr} al ${endStr} se imparten ${actualSessions}.`;
        }

        analysisMap[pdaNum] = {
            pda,
            status,
            icon,
            badgeClass,
            reqSessions,
            actualSessions,
            inhabilesInside,
            hasCollision: status !== 'ok',
            message
        };
    });

    return analysisMap;
}

function generateSessionsRowHtml(weekdays, sched, holidaysMap, dailyPdaSessionsMap = {}) {
    return weekdays.map(wd => {
        const dateStr = wd.dateStrDmy;
        const dateStrIso = wd.dateStr;
        const isInhabile = wd.event && (typeof isDateInhabile === 'function' ? isDateInhabile(dateStr, holidaysMap) : true);

        if (isInhabile) {
            return `<td class="crono-cell-session" style="background: rgba(239, 68, 68, 0.12); color: #dc2626; font-weight: 700;" title="Día Inhábil (${wd.event || ''}): 0 sesiones de clase">${wd.event ? '🔴 0h' : '0h'}</td>`;
        }

        const pdaSession = dailyPdaSessionsMap[dateStrIso] || dailyPdaSessionsMap[dateStr];
        if (pdaSession) {
            const tip = `${pdaSession.fullTag}\n${pdaSession.pda.topic}\nHorario de clase: ${pdaSession.hours} hora(s)\n${pdaSession.analysis ? pdaSession.analysis.message : ''}`;
            return `<td class="crono-cell-session" style="padding: 4px 2px;" title="${htmlspecialchars(tip)}"><span class="${pdaSession.badgeClass}">${htmlspecialchars(pdaSession.fullTag)}</span></td>`;
        }

        const hours = sched[wd.wdNum] || 0;
        if (hours > 0) {
            return `<td class="crono-cell-session" style="background: rgba(59, 130, 246, 0.08); color: #0284c7; font-weight: 700;" title="Horario: ${hours} sesión(es) (Sin PDA en esta fecha)">${hours}h</td>`;
        }

        return `<td class="crono-cell-session" style="color: #94a3b8; font-size: 10px;" title="Sin clases este día">-</td>`;
    }).join('');
}

function generatePdasRowHtml(weekdays, pdas, pdaAnalysisMap) {
    let html = '';
    let currentPdaNum = null;
    let colspan = 0;

    const findActivePdaForDay = (dateObj) => {
        const dTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
        for (const pda of pdas) {
            if (!pda.start_date || !pda.end_date) continue;
            const startD = parseRobustDate(pda.start_date);
            const endD = parseRobustDate(pda.end_date);
            if (!startD || !endD) continue;
            const sTime = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime();
            const eTime = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate()).getTime();
            if (dTime >= sTime && dTime <= eTime) {
                return pda;
            }
        }
        return null;
    };

    const flushPda = () => {
        if (colspan > 0) {
            if (currentPdaNum) {
                const analysis = pdaAnalysisMap[currentPdaNum];
                const pda = analysis ? analysis.pda : pdas.find(p => p.pda_number === currentPdaNum);
                
                let cellStyle = 'background: rgba(16, 185, 129, 0.16); color: #065f46; border: 1px solid #10b981; font-weight: 700;';
                let tagText = `✅ PDA ${currentPdaNum} (${analysis ? analysis.actualSessions : pda.sessions_count}/${pda.sessions_count} ses)`;

                if (analysis) {
                    if (analysis.status === 'collision' || analysis.status === 'invalid_range') {
                        cellStyle = 'background: rgba(239, 68, 68, 0.2); color: #991b1b; border: 1px solid #ef4444; font-weight: 700;';
                        tagText = `⚠️ PDA ${currentPdaNum} (${analysis.actualSessions}/${analysis.reqSessions} ses — Error)`;
                    } else if (analysis.status === 'under' || analysis.status === 'over') {
                        cellStyle = 'background: rgba(245, 158, 11, 0.2); color: #92400e; border: 1px solid #f59e0b; font-weight: 700;';
                        tagText = `⚠️ PDA ${currentPdaNum} (${analysis.actualSessions}/${analysis.reqSessions} ses)`;
                    }
                }

                const tooltip = `PDA ${currentPdaNum}: ${pda.topic}\nFechas asignadas: ${pda.start_date} al ${pda.end_date}\n${analysis ? analysis.message : ''}`;

                html += `<td colspan="${colspan}" class="crono-cell-pda" style="${cellStyle}" title="${htmlspecialchars(tooltip)}">${htmlspecialchars(tagText)}</td>`;
            } else {
                html += `<td colspan="${colspan}" style="background: var(--bg-white);"></td>`;
            }
        }
    };

    weekdays.forEach(wd => {
        const activePda = findActivePdaForDay(wd.dateObj);
        const pdaNum = activePda ? activePda.pda_number : null;

        if (pdaNum !== currentPdaNum) {
            flushPda();
            currentPdaNum = pdaNum;
            colspan = 1;
        } else {
            colspan++;
        }
    });
    flushPda();

    return html;
}

function openPlannerFromCrono(planId) {
    if (typeof loadPlanification === 'function') {
        loadPlanification(planId);
    }
    if (typeof switchTab === 'function') {
        switchTab('tab-dosificar');
    }
}

function switchCronoTab(index, btn) {
    document.querySelectorAll('.crono-tabs-header .crono-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.crono-trimester-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(`crono-trim-${index}`);
    if (target) target.classList.add('active');
}

function generateEventsRowHtml(weekdays) {
    let html = '';
    let currentEvent = null;
    let colspan = 0;
    
    const flushEvent = () => {
        if (colspan > 0) {
            if (currentEvent) {
                const cat = (typeof getHolidayCategoryInfo === 'function') ? getHolidayCategoryInfo(currentEvent) : { icon: '🔴', cellStyle: 'background: rgba(239, 68, 68, 0.2);' };
                html += `<td colspan="${colspan}" class="crono-cell-event" style="${cat.cellStyle}" title="${htmlspecialchars(currentEvent)}">${cat.icon} ${htmlspecialchars(currentEvent)}</td>`;
            } else {
                html += `<td colspan="${colspan}"></td>`;
            }
        }
    };
    
    weekdays.forEach(wd => {
        if (wd.event !== currentEvent) {
            flushEvent();
            currentEvent = wd.event;
            colspan = 1;
        } else {
            colspan++;
        }
    });
    flushEvent();
    
    return html;
}

/**
 * Exporta el Cronograma y Calendario Escolar completo a Excel con el diseño y colores institucionales.
 * Nombre del archivo: Cronograma_dosificacion_{MATERIA}_{GRADO}.xlsx
 */
async function exportCronogramaExcel(selectedPlanId = null) {
    try {
        const planId = selectedPlanId || document.getElementById('crono-plan-select')?.value;
        if (!planId) {
            showToast('Selecciona una planeación para exportar el cronograma.', 'warning');
            return;
        }

        if (typeof ExcelJS === 'undefined') {
            throw new Error('La librería ExcelJS no está cargada.');
        }

        showToast('Generando archivo Excel del Cronograma...', 'info');

        const plans = dbQuery(`
            SELECT p.*, c.name as cycle_name, c.start_date as cycle_start, c.total_days, c.period1_days, c.period2_days, c.period3_days, c.holidays 
            FROM planeaciones p 
            JOIN school_cycles c ON p.cycle_id = c.id 
            WHERE p.id = ?
        `, [planId]);

        if (!plans.length) throw new Error('Planeación no encontrada.');
        const plan = plans[0];
        const pdas = dbQuery("SELECT * FROM planeacion_pdas WHERE planeacion_id = ? ORDER BY pda_number ASC", [planId]);

        const hexToArgb = (hex, def = 'FF000000') => {
            if (!hex) return def;
            hex = String(hex).replace('#', '').trim();
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            return (hex.length === 6) ? 'FF' + hex.toUpperCase() : (hex.length === 8 ? hex.toUpperCase() : def);
        };

        const sched = JSON.parse(plan.schedule || '{}');
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
        const schedParts = [];
        for (let d = 1; d <= 5; d++) {
            if (sched[d] > 0) schedParts.push(`${days[d - 1]}: ${sched[d]}h`);
        }
        const schedStr = schedParts.join(', ') || 'Sin horario';

        const rawHolidays = JSON.parse(plan.holidays || '{}');
        const holidaysMap = {};
        for (const [k, v] of Object.entries(rawHolidays)) {
            if (!k || !v) continue;
            const cleanKey = k.trim();
            holidaysMap[cleanKey] = v;
            if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanKey)) {
                const [d, m, y] = cleanKey.split('-');
                const dPad = String(parseInt(d)).padStart(2, '0');
                const mPad = String(parseInt(m)).padStart(2, '0');
                holidaysMap[`${dPad}-${mPad}-${y}`] = v;
                holidaysMap[`${y}-${mPad}-${dPad}`] = v;
            } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanKey)) {
                const [y, m, d] = cleanKey.split('-');
                const dPad = String(parseInt(d)).padStart(2, '0');
                const mPad = String(parseInt(m)).padStart(2, '0');
                holidaysMap[`${y}-${mPad}-${dPad}`] = v;
                holidaysMap[`${dPad}-${mPad}-${y}`] = v;
            }
        }

        const pdaAnalysisMap = analyzePdasScheduleCoverage(pdas, sched, holidaysMap);
        const dailyPdaSessionsMap = buildPdaDailySessionMap(pdas, sched, holidaysMap, pdaAnalysisMap);

        const pdasWithDates = pdas.filter(p => (p.start_date || '').trim() !== '' && (p.end_date || '').trim() !== '');
        const fechaInicioMateria = pdasWithDates[0]?.start_date || 'Sin fecha';
        const fechaFinMateria = pdasWithDates[pdasWithDates.length - 1]?.end_date || 'Sin fecha';
        const totalSessions = pdas.reduce((acc, x) => acc + (parseInt(x.sessions_count) || 0), 0);

        let startYear = 2026;
        if (plan.cycle_start) {
            const parsed = parseRobustDate(plan.cycle_start);
            if (parsed) startYear = parsed.getFullYear();
        }

        const trimesters = [
            { name: "TRIMESTRE 1", subtitle: "AGOSTO - NOVIEMBRE", months: [ {name: "AGOSTO", m: 7}, {name: "SEPTIEMBRE", m: 8}, {name: "OCTUBRE", m: 9}, {name: "NOVIEMBRE", m: 10} ] },
            { name: "TRIMESTRE 2", subtitle: "DICIEMBRE - MARZO", months: [ {name: "DICIEMBRE", m: 11}, {name: "ENERO", m: 0}, {name: "FEBRERO", m: 1}, {name: "MARZO", m: 2} ] },
            { name: "TRIMESTRE 3", subtitle: "ABRIL - JULIO", months: [ {name: "ABRIL", m: 3}, {name: "MAYO", m: 4}, {name: "JUNIO", m: 5}, {name: "JULIO", m: 6} ] }
        ];

        const activeLegends = (typeof getCronoLegends === 'function') ? getCronoLegends() : DEFAULT_CRONO_LEGENDS;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Jokarhe Systems';
        workbook.lastModifiedBy = 'Jokarhe Systems';
        workbook.created = new Date();
        workbook.modified = new Date();

        const ws = workbook.addWorksheet('Cronograma Escolar');
        ws.views = [{ showGridLines: true }];

        ws.getColumn(1).width = 34;
        for (let c = 2; c <= 30; c++) {
            ws.getColumn(c).width = 13;
        }

        let currentRow = 2;

        // 1. TÍTULO PRINCIPAL
        ws.mergeCells(currentRow, 1, currentRow, 24);
        let titleCell = ws.getCell(currentRow, 1);
        titleCell.value = 'JOKARHE SYSTEMS — CRONOGRAMA Y CALENDARIO ESCOLAR NEM';
        titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A203E' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(currentRow).height = 28;
        currentRow++;

        // 2. METADATOS DE LA MATERIA
        ws.mergeCells(currentRow, 1, currentRow, 24);
        let subCell = ws.getCell(currentRow, 1);
        subCell.value = `${plan.disciplina.toUpperCase()} — ${plan.grado}º GRADO  |  ${plan.cycle_name.toUpperCase()}  |  HORARIO SEMANAL: ${schedStr.toUpperCase()}`;
        subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1178C2' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(currentRow).height = 24;
        currentRow++;

        // 3. RESUMEN DE SESIONES Y FECHAS
        ws.mergeCells(currentRow, 1, currentRow, 24);
        let metaCell = ws.getCell(currentRow, 1);
        metaCell.value = `PERIODO: ${fechaInicioMateria} AL ${fechaFinMateria}  |  TOTAL SESIONES: ${totalSessions}h  |  PDAS CON FECHA: ${pdasWithDates.length} DE ${pdas.length}`;
        metaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(currentRow).height = 20;
        currentRow += 2;

        // 4. SECCIÓN DE LEYENDA DEL CRONOGRAMA
        ws.getCell(currentRow, 1).value = 'LEYENDA DEL CRONOGRAMA:';
        ws.getCell(currentRow, 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0A203E' } };
        currentRow++;

        let legCol = 1;
        let legRow = currentRow;
        activeLegends.forEach((leg) => {
            const cell = ws.getCell(legRow, legCol);
            cell.value = `${leg.icon} ${leg.name}`;
            cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: hexToArgb(leg.color, 'FF0F172A') } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(leg.color + '25', 'FFF1F5F9') } };
            cell.border = {
                top: { style: 'thin', color: { argb: hexToArgb(leg.color, 'FF94A3B8') } },
                bottom: { style: 'thin', color: { argb: hexToArgb(leg.color, 'FF94A3B8') } },
                left: { style: 'thin', color: { argb: hexToArgb(leg.color, 'FF94A3B8') } },
                right: { style: 'thin', color: { argb: hexToArgb(leg.color, 'FF94A3B8') } }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            legCol++;
            if (legCol > 6) {
                legCol = 1;
                legRow++;
            }
        });
        currentRow = legRow + 2;

        // 5. RENDERIZAR CADA TRIMESTRE Y CADA MES
        trimesters.forEach((t) => {
            ws.mergeCells(currentRow, 1, currentRow, 24);
            const trimCell = ws.getCell(currentRow, 1);
            trimCell.value = `🔷 ${t.name} (${t.subtitle})`;
            trimCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            trimCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A203E' } };
            trimCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(currentRow).height = 24;
            currentRow += 2;

            t.months.forEach(monthObj => {
                const year = monthObj.m >= 7 ? startYear : startYear + 1;
                const daysInMonth = new Date(year, monthObj.m + 1, 0).getDate();
                const weekdays = [];

                for (let d = 1; d <= daysInMonth; d++) {
                    const date = new Date(year, monthObj.m, d);
                    const wd = date.getDay();
                    if (wd >= 1 && wd <= 5) {
                        const dateStrIso = `${year}-${String(monthObj.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const dateStrDmy = `${String(d).padStart(2,'0')}-${String(monthObj.m+1).padStart(2,'0')}-${year}`;
                        const event = holidaysMap[dateStrIso] || holidaysMap[dateStrDmy] || null;

                        weekdays.push({
                            day: d,
                            letter: ['D','L','M','M','J','V','S'][wd],
                            wdNum: wd,
                            dateStr: dateStrIso,
                            dateStrDmy: dateStrDmy,
                            dateObj: date,
                            event: event
                        });
                    }
                }

                const totalDaysCols = weekdays.length;
                if (totalDaysCols === 0) return;
                const maxColIdx = 1 + totalDaysCols;

                ws.mergeCells(currentRow, 1, currentRow, maxColIdx);
                const mHeaderCell = ws.getCell(currentRow, 1);
                mHeaderCell.value = `📅 ${monthObj.name} ${year}  (${totalDaysCols} Días Hábiles en el Mes)`;
                mHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                mHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1178C2' } };
                mHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                ws.getRow(currentRow).height = 22;
                currentRow++;

                // FILA 1: Días de la semana (L, M, M, J, V)
                const rowMes = ws.getRow(currentRow);
                rowMes.height = 22;
                rowMes.getCell(1).value = 'MES';
                rowMes.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0A203E' } };
                rowMes.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                rowMes.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                rowMes.getCell(1).border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };

                weekdays.forEach((wd, i) => {
                    const cell = rowMes.getCell(2 + i);
                    cell.value = wd.letter;
                    const cat = (typeof getHolidayCategoryInfo === 'function') ? getHolidayCategoryInfo(wd.event) : null;
                    if (wd.event && cat) {
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: hexToArgb(cat.color, 'FFFFFFFF') } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(cat.color + '33', 'FFFEE2E2') } };
                    } else {
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0A203E' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    }
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                });
                currentRow++;

                // FILA 2: Números de Día (1, 2, 3...)
                const rowNum = ws.getRow(currentRow);
                rowNum.height = 22;
                rowNum.getCell(1).value = `${monthObj.name} ${year}`;
                rowNum.getCell(1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0A203E' } };
                rowNum.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                rowNum.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                rowNum.getCell(1).border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };

                weekdays.forEach((wd, i) => {
                    const cell = rowNum.getCell(2 + i);
                    cell.value = wd.day;
                    const cat = (typeof getHolidayCategoryInfo === 'function') ? getHolidayCategoryInfo(wd.event) : null;
                    if (wd.event && cat) {
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: hexToArgb(cat.color, 'FFFFFFFF') } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(cat.color + '33', 'FFFEE2E2') } };
                    } else {
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                    }
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                });
                currentRow++;

                // FILA 3: ACTIVIDADES Y SEGUIMIENTO
                const rowEvent = ws.getRow(currentRow);
                rowEvent.height = 36;
                rowEvent.getCell(1).value = 'ACTIVIDADES Y SEGUIMIENTO';
                rowEvent.getCell(1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0A203E' } };
                rowEvent.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                rowEvent.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                rowEvent.getCell(1).border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };

                let curEvt = null;
                let evtStartCol = 2;
                const flushExcelEvent = (endCol) => {
                    if (curEvt) {
                        const cat = (typeof getHolidayCategoryInfo === 'function') ? getHolidayCategoryInfo(curEvt) : null;
                        const cell = rowEvent.getCell(evtStartCol);
                        cell.value = `${cat ? cat.icon + ' ' : ''}${curEvt}`;
                        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: cat ? hexToArgb(cat.color, 'FFB91C1C') : 'FFB91C1C' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cat ? hexToArgb(cat.color + '22', 'FFFEE2E2') : 'FFFEE2E2' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

                        if (endCol > evtStartCol) {
                            ws.mergeCells(currentRow, evtStartCol, currentRow, endCol);
                        }
                    } else {
                        for (let c = evtStartCol; c <= endCol; c++) {
                            const emptyCell = rowEvent.getCell(c);
                            emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                            emptyCell.border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                        }
                    }
                };

                weekdays.forEach((wd, i) => {
                    const colIdx = 2 + i;
                    if (wd.event !== curEvt) {
                        if (i > 0) flushExcelEvent(colIdx - 1);
                        curEvt = wd.event;
                        evtStartCol = colIdx;
                    }
                    rowEvent.getCell(colIdx).border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                });
                flushExcelEvent(1 + totalDaysCols);
                currentRow++;

                // FILA 4: SESIONES DE CLASE (HORARIO)
                const rowSess = ws.getRow(currentRow);
                rowSess.height = 26;
                rowSess.getCell(1).value = 'SESIONES DE CLASE (HORARIO)';
                rowSess.getCell(1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0A203E' } };
                rowSess.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                rowSess.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                rowSess.getCell(1).border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };

                weekdays.forEach((wd, i) => {
                    const cell = rowSess.getCell(2 + i);
                    const isInhabile = wd.event && (typeof isDateInhabile === 'function' ? isDateInhabile(wd.dateStrDmy, holidaysMap) : true);

                    if (isInhabile) {
                        cell.value = wd.event ? '🔴 0h' : '0h';
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFDC2626' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    } else {
                        const pdaSession = dailyPdaSessionsMap[wd.dateStr] || dailyPdaSessionsMap[wd.dateStrDmy];
                        if (pdaSession) {
                            cell.value = pdaSession.fullTag;
                            cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF0369A1' } };
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                        } else {
                            const hours = sched[wd.wdNum] || 0;
                            if (hours > 0) {
                                cell.value = `${hours}h`;
                                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0284C7' } };
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                            } else {
                                cell.value = '-';
                                cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                            }
                        }
                    }
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                });
                currentRow++;

                // FILA 5: PROCESOS DE DESARROLLO (PDAs)
                const rowPda = ws.getRow(currentRow);
                rowPda.height = 28;
                rowPda.getCell(1).value = 'PROCESOS DE DESARROLLO (PDAs)';
                rowPda.getCell(1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0A203E' } };
                rowPda.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                rowPda.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                rowPda.getCell(1).border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };

                const findActivePdaForDayExcel = (dateObj) => {
                    const dTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
                    for (const p of pdas) {
                        if (!p.start_date || !p.end_date) continue;
                        const startD = parseRobustDate(p.start_date);
                        const endD = parseRobustDate(p.end_date);
                        if (!startD || !endD) continue;
                        const sTime = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime();
                        const eTime = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate()).getTime();
                        if (dTime >= sTime && dTime <= eTime) return p;
                    }
                    return null;
                };

                let curPdaNum = null;
                let pdaStartCol = 2;

                const flushExcelPda = (endCol) => {
                    if (curPdaNum) {
                        const analysis = pdaAnalysisMap[curPdaNum];
                        const pda = analysis ? analysis.pda : pdas.find(p => p.pda_number === curPdaNum);
                        const cell = rowPda.getCell(pdaStartCol);

                        let tagText = `✅ PDA ${curPdaNum} (${analysis ? analysis.actualSessions : pda.sessions_count}/${pda.sessions_count} ses)`;
                        let fgColor = 'FFDCFCE7';
                        let fontColor = 'FF166534';
                        let borderColor = 'FF16A34A';

                        if (analysis) {
                            if (analysis.status === 'invalid_range' || analysis.status === 'collision') {
                                fgColor = 'FFFEE2E2';
                                fontColor = 'FF991B1B';
                                borderColor = 'FFDC2626';
                                tagText = `⚠️ PDA ${curPdaNum} (${analysis.actualSessions}/${analysis.reqSessions} ses)`;
                            } else if (analysis.status === 'under' || analysis.status === 'over') {
                                fgColor = 'FFFEF3C7';
                                fontColor = 'FF92400E';
                                borderColor = 'FFD97706';
                                tagText = `⚠️ PDA ${curPdaNum} (${analysis.actualSessions}/${analysis.reqSessions} ses)`;
                            }
                        }

                        cell.value = tagText;
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: fontColor } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };

                        if (endCol > pdaStartCol) {
                            ws.mergeCells(currentRow, pdaStartCol, currentRow, endCol);
                        }

                        for (let c = pdaStartCol; c <= endCol; c++) {
                            rowPda.getCell(c).border = {
                                top: { style: 'medium', color: { argb: borderColor } },
                                bottom: { style: 'medium', color: { argb: borderColor } },
                                left: { style: 'medium', color: { argb: borderColor } },
                                right: { style: 'medium', color: { argb: borderColor } }
                            };
                        }
                    } else {
                        for (let c = pdaStartCol; c <= endCol; c++) {
                            const emptyCell = rowPda.getCell(c);
                            emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                            emptyCell.border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                        }
                    }
                };

                weekdays.forEach((wd, i) => {
                    const colIdx = 2 + i;
                    const activeP = findActivePdaForDayExcel(wd.dateObj);
                    const pNum = activeP ? activeP.pda_number : null;

                    if (pNum !== curPdaNum) {
                        if (i > 0) flushExcelPda(colIdx - 1);
                        curPdaNum = pNum;
                        pdaStartCol = colIdx;
                    }
                    rowPda.getCell(colIdx).border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                });
                flushExcelPda(1 + totalDaysCols);
                currentRow += 2;
            });
        });

        // 6. PESTAÑA 2: DOSIFICACIÓN DE PDAs
        const ws2 = workbook.addWorksheet('Dosificación de PDAs');
        ws2.views = [{ showGridLines: true }];
        ws2.columns = [
            { key: 'contenido', width: 28 },
            { key: 'pda_no', width: 10 },
            { key: 'pda', width: 44 },
            { key: 'temas', width: 34 },
            { key: 'sesiones', width: 12 },
            { key: 'verbo', width: 16 },
            { key: 'complejidad', width: 14 },
            { key: 'rango', width: 18 },
            { key: 'fecha_inicio', width: 16 },
            { key: 'fecha_fin', width: 16 }
        ];

        ws2.mergeCells('A2:J2');
        const ws2Title = ws2.getCell('A2');
        ws2Title.value = ` ${plan.disciplina.toUpperCase()}  —  ${plan.grado}º. GRADO   |   ${plan.cycle_name.toUpperCase()}`;
        ws2Title.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        ws2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A203E' } };
        ws2Title.alignment = { vertical: 'middle', horizontal: 'center' };
        ws2.getRow(2).height = 26;

        const pdaHeaders = [
            'CONTENIDO', 'No. PDA', 'PROCESO DE DESARROLLO (PDA)', 'TEMAS A ATENDER',
            'SESIONES', 'VERBO RECTOR', 'COMPLEJIDAD', 'RANGO SUGERIDO', 'FECHA INICIO', 'FECHA FIN'
        ];
        const hRow = ws2.getRow(3);
        hRow.height = 36;
        pdaHeaders.forEach((h, idx) => {
            const cell = hRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1178C2' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: {style:'medium',color:{argb:'FF0A203E'}}, bottom: {style:'medium',color:{argb:'FF0A203E'}}, left: {style:'thin',color:{argb:'FFFFFFFF'}}, right: {style:'thin',color:{argb:'FFFFFFFF'}} };
        });

        let curContenido = null;
        let contStartRow = 4;
        pdas.forEach((pda, i) => {
            const rIdx = 4 + i;
            const row = ws2.getRow(rIdx);
            row.height = 26;
            row.getCell(1).value = pda.contenido || '';
            row.getCell(2).value = Number(pda.pda_number) || (i + 1);
            row.getCell(3).value = pda.topic || '';
            row.getCell(4).value = pda.temas || '';
            row.getCell(5).value = Number(pda.sessions_count) || 0;
            row.getCell(6).value = pda.verbo_rector || '';
            row.getCell(7).value = pda.complejidad || '';
            row.getCell(8).value = pda.rango_sugerido || '';
            row.getCell(9).value = pda.start_date || '';
            row.getCell(10).value = pda.end_date || '';

            const isEven = (i % 2 === 0);
            const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
            for (let c = 1; c <= 10; c++) {
                const cell = row.getCell(c);
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                cell.border = { top: {style:'thin',color:{argb:'FFCBD5E1'}}, bottom: {style:'thin',color:{argb:'FFCBD5E1'}}, left: {style:'thin',color:{argb:'FFCBD5E1'}}, right: {style:'thin',color:{argb:'FFCBD5E1'}} };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: (c === 2 || c === 5 || c === 6 || c === 7 || c === 8 || c === 9 || c === 10) ? 'center' : 'left',
                    wrapText: (c === 1 || c === 3 || c === 4)
                };
            }

            const cVal = (pda.contenido || '').trim();
            if (i === 0) {
                curContenido = cVal;
                contStartRow = rIdx;
            } else if (cVal !== curContenido) {
                if (contStartRow < rIdx - 1 && curContenido) {
                    ws2.mergeCells(`A${contStartRow}:A${rIdx - 1}`);
                }
                curContenido = cVal;
                contStartRow = rIdx;
            }
            if (i === pdas.length - 1 && contStartRow < rIdx && curContenido) {
                ws2.mergeCells(`A${contStartRow}:A${rIdx}`);
            }
        });

        // 7. DESCARGA DEL ARCHIVO EXCEL
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const cleanMateria = plan.disciplina
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "");

        const fileName = `Cronograma_dosificacion_${cleanMateria}_${plan.grado}.xlsx`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Archivo "${fileName}" descargado exitosamente.`, 'success');
    } catch (e) {
        console.error("Error al exportar Cronograma a Excel:", e);
        showToast('Error al exportar cronograma a Excel: ' + e.message, 'error');
    }
}
