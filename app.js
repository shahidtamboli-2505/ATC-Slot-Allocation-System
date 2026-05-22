/**
 * SkySlot AI — Integrated Backend Logic
 */

const API_BASE = window.location.origin;
const POLL_INTERVAL = 3000;

let state = {
  flights: [],
  weather: null,
  runways: {},
  metrics: {},
  conflicts: [],
  recommendations: []
};

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  startPolling();
});

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + ' UTC';
}

function startPolling() {
  fetchAll();
  setInterval(fetchAll, POLL_INTERVAL);
}

async function fetchJSON(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    return { success: false, error: err };
  }
}

async function fetchAll() {
  const [flightsRes, weatherRes, runwaysRes, metricsRes, conflictsRes, recRes] = await Promise.all([
    fetchJSON('/flights'),
    fetchJSON('/weather'),
    fetchJSON('/runways'),
    fetchJSON('/metrics'),
    fetchJSON('/conflicts'),
    fetchJSON('/ai-recommendations')
  ]);

  const connBadge = document.getElementById('connStatus');
  const statusDot = document.getElementById('statusDot');
  if (flightsRes.success !== false) {
    connBadge.textContent = 'LIVE';
    connBadge.className = 'panel-badge badge-green';
    statusDot.style.background = 'var(--accent-green)';
    statusDot.style.boxShadow = 'var(--glow-green)';
  } else {
    connBadge.textContent = 'OFFLINE';
    connBadge.className = 'panel-badge badge-red';
    statusDot.style.background = 'var(--accent-red)';
    statusDot.style.boxShadow = '0 0 10px var(--accent-red)';
    return; // Stop updating if offline
  }

  if (flightsRes.success) state.flights = flightsRes.flights || [];
  if (weatherRes.success) state.weather = weatherRes.weather;
  if (runwaysRes.success) state.runways = runwaysRes.runways || {};
  if (metricsRes.success) state.metrics = metricsRes;
  if (conflictsRes.success) state.conflicts = conflictsRes.active_conflicts || [];
  if (recRes.success) state.recommendations = recRes.recommendations || [];

  renderDashboard();
}

function renderDashboard() {
  renderMetrics();
  renderFlights();
  renderRunways();
  renderInsights();
  renderWeather();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderMetrics() {
  document.getElementById('activeFlights').textContent = state.flights.length;
  if (state.metrics.system) {
    document.getElementById('slotsAlloc').textContent = state.metrics.system.total_flights_processed || 0;
    const ot = state.metrics.system.on_time_rate || 0;
    document.getElementById('metricOnTime').textContent = ot.toFixed(1) + '%';
    document.getElementById('barOnTime').style.width = ot + '%';

    const taxi = state.metrics.system.avg_delay_minutes || 0;
    document.getElementById('metricTaxi').textContent = taxi.toFixed(1) + ' min';
    document.getElementById('barTaxi').style.width = Math.min(100, (taxi / 30) * 100) + '%';

    document.getElementById('metricFlightsHour').textContent = (state.metrics.system.total_flights_processed > 0) ? Math.max(20, Math.floor(state.flights.length * 1.5)) : '--';
  }
  
  if (state.metrics.ai_model && state.metrics.ai_model.conflict_model) {
    document.getElementById('aiAccuracy').textContent = (state.metrics.ai_model.conflict_model.accuracy * 100).toFixed(1) + '%';
  }

  const conflictsCount = state.conflicts.length;
  const conflictEl = document.getElementById('conflictsCount');
  conflictEl.textContent = conflictsCount;
  conflictEl.style.color = conflictsCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)';
  
  document.getElementById('metricConflicts').textContent = conflictsCount;
  document.getElementById('barConflicts').style.width = Math.min(100, conflictsCount * 20) + '%';

  let occ = 0; let count = 0; let queueDepth = 0;
  for (let k in state.runways) {
    occ += state.runways[k].occupancy_pct || 0;
    queueDepth += state.runways[k].queue_length || 0;
    count++;
  }
  const avgOcc = count > 0 ? occ / count : 0;
  document.getElementById('metricRunwayUtil').textContent = avgOcc.toFixed(1) + '%';
  document.getElementById('barRunwayUtil').style.width = avgOcc + '%';
  document.getElementById('metricQueueDepth').textContent = queueDepth + ' flights';
}

