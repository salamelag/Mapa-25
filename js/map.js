// ========================= MAPA =========================

const ESTILOS_GEO = {
    '25_REMASTER':         { borde: '#1ab4ff', fill: '#90d8f5', op: 0.38 },
    'Argentine_Army':      { borde: '#2244cc', fill: '#4466ee', op: 0.42 },
    'Exercito_Brasileiro': { borde: '#1a7a1a', fill: '#2ecc2e', op: 0.28 },
    'EB_Mirage':           { borde: '#007700', fill: '#00bb00', op: 0.62 },
    'War_Front_Finland':   { borde: '#1a1a1a', fill: '#333333', op: 0.58 },
    'Ejercito_Uruguayo':   { borde: '#0038a8', fill: '#7bafd4', op: 0.45 },
    'Ejercito_Colombia':   { borde: '#ccaa00', fill: '#ffea00', op: 0.45 },
    'FK_Zone':             { borde: '#ff2200', fill: '#ff4422', op: 0.50 },
    'Ejercito_Chile':      { borde: '#cc2222', fill: '#ff4444', op: 0.40 },
    'Congreso_Chile':      { borde: '#0033aa', fill: '#3366ff', op: 0.30 },
    'RFA_LaPampa':         { borde: '#008b8b', fill: '#00ced1', op: 0.45 },
    'Imperio_Chubut':      { borde: '#8a2be2', fill: '#9370db', op: 0.45 }
};

function geoStyle(id) {
    const s = ESTILOS_GEO[id] || { borde: '#888', fill: '#aaa', op: 0.3 };
    return { color: s.borde, weight: 2, fillColor: s.fill, fillOpacity: s.op };
}

