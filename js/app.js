// --- Manejo de pestañas ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

function mostrarMensaje(elementId, texto, tipo) {
  const el = document.getElementById(elementId);
  el.textContent = texto;
  el.classList.remove('error', 'ok');
  if (tipo) el.classList.add(tipo);
}

// --- Formato de números con punto como separador de miles (##.###.###) ---
function soloDigitos(valor) {
  return (valor || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function formatoMiles(digitos) {
  if (!digitos) return '';
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function aplicarFormatoMiles(input) {
  input.value = formatoMiles(soloDigitos(input.value));
}

function formatearNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return '-';
  return formatoMiles(String(valor));
}

function obtenerMesAnio(fechaStr) {
  if (!fechaStr) return '';
  const fecha = new Date(`${fechaStr}T00:00:00`);
  const mes = fecha.toLocaleDateString('es-CL', { month: 'long' });
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${fecha.getFullYear()}`;
}

function calcularVariacion(valorActual, valorAnterior) {
  if (!valorAnterior) return null;
  return ((valorActual - valorAnterior) / valorAnterior) * 100;
}

function lineaAnalisis(variacion, anioNuevo, anioViejo) {
  if (variacion === null || !anioNuevo || !anioViejo) {
    return 'Sin datos suficientes para comparar.';
  }
  const tipo = variacion >= 0 ? '⚠️⬆️' : '✔️⬇️';
  return `${tipo} ${Math.abs(variacion).toFixed(2)}% ${anioNuevo} respecto del ${anioViejo}`;
}

function construirAnalisis(med) {
  const anioActualConsumo = med.anio_ant_1 ? med.anio_ant_1 + 1 : null;
  const variacion1 = calcularVariacion(med.consumo_ant_1, med.consumo_ant_2);
  const variacion2 = calcularVariacion(med.consumo_proy, med.consumo_ant_1);

  return `
    <table class="tabla-analisis">
      <tr>
        <th>ANÁLISIS</th>
        <td>
          ${lineaAnalisis(variacion1, med.anio_ant_1, med.anio_ant_2)}<br>
          ${lineaAnalisis(variacion2, anioActualConsumo, med.anio_ant_1)}
        </td>
      </tr>
    </table>`;
}

document.querySelectorAll('input.miles').forEach((input) => {
  input.addEventListener('input', () => aplicarFormatoMiles(input));
});

document.querySelectorAll('input.solo-digitos').forEach((input) => {
  input.addEventListener('input', () => {
    input.value = soloDigitos(input.value);
  });
});

// --- Selects de medicamento (para formularios de convenio) ---
// Cada formulario solo debe ofrecer medicamentos que aún no tengan un
// convenio asociado en esa misma tabla (act o nuevo).
async function cargarSelectsMedicamento() {
  const [medsRes, actRes, nuevoRes] = await Promise.all([
    supabaseClient.from('medicamento').select('id, nombre_med, codigo_med').order('nombre_med', { ascending: true }),
    supabaseClient.from('convenio_act').select('id_medicamento'),
    supabaseClient.from('convenio_nuevo').select('id_medicamento'),
  ]);

  if (medsRes.error) {
    console.error(medsRes.error);
    return;
  }

  const idsConvenioAct = new Set((actRes.data ?? []).map((c) => c.id_medicamento));
  const idsConvenioNuevo = new Set((nuevoRes.data ?? []).map((c) => c.id_medicamento));

  const poblarSelect = (select, idsExcluir) => {
    const valorPrevio = select.value;
    select.innerHTML = '<option value="">Selecciona un medicamento...</option>';
    medsRes.data
      .filter((med) => !idsExcluir.has(med.id))
      .forEach((med) => {
        const option = document.createElement('option');
        option.value = med.id;
        option.textContent = med.codigo_med
          ? `${med.nombre_med} (cod. ${med.codigo_med})`
          : med.nombre_med;
        select.appendChild(option);
      });

    if ([...select.options].some((o) => o.value === valorPrevio)) {
      select.value = valorPrevio;
    }
  };

  document
    .querySelectorAll('#form-convenio-act select[name="id_medicamento"]')
    .forEach((select) => poblarSelect(select, idsConvenioAct));
  document
    .querySelectorAll('#form-convenio-nuevo select[name="id_medicamento"]')
    .forEach((select) => poblarSelect(select, idsConvenioNuevo));
}

document.querySelectorAll('.btn-refrescar-medicamento').forEach((btn) => {
  btn.addEventListener('click', () => cargarSelectsMedicamento());
});

// --- Selects de proveedor (para formularios de convenio) ---
const VALOR_NUEVO_PROVEEDOR = '__nuevo__';

async function cargarSelectsProveedor() {
  const { data, error } = await supabaseClient
    .from('proveedor')
    .select('id, nombre_proveedor')
    .order('nombre_proveedor', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const selects = document.querySelectorAll('select.select-proveedor');
  selects.forEach((select) => {
    const valorPrevio = select.value;
    select.innerHTML = '<option value="">Selecciona un proveedor...</option>';
    data.forEach((prov) => {
      const option = document.createElement('option');
      option.value = prov.id;
      option.textContent = prov.nombre_proveedor;
      select.appendChild(option);
    });
    const opcionNueva = document.createElement('option');
    opcionNueva.value = VALOR_NUEVO_PROVEEDOR;
    opcionNueva.textContent = '+ Agregar nuevo proveedor...';
    select.appendChild(opcionNueva);

    if ([...select.options].some((o) => o.value === valorPrevio)) {
      select.value = valorPrevio;
    }
  });
}

function configurarSelectorProveedor(form) {
  const select = form.querySelector('select.select-proveedor');
  const campoNuevo = form.querySelector('.campo-nuevo-proveedor');
  const inputNuevo = form.querySelector('.input-nuevo-proveedor');

  inputNuevo.required = false;

  select.addEventListener('change', () => {
    const esNuevo = select.value === VALOR_NUEVO_PROVEEDOR;
    campoNuevo.classList.toggle('oculto', !esNuevo);
    inputNuevo.required = esNuevo;
    if (!esNuevo) inputNuevo.value = '';
  });
}

// --- Ingresar proveedor ---
const modalNuevoProveedor = document.getElementById('modal-nuevo-proveedor');
const formNuevoProveedor = document.getElementById('form-nuevo-proveedor');

function abrirModalNuevoProveedor() {
  formNuevoProveedor.reset();
  mostrarMensaje('nuevo-proveedor-mensaje', '');
  modalNuevoProveedor.classList.remove('oculto');
}

function cerrarModalNuevoProveedor() {
  modalNuevoProveedor.classList.add('oculto');
}

document.getElementById('btn-abrir-nuevo-proveedor').addEventListener('click', abrirModalNuevoProveedor);
document.getElementById('btn-cancelar-nuevo-proveedor').addEventListener('click', cerrarModalNuevoProveedor);

formNuevoProveedor.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombreProveedor = formNuevoProveedor.elements['nombre_proveedor'].value.trim();

  const { error } = await supabaseClient
    .from('proveedor')
    .insert({ nombre_proveedor: nombreProveedor });

  if (error) {
    mostrarMensaje('nuevo-proveedor-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  cerrarModalNuevoProveedor();
  await Promise.all([cargarListaProveedores(inputBuscarProveedor.value.trim()), cargarSelectsProveedor()]);
});

// --- Listado y edición de proveedores ---
const listaProveedoresDiv = document.getElementById('lista-proveedores');
const inputBuscarProveedor = document.getElementById('buscar-proveedor');
const modalEditarProveedor = document.getElementById('modal-editar-proveedor');
const formEditarProveedor = document.getElementById('form-editar-proveedor');

inputBuscarProveedor.addEventListener('input', () => {
  cargarListaProveedores(inputBuscarProveedor.value.trim());
});

async function cargarListaProveedores(filtroNombre) {
  let query = supabaseClient
    .from('proveedor')
    .select('id, nombre_proveedor')
    .order('nombre_proveedor', { ascending: true });

  if (filtroNombre) {
    query = query.ilike('nombre_proveedor', `%${filtroNombre}%`);
  }

  const { data, error } = await query;

  if (error) {
    mostrarMensaje('proveedores-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  if (!data.length) {
    listaProveedoresDiv.innerHTML = '';
    mostrarMensaje('proveedores-mensaje', filtroNombre ? 'Sin resultados.' : 'No hay proveedores registrados.');
    return;
  }

  mostrarMensaje('proveedores-mensaje', '');

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <table>
      <h3>Listado de Proveedores</h3>
      <tr>
        <th>Nombre</th>
        <th>Acción</th>
      </tr>
      ${data.map((prov) => `
        <tr>
          <td>${prov.nombre_proveedor}</td>
          <td><button type="button" class="btn-editar-convenio btn-editar-proveedor" data-id="${prov.id}">✏️ Editar</button></td>
        </tr>
      `).join('')}
    </table>`;

  card.querySelectorAll('.btn-editar-proveedor').forEach((btn) => {
    const proveedor = data.find((p) => String(p.id) === btn.dataset.id);
    btn.addEventListener('click', () => abrirModalEditarProveedor(proveedor));
  });

  listaProveedoresDiv.innerHTML = '';
  listaProveedoresDiv.appendChild(card);
}

function abrirModalEditarProveedor(proveedor) {
  formEditarProveedor.elements['id'].value = proveedor.id;
  formEditarProveedor.elements['nombre_proveedor'].value = proveedor.nombre_proveedor;
  mostrarMensaje('editar-proveedor-mensaje', '');
  modalEditarProveedor.classList.remove('oculto');
}

function cerrarModalEditarProveedor() {
  modalEditarProveedor.classList.add('oculto');
}

document.getElementById('btn-cancelar-editar-proveedor').addEventListener('click', cerrarModalEditarProveedor);

formEditarProveedor.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(formEditarProveedor);
  const id = formData.get('id');
  const nombreProveedor = formData.get('nombre_proveedor').trim();

  const { error } = await supabaseClient
    .from('proveedor')
    .update({ nombre_proveedor: nombreProveedor })
    .eq('id', id);

  if (error) {
    mostrarMensaje('editar-proveedor-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  cerrarModalEditarProveedor();
  await Promise.all([cargarListaProveedores(inputBuscarProveedor.value.trim()), cargarSelectsProveedor()]);
});

// --- Buscar medicamentos + convenios relacionados ---
const formBuscar = document.getElementById('form-buscar');
const resultadosDiv = document.getElementById('resultados');
const paginadorDiv = document.getElementById('paginador');
const btnDescargarPdf = document.getElementById('btn-descargar-pdf');

const RESULTADOS_POR_PAGINA = 5;
let medicamentosEncontrados = [];
let paginaActual = 1;

formBuscar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = document.getElementById('buscar-texto').value.trim();
  const textoConvenio = document.getElementById('buscar-convenio').value.trim();
  const anio = document.getElementById('buscar-anio').value.trim();
  await buscarMedicamentos(texto, textoConvenio, anio);
});

