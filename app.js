/**
 * SkySlot AI — Main Application (Router, State, UI)
 * Depends on: data.js (loaded first)
 */

const POLL_INTERVAL = 3000;
let currentScenario = 'normal';
let systemLogs = [];
let wizardStep = 1;
let lastAnalysis = null;
let lastAnalysisFlight = null;

let state = {
  flights: [],
  weather: null,
  runways: JSON.parse(JSON.stringify(RUNWAYS)),
  conflicts: [],
  settings: { demoMode: true, pollingInterval: 3000, utcTime: true }
};

// ===== SYSTEM LOG =====
function addLog(severity, event, flight, detail) {
  const now = new Date();
  systemLogs.unshift({
    time: now.toISOString().substring(11,19),
    date: now.toISOString().substring(0,10),
    severity, event, flight: flight || '—', detail: detail || ''
  });
  if (systemLogs.length > 200) systemLogs.pop();
  updateLogBadge();
}

function updateLogBadge() {
  const el = document.getElementById('logBadge');
  if (el) {
    const recent = systemLogs.filter(l => l.severity === 'warning' || l.severity === 'error').length;
    el.textContent = recent > 0 ? recent : '';
    el.style.display = recent > 0 ? 'inline' : 'none';
  }
}

// ===== ROUTER =====
function navigateTo(page) {
  window.location.hash = page;
}

