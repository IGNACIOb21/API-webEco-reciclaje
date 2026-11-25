(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { puntos: [], materiales: [], entidades: [], pagina: 1, limite: 25, token: null, refresh: null, ocupado: false, modo: null };
  const tituloEstado = { operativo: 'Operativo', lleno: 'Lleno', mantenimiento: 'En mantenimiento', fuera_servicio: 'Desactivado' };
  const texto = (tag, value, cls) => { const el = document.createElement(tag); el.textContent = String(value ?? ''); if (cls) el.className = cls; return el; };
  const normalizar = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

  function mostrarMensaje(textoMensaje, tipo = '') {
    const el = $('mensaje'); el.textContent = textoMensaje; el.className = `message ${tipo}`; el.hidden = !textoMensaje;
  }
  async function consultar(ruta, options = {}) {
    let response;
    try { response = await fetch(ruta, { ...options, cache: 'no-store' }); }
    catch { throw new Error('No se pudo conectar con la API local. Comprueba que sigue encendida.'); }
    let body;
    try { body = await response.json(); } catch { throw new Error('La API respondió con un formato inesperado.'); }
    if (!response.ok) { const error = new Error(body?.error?.mensaje || 'La operación no pudo completarse.'); error.status = response.status; throw error; }
    return body.datos;
  }
  async function autenticar() {
    if (state.modo !== 'local') throw new Error('Inicia sesión con tu cuenta de administrador.');
    const data = await consultar('/api/v1/auth/sesion-local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (!data?.access_token || !data?.refresh_token) throw new Error('No se pudo iniciar la sesión de prueba.');
    state.token = data.access_token; state.refresh = data.refresh_token;
  }
  async function escribir(ruta, body) {
    if (!state.token) await autenticar();
    const enviar = () => consultar(ruta, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${state.token}` }, body: JSON.stringify(body) });
    try { return await enviar(); }
    catch (error) {
      if (error.status !== 401) throw error;
      if (state.modo === 'local') { state.token = null; state.refresh = null; await autenticar(); }
      else {
        try {
          const data = await consultar('/api/v1/auth/refrescar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: state.refresh }) });
          state.token = data.access_token; state.refresh = data.refresh_token;
        } catch { state.token = null; state.refresh = null; actualizarSesion(); throw new Error('Tu sesión terminó. Inicia sesión nuevamente.'); }
      }
      return enviar();
    }
  }
  const puedeEditar = () => state.modo === 'local' || !!state.token;
  function setOcupado(ocupado) { state.ocupado = ocupado; $('guardar').disabled = ocupado; $('nuevo').disabled = ocupado || !puedeEditar() || !state.entidades.length || !state.materiales.length; }
  function actualizarSesion() { $('sesion').textContent = state.token ? 'Cerrar sesión' : 'Iniciar sesión'; setOcupado(false); mostrarPuntos(); }
  function status(point) { return tituloEstado[point.estado_operativo] || point.estado_operativo || 'Sin estado'; }
  function mostrarPuntos() {
    const buscar = normalizar($('buscar').value.trim());
    const filtro = $('estado').value;
    const visibles = state.puntos.filter(p => [p.nombre_punto, p.direccion_completa, p.comuna].some(v => normalizar(v).includes(buscar)) && (filtro === 'todos' || p.estado_operativo === filtro));
    const tbody = $('filas'); tbody.replaceChildren();
    $('total').textContent = state.puntos.length;
    $('operativos').textContent = state.puntos.filter(p => p.estado_operativo === 'operativo').length;
    $('fuera').textContent = state.puntos.filter(p => p.estado_operativo === 'fuera_servicio').length;
    $('vacio').hidden = visibles.length > 0;
    for (const punto of visibles) {
      const tr = document.createElement('tr');
      const nombre = document.createElement('td'); nombre.append(texto('strong', punto.nombre_punto), texto('div', punto.direccion_completa || 'Sin dirección', 'address'));
      const estado = document.createElement('td'); estado.append(texto('span', status(punto), `tag${punto.estado_operativo === 'fuera_servicio' ? ' off' : punto.estado_operativo !== 'operativo' ? ' warn' : ''}`));
      const accion = document.createElement('td');
      const activo = punto.estado_operativo !== 'fuera_servicio';
      const boton = texto('button', activo ? 'Desactivar' : 'Reactivar', 'action'); boton.type = 'button';
      boton.disabled = !puedeEditar();
      boton.setAttribute('aria-label', `${activo ? 'Desactivar' : 'Reactivar'} ${punto.nombre_punto}`);
      boton.addEventListener('click', () => cambiarEstado(punto, activo)); accion.append(boton);
      tr.append(nombre, texto('td', punto.comuna || 'Sin comuna'), estado, accion); tbody.append(tr);
    }
    $('pagina').textContent = `Página ${state.pagina}`;
    $('anterior').disabled = state.pagina === 1;
    $('siguiente').disabled = state.puntos.length < state.limite;
  }
  function prepararCatalogos() {
    const select = $('entidad'); select.replaceChildren();
    const placeholder = texto('option', 'Selecciona una entidad'); placeholder.value = ''; select.append(placeholder);
    for (const entidad of state.entidades) { const option = texto('option', entidad.nombre_entidad); option.value = String(entidad.entidad_administradora_id); select.append(option); }
    const checks = $('materiales'); checks.replaceChildren();
    for (const material of state.materiales) {
      const label = document.createElement('label'); label.className = 'check';
      const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'materiales'; input.value = String(material.categoria_residuo_id);
      label.append(input, document.createTextNode(material.nombre_categoria)); checks.append(label);
    }
    setOcupado(false);
  }
  async function cargar() {
    mostrarMensaje(''); $('cargando').hidden = false;
    try {
      const [puntos, materiales, entidades] = await Promise.all([
        consultar(`/api/v1/puntos?pagina=${state.pagina}&limite=${state.limite}`), consultar('/api/v1/materiales'), consultar('/api/v1/entidades'),
      ]);
      if (!Array.isArray(puntos) || !Array.isArray(materiales) || !Array.isArray(entidades)) throw new Error('La API no devolvió los datos esperados.');
      state.puntos = puntos; state.materiales = materiales; state.entidades = entidades;
      prepararCatalogos(); mostrarPuntos();
      $('conexion').textContent = 'API conectada';
      if (!entidades.length || !materiales.length) mostrarMensaje('Faltan entidades o materiales. No es posible agregar puntos todavía.');
      return true;
    } catch (error) {
      $('conexion').textContent = 'API no disponible'; mostrarMensaje(error.message, 'error');
      return false;
    } finally { $('cargando').hidden = true; }
  }
  async function cambiarEstado(punto, activo) {
    if (state.ocupado || !puedeEditar() || !window.confirm(`¿${activo ? 'Desactivar' : 'Reactivar'} el punto “${punto.nombre_punto}”?${state.modo === 'compartida' ? ' Este cambio afecta a la base compartida.' : ''}`)) return;
    setOcupado(true); mostrarMensaje('');
    try {
      await escribir(`/api/v1/puntos/${punto.punto_reciclaje_id}/${activo ? 'desactivar' : 'reactivar'}`, {});
      const actualizado = await cargar();
      mostrarMensaje(actualizado ? `Punto ${activo ? 'desactivado' : 'reactivado'} correctamente.` : 'El cambio se guardó, pero no se pudo actualizar la lista.', actualizado ? 'success' : 'error');
    } catch (error) { mostrarMensaje(error.message, 'error'); }
    finally { setOcupado(false); }
  }
  $('nuevo').addEventListener('click', () => { $('formulario').reset(); $('error-formulario').textContent = ''; $('dialogo').showModal(); });
  $('sesion').addEventListener('click', () => {
    if (state.token) { state.token = null; state.refresh = null; actualizarSesion(); mostrarMensaje('Sesión cerrada en este panel.'); return; }
    $('formulario-sesion').reset(); $('error-sesion').textContent = ''; $('dialogo-sesion').showModal();
  });
  $('cancelar-sesion').addEventListener('click', () => { $('formulario-sesion').reset(); $('dialogo-sesion').close(); });
  $('formulario-sesion').addEventListener('submit', async event => {
    event.preventDefault(); $('error-sesion').textContent = '';
    try {
      const data = await consultar('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('correo-sesion').value.trim(), password: $('clave-sesion').value }) });
      if (!data?.access_token || !data?.refresh_token) throw new Error('No se pudo iniciar sesión.');
      state.token = data.access_token; state.refresh = data.refresh_token; $('formulario-sesion').reset(); $('dialogo-sesion').close(); actualizarSesion(); mostrarMensaje('Sesión de administrador iniciada.', 'success');
    } catch (error) { $('clave-sesion').value = ''; $('error-sesion').textContent = error.message; }
  });
  $('cancelar').addEventListener('click', () => $('dialogo').close());
  $('buscar').addEventListener('input', mostrarPuntos);
  $('estado').addEventListener('change', mostrarPuntos);
  $('actualizar').addEventListener('click', cargar);
  $('anterior').addEventListener('click', () => { if (state.pagina > 1) { state.pagina--; cargar(); } });
  $('siguiente').addEventListener('click', () => { if (state.puntos.length === state.limite) { state.pagina++; cargar(); } });
  $('formulario').addEventListener('submit', async event => {
    event.preventDefault();
    if (state.ocupado) return;
    const materiales = Array.from(document.querySelectorAll('input[name="materiales"]:checked')).map(input => Number(input.value));
    if (!materiales.length) { $('error-formulario').textContent = 'Selecciona al menos un material.'; return; }
    const entidad = Number($('entidad').value);
    if (!entidad) { $('error-formulario').textContent = 'Selecciona una entidad.'; return; }
    if (state.modo === 'compartida' && !window.confirm('Este punto se guardará en la base compartida y podría aparecer en la aplicación. ¿Deseas continuar?')) return;
    const punto = {
      nombre_punto: $('nombre').value.trim(), direccion_completa: $('direccion').value.trim(), comuna: $('comuna').value.trim(),
      coordenada_latitud: Number($('latitud').value), coordenada_longitud: Number($('longitud').value), entidad_administradora_id: entidad, materiales,
    };
    setOcupado(true); $('error-formulario').textContent = '';
    try {
      const creado = await escribir('/api/v1/puntos', punto); $('dialogo').close(); state.pagina = 1;
      const actualizado = await cargar();
      const visible = state.puntos.some(item => item.punto_reciclaje_id === creado?.punto_reciclaje_id);
      mostrarMensaje(actualizado ? (visible ? 'Punto guardado correctamente.' : 'Punto guardado. Puede estar en otra página.') : 'El punto se guardó, pero no se pudo actualizar la lista.', actualizado ? 'success' : 'error');
    } catch (error) { $('error-formulario').textContent = error.message; }
    finally { setOcupado(false); }
  });
  (async () => {
    try {
      const response = await fetch('/panel/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('El panel no está disponible.');
      const config = await response.json();
      if (!['local', 'compartida'].includes(config.modo)) throw new Error('El entorno no es válido.');
      state.modo = config.modo;
      $('aviso-entorno').textContent = state.modo === 'local' ? 'Entorno de prueba local: los cambios usan datos ficticios y no afectan a la aplicación.' : 'Datos reales compartidos: los cambios guardados afectan a la base del equipo y pueden reflejarse en la aplicación.';
      $('aviso-formulario').textContent = state.modo === 'local' ? 'El punto se guardará en tu base local de prueba.' : 'El punto se guardará en la base compartida del equipo.';
      $('sesion').hidden = state.modo === 'local';
      await cargar();
    } catch (error) { $('conexion').textContent = 'API no disponible'; $('cargando').hidden = true; mostrarMensaje(error.message, 'error'); }
  })();
})();
