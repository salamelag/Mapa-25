const supabaseUrl = 'https://hwyedjcprazfnzgvughb.supabase.co';
const supabaseKey = 'sb_publishable_0DtFI1RtzZAgNGN0GJOW1g_Qg-mwebE'; 
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- VARIABLES GLOBALES ---
let usuarioActual = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Revisar si ya hay alguien logueado (La "Cookie" segura de Supabase)
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) {
        usuarioActual = session.user;
        await verificarAprobacionHUD();
    } else {
        document.getElementById('panel-visitante').classList.remove('oculto');
    }
});

// --- LÓGICA DE INICIO DE SESIÓN ---
document.getElementById('btn-abrir-login').onclick = () => document.getElementById('modal-login').classList.remove('oculto');
document.getElementById('btn-cerrar-login').onclick = () => document.getElementById('modal-login').classList.add('oculto');

document.getElementById('btn-registro').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    
    msj.innerText = "Registrando..."; msj.style.color = "yellow";
    const { data, error } = await clienteSupabase.auth.signUp({ email: email, password: pass });
    
    if (error) { msj.innerText = error.message; msj.style.color = "red"; } 
    else { msj.innerText = "¡Cuenta creada! Ya puedes Entrar."; msj.style.color = "#32CD32"; }
};

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    
    msj.innerText = "Conectando..."; msj.style.color = "yellow";
    const { data, error } = await clienteSupabase.auth.signInWithPassword({ email: email, password: pass });
    
    if (error) { msj.innerText = "Credenciales incorrectas."; msj.style.color = "red"; } 
    else { location.reload(); /* Recarga la página para aplicar cambios */ }
};

// Cerrar sesión
const cerrarSesion = async () => { await clienteSupabase.auth.signOut(); location.reload(); };
document.getElementById('btn-cerrar-sesion').onclick = cerrarSesion;
document.getElementById('btn-cerrar-sesion-cmd').onclick = cerrarSesion;

