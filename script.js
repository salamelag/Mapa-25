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
    iniciarMapa();
});

// --- CARGAR DATOS BASE DE EJÉRCITOS Y RELACIONES ---
async function cargarDatosEjercitos() {
    const { data: ejercitos } = await clienteSupabase.from('ejercitos').select('*');
    if (ejercitos) {
        ejercitos.forEach(e => { todosLosEjercitos[e.id] = e; });
    }
    const { data: relaciones } = await clienteSupabase.from('relaciones').select('*');
    if (relaciones) todasLasRelaciones = relaciones;
}

// --- LÓGICA DE LOGIN ---
document.getElementById('btn-abrir-login').onclick = () => document.getElementById('modal-login').classList.remove('oculto');
document.getElementById('btn-cerrar-login').onclick = () => document.getElementById('modal-login').classList.add('oculto');

document.getElementById('btn-registro').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    msj.innerText = "Registrando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.auth.signUp({ email, password: pass });
    if (error) { msj.innerText = error.message; msj.style.color = "red"; }
    else { msj.innerText = "¡Cuenta creada! Ya puedes Entrar."; msj.style.color = "#32CD32"; }
};

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    msj.innerText = "Conectando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password: pass });
    if (error) { msj.innerText = "Credenciales incorrectas."; msj.style.color = "red"; }
    else { location.reload(); }
};

const cerrarSesion = async () => { await clienteSupabase.auth.signOut(); location.reload(); };
document.getElementById('btn-cerrar-sesion').onclick = cerrarSesion;
document.getElementById('btn-cerrar-sesion-cmd').onclick = cerrarSesion;

// --- RECLAMAR EJÉRCITO ---
document.getElementById('btn-abrir-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.remove('oculto');
document.getElementById('btn-cerrar-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.add('oculto');

document.getElementById('btn-enviar').onclick = async () => {
    const robloxName = document.getElementById('input-roblox').value;
    const ejercitoSelect = document.getElementById('input-ejercito').value;
    const msj = document.getElementById('mensaje-estado');
    if (!robloxName || !ejercitoSelect) { msj.innerText = "Llena todos los campos."; msj.style.color = "red"; return; }
    msj.innerText = "Enviando Petición..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.from('peticiones').insert([
        { usuario_roblox: robloxName, ejercito: ejercitoSelect, email_usuario: usuarioActual.email, estado: 'Pendiente' }
    ]);
    if (error) { msj.innerText = "Error de servidor."; msj.style.color = "red"; }
    else {
        msj.innerText = "¡Enviado! Espera aprobación del Alto Mando."; msj.style.color = "#32CD32";
        setTimeout(() => document.getElementById('modal-reclamar').classList.add('oculto'), 3000);
    }
};

// --- HERRAMIENTAS DEL COMANDANTE ---
document.getElementById('btn-panel-control').onclick = () => abrirPanelComandante();

function abrirPanelComandante() {
    if (!ejercitoActual) return;
    const ejercito = todosLosEjercitos[ejercitoActual];
    const panel = document.getElementById('panel-herramientas');
    document.getElementById('hud-ejercito-nombre').innerText = ejercito ? ejercito.nombre : ejercitoActual;
    document.getElementById('hud-ejercito-lider').innerText = ejercito ? (ejercito.lider || usuarioActual.email) : usuarioActual.email;
    document.getElementById('hud-ejercito-desc').value = ejercito ? (ejercito.descripcion || '') : '';
    cargarRelacionesPanel();
    panel.classList.remove('oculto');
}

document.getElementById('btn-cerrar-herramientas').onclick = () => {
    document.getElementById('panel-herramientas').classList.add('oculto');
};

document.getElementById('btn-guardar-desc').onclick = async () => {
    const nuevaDesc = document.getElementById('hud-ejercito-desc').value;
    const msj = document.getElementById('msj-herramientas');
    msj.innerText = "Guardando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase
        .from('ejercitos')
        .update({ descripcion: nuevaDesc, lider: usuarioActual.email, email_lider: usuarioActual.email })
        .eq('id', ejercitoActual);
    if (error) { msj.innerText = "Error al guardar."; msj.style.color = "red"; }
    else {
        msj.innerText = "¡Guardado!"; msj.style.color = "#32CD32";
        if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].descripcion = nuevaDesc;
        setTimeout(() => msj.innerText = '', 2000);
    }
};