function iniciarMapa() {
    inyectarPattern();
    map = L.map('map').setView([15.0, -30.0], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    map.on('click', () => { cerrarPanelTerritorio(); limpiarSeleccion(); });
    configurarMarcadores();
    cargarGeografia();
}

function configurarMarcadores() {
    const datos = [
        { coords: [-30.600242, -62.870913], label: 'Laguna Mar Chiquita', ejId: '25_REMASTER',         region: 'Cordoba, Argentina',   img: 'https://tr.rbxcdn.com/180DAY-8c528bd4c92002faf069c7f4f966f9f9/256/256/Image/Webp/noFilter' },
        { coords: [-34.533805, -58.649166], label: 'Campo de Mayo',       ejId: 'Argentine_Army',      region: 'Buenos Aires, Argentina', img: 'https://tr.rbxcdn.com/180DAY-cdfd2b3c913f59789ac50bda58fa8e97/256/256/Image/Webp/noFilter' },
        { coords: [-15.778361, -47.905083], label: 'Brasilia',            ejId: 'Exercito_Brasileiro', region: 'Brasilia, Brasil',      img: 'https://tr.rbxcdn.com/180DAY-40a3b8aacb25617525f5903f172f4db8/256/256/Image/Webp/noFilter' },
        { coords: [-22.9068,   -43.1729  ], label: 'Rio de Janeiro',      ejId: 'EB_Mirage',           region: 'Rio de Janeiro, Brasil', img: 'https://tr.rbxcdn.com/180DAY-05b3c4bc174a604f84a4cde981d7975c/256/256/Image/Webp/noFilter' },
        { coords: [60.1699,     24.9384  ], label: 'Helsinki',            ejId: 'War_Front_Finland',   region: 'Helsinki, Finlandia',  img: 'https://tr.rbxcdn.com/180DAY-d1401c2af40cc8338406405cf7734c51/256/256/Image/Webp/noFilter' },
        { coords: [-34.9011,   -56.1645  ], label: 'Montevideo',          ejId: 'Ejercito_Uruguayo',   region: 'Montevideo, Uruguay',  img: 'https://tr.rbxcdn.com/180DAY-678a18d475f292e91b46914384aff56e/256/256/Image/Webp/noFilter' },
        { coords: [4.24,       -74.64    ], label: 'Fuerte Militar Tolemaida', ejId: 'Ejercito_Colombia', region: 'Tolemaida, Colombia', img: 'https://tr.rbxcdn.com/180DAY-0219f2fba401ee55c3a0db8ccc44d272/256/256/Image/Webp/noFilter' },
        { coords: [-51.7963,   -59.5236  ], label: 'Islas Malvinas (Zona de Lucha)', ejId: 'FK_Zone',  region: 'Islas Malvinas',       img: 'https://tr.rbxcdn.com/180DAY-ff9a30bdc11fd1a21e07cdf3837b6757/352/352/Image/Png/noFilter' },
        { coords: [-33.4132, -70.5796], label: 'Escuela Militar', ejId: 'Ejercito_Chile', region: 'Santiago, Chile', img: 'https://tr.rbxcdn.com/180DAY-6d15efeaa6c140b24fb4486eb7eaea9e/150/150/Image/Webp/noFilter' },
        { coords: [-33.0475, -71.6133], label: 'Congreso Nacional', ejId: 'Congreso_Chile', region: 'Valparaíso, Chile', img: 'https://tr.rbxcdn.com/180DAY-063b85b1f16c771a04d66a39917f351c/150/150/Image/Webp/noFilter' },
        { coords: [6.2442, -75.5812], label: 'Medellín (Zona de Lucha)', ejId: 'Colombia_Conflict', region: 'Medellín, Colombia', img: 'https://tr.rbxcdn.com/180DAY-7c849cd096c2fd5076264c49d9a96db6/256/256/Image/Webp/noFilter' },
        { coords: [-36.67, -64.38], label: 'Regimiento de Infantería Mecanizado 6', ejId: 'RFA_LaPampa', region: 'La Pampa, Argentina', img: 'https://tr.rbxcdn.com/180DAY-ad94cf2036acc8cb7972731f9c142647/256/256/Image/Webp/noFilter' },
        { coords: [-43.25, -65.30], label: 'Trelew', ejId: 'Imperio_Chubut', region: 'Chubut, Argentina', img: 'https://tr.rbxcdn.com/180DAY-d5ce0f3fda3285f338d4dfa2371cf2f5/150/150/Image/Webp/noFilter' }
    ];
    datos.forEach(m => {
        const marcador = L.marker(m.coords).addTo(map);
        marcador.bindTooltip(m.label, { direction: 'top', offset: [0, -10] });
        marcador.on('click', (e) => { L.DomEvent.stopPropagation(e); limpiarSeleccion(); mostrarPanelTerritorio(m.ejId, m.region); });
        listaMarcadores.push({ obj: marcador, url: m.img });
    });
    map.on('zoomend', actualizarIconos);
    actualizarIconos();
}

function actualizarIconos() {
    const s = Math.max(30, map.getZoom() * 6);
    listaMarcadores.forEach(m => m.obj.setIcon(L.icon({ iconUrl: m.url, iconSize: [s, s], iconAnchor: [s/2, s/2], className: 'icono-con-borde' })));
}

const EB_FUERTE  = []; 
const EB_MIRAGE  = ['Rio de Janeiro', 'São Paulo', 'Sao Paulo', 'Minas Gerais', 'Espírito Santo', 'Espirito Santo'];

let capaClon = null;

function inyectarPattern() {
    if (document.getElementById('stripes-pattern')) return;
    const div = document.createElement('div');
    div.innerHTML = `<svg width="0" height="0" style="position:absolute;z-index:-1;"><defs><pattern id="stripes-pattern" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M-10,10 l20,-20 M0,40 l40,-40 M30,50 l20,-20" stroke="rgba(0,0,0,0.3)" stroke-width="20" /><animateTransform attributeName="patternTransform" type="translate" from="0 0" to="0 -40" dur="2s" repeatCount="indefinite"/></pattern></defs></svg>`;
    document.body.appendChild(div);
}

function limpiarSeleccion() {
    if (capaClon) { map.removeLayer(capaClon); capaClon = null; }
}

function resaltarTerritorio(layer) {
    limpiarSeleccion();
    if (!layer.feature) return;
    capaClon = L.geoJSON(layer.feature, {
        style: { fillColor: 'url(#stripes-pattern)', fillOpacity: 1, color: 'transparent', weight: 0, interactive: false }
    }).addTo(map);
}

function addClickHover(layer, ejId, region, opBase, opHover) {
    layer.on('click', (e) => { 
        L.DomEvent.stopPropagation(e); 
        mostrarPanelTerritorio(ejId, region); 
        resaltarTerritorio(layer);
    });
    layer.on('mouseover', () => layer.setStyle({ fillOpacity: opHover }));
    layer.on('mouseout',  () => layer.setStyle({ fillOpacity: opBase  }));
}

function cargarGeografia() {
    // Argentina
    fetch('provincias.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            filter: f => ['Córdoba', 'Buenos Aires', 'La Pampa', 'Chubut'].includes(f.properties.nombre),
            style: f => {
                let id = 'Argentine_Army';
                if (f.properties.nombre === 'Córdoba') id = '25_REMASTER';
                else if (f.properties.nombre === 'La Pampa') id = 'RFA_LaPampa';
                else if (f.properties.nombre === 'Chubut') id = 'Imperio_Chubut';
                return geoStyle(id);
            },
            onEachFeature: (feature, layer) => {
                let id = 'Argentine_Army';
                let region = 'Buenos Aires, Argentina';
                if (feature.properties.nombre === 'Córdoba') { id = '25_REMASTER'; region = 'Cordoba, Argentina'; }
                else if (feature.properties.nombre === 'La Pampa') { id = 'RFA_LaPampa'; region = 'La Pampa, Argentina'; }
                else if (feature.properties.nombre === 'Chubut') { id = 'Imperio_Chubut'; region = 'Chubut, Argentina'; }
                const s = ESTILOS_GEO[id];
                addClickHover(layer, id, region, s.op, Math.min(s.op + 0.25, 0.9));
            }
        }).addTo(map);
    }).catch(e => console.log("Error cargando provincias:", e));
    
    // Chile completo
    fetch('https://raw.githubusercontent.com/georgique/world-geojson/develop/countries/chile.json')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('Ejercito_Chile'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'Ejercito_Chile', 'Chile', ESTILOS_GEO['Ejercito_Chile'].op, 0.80);
                }
            }).addTo(map);
        }).catch(e => console.log("Error cargando GeoJSON de Chile:", e));
    
    // Brasil
    fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                filter: f => EB_MIRAGE.includes(f.properties.name || ''),
                style: () => geoStyle('EB_Mirage'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'EB_Mirage', 'Rio de Janeiro, Brasil', ESTILOS_GEO['EB_Mirage'].op, 0.85);
                }
            }).addTo(map);

            L.geoJSON(data, {
                filter: f => EB_FUERTE.includes(f.properties.name || ''),
                style: () => ({ color: '#1a7a1a', weight: 2, fillColor: '#2ecc2e', fillOpacity: 0.48 }),
                onEachFeature: (feature, layer) => {
                    const region = (feature.properties.name || '') + ', Brasil';
                    addClickHover(layer, 'Exercito_Brasileiro', region, 0.48, 0.70);
                }
            }).addTo(map);

            L.geoJSON(data, {
                filter: f => !EB_MIRAGE.includes(f.properties.name || '') && !EB_FUERTE.includes(f.properties.name || ''),
                style: () => ({ color: '#1a7a1a', weight: 1, fillColor: '#2ecc2e', fillOpacity: 0.18 }),
                onEachFeature: (feature, layer) => {
                    const region = (feature.properties.name || '') + ', Brasil';
                    addClickHover(layer, 'Exercito_Brasileiro', region, 0.18, 0.38);
                }
            }).addTo(map);
        });

    // Finlandia
    fetch('https://raw.githubusercontent.com/georgique/world-geojson/refs/heads/develop/countries/finland.json')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('War_Front_Finland'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'War_Front_Finland', 'Finlandia', ESTILOS_GEO['War_Front_Finland'].op, 0.80);
                }
            }).addTo(map);
        });

    // Uruguay
    fetch('https://raw.githubusercontent.com/georgique/world-geojson/refs/heads/develop/countries/uruguay.json')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('Ejercito_Uruguayo'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'Ejercito_Uruguayo', 'Uruguay', ESTILOS_GEO['Ejercito_Uruguayo'].op, 0.80);
                }
            }).addTo(map);
        });

    // Colombia
    fetch('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/colombia.geojson')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('Ejercito_Colombia'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'Ejercito_Colombia', 'Colombia', ESTILOS_GEO['Ejercito_Colombia'].op, 0.80);
                }
            }).addTo(map);
        });

    // Falkland Islands (Islas Malvinas)
    fetch('https://raw.githubusercontent.com/georgique/world-geojson/develop/areas/united_kingdom/falkland_islands.json')
        .then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: () => geoStyle('FK_Zone'),
                onEachFeature: (feature, layer) => {
                    addClickHover(layer, 'FK_Zone', 'Islas Malvinas', ESTILOS_GEO['FK_Zone'].op, 0.85);
                }
            }).addTo(map);
        }).catch(e => console.log("Error cargando GeoJSON FK:", e));
}

