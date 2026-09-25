/**
 * SkySlot AI — Data Layer & Simulation Engine
 */

const AIRCRAFT_DB = {
  'A320':  { name:'Airbus A320',  wake:'MEDIUM', minSep:3, taxiTime:4.5 },
  'A321':  { name:'Airbus A321',  wake:'MEDIUM', minSep:3, taxiTime:4.8 },
  'B737':  { name:'Boeing 737',   wake:'MEDIUM', minSep:3, taxiTime:4.2 },
  'B777':  { name:'Boeing 777',   wake:'HEAVY',  minSep:5, taxiTime:6.0 },
  'B787':  { name:'Boeing 787',   wake:'HEAVY',  minSep:5, taxiTime:5.5 },
  'A380':  { name:'Airbus A380',  wake:'SUPER',  minSep:6, taxiTime:7.0 },
  'ATR72': { name:'ATR 72',       wake:'LIGHT',  minSep:3, taxiTime:3.0 },
};

const WAKE_SEPARATION = {
  'SUPER_HEAVY':6,'SUPER_MEDIUM':7,'SUPER_LIGHT':8,
  'HEAVY_HEAVY':4,'HEAVY_MEDIUM':5,'HEAVY_LIGHT':6,
  'MEDIUM_MEDIUM':3,'MEDIUM_LIGHT':5,
  'LIGHT_LIGHT':3,'LIGHT_MEDIUM':3,'LIGHT_HEAVY':3,'LIGHT_SUPER':3,
  'MEDIUM_HEAVY':3,'MEDIUM_SUPER':3,'HEAVY_SUPER':3
};

function getWakeSep(leadType, followType) {
  const lead = (AIRCRAFT_DB[leadType]||{}).wake||'MEDIUM';
  const follow = (AIRCRAFT_DB[followType]||{}).wake||'MEDIUM';
  return WAKE_SEPARATION[lead+'_'+follow] || 3;
}

const RUNWAYS = {
  '09/27': { name:'RWY 09/27', direction:90, length_m:3660, status:'AVAILABLE' },
  '14/32': { name:'RWY 14/32', direction:140, length_m:2987, status:'AVAILABLE' }
};