document.getElementById('btn-guardar-relacion').onclick = async () => {
    const ejercitoB = document.getElementById('sel-ejercito-relacion').value;
    const tipo = document.getElementById('sel-tipo-relacion').value;
    const msj = document.getElementById('msj-herramientas');
    if (!ejercitoB) { msj.innerText = "Seleccioná un ejército."; msj.style.color = "red"; return; }
    msj.innerText = "Actualizando relación..."; msj.style.color = "yellow";

    // Eliminar relación anterior si existe
    await clienteSupabase.from('relaciones').delete()
        .or(`and(ejercito_a.eq.${ejercitoActual},ejercito_b.eq.${ejercitoB}),and(ejercito_a.eq.${ejercitoB},ejercito_b.eq.${ejercitoActual})`);

    const { error } = await clienteSupabase.from('relaciones').insert([
        { ejercito_a: ejercitoActual, ejercito_b: ejercitoB, tipo }
    ]);
    if (error) { msj.innerText = "Error al guardar relación."; msj.style.color = "red"; }
    else {
        msj.innerText = `Relación con ${ejercitoB} → ${tipo}`; msj.style.color = "#32CD32";
        await cargarDatosEjercitos();
        cargarRelacionesPanel();
        setTimeout(() => msj.innerText = '', 3000);
    }
};

