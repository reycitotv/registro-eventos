const BASE = window.location.href.replace('admin.html', 'asistente.html');

// Guardar últimos valores usados
window.addEventListener('load', () => {
  document.getElementById('cfg-nombre').value = localStorage.getItem('last_nombre') || '';
  document.getElementById('cfg-lat').value    = localStorage.getItem('last_lat')    || '';
  document.getElementById('cfg-lng').value    = localStorage.getItem('last_lng')    || '';
  document.getElementById('cfg-radio').value  = localStorage.getItem('last_radio')  || '50';
  document.getElementById('cfg-clave').value  = localStorage.getItem('last_clave')  || '';
});

function toggleClave() {
  const input = document.getElementById('cfg-clave');
  input.type = input.type === 'password' ? 'text' : 'password';
}

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

async function generarFirma(datos, clave) {
  const enc = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    'raw', enc.encode(clave),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', keyData, enc.encode(datos));
  return Array.from(new Uint8Array(firma))
    .map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

let urlGenerada = '';

async function generarURL() {
  const nombre = document.getElementById('cfg-nombre').value.trim();
  const lat    = document.getElementById('cfg-lat').value.trim();
  const lng    = document.getElementById('cfg-lng').value.trim();
  const radio  = document.getElementById('cfg-radio').value.trim() || '50';
  const clave  = document.getElementById('cfg-clave').value.trim();

  if (!nombre) { mostrarToast('⚠️ Escribe el nombre del evento'); return; }
  if (!lat || !lng) { mostrarToast('⚠️ Captura o escribe las coordenadas'); return; }
  if (!clave) { mostrarToast('⚠️ Escribe una clave secreta'); return; }
  if (clave !== 'clave123') { mostrarToast('❌ Clave incorrecta — acceso denegado'); return; }

  localStorage.setItem('last_nombre', nombre);
  localStorage.setItem('last_lat', lat);
  localStorage.setItem('last_lng', lng);
  localStorage.setItem('last_radio', radio);
  localStorage.setItem('last_clave', clave);

  const payload = `${nombre}|${lat}|${lng}|${radio}`;
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  const firma   = await generarFirma(payload, clave);

  urlGenerada = BASE + '?d=' + encodeURIComponent(encoded) + '&s=' + firma;

  document.getElementById('res-nombre').textContent = nombre;
  document.getElementById('res-radio').textContent  = radio + ' metros';
  document.getElementById('res-coords').textContent =
    parseFloat(lat).toFixed(4) + ', ' + parseFloat(lng).toFixed(4);
  document.getElementById('result-url').textContent = urlGenerada;
  document.getElementById('result-card').classList.add('show');
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth' });
}

function copiarURL() {
  navigator.clipboard.writeText(urlGenerada).then(() => mostrarToast('✅ URL copiada'));
}

function abrirQR() {
  window.open('https://www.qr-code-generator.com/?data=' + encodeURIComponent(urlGenerada), '_blank');
}

function mostrarToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