// ==================== PANEL TERRITORIO ====================

const LINKS_JUEGO = {
    '25_REMASTER':         'https://www.roblox.com/games/119851378620864/25-REMASTER',
    'Argentine_Army':      'https://www.roblox.com/games/86744432712071/Argentine-Army',
    'Exercito_Brasileiro': 'https://www.roblox.com/games/2069320852/Ex-rcito-Brasileiro-EB',
    'EB_Mirage':           'https://www.roblox.com/games/73767462197411/EB-do-Mirage-Ex-rcito-Brasileiro',
    'War_Front_Finland':   'https://www.roblox.com/games/102445517344578/War-on-the-Front-Finland-RP',
    'Ejercito_Uruguayo':   'https://www.roblox.com/games/18893023733/Ejercito-Uruguayo',
    'Ejercito_Colombia':   'https://www.roblox.com/games/8575062452/ENC-Fuerte-Militar-Tolemaida',
    'FK_Zone':             'https://www.roblox.com/games/11531150499/Soledad-Island-Malvinas-2030',
    'Ejercito_Chile':      'https://www.roblox.com/games/99857138661549/Academia-Militar-de-Chile-El-Libertador',
    'Congreso_Chile':      'https://www.roblox.com/games/71789289496320/Congreso-Nacional',
    'Colombia_Conflict':   'https://www.roblox.com/games/107389230881781/Colombia',
    'RFA_LaPampa':         'https://www.roblox.com/games/94432191767668/RFA-Argentine-Armed-Forces#!/about',
    'Imperio_Chubut':      'https://www.roblox.com/games/135668711660767/Imperio-Argentino'
};

