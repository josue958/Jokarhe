function formatMarkdownTable(text) {
    if (!text) return '<em>(Sin registro)</em>';
    if (!text.includes('|')) return text.replace(/\n/g, '<br>');
    
    let html = '';
    const lines = text.split('\n');
    let inTable = false;
    let isHeader = false;
    
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('|')) {
            if (!inTable) {
                html += '<table border="1" style="width:100%; border-collapse:collapse; margin-bottom:15px;">';
                inTable = true;
                isHeader = true;
            }
            if (line.replace(/\|/g, '').replace(/-/g, '').replace(/:/g, '').replace(/ /g, '').trim() === '') {
                isHeader = false;
                continue;
            }
            
            const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
            html += isHeader ? '<tr class="header-bg">' : '<tr>';
            for (let cell of cells) {
                html += `<td style="padding: 5px; border: 1px solid #000;">${cell}</td>`;
            }
            html += '</tr>';
            if (inTable && isHeader) {
                isHeader = false;
            }
        } else {
            if (inTable) {
                html += '</table>';
                inTable = false;
            }
            if (line !== '') {
                html += line + '<br>';
            }
        }
    }
    if (inTable) html += '</table>';
    return html;
}

function getGlobalExportData() {
    let profile = {};
    try {
        profile = JSON.parse(localStorage.getItem('jokarhe_bulk_profile') || '{}');
    } catch (e) {}

    const escuela = document.getElementById('pda-escuela')?.value 
                 || document.getElementById('bulk-escuela')?.value 
                 || profile.escuela 
                 || 'Escuela Secundaria Técnica No. " "';
                 
    const cct = document.getElementById('pda-cct')?.value 
             || document.getElementById('bulk-cct')?.value 
             || profile.cct 
             || 'C.C.T.';
             
    const campoFormativo = document.getElementById('pda-campo-formativo')?.value 
                        || document.getElementById('bulk-campo-formativo')?.value 
                        || profile.campo 
                        || '';
                        
    const profesor = document.getElementById('pda-profesor')?.value 
                  || document.getElementById('bulk-profesor')?.value 
                  || profile.profesor 
                  || '';
                  
    const sugerencia = document.getElementById('pda-sugerencia-eval')?.value 
                    || document.getElementById('bulk-sugerencia-eval')?.value 
                    || profile.eval 
                    || '';
                    
    const firmaRealizo = document.getElementById('pda-firma-realizo')?.value 
                      || document.getElementById('bulk-firma-realizo')?.value 
                      || profile.realizo 
                      || '';
                      
    const firmaReviso = document.getElementById('pda-firma-reviso')?.value 
                     || document.getElementById('bulk-firma-reviso')?.value 
                     || profile.reviso 
                     || '';

    return { escuela, cct, campoFormativo, profesor, sugerencia, firmaRealizo, firmaReviso };
}

