'use strict';
/**
 * db.js — Capa de base de datos para Dosificador NEM (Fase 6)
 * sql.js (SQLite WASM) + persistencia en IndexedDB
 */

const DB_IDB_NAME    = 'jokarhe-dosificador';
const DB_IDB_VERSION = 1;
const DB_IDB_STORE   = 'sqlite';
const DB_IDB_KEY     = 'db';

let _db  = null;
let _SQL = null;

async function initDB() {
    _SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });
    const savedData = await _loadFromIndexedDB();
    if (savedData) {
        _db = new _SQL.Database(savedData);
    } else {
        const defaultSeed = _loadDefaultSeed();
        if (defaultSeed) {
            _db = new _SQL.Database(defaultSeed);
        } else {
            _db = new _SQL.Database();
            _initSchema();
            _seedData();
        }
        await _saveToIndexedDB();
    }

    // Si la base de datos está vacía de planeaciones, sembrar los datos por defecto
    try {
        const pCount = _db.exec("SELECT COUNT(*) as cnt FROM planeaciones")[0]?.values[0]?.[0] || 0;
        if (pCount === 0) {
            _seedData();
            await _saveToIndexedDB();
        }
    } catch(e) {}

    _runMigrations();
    return _db;
}

function _initSchema() {
    // 1. Tabla de Ciclos Escolares
    _db.run(`CREATE TABLE IF NOT EXISTS school_cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        total_days INTEGER NOT NULL DEFAULT 190,
        period1_days INTEGER NOT NULL DEFAULT 63,
        period2_days INTEGER NOT NULL DEFAULT 63,
        period3_days INTEGER NOT NULL DEFAULT 64,
        holidays TEXT DEFAULT '{}'
    );`);

    // 2. Tabla de Planeaciones (dosificaciones generales)
    _db.run(`CREATE TABLE IF NOT EXISTS planeaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_id INTEGER NOT NULL,
        disciplina TEXT NOT NULL,
        grado INTEGER NOT NULL, -- 1, 2 o 3
        weekly_hours INTEGER NOT NULL, -- 1 a 8
        schedule TEXT NOT NULL, -- JSON de horas diarias, ej: {"1":1,"2":1,"3":1,"4":1,"5":1}
        total_pdas INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (cycle_id) REFERENCES school_cycles(id) ON DELETE CASCADE
    );`);

    // 3. Tabla de PDAs específicas de una Planeación (con personalizaciones y verbo rector)
    _db.run(`CREATE TABLE IF NOT EXISTS planeacion_pdas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        planeacion_id INTEGER NOT NULL,
        pda_number INTEGER NOT NULL,
        topic TEXT NOT NULL,
        verbo_rector TEXT NOT NULL,
        sessions_count INTEGER NOT NULL,
        contenido TEXT NOT NULL DEFAULT '',
        temas TEXT NOT NULL DEFAULT '',
        complejidad TEXT NOT NULL DEFAULT '',
        rango_sugerido TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL DEFAULT '',
        end_date TEXT NOT NULL DEFAULT '',
        detalles_planeacion TEXT NOT NULL DEFAULT '{}',
        archivo_docx TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (planeacion_id) REFERENCES planeaciones(id) ON DELETE CASCADE
    );`);

    // 4. Tabla de Leyendas del Cronograma (CRUD de tipos de eventos y días inhábiles)
    _db.run(`CREATE TABLE IF NOT EXISTS crono_legends (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        keywords TEXT NOT NULL,
        is_inhabile INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0
    );`);
}

function _runMigrations() {
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN contenido TEXT NOT NULL DEFAULT ''");
    } catch(e){}
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN temas TEXT NOT NULL DEFAULT ''");
    } catch(e){}
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN complejidad TEXT NOT NULL DEFAULT ''");
    } catch(e){}
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN rango_sugerido TEXT NOT NULL DEFAULT ''");
    } catch(e){}
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN start_date TEXT NOT NULL DEFAULT ''");
    } catch(e){}
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN end_date TEXT NOT NULL DEFAULT ''");
    } catch(e){}
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN detalles_planeacion TEXT NOT NULL DEFAULT '{}'");
    } catch(e){}
    try {
        _db.run("ALTER TABLE planeacion_pdas ADD COLUMN archivo_docx TEXT NOT NULL DEFAULT ''");
    } catch(e){}

    try {
        _db.run(`CREATE TABLE IF NOT EXISTS crono_legends (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL,
            keywords TEXT NOT NULL,
            is_inhabile INTEGER DEFAULT 1,
            display_order INTEGER DEFAULT 0
        );`);
    } catch(e){}
    _seedCronoLegends();
}