const iconMap = { departure:'🛫', arrival:'🛬' };

function renderFlights() {
  const fl = document.getElementById('flightList');
  if (!state.flights.length) {
    fl.innerHTML = `<div style="padding:1rem;color:var(--text-dim);font-size:0.8rem;">No active flights.</div>`;
    return;
  }
  let html = '';
  state.flights.forEach((f, i) => {
    const isConflict = f.display_status === 'CONFLICT';
    const isHold = f.display_status === 'DELAYED' || f.status === 'HOLD';
    const typeClass = isHold ? 'hld' : (f.operation === 'departure' ? 'dep' : 'arr');
    const icon = isHold ? '⏸' : (iconMap[f.operation] || '✈');
    const timeDisplay = f.slot_time ? f.slot_time.split(' ')[1] : '--:--';

    html += `
    <div class="flight-item" onclick="selectFlight(this)">
      <div class="flight-icon ${typeClass}">${icon}</div>
      <div class="flight-info">
        <div class="flight-id">${escapeHtml(f.flight_id)}</div>
        <div class="flight-route">${escapeHtml(f.aircraft_type)} · RWY ${escapeHtml(f.runway || '--')}</div>
      </div>
      <div class="flight-time">
        <div class="t">${timeDisplay}</div>
        <div class="s" style="color:${isConflict?'var(--accent-red)':typeClass==='hld'?'var(--accent-amber)':'var(--text-dim)'}">
          ${escapeHtml(f.display_status || f.status || '')}
        </div>
      </div>
    </div>`;
  });
  fl.innerHTML = html;
}

function selectFlight(el) {
  document.querySelectorAll('.flight-item').forEach(x => x.classList.remove('selected'));
  el.classList.add('selected');
}

function renderRunways() {
  const wrap = document.getElementById('timelineWrap');
  const badgeWrap = document.getElementById('runwayBadges');
  
  if (!Object.keys(state.runways).length) return;

  let badgesHtml = '';
  let html = `<div class="time-labels">
    <span>NOW</span><span>+5m</span><span>+10m</span><span>+15m</span><span>+20m</span><span>+25m</span><span>+30m</span>
  </div>`;

  Object.keys(state.runways).sort().forEach((rwyName, idx) => {
    const badgeColor = idx % 2 === 0 ? 'cyan' : 'green';
    badgesHtml += `<span class="panel-badge badge-${badgeColor}">RWY ${rwyName}</span>`;

    const deps = state.flights.filter(f => f.runway === rwyName && f.operation === 'departure');
    const arrs = state.flights.filter(f => f.runway === rwyName && f.operation === 'arrival');

    html += buildRunwayRow(`${rwyName} DEP`, deps, 'dep');
    html += buildRunwayRow(`${rwyName} ARR`, arrs, 'arr');
  });

  badgeWrap.innerHTML = badgesHtml;

  html += `<div style="display:flex;gap:1rem;margin-top:0.8rem;flex-wrap:wrap;">
    <span style="font-size:0.67rem;color:var(--text-dim);"><span style="display:inline-block;width:10px;height:10px;background:rgba(0,255,136,0.25);border:1px solid rgba(0,255,136,0.5);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Departure</span>
    <span style="font-size:0.67rem;color:var(--text-dim);"><span style="display:inline-block;width:10px;height:10px;background:rgba(0,229,255,0.25);border:1px solid rgba(0,229,255,0.5);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Arrival</span>
    <span style="font-size:0.67rem;color:var(--text-dim);"><span style="display:inline-block;width:10px;height:10px;background:rgba(255,179,0,0.2);border:1px solid rgba(255,179,0,0.5);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Hold</span>
    <span style="font-size:0.67rem;color:var(--text-dim);"><span style="display:inline-block;width:10px;height:10px;background:rgba(255,61,87,0.2);border:1px solid rgba(255,61,87,0.5);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>⚠ Conflict</span>
  </div>`;

  wrap.innerHTML = html;
}

