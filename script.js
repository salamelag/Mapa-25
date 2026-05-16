const supabaseUrl = 'https://hwyedjcprazfnzgvughb.supabase.co';
const supabaseKey = 'sb_publishable_0DtFI1RtzZAgNGN0GJOW1g_Qg-mwebE';
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActual = null;
let ejercitoActual = null;
let todosLosEjercitos = {};
let todasLasRelaciones = [];

document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatosEjercitos();
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) {
        usuarioActual = session.user;
        await verificarAprobacionHUD();
    } else {
        document.getElementById('panel-visitante').classList.remove('oculto');
    }
    iniciarPresencia();
    iniciarMapa();
});

// --- PRESENCIA EN TIEMPO REAL ---
function iniciarPresencia() {
    const canal = clienteSupabase.channel('mapa-presencia-v2', {
        config: { presence: { key: Math.random().toString(36).slice(2) } }
    });
    canal.on('presence', { event: 'sync' }, () => {
        const total = Object.keys(canal.presenceState()).length;
        const el = document.getElementById('num-visitantes');
        if (el) el.innerText = total;
    });
    canal.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await canal.track({ t: Date.now() });
    });
}

// --- DATOS ---
async function cargarDatosEjercitos() {
    const { data: ejercitos } = await clienteSupabase.from('ejercitos').select('*');
    if (ejercitos) ejercitos.forEach(e => { todosLosEjercitos[e.id] = e; });
    const { data: relaciones } = await clienteSupabase.from('relaciones').select('*');
    if (relaciones) todasLasRelaciones = relaciones;
}

async function obtenerComandanteRoblox(ejercitoId) {
    const { data } = await clienteSupabase
        .from('peticiones').select('usuario_roblox')
        .eq('ejercito', ejercitoId).eq('estado', 'Aprobado').limit(1);
    return (data && data.length > 0) ? data[0].usuario_roblox : null;
}

// --- LOGIN ---
document.getElementById('btn-abrir-login').onclick = () => document.getElementById('modal-login').classList.remove('oculto');
document.getElementById('btn-cerrar-login').onclick = () => document.getElementById('modal-login').classList.add('oculto');

document.getElementById('btn-registro').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    msj.innerText = "Registrando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.auth.signUp({ email, password: pass });
    if (error) { msj.innerText = error.message; msj.style.color = "#cc3333"; }
    else { msj.innerText = "Cuenta creada. Ya podes entrar."; msj.style.color = "#32CD32"; }
};

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    msj.innerText = "Conectando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password: pass });
    if (error) { msj.innerText = "Credenciales incorrectas."; msj.style.color = "#cc3333"; }
    else { location.reload(); }
};

const cerrarSesion = async () => { await clienteSupabase.auth.signOut(); location.reload(); };
document.getElementById('btn-cerrar-sesion').onclick = cerrarSesion;
document.getElementById('btn-cerrar-sesion-cmd').onclick = cerrarSesion;

// --- RECLAMAR ---
document.getElementById('btn-abrir-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.remove('oculto');
document.getElementById('btn-cerrar-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.add('oculto');

document.getElementById('btn-enviar').onclick = async () => {
    const robloxName = document.getElementById('input-roblox').value;
    const ejercitoSelect = document.getElementById('input-ejercito').value;
    const msj = document.getElementById('mensaje-estado');
    if (!robloxName || !ejercitoSelect) { msj.innerText = "Completa todos los campos."; msj.style.color = "#cc3333"; return; }
    msj.innerText = "Enviando peticion..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.from('peticiones').insert([
        { usuario_roblox: robloxName, ejercito: ejercitoSelect, email_usuario: usuarioActual.email, estado: 'Pendiente' }
    ]);
    if (error) { msj.innerText = "Error de servidor."; msj.style.color = "#cc3333"; }
    else {
        msj.innerText = "Enviado. Esperando aprobacion del Alto Mando."; msj.style.color = "#32CD32";
        setTimeout(() => document.getElementById('modal-reclamar').classList.add('oculto'), 3000);
    }
};

