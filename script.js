// ----------------- CONFIGURACIÓN DE SUPABASE -----------------
const supabaseUrl = 'https://hwyedjcprazfnzgvughb.supabase.co';
const supabaseKey = 'sb_publishable_0DtFI1RtzZAgNGN0GJOW1g_Qg-mwebE'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ----------------- LÓGICA DE LA INTERFAZ -----------------
document.addEventListener('DOMContentLoaded', () => {
    const btnAbrir = document.getElementById('btn-abrir-reclamar');
    const btnCerrar = document.getElementById('btn-cerrar');
    const btnEnviar = document.getElementById('btn-enviar');
    const modal = document.getElementById('modal-reclamar');
    const msjEstado = document.getElementById('mensaje-estado');

    btnAbrir.addEventListener('click', () => {
        modal.classList.remove('oculto');
        msjEstado.innerText = '';
    });

    btnCerrar.addEventListener('click', () => {
        modal.classList.add('oculto');
    });

    btnEnviar.addEventListener('click', async () => {
        const usuario = document.getElementById('input-roblox').value;
        const ejercito = document.getElementById('input-ejercito').value;

        if (usuario === '' || ejercito === '') {
            msjEstado.innerText = "Error: Llena todos los campos.";
            msjEstado.style.color = "red";
            return;
        }

        msjEstado.innerText = "Enviando conexión encriptada...";
        msjEstado.style.color = "yellow";

        // Aquí insertamos los datos en la tabla 'peticiones'
        const { data, error } = await supabase
            .from('peticiones')
            .insert([
                { usuario_roblox: usuario, ejercito: ejercito }
            ]);

        if (error) {
            console.error("Error al enviar:", error);
            msjEstado.innerText = "Error de conexión con la base.";
            msjEstado.style.color = "red";
        } else {
            msjEstado.innerText = "¡Petición enviada al Alto Mando!";
            msjEstado.style.color = "#32CD32";
            setTimeout(() => {
                modal.classList.add('oculto');
            }, 2500);
        }
    });
});

var map = L.map('map').setView([15.0, -30.0], 3);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ----------------- MARCADOR 1: LAGUNA MAR CHIQUITA (CÓRDOBA) -----------------
var coordsMarChiquita = [-30.600242, -62.870913];
var linkImagenMar = 'https://tr.rbxcdn.com/180DAY-8c528bd4c92002faf069c7f4f966f9f9/256/256/Image/Webp/noFilter';
var linkJuegoMar = 'https://www.roblox.com/games/119851378620864/25-REMASTER';

var marcadorMar = L.marker(coordsMarChiquita).addTo(map);
marcadorMar.bindTooltip("Laguna Mar Chiquita <br> Link del juego: " + linkJuegoMar, { direction: 'top', offset: [0, -10] });
marcadorMar.bindPopup("<a href='" + linkJuegoMar + "' target='_blank'><b>¡Haz clic aquí para jugar 25 REMASTER!</b></a>");

// ----------------- MARCADOR 2: CAMPO DE MAYO (BUENOS AIRES) -----------------
var coordsCampoMayo = [-34.533805, -58.649166];
var linkImagenCampo = 'https://tr.rbxcdn.com/180DAY-cdfd2b3c913f59789ac50bda58fa8e97/256/256/Image/Webp/noFilter';
var linkJuegoCampo = 'https://www.roblox.com/games/86744432712071/Argentine-Army';

var marcadorCampo = L.marker(coordsCampoMayo).addTo(map);
marcadorCampo.bindTooltip("Campo de Mayo <br> Link del juego: " + linkJuegoCampo, { direction: 'top', offset: [0, -10] });
marcadorCampo.bindPopup("<a href='" + linkJuegoCampo + "' target='_blank'><b>¡Haz clic aquí para jugar Argentine Army!</b></a>");

// ----------------- MARCADOR 3: BRASÍLIA (BRASIL) -----------------
var coordsBrasilia = [-15.778361, -47.905083]; 
var linkImagenBrasilia = 'https://tr.rbxcdn.com/180DAY-40a3b8aacb25617525f5903f172f4db8/256/256/Image/Webp/noFilter';
var linkJuegoBrasilia = 'https://www.roblox.com/games/2069320852/Ex-rcito-Brasileiro-EB';

var marcadorBrasilia = L.marker(coordsBrasilia).addTo(map);
marcadorBrasilia.bindTooltip("Brasília <br> Link del juego: " + linkJuegoBrasilia, { direction: 'top', offset: [0, -10] });
marcadorBrasilia.bindPopup("<a href='" + linkJuegoBrasilia + "' target='_blank'><b>¡Haz clic aquí para jugar Exército Brasileiro!</b></a>");

