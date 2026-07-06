// ==================== CAPA DE LOGISTICA EN TRANSITO ====================
// Dibuja en el mapa los envios de suministros activos: una linea punteada
// de origen a destino y un icono que avanza segun el progreso del viaje
// (created_at -> eta_at). Visible para todos los visitantes del mapa.

const LOGISTICA_REFRESCO_MS = 30000;  // re-consulta a Supabase cada 30 s
const LOGISTICA_TICK_MS     = 2000;   // actualiza la posicion del icono cada 2 s

const ICONO_MEDIO = {
    terrestre:   '🚚',
    ferroviario: '🚂',
    aereo:       '✈️',
    naval:       '🚢',
};

const ESTADO_LABEL = {
    Pendiente:   'Preparando salida',
    EnTransito:  'En tránsito',
    Llegando:    'Llegando al destino',
    Descargando: 'Descargando en destino',
};

let logisticaCapa = null;      // L.layerGroup con lineas + iconos
let logisticaEnvios = [];      // envios activos de la ultima consulta
let logisticaMarcadores = {};  // id -> { marker, linea, envio }

function logisticaCoords(ejId) {
    return (window.COORDS_BASES && window.COORDS_BASES[ejId]) || null;
}

async function consultarEnviosActivos() {
    // El filtro de eta_at evita que queden convoyes "fantasma" de ejércitos
    // que usan el script simple (nunca transicionan de estado): a los 30 min
    // de pasada la ETA dejan de dibujarse.
    const margen = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await clienteSupabase
        .from('historial_suministros')
        .select('id, created_at, ejercito_origen, ejercito_destino, tipo_suministro, medio, cantidad, eta_at, estado')
        .in('estado', ['Pendiente', 'EnTransito', 'Llegando', 'Descargando'])
        .gte('eta_at', margen)
        .order('id', { ascending: true });
    if (error) { console.warn('[Logistica] Error consultando envios:', error.message); return []; }
    return data || [];
}

function progresoDe(envio) {
    if (!envio.eta_at) return 0;
    const inicio = new Date(envio.created_at).getTime();
    const fin    = new Date(envio.eta_at).getTime();
    if (fin <= inicio) return 1;
    return Math.min(1, Math.max(0, (Date.now() - inicio) / (fin - inicio)));
}

function posicionInterpolada(a, b, t) {
    // Interpolacion lineal con un pequeño arco (offset lateral) para que la
    // ruta no tape la linea recta y se lea como trayecto
    const lat = a[0] + (b[0] - a[0]) * t;
    const lng = a[1] + (b[1] - a[1]) * t;
    const arco = Math.sin(t * Math.PI) * 1.2; // grados de "curvatura"
    return [lat + arco, lng];
}

function textoPopup(envio) {
    const origen  = (todosLosEjercitos[envio.ejercito_origen]?.nombre) || envio.ejercito_origen;
    const destino = (todosLosEjercitos[envio.ejercito_destino]?.nombre) || envio.ejercito_destino;
    const icono   = ICONO_MEDIO[envio.medio] || '📦';
    const estado  = ESTADO_LABEL[envio.estado] || envio.estado;

    let eta = '';
    if (envio.eta_at && (envio.estado === 'Pendiente' || envio.estado === 'EnTransito')) {
        const restanteMs = new Date(envio.eta_at).getTime() - Date.now();
        eta = restanteMs > 0
            ? `<br>ETA: <b>${Math.max(1, Math.round(restanteMs / 60000))} min</b>`
            : '<br>ETA: <b>inminente</b>';
    }

    return `<div style="font-family:monospace;font-size:11px;">
        ${icono} <b>${(envio.tipo_suministro || '').toUpperCase()}</b> ×${envio.cantidad || '?'}<br>
        ${origen} → ${destino}<br>
        Estado: <b>${estado}</b>${eta}
    </div>`;
}

function dibujarEnvio(envio) {
    const a = logisticaCoords(envio.ejercito_origen);
    const b = logisticaCoords(envio.ejercito_destino);
    if (!a || !b) return; // ejercito sin base marcada en el mapa

    const linea = L.polyline([a, b], {
        color: '#32CD32', weight: 2, opacity: 0.55, dashArray: '6,8', interactive: false,
    });

    const t = progresoDe(envio);
    const icon = L.divIcon({
        className: 'convoy-icono',
        html: `<div style="font-size:22px;filter:drop-shadow(0 0 3px #000);">${ICONO_MEDIO[envio.medio] || '📦'}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
    });
    const marker = L.marker(posicionInterpolada(a, b, t), { icon });
    marker.bindPopup(textoPopup(envio));

    logisticaCapa.addLayer(linea);
    logisticaCapa.addLayer(marker);
    logisticaMarcadores[envio.id] = { marker, linea, envio };
}

async function refrescarLogistica() {
    if (!map) return;
    if (!logisticaCapa) { logisticaCapa = L.layerGroup().addTo(map); }

    logisticaEnvios = await consultarEnviosActivos();

    // Redibujar todo (pocos envios simultaneos: barato y simple)
    logisticaCapa.clearLayers();
    logisticaMarcadores = {};
    logisticaEnvios.forEach(dibujarEnvio);
}

function animarLogistica() {
    for (const id in logisticaMarcadores) {
        const { marker, envio } = logisticaMarcadores[id];
        const a = logisticaCoords(envio.ejercito_origen);
        const b = logisticaCoords(envio.ejercito_destino);
        if (!a || !b) continue;
        marker.setLatLng(posicionInterpolada(a, b, progresoDe(envio)));
        if (marker.isPopupOpen()) marker.setPopupContent(textoPopup(envio));
    }
}

function iniciarLogisticaMapa() {
    refrescarLogistica();
    setInterval(refrescarLogistica, LOGISTICA_REFRESCO_MS);
    setInterval(animarLogistica, LOGISTICA_TICK_MS);
}