function _seedData() {
    // Insertar un ciclo escolar por defecto (2026-2027)
    const holidays = {
        "16-09-2026": "Independencia de México",
        "02-11-2026": "Día de Muertos",
        "16-11-2026": "Revolución Mexicana",
        "21-12-2026": "Vacaciones de Invierno",
        "22-12-2026": "Vacaciones de Invierno",
        "23-12-2026": "Vacaciones de Invierno",
        "24-12-2026": "Vacaciones de Invierno",
        "25-12-2026": "Navidad",
        "28-12-2026": "Vacaciones de Invierno",
        "29-12-2026": "Vacaciones de Invierno",
        "30-12-2026": "Vacaciones de Invierno",
        "31-12-2026": "Fin de Año",
        "01-01-2027": "Año Nuevo",
        "04-01-2027": "Vacaciones de Invierno",
        "05-01-2027": "Vacaciones de Invierno",
        "06-01-2027": "Vacaciones de Invierno",
        "07-01-2027": "Vacaciones de Invierno",
        "08-01-2027": "Vacaciones de Invierno",
        "01-02-2027": "Día de la Constitución",
        "15-03-2027": "Natalicio de Benito Juárez",
        "22-03-2027": "Semana Santa",
        "23-03-2027": "Semana Santa",
        "24-03-2027": "Semana Santa",
        "25-03-2027": "Semana Santa",
        "26-03-2027": "Semana Santa",
        "29-03-2027": "Semana Santa",
        "30-03-2027": "Semana Santa",
        "31-03-2027": "Semana Santa",
        "01-04-2027": "Semana Santa",
        "02-04-2027": "Semana Santa",
        "01-05-2027": "Día del Trabajo",
        "05-05-2027": "Batalla de Puebla",
        "15-05-2027": "Día del Maestro"
    };

    // Verificar si ya existe el ciclo escolar 2026-2027
    let cid;
    const existingCycles = _db.exec("SELECT id FROM school_cycles LIMIT 1")[0]?.values;
    if (existingCycles && existingCycles.length > 0) {
        cid = existingCycles[0][0];
    } else {
        _db.run(
            `INSERT INTO school_cycles(name, start_date, end_date, total_days, period1_days, period2_days, period3_days, holidays) VALUES(?,?,?,?,?,?,?,?)`,
            ["Ciclo Escolar 2026-2027", "24-08-2026", "13-08-2027", 190, 63, 63, 64, JSON.stringify(holidays)]
        );
        cid = _lastInsertId();
    }

    // 1. Matemáticas 1º Grado (8 PDAs)
    _db.run(
        `INSERT INTO planeaciones(cycle_id, disciplina, grado, weekly_hours, schedule, total_pdas) VALUES(?,?,?,?,?,?)`,
        [cid, "Matemáticas", 1, 5, JSON.stringify({1:1, 2:1, 3:1, 4:1, 5:1}), 8]
    );
    const pidMat = _lastInsertId();

    const mathPdas = [
        "Expresa de diversas maneras números enteros, fraccionarios y decimales positivos y negativos.",
        "Resuelve problemas de suma y resta con números enteros, fraccionarios y decimales.",
        "Determina y compara medidas de tendencia central (media, mediana, moda) y dispersión.",
        "Introduce los conceptos del álgebra y representa situaciones cotidianas con expresiones lineales.",
        "Resuelve ecuaciones lineales y representa de forma gráfica y tabular variaciones proporcionales.",
        "Identifica las propiedades de figuras planas y cuerpos geométricos básicos.",
        "Calcula el perímetro y el área de polígonos regulares y círculos.",
        "Interpreta información a partir de tablas y gráficas de barras, circulares y poligonales."
    ];

    mathPdas.forEach((text, i) => {
        const pdaNum = i + 1;
        const verb = text.trim().split(/\s+/)[0].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '');
        const verbCap = verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase();
        const sCount = (pdaNum <= 6) ? 24 : 23;
        
        _db.run(
            `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count) VALUES(?,?,?,?,?)`,
            [pidMat, pdaNum, text, verbCap, sCount]
        );
    });

    // 2. FCyE 1º Grado (1 PDA)
    _db.run(
        `INSERT INTO planeaciones(cycle_id, disciplina, grado, weekly_hours, schedule, total_pdas) VALUES(?,?,?,?,?,?)`,
        [cid, "FCyE", 1, 2, JSON.stringify({1:1, 2:1, 3:0, 4:0, 5:0}), 1]
    );
    const pidFcye = _lastInsertId();
    _db.run(
        `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count) VALUES(?,?,?,?,?)`,
        [pidFcye, 1, "Valora la conformación del espacio geográfico para comprender la relación de los componentes.", "Valora", 76]
    );

    // 3. Formación Cívica y Ética 1º Grado (16 PDAs)
    _db.run(
        `INSERT INTO planeaciones(cycle_id, disciplina, grado, weekly_hours, schedule, total_pdas) VALUES(?,?,?,?,?,?)`,
        [cid, "Formación Cívica y Ética", 1, 2, JSON.stringify({1:1, 2:1, 3:0, 4:0, 5:0}), 16]
    );
    const pidCivica = _lastInsertId();
    const civicaPdas = [
        "Comprende los cambios físicos y emocionales que experimenta en la adolescencia y valora las implicaciones de su desarrollo.",
        "Distingue las características de los derechos humanos y su importancia para la dignidad humana.",
        "Analiza las condiciones que propician la violencia de género y promueve acciones de prevención.",
        "Reconoce el valor de la diversidad de grupos e identidades juveniles en la escuela y comunidad.",
        "Valora la cultura de paz y propone estrategias para la resolución no violenta de conflictos.",
        "Identifica los principios y valores de la democracia como forma de vida y de gobierno.",
        "Examina la importancia de la participación ciudadana en la toma de decisiones colectivas.",
        "Aplica criterios éticos para regular su conducta y el cuidado de sí mismo y de los demás.",
        "Reflexiona sobre la igualdad sustantiva y la no discriminación en diferentes contextos.",
        "Evalúa la influencia de los medios de comunicación y las redes sociales en las decisiones de los adolescentes.",
        "Promueve relaciones interpersonales basadas en el respeto, la empatía y la solidaridad.",
        "Distingue las normas jurídicas, morales y convencionales en la convivencia democrática.",
        "Reconoce los desafíos de la justicia social y el acceso equitativo a oportunidades.",
        "Analiza la función de las instituciones y organismos en la defensa de los derechos humanos.",
        "Propone proyectos comunitarios para atender problemáticas sociales de su entorno.",
        "Construye compromisos para el ejercicio responsable de su libertad y ciudadanía."
    ];
    civicaPdas.forEach((text, i) => {
        const pdaNum = i + 1;
        const verb = text.trim().split(/\s+/)[0].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '');
        const verbCap = verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase();
        const sCount = (pdaNum <= 12) ? 5 : 4;
        _db.run(
            `INSERT INTO planeacion_pdas(planeacion_id, pda_number, topic, verbo_rector, sessions_count) VALUES(?,?,?,?,?)`,
            [pidCivica, pdaNum, text, verbCap, sCount]
        );
    });
}

