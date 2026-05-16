// 1. Tu mapa base
var map = L.map('map').setView([-34.6, -58.4], 8); // Acerqué un poco el zoom (8)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ==========================================
// 2. DIBUJAR FRONTERAS O ZONAS (POLÍGONOS)
// ==========================================
// Definís los puntos (Latitud, Longitud) que forman el contorno de tu territorio o isla
var coordenadasTerritorio = [
    [-34.8, -58.0],
    [-34.8, -57.6],
    [-35.2, -57.6],
    [-35.2, -58.0]
];

// Creás el polígono y le asignás colores
var zonaMilitar = L.polygon(coordenadasTerritorio, {
    color: '#ff0000',    // Color de la línea del borde (Rojo)
    weight: 3,           // Grosor de la línea
    fillColor: '#aa0000',// Color de relleno
    fillOpacity: 0.4     // Transparencia del relleno (0 a 1)
}).addTo(map);

// Le agregás un cartelito al hacer clic en la zona
zonaMilitar.bindPopup("<b>Zona Restringida</b><br>Isla de Operaciones");

// ==========================================
// 3. ÍCONOS MILITARES PERSONALIZADOS
// ==========================================
// Creás el formato de tu ícono
var iconoMilsim = L.icon({
    // Cambiá esta URL por el link a tu imagen PNG/SVG (ej: 'icono-tactico.png' si lo subís a tu GitHub)
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1004/1004305.png', 
    iconSize: [40, 40],    // Tamaño del ícono [ancho, alto]
    iconAnchor: [20, 40],  // Punto exacto del ícono que toca la coordenada del mapa
    popupAnchor: [0, -40]  // Dónde aparece el popup en relación al ícono
});

// Colocás la unidad o base en el mapa usando las coordenadas exactas y le pasás tu ícono
var basePrincipal = L.marker([-35.0, -57.8], {icon: iconoMilsim}).addTo(map);

// Texto al clickear el ícono
basePrincipal.bindPopup("<b>HQ Principal</b><br>Unidad Táctica Desplegada.");
