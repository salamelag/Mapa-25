var map = L.map('map').setView([-32.1, -63.6], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Usamos %20 para manejar correctamente el espacio en el nombre del archivo
fetch('./no%20se.txt')
    .then(res => {
        if (!res.ok) throw new Error('No se encontró el archivo no se.txt en el repositorio');
        return res.json();
    })
    .then(data => {
        // Filtramos por ID ("14" es Córdoba en la base del IGN), evitando fallos por acentos
        var cordoba = data.features.find(f => f.properties.id === '14');
        
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
    .catch(err => console.error("Error:", err));