function dbQuery(sql, params = []) {
    const stmt = _db.prepare(sql);
    stmt.bind(params);
    const r = [];
    while (stmt.step()) r.push(stmt.getAsObject());
    stmt.free();
    return r;
}

async function dbRun(sql, params = []) {
    _db.run(sql, params);
    const id = _lastInsertId();
    await _saveToIndexedDB();
    return id;
}

function _lastInsertId() {
    try { 
        return _db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] ?? null; 
    } catch(e) { 
        return null; 
    }
}

function _loadFromIndexedDB() {
    return new Promise(resolve => {
        const req = indexedDB.open(DB_IDB_NAME, DB_IDB_VERSION);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_IDB_STORE);
        req.onsuccess = e => {
            const idb = e.target.result;
            const get = idb.transaction(DB_IDB_STORE, 'readonly').objectStore(DB_IDB_STORE).get(DB_IDB_KEY);
            get.onsuccess = () => resolve(get.result ? new Uint8Array(get.result) : null);
            get.onerror   = () => resolve(null);
        };
        req.onerror = () => resolve(null);
    });
}

function _saveToIndexedDB() {
    return new Promise((resolve, reject) => {
        const data = _db.export();
        const req  = indexedDB.open(DB_IDB_NAME, DB_IDB_VERSION);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_IDB_STORE);
        req.onsuccess = e => {
            const tx = e.target.result.transaction(DB_IDB_STORE, 'readwrite');
            tx.objectStore(DB_IDB_STORE).put(data.buffer, DB_IDB_KEY);
            tx.oncomplete = resolve;
            tx.onerror    = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
    });
}

