var map = L.map('map').setView([-32.1, -63.6], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Cargamos el archivo de forma local
fetch('./no se.txt')
    .then(res => res.json())
    .then(data => {
        // Filtramos para extraer únicamente Córdoba del listado de provincias
        var cordoba = data.features.find(f => f.properties.nombre.toLowerCase().includes('cór'));
        
        if (cordoba) {
            L.geoJSON(cordoba, {
                style: {
                    color: '#00bfff',     
                    weight: 3,
                    fillColor: '#b0e0e6', 
                    fillOpacity: 0.25     
                }
            }).addTo(map);
        }
    })
    .catch(err => console.error("Error al cargar el archivo local:", err));
