// --- HERRAMIENTAS COMANDANTE ---
document.getElementById('btn-panel-control').onclick = () => {
    if (!ejercitoActual) return;
    const e = todosLosEjercitos[ejercitoActual];
    document.getElementById('hud-ejercito-nombre').innerText = e ? e.nombre : ejercitoActual;
    document.getElementById('hud-ejercito-lider').innerText = e ? (e.lider || usuarioActual.email) : usuarioActual.email;
    document.getElementById('hud-ejercito-desc').value = e?.descripcion || '';
    cargarRelacionesPanel();
    document.getElementById('panel-herramientas').classList.remove('oculto');
};

document.getElementById('btn-cerrar-herramientas').onclick = () => document.getElementById('panel-herramientas').classList.add('oculto');

document.getElementById('btn-guardar-desc').onclick = async () => {
    const desc = document.getElementById('hud-ejercito-desc').value;
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

document.getElementById('btn-guardar-relacion').onclick = async () => {
    const ejB = document.getElementById('sel-ejercito-relacion').value;
    const tipo = document.getElementById('sel-tipo-relacion').value;
    const msj = document.getElementById('msj-herramientas');
    if (!ejB) { msj.innerText = "Selecciona un ejercito."; msj.style.color = "#cc3333"; return; }
    msj.innerText = "Actualizando..."; msj.style.color = "yellow";
    await clienteSupabase.from('relaciones').delete()
        .or(`and(ejercito_a.eq.${ejercitoActual},ejercito_b.eq.${ejB}),and(ejercito_a.eq.${ejB},ejercito_b.eq.${ejercitoActual})`);
    const { error } = await clienteSupabase.from('relaciones').insert([{ ejercito_a: ejercitoActual, ejercito_b: ejB, tipo }]);
    if (error) { msj.innerText = "Error al guardar."; msj.style.color = "#cc3333"; }
    else {
        msj.innerText = tipo + " con " + (todosLosEjercitos[ejB]?.nombre || ejB);
        msj.style.color = "#32CD32";
        await cargarDatosEjercitos();
        cargarRelacionesPanel();
        setTimeout(() => msj.innerText = '', 3000);
    }
};

function cargarRelacionesPanel() {
    const lista = document.getElementById('lista-relaciones-panel');
    const misRel = todasLasRelaciones.filter(r => r.ejercito_a === ejercitoActual || r.ejercito_b === ejercitoActual);
    if (misRel.length === 0) { lista.innerHTML = '<span style="color:#333;font-size:11px;">Sin relaciones</span>'; return; }
    lista.innerHTML = misRel.map(r => {
        const otro = r.ejercito_a === ejercitoActual ? r.ejercito_b : r.ejercito_a;
        const nombre = todosLosEjercitos[otro]?.nombre || otro;
        const color = r.tipo === 'Aliado' ? '#32CD32' : r.tipo === 'Enemigo' ? '#cc3333' : '#555';
        return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #0f1a0f;">
            <span style="font-size:11px;color:#ccc;">${nombre}</span>
            <span style="color:${color};font-size:10px;letter-spacing:1px;">${r.tipo.toUpperCase()}</span>
        </div>`;
    }).join('');
}

function poblarSelectorRelaciones() {
    const sel = document.getElementById('sel-ejercito-relacion');
    sel.innerHTML = '<option value="" disabled selected>-- Selecciona ejercito --</option>';
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
