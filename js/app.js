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
async function cargarSelectsMedicamento() {
  const { data, error } = await supabaseClient
    .from('medicamento')
    .select('id, nombre_med, codigo_med')
    .order('nombre_med', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const selects = document.querySelectorAll('select[name="id_medicamento"]');
  selects.forEach((select) => {
    select.innerHTML = '<option value="">Selecciona un medicamento...</option>';
    data.forEach((med) => {
      const option = document.createElement('option');
      option.value = med.id;
      option.textContent = med.codigo_med
        ? `${med.nombre_med} (cod. ${med.codigo_med})`
        : med.nombre_med;
      select.appendChild(option);
    });
  });
}

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

// --- Buscar medicamentos + convenios relacionados ---
const formBuscar = document.getElementById('form-buscar');
const resultadosDiv = document.getElementById('resultados');
const btnDescargarPdf = document.getElementById('btn-descargar-pdf');

formBuscar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = document.getElementById('buscar-texto').value.trim();
  const textoConvenio = document.getElementById('buscar-convenio').value.trim();
  const anio = document.getElementById('buscar-anio').value.trim();
  await buscarMedicamentos(texto, textoConvenio, anio);
});

document.getElementById('btn-limpiar').addEventListener('click', () => {
  document.getElementById('buscar-texto').value = '';
  document.getElementById('buscar-convenio').value = '';
  document.getElementById('buscar-anio').value = '';
  resultadosDiv.innerHTML = '';
  mostrarMensaje('buscar-mensaje', '');
  btnDescargarPdf.classList.add('oculto');
});

function obtenerRangoFecha(anio) {
  if (!anio) return null;
  const anioNum = Number(anio);
  const inicio = new Date(anioNum, 0, 1);
  const fin = new Date(anioNum + 1, 0, 1);
  return { inicio, fin };
}

btnDescargarPdf.addEventListener('click', async () => {
  btnDescargarPdf.disabled = true;
  mostrarMensaje('buscar-mensaje', 'Generando PDF...');

  try {
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

  for (const med of medicamentos) {
    const card = await construirCardMedicamento(med);
    resultadosDiv.appendChild(card);
  }

  btnDescargarPdf.classList.remove('oculto');
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
    <div class="card-header">
      <h3>${med.nombre_med}${med.fecha_actual ? ` (${med.fecha_actual.slice(0, 4)})` : ''}</h3>
      <button type="button" class="btn-editar-medicamento">Editar</button>
    </div>
    <table>
      <tr>
        <th>Código</th>
        <th>Consumo Actual (${obtenerMesAnio(med.fecha_actual)})</th>
        <th>Consumo Proyectado</th>
        <th>Promedio Reposición</th>
      </tr>
      <tr>
        <td>${med.codigo_med ?? '-'}</td>
        <td>${formatearNumero(med.consumo_actual)}</td>
        <td>${formatearNumero(med.consumo_proy)}</td>
        <td>${formatearNumero(med.prom_repo)}</td>
      </tr>
    </table>
    <table>
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
    <p><strong>Observaciones:</strong> ${med.observaciones || '-'}</p>
  `;

  card.querySelector('.btn-editar-medicamento').addEventListener('click', () => abrirModalEditar(med));

  card.querySelectorAll('.btn-editar-convenio').forEach((btn) => {
    const tabla = btn.dataset.tabla;
    const convenio = tabla === 'convenio_act' ? actRes.data?.[0] : nuevoRes.data?.[0];
    btn.addEventListener('click', () => abrirModalEditarConvenio(tabla, convenio));
  });

  return card;
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
  const payload = {
    consumo_ant_2: Number(soloDigitos(formData.get('consumo_ant_2'))) || 0,
    consumo_ant_1: Number(soloDigitos(formData.get('consumo_ant_1'))) || 0,
    consumo_actual: Number(soloDigitos(formData.get('consumo_actual'))) || 0,
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
  const cantidad = Number(soloDigitos(formData.get('cantidad'))) || 0;
  const precioUnitNeto = Number(soloDigitos(formData.get('precio_unit_neto'))) || 0;
  const duracionMeses = Number(soloDigitos(formData.get('duracion_meses'))) || 0;
  const precioTotal = cantidad && precioUnitNeto ? Math.round(cantidad * precioUnitNeto * 1.19) : 0;
  const precioAnual = precioTotal && duracionMeses ? Math.round(precioTotal / (duracionMeses / 12)) : 0;
  const payload = {
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
        <th>CONVENIO ACTUAL${actual ? ' <button type="button" class="btn-editar-convenio" data-tabla="convenio_act">Editar</button>' : ''}</th>
        <th>CONVENIO NUEVO${nuevo ? ' <button type="button" class="btn-editar-convenio" data-tabla="convenio_nuevo">Editar</button>' : ''}</th>
      </tr>
      ${fila('ID CONVENIO', actual?.id_convenio ?? '-', nuevo?.id_convenio ?? '-')}
      ${fila('PROVEEDOR ADJUDICADO', actual?.proveedor?.nombre_proveedor ?? '-', nuevo?.proveedor?.nombre_proveedor ?? '-')}
      ${fila('CANTIDAD', formatearNumero(actual?.cantidad), formatearNumero(nuevo?.cantidad))}
      ${fila('PRECIO UNITARIO NETO', dinero(actual?.precio_unit_neto), dinero(nuevo?.precio_unit_neto))}
      ${fila('DURACIÓN', meses(actual?.duracion_meses), meses(nuevo?.duracion_meses))}
      ${fila('PRECIO TOTAL CONVENIO', dinero(actual?.precio_total_conv), dinero(nuevo?.precio_total_conv))}
      ${fila('PRECIO ANUAL', dinero(actual?.precio_anual_conv), dinero(nuevo?.precio_anual_conv))}
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

// --- Inicialización ---
// La carga de selects se dispara desde js/auth.js una vez el usuario inicia sesión.
