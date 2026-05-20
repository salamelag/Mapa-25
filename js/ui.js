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
    const msj = document.getElementById('ter-msj-diplo');
    
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
        document.getElementById('panel-comandante').classList.remove('oculto');
        document.getElementById('texto-comandante').innerText = e ? e.nombre : ejercitoActual;
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
document.addEventListener('DOMContentLoaded', () => {
    const btnAgregar = document.getElementById('btn-agregar-simbolo');
    const btnCerrar = document.getElementById('btn-cerrar-galeria');
    const panelGaleria = document.getElementById('panel-galeria-simbolos');

    if (btnAgregar && panelGaleria) {
        btnAgregar.onclick = () => {
            panelGaleria.classList.toggle('oculto');
        };
    }

    if (btnCerrar && panelGaleria) {
        btnCerrar.onclick = () => {
            panelGaleria.classList.add('oculto');
        };
    }

    // Manejo de Tabs (Formaciones vs Busqueda)
    const tabs = document.querySelectorAll('.pg-tab');
    const categoriasBar = document.querySelector('.pg-categorias');
    const pgContenido = document.getElementById('pg-contenido');

    tabs.forEach(tab => {
        tab.onclick = function() {
            tabs.forEach(t => t.classList.remove('pg-tab-activo'));
            this.classList.add('pg-tab-activo');

            const targetTab = this.dataset.tab;
            if (targetTab === 'busqueda') {
                if (categoriasBar) categoriasBar.style.display = 'none';
                pgContenido.innerHTML = `
                    <div style="padding: 20px 0; text-align: center;">
                        <input type="text" class="bc-input" placeholder="Buscar simbolo MSS..." style="width:100%; box-sizing:border-box; margin-bottom:15px;">
                        <p style="color: #666; font-size:11px;">Escribe una palabra clave (ej. infanteria, blindado)</p>
                    </div>
                `;
            } else {
                if (categoriasBar) categoriasBar.style.display = 'flex';
                // Recargar contenido original recargando la pagina o simplemente recargando el div de formaciones
                location.reload(); // Para simplicidad, o simplemente reconstruimos.
            }
        };
    });

    // Manejo de colapsables de sección
    const titulosSeccion = document.querySelectorAll('.pg-seccion-titulo');
    titulosSeccion.forEach(titulo => {
        titulo.onclick = function() {
            const grid = this.nextElementSibling;
            const flecha = this.querySelector('.pg-flecha');
            
            if (grid) {
                const estaOculto = grid.classList.toggle('oculto');
                if (flecha) {
                    flecha.innerText = estaOculto ? '►' : '▼';
                }
            }
        };
    });

    // Manejo de click en categorías del toolbar superior (Smooth Scroll + Expandir)
    const catBtns = document.querySelectorAll('.pg-cat');
    catBtns.forEach(btn => {
        btn.onclick = function() {
            catBtns.forEach(b => b.classList.remove('pg-cat-activo'));
            this.classList.add('pg-cat-activo');

            const catId = this.dataset.cat;
            const targetSec = document.querySelector(`.pg-seccion[data-seccion="${catId}"]`);
            if (targetSec) {
                // Expandir la sección primero
                const grid = targetSec.querySelector('.pg-seccion-grid');
                const flecha = targetSec.querySelector('.pg-flecha');
                if (grid) grid.classList.remove('oculto');
                if (flecha) flecha.innerText = '▼';

                // Hacer scroll suave hacia ella
                targetSec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        };
    });

    // Click en un símbolo -> Poner en mano y seguir cursor
    const simbolos = document.querySelectorAll('.pg-simbolo');
    simbolos.forEach(simb => {
        simb.onclick = function(e) {
            e.stopPropagation();
            const titulo = this.getAttribute('title');
            const svgHtml = this.innerHTML;
            
            window.simboloEnMano = { titulo, html: svgHtml };
            
            if (window.simboloGhost) {
                document.body.removeChild(window.simboloGhost);
            }
            
            window.simboloGhost = document.createElement('div');
            window.simboloGhost.className = 'simbolo-ghost';
            window.simboloGhost.innerHTML = svgHtml;
            document.body.appendChild(window.simboloGhost);
            
            // Efecto visual temporal en la galería
            this.style.boxShadow = "0 0 10px gold";
            setTimeout(() => {
                this.style.boxShadow = "none";
            }, 1000);
        };
    });

    // Actualizar posicion del ghost (solo cuando hay símbolo en mano)
    document.addEventListener('mousemove', (e) => {
        if (window.simboloGhost) {
            window.simboloGhost.style.left = (e.pageX + 15) + 'px';
            window.simboloGhost.style.top = (e.pageY + 15) + 'px';
        }
    });
});
