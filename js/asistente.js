const SCRIPT_URL    = "https://script.google.com/macros/s/AKfycbzdQr6n8-ra19EZChluo5G2UYVRh391lRNqZ9boQBg0z8ON6T6eSHbyPGRyZBGcopymOg/exec";
const CLAVE_SECRETA = "clave123";

// ── DESCIFRAR Y VERIFICAR URL ────────────────────────────────
async function verificarFirma(payload, firmaRecibida) {
  const enc     = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    'raw', enc.encode(CLAVE_SECRETA),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', keyData, enc.encode(payload));
  const firmaCalculada = Array.from(new Uint8Array(firma))
    .map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  return firmaCalculada === firmaRecibida;
}

async function descifrarURL() {
  const params  = new URLSearchParams(window.location.search);
  const encoded = params.get('d');
  const firma   = params.get('s');
  if (!encoded || !firma) return null;

  try {
    const payload = decodeURIComponent(escape(atob(encoded)));
    const valido  = await verificarFirma(payload, firma);
    if (!valido) return null;

    const separatorIdx = payload.indexOf('|');
    const rest1        = payload.indexOf('|', separatorIdx + 1);
    const rest2        = payload.indexOf('|', rest1 + 1);
    const rest3        = payload.indexOf('|', rest2 + 1);

    const nombre       = payload.substring(0, separatorIdx);
    const lat          = parseFloat(payload.substring(separatorIdx + 1, rest1));
    const lng          = parseFloat(payload.substring(rest1 + 1, rest2));
    const radio        = parseInt(payload.substring(rest2 + 1, rest3)) || 50;
    const preguntasStr = payload.substring(rest3 + 1);

    // Formato: label~tipo~op1|op2~otro(0/1) separados por §
    const preguntas = preguntasStr ? preguntasStr.split('§').map(p => {
      const parts    = p.split('~');
      const label    = parts[0] || '';
      const tipo     = parts[1] || 'texto';
      const opciones = parts[2] ? parts[2].split('|').filter(Boolean) : [];
      const otro     = parts[3] === '1';
      return { label, tipo, opciones, otro };
    }) : [];

    return { nombreEvento: nombre, latEvento: lat, lngEvento: lng, radioMetros: radio, preguntas };
  } catch(e) { return null; }
}

// ── FORZAR MAYÚSCULAS ────────────────────────────────────────
function forzarMayusculas(input) {
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase();
    input.setSelectionRange(pos, pos);
  });
}

// ── GENERAR CAMPOS DEL FORMULARIO DINÁMICAMENTE ──────────────
function generarCampos(preguntas) {
  const container = document.getElementById('campos-dinamicos');
  container.innerHTML = '';

  preguntas.forEach((q, idx) => {
    const id  = `campo_${idx}`;
    const div = document.createElement('div');
    div.className = 'field';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = q.label + ' *';
    div.appendChild(label);

    if (q.tipo === 'texto') {
      const input       = document.createElement('input');
      input.type        = 'text';
      input.id          = id;
      input.placeholder = 'Escribe aquí...';
      forzarMayusculas(input);
      div.appendChild(input);

    } else if (q.tipo === 'lista') {
      const select = document.createElement('select');
      select.id = id;

      const defaultOpt       = document.createElement('option');
      defaultOpt.value       = '';
      defaultOpt.textContent = '— Selecciona una opción —';
      select.appendChild(defaultOpt);

      q.opciones.forEach(op => {
        const opt       = document.createElement('option');
        opt.value       = op.toUpperCase();
        opt.textContent = op.toUpperCase();
        select.appendChild(opt);
      });

      // Solo agregar OTRO si el admin lo activó
      if (q.otro) {
        const otroOpt       = document.createElement('option');
        otroOpt.value       = 'OTRO';
        otroOpt.textContent = 'OTRO';
        select.appendChild(otroOpt);
      }

      // Campo de texto que aparece al elegir OTRO
      const otroDiv          = document.createElement('div');
      otroDiv.id             = `otro_${idx}`;
      otroDiv.style.display  = 'none';
      otroDiv.style.marginTop = '8px';

      const otroInput       = document.createElement('input');
      otroInput.type        = 'text';
      otroInput.id          = `otro_input_${idx}`;
      otroInput.placeholder = 'Especifica tu respuesta...';
      forzarMayusculas(otroInput);
      otroDiv.appendChild(otroInput);

      select.addEventListener('change', () => {
        const mostrar = select.value === 'OTRO';
        otroDiv.style.display = mostrar ? 'block' : 'none';
        if (!mostrar) otroInput.value = '';
      });

      div.appendChild(select);
      div.appendChild(otroDiv);

    } else if (q.tipo === 'sino') {
      const group     = document.createElement('div');
      group.className = 'sino-group';
      group.id        = id;

      ['SÍ', 'NO'].forEach(val => {
        const btn        = document.createElement('button');
        btn.type         = 'button';
        btn.className    = 'sino-btn';
        btn.dataset.val  = val;
        btn.textContent  = val === 'SÍ' ? '✅ SÍ' : '❌ NO';
        btn.addEventListener('click', () => {
          group.querySelectorAll('.sino-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          group.dataset.value = val;
        });
        group.appendChild(btn);
      });

      div.appendChild(group);

    } else if (q.tipo === 'fecha') {
      const input = document.createElement('input');
      input.type  = 'date';
      input.id    = id;
      div.appendChild(input);
    }

    const errDiv       = document.createElement('div');
    errDiv.className   = 'field-error';
    errDiv.id          = `err_${id}`;
    errDiv.textContent = 'Este campo es obligatorio';
    div.appendChild(errDiv);

    container.appendChild(div);
  });
}

// ── MOSTRAR PANTALLA ─────────────────────────────────────────
function mostrarSolo(id) {
  ['geo-status','form-card','success-screen','blocked-screen',
   'denied-screen','already-screen','invalid-screen'].forEach(i => {
    const el = document.getElementById(i);
    el.style.display = 'none';
    el.classList.remove('show');
  });
  const t = document.getElementById(id);
  t.style.display = '';
  t.classList.add('show');
}

// ── DISTANCIA ────────────────────────────────────────────────
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function setStatusCard(tipo, icono, titulo, subtitulo) {
  const card = document.getElementById('geo-status');
  card.className = 'status-card ' + tipo;
  document.getElementById('geo-spinner').style.display = 'none';
  card.querySelector('.status-icon')?.remove();
  const iconEl       = document.createElement('div');
  iconEl.className   = 'status-icon';
  iconEl.textContent = icono;
  card.insertBefore(iconEl, card.querySelector('.status-text'));
  card.querySelector('.status-text strong').textContent = titulo;
  card.querySelector('.status-text span').textContent   = subtitulo;
}

// ── INICIAR ──────────────────────────────────────────────────
window.addEventListener('load', async () => {
  const CONFIG = await descifrarURL();
  if (!CONFIG) { mostrarSolo('invalid-screen'); return; }

  document.getElementById('event-name').textContent = CONFIG.nombreEvento;

  const STORAGE_KEY = 'registrado_' + CONFIG.nombreEvento.replace(/\s+/g, '_').toLowerCase();

  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const d = JSON.parse(r);
      document.getElementById('already-name').textContent = '✓ ' + d.nombre;
      mostrarSolo('already-screen');
      return;
    }
  } catch(e) {}

  generarCampos(CONFIG.preguntas);

  if (!navigator.geolocation) { mostrarSolo('denied-screen'); return; }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const dist = Math.round(calcularDistancia(
        pos.coords.latitude, pos.coords.longitude,
        CONFIG.latEvento, CONFIG.lngEvento
      ));

      if (dist <= CONFIG.radioMetros) {
        setStatusCard('ok', '📍', 'Ubicación verificada', `Estás a ${dist}m del evento`);
        document.getElementById('geo-status').style.display = '';
        document.getElementById('form-card').style.display  = '';
        document.getElementById('form-card').classList.remove('disabled');
        window._CONFIG      = CONFIG;
        window._STORAGE_KEY = STORAGE_KEY;
      } else {
        document.getElementById('distance-info').textContent = `Distancia al evento: ${dist} metros`;
        mostrarSolo('blocked-screen');
      }
    },
    () => mostrarSolo('denied-screen'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
});

