var map = L.map('map').setView([-32.1, -63.6], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Límite geométrico de Córdoba (sin fetch, evita CORS y 404)
var contornoCordoba = [
    [-29.68, -65.62],
    [-29.70, -62.95],
    [-30.26, -61.93],
    [-31.65, -62.15],
    [-34.35, -62.25],
    [-35.00, -63.38],
    [-35.00, -65.00],
    [-32.50, -65.10],
    [-31.90, -65.48],
    [-30.80, -65.45]
];

L.polygon(contornoCordoba, {
    color: '#00bfff',     
    weight: 3,
    fillColor: '#b0e0e6', 
    fillOpacity: 0.25     
}).addTo(map);