function handleRoute() {
  const hash = (window.location.hash || '#dashboard').replace('#','');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));

  const pageEl = document.getElementById('page-' + hash);
  const navEl = document.querySelector(`[data-page="${hash}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  // Render page content
  if (hash === 'dashboard') renderDashboard();
  else if (hash === 'flights') renderFlightQueue();
  else if (hash === 'runway') renderRunwayStatus();
  else if (hash === 'conflicts') renderConflictMonitor();
  else if (hash === 'weather') renderWeatherPage();
  else if (hash === 'analytics') renderAnalytics();
  else if (hash === 'logs') renderLogs();
  else if (hash === 'settings') renderSettings();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  loadScenario('normal');
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  setInterval(pollUpdate, POLL_INTERVAL);
  addLog('info', 'System initialized', null, 'SkySlot AI started — Demo Mode');
});

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'}) + ' UTC';
}

function pollUpdate() {
  // In demo mode, just update timestamps and re-render current page
  const hash = (window.location.hash || '#dashboard').replace('#','');
  if (hash === 'dashboard') renderDashboard();
}

// ===== SCENARIO LOADING =====
function loadScenario(key) {
  const sc = SCENARIOS[key];
  if (!sc) return;
  currentScenario = key;
  const now = new Date();

  state.flights = sc.flights.map(f => {
    const slotDate = new Date(now.getTime() + f.slot_time_offset * 60000);
    return {
      ...f,
      slot_time: slotDate.toISOString().replace('T',' ').substring(0,16),
      priority_score: calcPriorityScore(f)
    };
  });

  state.weather = JSON.parse(JSON.stringify(sc.weather));
  state.conflicts = JSON.parse(JSON.stringify(sc.conflicts));
  state.runways = JSON.parse(JSON.stringify(RUNWAYS));

  if (key === 'weather_disruption') state.runways['09/27'].status = 'CLOSED';

  addLog('info', 'Scenario loaded', null, sc.name);
  handleRoute();

  // Update scenario cards
  document.querySelectorAll('.scenario-card').forEach(c => {
    c.classList.toggle('active', c.dataset.scenario === key);
  });
}

// ===== UTIL =====
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

function showToast(msg, type='info') {
  const wrap = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icons = {success:'✓',warn:'⚠',info:'ℹ',error:'✕'};
  t.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function fuelColor(pct) {
  if (pct <= 15) return 'var(--color-danger)';
  if (pct <= 30) return 'var(--color-warning)';
  return 'var(--color-safe)';
}

function statusBadge(status) {
  const map = {
    'scheduled':['SCHEDULED','info'],'approach':['APPROACH','info'],
    'taxi':['TAXI','safe'],'waiting':['WAITING','warning'],
    'emergency':['⚠ EMERGENCY','danger'],'conflict':['⚠ CONFLICT','danger'],
    'allocated':['✓ ALLOCATED','safe'],'departed':['DEPARTED','safe'],
    'landed':['LANDED','safe']
  };
  const [label,cls] = map[status] || [status.toUpperCase(),'info'];
  return `<span class="badge badge-${cls}">${label}</span>`;
}

// ===== DASHBOARD =====
function renderDashboard() {
  const activeCount = state.flights.length;
  const waiting = state.flights.filter(f => f.status === 'waiting').length;
  const emergencyFlights = state.flights.filter(f => f.priority === 'emergency').length;
  const conflictCount = state.conflicts.length;
  const avgDelay = state.flights.length > 0 ? (state.flights.reduce((s,f) => s + (f.slot_time_offset||0)*0.4, 0)/state.flights.length).toFixed(1) : '0.0';
  const availRunways = Object.values(state.runways).filter(r => r.status === 'AVAILABLE').length;

  document.getElementById('summaryCards').innerHTML = `
    <div class="summary-card"><div class="card-icon info">✈</div><div class="card-content"><div class="card-value text-info">${activeCount}</div><div class="card-label">Active Flights</div><div class="card-context">Currently tracked</div></div></div>
    <div class="summary-card"><div class="card-icon warning">⏳</div><div class="card-content"><div class="card-value text-warning">${waiting}</div><div class="card-label">Waiting for Slot</div><div class="card-context">Pending allocation</div></div></div>
    <div class="summary-card"><div class="card-icon safe">🛬</div><div class="card-content"><div class="card-value text-safe">${availRunways} / ${Object.keys(state.runways).length}</div><div class="card-label">Runways Available</div><div class="card-context">${Object.entries(state.runways).map(([k,v])=>`${k}: ${v.status}`).join(', ')}</div></div></div>
    <div class="summary-card"><div class="card-icon ${conflictCount>0?'danger':'safe'}">${conflictCount>0?'⚠':'✓'}</div><div class="card-content"><div class="card-value ${conflictCount>0?'text-danger':'text-safe'}">${conflictCount}</div><div class="card-label">Active Conflicts</div><div class="card-context">${conflictCount>0?'Requires attention':'All clear'}</div></div></div>
    <div class="summary-card"><div class="card-icon ${emergencyFlights>0?'danger':'safe'}">${emergencyFlights>0?'🚨':'—'}</div><div class="card-content"><div class="card-value ${emergencyFlights>0?'text-danger':'text-muted'}">${emergencyFlights}</div><div class="card-label">Emergency Flights</div><div class="card-context">${emergencyFlights>0?'Immediate attention':'None active'}</div></div></div>
    <div class="summary-card"><div class="card-icon info">⏱</div><div class="card-content"><div class="card-value">${avgDelay} min</div><div class="card-label">Average Delay</div><div class="card-context">Simulation estimate</div></div></div>
  `;

  // Flight list
  const fl = document.getElementById('dashFlightList');
  if (!state.flights.length) { fl.innerHTML = '<div class="state-message"><div class="state-icon">✈</div><div class="state-text">No active flights</div></div>'; }
  else {
    fl.innerHTML = state.flights.map(f => {
      const iconMap = {departure:'🛫',arrival:'🛬'};
      const icon = f.priority==='emergency'?'🚨':(f.status==='waiting'?'⏳':iconMap[f.operation]||'✈');
      const cls = f.priority==='emergency'?'emg':(f.status==='waiting'?'hld':(f.operation==='departure'?'dep':'arr'));
      const sClass = f.priority==='emergency'?'status-danger':(f.status==='waiting'?'status-warning':'status-info');
      const time = f.slot_time ? f.slot_time.split(' ')[1]||'--:--' : '--:--';
      return `<div class="flight-item" onclick="navigateTo('flights')">
        <div class="flight-icon ${cls}">${icon}</div>
        <div class="flight-info"><div class="flight-id">${esc(f.flight_id)}</div><div class="flight-detail">${esc(f.aircraft_type)} · RWY ${esc(f.runway||'—')}</div></div>
        <div class="flight-meta"><div class="time">${time}</div><div class="status ${sClass}">${esc(f.status)}</div></div>
      </div>`;
    }).join('');
  }

  // Runway timeline
  renderTimeline();

  // AI insights
  renderInsights();

  // Metrics
  renderDashMetrics();

  // Weather mini
  renderWeatherMini();

  // Update nav badges
  const cBadge = document.getElementById('conflictBadge');
  if (cBadge) { cBadge.textContent = conflictCount; cBadge.style.display = conflictCount>0?'inline':'none'; }
  const eBadge = document.getElementById('emergencyBadge');
  if (eBadge) { eBadge.textContent = emergencyFlights; eBadge.style.display = emergencyFlights>0?'inline':'none'; }
}

function renderTimeline() {
  const wrap = document.getElementById('dashTimeline');
  if (!wrap) return;
  const rwyKeys = Object.keys(state.runways).sort();
  let html = `<div class="time-labels"><span>NOW</span><span>+5m</span><span>+10m</span><span>+15m</span><span>+20m</span><span>+25m</span><span>+30m</span></div>`;
  rwyKeys.forEach(rwy => {
    const deps = state.flights.filter(f=>f.runway===rwy&&f.operation==='departure');
    const arrs = state.flights.filter(f=>f.runway===rwy&&f.operation==='arrival');
    html += buildRow(`${rwy} DEP`,deps,'dep');
    html += buildRow(`${rwy} ARR`,arrs,'arr');
  });
  html += `<div class="timeline-legend">
    <div class="legend-item"><div class="legend-dot" style="background:var(--color-safe-dim);border:1px solid var(--color-safe-border)"></div>Departure</div>
    <div class="legend-item"><div class="legend-dot" style="background:var(--color-info-dim);border:1px solid var(--color-info-border)"></div>Arrival</div>
    <div class="legend-item"><div class="legend-dot" style="background:var(--color-warning-dim);border:1px solid var(--color-warning-border)"></div>Hold</div>
    <div class="legend-item"><div class="legend-dot" style="background:var(--color-danger-dim);border:1px solid var(--color-danger-border)"></div>⚠ Conflict</div>
  </div>`;
  wrap.innerHTML = html;
}

function buildRow(label, flights, type) {
  let blocks = '<div class="now-line" style="left:0%"></div>';
  flights.slice(0,8).forEach((f,i) => {
    let cls = 'slot-'+type;
    if (f.status==='waiting') cls='slot-hld';
    if (f.priority==='emergency') cls='slot-cnf';
    const left = 5+(i*12), width=10;
    blocks += `<div class="slot-block ${cls}" style="left:${left}%;width:${width}%" title="${esc(f.flight_id)}">${esc(f.flight_id)}</div>`;
  });
  return `<div class="runway-row"><span class="runway-label">${label}</span><div class="runway-track">${blocks}</div></div>`;
}

function renderInsights() {
  const el = document.getElementById('dashInsights');
  const badge = document.getElementById('dashInsightBadge');
  if (!el) return;
  const total = state.conflicts.length;
  if (badge) { badge.textContent = total+' ALERT'+(total!==1?'S':''); badge.className = 'badge badge-'+(total>0?'danger':'safe'); }
  if (total === 0) { el.innerHTML = '<div class="state-message"><div class="state-icon">✓</div><div class="state-text">No active conflicts</div><div class="state-subtext">System operating normally</div></div>'; return; }
  el.innerHTML = state.conflicts.map(c => `<div class="insight-card">
    <div class="insight-icon">${c.severity==='CRITICAL'?'🚨':'⚠️'}</div>
    <div><div class="insight-title">${esc(c.type)} — ${esc(c.severity)}</div>
    <div class="insight-text">${esc(c.details)}<br><strong>AI Recommendation:</strong> ${esc(c.recommendation)}</div></div>
  </div>`).join('');
}

function renderDashMetrics() {
  const el = document.getElementById('dashMetrics');
  if (!el) return;
  let occ=0,cnt=0,q=0;
  for (const k in state.runways) { const r=state.runways[k]; if(r.status==='AVAILABLE'){occ+=60+Math.random()*25;} cnt++; q+=state.flights.filter(f=>f.runway===k).length; }
  const avgOcc = cnt>0?(occ/cnt):0;
  const onTime = 90+Math.random()*8;

  el.innerHTML = `
    <div class="metric-row"><span class="metric-name">Runway Utilization</span><span class="metric-val text-accent">${avgOcc.toFixed(1)}%</span></div>
    <div class="metric-bar-wrap"><div class="metric-bar-track"><div class="metric-bar-fill fill-accent" style="width:${avgOcc}%"></div></div></div>
    <div class="metric-row"><span class="metric-name">On-Time Performance</span><span class="metric-val text-safe">${onTime.toFixed(1)}%</span></div>
    <div class="metric-bar-wrap"><div class="metric-bar-track"><div class="metric-bar-fill fill-safe" style="width:${onTime}%"></div></div></div>
    <div class="metric-row"><span class="metric-name">Avg Taxi Time</span><span class="metric-val text-warning">4.8 min</span></div>
    <div class="metric-row"><span class="metric-name">Active Conflicts</span><span class="metric-val text-danger">${state.conflicts.length}</span></div>
    <div class="metric-row"><span class="metric-name">Queue Depth</span><span class="metric-val">${q} flights</span></div>
    <div class="metric-row"><span class="metric-name">Flights Tracked</span><span class="metric-val text-info">${state.flights.length}</span></div>
    <p style="font-size:0.58rem;color:var(--text-muted);margin-top:0.5rem;text-align:center;">Simulation Metrics</p>
  `;
}

function renderWeatherMini() {
  const el = document.getElementById('dashWeather');
  if (!el || !state.weather) return;
  const wx = state.weather, w = wx.wind||{};
  const badge = document.getElementById('dashWxBadge');
  if (badge) { badge.textContent = wx.conditions||'—'; badge.className = 'badge badge-'+(wx.storm_alert?'danger':'safe'); }
  el.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--color-accent);margin-bottom:0.5rem;word-break:break-all;">${esc(wx.metar||'')}</div>
    <div style="font-size:0.74rem;color:var(--text-secondary);line-height:1.9;">
      WIND: <strong>${w.direction_deg||0}° / ${w.speed_kts||0} kt${w.gusts_kts?' G'+w.gusts_kts+'kt':''}</strong><br>
      VIS: <strong class="text-safe">${wx.visibility?wx.visibility.meters+'m':'—'}</strong><br>
      TEMP: <strong>${wx.temperature_c||0}°C</strong> · QNH: <strong>${wx.pressure_hpa||1013} hPa</strong>
    </div>
    ${wx.storm_alert?`<div class="weather-impact mt-1">⚠ ${esc(wx.storm_alert.message)}</div>`:''}
  `;
}