// --- LÓGICA PARA RECLAMAR (AHORA CON DROPDOWN) ---
document.getElementById('btn-abrir-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.remove('oculto');
document.getElementById('btn-cerrar-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.add('oculto');

document.getElementById('btn-enviar').onclick = async () => {
    const robloxName = document.getElementById('input-roblox').value;
    const ejercitoSelect = document.getElementById('input-ejercito').value;
    const msj = document.getElementById('mensaje-estado');

    if (!robloxName || !ejercitoSelect) { msj.innerText = "Llena todos los campos."; msj.style.color = "red"; return; }

    msj.innerText = "Enviando Petición..."; msj.style.color = "yellow";
    
    // Guardamos en la base de datos vinculando su correo
    const { error } = await clienteSupabase.from('peticiones').insert([
        { usuario_roblox: robloxName, ejercito: ejercitoSelect, email_usuario: usuarioActual.email, estado: 'Pendiente' }
    ]);

    if (error) { msj.innerText = "Error de servidor."; msj.style.color = "red"; } 
    else { 
        msj.innerText = "¡Enviado! Espera aprobación del Alto Mando."; msj.style.color = "#32CD32";
        setTimeout(() => document.getElementById('modal-reclamar').classList.add('oculto'), 3000);
    }
};

// --- EL CEREBRO: DECIDIR QUÉ HUD MOSTRAR ---
async function verificarAprobacionHUD() {
    // Escondemos el panel de visitante
    document.getElementById('panel-visitante').classList.add('oculto');

    // Buscamos en la base de datos si este usuario tiene alguna petición Aprobada
    const { data, error } = await clienteSupabase
        .from('peticiones')
        .select('*')
        .eq('email_usuario', usuarioActual.email)
        .eq('estado', 'Aprobado');

    if (data && data.length > 0) {
        // ¡ES UN COMANDANTE APROBADO!
        document.getElementById('panel-comandante').classList.remove('oculto');
        document.getElementById('texto-comandante').innerText = "Ejército: " + data[0].ejercito;
    } else {
        // ES UN SOLDADO NORMAL / PENDIENTE
        document.getElementById('panel-usuario').classList.remove('oculto');
        document.getElementById('texto-usuario').innerText = "Usuario: " + usuarioActual.email;
    }
}


// ----------------- CONFIGURACIÓN DEL MAPA Y GEOGRAFÍA -----------------
// (Todo lo del mapa queda igual que antes, aquí abajo)
var map = L.map('map').setView([15.0, -30.0], 3);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// MARCADOR 1: LAGUNA MAR CHIQUITA (CÓRDOBA)
var coordsMarChiquita = [-30.600242, -62.870913];
var linkImagenMar = 'https://tr.rbxcdn.com/180DAY-8c528bd4c92002faf069c7f4f966f9f9/256/256/Image/Webp/noFilter';
var linkJuegoMar = 'https://www.roblox.com/games/119851378620864/25-REMASTER';
var marcadorMar = L.marker(coordsMarChiquita).addTo(map);
marcadorMar.bindTooltip("Laguna Mar Chiquita <br> Link del juego: " + linkJuegoMar, { direction: 'top', offset: [0, -10] });
marcadorMar.bindPopup("<a href='" + linkJuegoMar + "' target='_blank'><b>¡Haz clic aquí para jugar 25 REMASTER!</b></a>");

// MARCADOR 2: CAMPO DE MAYO (BUENOS AIRES)
var coordsCampoMayo = [-34.533805, -58.649166];
var linkImagenCampo = 'https://tr.rbxcdn.com/180DAY-cdfd2b3c913f59789ac50bda58fa8e97/256/256/Image/Webp/noFilter';
var linkJuegoCampo = 'https://www.roblox.com/games/86744432712071/Argentine-Army';
var marcadorCampo = L.marker(coordsCampoMayo).addTo(map);
marcadorCampo.bindTooltip("Campo de Mayo <br> Link del juego: " + linkJuegoCampo, { direction: 'top', offset: [0, -10] });
marcadorCampo.bindPopup("<a href='" + linkJuegoCampo + "' target='_blank'><b>¡Haz clic aquí para jugar Argentine Army!</b></a>");

// MARCADOR 3: BRASÍLIA (BRASIL)
var coordsBrasilia = [-15.778361, -47.905083]; 
var linkImagenBrasilia = 'https://tr.rbxcdn.com/180DAY-40a3b8aacb25617525f5903f172f4db8/256/256/Image/Webp/noFilter';
var linkJuegoBrasilia = 'https://www.roblox.com/games/2069320852/Ex-rcito-Brasileiro-EB';
var marcadorBrasilia = L.marker(coordsBrasilia).addTo(map);
marcadorBrasilia.bindTooltip("Brasília <br> Link del juego: " + linkJuegoBrasilia, { direction: 'top', offset: [0, -10] });
marcadorBrasilia.bindPopup("<a href='" + linkJuegoBrasilia + "' target='_blank'><b>¡Haz clic aquí para jugar Exército Brasileiro!</b></a>");

// MARCADOR 4: RIO DE JANEIRO (BRASIL)
var coordsRio = [-22.9068, -43.1729]; 
var linkImagenRio = 'https://tr.rbxcdn.com/180DAY-05b3c4bc174a604f84a4cde981d7975c/256/256/Image/Webp/noFilter';
var linkJuegoRio = 'https://www.roblox.com/games/73767462197411/EB-do-Mirage-Ex-rcito-Brasileiro';
var marcadorRio = L.marker(coordsRio).addTo(map);
marcadorRio.bindTooltip("Rio de Janeiro <br> Link del juego: " + linkJuegoRio, { direction: 'top', offset: [0, -10] });
marcadorRio.bindPopup("<a href='" + linkJuegoRio + "' target='_blank'><b>¡Haz clic aquí para jugar EB do Mirage!</b></a>");

// MARCADOR 5: HELSINKI (FINLANDIA)
var coordsFinlandia = [60.1699, 24.9384];
var linkImagenFinlandia = 'https://tr.rbxcdn.com/180DAY-d1401c2af40cc8338406405cf7734c51/256/256/Image/Webp/noFilter';
var linkJuegoFinlandia = 'https://www.roblox.com/games/102445517344578/War-on-the-Front-Finland-RP';
var marcadorFinlandia = L.marker(coordsFinlandia).addTo(map);
marcadorFinlandia.bindTooltip("Helsinki (Finlandia) <br> Link del juego: " + linkJuegoFinlandia, { direction: 'top', offset: [0, -10] });
marcadorFinlandia.bindPopup("<a href='" + linkJuegoFinlandia + "' target='_blank'><b>¡Haz clic aquí para jugar War on the Front: Finland RP!</b></a>");

// ACTUALIZAR TAMAÑO ICONOS
function actualizarTamanoIcono() {
    var zoomActual = map.getZoom();
    var nuevoTamano = Math.max(30, zoomActual * 6); 
    var listaMarcadores = [
        { obj: marcadorMar, url: linkImagenMar }, { obj: marcadorCampo, url: linkImagenCampo },
        { obj: marcadorBrasilia, url: linkImagenBrasilia }, { obj: marcadorRio, url: linkImagenRio },
        { obj: marcadorFinlandia, url: linkImagenFinlandia }
    ];
    listaMarcadores.forEach(function(item) {
        var icono = L.icon({
            iconUrl: item.url, iconSize: [nuevoTamano, nuevoTamano],      
            iconAnchor: [nuevoTamano / 2, nuevoTamano / 2], className: 'icono-con-borde' 
        });
        item.obj.setIcon(icono);
    });
}
map.on('zoomend', actualizarTamanoIcono);
actualizarTamanoIcono();

// GEOGRAFÍA (Pintar países)
fetch('provincias.geojson').then(r => r.json()).then(data => {
    L.geoJSON(data, {
        filter: f => f.properties.nombre === 'Córdoba' || f.properties.nombre === 'Buenos Aires',
        style: f => f.properties.nombre === 'Córdoba' ? { color: '#00bfff', weight: 3, fillColor: '#b0e0e6', fillOpacity: 0.25 } : { color: '#00008B', weight: 3, fillColor: '#0000CD', fillOpacity: 0.25 }
    }).addTo(map);
});
fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson').then(r => r.json()).then(data => {
    L.geoJSON(data, {
        style: f => ['São Paulo', 'Sao Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Espírito Santo', 'Espirito Santo'].includes(f.properties.name || "") ? 
        { color: '#004d00', weight: 3, fillColor: '#00FF00', fillOpacity: 0.55 } : { color: '#006400', weight: 2, fillColor: '#32CD32', fillOpacity: 0.25 }
    }).addTo(map);
});
fetch('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/finland.geojson').then(r => r.json()).then(data => {
    L.geoJSON(data, { style: () => ({ color: '#000000', weight: 2, fillColor: '#404040', fillOpacity: 0.55 }) }).addTo(map);
});