function limpiarBusqueda() {
  formBuscar.reset();
  resultadosDiv.innerHTML = '';
  paginadorDiv.innerHTML = '';
  paginadorDiv.classList.add('oculto');
  medicamentosEncontrados = [];
  paginaActual = 1;
  mostrarMensaje('buscar-mensaje', '');
  btnDescargarPdf.classList.add('oculto');
}

document.getElementById('btn-limpiar').addEventListener('click', limpiarBusqueda);

function obtenerRangoFecha(anio) {
  if (!anio) return null;
  const anioNum = Number(anio);
  const inicio = new Date(anioNum, 0, 1);
  const fin = new Date(anioNum + 1, 0, 1);
  return { inicio, fin };
}

const modalProcesandoPdf = document.getElementById('modal-procesando-pdf');

btnDescargarPdf.addEventListener('click', async () => {
  btnDescargarPdf.disabled = true;
  mostrarMensaje('buscar-mensaje', 'Generando PDF...');
  modalProcesandoPdf.classList.remove('oculto');

  try {
    resultadosDiv.innerHTML = '';
    for (const med of medicamentosEncontrados) {
      const card = await construirCardMedicamento(med);
      card.querySelector('.card-detalle').classList.remove('oculto');
      const btnVerDetalle = card.querySelector('.btn-ver-detalle-medicamento');
      btnVerDetalle.classList.add('icon-collapse-abierto');
      btnVerDetalle.setAttribute('aria-expanded', 'true');
      resultadosDiv.appendChild(card);
    }

    const canvas = await html2canvas(resultadosDiv, { scale: 2, useCORS: true });
    const imagenDatos = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');

    const anchoPagina = pdf.internal.pageSize.getWidth();
    const altoPagina = pdf.internal.pageSize.getHeight();
    const altoImagen = (canvas.height * anchoPagina) / canvas.width;

    let alturaRestante = altoImagen;
    let posicionY = 0;

    pdf.addImage(imagenDatos, 'PNG', 0, posicionY, anchoPagina, altoImagen);
    alturaRestante -= altoPagina;

    while (alturaRestante > 0) {
      posicionY -= altoPagina;
      pdf.addPage();
      pdf.addImage(imagenDatos, 'PNG', 0, posicionY, anchoPagina, altoImagen);
      alturaRestante -= altoPagina;
    }

    pdf.save(`resultados-medicamentos-${new Date().toISOString().slice(0, 10)}.pdf`);
    mostrarMensaje('buscar-mensaje', 'PDF descargado correctamente.', 'ok');
  } catch (error) {
    mostrarMensaje('buscar-mensaje', `Error al generar el PDF: ${error.message}`, 'error');
  } finally {
    await renderizarPagina();
    modalProcesandoPdf.classList.add('oculto');
    btnDescargarPdf.disabled = false;
  }
});