function buildRunwayRow(label, flightsList, type) {
  let blocks = `<div class="now-line" style="left:0%"></div>`;
  
  flightsList.slice(0, 8).forEach((f, i) => {
    let slotClass = `slot-${type}`;
    if (f.display_status === 'DELAYED') slotClass = 'slot-hld';
    if (f.display_status === 'CONFLICT') slotClass = 'slot-cnf';

    const left = 5 + (i * 12);
    const width = 10;
    
    blocks += `<div class="slot-block ${slotClass}" style="left:${left}%;width:${width}%" title="${escapeHtml(f.flight_id)}">${escapeHtml(f.flight_id)}</div>`;
    if (f.display_status === 'CONFLICT') {
      blocks += `<div class="conflict-marker" style="left:${left}%"></div>`;
    }
  });

  return `
  <div class="runway-row">
    <span class="runway-label" style="min-width:60px">${label}</span>
    <div class="runway-track">
      ${blocks}
    </div>
  </div>`;
}

function renderInsights() {
  const container = document.getElementById('aiInsights');
  const badge = document.getElementById('insightBadge');
  
  let totalAlerts = state.conflicts.length + state.recommendations.length;
  badge.textContent = `${totalAlerts} ALERTS`;
  if (totalAlerts === 0) {
    badge.className = 'panel-badge badge-green';
  } else if (state.conflicts.length > 0) {
    badge.className = 'panel-badge badge-red';
  } else {
    badge.className = 'panel-badge badge-amber';
  }

  let html = '';

  state.conflicts.forEach(c => {
    let rec = c.recommendation || '';
    if (typeof rec === 'object') rec = rec.message || '';
    html += `
    <div class="insight-card">
      <div class="insight-icon">⚠️</div>
      <div>
        <div class="insight-title">${escapeHtml(c.type || 'Conflict')} — ${escapeHtml(c.severity || 'WARN')}</div>
        <div class="insight-text">
          ${escapeHtml(c.details || '')}
          <br><strong style="color:var(--accent-cyan)">AI Rec:</strong> ${escapeHtml(rec)}
        </div>
      </div>
    </div>`;
  });

  state.recommendations.forEach(r => {
    html += `
    <div class="insight-card">
      <div class="insight-icon">🤖</div>
      <div>
        <div class="insight-title">${escapeHtml(r.title || 'Optimization')}</div>
        <div class="insight-text">
          ${escapeHtml(r.message || '')}
          <br><strong style="color:var(--accent-green)">Impact:</strong> ${escapeHtml(r.impact || '')}
        </div>
      </div>
    </div>`;
  });

  if (!html) {
    html = `<div style="padding:0.5rem;color:var(--text-dim);font-size:0.8rem;">No active insights. System optimal.</div>`;
  }
  container.innerHTML = html;
}

function renderWeather() {
  const wx = state.weather;
  if (!wx) return;

  document.getElementById('wxBadge').textContent = wx.conditions || 'UNKNOWN';

  const w = wx.wind || {};
  const windStr = `${w.direction_deg || 0}° / ${w.speed_kts || 0}KT`;
  const visStr = wx.visibility ? (wx.visibility.meters || 9999) + 'M' : '9999M';
  const tempStr = `${wx.temperature_c || 0}°C`;
  const presStr = `${wx.pressure_hpa || 1013} hPa`;
  
  let alertHtml = '';
  if (wx.storm_alert) {
    alertHtml = `<div style="margin-top:0.5rem;color:var(--accent-red);font-size:0.65rem;">⚡ ${escapeHtml(wx.storm_alert.message)}</div>`;
  }

  document.getElementById('wxData').innerHTML = `
    <div style="margin-bottom:6px;color:var(--accent-cyan);word-break:break-all;">${escapeHtml(wx.metar || '')}</div>
    <div>WIND: <span style="color:var(--text-bright)">${windStr}</span></div>
    <div>VIS: <span style="color:var(--accent-green)">${visStr}</span></div>
    <div>TEMP: <span style="color:var(--accent-amber)">${tempStr}</span></div>
    <div>QNH: <span style="color:var(--text-bright)">${presStr}</span></div>
    ${alertHtml}
  `;
}