// ===== FLIGHT QUEUE PAGE =====
let flightFilter = 'all';
function renderFlightQueue() {
  const el = document.getElementById('flightTableBody');
  if (!el) return;
  let flights = [...state.flights];
  if (flightFilter !== 'all') flights = flights.filter(f => {
    if (flightFilter==='arrival') return f.operation==='arrival';
    if (flightFilter==='departure') return f.operation==='departure';
    if (flightFilter==='emergency') return f.priority==='emergency';
    if (flightFilter==='waiting') return f.status==='waiting';
    return true;
  });
  if (!flights.length) { el.innerHTML = '<tr><td colspan="10" class="state-message"><div class="state-text">No flights match filter</div></td></tr>'; return; }
  el.innerHTML = flights.map(f => {
    const fc = classifyFuel(f.fuel);
    return `<tr>
      <td class="cell-flight">${esc(f.flight_id)}</td>
      <td>${esc(f.aircraft_type)}</td>
      <td>${f.operation==='departure'?'🛫 DEP':'🛬 ARR'}</td>
      <td><div class="fuel-indicator"><div class="fuel-bar"><div class="fuel-bar-fill" style="width:${f.fuel}%;background:${fuelColor(f.fuel)}"></div></div><span style="font-family:var(--font-mono);font-size:0.7rem;color:${fuelColor(f.fuel)}">${f.fuel}%</span></div></td>
      <td><span class="badge badge-${f.priority==='emergency'?'danger':(f.priority==='high'?'warning':'info')}">${f.priority.toUpperCase()}</span></td>
      <td>${statusBadge(f.status)}</td>
      <td style="font-family:var(--font-mono)">${esc(f.runway||'—')}</td>
      <td style="font-family:var(--font-mono)">${f.slot_time?f.slot_time.split(' ')[1]||'—':'—'}</td>
      <td><span class="badge badge-${state.conflicts.some(c=>c.flightA===f.flight_id||c.flightB===f.flight_id)?'danger':'safe'}">${state.conflicts.some(c=>c.flightA===f.flight_id||c.flightB===f.flight_id)?'⚠ YES':'None'}</span></td>
      <td><button class="table-action-btn" onclick="openWizardFor('${f.flight_id}')">Analyze</button></td>
    </tr>`;
  }).join('');
}