async function buscarIdsMedicamentoPorConvenio(textoConvenio) {
  const [actRes, nuevoRes] = await Promise.all([
    supabaseClient.from('convenio_act').select('id_medicamento').ilike('id_convenio', `%${textoConvenio}%`),
    supabaseClient.from('convenio_nuevo').select('id_medicamento').ilike('id_convenio', `%${textoConvenio}%`),
  ]);

  const error = actRes.error || nuevoRes.error;
  if (error) return { ids: [], error };

  const ids = [...(actRes.data ?? []), ...(nuevoRes.data ?? [])].map((c) => c.id_medicamento);
  return { ids: [...new Set(ids)], error: null };
}

async function buscarMedicamentos(texto, textoConvenio, anio) {
  mostrarMensaje('buscar-mensaje', 'Buscando...');
  resultadosDiv.innerHTML = '';
  paginadorDiv.innerHTML = '';
  paginadorDiv.classList.add('oculto');
  medicamentosEncontrados = [];
  btnDescargarPdf.classList.add('oculto');

  let query = supabaseClient.from('medicamento').select('*').order('nombre_med');

  const rangoFecha = obtenerRangoFecha(anio);
  if (rangoFecha) {
    query = query
      .gte('fecha_actual', rangoFecha.inicio.toISOString().slice(0, 10))
      .lt('fecha_actual', rangoFecha.fin.toISOString().slice(0, 10));
  }

  if (texto) {
    const esNumero = /^\d+$/.test(texto);
    if (esNumero) {
      query = query.or(`codigo_med.eq.${texto},nombre_med.ilike.%${texto}%`);
    } else {
      query = query.ilike('nombre_med', `%${texto}%`);
    }
  }

  if (textoConvenio) {
    const { ids, error: errorConvenio } = await buscarIdsMedicamentoPorConvenio(textoConvenio);

    if (errorConvenio) {
      mostrarMensaje('buscar-mensaje', `Error: ${errorConvenio.message}`, 'error');
      return;
    }

    if (!ids.length) {
      mostrarMensaje('buscar-mensaje', 'Sin resultados.');
      return;
    }

    query = query.in('id', ids);
  }

  const { data: medicamentos, error } = await query.limit(50);

  if (error) {
    mostrarMensaje('buscar-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  if (!medicamentos.length) {
    mostrarMensaje('buscar-mensaje', 'Sin resultados.');
    return;
  }

  mostrarMensaje('buscar-mensaje', `${medicamentos.length} resultado(s).`, 'ok');

  medicamentosEncontrados = medicamentos;
  paginaActual = 1;
  await renderizarPagina();

  btnDescargarPdf.classList.remove('oculto');
}

async function renderizarPagina() {
  const totalPaginas = Math.max(1, Math.ceil(medicamentosEncontrados.length / RESULTADOS_POR_PAGINA));
  paginaActual = Math.min(Math.max(1, paginaActual), totalPaginas);

  const inicio = (paginaActual - 1) * RESULTADOS_POR_PAGINA;
  const medicamentosPagina = medicamentosEncontrados.slice(inicio, inicio + RESULTADOS_POR_PAGINA);

  resultadosDiv.innerHTML = '';
  for (const med of medicamentosPagina) {
    const card = await construirCardMedicamento(med);
    resultadosDiv.appendChild(card);
  }

  renderizarPaginador(totalPaginas);
}

function renderizarPaginador(totalPaginas) {
  paginadorDiv.innerHTML = '';

  if (totalPaginas <= 1) {
    paginadorDiv.classList.add('oculto');
    return;
  }

  paginadorDiv.classList.remove('oculto');

  const irAPagina = (pagina) => {
    paginaActual = pagina;
    renderizarPagina();
  };

  const btnAnterior = document.createElement('button');
  btnAnterior.type = 'button';
  btnAnterior.textContent = '‹ Anterior';
  btnAnterior.disabled = paginaActual === 1;
  btnAnterior.addEventListener('click', () => irAPagina(paginaActual - 1));
  paginadorDiv.appendChild(btnAnterior);

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    const btnPagina = document.createElement('button');
    btnPagina.type = 'button';
    btnPagina.textContent = String(pagina);
    btnPagina.classList.toggle('active', pagina === paginaActual);
    btnPagina.addEventListener('click', () => irAPagina(pagina));
    paginadorDiv.appendChild(btnPagina);
  }

  const btnSiguiente = document.createElement('button');
  btnSiguiente.type = 'button';
  btnSiguiente.textContent = 'Siguiente ›';
  btnSiguiente.disabled = paginaActual === totalPaginas;
  btnSiguiente.addEventListener('click', () => irAPagina(paginaActual + 1));
  paginadorDiv.appendChild(btnSiguiente);
}

