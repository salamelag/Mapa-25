// =====================================================================
//  MAPA-25 · Globo 3D — APP COMPLETA (MapLibre GL, proyección globe)
//  Toda la funcionalidad del mapa 2D portada: auth, barra de comando,
//  galería de símbolos tácticos (colocar/rotar/mover), logística animada,
//  panel territorio con diplomacia y suministros, presencia LIVE.
//  Rotación automática del globo al estar AFK.
// =====================================================================
(function () {
  'use strict';

  // ------------------------- CONFIG -------------------------
  const supabaseUrl = 'https://hwyedjcprazfnzgvughb.supabase.co';
  const supabaseKey = 'sb_publishable_0DtFI1RtzZAgNGN0GJOW1g_Qg-mwebE';
  let clienteSupabase = null;
  try { if (window.supabase && window.supabase.createClient) clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey); } catch (e) {}

  let usuarioActual = null;
  let ejercitoActual = null;
  let todosLosEjercitos = {};
  let todasLasRelaciones = [];
  let map;

  // ===== Admin / configuración de medios de transporte =====
  const ADMIN_EMAILS = []; // <-- añade aquí tu correo para ver el panel de admin (o usa ?admin=1)
  let esAdmin = false;
  const MEDIOS_DEFAULT = { terrestre: true, ferroviario: true, aereo: true, naval: true };
  const MEDIO_LABEL = { terrestre: 'Terrestre (10 min)', ferroviario: 'Ferroviario (15 min)', aereo: 'Aereo (5 min)', naval: 'Naval (25 min)' };
  function cargarMediosConfig() { try { return Object.assign({}, MEDIOS_DEFAULT, JSON.parse(localStorage.getItem('mapa25_medios') || '{}')); } catch (e) { return Object.assign({}, MEDIOS_DEFAULT); } }
  function guardarMediosConfig() { try { localStorage.setItem('mapa25_medios', JSON.stringify(mediosConfig)); } catch (e) {} }
  let mediosConfig = cargarMediosConfig();
  function aplicarMediosDropdown() {
    const sel = document.getElementById('ter-sel-transporte');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    ['terrestre', 'ferroviario', 'aereo', 'naval'].forEach(m => {
      if (mediosConfig[m]) { const o = document.createElement('option'); o.value = m; o.textContent = MEDIO_LABEL[m]; sel.appendChild(o); }
    });
    if ([].slice.call(sel.options).some(o => o.value === prev)) sel.value = prev;
  }
  function initAdmin() {
    const panel = document.getElementById('panel-admin'), btn = document.getElementById('btn-admin'), cerrar = document.getElementById('btn-cerrar-admin');
    if (btn && panel) btn.onclick = () => panel.classList.toggle('oculto');
    if (cerrar && panel) cerrar.onclick = () => panel.classList.add('oculto');
    document.querySelectorAll('.admin-medio').forEach(chk => {
      chk.checked = !!mediosConfig[chk.value];
      chk.onchange = () => { mediosConfig[chk.value] = chk.checked; guardarMediosConfig(); aplicarMediosDropdown(); };
    });
  }

  // ===== Zonas de guerra (pulso rojo) =====
  const ZONAS_GUERRA = ['FK_Zone', 'Colombia_Conflict'];
  const warLayers = [];
  let pulsoIniciado = false;
  function iniciarPulsoGuerra() {
    if (pulsoIniciado) return; pulsoIniciado = true;
    (function tick() {
      const s = (Math.sin(Date.now() / 380) + 1) / 2;
      warLayers.forEach(id => { if (map && map.getLayer && map.getLayer(id)) { map.setPaintProperty(id, 'line-width', 2 + s * 4); map.setPaintProperty(id, 'line-opacity', 0.35 + s * 0.5); } });
      requestAnimationFrame(tick);
    })();
  }

  // ===== Ruteo de convoyes (por medio de transporte) =====
  const rutasCache = {};
  function claveRuta(e) { return e.ejercito_origen + '|' + e.ejercito_destino + '|' + e.medio; }
  function arcoGranCirculo(a, b, n) {
    const toRad = x => x * Math.PI / 180, toDeg = x => x * 180 / Math.PI;
    const lat1 = toRad(a[0]), lon1 = toRad(a[1]), lat2 = toRad(b[0]), lon2 = toRad(b[1]);
    const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
    if (!d) return [[a[1], a[0]], [b[1], b[0]]];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
      const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
      const z = A * Math.sin(lat1) + B * Math.sin(lat2);
      pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
    }
    return pts;
  }
  async function rutaOSRM(a, b) {
    try {
      const url = 'https://router.project-osrm.org/route/v1/driving/' + a[1] + ',' + a[0] + ';' + b[1] + ',' + b[0] + '?overview=full&geometries=geojson';
      const r = await fetch(url); const j = await r.json();
      if (j && j.routes && j.routes[0] && j.routes[0].geometry) return j.routes[0].geometry.coordinates;
    } catch (e) {}
    return null;
  }
  async function caminoDe(envio) {
    const k = claveRuta(envio);
    if (rutasCache[k]) return rutasCache[k];
    const a = logisticaCoords(envio.ejercito_origen), b = logisticaCoords(envio.ejercito_destino);
    if (!a || !b) return null;
    let path = null;
    if (envio.medio === 'terrestre' || envio.medio === 'ferroviario') {
      // tren: no hay API gratuita de vías férreas → ruta vehicular real como simulación (misma duración, la marca el ETA)
      path = await rutaOSRM(a, b);
      if (!path || path.length < 2) path = arcoGranCirculo(a, b, 64);
    } else {
      // aéreo / naval → arco de gran círculo (vía aérea / marítima)
      path = arcoGranCirculo(a, b, 64);
    }
    rutasCache[k] = path;
    return path;
  }
  function largoAcumulado(path) { const acc = [0]; let tot = 0; for (let i = 1; i < path.length; i++) { tot += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); acc.push(tot); } return { acc, tot }; }
  function posEnPath(path, t) {
    if (!path || path.length < 2) return path ? path[0] : [0, 0];
    const m = path.__m || (path.__m = largoAcumulado(path));
    if (!m.tot) return path[0];
    const d = t * m.tot;
    for (let i = 1; i < path.length; i++) { if (m.acc[i] >= d) { const seg = m.acc[i] - m.acc[i - 1] || 1, f = (d - m.acc[i - 1]) / seg; return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]; } }
    return path[path.length - 1];
  }

  // ===== Espectador / compartir vista =====
  function irAObjetivo(ejId) {
    const c = window.COORDS_BASES && window.COORDS_BASES[ejId];
    if (!c || !map) return;
    map.flyTo({ center: [c[1], c[0]], zoom: 5, duration: 2600, essential: true });
    const base = DATOS_BASES.find(d => d.ejId === ejId);
    lastInteraccion = Date.now() + 2600;
    setTimeout(() => mostrarPanelTerritorio(ejId, base ? base.region : ''), 2700);
  }

  const EJERCITOS_FALLBACK = {
    '25_REMASTER':        { id: '25_REMASTER',        nombre: '25 REMASTER',        descripcion: 'Comando central de Río Negro. Base de operaciones en San Carlos de Bariloche, teatro patagónico norte.', lider: '' },
    'Argentine_Army':     { id: 'Argentine_Army',     nombre: 'Argentine Army',     descripcion: 'Fuerza regular con base en Campo de Mayo, Buenos Aires.', lider: '' },
    'RFA_LaPampa':        { id: 'RFA_LaPampa',        nombre: 'RFA — La Pampa',      descripcion: 'Regimiento de Infantería Mecanizado 6. Control del corredor pampeano.', lider: '' },
    'Imperio_Chubut':     { id: 'Imperio_Chubut',     nombre: 'Imperio Argentino',  descripcion: 'Dominio patagónico con eje en Trelew, Chubut.', lider: '' },
    'Exercito_Brasileiro':{ id: 'Exercito_Brasileiro',nombre: 'Exército Brasileiro',descripcion: 'Comando federal con capital operativa en Brasília.', lider: '' },
    'EB_Mirage':          { id: 'EB_Mirage',          nombre: 'EB do Mirage',        descripcion: 'Agrupación de Río de Janeiro y São Paulo.', lider: '' },
    'War_Front_Finland':  { id: 'War_Front_Finland',  nombre: 'War on the Front',    descripcion: 'Frente nórdico operando desde Helsinki, Finlandia.', lider: '' },
    'Ejercito_Uruguayo':  { id: 'Ejercito_Uruguayo',  nombre: 'Ejército Uruguayo',   descripcion: 'Fuerza de Montevideo, República Oriental del Uruguay.', lider: '' },
    'Ejercito_Colombia':  { id: 'Ejercito_Colombia',  nombre: 'Ejército de Colombia', descripcion: 'Fuerte Militar de Tolemaida. Comando andino norte.', lider: '' },
    'Ejercito_Chile':     { id: 'Ejercito_Chile',     nombre: 'Ejército de Chile',   descripcion: 'Academia Militar El Libertador, Santiago.', lider: '' },
    'Congreso_Chile':     { id: 'Congreso_Chile',     nombre: 'Congreso Nacional',   descripcion: 'Sede legislativa en Valparaíso.', lider: '' },
    'Ejercito_Peru':      { id: 'Ejercito_Peru',      nombre: 'Ejército del Perú',   descripcion: 'Base Lima. Comando del Pacífico central.', lider: '' }
  };

  const ESTILOS_GEO = {
    '25_REMASTER':         { borde: '#1ab4ff', fill: '#90d8f5', op: 0.38 },
    'Argentine_Army':      { borde: '#2244cc', fill: '#4466ee', op: 0.42 },
    'Exercito_Brasileiro': { borde: '#1a7a1a', fill: '#2ecc2e', op: 0.28 },
    'EB_Mirage':           { borde: '#007700', fill: '#00bb00', op: 0.62 },
    'War_Front_Finland':   { borde: '#5a6472', fill: '#7d8794', op: 0.58 },
    'Ejercito_Uruguayo':   { borde: '#0038a8', fill: '#7bafd4', op: 0.45 },
    'Ejercito_Colombia':   { borde: '#ccaa00', fill: '#ffea00', op: 0.45 },
    'FK_Zone':             { borde: '#ff2200', fill: '#ff4422', op: 0.50 },
    'Ejercito_Chile':      { borde: '#cc2222', fill: '#ff4444', op: 0.40 },
    'Congreso_Chile':      { borde: '#0033aa', fill: '#3366ff', op: 0.30 },
    'RFA_LaPampa':         { borde: '#008b8b', fill: '#00ced1', op: 0.45 },
    'Imperio_Chubut':      { borde: '#8a2be2', fill: '#9370db', op: 0.45 },
    'Ejercito_Peru':       { borde: '#cc2222', fill: '#ff4444', op: 0.40 }
  };

  const LINKS_JUEGO = {
    '25_REMASTER':'https://www.roblox.com/games/119851378620864/25-REMASTER',
    'Argentine_Army':'https://www.roblox.com/games/86744432712071/Argentine-Army',
    'Exercito_Brasileiro':'https://www.roblox.com/games/2069320852/Ex-rcito-Brasileiro-EB',
    'EB_Mirage':'https://www.roblox.com/games/73767462197411/EB-do-Mirage-Ex-rcito-Brasileiro',
    'War_Front_Finland':'https://www.roblox.com/games/102445517344578/War-on-the-Front-Finland-RP',
    'Ejercito_Uruguayo':'https://www.roblox.com/games/18893023733/Ejercito-Uruguayo',
    'Ejercito_Colombia':'https://www.roblox.com/games/10358242329/Ejercito-Nacional-Colombiano#!/about',
    'FK_Zone':'https://www.roblox.com/games/11531150499/Soledad-Island-Malvinas-2030',
    'Ejercito_Chile':'https://www.roblox.com/games/99857138661549/Academia-Militar-de-Chile-El-Libertador',
    'Congreso_Chile':'https://www.roblox.com/games/71789289496320/Congreso-Nacional',
    'Colombia_Conflict':'https://www.roblox.com/games/107389230881781/Colombia',
    'RFA_LaPampa':'https://www.roblox.com/games/94432191767668/RFA-Argentine-Armed-Forces#!/about',
    'Imperio_Chubut':'https://www.roblox.com/games/135668711660767/Imperio-Argentino',
    'Ejercito_Peru':'https://www.roblox.com/games/72217709762960/Base-G-Briceno-Zevallos'
  };

  // ------------------------- API -------------------------
  async function cargarDatosEjercitos() {
    if (!clienteSupabase) return;
    const { data: ejercitos } = await clienteSupabase.from('ejercitos').select('*');
    if (ejercitos) ejercitos.forEach(e => { todosLosEjercitos[e.id] = e; });
    const { data: relaciones } = await clienteSupabase.from('relaciones').select('*');
    if (relaciones) todasLasRelaciones = relaciones;
  }
  function iniciarPresencia() {
    if (!clienteSupabase) return;
    const canal = clienteSupabase.channel('mapa-presencia-v2', { config: { presence: { key: Math.random().toString(36).slice(2) } } });
    canal.on('presence', { event: 'sync' }, () => { const el = document.getElementById('num-visitantes'); if (el) el.innerText = Object.keys(canal.presenceState()).length; });
    canal.subscribe(async (status) => { if (status === 'SUBSCRIBED') await canal.track({ t: Date.now() }); });
  }
  async function obtenerComandanteRoblox(ejercitoId) {
    if (!clienteSupabase) return null;
    if (ejercitoId === 'FK_Zone' || ejercitoId === 'Colombia_Conflict') return null;
    try {
      const { data } = await clienteSupabase.from('peticiones').select('usuario_roblox').eq('ejercito', ejercitoId).eq('estado', 'Aprobado').limit(1);
      return (data && data.length > 0) ? data[0].usuario_roblox : null;
    } catch (e) { return null; }
  }

  // ------------------------- PANEL TERRITORIO -------------------------
  function renderizarRelaciones(ejercitoId) {
    const cont = document.getElementById('territorio-relaciones');
    const rel = todasLasRelaciones.filter(r => r.ejercito_a === ejercitoId || r.ejercito_b === ejercitoId);
    if (rel.length === 0) { cont.innerHTML = '<span class="rel-vacio">Todos los demás ejércitos son NEUTRALES.</span>'; return; }
    let html = rel.map(r => {
      const otroId = r.ejercito_a === ejercitoId ? r.ejercito_b : r.ejercito_a;
      const nombre = (todosLosEjercitos[otroId] && todosLosEjercitos[otroId].nombre) || otroId;
      let color = '#6b7280', texto = r.tipo.toUpperCase();
      if (r.estado === 'Pendiente') { color = '#ff9e2c'; texto = 'ALIANZA PENDIENTE'; }
      else { color = r.tipo === 'Aliado' ? '#3ddc84' : r.tipo === 'Enemigo' ? '#ff5a3c' : '#6b7280'; }
      return '<div class="rel-item" style="border-left-color:' + color + '"><span>' + nombre + '</span><span style="color:' + color + '">' + texto + '</span></div>';
    }).join('');
    html += '<div style="font-size:9px;color:#5b6472;margin-top:8px;font-family:var(--mono);">* El resto del mundo es Neutral.</div>';
    cont.innerHTML = html;
  }

  async function mostrarPanelTerritorio(ejercitoId, tituloRegion) {
    const panel = document.getElementById('panel-territorio');
    if (ejercitoId === 'FK_Zone' || ejercitoId === 'Colombia_Conflict') {
      document.getElementById('territorio-nombre').innerText = tituloRegion;
      document.getElementById('territorio-ejercito').innerText = 'Espacio de Lucha / Mapa Neutral';
      document.getElementById('territorio-desc').innerText = 'Territorio libre destinado exclusivamente a simulaciones de combate, guerra de guerrillas y operaciones tácticas inter-ejércitos. No posee facción gobernante.';
      document.getElementById('territorio-comandante-box').classList.add('oculto');
      document.getElementById('territorio-relaciones').innerHTML = '<span class="rel-vacio" style="color:#ff5a3c;font-weight:bold;">ZONA DE GUERRA LIBRE</span>';
    } else {
      const e = todosLosEjercitos[ejercitoId];
      document.getElementById('territorio-nombre').innerText = tituloRegion;
      document.getElementById('territorio-ejercito').innerText = (e && e.nombre) || ejercitoId;
      document.getElementById('territorio-desc').innerText = (e && e.descripcion) || 'Sin informacion disponible.';
      document.getElementById('territorio-comandante-box').classList.remove('oculto');
      document.getElementById('territorio-lider').innerText = '...';
      let cmd = null;
      try { cmd = await obtenerComandanteRoblox(ejercitoId); } catch (_) {}
      document.getElementById('territorio-lider').innerText = cmd || 'Sin registrar';
      renderizarRelaciones(ejercitoId);
    }
    document.getElementById('territorio-btn-juego').href = LINKS_JUEGO[ejercitoId] || '#';

    window.territorioInspeccionado = ejercitoId;
    const esZonaNeutra = ejercitoId === 'FK_Zone' || ejercitoId === 'Colombia_Conflict';
    const esPropioEjercito = ejercitoActual && ejercitoActual === ejercitoId;

    const boxDiplo = document.getElementById('ter-acciones-diplo');
    if (boxDiplo) boxDiplo.classList.toggle('oculto', !(ejercitoActual && !esPropioEjercito && !esZonaNeutra));

    const boxSuministros = document.getElementById('ter-suministros');
    if (boxSuministros) {
      if (ejercitoActual && !esPropioEjercito && !esZonaNeutra) {
        const relacion = todasLasRelaciones.find(r => (r.ejercito_a === ejercitoActual && r.ejercito_b === ejercitoId) || (r.ejercito_b === ejercitoActual && r.ejercito_a === ejercitoId));
        const esEnemigo = relacion && relacion.tipo === 'Enemigo' && relacion.estado === 'Aprobado';
        boxSuministros.classList.toggle('oculto', !!esEnemigo);
        if (!esEnemigo) aplicarMediosDropdown();
      } else { boxSuministros.classList.add('oculto'); }
    }

    panel.classList.remove('oculto');
    void panel.offsetWidth;
    panel.classList.add('entrando');
    setTimeout(() => panel.classList.remove('entrando'), 280);
  }
  function cerrarPanelTerritorio() { const p = document.getElementById('panel-territorio'); if (p) p.classList.add('oculto'); }

  // ------------------------- CAPAS DE TERRITORIO -------------------------
  const FILL_LAYERS = [];
  function agregarCapaTerritorio(sid, ejId, data, regionDe, opOverride) {
    const s = ESTILOS_GEO[ejId] || { borde: '#8a939f', fill: '#aab2bd', op: 0.3 };
    const opBase = Math.min(opOverride != null ? opOverride : s.op, 0.60);
    if (map.getSource(sid)) return;
    map.addSource(sid, { type: 'geojson', data });
    map.addLayer({ id: sid + '-fill', type: 'fill', source: sid, paint: { 'fill-color': s.fill, 'fill-opacity': opBase } });
    map.addLayer({ id: sid + '-line', type: 'line', source: sid, paint: { 'line-color': s.borde, 'line-width': 1.2, 'line-opacity': 0.9 } });
    FILL_LAYERS.push(sid + '-fill');
    if (ejId === 'FK_Zone') { map.addLayer({ id: sid + '-war', type: 'line', source: sid, paint: { 'line-color': '#ff2a2a', 'line-width': 3, 'line-opacity': 0.8, 'line-blur': 1 } }); warLayers.push(sid + '-war'); iniciarPulsoGuerra(); }
    map.on('click', sid + '-fill', (e) => {
      if (window.simboloEnMano) return; // colocando símbolo: no abrir panel
      const props = (e.features && e.features[0] && e.features[0].properties) || {};
      mostrarPanelTerritorio(ejId, regionDe ? regionDe(props) : '');
    });
    map.on('mouseenter', sid + '-fill', () => { map.getCanvas().style.cursor = 'pointer'; map.setPaintProperty(sid + '-fill', 'fill-opacity', Math.min(opBase + 0.25, 0.85)); });
    map.on('mouseleave', sid + '-fill', () => { map.getCanvas().style.cursor = ''; map.setPaintProperty(sid + '-fill', 'fill-opacity', opBase); });
  }

  function cargarGeografia() {
    const gj = (url) => fetch(url).then(r => r.json());

    // Argentina — provincias locales (geo/)
    const PROVINCIAS_AR = [
      { file: 'geo/RIONEGRO.json',    ejId: '25_REMASTER',    region: 'Río Negro, Argentina', sid: 'arg-rionegro' },
      { file: 'geo/BUENOSAIRES.json', ejId: 'Argentine_Army', region: 'Buenos Aires, Argentina', sid: 'arg-bsas' },
      { file: 'geo/LAPAMPA.json',     ejId: 'RFA_LaPampa',    region: 'La Pampa, Argentina', sid: 'arg-lapampa' },
      { file: 'geo/CHUBUT.json',      ejId: 'Imperio_Chubut', region: 'Chubut, Argentina', sid: 'arg-chubut' }
    ];
    PROVINCIAS_AR.forEach(p => {
      gj(p.file).then(d => agregarCapaTerritorio(p.sid, p.ejId, d, () => p.region)).catch(e => console.log('Provincia ' + p.file + ':', e && e.message));
    });

    gj('https://raw.githubusercontent.com/georgique/world-geojson/develop/countries/chile.json')
      .then(d => agregarCapaTerritorio('chile', 'Ejercito_Chile', d, () => 'Chile')).catch(() => {});

    gj('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson').then(data => {
      const EB_MIRAGE = ['Rio de Janeiro', 'São Paulo', 'Sao Paulo', 'Minas Gerais', 'Espírito Santo', 'Espirito Santo'];
      const mirage = data.features.filter(f => EB_MIRAGE.includes(f.properties.name || ''));
      const resto = data.features.filter(f => !EB_MIRAGE.includes(f.properties.name || ''));
      agregarCapaTerritorio('br-mirage', 'EB_Mirage', { type: 'FeatureCollection', features: mirage }, () => 'Rio de Janeiro, Brasil');
      agregarCapaTerritorio('br-eb', 'Exercito_Brasileiro', { type: 'FeatureCollection', features: resto }, p => (p.name || '') + ', Brasil', 0.18);
    }).catch(() => {});

    gj('https://raw.githubusercontent.com/georgique/world-geojson/refs/heads/develop/countries/finland.json')
      .then(d => agregarCapaTerritorio('finlandia', 'War_Front_Finland', d, () => 'Finlandia')).catch(() => {});
    gj('https://raw.githubusercontent.com/georgique/world-geojson/refs/heads/develop/countries/uruguay.json')
      .then(d => agregarCapaTerritorio('uruguay', 'Ejercito_Uruguayo', d, () => 'Uruguay')).catch(() => {});
    gj('https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/colombia.geojson')
      .then(d => agregarCapaTerritorio('colombia', 'Ejercito_Colombia', d, () => 'Colombia')).catch(() => {});
    gj('https://raw.githubusercontent.com/georgique/world-geojson/refs/heads/develop/countries/peru.json')
      .then(d => agregarCapaTerritorio('peru', 'Ejercito_Peru', d, () => 'Peru')).catch(() => {});
    gj('https://raw.githubusercontent.com/georgique/world-geojson/develop/areas/united_kingdom/falkland_islands.json')
      .then(d => agregarCapaTerritorio('malvinas', 'FK_Zone', d, () => 'Islas Malvinas')).catch(() => {});
  }

  // ------------------------- MARCADORES DE BASES -------------------------
  const DATOS_BASES = [
    { coords: [-41.133472, -71.310278], label: 'Bariloche', ejId: '25_REMASTER', region: 'Río Negro, Argentina', img: 'https://tr.rbxcdn.com/180DAY-497759da09e81380981e232ce398392b/256/256/Image/Webp/noFilter' },
    { coords: [-34.533805, -58.649166], label: 'Campo de Mayo', ejId: 'Argentine_Army', region: 'Buenos Aires, Argentina', img: 'https://tr.rbxcdn.com/180DAY-cdfd2b3c913f59789ac50bda58fa8e97/256/256/Image/Webp/noFilter' },
    { coords: [-15.778361, -47.905083], label: 'Brasilia', ejId: 'Exercito_Brasileiro', region: 'Brasilia, Brasil', img: 'https://tr.rbxcdn.com/180DAY-40a3b8aacb25617525f5903f172f4db8/256/256/Image/Webp/noFilter' },
    { coords: [-22.9068, -43.1729], label: 'Rio de Janeiro', ejId: 'EB_Mirage', region: 'Rio de Janeiro, Brasil', img: 'https://tr.rbxcdn.com/180DAY-05b3c4bc174a604f84a4cde981d7975c/256/256/Image/Webp/noFilter' },
    { coords: [60.1699, 24.9384], label: 'Helsinki', ejId: 'War_Front_Finland', region: 'Helsinki, Finlandia', img: 'https://tr.rbxcdn.com/180DAY-d1401c2af40cc8338406405cf7734c51/256/256/Image/Webp/noFilter' },
    { coords: [-34.9011, -56.1645], label: 'Montevideo', ejId: 'Ejercito_Uruguayo', region: 'Montevideo, Uruguay', img: 'https://tr.rbxcdn.com/180DAY-678a18d475f292e91b46914384aff56e/256/256/Image/Webp/noFilter' },
    { coords: [4.24, -74.64], label: 'Fuerte Militar Tolemaida', ejId: 'Ejercito_Colombia', region: 'Tolemaida, Colombia', img: 'https://tr.rbxcdn.com/180DAY-3b03dfa0e5c65bfb164ed0c08ebd7e63/256/256/Image/Webp/noFilter' },
    { coords: [-51.7963, -59.5236], label: 'Islas Malvinas (Zona de Lucha)', ejId: 'FK_Zone', region: 'Islas Malvinas', img: 'https://tr.rbxcdn.com/180DAY-ff9a30bdc11fd1a21e07cdf3837b6757/352/352/Image/Png/noFilter' },
    { coords: [-33.4132, -70.5796], label: 'Escuela Militar', ejId: 'Ejercito_Chile', region: 'Santiago, Chile', img: 'https://tr.rbxcdn.com/180DAY-6d15efeaa6c140b24fb4486eb7eaea9e/150/150/Image/Webp/noFilter' },
    { coords: [-33.0475, -71.6133], label: 'Congreso Nacional', ejId: 'Congreso_Chile', region: 'Valparaíso, Chile', img: 'https://tr.rbxcdn.com/180DAY-063b85b1f16c771a04d66a39917f351c/150/150/Image/Webp/noFilter' },
    { coords: [6.2442, -75.5812], label: 'Medellín (Zona de Lucha)', ejId: 'Colombia_Conflict', region: 'Medellín, Colombia', img: 'https://tr.rbxcdn.com/180DAY-7c849cd096c2fd5076264c49d9a96db6/256/256/Image/Webp/noFilter' },
    { coords: [-36.67, -64.38], label: 'Regimiento de Infantería Mecanizado 6', ejId: 'RFA_LaPampa', region: 'La Pampa, Argentina', img: 'https://tr.rbxcdn.com/180DAY-ad94cf2036acc8cb7972731f9c142647/256/256/Image/Webp/noFilter' },
    { coords: [-43.25, -65.30], label: 'Trelew', ejId: 'Imperio_Chubut', region: 'Chubut, Argentina', img: 'https://tr.rbxcdn.com/180DAY-d5ce0f3fda3285f338d4dfa2371cf2f5/150/150/Image/Webp/noFilter' },
    { coords: [-12.0464, -77.0428], label: 'Base Lima', ejId: 'Ejercito_Peru', region: 'Lima, Peru', img: 'https://tr.rbxcdn.com/180DAY-b6f245f61245c64e657f0f0f1979d416/150/150/Image/Webp/noFilter' }
  ];

  function agregarMarcadores() {
    window.COORDS_BASES = {};
    DATOS_BASES.forEach(m => {
      window.COORDS_BASES[m.ejId] = m.coords;
      const el = document.createElement('img');
      el.src = m.img;
      el.className = 'icono-con-borde globo-marker' + (ZONAS_GUERRA.includes(m.ejId) ? ' zona-guerra' : '');
      el.title = m.label;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (window.simboloEnMano) return;
        mostrarPanelTerritorio(m.ejId, m.region);
      });
      new maplibregl.Marker({ element: el }).setLngLat([m.coords[1], m.coords[0]]).addTo(map);
    });
  }

  // ------------------------- SÍMBOLOS · NORMALIZACIÓN -------------------------
  function normalizarSVG(html) {
    if (!html) return html;
    return html.replace(/<svg\b([^>]*)>/i, function (m, attrs) {
      if (!/preserveAspectRatio/i.test(attrs)) attrs += ' preserveAspectRatio="xMidYMid meet"';
      if (!/\bwidth=/i.test(attrs)) attrs += ' width="100%"';
      if (!/\bheight=/i.test(attrs)) attrs += ' height="100%"';
      return '<svg' + attrs + '>';
    });
  }

  // ------------------------- SÍMBOLOS · COLOCACIÓN EN GLOBO -------------------------
  function colocarSimbolo(lngLat) {
    const svg = normalizarSVG(window.simboloEnMano.html);
    const el = document.createElement('div');
    el.className = 'map-simbolo-tactico';
    el.style.width = '88px';
    el.style.height = '58px';
    el.title = window.simboloEnMano.titulo;
    el.innerHTML =
      '<div class="mst-counter">' +
        '<div class="simbolo-inner" style="width:100%;height:100%;position:relative;transform:rotate(0deg);">' +
          '<div class="mst-rotador"></div>' +
          '<div class="mst-motor"></div>' +
          svg +
        '</div>' +
      '</div>';
    const marker = new maplibregl.Marker({ element: el }).setLngLat([lngLat.lng, lngLat.lat]).addTo(map);

    if (!window.marcadoresTacticosActivos) window.marcadoresTacticosActivos = [];
    window.marcadoresTacticosActivos.push(marker);

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      document.querySelectorAll('.map-simbolo-tactico').forEach(x => x.classList.remove('seleccionado'));
      el.classList.add('seleccionado');
      window.simboloSeleccionado = { marker, el };
    });

    window.simboloEnMano = null;
    if (window.simboloGhost) { try { document.body.removeChild(window.simboloGhost); } catch (_) {} window.simboloGhost = null; }
  }

  let isDraggingRotador = false, isDraggingMotor = false;
  function wireSimbolosDrag() {
    document.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('mst-rotador')) { isDraggingRotador = true; if (map) map.dragPan.disable(); e.preventDefault(); }
      else if (e.target.classList.contains('mst-motor')) { isDraggingMotor = true; if (map) map.dragPan.disable(); e.preventDefault(); }
    });
    document.addEventListener('mousemove', (e) => {
      if (isDraggingRotador && window.simboloSeleccionado) {
        const el = window.simboloSeleccionado.el, rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
        const inner = el.querySelector('.simbolo-inner');
        if (inner) inner.style.transform = 'rotate(' + (angle + 90) + 'deg)';
      } else if (isDraggingMotor && window.simboloSeleccionado) {
        const rect = map.getContainer().getBoundingClientRect();
        const ll = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
        window.simboloSeleccionado.marker.setLngLat(ll);
      }
    });
    document.addEventListener('mouseup', () => { if (isDraggingRotador || isDraggingMotor) { isDraggingRotador = false; isDraggingMotor = false; if (map) map.dragPan.enable(); } });
  }

  // ------------------------- BASE DE DATOS DE SÍMBOLOS -------------------------
  const SIMBOLOS_DB = {
    formaciones: {
      label: 'Formaciones',
      secciones: [
        { nombre: 'Símbolos de Unidad (vacío)', simbolos: [
          { title: 'Símbolo de Combate Desconocido', svg: '<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="16" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><text x="30" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0a0e14">?</text></svg>' },
          { title: 'Símbolo de Unidad (vacío)', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="4" width="56" height="32" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/></svg>' }
        ]},
        { nombre: 'Infantería, Blindados y Artillería', simbolos: [
          { isSeparator: true, title: 'Infantería' },
          { title: 'Infantería', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#0a0e14" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Infantería Ligera', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#0a0e14" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#0a0e14" stroke-width="1.5"/><text x="30" y="30" text-anchor="middle" font-size="13" font-weight="bold" fill="#0a0e14">L</text></svg>' },
          { title: 'Infantería Mecanizada', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#0a0e14" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#0a0e14" stroke-width="1.5"/><line x1="30" y1="2" x2="30" y2="38" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Infantería de Montaña', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#0a0e14" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#0a0e14" stroke-width="1.5"/><polygon points="20,34 30,14 40,34" fill="#0a0e14"/></svg>' },
          { title: 'Infantería Aerotransportada', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#0a0e14" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#0a0e14" stroke-width="1.5"/><ellipse cx="22" cy="32" rx="8" ry="4" fill="none" stroke="#0a0e14"/><ellipse cx="38" cy="32" rx="8" ry="4" fill="none" stroke="#0a0e14"/></svg>' },
          { isSeparator: true, title: 'Blindados / Orugas' },
          { title: 'Blindado', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#0a0e14" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Tanque', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#0a0e14" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="2" y1="2" x2="58" y2="38" stroke="#0a0e14" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Reconocimiento', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#0a0e14" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="2" y1="38" x2="58" y2="2" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'APC', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#0a0e14" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><polygon points="22,28 30,14 38,28" fill="#0a0e14"/></svg>' },
          { isSeparator: true, title: 'Artillería' },
          { title: 'Artillería', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><circle cx="30" cy="24" r="8" fill="#0a0e14"/></svg>' },
          { title: 'Artillería Autopropulsada', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#0a0e14" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><circle cx="30" cy="24" r="5" fill="#0a0e14"/></svg>' },
          { title: 'Misiles', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><polygon points="26,10 30,2 34,10" fill="#0a0e14"/><line x1="30" y1="6" x2="30" y2="34" stroke="#0a0e14" stroke-width="1.5"/><circle cx="30" cy="34" r="4" fill="none" stroke="#0a0e14"/></svg>' },
          { title: 'Mortero', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><polyline points="20,30 30,10 40,30" fill="none" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Cohetes', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><polyline points="20,18 30,6 40,18" fill="none" stroke="#0a0e14" stroke-width="1.5"/><polyline points="22,26 30,16 38,26" fill="none" stroke="#0a0e14" stroke-width="1.5"/><circle cx="30" cy="34" r="4" fill="#0a0e14"/></svg>' }
        ]}
      ]
    },
    equipos: {
      label: 'Equipos e Instalaciones',
      secciones: [
        { nombre: 'Instalaciones', simbolos: [
          { title: 'Instalación', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><circle cx="30" cy="24" r="8" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="30" y1="16" x2="30" y2="10" stroke="#0a0e14" stroke-width="1.5"/><line x1="23" y1="24" x2="17" y2="24" stroke="#0a0e14" stroke-width="1.5"/><line x1="37" y1="24" x2="43" y2="24" stroke="#0a0e14" stroke-width="1.5"/><line x1="30" y1="32" x2="30" y2="38" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Gobierno (GOV)', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><text x="30" y="30" text-anchor="middle" font-size="10" font-weight="bold" fill="#0a0e14">GOV</text></svg>' },
          { title: 'Nuclear', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><circle cx="30" cy="24" r="7" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="30" y1="17" x2="30" y2="10" stroke="#0a0e14" stroke-width="1"/><line x1="30" y1="31" x2="23" y2="36" stroke="#0a0e14" stroke-width="1"/><line x1="30" y1="31" x2="37" y2="36" stroke="#0a0e14" stroke-width="1"/></svg>' },
          { title: 'Producción / Almacenamiento', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><text x="30" y="25" text-anchor="middle" font-size="8" font-weight="bold" fill="#0a0e14">PS</text><text x="30" y="33" text-anchor="middle" font-size="8" font-weight="bold" fill="#0a0e14">RM</text></svg>' },
          { title: 'Utilidad / Servicio', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><text x="30" y="28" text-anchor="middle" font-size="10" font-weight="bold" fill="#0a0e14">UTIL</text></svg>' },
          { title: 'I+D', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><text x="30" y="28" text-anchor="middle" font-size="10" font-weight="bold" fill="#0a0e14">R&amp;D</text></svg>' }
        ]},
        { nombre: 'Armas', simbolos: [
          { title: 'Lanzamisiles', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><polygon points="26,30 30,14 34,30" fill="#0a0e14"/></svg>' },
          { title: 'Artillería Costanera', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><circle cx="30" cy="24" r="6" fill="#0a0e14"/></svg>' }
        ]},
        { nombre: 'Aeronaves', simbolos: [
          { title: 'Base Aérea', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><polyline points="12,32 30,12 48,32" fill="none" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Helicóptero', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><line x1="16" y1="16" x2="44" y2="16" stroke="#0a0e14" stroke-width="1.5"/><line x1="30" y1="16" x2="30" y2="34" stroke="#0a0e14" stroke-width="1.5"/><path d="M22,34 Q30,24 38,34" fill="none" stroke="#0a0e14" stroke-width="1.5"/></svg>' }
        ]},
        { nombre: 'Drone (RPV / UAV)', simbolos: [
          { title: 'UAV / Drone', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><line x1="10" y1="22" x2="50" y2="22" stroke="#0a0e14" stroke-width="1.5"/><polygon points="28,22 30,12 32,22" fill="#0a0e14"/></svg>' }
        ]},
        { nombre: 'Vehículo de Terreno', simbolos: [
          { title: 'Vehículo Blindado', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><ellipse cx="14" cy="22" rx="7" ry="12" fill="none" stroke="#0a0e14" stroke-width="1.5"/><ellipse cx="46" cy="22" rx="7" ry="12" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="10" x2="46" y2="10" stroke="#0a0e14" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Camión / Logística', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><rect x="14" y="16" width="32" height="14" fill="none" stroke="#0a0e14" stroke-width="1.5"/><circle cx="20" cy="32" r="4" fill="none" stroke="#0a0e14"/><circle cx="40" cy="32" r="4" fill="none" stroke="#0a0e14"/></svg>' }
        ]},
        { nombre: 'Superficie del Mar (Buques)', simbolos: [
          { title: 'Buque de Guerra', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><ellipse cx="30" cy="26" rx="20" ry="8" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="30" y1="18" x2="30" y2="10" stroke="#0a0e14" stroke-width="1.5"/></svg>' },
          { title: 'Portaaviones', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><ellipse cx="30" cy="28" rx="22" ry="7" fill="none" stroke="#0a0e14" stroke-width="1.5"/><polyline points="14,22 20,14 26,22" fill="none" stroke="#0a0e14" stroke-width="1.5"/></svg>' }
        ]},
        { nombre: 'Submarinos', simbolos: [
          { title: 'Submarino', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#0a0e14"/><ellipse cx="30" cy="24" rx="20" ry="10" fill="none" stroke="#0a0e14" stroke-width="1.5"/><line x1="30" y1="14" x2="30" y2="8" stroke="#0a0e14" stroke-width="1.5"/><line x1="26" y1="8" x2="34" y2="8" stroke="#0a0e14" stroke-width="1.5"/></svg>' }
        ]}
      ]
    },
    graficos: {
      label: 'Gráficos Tácticos',
      secciones: [
        { nombre: 'Líneas y Zonas', simbolos: [
          { title: 'Línea de Fase', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><line x1="8" y1="20" x2="52" y2="20" stroke="#0a0e14" stroke-width="2" stroke-dasharray="4,3"/></svg>' },
          { title: 'Línea de Contacto', svg: '<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#0a0e14" stroke-width="2"/><line x1="8" y1="20" x2="52" y2="20" stroke="#0a0e14" stroke-width="2"/><polygon points="50,16 58,20 50,24" fill="#0a0e14"/></svg>' }
        ]}
      ]
    },
    favoritos: { label: 'Favoritos', secciones: [] },
    especificos: { label: 'Símbolos específicos de función', secciones: [] },
    metoc: { label: 'Metoc', secciones: [] }
  };

  // ------------------------- GALERÍA -------------------------
  function initGaleria() {
    const btnAgregar = document.getElementById('btn-agregar-simbolo');
    const btnCerrar = document.getElementById('btn-cerrar-galeria');
    const panelGaleria = document.getElementById('panel-galeria-simbolos');
    if (btnAgregar && panelGaleria) btnAgregar.onclick = () => panelGaleria.classList.toggle('oculto');
    if (btnCerrar && panelGaleria) btnCerrar.onclick = () => panelGaleria.classList.add('oculto');

    const tabGaleria = document.getElementById('tab-galeria');
    const tabBusqueda = document.getElementById('tab-busqueda');
    const vistaGaleria = document.getElementById('vista-galeria');
    const vistaBusqueda = document.getElementById('vista-busqueda');
    function activarTab(tab) {
      [tabGaleria, tabBusqueda].forEach(t => t && t.classList.remove('pg-main-tab-activo'));
      tab.classList.add('pg-main-tab-activo');
      if (tab === tabGaleria) { vistaGaleria.style.display = ''; vistaBusqueda.style.display = 'none'; }
      else { vistaGaleria.style.display = 'none'; vistaBusqueda.style.display = ''; const bi = document.getElementById('busqueda-input'); if (bi) bi.focus(); }
    }
    if (tabGaleria) tabGaleria.onclick = () => activarTab(tabGaleria);
    if (tabBusqueda) tabBusqueda.onclick = () => activarTab(tabBusqueda);

    const catBtns = document.querySelectorAll('.pg-cat-btn');
    const catContenido = document.getElementById('pg-cat-contenido');

    function renderCategoria(catKey) {
      const cat = SIMBOLOS_DB[catKey];
      if (!cat || cat.secciones.length === 0) {
        catContenido.innerHTML = '<div class="pg-cat-vacio">' + (cat ? cat.label + ': sin contenido aún' : 'Categoría no encontrada') + '</div>';
        return;
      }
      catContenido.innerHTML = cat.secciones.map((sec, i) =>
        '<div class="pg-acordeon"><button class="pg-acordeon-btn" data-idx="' + i + '" data-cat="' + catKey + '"><span>' + sec.nombre + '</span><span class="pg-flecha-acc">❯</span></button><div class="pg-acordeon-grid oculto">' +
        sec.simbolos.map(s => s.isSeparator ? '<div class="pg-separador-simbolos">' + s.title + '</div>' : '<div class="pg-simbolo" title="' + s.title + '">' + normalizarSVG(s.svg) + '</div>').join('') +
        '</div></div>'
      ).join('');

      catContenido.querySelectorAll('.pg-acordeon-btn').forEach(btn => {
        btn.onclick = function () {
          const grid = this.nextElementSibling;
          const flecha = this.querySelector('.pg-flecha-acc');
          const cerrado = grid.classList.toggle('oculto');
          flecha.textContent = cerrado ? '❯' : '❮';
        };
      });
      vincularSimbolos(catContenido.querySelectorAll('.pg-simbolo'));
    }

    catBtns.forEach(btn => {
      btn.onclick = function () {
        catBtns.forEach(b => b.classList.remove('pg-cat-btn-activo'));
        this.classList.add('pg-cat-btn-activo');
        renderCategoria(this.dataset.cat);
      };
    });

    const busquedaInput = document.getElementById('busqueda-input');
    const busquedaResultados = document.getElementById('busqueda-resultados');
    if (busquedaInput) {
      busquedaInput.addEventListener('input', () => {
        const texto = busquedaInput.value.toLowerCase().trim();
        if (texto.length < 3) { busquedaResultados.innerHTML = ''; return; }
        const resultados = [];
        Object.values(SIMBOLOS_DB).forEach(cat => (cat.secciones || []).forEach(sec => (sec.simbolos || []).forEach(s => { if (!s.isSeparator && s.title.toLowerCase().includes(texto)) resultados.push(s); })));
        if (resultados.length === 0) busquedaResultados.innerHTML = '<p style="color:#7d8794;font-size:11px;">Sin resultados para "' + texto + '"</p>';
        else { busquedaResultados.innerHTML = resultados.map(s => '<div class="pg-simbolo" title="' + s.title + '">' + normalizarSVG(s.svg) + '</div>').join(''); vincularSimbolos(busquedaResultados.querySelectorAll('.pg-simbolo')); }
      });
    }

    function vincularSimbolos(nodos) {
      nodos.forEach(simb => {
        simb.onclick = function (e) {
          e.stopPropagation();
          const titulo = this.getAttribute('title');
          const svgHtml = this.innerHTML;
          window.simboloEnMano = { titulo, html: svgHtml };
          if (window.simboloGhost) { try { document.body.removeChild(window.simboloGhost); } catch (_) {} }
          window.simboloGhost = document.createElement('div');
          window.simboloGhost.className = 'simbolo-ghost';
          window.simboloGhost.innerHTML = '<div class="mst-counter">' + svgHtml + '</div>';
          document.body.appendChild(window.simboloGhost);
          this.classList.add('pg-simbolo-armado');
          setTimeout(() => this.classList.remove('pg-simbolo-armado'), 800);
        };
      });
    }

    document.addEventListener('mousemove', (e) => {
      if (window.simboloGhost) {
        const w = window.simboloGhost.offsetWidth || 88, h = window.simboloGhost.offsetHeight || 58;
        window.simboloGhost.style.left = (e.pageX - w / 2) + 'px';
        window.simboloGhost.style.top = (e.pageY - h / 2) + 'px';
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (window.marcadoresTacticosActivos && window.marcadoresTacticosActivos.length > 0) { e.preventDefault(); e.returnValue = ''; }
    });

    const first = document.querySelector('.pg-cat-btn[data-cat="formaciones"]');
    if (first) first.click();
  }

  // ------------------------- BARRA DE COMANDO / AUTH -------------------------
  function cargarRelacionesPanel() {
    const lista = document.getElementById('bc-lista-peticiones');
    if (!lista) return;
    const peticiones = todasLasRelaciones.filter(r => r.ejercito_b === ejercitoActual && r.estado === 'Pendiente');
    if (peticiones.length === 0) { lista.innerHTML = '<span class="bc-vacio">Sin peticiones</span>'; }
    else {
      lista.innerHTML = peticiones.map(r => {
        const nombre = (todosLosEjercitos[r.ejercito_a] && todosLosEjercitos[r.ejercito_a].nombre) || r.ejercito_a;
        return '<div class="bc-peticion-item"><span><b>' + nombre + '</b> solicita alianza</span><div><button class="bc-btn verde" onclick="aceptarAlianza(' + r.id + ')" style="padding:2px 6px;font-size:9px;">V</button><button class="bc-btn rojo" onclick="rechazarAlianza(' + r.id + ')" style="padding:2px 6px;font-size:9px;">X</button></div></div>';
      }).join('');
    }
  }
  function abrirBarraComando() {
    if (!ejercitoActual) return;
    const e = todosLosEjercitos[ejercitoActual];
    document.getElementById('bc-nombre').innerText = e ? e.nombre : ejercitoActual;
    document.getElementById('bc-lider').innerText = e ? (e.lider || (usuarioActual && usuarioActual.email)) : (usuarioActual && usuarioActual.email);
    document.getElementById('bc-desc').value = (e && e.descripcion) || '';
    cargarRelacionesPanel();
    document.getElementById('barra-comando').classList.remove('oculto');
    const barraSimbolos = document.getElementById('barra-simbolos');
    if (barraSimbolos) barraSimbolos.classList.remove('oculto');
  }
  async function verificarAprobacionHUD() {
    document.getElementById('panel-visitante').classList.add('oculto');
    if (!clienteSupabase) { document.getElementById('panel-usuario').classList.remove('oculto'); return; }
    const { data } = await clienteSupabase.from('peticiones').select('*').eq('email_usuario', usuarioActual.email).eq('estado', 'Aprobado');
    if (data && data.length > 0) {
      ejercitoActual = data[0].ejercito;
      await clienteSupabase.from('ejercitos').update({ lider: data[0].usuario_roblox, email_lider: usuarioActual.email }).eq('id', ejercitoActual);
      if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].lider = data[0].usuario_roblox;
      abrirBarraComando();
    } else {
      document.getElementById('panel-usuario').classList.remove('oculto');
      document.getElementById('texto-usuario').innerText = usuarioActual.email;
    }
  }

  window.aceptarAlianza = async (id_relacion) => {
    const msj = document.getElementById('msj-herramientas');
    if (!clienteSupabase) return;
    msj.innerText = 'Aprobando alianza...';
    const { error } = await clienteSupabase.from('relaciones').update({ estado: 'Aprobado' }).eq('id', id_relacion);
    if (!error) { await cargarDatosEjercitos(); cargarRelacionesPanel(); msj.innerText = 'Alianza formada'; setTimeout(() => msj.innerText = '', 3000); }
  };
  window.rechazarAlianza = async (id_relacion) => {
    if (!clienteSupabase) return;
    await clienteSupabase.from('relaciones').delete().eq('id', id_relacion);
    await cargarDatosEjercitos(); cargarRelacionesPanel();
  };

  // ------------------------- LOGÍSTICA (MapLibre) -------------------------
  const LOGISTICA_REFRESCO_MS = 30000, LOGISTICA_TICK_MS = 2000;
  const ICONO_MEDIO = { terrestre: '🚚', ferroviario: '🚂', aereo: '✈️', naval: '🚢' };
  const ESTADO_LABEL = { Pendiente: 'Preparando salida', EnTransito: 'En tránsito', Llegando: 'Llegando al destino', Descargando: 'Descargando en destino' };
  let logisticaEnvios = [], logisticaMarcadores = {}, logisticaLineas = [];
  function logisticaCoords(ejId) { return (window.COORDS_BASES && window.COORDS_BASES[ejId]) || null; }
  async function consultarEnviosActivos() {
    if (!clienteSupabase) return [];
    const margen = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await clienteSupabase.from('historial_suministros').select('id, created_at, ejercito_origen, ejercito_destino, tipo_suministro, medio, cantidad, eta_at, estado').in('estado', ['Pendiente', 'EnTransito', 'Llegando', 'Descargando']).gte('eta_at', margen).order('id', { ascending: true });
    if (error) { console.warn('[Logistica]', error.message); return []; }
    return data || [];
  }
  function progresoDe(envio) { if (!envio.eta_at) return 0; const inicio = new Date(envio.created_at).getTime(), fin = new Date(envio.eta_at).getTime(); if (fin <= inicio) return 1; return Math.min(1, Math.max(0, (Date.now() - inicio) / (fin - inicio))); }
  function posicionInterpolada(a, b, t) { const lat = a[0] + (b[0] - a[0]) * t, lng = a[1] + (b[1] - a[1]) * t, arco = Math.sin(t * Math.PI) * 1.2; return [lat + arco, lng]; }
  function textoPopup(envio) {
    const origen = (todosLosEjercitos[envio.ejercito_origen] && todosLosEjercitos[envio.ejercito_origen].nombre) || envio.ejercito_origen;
    const destino = (todosLosEjercitos[envio.ejercito_destino] && todosLosEjercitos[envio.ejercito_destino].nombre) || envio.ejercito_destino;
    const icono = ICONO_MEDIO[envio.medio] || '📦', estado = ESTADO_LABEL[envio.estado] || envio.estado;
    let eta = '';
    if (envio.eta_at && (envio.estado === 'Pendiente' || envio.estado === 'EnTransito')) { const r = new Date(envio.eta_at).getTime() - Date.now(); eta = r > 0 ? '<br>ETA: <b>' + Math.max(1, Math.round(r / 60000)) + ' min</b>' : '<br>ETA: <b>inminente</b>'; }
    return '<div style="font-family:monospace;font-size:11px;color:#d7dde5;">' + icono + ' <b>' + (envio.tipo_suministro || '').toUpperCase() + '</b> ×' + (envio.cantidad || '?') + '<br>' + origen + ' → ' + destino + '<br>Estado: <b>' + estado + '</b>' + eta + '</div>';
  }
  function dibujarEnvio(envio) {
    const a = logisticaCoords(envio.ejercito_origen), b = logisticaCoords(envio.ejercito_destino);
    if (!a || !b) return;
    const sid = 'log-' + envio.id;
    const el = document.createElement('div');
    el.style.cssText = 'font-size:22px;filter:drop-shadow(0 0 3px #000);cursor:pointer;';
    el.textContent = ICONO_MEDIO[envio.medio] || '📦';
    const p0 = posicionInterpolada(a, b, progresoDe(envio));
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([p0[1], p0[0]])
      .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(textoPopup(envio)))
      .addTo(map);
    const rec = { marker, envio, path: null };
    logisticaMarcadores[envio.id] = rec;
    // Traza la ruta real segun el medio (async); mientras carga usa arco recto
    caminoDe(envio).then(path => {
      if (!path || logisticaMarcadores[envio.id] !== rec) return;
      rec.path = path;
      if (!map.getSource(sid)) {
        const color = envio.medio === 'aereo' ? '#22d3ee' : envio.medio === 'naval' ? '#5aa9ff' : '#ffb020';
        map.addSource(sid, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: path } } });
        map.addLayer({ id: sid, type: 'line', source: sid, paint: { 'line-color': color, 'line-width': 1.8, 'line-opacity': 0.55, 'line-dasharray': [2, 3] } });
        logisticaLineas.push(sid);
      }
      rec.marker.setLngLat(posEnPath(path, progresoDe(envio)));
    });
  }
  async function refrescarLogistica() {
    if (!map || !map.getSource) return;
    logisticaEnvios = await consultarEnviosActivos();
    Object.values(logisticaMarcadores).forEach(o => { try { o.marker.remove(); } catch (_) {} });
    logisticaMarcadores = {};
    logisticaLineas.forEach(sid => { try { map.removeLayer(sid); map.removeSource(sid); } catch (_) {} });
    logisticaLineas = [];
    logisticaEnvios.forEach(dibujarEnvio);
  }
  window.refrescarLogistica = refrescarLogistica;
  function animarLogistica() {
    for (const id in logisticaMarcadores) {
      const rec = logisticaMarcadores[id], envio = rec.envio, t = progresoDe(envio);
      if (rec.path) {
        rec.marker.setLngLat(posEnPath(rec.path, t));
      } else {
        const a = logisticaCoords(envio.ejercito_origen), b = logisticaCoords(envio.ejercito_destino);
        if (!a || !b) continue;
        const pos = posicionInterpolada(a, b, t);
        rec.marker.setLngLat([pos[1], pos[0]]);
      }
      const pop = rec.marker.getPopup();
      if (pop && pop.isOpen()) pop.setHTML(textoPopup(envio));
    }
  }
  function iniciarLogistica() { refrescarLogistica(); setInterval(refrescarLogistica, LOGISTICA_REFRESCO_MS); setInterval(animarLogistica, LOGISTICA_TICK_MS); }

  // ------------------------- HUD READOUT -------------------------
  function engancharLecturaHUD() {
    const elLat = document.getElementById('hud-lat'), elLon = document.getElementById('hud-lon'), elZ = document.getElementById('hud-z');
    function set(lat, lng) {
      if (elLat) elLat.textContent = (lat >= 0 ? '+' : '') + lat.toFixed(4);
      if (elLon) elLon.textContent = (lng >= 0 ? '+' : '') + lng.toFixed(4);
      if (elZ) elZ.textContent = 'Z' + map.getZoom().toFixed(1);
    }
    const c = map.getCenter(); set(c.lat, c.lng);
    map.on('mousemove', (e) => set(e.lngLat.lat, e.lngLat.lng));
    map.on('move', () => { const cc = map.getCenter(); set(cc.lat, cc.lng); });
  }

  // ------------------------- ROTACIÓN AUTOMÁTICA (AFK) -------------------------
  const IDLE_MS = 8000;
  let lastInteraccion = Date.now();
  function marcarActividad() { lastInteraccion = Date.now(); const t = document.getElementById('hud-rot'); if (t) t.style.opacity = '0'; }
  function iniciarAutoRotacion() {
    ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'keydown'].forEach(ev =>
      window.addEventListener(ev, marcarActividad, { passive: true }));
    function girar() {
      if (Date.now() - lastInteraccion < IDLE_MS) return;
      if (map.isMoving() || map.getZoom() >= 5.5) return;
      const t = document.getElementById('hud-rot'); if (t) t.style.opacity = '1';
      const c = map.getCenter();
      map.easeTo({ center: [c.lng + 3, c.lat], duration: 1000, easing: x => x, essential: true });
    }
    map.on('moveend', girar);
    setInterval(girar, 1000);
  }

  // ------------------------- HANDLERS DOM -------------------------
  function on(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
  function bindHandlers() {
    const abrirModalLogin = () => { document.getElementById('modal-login').classList.remove('oculto'); document.getElementById('overlay-oscuro').classList.remove('oculto'); };
    on('btn-abrir-registro', 'click', abrirModalLogin);
    on('btn-cerrar-login', 'click', () => { document.getElementById('modal-login').classList.add('oculto'); document.getElementById('overlay-oscuro').classList.add('oculto'); });
    on('btn-registro', 'click', async () => {
      const email = document.getElementById('input-email').value, pass = document.getElementById('input-pass').value, msj = document.getElementById('msj-login');
      if (!clienteSupabase) { msj.innerText = 'Servidor no disponible (preview).'; msj.style.color = '#ff9e2c'; return; }
      msj.innerText = 'Registrando...'; msj.style.color = '#ffcf4a';
      const { error } = await clienteSupabase.auth.signUp({ email, password: pass });
      if (error) { msj.innerText = error.message; msj.style.color = '#ff5a3c'; } else { msj.innerText = 'Cuenta creada. Ya podes entrar.'; msj.style.color = '#3ddc84'; }
    });
    on('btn-login', 'click', async () => {
      const email = document.getElementById('input-email').value, pass = document.getElementById('input-pass').value, msj = document.getElementById('msj-login');
      if (!clienteSupabase) { msj.innerText = 'Servidor no disponible (preview).'; msj.style.color = '#ff9e2c'; return; }
      msj.innerText = 'Conectando...'; msj.style.color = '#ffcf4a';
      const { error } = await clienteSupabase.auth.signInWithPassword({ email, password: pass });
      if (error) { msj.innerText = 'Credenciales incorrectas.'; msj.style.color = '#ff5a3c'; } else { location.reload(); }
    });
    const cerrarSesion = async () => { if (clienteSupabase) await clienteSupabase.auth.signOut(); location.reload(); };
    on('btn-cerrar-sesion', 'click', cerrarSesion);
    on('btn-cerrar-sesion-cmd', 'click', cerrarSesion);
    on('btn-abrir-reclamar', 'click', () => document.getElementById('modal-reclamar').classList.remove('oculto'));
    on('btn-cerrar-reclamar', 'click', () => document.getElementById('modal-reclamar').classList.add('oculto'));
    on('btn-enviar', 'click', async () => {
      const robloxName = document.getElementById('input-roblox').value, ejercitoSelect = document.getElementById('input-ejercito').value, msj = document.getElementById('mensaje-estado');
      if (!robloxName || !ejercitoSelect) { msj.innerText = 'Completa todos los campos.'; msj.style.color = '#ff5a3c'; return; }
      if (!clienteSupabase) { msj.innerText = 'Servidor no disponible (preview).'; msj.style.color = '#ff9e2c'; return; }
      msj.innerText = 'Enviando peticion...'; msj.style.color = '#ffcf4a';
      const { error } = await clienteSupabase.from('peticiones').insert([{ usuario_roblox: robloxName, ejercito: ejercitoSelect, email_usuario: usuarioActual.email, estado: 'Pendiente' }]);
      if (error) { msj.innerText = 'Error de servidor.'; msj.style.color = '#ff5a3c'; }
      else { msj.innerText = 'Enviado. Esperando aprobacion del Alto Mando.'; msj.style.color = '#3ddc84'; setTimeout(() => document.getElementById('modal-reclamar').classList.add('oculto'), 3000); }
    });

    on('btn-guardar-desc', 'click', async () => {
      const desc = document.getElementById('bc-desc').value, msj = document.getElementById('msj-herramientas');
      if (!clienteSupabase) { msj.innerText = 'Servidor no disponible (preview).'; msj.style.color = '#ff9e2c'; return; }
      msj.innerText = 'Guardando...'; msj.style.color = '#ffcf4a';
      const { error } = await clienteSupabase.from('ejercitos').update({ descripcion: desc, lider: (todosLosEjercitos[ejercitoActual] && todosLosEjercitos[ejercitoActual].lider) || usuarioActual.email, email_lider: usuarioActual.email }).eq('id', ejercitoActual);
      if (error) { msj.innerText = 'Error al guardar.'; msj.style.color = '#ff5a3c'; }
      else { if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].descripcion = desc; msj.innerText = 'Guardado.'; msj.style.color = '#3ddc84'; setTimeout(() => msj.innerText = '', 2000); }
    });
    on('btn-ter-enviar-rel', 'click', async () => {
      if (!window.territorioInspeccionado) return;
      const ejB = window.territorioInspeccionado, tipo = document.getElementById('ter-sel-tipo').value, msj = document.getElementById('msj-herramientas');
      if (!clienteSupabase) { msj.innerText = 'Servidor no disponible (preview).'; msj.style.color = '#ff9e2c'; return; }
      msj.innerText = 'Enviando...'; msj.style.color = '#ffcf4a';
      const estado = tipo === 'Aliado' ? 'Pendiente' : 'Aprobado';
      await clienteSupabase.from('relaciones').delete().or('and(ejercito_a.eq.' + ejercitoActual + ',ejercito_b.eq.' + ejB + '),and(ejercito_a.eq.' + ejB + ',ejercito_b.eq.' + ejercitoActual + ')');
      const { error } = await clienteSupabase.from('relaciones').insert([{ ejercito_a: ejercitoActual, ejercito_b: ejB, tipo, estado }]);
      if (error) { msj.innerText = 'Error al guardar.'; msj.style.color = '#ff5a3c'; }
      else { msj.innerText = estado === 'Pendiente' ? 'Peticion de alianza enviada' : tipo + ' establecido'; msj.style.color = '#3ddc84'; await cargarDatosEjercitos(); mostrarPanelTerritorio(window.territorioInspeccionado, document.getElementById('territorio-nombre').innerText); setTimeout(() => msj.innerText = '', 3000); }
    });
    on('btn-enviar-suministro', 'click', async () => {
      const btn = document.getElementById('btn-enviar-suministro'), msj = document.getElementById('msj-herramientas');
      const tipo = document.getElementById('ter-sel-suministro').value, medio = document.getElementById('ter-sel-transporte').value, destino = window.territorioInspeccionado;
      if (!destino) return;
      if (!clienteSupabase) { msj.innerText = 'Servidor no disponible (preview).'; msj.style.color = '#ff9e2c'; return; }
      btn.disabled = true; btn.innerText = '...'; msj.style.color = '#ffcf4a'; msj.innerText = 'Enviando ' + tipo + '...';
      try {
        const { data: { session } } = await clienteSupabase.auth.getSession();
        if (!session) { msj.style.color = '#ff5a3c'; msj.innerText = 'Error: no autenticado.'; btn.disabled = false; btn.innerText = 'ENVIAR'; return; }
        const res = await fetch('https://hwyedjcprazfnzgvughb.supabase.co/functions/v1/enviar-suministros', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token }, body: JSON.stringify({ ejercito_destino: destino, tipo_suministro: tipo, medio_transporte: medio }) });
        const data = await res.json();
        if (res.ok) { msj.style.color = '#3ddc84'; msj.innerText = '✓ ' + (data.mensaje || 'Enviado con exito'); refrescarLogistica(); }
        else { msj.style.color = '#ff5a3c'; msj.innerText = '✗ ' + (data.error || 'Error al enviar'); }
      } catch (e) { msj.style.color = '#ff5a3c'; msj.innerText = '✗ Error de red.'; console.error(e); }
      btn.disabled = false; btn.innerText = 'ENVIAR'; setTimeout(() => msj.innerText = '', 5000);
    });
    on('btn-cerrar-territorio', 'click', cerrarPanelTerritorio);
    on('btn-compartir', 'click', () => {
      const ej = window.territorioInspeccionado;
      if (!ej) return;
      const url = location.origin + location.pathname + '?ir=' + encodeURIComponent(ej);
      if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
      const b = document.getElementById('btn-compartir'); if (b) { const t = b.textContent; b.textContent = '✓ ENLACE COPIADO'; setTimeout(() => { b.textContent = t; }, 1800); }
    });
  }

  // ------------------------- INIT GLOBO -------------------------
  function iniciarGlobo() {
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-55, -25],
      zoom: 2.2,
      attributionControl: false,
      maxZoom: 18
    });
    window.map = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    let setupHecho = false;
    function setup() {
      if (setupHecho) return;
      setupHecho = true;
      cargarGeografia();
      agregarMarcadores();
      engancharLecturaHUD();
      iniciarAutoRotacion();
      try { iniciarLogistica(); } catch (e) {}
      const irParam = new URLSearchParams(location.search).get('ir');
      if (irParam) setTimeout(() => irAObjetivo(irParam), 900);
    }
    map.on('style.load', () => {
      try { map.setProjection({ type: 'globe' }); } catch (e) { console.warn('Globe projection no soportada:', e && e.message); }
      setup();
    });
    map.on('load', setup);

    map.on('click', (e) => {
      if (window.simboloEnMano) { colocarSimbolo(e.lngLat); return; }
      const feats = map.queryRenderedFeatures(e.point).filter(f => FILL_LAYERS.includes(f.layer.id));
      if (feats.length === 0) cerrarPanelTerritorio();
      document.querySelectorAll('.map-simbolo-tactico').forEach(el => el.classList.remove('seleccionado'));
      window.simboloSeleccionado = null;
    });
  }

  // ------------------------- BOOT -------------------------
  async function mainFlow() {
    try { await cargarDatosEjercitos(); } catch (e) {}
    Object.keys(EJERCITOS_FALLBACK).forEach(k => { if (!todosLosEjercitos[k]) todosLosEjercitos[k] = EJERCITOS_FALLBACK[k]; });
    let session = null;
    try { const r = await clienteSupabase.auth.getSession(); session = r.data.session; } catch (e) {}
    if (session) { usuarioActual = session.user; try { await verificarAprobacionHUD(); } catch (e) {} }
    else { const pv = document.getElementById('panel-visitante'); if (pv) pv.classList.remove('oculto'); }
    esAdmin = (usuarioActual && ADMIN_EMAILS.map(x => x.toLowerCase()).includes((usuarioActual.email || '').toLowerCase())) || new URLSearchParams(location.search).get('admin') === '1';
    if (esAdmin) { const b = document.getElementById('btn-admin'); if (b) b.classList.remove('oculto'); }
    try { iniciarPresencia(); } catch (e) {}
    iniciarGlobo();
  }

  function boot() {
    bindHandlers();
    wireSimbolosDrag();
    initGaleria();
    initAdmin();
    mainFlow();
  }
  window.bootGlobo25 = boot;
})();
