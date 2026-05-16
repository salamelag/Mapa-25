var map = L.map('map').setView([-35.0, -64.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

var coordsMarChiquita = [-30.600242, -62.870913];
var linkImagen = 'https://tr.rbxcdn.com/180DAY-8c528bd4c92002faf069c7f4f966f9f9/256/256/Image/Webp/noFilter';
var linkJuego = 'https://www.roblox.com/games/119851378620864/25-REMASTER';

var marcadorFoto = L.marker(coordsMarChiquita).addTo(map);

marcadorFoto.bindTooltip("Laguna Mar Chiquita (Punto de interés) <br> Link del juego: " + linkJuego, {
    direction: 'top', offset: [0, -10]
});

marcadorFoto.bindPopup("<a href='" + linkJuego + "' target='_blank'><b>¡Haz clic aquí para jugar 25 REMASTER!</b></a>");

function actualizarTamanoIcono() {
    var zoomActual = map.getZoom();
    var nuevoTamano = Math.max(30, zoomActual * 6); 
    
    var iconoDinamico = L.icon({
        iconUrl: linkImagen,   
        iconSize: [nuevoTamano, nuevoTamano],      
        iconAnchor: [nuevoTamano / 2, nuevoTamano / 2], 
        className: 'icono-con-borde' 
    });
    marcadorFoto.setIcon(iconoDinamico);
}

map.on('zoomend', actualizarTamanoIcono);
actualizarTamanoIcono();

fetch('provincias.geojson')
    .then(function(respuesta) {
        return respuesta.json();
    })
    .then(function(datosProvincias) {
        L.geoJSON(datosProvincias, {
            style: function(feature) {
                if (feature.properties.nombre === 'Córdoba') {
                    return { color: '#00bfff', weight: 3, fillColor: '#b0e0e6', fillOpacity: 0.25 };
                } else if (feature.properties.nombre === 'Buenos Aires') {
                    return { color: '#00008B', weight: 3, fillColor: '#0000CD', fillOpacity: 0.40 };
                } else {
                    return { color: '#333333', weight: 2, fillColor: '#cccccc', fillOpacity: 0.20 };
                }
            }
        }).addTo(map);
    })
    .catch(function(error) {
        console.error("Hubo un error cargando el archivo geojson:", error);
    });