async function construirCardMedicamento(med) {
  const [actRes, nuevoRes] = await Promise.all([
    supabaseClient
      .from('convenio_act')
      .select('*, proveedor(nombre_proveedor)')
      .eq('id_medicamento', med.id),
    supabaseClient
      .from('convenio_nuevo')
      .select('*, proveedor(nombre_proveedor)')
      .eq('id_medicamento', med.id),
  ]);

  const card = document.createElement('div');
  card.className = 'card';

  card.innerHTML = `
    <button type="button" class="btn-ver-detalle-medicamento icon-collapse" title="Ver detalle" aria-expanded="false">▾</button>
    <div class="card-header">
      <h3>${med.nombre_med}${med.fecha_actual ? ` (${med.fecha_actual.slice(0, 4)})` : ''}</h3>
    </div>
    <div class="card-detalle oculto">
      <div class="card-header-acciones">
        <button type="button" class="btn-editar-medicamento">✏️ Editar</button>
        <button type="button" class="btn-eliminar-medicamento">❌ Eliminar</button>
      </div>
      <table class="tabla-consumo">
        <tr>
          <th>Código</th>
          <th>Consumo Actual (${obtenerMesAnio(med.fecha_actual)})</th>
          <th>Promedio Reposición</th>
          <th>Consumo Proyectado</th>
        </tr>
        <tr>
          <td>${med.codigo_med ?? '-'}</td>
          <td>${formatearNumero(med.consumo_actual)}</td>
          <td>${formatearNumero(med.prom_repo)}</td>
          <td>${formatearNumero(med.consumo_proy)}</td>
        </tr>
      </table>
      <table class="tabla-consumo">
        <tr>
          <th>Consumo Año ${med.anio_ant_2 ?? '-'}</th>
          <th>Consumo Año ${med.anio_ant_1 ?? '-'}</th>
        </tr>
        <tr>
          <td>${formatearNumero(med.consumo_ant_2)}</td>
          <td>${formatearNumero(med.consumo_ant_1)}</td>
        </tr>
      </table>
      ${construirAnalisis(med)}
      ${construirTablaComparativaConvenios(actRes.data?.[0], nuevoRes.data?.[0])}
      <table class="tabla-consumo">
        <tr>
          <th>Observaciones</th>
        </tr>
        <tr>
          <td>${med.observaciones || '-'}</td>
        </tr>
      </table>
    </div>
  `;

  const detalle = card.querySelector('.card-detalle');
  const btnVerDetalle = card.querySelector('.btn-ver-detalle-medicamento');
  btnVerDetalle.addEventListener('click', () => {
    const oculto = detalle.classList.toggle('oculto');
    btnVerDetalle.classList.toggle('icon-collapse-abierto', !oculto);
    btnVerDetalle.setAttribute('aria-expanded', String(!oculto));
    btnVerDetalle.title = oculto ? 'Ver detalle' : 'Ocultar detalle';
  });

  card.querySelector('.btn-editar-medicamento').addEventListener('click', () => abrirModalEditar(med));
  card.querySelector('.btn-eliminar-medicamento').addEventListener('click', () => eliminarMedicamento(med));

  card.querySelectorAll('.btn-editar-convenio').forEach((btn) => {
    const tabla = btn.dataset.tabla;
    const convenio = tabla === 'convenio_act' ? actRes.data?.[0] : nuevoRes.data?.[0];
    btn.addEventListener('click', () => abrirModalEditarConvenio(tabla, convenio));
  });

  card.querySelectorAll('.btn-eliminar-convenio').forEach((btn) => {
    const tabla = btn.dataset.tabla;
    const convenio = tabla === 'convenio_act' ? actRes.data?.[0] : nuevoRes.data?.[0];
    btn.addEventListener('click', () => eliminarConvenio(tabla, convenio));
  });

  card.querySelectorAll('.link-licitacion').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      abrirModalLicitacion(link.dataset.idConvenio);
    });
  });

  return card;
}

