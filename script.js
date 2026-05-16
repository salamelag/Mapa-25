var map = L.map('map').setView([-32.1, -63.6], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

fetch('https://apis.datos.gob.ar/georef/api/v2.0/provincias.geojson?geometria=completa')
    .then(res => res.json())
    .then(data => {
        var cordoba = data.features.find(f => f.properties.nombre.toLowerCase().includes('cór'));
        
        L.geoJSON(cordoba, {
            style: {
                color: '#00bfff',     
                weight: 3,
                fillColor: '#b0e0e6', 
                fillOpacity: 0.25     
            }
        }).addTo(map);
    });
