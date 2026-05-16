var map = L.map('map').setView([-35.0, -64.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ----------------- MARCADOR 1: LAGUNA MAR CHIQUITA -----------------
var coordsMarChiquita = [-30.600242, -62.870913];
var linkImagenMar = 'https://tr.rbxcdn.com/180DAY-8c528bd4c92002faf069c7f4f966f9f9/256/256/Image/Webp/noFilter';
var linkJuegoMar = 'https://www.roblox.com/games/119851378620864/25-REMASTER';

var marcadorMar = L.marker(coordsMarChiquita).addTo(map);
marcadorMar.bindTooltip("Laguna Mar Chiquita <br> Link del juego: " + linkJuegoMar, { direction: 'top', offset: [0, -10] });
marcadorMar.bindPopup("<a href='" + linkJuegoMar + "' target='_blank'><b>¡Haz clic aquí para jugar 25 REMASTER!</b></a>");

// ----------------- MARCADOR 2: CAMPO DE MAYO -----------------
var coordsCampoMayo = [-34.533805, -58.649166];
var linkImagenCampo = 'https://tr.rbxcdn.com/180DAY-cdfd2b3c913f59789ac50bda58fa8e97/256/256/Image/Webp/noFilter';
var linkJuegoCampo = 'https://www.roblox.com/games/86744432712071/Argentine-Army';

var marcadorCampo = L.marker(coordsCampoMayo).addTo(map);
marcadorCampo.bindTooltip("Campo de Mayo <br> Link del juego: " + linkJuegoCampo, { direction: 'top', offset: [0, -10] });
marcadorCampo.bindPopup("<a href='" + linkJuegoCampo + "' target='_blank'><b>¡Haz clic aquí para jugar Argentine Army!</b></a>");

function actualizarTamanoIcono() {
    var zoomActual = map.getZoom();
    var nuevoTamano = Math.max(30, zoomActual * 6); 
    
    var iconoMar = L.icon({
        iconUrl: linkImagenMar,   
        iconSize: [nuevoTamano, nuevoTamano],      
        iconAnchor: [nuevoTamano / 2, nuevoTamano / 2], 
        className: 'icono-con-borde' 
    });
    marcadorMar.setIcon(iconoMar);

    var iconoCampo = L.icon({
        iconUrl: linkImagenCampo,   
        iconSize: [nuevoTamano, nuevoTamano],      
        iconAnchor: [nuevoTamano / 2, nuevoTamano / 2], 
        className: 'icono-con-borde' 
    });
    marcadorCampo.setIcon(iconoCampo);
}

map.on('zoomend', actualizarTamanoIcono);
actualizarTamanoIcono();

// ----------------- LEER ARCHIVO Y DIBUJAR PROVINCIAS -----------------
fetch('provincias.geojson')
    .then(function(respuesta) {
        return respuesta.json();
    })
    .then(function(datosProvincias) {
        L.geoJSON(datosProvincias, {
        
            filter: function(feature) {
                return feature.properties.nombre === 'Córdoba' || feature.properties.nombre === 'Buenos Aires';
            },
            style: function(feature) {
                if (feature.properties.nombre === 'Córdoba') {
                    return { color: '#00bfff', weight: 3, fillColor: '#b0e0e6', fillOpacity: 0.25 };
                } else if (feature.properties.nombre === 'Buenos Aires') {
                    return { color: '#00008B', weight: 3, fillColor: '#0000CD', fillOpacity: 0.40 };
                }
            }
            
        }).addTo(map);
    })
    .catch(function(error) {
        console.error("Hubo un error cargando el archivo geojson:", error);
    });