// --- Ver licitación en Mercado Público (en ventana popup) ---
function abrirModalLicitacion(idConvenio) {
  const url = `http://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${encodeURIComponent(idConvenio)}`;
  window.open(url, 'licitacion', 'width=1000,height=800,noopener,noreferrer');
}

// --- Editar medicamento (consumo años anteriores y observaciones) ---
const modalEditar = document.getElementById('modal-editar-medicamento');
const formEditarMedicamento = document.getElementById('form-editar-medicamento');

function abrirModalEditar(med) {
  formEditarMedicamento.elements['id'].value = med.id;
  formEditarMedicamento.elements['consumo_ant_2'].value = formatoMiles(String(med.consumo_ant_2 ?? 0));
  formEditarMedicamento.elements['consumo_ant_1'].value = formatoMiles(String(med.consumo_ant_1 ?? 0));
  formEditarMedicamento.elements['consumo_actual'].value = formatoMiles(String(med.consumo_actual ?? 0));
  formEditarMedicamento.elements['prom_repo'].value = formatoMiles(String(med.prom_repo ?? 0));
  formEditarMedicamento.elements['observaciones'].value = med.observaciones || '';
  document.getElementById('label-editar-consumo-ant-2').textContent = `Consumo Año ${med.anio_ant_2 ?? '-'}`;
  document.getElementById('label-editar-consumo-ant-1').textContent = `Consumo Año ${med.anio_ant_1 ?? '-'}`;
  document.getElementById('label-editar-consumo-actual').textContent =
    `Consumo Actual (${nombreMesActual} ${anioActual})`;
  mostrarMensaje('editar-medicamento-mensaje', '');
  modalEditar.classList.remove('oculto');
}

function cerrarModalEditar() {
  modalEditar.classList.add('oculto');
}

document.getElementById('btn-cancelar-editar').addEventListener('click', cerrarModalEditar);