async function mostrarPanelTerritorio(ejercitoId, tituloRegion) {
    const panel = document.getElementById('panel-territorio');

    if (ejercitoId === 'FK_Zone' || ejercitoId === 'Colombia_Conflict') {
        document.getElementById('territorio-nombre').innerText = tituloRegion;
        document.getElementById('territorio-ejercito').innerText = 'Espacio de Lucha / Mapa Neutral';
        document.getElementById('territorio-desc').innerText = 'Territorio libre destinado exclusivamente a simulaciones de combate, guerra de guerrillas y operaciones tácticas inter-ejércitos. No posee facción gobernante.';
        document.getElementById('territorio-comandante-box').classList.add('oculto');
        document.getElementById('territorio-relaciones').innerHTML = '<span class="rel-vacio" style="color: #ff4422; font-weight: bold;">ZONA DE GUERRA LIBRE</span>';
    } else {
        const e = todosLosEjercitos[ejercitoId];
        document.getElementById('territorio-nombre').innerText = tituloRegion;
        document.getElementById('territorio-ejercito').innerText = e?.nombre || ejercitoId;
        document.getElementById('territorio-desc').innerText = e?.descripcion || 'Sin informacion disponible.';
        document.getElementById('territorio-comandante-box').classList.remove('oculto');

        document.getElementById('territorio-lider').innerText = '...';
        const cmd = await obtenerComandanteRoblox(ejercitoId);
        document.getElementById('territorio-lider').innerText = cmd || 'Sin registrar';
        renderizarRelaciones(ejercitoId);
    }

    document.getElementById('territorio-btn-juego').href = LINKS_JUEGO[ejercitoId] || '#';
    
    // Logica de acciones diplomaticas
    window.territorioInspeccionado = ejercitoId;
    const esZonaNeutra = ejercitoId === 'FK_Zone' || ejercitoId === 'Colombia_Conflict';
    const esPropioEjercito = ejercitoActual && ejercitoActual === ejercitoId;

    const boxDiplo = document.getElementById('ter-acciones-diplo');
    if (boxDiplo) {
        if (ejercitoActual && !esPropioEjercito && !esZonaNeutra) {
            boxDiplo.classList.remove('oculto');
        } else {
            boxDiplo.classList.add('oculto');
        }
    }

    // Logica de suministros: solo si es comandante, NO es su propio eje, y la relacion NO es Enemigo
    const boxSuministros = document.getElementById('ter-suministros');
    if (boxSuministros) {
        if (ejercitoActual && !esPropioEjercito && !esZonaNeutra) {
            // Verificar si la relacion con ese ejercito es Enemigo
            const relacion = todasLasRelaciones.find(r =>
                (r.ejercito_a === ejercitoActual && r.ejercito_b === ejercitoId) ||
                (r.ejercito_b === ejercitoActual && r.ejercito_a === ejercitoId)
            );
            const esEnemigo = relacion && relacion.tipo === 'Enemigo' && relacion.estado === 'Aprobado';
            if (esEnemigo) {
                boxSuministros.classList.add('oculto');
            } else {
                boxSuministros.classList.remove('oculto');
            }
        } else {
            boxSuministros.classList.add('oculto');
        }
    }

    panel.classList.remove('oculto');
    void panel.offsetWidth;
    panel.classList.add('entrando');
    setTimeout(() => panel.classList.remove('entrando'), 280);
}

