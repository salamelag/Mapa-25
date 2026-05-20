// --- HERRAMIENTAS COMANDANTE ---
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

document.getElementById('btn-ter-enviar-rel').onclick = async () => {
    if (!window.territorioInspeccionado) return;
    const ejB = window.territorioInspeccionado;
    const tipo = document.getElementById('ter-sel-tipo').value;
    const msj = document.getElementById('msj-herramientas');
    
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
        // Recargar la UI del territorio actual para reflejar cambios
        if (typeof mostrarPanelTerritorio === 'function') {
            mostrarPanelTerritorio(window.territorioInspeccionado, document.getElementById('territorio-nombre').innerText);
        }
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

function abrirBarraComando() {
    if (!ejercitoActual) return;
    const e = todosLosEjercitos[ejercitoActual];
    document.getElementById('bc-nombre').innerText = e ? e.nombre : ejercitoActual;
    document.getElementById('bc-lider').innerText = e ? (e.lider || usuarioActual.email) : usuarioActual.email;
    document.getElementById('bc-desc').value = e?.descripcion || '';
    cargarRelacionesPanel();
    document.getElementById('barra-comando').classList.remove('oculto');
    
    // Mostrar la barra de simbolos tacticos
    const barraSimbolos = document.getElementById('barra-simbolos');
    if (barraSimbolos) barraSimbolos.classList.remove('oculto');
}

async function verificarAprobacionHUD() {
    document.getElementById('panel-visitante').classList.add('oculto');
    const { data } = await clienteSupabase.from('peticiones').select('*')
        .eq('email_usuario', usuarioActual.email).eq('estado', 'Aprobado');
    if (data && data.length > 0) {
        ejercitoActual = data[0].ejercito;
        const e = todosLosEjercitos[ejercitoActual];
        await clienteSupabase.from('ejercitos')
            .update({ lider: data[0].usuario_roblox, email_lider: usuarioActual.email })
            .eq('id', ejercitoActual);
        if (todosLosEjercitos[ejercitoActual]) todosLosEjercitos[ejercitoActual].lider = data[0].usuario_roblox;
        abrirBarraComando();
    } else {
        document.getElementById('panel-usuario').classList.remove('oculto');
        document.getElementById('texto-usuario').innerText = usuarioActual.email;
    }
}

// --- LOGICA DE GALERIA DE SIMBOLOS TACTICOS ---

// ====== BASE DE DATOS DE SIMBOLOS ======
const SIMBOLOS_DB = {
    formaciones: {
        label: 'Formaciones',
        secciones: [
            {
                nombre: 'Símbolos de Unidad (vacío)',
                simbolos: [
                    { title: 'Símbolo de Combate Desconocido', svg: `<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="16" fill="#8bd3f4" stroke="#000" stroke-width="2"/><text x="30" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#000">?</text></svg>` },
                    { title: 'Símbolo de Unidad (vacío)', svg: `<img _ngcontent-ng-c794628540="" msstooltip="" class="msse-control mss-galleries-symbol-image mssx-symbol-gallery-symbol-image mssp-main" src="data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSI5OSIgaGVpZ2h0PSI2MiIgdmlld0JveD0iMCAwIDE5ODAgMTI0MCI+PG1ldGFkYXRhPjxyZGY6UkRGPjxyZGY6RGVzY3JpcHRpb24+PGRjOmRlc2NyaXB0aW9uPk1TUy9NaWxYLUV4cG9ydCB0byBTVkc8L2RjOmRlc2NyaXB0aW9uPjxkYzpwdWJsaXNoZXI+Z3Mtc29mdCBBRzwvZGM6cHVibGlzaGVyPjwvcmRmOkRlc2NyaXB0aW9uPjwvcmRmOlJERj48L21ldGFkYXRhPjxkZWZzPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+LnNzMCB7ZmlsbDpyZ2IoMTI4LDIyNCwyNTUpO3N0cm9rZTpibGFjaztzdHJva2Utd2lkdGg6NDE7fTwvc3R5bGU+PC9kZWZzPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuMTMxMTkgMCAwIDEuMTI4MTkgMTI2LjA3NiA0NS45MjU5KSI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjE1MDAiIGhlaWdodD0iMTAwMCIgY2xhc3M9InNzMCIvPjwvZz48L3N2Zz4=">` },
                ]
            },
            {
                nombre: 'Infantería, Blindados y Artillería',
                simbolos: [
                    { isSeparator: true, title: 'Infantería' },
                    { title: 'Infantería', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#000" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Infantería Ligera', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#000" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#000" stroke-width="1.5"/><text x="30" y="30" text-anchor="middle" font-size="13" font-weight="bold" fill="#000">L</text></svg>` },
                    { title: 'Infantería Mecanizada', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#000" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#000" stroke-width="1.5"/><line x1="30" y1="2" x2="30" y2="38" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Infantería de Montaña', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#000" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#000" stroke-width="1.5"/><polygon points="20,34 30,14 40,34" fill="#000"/></svg>` },
                    { title: 'Infantería Aerotransportada', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#000" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#000" stroke-width="1.5"/><ellipse cx="22" cy="32" rx="8" ry="4" fill="none" stroke="#000"/><ellipse cx="38" cy="32" rx="8" ry="4" fill="none" stroke="#000"/></svg>` },
                    
                    { isSeparator: true, title: 'Blindados / Orugas' },
                    { title: 'Blindado', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#000" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#000" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Tanque', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#000" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#000" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><line x1="2" y1="2" x2="58" y2="38" stroke="#000" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Reconocimiento', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#000" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#000" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><line x1="2" y1="38" x2="58" y2="2" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'APC', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#000" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#000" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><polygon points="22,28 30,14 38,28" fill="#000"/></svg>` },
                    
                    { isSeparator: true, title: 'Artillería' },
                    { title: 'Artillería', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><circle cx="30" cy="24" r="8" fill="#000"/></svg>` },
                    { title: 'Artillería Autopropulsada', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><ellipse cx="14" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><line x1="14" y1="6" x2="46" y2="6" stroke="#000" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#000" stroke-width="1.5"/><ellipse cx="46" cy="20" rx="8" ry="14" fill="none" stroke="#000" stroke-width="1.5"/><circle cx="30" cy="24" r="5" fill="#000"/></svg>` },
                    { title: 'Misiles', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><polygon points="26,10 30,2 34,10" fill="#000"/><line x1="30" y1="6" x2="30" y2="34" stroke="#000" stroke-width="1.5"/><circle cx="30" cy="34" r="4" fill="none" stroke="#000"/></svg>` },
                    { title: 'Mortero', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><polyline points="20,30 30,10 40,30" fill="none" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Cohetes', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><polyline points="20,18 30,6 40,18" fill="none" stroke="#000" stroke-width="1.5"/><polyline points="22,26 30,16 38,26" fill="none" stroke="#000" stroke-width="1.5"/><circle cx="30" cy="34" r="4" fill="#000"/></svg>` },
                ]
            },
        ]
    },
    equipos: {
        label: 'Equipos e Instalaciones',
        secciones: [
            {
                nombre: 'Instalaciones',
                simbolos: [
                    { title: 'Instalación', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><circle cx="30" cy="24" r="8" fill="none" stroke="#000" stroke-width="1.5"/><line x1="30" y1="16" x2="30" y2="10" stroke="#000" stroke-width="1.5"/><line x1="23" y1="24" x2="17" y2="24" stroke="#000" stroke-width="1.5"/><line x1="37" y1="24" x2="43" y2="24" stroke="#000" stroke-width="1.5"/><line x1="30" y1="32" x2="30" y2="38" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Gobierno (GOV)', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><text x="30" y="30" text-anchor="middle" font-size="10" font-weight="bold" fill="#000">GOV</text></svg>` },
                    { title: 'Nuclear', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><circle cx="30" cy="24" r="7" fill="none" stroke="#000" stroke-width="1.5"/><line x1="30" y1="17" x2="30" y2="10" stroke="#000" stroke-width="1"/><line x1="30" y1="31" x2="23" y2="36" stroke="#000" stroke-width="1"/><line x1="30" y1="31" x2="37" y2="36" stroke="#000" stroke-width="1"/></svg>` },
                    { title: 'Producción / Almacenamiento', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><text x="30" y="25" text-anchor="middle" font-size="8" font-weight="bold" fill="#000">PS</text><text x="30" y="33" text-anchor="middle" font-size="8" font-weight="bold" fill="#000">RM</text></svg>` },
                    { title: 'Utilidad / Servicio', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><text x="30" y="28" text-anchor="middle" font-size="10" font-weight="bold" fill="#000">UTIL</text></svg>` },
                    { title: 'I+D', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><text x="30" y="28" text-anchor="middle" font-size="10" font-weight="bold" fill="#000">R&D</text></svg>` },
                ]
            },
            {
                nombre: 'Armas',
                simbolos: [
                    { title: 'Lanzamisiles', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><polygon points="26,30 30,14 34,30" fill="#000"/></svg>` },
                    { title: 'Artillería Costanera', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><circle cx="30" cy="24" r="6" fill="#000"/></svg>` },
                ]
            },
            {
                nombre: 'Aeronaves',
                simbolos: [
                    { title: 'Base Aérea', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><polyline points="12,32 30,12 48,32" fill="none" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Helicóptero', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><line x1="16" y1="16" x2="44" y2="16" stroke="#000" stroke-width="1.5"/><line x1="30" y1="16" x2="30" y2="34" stroke="#000" stroke-width="1.5"/><path d="M22,34 Q30,24 38,34" fill="none" stroke="#000" stroke-width="1.5"/></svg>` },
                ]
            },
            {
                nombre: 'Drone (RPV / UAV)',
                simbolos: [
                    { title: 'UAV / Drone', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><line x1="10" y1="22" x2="50" y2="22" stroke="#000" stroke-width="1.5"/><polygon points="28,22 30,12 32,22" fill="#000"/></svg>` },
                ]
            },
            {
                nombre: 'Vehículo de Terreno',
                simbolos: [
                    { title: 'Vehículo Blindado', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><ellipse cx="14" cy="22" rx="7" ry="12" fill="none" stroke="#000" stroke-width="1.5"/><ellipse cx="46" cy="22" rx="7" ry="12" fill="none" stroke="#000" stroke-width="1.5"/><line x1="14" y1="10" x2="46" y2="10" stroke="#000" stroke-width="1.5"/><line x1="14" y1="34" x2="46" y2="34" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Camión / Logística', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><rect x="14" y="16" width="32" height="14" fill="none" stroke="#000" stroke-width="1.5"/><circle cx="20" cy="32" r="4" fill="none" stroke="#000"/><circle cx="40" cy="32" r="4" fill="none" stroke="#000"/></svg>` },
                ]
            },
            {
                nombre: 'Superficie del Mar (Buques)',
                simbolos: [
                    { title: 'Buque de Guerra', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><ellipse cx="30" cy="26" rx="20" ry="8" fill="none" stroke="#000" stroke-width="1.5"/><line x1="30" y1="18" x2="30" y2="10" stroke="#000" stroke-width="1.5"/></svg>` },
                    { title: 'Portaaviones', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><ellipse cx="30" cy="28" rx="22" ry="7" fill="none" stroke="#000" stroke-width="1.5"/><polyline points="14,22 20,14 26,22" fill="none" stroke="#000" stroke-width="1.5"/></svg>` },
                ]
            },
            {
                nombre: 'Submarinos',
                simbolos: [
                    { title: 'Submarino', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><rect x="10" y="0" width="40" height="10" fill="#000"/><ellipse cx="30" cy="24" rx="20" ry="10" fill="none" stroke="#000" stroke-width="1.5"/><line x1="30" y1="14" x2="30" y2="8" stroke="#000" stroke-width="1.5"/><line x1="26" y1="8" x2="34" y2="8" stroke="#000" stroke-width="1.5"/></svg>` },
                ]
            },
        ]
    },
    graficos: {
        label: 'Gráficos Tácticos',
        secciones: [
            {
                nombre: 'Líneas y Zonas',
                simbolos: [
                    { title: 'Línea de Fase', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><line x1="8" y1="20" x2="52" y2="20" stroke="#000" stroke-width="2" stroke-dasharray="4,3"/></svg>` },
                    { title: 'Línea de Contacto', svg: `<svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#8bd3f4" stroke="#000" stroke-width="2"/><line x1="8" y1="20" x2="52" y2="20" stroke="#000" stroke-width="2"/><polygon points="50,16 58,20 50,24" fill="#000"/></svg>` },
                ]
            }
        ]
    },
    favoritos: { label: 'Favoritos', secciones: [] },
    especificos: { label: 'Símbolos específicos de función', secciones: [] },
    metoc: { label: 'Metoc', secciones: [] },
};

document.addEventListener('DOMContentLoaded', () => {
    const btnAgregar = document.getElementById('btn-agregar-simbolo');
    const btnCerrar = document.getElementById('btn-cerrar-galeria');
    const panelGaleria = document.getElementById('panel-galeria-simbolos');

    if (btnAgregar && panelGaleria) {
        btnAgregar.onclick = () => panelGaleria.classList.toggle('oculto');
    }
    if (btnCerrar && panelGaleria) {
        btnCerrar.onclick = () => panelGaleria.classList.add('oculto');
    }

    // ====== TABS PRINCIPALES (Galería / Búsqueda) ======
    const tabGaleria = document.getElementById('tab-galeria');
    const tabBusqueda = document.getElementById('tab-busqueda');
    const vistaGaleria = document.getElementById('vista-galeria');
    const vistaBusqueda = document.getElementById('vista-busqueda');

    function activarTab(tab) {
        [tabGaleria, tabBusqueda].forEach(t => t.classList.remove('pg-main-tab-activo'));
        tab.classList.add('pg-main-tab-activo');
        if (tab === tabGaleria) {
            vistaGaleria.style.display = '';
            vistaBusqueda.style.display = 'none';
        } else {
            vistaGaleria.style.display = 'none';
            vistaBusqueda.style.display = '';
            document.getElementById('busqueda-input').focus();
        }
    }

    if (tabGaleria) tabGaleria.onclick = () => activarTab(tabGaleria);
    if (tabBusqueda) tabBusqueda.onclick = () => activarTab(tabBusqueda);

    // ====== CATEGORÍAS DE GALERÍA ======
    const catBtns = document.querySelectorAll('.pg-cat-btn');
    const catContenido = document.getElementById('pg-cat-contenido');

    function renderCategoria(catKey) {
        const cat = SIMBOLOS_DB[catKey];
        if (!cat || cat.secciones.length === 0) {
            catContenido.innerHTML = `<div class="pg-cat-vacio">${cat ? cat.label + ': sin contenido aún' : 'Categoría no encontrada'}</div>`;
            return;
        }
        catContenido.innerHTML = cat.secciones.map((sec, i) => `
            <div class="pg-acordeon">
                <button class="pg-acordeon-btn" data-idx="${i}" data-cat="${catKey}">
                    <span>${sec.nombre}</span>
                    <span class="pg-flecha-acc">❮</span>
                </button>
                <div class="pg-acordeon-grid oculto">
                    ${sec.simbolos.map(s => {
                        if (s.isSeparator) {
                            return `<div class="pg-separador-simbolos">${s.title}</div>`;
                        }
                        return `<div class="pg-simbolo" title="${s.title}">${s.svg}</div>`;
                    }).join('')}
                </div>
            </div>
        `).join('');

        // Bind acordeones
        catContenido.querySelectorAll('.pg-acordeon-btn').forEach(btn => {
            btn.onclick = function() {
                const grid = this.nextElementSibling;
                const flecha = this.querySelector('.pg-flecha-acc');
                const abierto = grid.classList.toggle('oculto');
                flecha.textContent = abierto ? '❮' : '❯';
            };
        });

        // Bind símbolos para colocar en mapa
        vincularSimbolos(catContenido.querySelectorAll('.pg-simbolo'));
    }

    catBtns.forEach(btn => {
        btn.onclick = function() {
            catBtns.forEach(b => b.classList.remove('pg-cat-btn-activo'));
            this.classList.add('pg-cat-btn-activo');
            renderCategoria(this.dataset.cat);
        };
    });

    // ====== BÚSQUEDA ======
    const busquedaInput = document.getElementById('busqueda-input');
    const busquedaResultados = document.getElementById('busqueda-resultados');

    if (busquedaInput) {
        busquedaInput.addEventListener('input', () => {
            const texto = busquedaInput.value.toLowerCase().trim();
            if (texto.length < 3) { busquedaResultados.innerHTML = ''; return; }

            const resultados = [];
            Object.values(SIMBOLOS_DB).forEach(cat => {
                (cat.secciones || []).forEach(sec => {
                    (sec.simbolos || []).forEach(s => {
                        if (s.title.toLowerCase().includes(texto)) resultados.push(s);
                    });
                });
            });

            if (resultados.length === 0) {
                busquedaResultados.innerHTML = `<p style="color:#888;font-size:11px;">Sin resultados para "${texto}"</p>`;
            } else {
                busquedaResultados.innerHTML = resultados.map(s => `
                    <div class="pg-simbolo" title="${s.title}">${s.svg}</div>
                `).join('');
                vincularSimbolos(busquedaResultados.querySelectorAll('.pg-simbolo'));
            }
        });
    }

    // ====== GHOST / COLOCACIÓN EN MAPA ======
    function vincularSimbolos(nodos) {
        nodos.forEach(simb => {
            simb.onclick = function(e) {
                e.stopPropagation();
                const titulo = this.getAttribute('title');
                const svgHtml = this.innerHTML;
                window.simboloEnMano = { titulo, html: svgHtml };

                if (window.simboloGhost) document.body.removeChild(window.simboloGhost);
                window.simboloGhost = document.createElement('div');
                window.simboloGhost.className = 'simbolo-ghost';
                window.simboloGhost.innerHTML = svgHtml;
                document.body.appendChild(window.simboloGhost);

                this.style.outline = '2px solid gold';
                setTimeout(() => this.style.outline = '', 800);
            };
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (window.simboloGhost) {
            // Center the ghost icon on the mouse pointer
            const w = window.simboloGhost.offsetWidth || 90;
            const h = window.simboloGhost.offsetHeight || 60;
            window.simboloGhost.style.left = (e.pageX - w / 2) + 'px';
            window.simboloGhost.style.top  = (e.pageY - h / 2) + 'px';
        }
    });

    // Warn before page refresh
    window.addEventListener('beforeunload', (e) => {
        if (window.marcadoresTacticosActivos && window.marcadoresTacticosActivos.length > 0) {
            e.preventDefault();
            e.returnValue = ''; // Standard way to trigger the warning dialog
        }
    });
});