formEditarMedicamento.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(formEditarMedicamento);
  const id = formData.get('id');
  const consumoActual = Number(soloDigitos(formData.get('consumo_actual'))) || 0;
  const payload = {
    consumo_ant_2: Number(soloDigitos(formData.get('consumo_ant_2'))) || 0,
    consumo_ant_1: Number(soloDigitos(formData.get('consumo_ant_1'))) || 0,
    consumo_actual: consumoActual,
    consumo_proy: consumoActual ? Math.round((consumoActual / mesActualNumero) * 12) : 0,
    prom_repo: Number(soloDigitos(formData.get('prom_repo'))) || 0,
    observaciones: formData.get('observaciones'),
  };

  const { error } = await supabaseClient.from('medicamento').update(payload).eq('id', id);

  if (error) {
    mostrarMensaje('editar-medicamento-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  cerrarModalEditar();
  formBuscar.requestSubmit();
});

// --- Editar convenio (cantidad, precio unitario neto, duración) ---
const modalEditarConvenio = document.getElementById('modal-editar-convenio');
const formEditarConvenio = document.getElementById('form-editar-convenio');

function abrirModalEditarConvenio(tabla, convenio) {
  if (!convenio) return;
  formEditarConvenio.dataset.tabla = tabla;
  formEditarConvenio.elements['id'].value = convenio.id;
  formEditarConvenio.elements['id_convenio'].value = convenio.id_convenio ?? '';
  formEditarConvenio.elements['cantidad'].value = formatoMiles(String(convenio.cantidad ?? 0));
  formEditarConvenio.elements['precio_unit_neto'].value = formatoMiles(String(convenio.precio_unit_neto ?? 0));
  formEditarConvenio.elements['duracion_meses'].value = formatoMiles(String(convenio.duracion_meses ?? 0));
  mostrarMensaje('editar-convenio-mensaje', '');
  modalEditarConvenio.classList.remove('oculto');
}

function cerrarModalEditarConvenio() {
  modalEditarConvenio.classList.add('oculto');
}

document.getElementById('btn-cancelar-editar-convenio').addEventListener('click', cerrarModalEditarConvenio);

formEditarConvenio.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(formEditarConvenio);
  const id = formData.get('id');
  const tabla = formEditarConvenio.dataset.tabla;
  const idConvenio = formData.get('id_convenio').trim();
  const cantidad = Number(soloDigitos(formData.get('cantidad'))) || 0;
  const precioUnitNeto = Number(soloDigitos(formData.get('precio_unit_neto'))) || 0;
  const duracionMeses = Number(soloDigitos(formData.get('duracion_meses'))) || 0;
  const precioTotal = cantidad && precioUnitNeto ? Math.round(cantidad * precioUnitNeto * 1.19) : 0;
  const precioAnual = precioTotal && duracionMeses ? Math.round(precioTotal / (duracionMeses / 12)) : 0;
  const payload = {
    id_convenio: idConvenio,
    cantidad,
    precio_unit_neto: precioUnitNeto,
    duracion_meses: duracionMeses,
    precio_total_conv: precioTotal,
    precio_anual_conv: precioAnual,
  };

  const { error } = await supabaseClient.from(tabla).update(payload).eq('id', id);

  if (error) {
    mostrarMensaje('editar-convenio-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  cerrarModalEditarConvenio();
  formBuscar.requestSubmit();
});

