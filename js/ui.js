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

    // Manejo de Tabs (Formaciones vs Busqueda) sin recargar la página
    const tabs = document.querySelectorAll('.pg-tab');
    const panelContenido = document.getElementById('pg-contenido');
    let contenidoGaleriaOriginal = null;

    tabs.forEach(tab => {
        tab.onclick = function() {
            tabs.forEach(t => t.classList.remove('pg-tab-activo'));
            this.classList.add('pg-tab-activo');

            const targetTab = this.dataset.tab;
            if (targetTab === 'busqueda') {
                if (!contenidoGaleriaOriginal) {
                    contenidoGaleriaOriginal = panelContenido.innerHTML;
                }
                
                panelContenido.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <input type="text" id="busqueda-simbolo-input" class="bc-input" placeholder="Buscar simbolo MSS..." style="width:100%; box-sizing:border-box; margin-bottom:15px; color:#000;">
                        <p style="color: #666; font-size:11px;">Escribe una palabra clave (ej. infanteria, blindado)</p>
                        <div id="busqueda-simbolos-resultados" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:20px;"></div>
                    </div>
                `;
                
                // Funcionalidad de busqueda básica (mock interactivo)
                document.getElementById('busqueda-simbolo-input').addEventListener('input', (e) => {
                    const text = e.target.value.toLowerCase();
                    const resultsContainer = document.getElementById('busqueda-simbolos-resultados');
                    if (text.length < 3) { resultsContainer.innerHTML = ''; return; }
                    
                    // Solo para mostrar funcionamiento de busqueda:
                    resultsContainer.innerHTML = `
                        <div class="pg-simbolo" title="Resultado: ${text}"><svg viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="#80E0FF" stroke="#000" stroke-width="2"/><line x1="2" y1="2" x2="58" y2="38" stroke="#000" stroke-width="1.5"/><line x1="58" y1="2" x2="2" y2="38" stroke="#000" stroke-width="1.5"/></svg></div>
                        <p style="width:100%; color:#aaa; font-size:10px;">(La búsqueda busca en todos los iconos y los copia aquí)</p>
                    `;
                    vincularSimbolosGhost(document.querySelectorAll('#busqueda-simbolos-resultados .pg-simbolo'));
                });
            } else {
                if (contenidoGaleriaOriginal) {
                    panelContenido.innerHTML = contenidoGaleriaOriginal;
                    vincularSeccionesCustom();
                    vincularSimbolosGhost(document.querySelectorAll('.pg-simbolo'));
                }
            }
        };
    });

    // Manejo de colapsables (usando la clase proporcionada por el usuario)
    function vincularSeccionesCustom() {
        // Enlazar los botones custom de toolbar
        const catBtns = document.querySelectorAll('.mssx-symbol-gallery-toolbar-item');
        catBtns.forEach(btn => {
            btn.onclick = function() {
                catBtns.forEach(b => {
                    b.classList.remove('mssp-select');
                    b.classList.add('mssp-main');
                });
                this.classList.remove('mssp-main');
                this.classList.add('mssp-select');
                
                // Mover a la sección correspondiente basándonos en el index o nombre
                // Como es decorativo por ahora en el layout del usuario, solo actualizamos los estilos.
            };
        });

        // Enlazar los acordeones custom de las secciones
        const seccionBtns = document.querySelectorAll('.mssx-symbol-gallery-section-name');
        seccionBtns.forEach(btn => {
            btn.onclick = function() {
                // El contenedor padre tiene la seccion grid
                const seccionContenedor = this.closest('.mssx-symbol-gallery-section');
                if (seccionContenedor) {
                    const grid = seccionContenedor.querySelector('.pg-seccion-grid');
                    const icono = this.querySelector('.mssx-symbol-gallery-section-name-icon');
                    if (grid) {
                        const estaOculto = grid.classList.toggle('oculto');
                        if (icono) {
                            icono.className = estaOculto ? 'mssc-text mssx-symbol-gallery-section-name-icon mssi mssi-angle-left' : 'mssc-text mssx-symbol-gallery-section-name-icon mssi mssi-angle-down';
                        }
                    }
                }
            };
        });
    }

    // Inicializar secciones
    vincularSeccionesCustom();

    // Función para enlazar el click de cualquier símbolo (incluyendo los de búsqueda)
    function vincularSimbolosGhost(nodosSimbolos) {
        nodosSimbolos.forEach(simb => {
            // Limpiar onclick previo para no duplicar si se recarga
            simb.onclick = null;
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
                
                this.style.boxShadow = "0 0 10px gold";
                setTimeout(() => {
                    this.style.boxShadow = "none";
                }, 1000);
            };
        });
    }

    // Ligar inicial
    vincularSimbolosGhost(document.querySelectorAll('.pg-simbolo'));

    // Actualizar posicion del ghost
    document.addEventListener('mousemove', (e) => {
        if (window.simboloGhost) {
            window.simboloGhost.style.left = (e.pageX + 15) + 'px';
            window.simboloGhost.style.top = (e.pageY + 15) + 'px';
        }
    });
});