// --- Boton de suministros → Edge Function real ---
document.getElementById('btn-enviar-suministro').onclick = async () => {
    const btn = document.getElementById('btn-enviar-suministro');
    const msj = document.getElementById('ter-msj-suministro');
    const tipo = document.getElementById('ter-sel-suministro').value;
    const destino = window.territorioInspeccionado;

    if (!destino) return;

    btn.disabled = true;
    btn.innerText = '...';
    msj.style.color = 'yellow';
    msj.innerText = 'Enviando ' + tipo + '...';

    try {
        // Obtener el JWT del usuario autenticado
        const { data: { session } } = await clienteSupabase.auth.getSession();
        if (!session) {
            msj.style.color = '#cc3333';
            msj.innerText = 'Error: no autenticado.';
            btn.disabled = false; btn.innerText = 'ENVIAR';
            return;
        }

        const res = await fetch(
            'https://hwyedjcprazfnzgvughb.supabase.co/functions/v1/enviar-suministros',
            {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    ejercito_destino: destino,
                    tipo_suministro:  tipo,
                }),
            }
        );

        const data = await res.json();

        if (res.ok) {
            msj.style.color = '#32CD32';
            msj.innerText = '✓ ' + (data.mensaje || 'Enviado con exito');
        } else {
            msj.style.color = '#cc3333';
            msj.innerText = '✗ ' + (data.error || 'Error al enviar');
        }
    } catch (e) {
        msj.style.color = '#cc3333';
        msj.innerText = '✗ Error de red.';
        console.error('Error suministros:', e);
    }

    btn.disabled = false;
    btn.innerText = 'ENVIAR';
    setTimeout(() => msj.innerText = '', 5000);
};

function renderizarRelaciones(ejercitoId) {
    const cont = document.getElementById('territorio-relaciones');
    const rel = todasLasRelaciones.filter(r => r.ejercito_a === ejercitoId || r.ejercito_b === ejercitoId);
    
    let html = '';
    if (rel.length === 0) { 
        html = '<span class="rel-vacio">Todos los demás ejércitos son NEUTRALES.</span>'; 
    } else {
        html = rel.map(r => {
            const otroId = r.ejercito_a === ejercitoId ? r.ejercito_b : r.ejercito_a;
            const nombre = todosLosEjercitos[otroId]?.nombre || otroId;
            
            let color = '#555';
            let texto = r.tipo.toUpperCase();
            
            if (r.estado === 'Pendiente') {
                color = '#ff8c00'; // Naranja
                texto = 'ALIANZA PENDIENTE';
            } else {
                color = r.tipo === 'Aliado' ? '#32CD32' : r.tipo === 'Enemigo' ? '#cc3333' : '#555';
            }
            
            const borde = color;
            return `<div class="rel-item" style="border-left-color:${borde}">
                <span>${nombre}</span>
                <span style="color:${color}">${texto}</span>
            </div>`;
        }).join('');
        html += '<div style="font-size:9px;color:#666;margin-top:8px;font-family:var(--mono);">* El resto del mundo es Neutral.</div>';
    }
    
    cont.innerHTML = html;
}

function cerrarPanelTerritorio() { 
    document.getElementById('panel-territorio').classList.add('oculto'); 
    limpiarSeleccion();
}
document.getElementById('btn-cerrar-territorio').onclick = cerrarPanelTerritorio;