async function eliminarConvenio(tabla, convenio) {
  if (!convenio) return;
  if (!confirm('¿Está seguro de que desea eliminar este convenio?')) return;

  const { data, error } = await supabaseClient.from(tabla).delete().eq('id', convenio.id).select();

  if (error) {
    alert(`Error: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    alert('No se pudo eliminar el convenio. Verifique que existan permisos (política RLS) de eliminación en la base de datos.');
    return;
  }

  formBuscar.requestSubmit();
}

async function eliminarMedicamento(med) {
  if (!confirm('¿Está seguro de que desea eliminar este medicamento y sus convenios asociados? El proveedor no se eliminará.')) return;

  const [actDel, nuevoDel] = await Promise.all([
    supabaseClient.from('convenio_act').delete().eq('id_medicamento', med.id),
    supabaseClient.from('convenio_nuevo').delete().eq('id_medicamento', med.id),
  ]);

  if (actDel.error || nuevoDel.error) {
    alert(`Error: ${(actDel.error || nuevoDel.error).message}`);
    return;
  }

  const { data, error } = await supabaseClient.from('medicamento').delete().eq('id', med.id).select();

  if (error) {
    alert(`Error: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    alert('No se pudo eliminar el medicamento. Verifique que existan permisos (política RLS) de eliminación en la base de datos.');
    return;
  }

  formBuscar.requestSubmit();
}

function enlaceLicitacion(idConvenio) {
  if (!idConvenio) return '-';
  return `<a href="#" class="link-licitacion" data-id-convenio="${idConvenio}">${idConvenio}</a>`;
}

function construirTablaComparativaConvenios(actual, nuevo) {
  const fila = (etiqueta, valorActual, valorNuevo) => `
    <tr>
      <th>${etiqueta}</th>
      <td>${valorActual}</td>
      <td>${valorNuevo}</td>
    </tr>`;

  const dinero = (valor) => (valor === null || valor === undefined || valor === '' ? '-' : `$ ${formatearNumero(valor)}`);
  const meses = (valor) => (valor === null || valor === undefined || valor === '' ? '-' : `${formatearNumero(valor)} MESES`);

  return `
    <table class="tabla-convenios">
      <tr>
        <th></th>
        <th>CONVENIO ACTUAL</th>
        <th>CONVENIO NUEVO</th>
      </tr>
      ${fila('ID CONVENIO', enlaceLicitacion(actual?.id_convenio), enlaceLicitacion(nuevo?.id_convenio))}
      ${fila('PROVEEDOR ADJUDICADO', actual?.proveedor?.nombre_proveedor ?? '-', nuevo?.proveedor?.nombre_proveedor ?? '-')}
      ${fila('CANTIDAD', formatearNumero(actual?.cantidad), formatearNumero(nuevo?.cantidad))}
      ${fila('PRECIO UNITARIO NETO', dinero(actual?.precio_unit_neto), dinero(nuevo?.precio_unit_neto))}
      ${fila('DURACIÓN', meses(actual?.duracion_meses), meses(nuevo?.duracion_meses))}
      ${fila('PRECIO TOTAL CONVENIO', dinero(actual?.precio_total_conv), dinero(nuevo?.precio_total_conv))}
      ${fila('PRECIO ANUAL', dinero(actual?.precio_anual_conv), dinero(nuevo?.precio_anual_conv))}
      ${fila(
        'ACCIONES',
        actual
          ? '<button type="button" class="btn-editar-convenio" data-tabla="convenio_act">✏️ Editar</button> <button type="button" class="btn-eliminar-convenio" data-tabla="convenio_act">❌ Eliminar</button>'
          : '-',
        nuevo
          ? '<button type="button" class="btn-editar-convenio" data-tabla="convenio_nuevo">✏️ Editar</button> <button type="button" class="btn-eliminar-convenio" data-tabla="convenio_nuevo">❌ Eliminar</button>'
          : '-'
      )}
    </table>`;
}

// --- Ingresar medicamento ---
const formMedicamento = document.getElementById('form-medicamento');

const anioActual = new Date().getFullYear();
const anioAnt1 = anioActual - 1;
const anioAnt2 = anioActual - 2;

document.getElementById('label-consumo-ant-1').textContent = `Consumo Año ${anioAnt1}`;
document.getElementById('label-consumo-ant-2').textContent = `Consumo Año ${anioAnt2}`;

const nombreMesActual = new Date().toLocaleDateString('es-CL', { month: 'long' });
document.getElementById('label-consumo-actual').textContent =
  `Consumo Actual (${nombreMesActual} ${anioActual})`;

const mesActualNumero = new Date().getMonth() + 1;
const inputConsumoActual = formMedicamento.elements['consumo_actual'];
const inputConsumoProy = document.getElementById('input-consumo-proy');

inputConsumoActual.addEventListener('input', () => {
  const consumoActual = Number(soloDigitos(inputConsumoActual.value));
  const proyectado = consumoActual
    ? Math.round((consumoActual / mesActualNumero) * 12)
    : '';
  inputConsumoProy.value = formatoMiles(String(proyectado));
});

formMedicamento.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(formMedicamento);
  const payload = formDataANumeros(formData, ['nombre_med', 'observaciones']);
  payload.anio_ant_1 = anioAnt1;
  payload.anio_ant_2 = anioAnt2;
  payload.fecha_actual = new Date().toISOString().slice(0, 10);
  payload.consumo_proy = Number(soloDigitos(inputConsumoProy.value)) || 0;

  const { error } = await supabaseClient.from('medicamento').insert(payload);

  if (error) {
    mostrarMensaje('medicamento-mensaje', `Error: ${error.message}`, 'error');
    return;
  }

  mostrarMensaje('medicamento-mensaje', 'Medicamento guardado correctamente.', 'ok');
  formMedicamento.reset();
  await cargarSelectsMedicamento();
});

document.getElementById('btn-limpiar-medicamento').addEventListener('click', () => {
  formMedicamento.reset();
  mostrarMensaje('medicamento-mensaje', '');
});