async function allocateSlot() {
  const fid = document.getElementById('fid').value.trim();
  const op  = document.getElementById('optype').value;
  const actype = document.getElementById('actype').value;
  const priority = document.getElementById('priority').value;
  const fuel = document.getElementById('fuel').value;

  if (!fid) {
    showToast('Please enter a Flight ID', 'warn');
    return;
  }

  showToast(`AI allocating slot for ${fid}...`, 'info');

  const payload = {
    flight_id: fid.toUpperCase(),
    aircraft_type: actype,
    operation: op,
    priority: parseInt(priority),
    fuel_level: parseFloat(fuel),
    emergency_status: "none"
  };

  try {
    const resp = await fetch(API_BASE + '/allocate-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();

    if (data.success) {
      const alloc = data.allocation || {};
      const slotTime = alloc.slot_time || '--';
      const slotDisplay = slotTime.includes(' ') ? slotTime.split(' ')[1] : slotTime;
      showToast(`✈ ${fid.toUpperCase()} — ${op} slot confirmed: RWY ${alloc.runway}, ${slotDisplay}`, 'success');
      document.getElementById('fid').value = '';
      
      showAllocationResult(fid.toUpperCase(), alloc);
      
      fetchAll();
    } else {
      showToast('Allocation failed: ' + data.error, 'warn');
    }
  } catch (err) {
    showToast('Network error during allocation', 'warn');
  }
}

function showAllocationResult(flightId, alloc) {
  const resultEl = document.getElementById('allocationResult');
  const bodyEl = document.getElementById('allocationResultBody');
  const slotTime = alloc.slot_time || '--';
  const slotDisplay = slotTime.includes(' ') ? slotTime.split(' ')[1] : slotTime;

  bodyEl.innerHTML = `
    <div class="allocation-result-item">
      <div class="allocation-result-label">Flight</div>
      <div class="allocation-result-value">${escapeHtml(flightId)}</div>
    </div>
    <div class="allocation-result-item">
      <div class="allocation-result-label">Runway</div>
      <div class="allocation-result-value highlight">${escapeHtml(alloc.runway || '--')}</div>
    </div>
    <div class="allocation-result-item">
      <div class="allocation-result-label">Slot Time</div>
      <div class="allocation-result-value highlight">${escapeHtml(slotDisplay)}</div>
    </div>
    <div class="allocation-result-item">
      <div class="allocation-result-label">Est. Delay</div>
      <div class="allocation-result-value ${(alloc.expected_delay_minutes || 0) > 10 ? 'warn' : ''}">${(alloc.expected_delay_minutes || 0).toFixed(1)} min</div>
    </div>
    <div class="allocation-result-item">
      <div class="allocation-result-label">Confidence</div>
      <div class="allocation-result-value">${((alloc.confidence || 0) * 100).toFixed(1)}%</div>
    </div>
    <div class="allocation-result-item">
      <div class="allocation-result-label">Conflict Risk</div>
      <div class="allocation-result-value ${(alloc.conflict_probability || 0) > 0.3 ? 'warn' : ''}">${((alloc.conflict_probability || 0) * 100).toFixed(1)}%</div>
    </div>
  `;

  resultEl.classList.add('show');
  setTimeout(() => {
    resultEl.classList.remove('show');
  }, 12000);
}

function showToast(msg, type='info') {
  const wrap = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✅', warn:'⚠️', info:'ℹ️' };
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