function cargarRelacionesPanel() {
    const lista = document.getElementById('lista-relaciones-panel');
    const misRelaciones = todasLasRelaciones.filter(r => r.ejercito_a === ejercitoActual || r.ejercito_b === ejercitoActual);
    if (misRelaciones.length === 0) {
        lista.innerHTML = '<span style="color:#555;font-size:11px;">Sin relaciones registradas</span>';
        return;
    }
    lista.innerHTML = misRelaciones.map(r => {
        const otro = r.ejercito_a === ejercitoActual ? r.ejercito_b : r.ejercito_a;
        const nombre = todosLosEjercitos[otro] ? todosLosEjercitos[otro].nombre : otro;
        const color = r.tipo === 'Aliado' ? '#32CD32' : r.tipo === 'Enemigo' ? '#ff4444' : '#aaa';
        const icono = r.tipo === 'Aliado' ? '🤝' : r.tipo === 'Enemigo' ? '⚔️' : '🤝';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #1a2a1a;">
            <span style="font-size:11px;">${nombre}</span>
            <span style="color:${color};font-size:11px;font-weight:bold;">${icono} ${r.tipo}</span>
        </div>`;
    }).join('');
}

// Llenar el select de ejércitos en el panel de herramientas (excluyendo el propio)
function poblarSelectorRelaciones() {
    const sel = document.getElementById('sel-ejercito-relacion');
    sel.innerHTML = '<option value="" disabled selected>-- Seleccioná ejército --</option>';
    Object.entries(todosLosEjercitos).forEach(([id, e]) => {
        if (id !== ejercitoActual) {
            sel.innerHTML += `<option value="${id}">${e.nombre}</option>`;
        }
    });
}

// --- DECIDIR QUÉ HUD MOSTRAR ---
async function verificarAprobacionHUD() {
    document.getElementById('panel-visitante').classList.add('oculto');
    const { data } = await clienteSupabase
        .from('peticiones').select('*')
        .eq('email_usuario', usuarioActual.email)
        .eq('estado', 'Aprobado');

    if (data && data.length > 0) {
        ejercitoActual = data[0].ejercito;
        document.getElementById('panel-comandante').classList.remove('oculto');
        const ejercito = todosLosEjercitos[ejercitoActual];
        document.getElementById('texto-comandante').innerText = ejercito ? ejercito.nombre : ejercitoActual;
        poblarSelectorRelaciones();
    } else {
        document.getElementById('panel-usuario').classList.remove('oculto');
        document.getElementById('texto-usuario').innerText = "Usuario: " + usuarioActual.email;
    }
}

// ===================== MAPA =====================

var map;
var capasGeoJSON = {}; // Para poder referenciar capas por nombre de territorio
var panelTerritorio = null;

function iniciarMapa() {
    map = L.map('map').setView([15.0, -30.0], 3);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    map.on('click', () => cerrarPanelTerritorio());

    configurarMarcadores();
    cargarGeografia();
}

// --- MARCADORES ---
var listaMarcadores = [];

function configurarMarcadores() {
    const marcadoresData = [
        { coords: [-30.600242, -62.870913], tooltip: "Laguna Mar Chiquita", link: 'https://www.roblox.com/games/119851378620864/25-REMASTER', nombre: "25 REMASTER", imgUrl: 'https://tr.rbxcdn.com/180DAY-8c528bd4c92002faf069c7f4f966f9f9/256/256/Image/Webp/noFilter', ejercitoId: '25_REMASTER' },
        { coords: [-34.533805, -58.649166], tooltip: "Campo de Mayo", link: 'https://www.roblox.com/games/86744432712071/Argentine-Army', nombre: "Argentine Army", imgUrl: 'https://tr.rbxcdn.com/180DAY-cdfd2b3c913f59789ac50bda58fa8e97/256/256/Image/Webp/noFilter', ejercitoId: 'Argentine_Army' },
        { coords: [-15.778361, -47.905083], tooltip: "Brasília", link: 'https://www.roblox.com/games/2069320852/Ex-rcito-Brasileiro-EB', nombre: "Exército Brasileiro", imgUrl: 'https://tr.rbxcdn.com/180DAY-40a3b8aacb25617525f5903f172f4db8/256/256/Image/Webp/noFilter', ejercitoId: 'Exercito_Brasileiro' },
        { coords: [-22.9068, -43.1729], tooltip: "Rio de Janeiro", link: 'https://www.roblox.com/games/73767462197411/EB-do-Mirage-Ex-rcito-Brasileiro', nombre: "EB do Mirage", imgUrl: 'https://tr.rbxcdn.com/180DAY-05b3c4bc174a604f84a4cde981d7975c/256/256/Image/Webp/noFilter', ejercitoId: 'EB_Mirage' },
        { coords: [60.1699, 24.9384], tooltip: "Helsinki (Finlandia)", link: 'https://www.roblox.com/games/102445517344578/War-on-the-Front-Finland-RP', nombre: "War on the Front", imgUrl: 'https://tr.rbxcdn.com/180DAY-d1401c2af40cc8338406405cf7734c51/256/256/Image/Webp/noFilter', ejercitoId: 'War_Front_Finland' }
    ];

    marcadoresData.forEach(m => {
        const marcador = L.marker(m.coords).addTo(map);
        marcador.bindTooltip(m.tooltip, { direction: 'top', offset: [0, -10] });
        marcador.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            mostrarPanelTerritorio(m.ejercitoId, m.nombre);
        });
        listaMarcadores.push({ obj: marcador, url: m.imgUrl, ejercitoId: m.ejercitoId });
    });

    map.on('zoomend', actualizarTamanoIcono);
    actualizarTamanoIcono();
}

function actualizarTamanoIcono() {
    var zoomActual = map.getZoom();
    var nuevoTamano = Math.max(30, zoomActual * 6);
    listaMarcadores.forEach(item => {
        var icono = L.icon({
            iconUrl: item.url,
            iconSize: [nuevoTamano, nuevoTamano],
            iconAnchor: [nuevoTamano / 2, nuevoTamano / 2],
            className: 'icono-con-borde'
        });
        item.obj.setIcon(icono);
    });
}

function cargarGeografia() {
    fetch('provincias.geojson')
        .then(r => r.json())
        .then(data => {
            L.geoJSON(data, {
                filter: f => f.properties.nombre === 'Córdoba' || f.properties.nombre === 'Buenos Aires',
                style: f => f.properties.nombre === 'Córdoba'
                    ? { color: '#00bfff', weight: 3, fillColor: '#b0e0e6', fillOpacity: 0.35 }
                    : { color: '#00008B', weight: 3, fillColor: '#0000CD', fillOpacity: 0.35 },
                onEachFeature: (feature, layer) => {
                    const ejercitoId = feature.properties.nombre === 'Córdoba' ? '25_REMASTER' : 'Argentine_Army';
                    const nombre = feature.properties.nombre === 'Córdoba' ? '25 REMASTER' : 'Argentine Army';
                    layer.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        mostrarPanelTerritorio(ejercitoId, nombre + ' — ' + feature.properties.nombre);
                    });
                    layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.6 }));
                    layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.35 }));
                }
            }).addTo(map);
        });

    fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson')
        .then(r => r.json())
        .then(data => {
            L.geoJSON(data, {
                style: f => {
                    const nombre = f.properties.name || "";
                    const esSudeste = ['São Paulo', 'Sao Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Espírito Santo', 'Espirito Santo'].includes(nombre);
                    return esSudeste
                        ? { color: '#004d00', weight: 3, fillColor: '#00FF00', fillOpacity: 0.55 }
                        : { color: '#006400', weight: 2, fillColor: '#32CD32', fillOpacity: 0.25 };
                },
                onEachFeature: (feature, layer) => {
                    const nombre = feature.properties.name || "";
                    const esMirage = ['Rio de Janeiro'].includes(nombre);
                    const ejercitoId = esMirage ? 'EB_Mirage' : 'Exercito_Brasileiro';
                    const ejercitoNombre = esMirage ? 'EB do Mirage' : 'Exército Brasileiro';
                    layer.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        mostrarPanelTerritorio(ejercitoId, ejercitoNombre + ' — ' + nombre);
                    });
                    layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.75 }));
                    layer.on('mouseout', () => {
                        const esSudeste = ['São Paulo', 'Sao Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Espírito Santo', 'Espirito Santo'].includes(nombre);
                        layer.setStyle({ fillOpacity: esSudeste ? 0.55 : 0.25 });
                    });
                }
            }).addTo(map);
        });

    fetch('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/finland.geojson')
        .then(r => r.json())
        .then(data => {
            L.geoJSON(data, {
                style: () => ({ color: '#000000', weight: 2, fillColor: '#404040', fillOpacity: 0.55 }),
                onEachFeature: (feature, layer) => {
                    layer.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        mostrarPanelTerritorio('War_Front_Finland', 'War on the Front — Finlandia');
                    });
                    layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.80 }));
                    layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.55 }));
                }
            }).addTo(map);
        });
}

// ===================== PANEL DE TERRITORIO (HOI4 STYLE) =====================

async function mostrarPanelTerritorio(ejercitoId, tituloRegion) {
    const panel = document.getElementById('panel-territorio');
    const ejercito = todosLosEjercitos[ejercitoId];

    // Título
    document.getElementById('territorio-nombre').innerText = tituloRegion;
    document.getElementById('territorio-ejercito').innerText = ejercito ? ejercito.nombre : ejercitoId;

    // Descripción / lore
    document.getElementById('territorio-desc').innerText = ejercito && ejercito.descripcion
        ? ejercito.descripcion
        : 'Sin información disponible.';

    // Lider
    document.getElementById('territorio-lider').innerText = ejercito && ejercito.lider
        ? ejercito.lider
        : 'Sin registrar';

    // Relaciones diplomáticas
    renderizarRelaciones(ejercitoId);

    // Link al juego
    const links = {
        '25_REMASTER': 'https://www.roblox.com/games/119851378620864/25-REMASTER',
        'Argentine_Army': 'https://www.roblox.com/games/86744432712071/Argentine-Army',
        'Exercito_Brasileiro': 'https://www.roblox.com/games/2069320852/Ex-rcito-Brasileiro-EB',
        'EB_Mirage': 'https://www.roblox.com/games/73767462197411/EB-do-Mirage-Ex-rcito-Brasileiro',
        'War_Front_Finland': 'https://www.roblox.com/games/102445517344578/War-on-the-Front-Finland-RP'
    };
    const btnJuego = document.getElementById('territorio-btn-juego');
    btnJuego.href = links[ejercitoId] || '#';

    panel.classList.remove('oculto');
    panel.classList.add('entrando');
    setTimeout(() => panel.classList.remove('entrando'), 300);
}

function renderizarRelaciones(ejercitoId) {
    const contenedor = document.getElementById('territorio-relaciones');
    const misRelaciones = todasLasRelaciones.filter(r => r.ejercito_a === ejercitoId || r.ejercito_b === ejercitoId);

    if (misRelaciones.length === 0) {
        contenedor.innerHTML = '<span class="rel-neutral">Sin relaciones registradas</span>';
        return;
    }

    contenedor.innerHTML = misRelaciones.map(r => {
        const otroId = r.ejercito_a === ejercitoId ? r.ejercito_b : r.ejercito_a;
        const otroEjercito = todosLosEjercitos[otroId];
        const nombre = otroEjercito ? otroEjercito.nombre : otroId;
        let clase = 'rel-neutral';
        let icono = '🤝';
        if (r.tipo === 'Aliado') { clase = 'rel-aliado'; icono = '🟢'; }
        else if (r.tipo === 'Enemigo') { clase = 'rel-enemigo'; icono = '🔴'; }
        else { icono = '⚪'; }
        return `<div class="rel-item ${clase}">
            <span>${icono} ${nombre}</span>
            <span class="rel-tipo">${r.tipo}</span>
        </div>`;
    }).join('');
}

function cerrarPanelTerritorio() {
    document.getElementById('panel-territorio').classList.add('oculto');
}

document.getElementById('btn-cerrar-territorio').onclick = cerrarPanelTerritorio;