// ── VALIDAR ──────────────────────────────────────────────────
function validar() {
  const config = window._CONFIG;
  if (!config) return false;
  let ok = true;

  config.preguntas.forEach((q, idx) => {
    const id    = `campo_${idx}`;
    const errEl = document.getElementById(`err_${id}`);
    let valido  = false;

    if (q.tipo === 'texto') {
      valido = document.getElementById(id).value.trim().length >= 1;

    } else if (q.tipo === 'lista') {
      const sel = document.getElementById(id);
      if (sel.value === 'OTRO') {
        const otroInput = document.getElementById(`otro_input_${idx}`);
        valido = otroInput && otroInput.value.trim().length >= 1;
        if (errEl) errEl.textContent = 'Por favor especifica tu respuesta';
      } else {
        valido = sel.value !== '';
        if (errEl) errEl.textContent = 'Este campo es obligatorio';
      }

    } else if (q.tipo === 'sino') {
      valido = !!document.getElementById(id).dataset.value;

    } else if (q.tipo === 'fecha') {
      valido = document.getElementById(id).value !== '';
    }

    const inputEl = document.getElementById(id);
    if (inputEl) inputEl.classList?.toggle('error-field', !valido);
    if (errEl)   errEl.classList.toggle('show', !valido);
    if (!valido) ok = false;
  });

  return ok;
}

// ── ENVIAR ───────────────────────────────────────────────────
async function enviarRegistro() {
  if (!validar()) return;

  const btn     = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  btn.disabled  = true;
  btnText.textContent = 'Enviando…';

  const config = window._CONFIG;
  const datos  = {
    evento: config.nombreEvento,
    hora:   new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })
  };

  config.preguntas.forEach((q, idx) => {
    const id = `campo_${idx}`;
    let valor = '';

    if (q.tipo === 'texto') {
      valor = document.getElementById(id).value.trim();
    } else if (q.tipo === 'lista') {
      const sel = document.getElementById(id);
      if (sel.value === 'OTRO') {
        const otroInput = document.getElementById(`otro_input_${idx}`);
        valor = 'OTRO: ' + (otroInput ? otroInput.value.trim() : '');
      } else {
        valor = sel.value;
      }
    } else if (q.tipo === 'sino') {
      valor = document.getElementById(id).dataset.value || '';
    } else if (q.tipo === 'fecha') {
      valor = document.getElementById(id).value;
    }

    datos[q.label] = valor;
  });

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });

    const primerCampo = config.preguntas.length > 0
      ? datos[config.preguntas[0].label] || 'Asistente'
      : 'Asistente';

    localStorage.setItem(window._STORAGE_KEY, JSON.stringify({ nombre: primerCampo }));
    mostrarSolo('success-screen');
  } catch(e) {
    btn.disabled = false;
    btnText.textContent = 'Registrar mi asistencia';
    alert('Error al enviar. Verifica tu conexión e intenta de nuevo.');
  }
}