// --- HERRAMIENTAS COMANDANTE ---
document.getElementById('btn-panel-control').onclick = () => {
    if (!ejercitoActual) return;
    const e = todosLosEjercitos[ejercitoActual];
    document.getElementById('hud-ejercito-nombre').innerText = e ? e.nombre : ejercitoActual;
    document.getElementById('hud-ejercito-lider').innerText = e ? (e.lider || usuarioActual.email) : usuarioActual.email;
    document.getElementById('hud-ejercito-desc').value = e?.descripcion || '';
    cargarRelacionesPanel();
    document.getElementById('panel-herramientas').classList.remove('oculto');
};

document.getElementById('btn-cerrar-herramientas').onclick = () => document.getElementById('panel-herramientas').classList.add('oculto');

document.getElementById('btn-guardar-desc').onclick = async () => {
    const desc = document.getElementById('hud-ejercito-desc').value;
    const msj = document.getElementById('msj-herramientas');
    msj.innerText = "Guardando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.from('ejercitos')
        .update({ descripcion: desc, lider: todosLosEjercitos[ejercitoActual]?.lider || usuarioActual.email, email_lider: usuarioActual.email })
        .eq('id', ejercitoActual);
    if (error) { msj.innerText = "Error al guardar."; msj.style.color = "#cc3333"; }
    else {
        if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].descripcion = desc;
        msj.innerText = "Guardado."; msj.style.color = "#32CD32";
        setTimeout(() => msj.innerText = '', 2000);
    }
};

document.getElementById('btn-guardar-relacion').onclick = async () => {
    const ejB = document.getElementById('sel-ejercito-relacion').value;
    const tipo = document.getElementById('sel-tipo-relacion').value;
    const msj = document.getElementById('msj-herramientas');
    if (!ejB) { msj.innerText = "Selecciona un ejercito."; msj.style.color = "#cc3333"; return; }
    msj.innerText = "Actualizando..."; msj.style.color = "yellow";
    await clienteSupabase.from('relaciones').delete()
        .or(`and(ejercito_a.eq.${ejercitoActual},ejercito_b.eq.${ejB}),and(ejercito_a.eq.${ejB},ejercito_b.eq.${ejercitoActual})`);
    const { error } = await clienteSupabase.from('relaciones').insert([{ ejercito_a: ejercitoActual, ejercito_b: ejB, tipo }]);
    if (error) { msj.innerText = "Error al guardar."; msj.style.color = "#cc3333"; }
    else {
        msj.innerText = tipo + " con " + (todosLosEjercitos[ejB]?.nombre || ejB);
        msj.style.color = "#32CD32";
        await cargarDatosEjercitos();
        cargarRelacionesPanel();
        setTimeout(() => msj.innerText = '', 3000);
    }
};

