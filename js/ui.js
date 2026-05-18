// --- HERRAMIENTAS COMANDANTE ---
document.getElementById('btn-panel-control').onclick = () => {
    if (!ejercitoActual) return;
    const e = todosLosEjercitos[ejercitoActual];
    document.getElementById('bc-nombre').innerText = e ? e.nombre : ejercitoActual;
    document.getElementById('bc-lider').innerText = e ? (e.lider || usuarioActual.email) : usuarioActual.email;
    document.getElementById('bc-desc').value = e?.descripcion || '';
    if (e && e.color) {
        document.getElementById('bc-color').style.background = e.color;
    }
    cargarRelacionesPanel();
    document.getElementById('barra-comando').classList.remove('oculto');
};

document.getElementById('btn-cerrar-bc').onclick = () => document.getElementById('barra-comando').classList.add('oculto');

document.getElementById('btn-guardar-desc').onclick = async () => {
    const desc = document.getElementById('bc-desc').value;
    const msj = document.getElementById('msj-herramientas');
    msj.innerText = "Guardando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.from('ejercitos')
        .update({ descripcion: desc, lider: todosLosEjercitos[ejercitoActual]?.lider || usuarioActual.email, email_lider: usuarioActual.email })
        .eq('id', ejercitoActual);
    if (error) { msj.innerText = "Error al guardar."; msj.style.color = "#cc3333"; }
    else {
        if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].descripcion = desc;
        msj.innerText = "Guardado."; msj.style.color = "#32CD32";
        setTimeout(() => msj.innerText = '', 2000);
    }
};

document.getElementById('btn-actualizar-rel').onclick = async () => {
    const ejB = document.getElementById('bc-sel-ej').value;
    const tipo = document.getElementById('bc-sel-tipo').value;
    const msj = document.getElementById('msj-herramientas');
    if (!ejB) { msj.innerText = "Selecciona un ejercito."; msj.style.color = "#cc3333"; return; }
    
    msj.innerText = "Enviando..."; msj.style.color = "yellow";
    
    // Si es alianza, queda pendiente. Si es neutral/guerra, entra directo y anula pendientes.
    const estado = tipo === 'Aliado' ? 'Pendiente' : 'Aprobado';
    
    // Borramos cualquier relacion existente entre ambos
    await clienteSupabase.from('relaciones').delete()
        .or(`and(ejercito_a.eq.${ejercitoActual},ejercito_b.eq.${ejB}),and(ejercito_a.eq.${ejB},ejercito_b.eq.${ejercitoActual})`);
    
    const { error } = await clienteSupabase.from('relaciones').insert([{ ejercito_a: ejercitoActual, ejercito_b: ejB, tipo, estado }]);
    
    if (error) { msj.innerText = "Error al guardar."; msj.style.color = "#cc3333"; }
    else {
        msj.innerText = estado === 'Pendiente' ? "Peticion de alianza enviada" : tipo + " establecido";
        msj.style.color = "#32CD32";
        await cargarDatosEjercitos();
        cargarRelacionesPanel();
        setTimeout(() => msj.innerText = '', 3000);
    }
};

window.aceptarAlianza = async (id_relacion) => {
    const msj = document.getElementById('msj-herramientas');
    msj.innerText = "Aprobando alianza...";
    const { error } = await clienteSupabase.from('relaciones').update({ estado: 'Aprobado' }).eq('id', id_relacion);
    if (!error) {
        await cargarDatosEjercitos();
        cargarRelacionesPanel();
        msj.innerText = "Alianza formada"; setTimeout(() => msj.innerText = '', 3000);
    }
};
window.rechazarAlianza = async (id_relacion) => {
    await clienteSupabase.from('relaciones').delete().eq('id', id_relacion);
    await cargarDatosEjercitos();
    cargarRelacionesPanel();
};

function cargarRelacionesPanel() {
    const lista = document.getElementById('bc-lista-peticiones');
    // Filtrar las peticiones donde ME invitan a mi (ejercito_b) y esta pendiente
    const peticiones = todasLasRelaciones.filter(r => r.ejercito_b === ejercitoActual && r.estado === 'Pendiente');
    
    if (peticiones.length === 0) { 
        lista.innerHTML = '<span class="bc-vacio">Sin peticiones</span>'; 
    } else {
        lista.innerHTML = peticiones.map(r => {
            const nombre = todosLosEjercitos[r.ejercito_a]?.nombre || r.ejercito_a;
            return `<div class="bc-peticion-item">
                <span><b>${nombre}</b> solicita alianza</span>
                <div>
                    <button class="bc-btn verde" onclick="aceptarAlianza(${r.id})" style="padding:2px 6px;font-size:9px;">V</button>
                    <button class="bc-btn rojo" onclick="rechazarAlianza(${r.id})" style="padding:2px 6px;font-size:9px;">X</button>
                </div>
            </div>`;
        }).join('');
    }
}

function poblarSelectorRelaciones() {
    const sel = document.getElementById('bc-sel-ej');
    sel.innerHTML = '<option value="" disabled selected>-- Ejercito --</option>';
    Object.entries(todosLosEjercitos).forEach(([id, e]) => {
        if (id !== ejercitoActual) sel.innerHTML += `<option value="${id}">${e.nombre}</option>`;
    });
}

async function verificarAprobacionHUD() {
    document.getElementById('panel-visitante').classList.add('oculto');
    const { data } = await clienteSupabase.from('peticiones').select('*')
        .eq('email_usuario', usuarioActual.email).eq('estado', 'Aprobado');
    if (data && data.length > 0) {
        ejercitoActual = data[0].ejercito;
        const e = todosLosEjercitos[ejercitoActual];
        document.getElementById('panel-comandante').classList.remove('oculto');
        document.getElementById('texto-comandante').innerText = e ? e.nombre : ejercitoActual;
        await clienteSupabase.from('ejercitos')
            .update({ lider: data[0].usuario_roblox, email_lider: usuarioActual.email })
            .eq('id', ejercitoActual);
        if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].lider = data[0].usuario_roblox;
        poblarSelectorRelaciones();
    } else {
        document.getElementById('panel-usuario').classList.remove('oculto');
        document.getElementById('texto-usuario').innerText = usuarioActual.email;
    }
}
