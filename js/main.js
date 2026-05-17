document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatosEjercitos();
    
    const { data: { session } } = await clienteSupabase.auth.getSession();
    
    if (session) {
        usuarioActual = session.user;
        await verificarAprobacionHUD();
    } else {
        document.getElementById('panel-visitante').classList.remove('oculto');
    }
    
    iniciarPresencia();
    iniciarMapa();
});