function exportDatabase() {
    const data = _db.export();
    const url  = URL.createObjectURL(new Blob([data], {type: 'application/octet-stream'}));
    const a    = Object.assign(document.createElement('a'), {
        href: url,
        download: `planeador-nem-${new Date().toISOString().split('T')[0]}.sqlite`
    });
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function importDatabase(file) {
    const buf = await file.arrayBuffer();
    _db = new _SQL.Database(new Uint8Array(buf));
    await _saveToIndexedDB();
}

async function resetDatabase() {
    const defaultSeed = _loadDefaultSeed();
    if (defaultSeed) {
        _db = new _SQL.Database(defaultSeed);
    } else {
        _db = new _SQL.Database();
        _initSchema(); 
        _seedData();
    }
    await _saveToIndexedDB();
}

function saveDefaultSeed(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    localStorage.setItem('nem_default_db_seed', base64);
}

function _loadDefaultSeed() {
    const base64 = localStorage.getItem('nem_default_db_seed');
    if (!base64) return null;
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

const DEFAULT_CRONO_LEGENDS = [
    {
        id: "inhabiles",
        name: "Inhábil / Vacaciones",
        icon: "🔴",
        color: "#EF4444",
        keywords: "suspensión, suspensión de labores, vacaciones, inhábil, festivo, navidad, año nuevo, semana santa, independencia, constitución, trabajo, puebla, maestro, muertos, revolución, receso",
        is_inhabile: 1,
        display_order: 1
    },
    {
        id: "cte",
        name: "Consejo Técnico (CTE)",
        icon: "🟡",
        color: "#C9A646",
        keywords: "cte, consejo técnico, consejo tecnico",
        is_inhabile: 1,
        display_order: 2
    },
    {
        id: "calificaciones",
        name: "Registro Calificaciones",
        icon: "🟢",
        color: "#22C55E",
        keywords: "calificaciones, boletas, registro, evaluación, evaluacion, descarga administrativa",
        is_inhabile: 1,
        display_order: 3
    },
    {
        id: "diagnostico",
        name: "Diagnóstico",
        icon: "🔵",
        color: "#1E90FF",
        keywords: "diagnóstico, diagnostico, mejoredu, valoración",
        is_inhabile: 0,
        display_order: 4
    },
    {
        id: "taller",
        name: "Taller Docente",
        icon: "🟦",
        color: "#3B82F6",
        keywords: "taller, intensivo, docente, formación, capacitacion",
        is_inhabile: 1,
        display_order: 5
    }
];

function _seedCronoLegends() {
    try {
        const count = _db.exec("SELECT COUNT(*) FROM crono_legends")[0]?.values[0][0] || 0;
        if (count === 0) {
            DEFAULT_CRONO_LEGENDS.forEach(leg => {
                _db.run(
                    `INSERT OR REPLACE INTO crono_legends(id, name, icon, color, keywords, is_inhabile, display_order) VALUES(?,?,?,?,?,?,?)`,
                    [leg.id, leg.name, leg.icon, leg.color, leg.keywords, leg.is_inhabile, leg.display_order]
                );
            });
        }
    } catch(e) {
        console.error("Error seeding crono_legends:", e);
    }
}

function getCronoLegends() {
    try {
        const res = dbQuery("SELECT * FROM crono_legends ORDER BY display_order ASC, id ASC");
        if (res && res.length > 0) return res;
    } catch(e) {}
    return DEFAULT_CRONO_LEGENDS;
}

async function saveCronoLegend(legend) {
    if (!legend || !legend.id) throw new Error("ID de leyenda requerido.");
    const id = legend.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const name = legend.name ? legend.name.trim() : 'Leyenda';
    const icon = legend.icon ? legend.icon.trim() : '📌';
    const color = legend.color ? legend.color.trim() : '#3B82F6';
    const keywords = legend.keywords ? legend.keywords.trim() : '';
    const isInhabile = legend.is_inhabile ? 1 : 0;
    const displayOrder = Number(legend.display_order) || 0;

    await dbRun(
        `INSERT OR REPLACE INTO crono_legends(id, name, icon, color, keywords, is_inhabile, display_order) VALUES(?,?,?,?,?,?,?)`,
        [id, name, icon, color, keywords, isInhabile, displayOrder]
    );
    await _saveToIndexedDB();
}

async function deleteCronoLegend(legendId) {
    const list = getCronoLegends();
    if (list.length <= 1) {
        throw new Error("Debe existir al menos una Leyenda del Cronograma registrada.");
    }
    await dbRun("DELETE FROM crono_legends WHERE id = ?", [legendId]);
    await _saveToIndexedDB();
}

async function resetDefaultCronoLegends() {
    await dbRun("DELETE FROM crono_legends");
    DEFAULT_CRONO_LEGENDS.forEach(leg => {
        _db.run(
            `INSERT INTO crono_legends(id, name, icon, color, keywords, is_inhabile, display_order) VALUES(?,?,?,?,?,?,?)`,
            [leg.id, leg.name, leg.icon, leg.color, leg.keywords, leg.is_inhabile, leg.display_order]
        );
    });
    await _saveToIndexedDB();
}