function cargarRelacionesPanel() {
    const lista = document.getElementById('lista-relaciones-panel');
    const misRel = todasLasRelaciones.filter(r => r.ejercito_a === ejercitoActual || r.ejercito_b === ejercitoActual);
    if (misRel.length === 0) { lista.innerHTML = '<span style="color:#333;font-size:11px;">Sin relaciones</span>'; return; }
    lista.innerHTML = misRel.map(r => {
        const otro = r.ejercito_a === ejercitoActual ? r.ejercito_b : r.ejercito_a;
        const nombre = todosLosEjercitos[otro]?.nombre || otro;
        const color = r.tipo === 'Aliado' ? '#32CD32' : r.tipo === 'Enemigo' ? '#cc3333' : '#555';
        return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #0f1a0f;">
            <span style="font-size:11px;color:#ccc;">${nombre}</span>
            <span style="color:${color};font-size:10px;letter-spacing:1px;">${r.tipo.toUpperCase()}</span>
        </div>`;
    }).join('');
}

function poblarSelectorRelaciones() {
    const sel = document.getElementById('sel-ejercito-relacion');
    sel.innerHTML = '<option value="" disabled selected>-- Selecciona ejercito --</option>';
    Object.entries(todosLosEjercitos).forEach(([id, e]) => {
        if (id !== ejercitoActual) sel.innerHTML += `<option value="${id}">${e.nombre}</option>`;
    });
}

async function verificarAprobacionHUD() {
    document.getElementById('panel-visitante').classList.add('oculto');
    const { data } = await clienteSupabase.from('peticiones').select('*')
        .eq('email_usuario', usuarioActual.email).eq('estado', 'Aprobado');
    if (data && data.length > 0) {
        ejercitoActual = data[0].ejercito;
        const e = todosLosEjercitos[ejercitoActual];
        document.getElementById('panel-comandante').classList.remove('oculto');
        document.getElementById('texto-comandante').innerText = e ? e.nombre : ejercitoActual;
        // Sincronizar nombre Roblox como lider del ejército
        await clienteSupabase.from('ejercitos')
            .update({ lider: data[0].usuario_roblox, email_lider: usuarioActual.email })
            .eq('id', ejercitoActual);
        if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].lider = data[0].usuario_roblox;
        poblarSelectorRelaciones();
    } else {
        document.getElementById('panel-usuario').classList.remove('oculto');
        document.getElementById('texto-usuario').innerText = usuarioActual.email;
    }
}

// ========================= MAPA =========================

var map;
var listaMarcadores = [];

// Paleta por ejército — un color por faccion
const ESTILOS_GEO = {
    '25_REMASTER':         { borde: '#1ab4ff', fill: '#90d8f5', op: 0.38 },
    'Argentine_Army':      { borde: '#2244cc', fill: '#4466ee', op: 0.42 },
    'Exercito_Brasileiro': { borde: '#1a7a1a', fill: '#2ecc2e', op: 0.28 },
    'EB_Mirage':           { borde: '#007700', fill: '#00bb00', op: 0.62 },
    'War_Front_Finland':   { borde: '#1a1a1a', fill: '#333333', op: 0.58 },
    'Ejercito_Uruguayo':   { borde: '#0038a8', fill: '#7bafd4', op: 0.45 },
    'Ejercito_Colombia':   { borde: '#ccaa00', fill: '#ffea00', op: 0.45 }
};

function geoStyle(id) {
    const s = ESTILOS_GEO[id] || { borde: '#888', fill: '#aaa', op: 0.3 };
    return { color: s.borde, weight: 2, fillColor: s.fill, fillOpacity: s.op };
}

function iniciarMapa() {
    map = L.map('map').setView([15.0, -30.0], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    map.on('click', () => cerrarPanelTerritorio());
    configurarMarcadores();
    cargarGeografia();
}

function configurarMarcadores() {
    const datos = [
        { coords: [-30.600242, -62.870913], label: 'Laguna Mar Chiquita', ejId: '25_REMASTER',         region: 'Cordoba, Argentina',   img: '25.png' },
        { coords: [-34.533805, -58.649166], label: 'Campo de Mayo',       ejId: 'Argentine_Army',      region: 'Buenos Aires, Argentina', img: 'https://tr.rbxcdn.com/180DAY-cdfd2b3c913f59789ac50bda58fa8e97/256/256/Image/Webp/noFilter' },
        { coords: [-15.778361, -47.905083], label: 'Brasilia',            ejId: 'Exercito_Brasileiro', region: 'Brasilia, Brasil',      img: 'https://tr.rbxcdn.com/180DAY-40a3b8aacb25617525f5903f172f4db8/256/256/Image/Webp/noFilter' },
        { coords: [-22.9068,   -43.1729  ], label: 'Rio de Janeiro',      ejId: 'EB_Mirage',           region: 'Rio de Janeiro, Brasil', img: 'https://tr.rbxcdn.com/180DAY-05b3c4bc174a604f84a4cde981d7975c/256/256/Image/Webp/noFilter' },
        { coords: [60.1699,     24.9384  ], label: 'Helsinki',            ejId: 'War_Front_Finland',   region: 'Helsinki, Finlandia',  img: 'https://tr.rbxcdn.com/180DAY-d1401c2af40cc8338406405cf7734c51/256/256/Image/Webp/noFilter' },
        { coords: [-34.9011,   -56.1645  ], label: 'Montevideo',          ejId: 'Ejercito_Uruguayo',   region: 'Montevideo, Uruguay',  img: 'https://tr.rbxcdn.com/180DAY-678a18d475f292e91b46914384aff56e/256/256/Image/Webp/noFilter' },
        { coords: [4.24,       -74.64    ], label: 'Fuerte Militar Tolemaida', ejId: 'Ejercito_Colombia', region: 'Tolemaida, Colombia', img: 'https://tr.rbxcdn.com/180DAY-0219f2fba401ee55c3a0db8ccc44d272/256/256/Image/Webp/noFilter' }
    ];
    datos.forEach(m => {
        const marcador = L.marker(m.coords).addTo(map);
        marcador.bindTooltip(m.label, { direction: 'top', offset: [0, -10] });
        marcador.on('click', (e) => { L.DomEvent.stopPropagation(e); mostrarPanelTerritorio(m.ejId, m.region); });
        listaMarcadores.push({ obj: marcador, url: m.img });
    });
    map.on('zoomend', actualizarIconos);
    actualizarIconos();
}

function actualizarIconos() {
    const s = Math.max(30, map.getZoom() * 6);
    listaMarcadores.forEach(m => m.obj.setIcon(L.icon({ iconUrl: m.url, iconSize: [s, s], iconAnchor: [s/2, s/2], className: 'icono-con-borde' })));
}

// Provincias que tienen presencia reforzada (EB do Mirage controla solo Rio; estas son Ejercito Brasileiro fuerte)
const EB_FUERTE  = []; // ya no se usa como capa separada
const EB_MIRAGE  = ['Rio de Janeiro', 'São Paulo', 'Sao Paulo', 'Minas Gerais', 'Espírito Santo', 'Espirito Santo'];

function addClickHover(layer, ejId, region, opBase, opHover) {
    layer.on('click', (e) => { L.DomEvent.stopPropagation(e); mostrarPanelTerritorio(ejId, region); });
    layer.on('mouseover', () => layer.setStyle({ fillOpacity: opHover }));
    layer.on('mouseout',  () => layer.setStyle({ fillOpacity: opBase  }));
}

function cargarGeografia() {
    // Argentina
    fetch('provincias.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            filter: f => ['Córdoba', 'Buenos Aires'].includes(f.properties.nombre),
            style: f => {
                const id = f.properties.nombre === 'Córdoba' ? '25_REMASTER' : 'Argentine_Army';
                return geoStyle(id);
            },
            onEachFeature: (feature, layer) => {
                const id = feature.properties.nombre === 'Córdoba' ? '25_REMASTER' : 'Argentine_Army';
                const region = feature.properties.nombre === 'Córdoba' ? 'Cordoba, Argentina' : 'Buenos Aires, Argentina';
                const s = ESTILOS_GEO[id];
                addClickHover(layer, id, region, s.op, Math.min(s.op + 0.25, 0.9));
            }
        }).addTo(map);
    }).catch(e => console.log("Error cargando provincias:", e));

    // Brasil
    fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson')
        .then(r => r.json()).then(data => {
            // EB do Mirage — solo Rio de Janeiro (verde intenso)
            L.geoJSON(data, {
                filter: f => EB_MIRAGE.includes(f.properties.name || ''),
                style: () => geoStyle('EB_Mirage'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'EB_Mirage', 'Rio de Janeiro, Brasil', ESTILOS_GEO['EB_Mirage'].op, 0.85);
                }
            }).addTo(map);

            // Exército Brasileiro — São Paulo, Minas Gerais, Espírito Santo (verde medio-alto)
            L.geoJSON(data, {
                filter: f => EB_FUERTE.includes(f.properties.name || ''),
                style: () => ({ color: '#1a7a1a', weight: 2, fillColor: '#2ecc2e', fillOpacity: 0.48 }),
                onEachFeature: (feature, layer) => {
                    const region = (feature.properties.name || '') + ', Brasil';
                    addClickHover(layer, 'Exercito_Brasileiro', region, 0.48, 0.70);
                }
            }).addTo(map);

            // Exército Brasileiro — resto del país (verde suave)
            L.geoJSON(data, {
                filter: f => !EB_MIRAGE.includes(f.properties.name || '') && !EB_FUERTE.includes(f.properties.name || ''),
                style: () => ({ color: '#1a7a1a', weight: 1, fillColor: '#2ecc2e', fillOpacity: 0.18 }),
                onEachFeature: (feature, layer) => {
                    const region = (feature.properties.name || '') + ', Brasil';
                    addClickHover(layer, 'Exercito_Brasileiro', region, 0.18, 0.38);
                }
            }).addTo(map);
        });

    // Finlandia
    fetch('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/finland.geojson')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('War_Front_Finland'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'War_Front_Finland', 'Finlandia', ESTILOS_GEO['War_Front_Finland'].op, 0.80);
                }
            }).addTo(map);
        });

    // Uruguay
    fetch('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/uruguay.geojson')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('Ejercito_Uruguayo'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'Ejercito_Uruguayo', 'Uruguay', ESTILOS_GEO['Ejercito_Uruguayo'].op, 0.80);
                }
            }).addTo(map);
        });

    // Colombia
    fetch('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/colombia.geojson')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('Ejercito_Colombia'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'Ejercito_Colombia', 'Colombia', ESTILOS_GEO['Ejercito_Colombia'].op, 0.80);
                }
            }).addTo(map);
        });
}

// ==================== PANEL TERRITORIO ====================

const LINKS_JUEGO = {
    '25_REMASTER':         'https://www.roblox.com/games/119851378620864/25-REMASTER',
    'Argentine_Army':      'https://www.roblox.com/games/86744432712071/Argentine-Army',
    'Exercito_Brasileiro': 'https://www.roblox.com/games/2069320852/Ex-rcito-Brasileiro-EB',
    'EB_Mirage':           'https://www.roblox.com/games/73767462197411/EB-do-Mirage-Ex-rcito-Brasileiro',
    'War_Front_Finland':   'https://www.roblox.com/games/102445517344578/War-on-the-Front-Finland-RP',
    'Ejercito_Uruguayo':   'TU_LINK_AQUI',
    'Ejercito_Colombia':   'https://www.roblox.com/games/8575062452/ENC-Fuerte-Militar-Tolemaida'
};

async function mostrarPanelTerritorio(ejercitoId, tituloRegion) {
    const panel = document.getElementById('panel-territorio');
    const e = todosLosEjercitos[ejercitoId];

    document.getElementById('territorio-nombre').innerText = tituloRegion;
    document.getElementById('territorio-ejercito').innerText = e?.nombre || ejercitoId;
    document.getElementById('territorio-desc').innerText = e?.descripcion || 'Sin informacion disponible.';

    // Obtener comandante real desde peticiones (nombre Roblox)
    document.getElementById('territorio-lider').innerText = '...';
    const cmd = await obtenerComandanteRoblox(ejercitoId);
    document.getElementById('territorio-lider').innerText = cmd || 'Sin registrar';

    renderizarRelaciones(ejercitoId);
    document.getElementById('territorio-btn-juego').href = LINKS_JUEGO[ejercitoId] || '#';

    panel.classList.remove('oculto');
    void panel.offsetWidth;
    panel.classList.add('entrando');
    setTimeout(() => panel.classList.remove('entrando'), 280);
}

function renderizarRelaciones(ejercitoId) {
    const cont = document.getElementById('territorio-relaciones');
    const rel = todasLasRelaciones.filter(r => r.ejercito_a === ejercitoId || r.ejercito_b === ejercitoId);
    if (rel.length === 0) { cont.innerHTML = '<span class="rel-vacio">Sin relaciones registradas</span>'; return; }
    cont.innerHTML = rel.map(r => {
        const otroId = r.ejercito_a === ejercitoId ? r.ejercito_b : r.ejercito_a;
        const nombre = todosLosEjercitos[otroId]?.nombre || otroId;
        const color = r.tipo === 'Aliado' ? '#32CD32' : r.tipo === 'Enemigo' ? '#cc3333' : '#555';
        const borde = color;
        return `<div class="rel-item" style="border-left-color:${borde}">
            <span>${nombre}</span>
            <span style="color:${color}">${r.tipo.toUpperCase()}</span>
        </div>`;
    }).join('');
}

function cerrarPanelTerritorio() { document.getElementById('panel-territorio').classList.add('oculto'); }
document.getElementById('btn-cerrar-territorio').onclick = cerrarPanelTerritorio;