function generatePdaWordHtml(plan, cicloName, gradoName, pdaDetails, rowData, globalData) {
    const { pdaNum, pdaTopic, pdaSesiones, dateRangeStr } = rowData;
    const { escuela, cct, campoFormativo, profesor, sugerencia, firmaRealizo, firmaReviso } = globalData;
    
    const ejes = pdaDetails.ejes || '';
    const proyecto = pdaDetails.nombre_proyecto || '';
    const producto = pdaDetails.producto || '';
    const problematica = pdaDetails.problematica || '';
    const proposito = pdaDetails.proposito || '';
    const rawDesarrollo = pdaDetails.desarrollo_sesiones || '';
    const desarrollo = rawDesarrollo.replace(/\n/g, '<br>');
    const rubrica = formatMarkdownTable(pdaDetails.rubrica || '');
    const teoria = (pdaDetails.teoria || '').replace(/\n/g, '<br>');
    const observaciones = (pdaDetails.observaciones || '').replace(/\n/g, '<br>');

    let seguimientoRows = '';
    const numSes = parseInt(pdaSesiones) || 10;
    for (let i = 0; i < numSes; i++) {
        const sNum = i + 1;
        let summary = `Sesión ${sNum}`;
        const regex = new RegExp(`Sesi[óo]n\\s*${sNum}\\b[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñ]*([\\s\\S]{1,120})`, 'i');
        const match = rawDesarrollo.match(regex);
        if (match && match[1]) {
            let content = match[1].replace(/\n/g, ' ').replace(/\*/g, '').replace(/#/g, '').trim();
            content = content.split(/(Sesi[óo]n|Momento)/i)[0].trim();
            if (content.length > 80) content = content.substring(0, 77) + '...';
            if (content.length > 3) summary = `Sesión ${sNum}: ${content}`;
        }
        seguimientoRows += `
        <tr>
            <td style="height: 35px; padding: 5px; font-size: 11px;">${summary}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>`;
    }

    let escuelaFormatted = (escuela || '').trim();
    if (!escuelaFormatted) {
        escuelaFormatted = 'Escuela Secundaria Técnica No. " "';
    } else if (/^escuela\s*secundaria\s*t[eé]cnica\s*no\.?/i.test(escuelaFormatted)) {
        // Ya tiene 'Escuela Secundaria Técnica No.'
    } else if (/^escuela\b/i.test(escuelaFormatted)) {
        // Ya comienza con 'Escuela'
    } else if (/^\d+/.test(escuelaFormatted)) {
        // Inicia con número (ej: 54 "Ingeniero Bravo Ahuja" o 54)
        escuelaFormatted = `Escuela Secundaria Técnica No. ${escuelaFormatted}`;
    } else {
        // Es un nombre directo (ej: Ingeniero Bravo Ahuja)
        const cleanName = escuelaFormatted.replace(/^"|"$/g, '').trim();
        escuelaFormatted = `Escuela Secundaria Técnica No. "${cleanName}"`;
    }

    let cctFormatted = (cct || '').trim();
    if (cctFormatted && !/^c\.?c\.?t\.?/i.test(cctFormatted)) {
        cctFormatted = `C.C.T. ${cctFormatted}`;
    } else if (!cctFormatted) {
        cctFormatted = 'C.C.T.';
    }

    let cicloFormatted = (cicloName || '').trim();
    // Limpiar duplicaciones accidentales como "Ciclo Escolar Ciclo Escolar 2026-2027"
    cicloFormatted = cicloFormatted.replace(/^(ciclo\s*escolar\s*)+/i, 'Ciclo Escolar ');
    if (!/^ciclo\s*escolar\b/i.test(cicloFormatted)) {
        if (/^ciclo\b/i.test(cicloFormatted)) {
            cicloFormatted = cicloFormatted.replace(/^ciclo\s*/i, 'Ciclo Escolar ');
        } else if (cicloFormatted) {
            cicloFormatted = `Ciclo Escolar ${cicloFormatted}`;
        } else {
            cicloFormatted = 'Ciclo Escolar';
        }
    }

    let htmlTemplate = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset='utf-8'>
        <title>Planeación PDA</title>
        <style>
            body { font-family: "Arial", sans-serif; font-size: 11pt; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            td, th { border: 1px solid #000; padding: 5px; vertical-align: top; }
            .header-bg { background-color: #f2f2f2; font-weight: bold; text-align: center; }
            .bold { font-weight: bold; }
            .center { text-align: center; }
            .no-border { border: none !important; }
            h2, h3 { margin-bottom: 10px; color: #333; text-align: center; }
            .page-break { page-break-before: always; }
        </style>
    </head>
    <body>

        <!-- P01: Encabezado Institucional -->
        <table>
            <tr>
                <td colspan="4" class="header-bg" style="font-size: 14pt; padding: 15px;">
                    Gobierno del Estado de México<br>
                    Servicios Educativos Integrados al Estado de México<br>
                    ${escuelaFormatted}<br>
                    ${cctFormatted}<br>
                    ${cicloFormatted}
                </td>
            </tr>
            <tr>
                <td class="bold">Nombre del profesor(a)</td>
                <td colspan="3">${profesor}</td>
            </tr>
            <tr>
                <td class="bold">Grado y grupos</td>
                <td>${gradoName}</td>
                <td class="bold">Periodo / Trimestre</td>
                <td>${dateRangeStr}</td>
            </tr>
            <tr>
                <td class="bold">Disciplina</td>
                <td>${plan.disciplina}</td>
                <td class="bold">Campo Formativo</td>
                <td>${campoFormativo}</td>
            </tr>
            <tr>
                <td class="bold">Sugerencia de Evaluación</td>
                <td colspan="3">${sugerencia}</td>
            </tr>
            <tr>
                <td class="bold">Ejes articuladores</td>
                <td colspan="3">${ejes}</td>
            </tr>
            <tr>
                <td class="bold">Nombre del proyecto</td>
                <td colspan="3">${proyecto}</td>
            </tr>
            <tr>
                <td class="bold">Problemática</td>
                <td colspan="3">${problematica}</td>
            </tr>
            <tr>
                <td class="bold">Propósito</td>
                <td colspan="3">${proposito}</td>
            </tr>
            <tr>
                <td class="bold">Producto</td>
                <td colspan="3">${producto}</td>
            </tr>
            <tr>
                <td class="bold">PDA</td>
                <td colspan="3">${pdaTopic}</td>
            </tr>
            <tr>
                <td class="bold">Número de sesiones</td>
                <td colspan="3">${pdaSesiones} Sesiones</td>
            </tr>
        </table>

        <!-- P02: Desarrollo Didáctico -->
        <div class="page-break"></div>
        <h2>PLANEACIÓN DIDÁCTICA (Desarrollo de las sesiones)</h2>
        <table>
            <tr>
                <td style="padding: 15px;">
                    ${desarrollo || '<em>(Sin desarrollo registrado)</em>'}
                </td>
            </tr>
        </table>

        <!-- P03: Rúbrica de Evaluación -->
        <div class="page-break"></div>
        <h2>RÚBRICA DE EVALUACIÓN FORMATIVA</h2>
        <table>
            <tr>
                <td style="padding: 15px;">
                    ${rubrica || '<em>(Sin rúbrica registrada)</em>'}
                </td>
            </tr>
        </table>

        <!-- P04: Observaciones y Firmas -->
        <div class="page-break"></div>
        <br><br>
        <table>
            <tr class="header-bg">
                <td>Observaciones</td>
            </tr>
            <tr>
                <td style="height: 100px;">
                    ${observaciones}
                </td>
            </tr>
        </table>

        <br><br><br><br><br><br>
        <table class="no-border">
            <tr class="no-border center">
                <td class="no-border" width="50%">
                    ___________________________________<br>
                    <span class="bold">REALIZÓ</span><br>
                    ${firmaRealizo || 'Nombre y firma'}
                </td>
                <td class="no-border" width="50%">
                    ___________________________________<br>
                    <span class="bold">REVISÓ / Vo. Bo.</span><br>
                    ${firmaReviso || 'Nombre y firma'}
                </td>
            </tr>
        </table>

        <!-- P05: Seguimiento de Grupos -->
        <div class="page-break"></div>
        <h2>SEGUIMIENTO DE SESIONES Y ACTIVIDADES POR GRUPO</h2>
        <table>
            <tr class="header-bg">
                <td width="30%">Actividad / Sesión</td>
                <td width="15%">Fecha de aplicación</td>
                <td width="11%">Grupo: A</td>
                <td width="11%">Grupo: B</td>
                <td width="11%">Grupo: C</td>
                <td width="11%">Grupo: D</td>
                <td width="11%">Grupo: E</td>
            </tr>
            ${seguimientoRows}
        </table>

        <!-- P06: Teoría -->
        <div class="page-break"></div>
        <h2>TEORÍA PARA EL DOCENTE</h2>
        <table>
            <tr>
                <td style="padding: 15px;">
                    ${teoria || '<em>(Sin teoría registrada)</em>'}
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
    return `<!DOCTYPE html>${htmlTemplate}`;
}

function exportPdaToWord(btn) {
    if (!currentPdaDetailRow || !activePlaneacionId) {
        showToast('Debes tener una planeación y PDA activos.', 'error');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Generando documento...";
    }

    setTimeout(() => {
        try {
            const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
            if (!plans.length) throw new Error("No hay planeación activa.");
            const plan = plans[0];

            const cycles = dbQuery("SELECT name FROM school_cycles WHERE id = ?", [plan.cycle_id]);
            const cicloName = cycles.length ? cycles[0].name : 'Desconocido';
            const gradoName = plan.grado + "° Grado";

            // Row Data
            const pdaNum = currentPdaDetailRow.querySelector('.col-no').innerText;
            const pdaTopic = currentPdaDetailRow.querySelector('.pda-topic').value;
            const pdaSesiones = currentPdaDetailRow.querySelector('.pda-sessions').value;
            const pdaStartDate = currentPdaDetailRow.querySelector('.pda-start-date') ? currentPdaDetailRow.querySelector('.pda-start-date').value : '';
            const pdaEndDate = currentPdaDetailRow.querySelector('.pda-end-date') ? currentPdaDetailRow.querySelector('.pda-end-date').value : '';
            const dateRangeStr = (pdaStartDate && pdaEndDate) ? `${pdaStartDate} a ${pdaEndDate}` : '';
            const rowData = { pdaNum, pdaTopic, pdaSesiones, dateRangeStr };

            // Modal inputs
            const pdaDetails = {
                ejes: document.getElementById('pda-ejes').value,
                nombre_proyecto: document.getElementById('pda-nombre-proyecto').value,
                producto: document.getElementById('pda-producto').value,
                problematica: document.getElementById('pda-problematica').value,
                proposito: document.getElementById('pda-proposito').value,
                desarrollo_sesiones: document.getElementById('pda-desarrollo-sesiones').value,
                rubrica: document.getElementById('pda-rubrica').value,
                teoria: document.getElementById('pda-teoria').value,
                observaciones: document.getElementById('pda-observaciones').value,
            };

            const htmlContent = generatePdaWordHtml(plan, cicloName, gradoName, pdaDetails, rowData, getGlobalExportData());
            const blob = htmlDocx.asBlob(htmlContent);
            
            const disciplinaStr = (plan.disciplina || 'Disciplina').replace(/\s+/g, '-');
            const gradoStr = (gradoName).replace(/\s+/g, '-');
            const fileName = `${disciplinaStr}-${gradoStr}-PDA${pdaNum}.docx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            showToast('Documento exportado exitosamente', 'success');
        } catch(err) {
            console.error(err);
            showToast('Error al exportar: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = "📄 Exportar .docx";
            }
        }
    }, 800);
}

async function exportAllCompletedPdas() {
    if (!activePlaneacionId) {
        showToast('Debes abrir una planeación primero.', 'error');
        return;
    }

    const tbody = document.getElementById('planner-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Filtrar filas que tengan archivo generado o estén completadas
    const targetRows = rows.filter(tr => {
        const docxInput = tr.querySelector('.pda-docx-input');
        const hasDocx = docxInput && docxInput.value && docxInput.value.trim() !== '';
        const actionBtn = tr.querySelector('.pda-detail-btn');
        const isCompleted = actionBtn && actionBtn.innerText.includes('✅');
        return hasDocx || isCompleted;
    });

    if (targetRows.length === 0) {
        showToast('No se encontraron archivos generados ni PDAs completados para exportar.', 'warning');
        return;
    }

    const btn = document.getElementById('planner-btn-export-zip');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Generando ZIP...";
    }

    // Mostrar modal de progreso
    const progressModal = document.getElementById('export-progress-modal');
    const progressBar = document.getElementById('export-progress-bar');
    const progressText = document.getElementById('export-progress-text');
    const progressTitle = progressModal ? progressModal.querySelector('h3') : null;

    if (progressTitle) progressTitle.innerText = 'Exportando PDAs a ZIP...';
    if (progressModal) progressModal.style.display = 'flex';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.innerText = 'Preparando archivos...';

    setTimeout(async () => {
        try {
            const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
            if (!plans.length) throw new Error("No hay planeación activa.");
            const plan = plans[0];

            const cycles = dbQuery("SELECT name FROM school_cycles WHERE id = ?", [plan.cycle_id]);
            const cicloName = cycles.length ? cycles[0].name : 'Desconocido';
            const gradoName = plan.grado + "° Grado";
            const globalData = getGlobalExportData();

            const zip = new JSZip();

            const total = targetRows.length;
            for (let i = 0; i < total; i++) {
                const tr = targetRows[i];
                
                if (progressText) progressText.innerText = `Empaquetando archivo ${i + 1} de ${total}...`;
                if (progressBar) progressBar.style.width = `${((i) / total) * 100}%`;
                
                await new Promise(resolve => setTimeout(resolve, 20));

                const pdaNum = tr.querySelector('.col-no').innerText;
                const disciplinaStr = (plan.disciplina || 'Disciplina').replace(/\s+/g, '-');
                const gradoStr = (gradoName).replace(/\s+/g, '-');
                const fileName = `${disciplinaStr}-${gradoStr}-PDA${pdaNum}.docx`;

                const docxInput = tr.querySelector('.pda-docx-input');
                let blob = null;

                // Si ya está el archivo generado en Base64 en la fila, lo usamos directamente
                if (docxInput && docxInput.value && docxInput.value.trim() !== '') {
                    blob = base64ToBlob(docxInput.value);
                } else {
                    // Generarlo al vuelo si tiene detalles de PDA
                    const detallesStr = tr.querySelector('.pda-detalles-input').value;
                    let pdaDetails = {};
                    try { pdaDetails = JSON.parse(detallesStr || '{}'); } catch(e){}

                    const pdaTopic = tr.querySelector('.pda-topic').value;
                    const pdaSesiones = tr.querySelector('.pda-sessions').value;
                    const pdaStartDate = tr.querySelector('.pda-start-date') ? tr.querySelector('.pda-start-date').value : '';
                    const pdaEndDate = tr.querySelector('.pda-end-date') ? tr.querySelector('.pda-end-date').value : '';
                    const dateRangeStr = (pdaStartDate && pdaEndDate) ? `${pdaStartDate} a ${pdaEndDate}` : '';
                    
                    const rowData = { pdaNum, pdaTopic, pdaSesiones, dateRangeStr };
                    const htmlContent = generatePdaWordHtml(plan, cicloName, gradoName, pdaDetails, rowData, globalData);
                    blob = htmlDocx.asBlob(htmlContent);
                }

                zip.file(fileName, blob);
            }

            if (progressText) progressText.innerText = `Comprimiendo archivo ZIP...`;
            if (progressBar) progressBar.style.width = `100%`;
            await new Promise(resolve => setTimeout(resolve, 100));

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const disciplinaStr = (plan.disciplina || 'Disciplina')
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_').toLowerCase();
            const gradoStr = (plan.grado || '1');
            const zipFileName = `${disciplinaStr}_${gradoStr}.zip`;

            // Asistente para indicar dónde guardar el archivo (File System Access API)
            let savedWithPicker = false;
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: zipFileName,
                        types: [{
                            description: 'Archivo Comprimido ZIP',
                            accept: { 'application/zip': ['.zip'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(zipBlob);
                    await writable.close();
                    savedWithPicker = true;
                    showToast(`✅ Archivo ${zipFileName} guardado correctamente.`, 'success');
                } catch (pickerErr) {
                    if (pickerErr.name === 'AbortError') {
                        showToast('Guardado cancelado por el usuario.', 'info');
                        return;
                    }
                    console.warn('showSaveFilePicker no disponible o falló, usando descarga estándar', pickerErr);
                }
            }

            // Descarga tradicional si el navegador no soporta el asistente o falló
            if (!savedWithPicker) {
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = zipFileName;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

                showToast(`Se exportaron ${targetRows.length} PDAs en ${zipFileName} exitosamente.`, 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Error al exportar ZIP: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = "🗂️ Exportar PDAs (ZIP)";
            }
            if (progressModal) progressModal.style.display = 'none';
        }
    }, 100);
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function base64ToBlob(base64Data, contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}

function validatePdaRowForDoc(tr) {
    const pdaNum = tr.querySelector('.col-no')?.innerText || '?';
    const topic = tr.querySelector('.pda-topic')?.value?.trim() || '';
    const sessions = parseInt(tr.querySelector('.pda-sessions')?.value) || 0;
    const startDate = tr.querySelector('.pda-start-date')?.value || '';
    const endDate = tr.querySelector('.pda-end-date')?.value || '';
    const detallesStr = tr.querySelector('.pda-detalles-input')?.value || '{}';
    let pdaDetails = {};
    try { pdaDetails = JSON.parse(detallesStr); } catch(e){}

    const missing = [];
    if (!topic) missing.push('Texto del PDA');
    if (sessions <= 0) missing.push('Sesiones asignadas (mayor a 0)');
    if (!startDate || !endDate) missing.push('Fechas de inicio y fin');
    if (!pdaDetails.desarrollo_sesiones && !pdaDetails.nombre_proyecto) {
        missing.push('Detalle de planeación didáctica (usa "Generar Planeaciones" o el botón "📝 PDA")');
    }

    return {
        pdaNum,
        isValid: missing.length === 0,
        missing
    };
}

async function generateAllPdaDocFiles() {
    if (!activePlaneacionId) {
        showToast('Debes abrir una planeación primero.', 'error');
        return;
    }

    const tbody = document.getElementById('planner-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (!rows.length) {
        showToast('No hay filas de PDA en la tabla.', 'warning');
        return;
    }

    // Validar fila a fila qué información falta
    const validationResults = rows.map(tr => ({ tr, ...validatePdaRowForDoc(tr) }));
    const invalidRows = validationResults.filter(r => !r.isValid);
    const validRows = validationResults.filter(r => r.isValid);

    if (invalidRows.length > 0) {
        const errorDetails = invalidRows.map(r => `• PDA #${r.pdaNum}: Falta ${r.missing.join(', ')}`);
        
        if (validRows.length === 0) {
            alert(`⚠️ No se pueden generar los archivos de Word porque falta información en todas las filas:\n\n${errorDetails.slice(0, 8).join('\n')}${errorDetails.length > 8 ? `\n... y en ${errorDetails.length - 8} PDAs más.` : ''}\n\nPor favor completa la información requerida (Planear PDA, Sesiones y Fechas) antes de continuar.`);
            showToast('Falta información requerida para generar los archivos.', 'error');
            return;
        } else {
            const proceed = confirm(`⚠️ Se detectó información faltante en ${invalidRows.length} de ${rows.length} PDAs:\n\n${errorDetails.slice(0, 6).join('\n')}${errorDetails.length > 6 ? `\n... y en ${errorDetails.length - 6} PDAs más.` : ''}\n\n¿Deseas continuar generando únicamente los ${validRows.length} archivos de los PDAs que sí están completos?`);
            if (!proceed) return;
        }
    }

    const btn = document.getElementById('planner-btn-generate-docs');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Generando...";
    }

    // Mostrar modal de progreso
    const progressModal = document.getElementById('export-progress-modal');
    const progressBar = document.getElementById('export-progress-bar');
    const progressText = document.getElementById('export-progress-text');
    const progressTitle = progressModal ? progressModal.querySelector('h3') : null;

    if (progressTitle) progressTitle.innerText = 'Generando archivos Word...';
    if (progressModal) progressModal.style.display = 'flex';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.innerText = 'Iniciando generación de documentos...';

    setTimeout(async () => {
        try {
            const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
            if (!plans.length) throw new Error("No hay planeación activa.");
            const plan = plans[0];

            const cycles = dbQuery("SELECT name FROM school_cycles WHERE id = ?", [plan.cycle_id]);
            const cicloName = cycles.length ? cycles[0].name : 'Desconocido';
            const gradoName = plan.grado + "° Grado";
            const globalData = getGlobalExportData();

            const targetList = validRows;
            const total = targetList.length;
            let generatedCount = 0;

            for (let i = 0; i < total; i++) {
                const { tr, pdaNum } = targetList[i];
                if (progressText) progressText.innerText = `Generando archivo para PDA ${pdaNum} (${i + 1} de ${total})...`;
                if (progressBar) progressBar.style.width = `${((i) / total) * 100}%`;

                await new Promise(resolve => setTimeout(resolve, 20));

                const detallesStr = tr.querySelector('.pda-detalles-input').value;
                let pdaDetails = {};
                try { pdaDetails = JSON.parse(detallesStr || '{}'); } catch(e){}

                const pdaTopic = tr.querySelector('.pda-topic').value;
                const pdaSesiones = tr.querySelector('.pda-sessions').value;
                const pdaStartDate = tr.querySelector('.pda-start-date') ? tr.querySelector('.pda-start-date').value : '';
                const pdaEndDate = tr.querySelector('.pda-end-date') ? tr.querySelector('.pda-end-date').value : '';
                const dateRangeStr = (pdaStartDate && pdaEndDate) ? `${pdaStartDate} a ${pdaEndDate}` : '';
                
                const rowData = { pdaNum, pdaTopic, pdaSesiones, dateRangeStr };

                const htmlContent = generatePdaWordHtml(plan, cicloName, gradoName, pdaDetails, rowData, globalData);
                const blob = htmlDocx.asBlob(htmlContent);
                const base64Str = await blobToBase64(blob);

                // Guardar en la fila
                const docxInput = tr.querySelector('.pda-docx-input');
                if (docxInput) docxInput.value = base64Str;

                const hasDocxCb = tr.querySelector('.has-docx-cb');
                if (hasDocxCb) hasDocxCb.checked = true;

                const downloadBtn = tr.querySelector('.pda-download-btn');
                if (downloadBtn) downloadBtn.style.display = 'block';

                generatedCount++;
            }

            if (progressText) progressText.innerText = `Guardando en la base de datos...`;
            if (progressBar) progressBar.style.width = `100%`;
            await new Promise(resolve => setTimeout(resolve, 50));

            // Guardar automáticamente en la BD
            const totalSessions = parseInt(document.getElementById('summary-total-sessions')?.innerText) || 0;
            if (typeof savePdaPlannerChanges === 'function') {
                await savePdaPlannerChanges(activePlaneacionId, totalSessions);
                if (typeof markAsSaved === 'function') {
                    markAsSaved('planner-btn-save');
                }
            }

            showToast(`✅ Se generaron y guardaron ${generatedCount} archivos Word en la base de datos.`, 'success');
        } catch (err) {
            console.error(err);
            showToast('Error al generar archivos: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = "📄 Generar archivos";
            }
            if (progressModal) progressModal.style.display = 'none';
            if (progressTitle) progressTitle.innerText = 'Exportando PDAs...';
        }
    }, 100);
}

function downloadIndividualPdaDoc(btn) {
    const tr = btn.closest('tr');
    if (!tr || !activePlaneacionId) return;

    try {
        const plans = dbQuery("SELECT * FROM planeaciones WHERE id = ?", [activePlaneacionId]);
        if (!plans.length) throw new Error("No hay planeación activa.");
        const plan = plans[0];

        const pdaNum = tr.querySelector('.col-no').innerText;
        const gradoName = plan.grado + "° Grado";
        const disciplinaStr = (plan.disciplina || 'Disciplina').replace(/\s+/g, '-');
        const gradoStr = (gradoName).replace(/\s+/g, '-');
        const fileName = `${disciplinaStr}-${gradoStr}-PDA${pdaNum}.docx`;

        const docxInput = tr.querySelector('.pda-docx-input');
        let blob = null;

        if (docxInput && docxInput.value && docxInput.value.trim() !== '') {
            blob = base64ToBlob(docxInput.value);
        } else {
            // Si no está generado en base64, generarlo en caliente
            const cycles = dbQuery("SELECT name FROM school_cycles WHERE id = ?", [plan.cycle_id]);
            const cicloName = cycles.length ? cycles[0].name : 'Desconocido';
            const globalData = getGlobalExportData();

            const detallesStr = tr.querySelector('.pda-detalles-input').value;
            let pdaDetails = {};
            try { pdaDetails = JSON.parse(detallesStr || '{}'); } catch(e){}

            const pdaTopic = tr.querySelector('.pda-topic').value;
            const pdaSesiones = tr.querySelector('.pda-sessions').value;
            const pdaStartDate = tr.querySelector('.pda-start-date') ? tr.querySelector('.pda-start-date').value : '';
            const pdaEndDate = tr.querySelector('.pda-end-date') ? tr.querySelector('.pda-end-date').value : '';
            const dateRangeStr = (pdaStartDate && pdaEndDate) ? `${pdaStartDate} a ${pdaEndDate}` : '';
            
            const rowData = { pdaNum, pdaTopic, pdaSesiones, dateRangeStr };
            const htmlContent = generatePdaWordHtml(plan, cicloName, gradoName, pdaDetails, rowData, globalData);
            blob = htmlDocx.asBlob(htmlContent);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        showToast(`Documento PDA ${pdaNum} descargado correctamente.`, 'success');
    } catch(err) {
        console.error(err);
        showToast('Error al descargar archivo: ' + err.message, 'error');
    }
}
