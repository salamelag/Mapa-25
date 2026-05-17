// --- LOGIN Y REGISTRO ---
const abrirModalLogin = () => {
    document.getElementById('modal-login').classList.remove('oculto');
    document.getElementById('overlay-oscuro').classList.remove('oculto');
};
document.getElementById('btn-abrir-login').onclick = abrirModalLogin;
document.getElementById('btn-abrir-registro').onclick = abrirModalLogin;
document.getElementById('btn-cerrar-login').onclick = () => {
    document.getElementById('modal-login').classList.add('oculto');
    document.getElementById('overlay-oscuro').classList.add('oculto');
};

document.getElementById('btn-registro').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    msj.innerText = "Registrando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.auth.signUp({ email, password: pass });
    if (error) { msj.innerText = error.message; msj.style.color = "#cc3333"; }
    else { msj.innerText = "Cuenta creada. Ya podes entrar."; msj.style.color = "#32CD32"; }
};

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('input-email').value;
    const pass = document.getElementById('input-pass').value;
    const msj = document.getElementById('msj-login');
    msj.innerText = "Conectando..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password: pass });
    if (error) { msj.innerText = "Credenciales incorrectas."; msj.style.color = "#cc3333"; }
    else { location.reload(); }
};

const cerrarSesion = async () => { await clienteSupabase.auth.signOut(); location.reload(); };
document.getElementById('btn-cerrar-sesion').onclick = cerrarSesion;
document.getElementById('btn-cerrar-sesion-cmd').onclick = cerrarSesion;

// --- RECLAMAR EJERCITO ---
document.getElementById('btn-abrir-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.remove('oculto');
document.getElementById('btn-cerrar-reclamar').onclick = () => document.getElementById('modal-reclamar').classList.add('oculto');

document.getElementById('btn-enviar').onclick = async () => {
    const robloxName = document.getElementById('input-roblox').value;
    const ejercitoSelect = document.getElementById('input-ejercito').value;
    const msj = document.getElementById('mensaje-estado');
    if (!robloxName || !ejercitoSelect) { msj.innerText = "Completa todos los campos."; msj.style.color = "#cc3333"; return; }
    msj.innerText = "Enviando peticion..."; msj.style.color = "yellow";
    const { error } = await clienteSupabase.from('peticiones').insert([
        { usuario_roblox: robloxName, ejercito: ejercitoSelect, email_usuario: usuarioActual.email, estado: 'Pendiente' }
    ]);
    if (error) { msj.innerText = "Error de servidor."; msj.style.color = "#cc3333"; }
    else {
        msj.innerText = "Enviado. Esperando aprobacion del Alto Mando."; msj.style.color = "#32CD32";
        setTimeout(() => document.getElementById('modal-reclamar').classList.add('oculto'), 3000);
    }
};