// ----------------- MARCADOR 4: RIO DE JANEIRO (BRASIL) -----------------
var coordsRio = [-22.9068, -43.1729]; 
var linkImagenRio = 'https://tr.rbxcdn.com/180DAY-05b3c4bc174a604f84a4cde981d7975c/256/256/Image/Webp/noFilter';
var linkJuegoRio = 'https://www.roblox.com/games/73767462197411/EB-do-Mirage-Ex-rcito-Brasileiro';

var marcadorRio = L.marker(coordsRio).addTo(map);
marcadorRio.bindTooltip("Rio de Janeiro <br> Link del juego: " + linkJuegoRio, { direction: 'top', offset: [0, -10] });
marcadorRio.bindPopup("<a href='" + linkJuegoRio + "' target='_blank'><b>¡Haz clic aquí para jugar EB do Mirage!</b></a>");

// ----------------- MARCADOR 5: HELSINKI (FINLANDIA) -----------------
var coordsFinlandia = [60.1699, 24.9384]; // Coordenadas de Helsinki
var linkImagenFinlandia = 'https://tr.rbxcdn.com/180DAY-d1401c2af40cc8338406405cf7734c51/256/256/Image/Webp/noFilter';
var linkJuegoFinlandia = 'https://www.roblox.com/games/102445517344578/War-on-the-Front-Finland-RP';

var marcadorFinlandia = L.marker(coordsFinlandia).addTo(map);
marcadorFinlandia.bindTooltip("Helsinki (Finlandia) <br> Link del juego: " + linkJuegoFinlandia, { direction: 'top', offset: [0, -10] });
marcadorFinlandia.bindPopup("<a href='" + linkJuegoFinlandia + "' target='_blank'><b>¡Haz clic aquí para jugar War on the Front: Finland RP!</b></a>");


// ----------------- ACTUALIZAR TAMAÑO (TODOS LOS ICONOS) -----------------
function actualizarTamanoIcono() {
    var zoomActual = map.getZoom();
    var nuevoTamano = Math.max(30, zoomActual * 6); 
    var listaMarcadores = [
        { obj: marcadorMar, url: linkImagenMar },
        { obj: marcadorCampo, url: linkImagenCampo },
        { obj: marcadorBrasilia, url: linkImagenBrasilia },
        { obj: marcadorRio, url: linkImagenRio },
        { obj: marcadorFinlandia, url: linkImagenFinlandia }
    ];

    listaMarcadores.forEach(function(item) {
        var icono = L.icon({
            iconUrl: item.url,   
            iconSize: [nuevoTamano, nuevoTamano],      
            iconAnchor: [nuevoTamano / 2, nuevoTamano / 2], 
            className: 'icono-con-borde' 
        });
        item.obj.setIcon(icono);
    });
}

map.on('zoomend', actualizarTamanoIcono);
actualizarTamanoIcono();


// ----------------- LEER ARCHIVO Y DIBUJAR PROVINCIAS (ARGENTINA) -----------------
fetch('provincias.geojson')
    .then(function(respuesta) { return respuesta.json(); })
    .then(function(datosProvincias) {
        L.geoJSON(datosProvincias, {
            filter: function(feature) {
                return feature.properties.nombre === 'Córdoba' || feature.properties.nombre === 'Buenos Aires';
            },
            style: function(feature) {
                if (feature.properties.nombre === 'Córdoba') {
                    return { color: '#00bfff', weight: 3, fillColor: '#b0e0e6', fillOpacity: 0.25 };
                } else if (feature.properties.nombre === 'Buenos Aires') {
                    return { color: '#00008B', weight: 3, fillColor: '#0000CD', fillOpacity: 0.25 };
                }
            }
        }).addTo(map);
    })
    .catch(function(error) { console.error("Error cargando provincias:", error); });


// ----------------- LEER ARCHIVO Y DIBUJAR BRASIL -----------------
fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson')
    .then(function(respuesta) { return respuesta.json(); })
    .then(function(datosBrasil) {
        L.geoJSON(datosBrasil, {
            style: function(feature) {
                var nombreEstado = feature.properties.name || "";
                var estadosDestacados = ['São Paulo', 'Sao Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Espírito Santo', 'Espirito Santo'];

                if (estadosDestacados.includes(nombreEstado)) {
                    return { color: '#004d00', weight: 3, fillColor: '#00FF00', fillOpacity: 0.55 };
                } else {
                    return { color: '#006400', weight: 2, fillColor: '#32CD32', fillOpacity: 0.25 };
                }
            }
        }).addTo(map);
    })
    .catch(function(error) { console.error("Error cargando geojson de Brasil:", error); });


// ----------------- LEER ARCHIVO Y DIBUJAR FINLANDIA -----------------
fetch('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/finland.geojson')
    .then(function(respuesta) { return respuesta.json(); })
    .then(function(datosFinlandia) {
        L.geoJSON(datosFinlandia, {
            style: function(feature) {
                return { color: '#000000', weight: 2, fillColor: '#404040', fillOpacity: 0.55 };
            }
        }).addTo(map);
    })
    .catch(function(error) { console.error("Error cargando geojson de Finlandia:", error); });
