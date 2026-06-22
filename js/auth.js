const CLAVE_SESION = 'convenios_medicamentos_usuario';

const pantallaLogin = document.getElementById('pantalla-login');
const appEl = document.getElementById('app');
const formLogin = document.getElementById('form-login');
const inputUsuario = document.getElementById('login-usuario');
const inputPassword = document.getElementById('login-password');
const btnLogout = document.getElementById('btn-logout');
const bienvenidaUsuario = document.getElementById('bienvenida-usuario');
const relojActual = document.getElementById('reloj-actual');

function actualizarReloj() {
  relojActual.textContent = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  relojActual.textContent = relojActual.textContent + " " + new Date().toLocaleTimeString('es-CL',  { hour: '2-digit', minute: '2-digit' });
}

setInterval(actualizarReloj, 1000);
actualizarReloj();

function mostrarApp(nombre) {
  pantallaLogin.classList.add('oculto');
  appEl.classList.remove('oculto');
  bienvenidaUsuario.textContent = `Bienvenido/a, ${nombre}`;
  cargarSelectsMedicamento();
  cargarSelectsProveedor();
  cargarListaProveedores();
}

function mostrarLogin() {
  appEl.classList.add('oculto');
  pantallaLogin.classList.remove('oculto');
  formLogin.reset();
  mostrarMensaje('login-mensaje', '');
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = inputUsuario.value.trim();
  const password = inputPassword.value;

  mostrarMensaje('login-mensaje', 'Verificando...');

  const { data, error } = await supabaseClient
    .from('user')
    .select('*')
    .eq('user', usuario)
    .eq('password', password)
    .maybeSingle();

  if (error) {
    mostrarMensaje('login-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  if (!data) {
    mostrarMensaje('login-mensaje', 'Usuario o contraseña incorrectos.', 'error');
    return;
  }

  sessionStorage.setItem(CLAVE_SESION, data.nombre);
  mostrarApp(data.name);
});

btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem(CLAVE_SESION);
  mostrarLogin();
});

if (sessionStorage.getItem(CLAVE_SESION)) {
  const data = sessionStorage.getItem(CLAVE_SESION);
  mostrarApp(data.name);
} else {
  mostrarLogin();
}
