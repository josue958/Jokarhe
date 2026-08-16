'use strict';

/**
 * js/excel.js — Exportación a Excel usando ExcelJS y la plantilla binaria
 */
const ExcelExport = (() => {

    // Función principal para exportar la dosificación y cronograma
    async function exportarCronograma(cycleId, planeacionId) {
        try {
            showToast('Generando archivo Excel, por favor espera...', 'info');

            // 1. Obtener ciclo y planeación de la base de datos
            const cycles = dbQuery("SELECT * FROM school_cycles WHERE id = ?", [cycleId]);
            const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [planeacionId]);

            if (!cycles.length || !plans.length) {
                throw new Error("Ciclo escolar o planeación no encontrados.");
            }

            const cycle = cycles[0];
            const planeacion = plans[0];
            const pdas = dbQuery("SELECT * FROM planeacion_pdas WHERE planeacion_id = ? ORDER BY pda_number ASC", [planeacionId]);

            // 2. Crear un nuevo libro Excel limpio y 100% compatible
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Jokarhe Systems';
            workbook.lastModifiedBy = 'Jokarhe Systems';
            workbook.created = new Date();
            workbook.modified = new Date();

            const ws = workbook.addWorksheet('Dosificación');
            ws.views = [{ showGridLines: true }];

            // Configurar anchos de columna
            ws.columns = [
                { key: 'contenido', width: 28 },
                { key: 'pda_no', width: 9 },
                { key: 'pda', width: 46 },
                { key: 'temas', width: 36 },
                { key: 'sesiones', width: 12 },
                { key: 'verbo', width: 16 },
                { key: 'complejidad', width: 14 },
                { key: 'rango', width: 18 },
                { key: 'fecha_inicio', width: 15 },
                { key: 'fecha_fin', width: 15 }
            ];

            // 3. Fila 2: Título institucional
            ws.mergeCells('A2:J2');
            const titleCell = ws.getCell('A2');
            titleCell.value = ` ${planeacion.disciplina.toUpperCase()}    ${planeacion.grado}º. GRADO         ${cycle.name.toUpperCase()}`;
            titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A203E' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            ws.getRow(2).height = 26;

            // 4. Fila 3: Encabezados de columnas
            const headers = [
                'CONTENIDO',
                'No PROGR. PDA',
                'PROCESOS DE DESARROLLO DE APRENDIZAJE      PDA',
                'TEMAS A ATENDER PARA EL LOGRO DE LOS PROCESOS DE DESARROLLO DE APRENDIZAJE',
                'No. DE SESIONES PARA EL LOGRO DEL PDA.',
                'Verbo Rector',
                'Complejidad',
                'Rango Sugerido',
                'FECHA INICIO',
                'FECHA FIN'
            ];

            const headerRow = ws.getRow(3);
            headerRow.height = 38;
            headers.forEach((h, idx) => {
                const cell = headerRow.getCell(idx + 1);
                cell.value = h;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1178C2' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF0A203E' } },
                    bottom: { style: 'medium', color: { argb: 'FF0A203E' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                };
            });

            // 5. Llenar los datos de los PDAs
            let currentContenido = null;
            let startMergeRow = 4;

            pdas.forEach((pda, i) => {
                const rIdx = 4 + i;
                const row = ws.getRow(rIdx);
                row.height = 28;

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

                const isEven = i % 2 === 0;
                const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

                for (let colIdx = 1; colIdx <= 10; colIdx++) {
                    const cell = row.getCell(colIdx);
                    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                    };
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: (colIdx === 2 || colIdx === 5 || colIdx === 6 || colIdx === 7 || colIdx === 8 || colIdx === 9 || colIdx === 10) ? 'center' : 'left',
                        wrapText: (colIdx === 1 || colIdx === 3 || colIdx === 4)
                    };
                }

                // Lógica de combinación de celdas idénticas en Contenido
                const contenidoVal = (pda.contenido || '').trim();
                if (i === 0) {
                    currentContenido = contenidoVal;
                    startMergeRow = rIdx;
                } else if (contenidoVal !== currentContenido) {
                    if (startMergeRow < rIdx - 1 && currentContenido) {
                        ws.mergeCells(`A${startMergeRow}:A${rIdx - 1}`);
                    }
                    currentContenido = contenidoVal;
                    startMergeRow = rIdx;
                }

                if (i === pdas.length - 1) {
                    if (startMergeRow < rIdx && currentContenido) {
                        ws.mergeCells(`A${startMergeRow}:A${rIdx}`);
                    }
                }
            });

            // 6. Generar buffer y descargar archivo
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const sanitizedSubj = planeacion.disciplina.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `dosificacion_${sanitizedSubj}_${planeacion.grado}.xlsx`;

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Archivo Excel descargado con éxito.', 'success');

        } catch (e) {
            console.error("Error al exportar a Excel:", e);
            showToast('Error al exportar a Excel: ' + e.message, 'error');
        }
    }

    async function descargarPlantilla() {
        try {
            showToast('Generando plantilla Excel...', 'info');

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Jokarhe Systems';
            workbook.lastModifiedBy = 'Jokarhe Systems';
            workbook.created = new Date();
            workbook.modified = new Date();

            const ws = workbook.addWorksheet('Plantilla-Dosificación');
            ws.views = [{ showGridLines: true }];

            ws.columns = [
                { key: 'contenido', width: 28 },
                { key: 'pda_no', width: 9 },
                { key: 'pda', width: 46 },
                { key: 'temas', width: 36 },
                { key: 'sesiones', width: 12 },
                { key: 'verbo', width: 16 },
                { key: 'complejidad', width: 14 },
                { key: 'rango', width: 18 },
                { key: 'fecha_inicio', width: 15 },
                { key: 'fecha_fin', width: 15 }
            ];

            // Fila 2: Título
            ws.mergeCells('A2:J2');
            const titleCell = ws.getCell('A2');
            titleCell.value = ' [DISCIPLINA]    [GRADO]º. GRADO         [CICLO ESCOLAR]';
            titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A203E' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            ws.getRow(2).height = 26;

            // Fila 3: Encabezados
            const headers = [
                'CONTENIDO',
                'No PROGR. PDA',
                'PROCESOS DE DESARROLLO DE APRENDIZAJE      PDA',
                'TEMAS A ATENDER PARA EL LOGRO DE LOS PROCESOS DE DESARROLLO DE APRENDIZAJE',
                'No. DE SESIONES PARA EL LOGRO DEL PDA.',
                'Verbo Rector',
                'Complejidad',
                'Rango Sugerido',
                'FECHA INICIO',
                'FECHA FIN'
            ];

            const headerRow = ws.getRow(3);
            headerRow.height = 38;
            headers.forEach((h, idx) => {
                const cell = headerRow.getCell(idx + 1);
                cell.value = h;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1178C2' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF0A203E' } },
                    bottom: { style: 'medium', color: { argb: 'FF0A203E' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                };
            });

            // Fila 4: Ejemplo
            const row = ws.getRow(4);
            row.height = 28;
            row.getCell(1).value = 'Los derechos humanos en México y en el mundo como valores compartidos por las sociedades actuales.';
            row.getCell(2).value = 1;
            row.getCell(3).value = 'Asume una postura crítica acerca de la vigencia de los derechos humanos como valores compartidos por distintas sociedades del mundo.';
            row.getCell(4).value = 'Concepto de derechos humanos y su evolución histórica.';
            row.getCell(5).value = 4;
            row.getCell(6).value = 'Asume';
            row.getCell(7).value = 'Media';
            row.getCell(8).value = 'Semana 1-2';
            row.getCell(9).value = '';
            row.getCell(10).value = '';

            for (let colIdx = 1; colIdx <= 10; colIdx++) {
                const cell = row.getCell(colIdx);
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: (colIdx === 2 || colIdx === 5 || colIdx === 6 || colIdx === 7 || colIdx === 8 || colIdx === 9 || colIdx === 10) ? 'center' : 'left',
                    wrapText: (colIdx === 1 || colIdx === 3 || colIdx === 4)
                };
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "Plantilla-Planeacion-NEM.xlsx";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Plantilla descargada.', 'success');
        } catch (e) {
            console.error(e);
            showToast('Error al descargar la plantilla: ' + e.message, 'error');
        }
    }

    async function importarExcel(planeacionId, file) {
        try {
            showToast('Leyendo archivo Excel...', 'info');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const ws = workbook.worksheets[0];

            if (!ws) throw new Error("El archivo no contiene hojas de cálculo.");

            let pdaCount = 0;
            // Primero borramos los PDAs actuales para reemplazarlos
            await window.dbRun("DELETE FROM planeacion_pdas WHERE planeacion_id = ?", [planeacionId]);

            // Leer a partir de la fila 4
            for (let r = 4; r <= 100; r++) {
                const row = ws.getRow(r);
                const pdaNum = row.getCell(2).value;
                if (!pdaNum) continue; // Si no hay número de PDA, asumimos que está vacía

                const contenido = (row.getCell(1).value || '').toString().trim();
                const topic = (row.getCell(3).value || '').toString().trim();
                const temas = (row.getCell(4).value || '').toString().trim();
                const sessionsCount = parseInt(row.getCell(5).value) || 0;
                const verbo = (row.getCell(6).value || '').toString().trim();
                const complejidad = (row.getCell(7).value || '').toString().trim();
                const rango = (row.getCell(8).value || '').toString().trim();
                const formatDateValue = (cellValue) => {
                    if (!cellValue) return '';
                    if (cellValue instanceof Date) {
                        return `${cellValue.getFullYear()}-${String(cellValue.getMonth()+1).padStart(2, '0')}-${String(cellValue.getDate()).padStart(2, '0')}`;
                    }
                    const str = cellValue.toString().trim();
                    if (str.includes('T')) return str.split('T')[0];
                    return str;
                };

                const start = formatDateValue(row.getCell(9).value);
                const end = formatDateValue(row.getCell(10).value);

                await window.dbRun(
                    `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count, contenido, temas, complejidad, rango_sugerido, start_date, end_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
                    [planeacionId, pdaNum, topic, verbo, sessionsCount, contenido, temas, complejidad, rango, start, end]
                );
                pdaCount++;
            }

            // Actualizar el conteo en la tabla principal
            await window.dbRun("UPDATE planeaciones SET total_pdas = ? WHERE id = ?", [pdaCount, planeacionId]);
            showToast(`Importación completada: ${pdaCount} PDAs cargados.`, 'success');
            
            // Recargar la lista
            if (typeof window.renderPlaneacionesList === 'function') {
                window.renderPlaneacionesList();
            }

        } catch (e) {
            console.error("Error al importar Excel:", e);
            showToast('Error al importar Excel: ' + e.message, 'error');
        }
    }

    return { exportarCronograma, descargarPlantilla, importarExcel };
})();