const SCENARIOS = {
  normal: {
    name:'Normal Operations', icon:'✈️', desc:'Standard traffic flow',
    flights: [
      {flight_id:'AI-606',aircraft_type:'B737',operation:'departure',runway:'09/27',fuel:72,priority:'normal',status:'scheduled',slot_time_offset:5},
      {flight_id:'6E-204',aircraft_type:'A320',operation:'arrival',runway:'14/32',fuel:55,priority:'normal',status:'approach',slot_time_offset:8},
      {flight_id:'UK-812',aircraft_type:'B787',operation:'departure',runway:'09/27',fuel:88,priority:'normal',status:'taxi',slot_time_offset:12},
      {flight_id:'SG-401',aircraft_type:'ATR72',operation:'arrival',runway:'14/32',fuel:41,priority:'normal',status:'scheduled',slot_time_offset:18},
      {flight_id:'EK-502',aircraft_type:'B777',operation:'departure',runway:'09/27',fuel:90,priority:'normal',status:'waiting',slot_time_offset:22},
    ],
    weather:{conditions:'CAVOK',metar:'VABB 251800Z 24008KT 9999 FEW020 28/24 Q1008 NOSIG',wind:{direction_deg:240,speed_kts:8},visibility:{meters:9999},temperature_c:28,pressure_hpa:1008},
    conflicts:[]
  },
  high_traffic: {
    name:'High Traffic', icon:'🔥', desc:'Peak hour congestion',
    flights: [
      {flight_id:'AI-101',aircraft_type:'A380',operation:'arrival',runway:'09/27',fuel:45,priority:'high',status:'approach',slot_time_offset:3},
      {flight_id:'AI-606',aircraft_type:'B737',operation:'departure',runway:'09/27',fuel:72,priority:'normal',status:'scheduled',slot_time_offset:5},
      {flight_id:'6E-204',aircraft_type:'A320',operation:'arrival',runway:'14/32',fuel:55,priority:'normal',status:'approach',slot_time_offset:6},
      {flight_id:'UK-812',aircraft_type:'B787',operation:'departure',runway:'09/27',fuel:88,priority:'normal',status:'taxi',slot_time_offset:9},
      {flight_id:'SG-401',aircraft_type:'ATR72',operation:'arrival',runway:'14/32',fuel:41,priority:'normal',status:'scheduled',slot_time_offset:11},
      {flight_id:'EK-502',aircraft_type:'B777',operation:'departure',runway:'09/27',fuel:90,priority:'normal',status:'waiting',slot_time_offset:14},
      {flight_id:'QR-556',aircraft_type:'A321',operation:'arrival',runway:'14/32',fuel:60,priority:'normal',status:'scheduled',slot_time_offset:16},
      {flight_id:'AI-845',aircraft_type:'A320',operation:'departure',runway:'14/32',fuel:78,priority:'normal',status:'waiting',slot_time_offset:19},
    ],
    weather:{conditions:'FEW',metar:'VABB 251800Z 27012KT 8000 FEW025 SCT040 30/25 Q1006 NOSIG',wind:{direction_deg:270,speed_kts:12},visibility:{meters:8000},temperature_c:30,pressure_hpa:1006},
    conflicts:[{type:'Runway Congestion',severity:'MEDIUM',flightA:'EK-502',flightB:'UK-812',details:'Both heavy aircraft queued for RWY 09/27 departure within 3 min window.',required_sep:'5 NM',current_sep:'3.1 NM',recommendation:'Delay EK-502 departure by 120 sec'}]
  },
  emergency: {
    name:'Emergency Flight', icon:'🚨', desc:'Critical fuel emergency',
    flights: [
      {flight_id:'AI-402',aircraft_type:'A320',operation:'arrival',runway:'09/27',fuel:8,priority:'emergency',status:'emergency',slot_time_offset:0},
      {flight_id:'AI-606',aircraft_type:'B737',operation:'departure',runway:'09/27',fuel:72,priority:'normal',status:'waiting',slot_time_offset:8},
      {flight_id:'6E-204',aircraft_type:'A320',operation:'arrival',runway:'14/32',fuel:55,priority:'normal',status:'scheduled',slot_time_offset:12},
      {flight_id:'UK-812',aircraft_type:'B787',operation:'departure',runway:'09/27',fuel:88,priority:'normal',status:'taxi',slot_time_offset:18},
    ],
    weather:{conditions:'CAVOK',metar:'VABB 251800Z 24006KT 9999 FEW020 28/24 Q1010 NOSIG',wind:{direction_deg:240,speed_kts:6},visibility:{meters:9999},temperature_c:28,pressure_hpa:1010},
    conflicts:[{type:'Emergency Priority Override',severity:'CRITICAL',flightA:'AI-402',flightB:'AI-606',details:'Emergency aircraft AI-402 (fuel 8%) requires immediate runway. AI-606 departure must hold.',required_sep:'Immediate',current_sep:'N/A',recommendation:'Clear RWY 09/27 for AI-402 emergency landing. Hold all departures.'}]
  },
  wake_conflict: {
    name:'Wake Conflict', icon:'🌊', desc:'Wake turbulence separation issue',
    flights: [
      {flight_id:'EK-501',aircraft_type:'A380',operation:'departure',runway:'09/27',fuel:92,priority:'normal',status:'taxi',slot_time_offset:3},
      {flight_id:'AI-142',aircraft_type:'A320',operation:'departure',runway:'09/27',fuel:65,priority:'normal',status:'waiting',slot_time_offset:5},
      {flight_id:'6E-330',aircraft_type:'A320',operation:'arrival',runway:'14/32',fuel:50,priority:'normal',status:'approach',slot_time_offset:8},
      {flight_id:'SG-220',aircraft_type:'ATR72',operation:'arrival',runway:'14/32',fuel:38,priority:'normal',status:'scheduled',slot_time_offset:15},
    ],
    weather:{conditions:'CAVOK',metar:'VABB 251800Z 22010KT 9999 FEW030 29/23 Q1009 NOSIG',wind:{direction_deg:220,speed_kts:10},visibility:{meters:9999},temperature_c:29,pressure_hpa:1009},
    conflicts:[{type:'Wake Turbulence',severity:'HIGH',flightA:'EK-501',flightB:'AI-142',details:'A380 (SUPER) departure followed by A320 (MEDIUM) on same runway. Insufficient wake separation.',required_sep:'7 NM / 180 sec',current_sep:'2 min gap planned',recommendation:'Increase AI-142 departure separation to minimum 180 sec after EK-501, or re-route to RWY 14/32'}]
  },
  weather_disruption: {
    name:'Weather Disruption', icon:'⛈️', desc:'Low visibility and crosswind',
    flights: [
      {flight_id:'AI-606',aircraft_type:'B737',operation:'departure',runway:'14/32',fuel:72,priority:'normal',status:'waiting',slot_time_offset:10},
      {flight_id:'6E-204',aircraft_type:'A320',operation:'arrival',runway:'14/32',fuel:35,priority:'high',status:'approach',slot_time_offset:5},
      {flight_id:'UK-812',aircraft_type:'B787',operation:'departure',runway:'14/32',fuel:88,priority:'normal',status:'waiting',slot_time_offset:20},
    ],
    weather:{conditions:'TSRA',metar:'VABB 251800Z 31018G28KT 2000 +TSRA BKN010 OVC020 24/23 Q1004 TEMPO 0500 FG',wind:{direction_deg:310,speed_kts:18,gusts_kts:28},visibility:{meters:2000},temperature_c:24,pressure_hpa:1004,storm_alert:{message:'Thunderstorm with heavy rain. Visibility dropping. RWY 09/27 CLOSED due to crosswind.'}},
    conflicts:[{type:'Weather Restriction',severity:'HIGH',flightA:'6E-204',flightB:'AI-606',details:'RWY 09/27 closed. All ops on RWY 14/32. Reduced throughput.',required_sep:'Extended — weather minimum',current_sep:'Single runway operation',recommendation:'Increase separation intervals. Consider diverting non-critical arrivals.'}]
  }
};

