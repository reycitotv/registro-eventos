// ── CONSTANTES ──────────────────────────────────────────────
const BASE         = window.location.href.replace('admin.html', 'asistente.html');
const CLAVE_VALIDA = 'clave123';

// ── ESTADO ──────────────────────────────────────────────────
let preguntas  = [];
let editandoId = null;
let tipoActual = 'texto';
let dragSrcIdx = null;

// ── INICIALIZAR ──────────────────────────────────────────────
window.addEventListener('load', () => {
  document.getElementById('cfg-nombre').value = localStorage.getItem('last_nombre') || '';
  document.getElementById('cfg-lat').value    = localStorage.getItem('last_lat')    || '';
  document.getElementById('cfg-lng').value    = localStorage.getItem('last_lng')    || '';
  document.getElementById('cfg-radio').value  = localStorage.getItem('last_radio')  || '50';
  document.getElementById('cfg-clave').value  = localStorage.getItem('last_clave')  || '';

  try {
    const saved = localStorage.getItem('last_preguntas');
    if (saved) { preguntas = JSON.parse(saved); renderPreguntas(); }
  } catch(e) {}
});

// ── GPS ──────────────────────────────────────────────────────
function usarMiUbicacion() {
  const btn = document.getElementById('gps-txt');
  btn.textContent = '⏳ Obteniendo ubicación…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('cfg-lat').value = pos.coords.latitude.toFixed(8);
      document.getElementById('cfg-lng').value = pos.coords.longitude.toFixed(8);
      btn.textContent = '✅ Ubicación capturada';
      setTimeout(() => btn.textContent = '📍 Capturar mi ubicación actual', 2500);
    },
    () => {
      btn.textContent = '❌ Error — activa el GPS';
      setTimeout(() => btn.textContent = '📍 Capturar mi ubicación actual', 2500);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function toggleClave() {
  const input = document.getElementById('cfg-clave');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ── MODAL ────────────────────────────────────────────────────
function abrirModal(id = null) {
  // Limpiar estado completamente
  editandoId = id;
  tipoActual = 'texto';

  document.getElementById('modal-title').textContent = id ? 'Editar pregunta' : 'Nueva pregunta';
  document.getElementById('q-label').value = '';
  document.getElementById('options-list').innerHTML = '';
  document.getElementById('options-section').style.display = 'none';

  // Resetear botones de tipo
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === 'texto');
  });

  if (id !== null) {
    const q = preguntas.find(p => p.id === id);
    if (q) {
      document.getElementById('q-label').value = q.label;
      seleccionarTipo(q.tipo);
      if (q.tipo === 'lista') q.opciones.forEach(op => agregarOpcion(op));
    }
  }

  document.getElementById('modal-overlay').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('q-label').value = '';
  document.getElementById('options-list').innerHTML = '';
  document.getElementById('options-section').style.display = 'none';
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === 'texto');
  });
  tipoActual = 'texto';
  editandoId = null;
}

function cerrarModalSiFondo(e) {
  if (e.target === document.getElementById('modal-overlay')) cerrarModal();
}

function seleccionarTipo(tipo) {
  tipoActual = tipo;
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === tipo);
  });
  document.getElementById('options-section').style.display = tipo === 'lista' ? 'block' : 'none';
}

function agregarOpcion(valor = '') {
  const list = document.getElementById('options-list');
  const row  = document.createElement('div');
  row.className = 'option-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ej: Médico';
  input.value = valor;

  const btn = document.createElement('button');
  btn.className = 'btn-remove-option';
  btn.textContent = '✕';
  btn.type = 'button';
  btn.addEventListener('click', () => row.remove());

  row.appendChild(input);
  row.appendChild(btn);
  list.appendChild(row);
}

function guardarPregunta() {
  const label = document.getElementById('q-label').value.trim();
  if (!label) { toast('⚠️ Escribe el texto de la pregunta', true); return; }

  let opciones = [];
  if (tipoActual === 'lista') {
    opciones = Array.from(document.querySelectorAll('#options-list .option-row input'))
      .map(i => i.value.trim()).filter(Boolean);
    if (opciones.length < 2) { toast('⚠️ Agrega al menos 2 opciones', true); return; }
  }

  if (editandoId !== null) {
    const idx = preguntas.findIndex(p => p.id === editandoId);
    if (idx !== -1) preguntas[idx] = { ...preguntas[idx], label, tipo: tipoActual, opciones };
  } else {
    preguntas.push({ id: Date.now(), label, tipo: tipoActual, opciones });
  }

  renderPreguntas();
  guardarPreguntas();
  cerrarModal();
  toast('✅ Pregunta guardada');
}

// ── RENDER ───────────────────────────────────────────────────
const TIPO_LABELS = { texto: 'Texto', lista: 'Lista', sino: 'Sí/No', fecha: 'Fecha' };
const TIPO_BADGE  = { texto: 'badge-texto', lista: 'badge-lista', sino: 'badge-sino', fecha: 'badge-fecha' };