function setFlightFilter(f, btn) {
  flightFilter = f;
  document.querySelectorAll('#flightFilters .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderFlightQueue();
}

// ===== RUNWAY STATUS PAGE =====
function renderRunwayStatus() {
  const el = document.getElementById('runwayStatusGrid');
  if (!el) return;
  el.innerHTML = Object.entries(state.runways).map(([id, rwy]) => {
    const flights = state.flights.filter(f => f.runway === id);
    const nextFlight = flights[0];
    const statusCls = rwy.status==='AVAILABLE'?'safe':(rwy.status==='CLOSED'?'danger':'warning');
    return `<div class="runway-card">
      <div class="runway-card-header"><span class="runway-card-name">RWY ${id}</span><span class="badge badge-${statusCls}">${rwy.status}</span></div>
      <div class="runway-info-row"><span class="runway-info-label">Direction</span><span class="runway-info-value">${rwy.direction}°</span></div>
      <div class="runway-info-row"><span class="runway-info-label">Length</span><span class="runway-info-value">${rwy.length_m}m</span></div>
      <div class="runway-info-row"><span class="runway-info-label">Queue</span><span class="runway-info-value">${flights.length} flights</span></div>
      <div class="runway-info-row"><span class="runway-info-label">Next Flight</span><span class="runway-info-value">${nextFlight?esc(nextFlight.flight_id):'None'}</span></div>
      <div class="runway-info-row"><span class="runway-info-label">Next ETA</span><span class="runway-info-value">${nextFlight&&nextFlight.slot_time?nextFlight.slot_time.split(' ')[1]:'—'}</span></div>
      <div class="runway-info-row"><span class="runway-info-label">Departures</span><span class="runway-info-value">${flights.filter(f=>f.operation==='departure').length}</span></div>
      <div class="runway-info-row"><span class="runway-info-label">Arrivals</span><span class="runway-info-value">${flights.filter(f=>f.operation==='arrival').length}</span></div>
    </div>`;
  }).join('');
}

// ===== CONFLICT MONITOR =====
function renderConflictMonitor() {
  const el = document.getElementById('conflictList');
  if (!el) return;
  if (!state.conflicts.length) { el.innerHTML = '<div class="state-message"><div class="state-icon">✓</div><div class="state-text">No active conflicts</div><div class="state-subtext">All operations within safe parameters</div></div>'; return; }
  el.innerHTML = state.conflicts.map((c,i) => `<div class="conflict-card">
    <div class="conflict-card-header"><span class="conflict-type text-danger">${esc(c.type)}</span><span class="badge badge-${c.severity==='CRITICAL'?'danger':(c.severity==='HIGH'?'danger':'warning')}">${c.severity}</span></div>
    <div class="conflict-flights">
      <div class="conflict-flight-tag"><div class="tag-label">Flight A</div><div style="font-weight:600">${esc(c.flightA||'—')}</div></div>
      <div class="conflict-vs">vs</div>
      <div class="conflict-flight-tag"><div class="tag-label">Flight B</div><div style="font-weight:600">${esc(c.flightB||'—')}</div></div>
    </div>
    <div class="conflict-details">
      <div class="conflict-detail-item"><div class="detail-label">Required Separation</div><div class="detail-value">${esc(c.required_sep||'—')}</div></div>
      <div class="conflict-detail-item"><div class="detail-label">Current Separation</div><div class="detail-value text-danger">${esc(c.current_sep||'—')}</div></div>
    </div>
    <p style="font-size:0.74rem;color:var(--text-secondary);margin-bottom:0.6rem">${esc(c.details)}</p>
    <div class="conflict-resolution"><span class="conflict-resolution-text">AI Recommendation: ${esc(c.recommendation)}</span><button class="btn-apply" onclick="applyConflictRes(${i})">Apply</button></div>
  </div>`).join('');
}

function applyConflictRes(idx) {
  const c = state.conflicts[idx];
  if (!c) return;
  addLog('success', 'Conflict resolution applied', c.flightA, c.recommendation);
  state.conflicts.splice(idx, 1);
  showToast('Conflict resolution applied', 'success');
  handleRoute();
}

// ===== WEATHER PAGE =====
function renderWeatherPage() {
  const el = document.getElementById('weatherContent');
  if (!el || !state.weather) return;
  const wx = state.weather, w=wx.wind||{};
  el.innerHTML = `
    <div class="weather-grid">
      <div class="weather-card"><div class="wx-icon">🌬️</div><div class="wx-value">${w.direction_deg||0}° / ${w.speed_kts||0} kt</div><div class="wx-label">Wind</div>${w.gusts_kts?`<div style="font-size:0.65rem;color:var(--color-warning);margin-top:0.2rem">Gusts ${w.gusts_kts} kt</div>`:''}</div>
      <div class="weather-card"><div class="wx-icon">👁️</div><div class="wx-value">${wx.visibility?wx.visibility.meters+'m':'—'}</div><div class="wx-label">Visibility</div></div>
      <div class="weather-card"><div class="wx-icon">🌡️</div><div class="wx-value">${wx.temperature_c||0}°C</div><div class="wx-label">Temperature</div></div>
      <div class="weather-card"><div class="wx-icon">📊</div><div class="wx-value">${wx.pressure_hpa||1013} hPa</div><div class="wx-label">QNH Pressure</div></div>
      <div class="weather-card"><div class="wx-icon">☁️</div><div class="wx-value">${wx.conditions||'—'}</div><div class="wx-label">Conditions</div></div>
      <div class="weather-card"><div class="wx-icon">${wx.storm_alert?'⛈️':'✈️'}</div><div class="wx-value badge badge-${wx.storm_alert?'danger':'safe'}" style="font-size:0.8rem">${wx.storm_alert?'IMPACT':'NORMAL'}</div><div class="wx-label">Runway Impact</div></div>
    </div>
    <h3 style="font-family:var(--font-display);font-size:0.62rem;letter-spacing:1px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.5rem">Raw METAR</h3>
    <div class="metar-raw">${esc(wx.metar||'No METAR available')}</div>
    ${wx.storm_alert?`<div class="weather-impact">⚠ ${esc(wx.storm_alert.message)}</div>`:''}
  `;
}

// ===== ANALYTICS =====
function renderAnalytics() {
  const el = document.getElementById('analyticsContent');
  if (!el) return;
  const rwyEntries = Object.entries(state.runways);
  el.innerHTML = `
    <p style="font-size:0.68rem;color:var(--color-warning);margin-bottom:1rem"><span class="badge badge-warning">DEMO</span> Simulation / Demo Metrics — not validated production data</p>
    <div class="analytics-grid">
      <div class="chart-card"><div class="chart-title">Runway Utilization</div><div class="bar-chart">${rwyEntries.map(([id,r])=>{
        const pct=r.status==='AVAILABLE'?(55+Math.random()*30):0;
        return `<div class="bar-row"><div class="bar-label">RWY ${id}</div><div class="bar-track"><div class="bar-fill fill-accent" style="width:${pct.toFixed(0)}%">${pct.toFixed(0)}%</div></div></div>`;
      }).join('')}</div></div>
      <div class="chart-card"><div class="chart-title">Flight Operations</div><div class="bar-chart">
        <div class="bar-row"><div class="bar-label">Departures</div><div class="bar-track"><div class="bar-fill fill-safe" style="width:${state.flights.filter(f=>f.operation==='departure').length*15}%">${state.flights.filter(f=>f.operation==='departure').length}</div></div></div>
        <div class="bar-row"><div class="bar-label">Arrivals</div><div class="bar-track"><div class="bar-fill fill-info" style="width:${state.flights.filter(f=>f.operation==='arrival').length*15}%">${state.flights.filter(f=>f.operation==='arrival').length}</div></div></div>
        <div class="bar-row"><div class="bar-label">Waiting</div><div class="bar-track"><div class="bar-fill fill-warning" style="width:${state.flights.filter(f=>f.status==='waiting').length*15}%">${state.flights.filter(f=>f.status==='waiting').length}</div></div></div>
      </div></div>
      <div class="chart-card"><div class="chart-title">Conflicts (Session)</div><div class="bar-chart">
        <div class="bar-row"><div class="bar-label">Active</div><div class="bar-track"><div class="bar-fill fill-danger" style="width:${state.conflicts.length*20}%">${state.conflicts.length}</div></div></div>
        <div class="bar-row"><div class="bar-label">Resolved</div><div class="bar-track"><div class="bar-fill fill-safe" style="width:${systemLogs.filter(l=>l.event.includes('resolution')).length*20}%">${systemLogs.filter(l=>l.event.includes('resolution')).length}</div></div></div>
      </div></div>
      <div class="chart-card"><div class="chart-title">Average Delay by Priority</div><div class="bar-chart">
        <div class="bar-row"><div class="bar-label">Normal</div><div class="bar-track"><div class="bar-fill fill-info" style="width:45%">4.2 min</div></div></div>
        <div class="bar-row"><div class="bar-label">High</div><div class="bar-track"><div class="bar-fill fill-warning" style="width:25%">2.1 min</div></div></div>
        <div class="bar-row"><div class="bar-label">Emergency</div><div class="bar-track"><div class="bar-fill fill-danger" style="width:5%">0 min</div></div></div>
      </div></div>
    </div>`;
}

// ===== LOGS =====
function renderLogs() {
  const el = document.getElementById('logTableBody');
  if (!el) return;
  if (!systemLogs.length) { el.innerHTML = '<tr><td colspan="5" class="state-message"><div class="state-text">No log entries yet</div></td></tr>'; return; }
  el.innerHTML = systemLogs.slice(0,100).map(l => `<tr>
    <td>${l.time}</td>
    <td><span class="log-severity ${l.severity}">${l.severity.toUpperCase()}</span></td>
    <td>${esc(l.event)}</td>
    <td style="font-weight:600">${esc(l.flight)}</td>
    <td>${esc(l.detail)}</td>
  </tr>`).join('');
}

// ===== SETTINGS =====
function renderSettings() { /* Static HTML — no dynamic render needed */ }

function toggleDemoMode() {
  state.settings.demoMode = !state.settings.demoMode;
  const el = document.getElementById('toggleDemo');
  if (el) el.classList.toggle('active', state.settings.demoMode);
  const badge = document.getElementById('demoBadge');
  if (badge) badge.style.display = state.settings.demoMode ? 'inline' : 'none';
}

// ===== WIZARD =====
function openWizard() {
  wizardStep = 1;
  lastAnalysis = null;
  lastAnalysisFlight = null;
  document.getElementById('wizardModal').classList.add('open');
  document.getElementById('recPanel').classList.remove('show');
  updateWizardUI();
  // Clear form
  document.getElementById('wFid').value = '';
  document.getElementById('wAcType').value = 'A320';
  document.getElementById('wOp').value = 'departure';
  document.getElementById('wFuel').value = '60';
  document.getElementById('wPriority').value = 'normal';
  updateFuelVisual();
}

function openWizardFor(flightId) {
  openWizard();
  const f = state.flights.find(x => x.flight_id === flightId);
  if (f) {
    document.getElementById('wFid').value = f.flight_id;
    document.getElementById('wAcType').value = f.aircraft_type;
    document.getElementById('wOp').value = f.operation;
    document.getElementById('wFuel').value = f.fuel;
    document.getElementById('wPriority').value = f.priority;
    updateFuelVisual();
  }
}

function closeWizard() {
  document.getElementById('wizardModal').classList.remove('open');
}

function wizardNext() {
  if (wizardStep === 1) {
    const fid = document.getElementById('wFid').value.trim();
    if (!fid) { showToast('Please enter a Flight ID','warn'); return; }
    wizardStep = 2;
  } else if (wizardStep === 2) {
    wizardStep = 3;
  }
  updateWizardUI();
}

function wizardBack() {
  if (wizardStep > 1) wizardStep--;
  updateWizardUI();
}

function updateWizardUI() {
  for (let i=1;i<=3;i++) {
    const panel = document.getElementById('wizStep'+i);
    const step = document.getElementById('wizStepInd'+i);
    if (panel) panel.classList.toggle('active', i===wizardStep);
    if (step) {
      step.classList.remove('active','done');
      if (i===wizardStep) step.classList.add('active');
      else if (i<wizardStep) step.classList.add('done');
    }
  }
  // Show flight preview on step 2
  if (wizardStep >= 2) {
    const fid = document.getElementById('wFid').value.trim();
    const existing = state.flights.find(f => f.flight_id === fid.toUpperCase() || f.flight_id === fid);
    const preview = document.getElementById('flightPreview');
    if (preview) {
      if (existing) {
        preview.innerHTML = `<p style="color:var(--color-safe);font-size:0.74rem;margin-bottom:0.3rem">✓ Flight found in current dataset</p>
          <p style="font-size:0.8rem"><strong>${esc(existing.flight_id)}</strong> · ${esc(existing.aircraft_type)} · ${existing.operation==='departure'?'🛫 Departure':'🛬 Arrival'}</p>`;
      } else {
        preview.innerHTML = `<p style="color:var(--text-muted);font-size:0.74rem">Flight not in current dataset. Proceeding with manual entry.</p>`;
      }
    }
  }
}

function updateFuelVisual() {
  const val = parseInt(document.getElementById('wFuel').value) || 0;
  const fill = document.getElementById('fuelGaugeFill');
  const status = document.getElementById('fuelStatusText');
  if (fill) { fill.style.width = val+'%'; fill.style.background = fuelColor(val); }
  const fc = classifyFuel(val);
  if (status) { status.textContent = fc.label+' ('+val+'%)'; status.style.color = fuelColor(val); }
}

function runAnalysis() {
  const fid = document.getElementById('wFid').value.trim().toUpperCase();
  const acType = document.getElementById('wAcType').value;
  const op = document.getElementById('wOp').value;
  const fuel = parseInt(document.getElementById('wFuel').value)||60;
  const priority = document.getElementById('wPriority').value;

  if (!fid) { showToast('Please enter a Flight ID','warn'); return; }

  const flight = { flight_id:fid, aircraft_type:acType, operation:op, fuel, priority };
  showToast('Analyzing slot for '+fid+'...','info');
  addLog('info','Slot analysis requested',fid,`${acType} ${op} Fuel:${fuel}% Priority:${priority}`);

  // Simulate brief processing
  setTimeout(() => {
    lastAnalysisFlight = flight;
    lastAnalysis = analyzeSlot(flight, state.flights, state.weather, state.runways);
    closeWizard();
    showRecommendation();
    addLog('info','Analysis complete',fid,`Recommended RWY ${lastAnalysis.recommended_runway} at ${lastAnalysis.recommended_slot}`);
  }, 600);
}

function showRecommendation() {
  if (!lastAnalysis || !lastAnalysisFlight) return;
  const a = lastAnalysis, f = lastAnalysisFlight;
  const el = document.getElementById('recPanel');
  const body = document.getElementById('recBody');
  if (!el || !body) return;

  body.innerHTML = `
    <div class="rec-main-info">
      <div class="rec-item"><div class="rec-item-label">Flight</div><div class="rec-item-value">${esc(f.flight_id)}</div></div>
      <div class="rec-item"><div class="rec-item-label">Recommended Runway</div><div class="rec-item-value highlight">${esc(a.recommended_runway)}</div></div>
      <div class="rec-item"><div class="rec-item-label">Recommended Slot</div><div class="rec-item-value highlight">${esc(a.recommended_slot)} UTC</div></div>
      <div class="rec-item"><div class="rec-item-label">Priority Score</div><div class="rec-item-value">${a.priority_score} / 100 <span class="badge badge-${a.priority_label==='EMERGENCY'?'danger':(a.priority_label==='HIGH'?'warning':'info')}" style="margin-left:4px">${a.priority_label}</span></div></div>
      <div class="rec-item"><div class="rec-item-label">Conflict Risk</div><div class="rec-item-value ${a.conflict_label==='LOW'?'safe':(a.conflict_label==='MEDIUM'?'warning':'text-danger')}">${a.conflict_label} — ${(a.conflict_risk*100).toFixed(0)}%</div></div>
      <div class="rec-item"><div class="rec-item-label">Est. Taxi Time</div><div class="rec-item-value">${a.estimated_taxi.toFixed(1)} min</div></div>
    </div>
    <div class="rec-checks"><div class="rec-checks-title">Safety & Separation Checks</div>
      ${a.checks.map(c => `<div class="check-item"><span class="check-icon ${c.passed?'check-passed':'check-failed'}">${c.passed?'✓':'✕'}</span><span>${esc(c.label)}</span><span style="margin-left:auto;font-size:0.65rem;color:var(--text-muted)">${esc(c.detail)}</span></div>`).join('')}
    </div>
    <div class="rec-reasons"><div class="rec-reasons-title">💡 Why This Slot?</div>
      ${a.reasons.map(r => `<div class="reason-item">${esc(r)}</div>`).join('')}
    </div>
    <div class="rec-actions">
      <button class="btn-accept" onclick="acceptRec()">✓ Accept Recommendation</button>
      <button class="btn-modify" onclick="modifyRec()">Modify</button>
      <button class="btn-reject" onclick="rejectRec()">Reject</button>
    </div>`;

  el.classList.add('show');
  el.scrollIntoView({ behavior:'smooth', block:'start' });
}

function acceptRec() {
  if (!lastAnalysis || !lastAnalysisFlight) return;
  const f = lastAnalysisFlight, a = lastAnalysis;

  // Add to flights
  const exists = state.flights.find(x => x.flight_id === f.flight_id);
  if (exists) {
    exists.runway = a.recommended_runway;
    exists.slot_time = a.slot_time_full;
    exists.status = 'allocated';
  } else {
    state.flights.push({
      ...f, runway: a.recommended_runway, slot_time: a.slot_time_full,
      status:'allocated', slot_time_offset: 0, priority_score: a.priority_score
    });
  }

  addLog('success','Recommendation accepted',f.flight_id,`RWY ${a.recommended_runway} at ${a.recommended_slot}`);
  showToast(`✓ ${f.flight_id} allocated to RWY ${a.recommended_runway} at ${a.recommended_slot}`,'success');
  document.getElementById('recPanel').classList.remove('show');
  lastAnalysis = null; lastAnalysisFlight = null;
  handleRoute();
}

function modifyRec() {
  if (!lastAnalysis || !lastAnalysisFlight) return;
  const newRwy = prompt('Enter runway (e.g. 09/27 or 14/32):', lastAnalysis.recommended_runway);
  if (!newRwy) return;
  const validation = validateModification(newRwy, null, lastAnalysisFlight, state.flights, state.runways);
  if (!validation.valid) {
    showToast('Cannot allocate: '+validation.errors.join('. '),'error');
    addLog('warning','Modification blocked',lastAnalysisFlight.flight_id,validation.errors.join('; '));
    return;
  }
  lastAnalysis.recommended_runway = newRwy;
  addLog('info','Recommendation modified',lastAnalysisFlight.flight_id,`Runway changed to ${newRwy}`);
  showToast('Runway modified to '+newRwy+'. Review updated recommendation.','info');
  showRecommendation();
}

function rejectRec() {
  if (!lastAnalysisFlight) return;
  addLog('warning','Recommendation rejected',lastAnalysisFlight.flight_id,'Controller rejected AI recommendation');
  showToast('Recommendation rejected','warn');
  document.getElementById('recPanel').classList.remove('show');
  lastAnalysis = null; lastAnalysisFlight = null;
}
