const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwOr95I3J-35zKdXslWeWi1Q73brp3E6Ej68uShqeBD1H2yNkCKxWp9q7Q0ncjobi1euw/exec";

// ── Clave secreta — debe coincidir con la que usas en admin ──
const CLAVE_SECRETA = "clave123";
// ────────────────────────────────────────────────────────────

async function verificarFirma(payload, firmaRecibida) {
  const enc = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    'raw', enc.encode(CLAVE_SECRETA),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
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
    const [nombre, lat, lng, radio] = payload.split('|');
    return { nombreEvento: nombre, latEvento: parseFloat(lat), lngEvento: parseFloat(lng), radioMetros: parseInt(radio) || 50 };
  } catch(e) { return null; }
}

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

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function setStatusCard(tipo, icono, titulo, subtitulo) {
  const card = document.getElementById('geo-status');
  card.className = 'status-card ' + tipo;
  document.getElementById('geo-spinner').style.display = 'none';
  card.querySelector('.status-icon')?.remove();
  const iconEl = document.createElement('div');
  iconEl.className = 'status-icon';
  iconEl.textContent = icono;
  card.insertBefore(iconEl, card.querySelector('.status-text'));
  card.querySelector('.status-text strong').textContent = titulo;
  card.querySelector('.status-text span').textContent = subtitulo;
}

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

  if (!navigator.geolocation) { mostrarSolo('denied-screen'); return; }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const dist = Math.round(calcularDistancia(
        pos.coords.latitude, pos.coords.longitude,
        CONFIG.latEvento, CONFIG.lngEvento
      ));
      if (dist <= CONFIG.radioMetros) {
        setStatusCard('ok','📍','Ubicación verificada',`Estás a ${dist}m del evento`);
        document.getElementById('geo-status').style.display = '';
        document.getElementById('form-card').style.display = '';
        document.getElementById('form-card').classList.remove('disabled');
        window._CONFIG = CONFIG;
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

function validar() {
  let ok = true;
  [
    { id:'nombres',   err:'err-nombres',   fn: v => v.trim().length >= 2 },
    { id:'apellidos', err:'err-apellidos', fn: v => v.trim().length >= 2 },
    { id:'cedula',    err:'err-cedula',    fn: v => v.trim().length >= 5 },
    { id:'trabajo',   err:'err-trabajo',   fn: v => v.trim().length >= 2 },
    { id:'profesion', err:'err-profesion', fn: v => v.trim().length >= 2 },
    { id:'fuente',    err:'err-fuente',    fn: v => v.trim().length >= 2 },
    { id:'celular',   err:'err-celular',   fn: v => v.trim().length >= 6 },
  ].forEach(c => {
    const input = document.getElementById(c.id);
    const errEl = document.getElementById(c.err);
    const valido = c.fn(input.value);
    input.classList.toggle('error-field', !valido);
    errEl.classList.toggle('show', !valido);
    if (!valido) ok = false;
  });
  return ok;
}

async function enviarRegistro() {
  if (!validar()) return;
  const btn     = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  btn.disabled  = true;
  btnText.textContent = 'Enviando…';

  const datos = {
    nombres:   document.getElementById('nombres').value.trim(),
    apellidos: document.getElementById('apellidos').value.trim(),
    cedula:    document.getElementById('cedula').value.trim(),
    trabajo:   document.getElementById('trabajo').value.trim(),
    profesion: document.getElementById('profesion').value.trim(),
    fuente:    document.getElementById('fuente').value.trim(),
    celular:   document.getElementById('celular').value.trim(),
    hora:      new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' }),
    evento:    window._CONFIG.nombreEvento
  };

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    localStorage.setItem(window._STORAGE_KEY, JSON.stringify({ nombre: datos.nombres + ' ' + datos.apellidos }));
    mostrarSolo('success-screen');
  } catch(e) {
    btn.disabled = false;
    btnText.textContent = 'Registrar mi asistencia';
    alert('Error al enviar. Verifica tu conexión e intenta de nuevo.');
  }
}
