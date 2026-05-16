// 1. Tu mapa base
var map = L.map('map').setView([-34.6, -58.4], 8); // Acerqué un poco el zoom (8)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

var coordenadasTerritorio = [
    [-34.8, -58.0],
    [-34.8, -57.6],
    [-35.2, -57.6],
    [-35.2, -58.0]
];

var zonaMilitar = L.polygon(coordenadasTerritorio, {
    color: '#ff0000',
    weight: 3,
    fillColor: '#aa0000',
    fillOpacity: 0.4
}).addTo(map);

zonaMilitar.bindPopup("<b>Zona Restringida</b><br>Isla de Operaciones");

// ==========================================
// 3. ÍCONOS MILITARES PERSONALIZADOS
// ==========================================
var iconoMilsim = L.icon({
    // Cambiá esta URL por el link a tu imagen PNG/SVG (ej: 'icono-tactico.png' si lo subís a tu GitHub)
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1004/1004305.png', 
    iconSize: [40, 40],    // Tamaño del ícono [ancho, alto]
    iconAnchor: [20, 40],  // Punto exacto del ícono que toca la coordenada del mapa
    popupAnchor: [0, -40]  // Dónde aparece el popup en relación al ícono
});

var basePrincipal = L.marker([-35.0, -57.8], {icon: iconoMilsim}).addTo(map);

basePrincipal.bindPopup("<b>HQ Principal</b><br>Unidad Táctica Desplegada.");
