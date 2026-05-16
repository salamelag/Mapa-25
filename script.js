var map = L.map('map').setView([-25.0, -55.0], 4);

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


// ----------------- ACTUALIZAR TAMAÑO (TODOS LOS ICONOS) -----------------
function actualizarTamanoIcono() {
    var zoomActual = map.getZoom();
    var nuevoTamano = Math.max(30, zoomActual * 6); 
    var listaMarcadores = [
        { obj: marcadorMar, url: linkImagenMar },
        { obj: marcadorCampo, url: linkImagenCampo },
        { obj: marcadorBrasilia, url: linkImagenBrasilia }
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


// ----------------- LEER ARCHIVO Y DIBUJAR TODO BRASIL -----------------
fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson')
    .then(function(respuesta) { return respuesta.json(); })
    .then(function(datosBrasil) {
        L.geoJSON(datosBrasil, {
            style: function(feature) {
                return { color: '#006400', weight: 2, fillColor: '#32CD32', fillOpacity: 0.25 };
            }
        }).addTo(map);
    })
    .catch(function(error) { console.error("Error cargando geojson de Brasil:", error); });
