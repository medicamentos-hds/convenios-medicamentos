const CLAVE_SESION = 'convenios_medicamentos_usuario';

const pantallaLogin = document.getElementById('pantalla-login');
const appEl = document.getElementById('app');
const formLogin = document.getElementById('form-login');
const inputUsuario = document.getElementById('login-usuario');
const inputPassword = document.getElementById('login-password');
const btnLogout = document.getElementById('btn-logout');

function mostrarApp() {
  pantallaLogin.classList.add('oculto');
  appEl.classList.remove('oculto');
  cargarSelectsMedicamento();
  cargarSelectsProveedor();
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
    .select('user')
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

  sessionStorage.setItem(CLAVE_SESION, usuario);
  mostrarApp();
});

btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem(CLAVE_SESION);
  mostrarLogin();
});

if (sessionStorage.getItem(CLAVE_SESION)) {
  mostrarApp();
} else {
  mostrarLogin();
}