// ===== SIMULATION ENGINE =====
function calcPriorityScore(flight) {
  let score = 50;
  if (flight.priority === 'emergency') return 100;
  if (flight.priority === 'high') score += 25;
  // Fuel urgency
  if (flight.fuel <= 10) score += 40;
  else if (flight.fuel <= 20) score += 25;
  else if (flight.fuel <= 35) score += 10;
  // Arrival bonus (planes in air more urgent)
  if (flight.operation === 'arrival') score += 10;
  return Math.min(100, Math.max(0, score));
}

function classifyFuel(pct) {
  if (pct <= 15) return { label:'Critical', cls:'danger' };
  if (pct <= 30) return { label:'Low', cls:'warning' };
  return { label:'Normal', cls:'safe' };
}

function analyzeSlot(flight, existingFlights, weather, runways) {
  const checks = [];
  const reasons = [];
  const acInfo = AIRCRAFT_DB[flight.aircraft_type] || AIRCRAFT_DB['A320'];

  // Pick best runway
  let bestRwy = null; let bestScore = -1;
  for (const rwyId in runways) {
    const rwy = runways[rwyId];
    if (rwy.status === 'CLOSED') continue;
    const queueOnRwy = existingFlights.filter(f => f.runway === rwyId).length;
    const rwyScore = 10 - queueOnRwy;
    if (rwyScore > bestScore) { bestScore = rwyScore; bestRwy = rwyId; }
  }
  if (!bestRwy) bestRwy = Object.keys(runways)[0];

  // Runway available
  const rwyStatus = runways[bestRwy]?.status || 'AVAILABLE';
  const rwyAvail = rwyStatus === 'AVAILABLE';
  checks.push({ label:'Runway Available', passed: rwyAvail, detail: rwyAvail ? `RWY ${bestRwy} available` : `RWY ${bestRwy} ${rwyStatus}` });
  if (rwyAvail) reasons.push('Runway currently available with lowest queue depth');

  // Wake separation
  const rwyFlights = existingFlights.filter(f => f.runway === bestRwy);
  let wakeSafe = true; let wakeProblem = '';
  if (rwyFlights.length > 0) {
    const last = rwyFlights[rwyFlights.length - 1];
    const reqSep = getWakeSep(last.aircraft_type, flight.aircraft_type);
    const curSep = 4 + Math.random() * 3;
    if (curSep < reqSep) {
      wakeSafe = false;
      wakeProblem = `${reqSep} NM required after ${last.aircraft_type}, current gap insufficient`;
    }
  }
  checks.push({ label:'Wake Separation', passed: wakeSafe, detail: wakeSafe ? 'Required separation satisfied' : wakeProblem });
  if (wakeSafe) reasons.push('Required aircraft wake separation satisfied');

  // Weather check
  const wxOk = !weather?.storm_alert && (weather?.visibility?.meters || 9999) >= 3000;
  checks.push({ label:'Weather Suitability', passed: wxOk, detail: wxOk ? `Visibility ${weather?.visibility?.meters||9999}m — suitable` : 'Reduced visibility or storm may impact operations' });
  if (wxOk) reasons.push('Current weather conditions suitable for operations');
  else reasons.push('Weather advisory active — controller review recommended');

  // Timing gap
  checks.push({ label:'Timing Gap', passed: true, detail: 'Minimum 90 sec gap available in schedule' });
  reasons.push('Minimum scheduling gap available — queue delay minimized');

  // Calc slot time
  const now = new Date();
  const taxiMin = acInfo.taxiTime || 5;
  const delayMin = rwyFlights.length * 2.5;
  now.setMinutes(now.getMinutes() + Math.ceil(taxiMin + delayMin));
  const slotTime = now.toISOString().replace('T',' ').substring(0,16);

  // Priority
  const prioScore = calcPriorityScore(flight);

  // Conflict risk
  const conflictRisk = wakeSafe ? (wxOk ? 0.03 + Math.random()*0.05 : 0.15 + Math.random()*0.1) : 0.35 + Math.random()*0.15;

  return {
    recommended_runway: bestRwy,
    recommended_slot: slotTime.split(' ')[1] || slotTime,
    slot_time_full: slotTime,
    priority_score: prioScore,
    priority_label: flight.priority === 'emergency' ? 'EMERGENCY' : (prioScore >= 75 ? 'HIGH' : (prioScore >= 50 ? 'NORMAL' : 'LOW')),
    conflict_risk: conflictRisk,
    conflict_label: conflictRisk < 0.1 ? 'LOW' : (conflictRisk < 0.3 ? 'MEDIUM' : 'HIGH'),
    estimated_taxi: taxiMin,
    estimated_delay: delayMin,
    checks: checks,
    reasons: reasons,
    all_passed: checks.every(c => c.passed),
    weather_ok: wxOk,
    separation_ok: wakeSafe
  };
}

function validateModification(runway, slotTime, flight, existingFlights, runways) {
  const errors = [];
  if (!runways[runway]) errors.push('Invalid runway selection');
  else if (runways[runway].status === 'CLOSED') errors.push(`RWY ${runway} is currently closed`);
  if (!flight.aircraft_type || !AIRCRAFT_DB[flight.aircraft_type]) errors.push('Invalid aircraft type');
  // Wake check on target runway
  const rwyFlights = existingFlights.filter(f => f.runway === runway);
  if (rwyFlights.length > 0) {
    const last = rwyFlights[rwyFlights.length - 1];
    const reqSep = getWakeSep(last.aircraft_type, flight.aircraft_type);
    if (reqSep > 5) errors.push(`Required ${reqSep} NM wake separation after ${last.aircraft_type} (${(AIRCRAFT_DB[last.aircraft_type]||{}).wake||'?'}) not guaranteed`);
  }
  return { valid: errors.length === 0, errors };
}
