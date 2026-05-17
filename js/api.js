// --- PRESENCIA EN TIEMPO REAL ---
function iniciarPresencia() {
    const canal = clienteSupabase.channel('mapa-presencia-v2', {
        config: { presence: { key: Math.random().toString(36).slice(2) } }
    });
    canal.on('presence', { event: 'sync' }, () => {
        const total = Object.keys(canal.presenceState()).length;
        const el = document.getElementById('num-visitantes');
        if (el) el.innerText = total;
    });
    canal.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await canal.track({ t: Date.now() });
    });
}

// --- DATOS ---
async function cargarDatosEjercitos() {
    const { data: ejercitos } = await clienteSupabase.from('ejercitos').select('*');
    if (ejercitos) ejercitos.forEach(e => { todosLosEjercitos[e.id] = e; });
    const { data: relaciones } = await clienteSupabase.from('relaciones').select('*');
    if (relaciones) todasLasRelaciones = relaciones;
}

async function obtenerComandanteRoblox(ejercitoId) {
    if (ejercitoId === 'FK_Zone' || ejercitoId === 'Colombia_Conflict') return null;
    const { data } = await clienteSupabase
        .from('peticiones').select('usuario_roblox')
        .eq('ejercito', ejercitoId).eq('estado', 'Aprobado').limit(1);
    return (data && data.length > 0) ? data[0].usuario_roblox : null;
}
