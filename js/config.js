const supabaseUrl = 'https://hwyedjcprazfnzgvughb.supabase.co';
const supabaseKey = 'sb_publishable_0DtFI1RtzZAgNGN0GJOW1g_Qg-mwebE';
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActual = null;
let ejercitoActual = null;
let todosLosEjercitos = {};
let todasLasRelaciones = [];

// Para el mapa
var map;
var listaMarcadores = [];