// --- Ingresar convenios (vigente y nuevo) ---
function configurarFormularioConvenio(formId, mensajeId, tabla) {
  const form = document.getElementById(formId);

  configurarSelectorProveedor(form);
  const selectProveedor = form.querySelector('select.select-proveedor');
  const inputNuevoProveedor = form.querySelector('.input-nuevo-proveedor');

  const inputCantidad = form.elements['cantidad'];
  const inputPrecioUnitNeto = form.elements['precio_unit_neto'];
  const inputDuracionMeses = form.elements['duracion_meses'];
  const inputPrecioTotal = form.elements['precio_total_conv'];
  const inputPrecioAnual = form.elements['precio_anual_conv'];

  const recalcularPrecios = () => {
    const cantidad = Number(soloDigitos(inputCantidad.value));
    const precioUnitNeto = Number(soloDigitos(inputPrecioUnitNeto.value));
    const duracionMeses = Number(soloDigitos(inputDuracionMeses.value));

    const precioTotal = cantidad && precioUnitNeto
      ? Math.round(cantidad * precioUnitNeto * 1.19)
      : '';
    inputPrecioTotal.value = formatoMiles(String(precioTotal));

    const precioAnual = precioTotal && duracionMeses
      ? Math.round(precioTotal / (duracionMeses / 12))
      : '';
    inputPrecioAnual.value = formatoMiles(String(precioAnual));
  };

  inputCantidad.addEventListener('input', recalcularPrecios);
  inputPrecioUnitNeto.addEventListener('input', recalcularPrecios);
  inputDuracionMeses.addEventListener('input', recalcularPrecios);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = formDataANumeros(formData, ['id_convenio']);
    payload.id_medicamento = Number(payload.id_medicamento);
    payload.precio_total_conv = Number(soloDigitos(inputPrecioTotal.value)) || 0;
    payload.precio_anual_conv = Number(soloDigitos(inputPrecioAnual.value)) || 0;

    if (!payload.id_medicamento) {
      mostrarMensaje(mensajeId, 'Selecciona un medicamento.', 'error');
      return;
    }

    if (selectProveedor.value === VALOR_NUEVO_PROVEEDOR) {
      const nombreNuevoProveedor = inputNuevoProveedor.value.trim();
      if (!nombreNuevoProveedor) {
        mostrarMensaje(mensajeId, 'Ingresa el nombre del nuevo proveedor.', 'error');
        return;
      }

      const { data: nuevoProveedor, error: errorProveedor } = await supabaseClient
        .from('proveedor')
        .insert({ nombre_proveedor: nombreNuevoProveedor })
        .select('id')
        .single();

      if (errorProveedor) {
        mostrarMensaje(mensajeId, `Error: ${errorProveedor.message}`, 'error');
        return;
      }

      payload.id_proveedor = nuevoProveedor.id;
      await cargarSelectsProveedor();
    } else {
      payload.id_proveedor = selectProveedor.value ? Number(selectProveedor.value) : null;
    }

    const { error } = await supabaseClient.from(tabla).insert(payload);

    if (error) {
      mostrarMensaje(mensajeId, `Error: ${error.message}`, 'error');
      return;
    }

    mostrarMensaje(mensajeId, 'Convenio guardado correctamente.', 'ok');
    form.reset();
    form.querySelector('.campo-nuevo-proveedor').classList.add('oculto');
    inputNuevoProveedor.required = false;
    await cargarSelectsMedicamento();
  });

  form.querySelector('.btn-limpiar-convenio').addEventListener('click', () => {
    form.reset();
    form.querySelector('.campo-nuevo-proveedor').classList.add('oculto');
    inputNuevoProveedor.required = false;
    mostrarMensaje(mensajeId, '');
  });
}

configurarFormularioConvenio('form-convenio-act', 'convenio-act-mensaje', 'convenio_act');
configurarFormularioConvenio('form-convenio-nuevo', 'convenio-nuevo-mensaje', 'convenio_nuevo');

// Convierte los valores de un FormData a objeto, dejando como texto los
// campos indicados y convirtiendo el resto a número (quitando los puntos
// de separador de miles), o null si está vacío.
function formDataANumeros(formData, camposTexto) {
  const payload = {};
  for (const [clave, valor] of formData.entries()) {
    if (valor === '') {
      payload[clave] = null;
    } else if (camposTexto.includes(clave)) {
      payload[clave] = valor;
    } else {
      payload[clave] = Number(soloDigitos(valor));
    }
  }
  return payload;
}

// --- Limpieza general (al cerrar sesión) ---
function limpiarTodosLosFormularios() {
  limpiarBusqueda();

  formMedicamento.reset();
  inputConsumoProy.value = '';
  mostrarMensaje('medicamento-mensaje', '');

  document.querySelectorAll('#form-convenio-act, #form-convenio-nuevo').forEach((form) => {
    form.reset();
    form.querySelector('.campo-nuevo-proveedor').classList.add('oculto');
    form.querySelector('.input-nuevo-proveedor').required = false;
  });
  mostrarMensaje('convenio-act-mensaje', '');
  mostrarMensaje('convenio-nuevo-mensaje', '');

  formNuevoProveedor.reset();
  inputBuscarProveedor.value = '';
  mostrarMensaje('nuevo-proveedor-mensaje', '');

  cerrarModalEditar();
  cerrarModalEditarConvenio();
  cerrarModalEditarProveedor();
  cerrarModalNuevoProveedor();
  modalProcesandoPdf.classList.add('oculto');
}

// --- Inicialización ---
// La carga de selects se dispara desde js/auth.js una vez el usuario inicia sesión.