function renderPreguntas() {
  const list  = document.getElementById('questions-list');
  const empty = document.getElementById('questions-empty');
  const count = document.getElementById('questions-count');

  count.textContent = `${preguntas.length} pregunta${preguntas.length !== 1 ? 's' : ''}`;

  // Limpiar solo las tarjetas, nunca el elemento empty
  Array.from(list.children).forEach(child => {
    if (child.id !== 'questions-empty') child.remove();
  });

  if (preguntas.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  preguntas.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.id = q.id;
    card.draggable = true;

    const opcionesHTML = q.tipo === 'lista' && q.opciones.length
      ? `<div class="question-options-preview">${q.opciones.map(op => `<span class="option-chip">${op}</span>`).join('')}</div>`
      : '';

    card.innerHTML = `
      <div class="question-header">
        <span class="drag-handle">⠿</span>
        <span class="question-num">${idx + 1}</span>
        <span class="question-label">${q.label}</span>
        <span class="question-type-badge ${TIPO_BADGE[q.tipo]}">${TIPO_LABELS[q.tipo]}</span>
        <div class="question-actions">
          <button class="btn-edit-q" title="Editar">✏️</button>
          <button class="btn-delete-q" title="Eliminar">🗑️</button>
        </div>
      </div>
      ${opcionesHTML}
    `;

    card.querySelector('.btn-edit-q').addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModal(q.id);
    });

    card.querySelector('.btn-delete-q').addEventListener('click', (e) => {
      e.stopPropagation();
      eliminarPregunta(q.id);
    });

    card.addEventListener('dragstart', (e) => {
      dragSrcIdx = idx;
      setTimeout(() => card.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const moved = preguntas.splice(dragSrcIdx, 1)[0];
      preguntas.splice(idx, 0, moved);
      dragSrcIdx = null;
      renderPreguntas();
      guardarPreguntas();
    });

    list.appendChild(card);
  });
}

function eliminarPregunta(id) {
  preguntas = preguntas.filter(p => p.id !== id);
  renderPreguntas();
  guardarPreguntas();
  toast('🗑️ Pregunta eliminada');
}

function guardarPreguntas() {
  localStorage.setItem('last_preguntas', JSON.stringify(preguntas));
}

// ── CIFRADO ──────────────────────────────────────────────────
async function generarFirma(datos, clave) {
  const enc     = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    'raw', enc.encode(clave),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', keyData, enc.encode(datos));
  return Array.from(new Uint8Array(firma))
    .map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// ── GENERAR URL ──────────────────────────────────────────────
let urlGenerada = '';

async function generarURL() {
  const nombre = document.getElementById('cfg-nombre').value.trim();
  const lat    = document.getElementById('cfg-lat').value.trim();
  const lng    = document.getElementById('cfg-lng').value.trim();
  const radio  = document.getElementById('cfg-radio').value.trim() || '50';
  const clave  = document.getElementById('cfg-clave').value.trim();

  if (!nombre)                { toast('⚠️ Escribe el nombre del evento', true); return; }
  if (!lat || !lng)           { toast('⚠️ Captura o escribe las coordenadas', true); return; }
  if (!clave)                 { toast('⚠️ Escribe la clave secreta', true); return; }
  if (clave !== CLAVE_VALIDA) { toast('❌ Clave incorrecta — acceso denegado', true); return; }
  if (preguntas.length === 0) { toast('⚠️ Agrega al menos una pregunta', true); return; }

  localStorage.setItem('last_nombre', nombre);
  localStorage.setItem('last_lat', lat);
  localStorage.setItem('last_lng', lng);
  localStorage.setItem('last_radio', radio);
  localStorage.setItem('last_clave', clave);

  // Serializar preguntas: label~tipo~op1|op2 separados por §
  const preguntasStr = preguntas.map(q => {
    const ops = q.opciones && q.opciones.length ? q.opciones.join('|') : '';
    return `${q.label}~${q.tipo}~${ops}`;
  }).join('§');

  const payload = `${nombre}|${lat}|${lng}|${radio}|${preguntasStr}`;
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  const firma   = await generarFirma(payload, clave);

  urlGenerada = BASE + '?d=' + encodeURIComponent(encoded) + '&s=' + firma;

  document.getElementById('res-nombre').textContent    = nombre;
  document.getElementById('res-radio').textContent     = radio + ' metros';
  document.getElementById('res-coords').textContent    = parseFloat(lat).toFixed(4) + ', ' + parseFloat(lng).toFixed(4);
  document.getElementById('res-preguntas').textContent = `${preguntas.length} pregunta${preguntas.length !== 1 ? 's' : ''}`;
  document.getElementById('result-url').textContent    = urlGenerada;
  document.getElementById('result-card').classList.add('show');
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth' });
}

function copiarURL() {
  navigator.clipboard.writeText(urlGenerada).then(() => toast('✅ URL copiada'));
}

function abrirQR() {
  window.open('https://www.qr-code-generator.com/?data=' + encodeURIComponent(urlGenerada), '_blank');
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}