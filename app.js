// Krimo Météo Algérie — Version B++ (détails ville + alertes 24 villes + points carte)
// API : Open-Meteo (gratuite)

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");

const statusBadge = document.getElementById("statusBadge");
const alertBanner = document.getElementById("alertBanner");
const cityGroupsDiv = document.getElementById("cityGroups");

const dzMapEl = document.getElementById("dzMap");
const dzLegendEl = document.getElementById("dzMapLegend");

// -------------------- Seuils alertes (modifiable) --------------------
const THRESH = {
  gust_orange: 75,
  gust_red: 100,
  wind_orange: 50,
  rain_orange: 25,
  rain_red: 50
};

// -------------------- Helpers UI --------------------
function setStatus(text) {
  if (!statusBadge) return;
  statusBadge.textContent = `● ${text}`;
}

function clearBanner() {
  if (!alertBanner) return;
  alertBanner.classList.add("hidden");
  alertBanner.textContent = "";
  alertBanner.style.borderColor = "";
  alertBanner.style.background = "";
  alertBanner.style.color = "";
}

function showBanner(text, level) {
  if (!alertBanner) return;
  alertBanner.classList.remove("hidden");

  if (level === "red") {
    alertBanner.style.borderColor = "rgba(255,80,80,.55)";
    alertBanner.style.background = "rgba(255,80,80,.18)";
    alertBanner.style.color = "#ffd6d6";
  } else if (level === "orange") {
    alertBanner.style.borderColor = "rgba(255,170,50,.55)";
    alertBanner.style.background = "rgba(255,170,50,.16)";
    alertBanner.style.color = "#ffe7c6";
  } else {
    alertBanner.style.borderColor = "rgba(255,255,255,.16)";
    alertBanner.style.background = "rgba(255,255,255,.06)";
    alertBanner.style.color = "rgba(255,255,255,.9)";
  }

  alertBanner.textContent = text;
}

// -------------------- Helpers data --------------------
function groupHourlyByDay(times, values) {
  const map = new Map();
  for (let i = 0; i < times.length; i++) {
    const day = times[i].slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    const v = values[i];
    if (v !== null && v !== undefined) map.get(day).push(v);
  }
  return map;
}

function summarizeDay(arr) {
  if (!arr || arr.length === 0) return { min: null, max: null, avg: null };
  let min = arr[0], max = arr[0], sum = 0;
  for (const v of arr) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, avg: sum / arr.length };
}

function formatFRDate(yyyy_mm_dd) {
  try {
    const d = new Date(yyyy_mm_dd + "T00:00:00");
    const jours = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const j = jours[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${j} ${dd}/${mm}`;
  } catch {
    return yyyy_mm_dd;
  }
}

// Retourne une alerte journalière {level,label,reason}
function computeDayAlert({ gust, wind, rain }) {
  if (gust !== null && gust >= THRESH.gust_red) {
    return { level: "red", label: "ALERTE VENT VIOLENT", reason: `Rafales ${Math.round(gust)} km/h` };
  }
  if (rain !== null && rain >= THRESH.rain_red) {
    return { level: "red", label: "ALERTE PLUIES FORTES", reason: `Pluie ${Math.round(rain)} mm` };
  }
  if (gust !== null && gust >= THRESH.gust_orange) {
    return { level: "orange", label: "Vigilance vent", reason: `Rafales ${Math.round(gust)} km/h` };
  }
  if (rain !== null && rain >= THRESH.rain_orange) {
    return { level: "orange", label: "Vigilance pluie", reason: `Pluie ${Math.round(rain)} mm` };
  }
  if (wind !== null && wind >= THRESH.wind_orange) {
    return { level: "orange", label: "Vigilance vent", reason: `Vent ${Math.round(wind)} km/h` };
  }
  return null;
}

// -------------------- Villes --------------------
function flattenCities() {
  const all = [];
  for (const g of CITIES) {
    for (const c of g.items) all.push({ ...c, group: g.group });
  }
  return all;
}

// -------------------- API calls --------------------
async function fetchCityDetails(city) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&timezone=auto` +
    `&forecast_days=4` +
    `&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,sunrise,sunset` +
    `&hourly=relative_humidity_2m,surface_pressure`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function fetchCityDailyForAlerts(city) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&timezone=auto` +
    `&forecast_days=4` +
    `&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// Petite limite de concurrence
async function mapWithLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await mapper(items[i], i);
      } catch (e) {
        results[i] = { error: true, item: items[i], message: String(e) };
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// -------------------- ✅ Rendu détails ville (RESTORE joli) --------------------
function renderCityForecast(city, data) {
  forecastDiv.innerHTML = "";

  // ✅ conteneur grid attendu par ton CSS
  const daysWrap = document.createElement("div");
  daysWrap.className = "days";
  forecastDiv.appendChild(daysWrap);

  const humidityByDay = groupHourlyByDay(data.hourly.time, data.hourly.relative_humidity_2m);
  const pressureByDay = groupHourlyByDay(data.hourly.time, data.hourly.surface_pressure);

  const dailyAlerts = [];

  for (let i = 0; i < 4; i++) {
    const day = data.daily.time[i];

    const tMin = data.daily.temperature_2m_min[i];
    const tMax = data.daily.temperature_2m_max[i];

    const windMax = data.daily.wind_speed_10m_max[i];
    const gustMax = data.daily.wind_gusts_10m_max[i];
    const rain = data.daily.precipitation_sum[i];

    const sunrise = data.daily.sunrise[i].slice(11, 16);
    const sunset = data.daily.sunset[i].slice(11, 16);

    const hum = summarizeDay(humidityByDay.get(day));
    const pres = summarizeDay(pressureByDay.get(day));

    const dayAlert = computeDayAlert({ gust: gustMax, wind: windMax, rain });
    if (dayAlert) dailyAlerts.push({ day, ...dayAlert });

    const alertChip = dayAlert
      ? `<div style="
          margin:10px 0 6px 0;
          padding:8px 10px;
          border-radius:12px;
          font-weight:900;
          border:1px solid ${dayAlert.level === "red" ? "rgba(255,80,80,.55)" : "rgba(255,170,50,.55)"};
          background:${dayAlert.level === "red" ? "rgba(255,80,80,.16)" : "rgba(255,170,50,.12)"};
          color:${dayAlert.level === "red" ? "#ffd6d6" : "#ffe7c6"};
        ">
        ${dayAlert.level === "red" ? "🔴" : "🟠"} ${dayAlert.label} — ${dayAlert.reason}
      </div>`
      : "";

    const card = document.createElement("div");
    card.className = "day";
    card.innerHTML = `
      <div class="title">
        <b>${formatFRDate(day)}</b>
        <span>${day}</span>
      </div>
      ${alertChip}
      🌡️ ${tMin}° / ${tMax}°<br>
      💨 Vent : ${Math.round(windMax)} km/h<br>
      🌬️ Rafales : ${Math.round(gustMax)} km/h<br>
      💧 Humidité : ${hum.avg !== null ? hum.avg.toFixed(0) : "--"} %<br>
      🧭 Pression : ${pres.avg !== null ? pres.avg.toFixed(0) : "--"} hPa<br>
      🌧️ Pluie : ${Math.round(rain)} mm<br>
      🌅 ${sunrise} | 🌇 ${sunset}
    `;

    daysWrap.appendChild(card);
  }

  if (dailyAlerts.length > 0) {
    const hasRed = dailyAlerts.some(a => a.level === "red");
    const level = hasRed ? "red" : "orange";
    const lines = dailyAlerts.map(a => `${formatFRDate(a.day)} : ${a.reason}`);
    showBanner(`⚠️ ${hasRed ? "ALERTE" : "VIGILANCE"} — ${city.name} : ${lines.join(" • ")}`, level);
  } else {
    showBanner(`✅ Pas d’alerte importante sur ${city.name} (sur 4 jours).`, "info");
  }
}

// -------------------- Rendu synthèse nationale (RESTORE infos) --------------------
function renderNationalSummary(rows) {
  if (!cityGroupsDiv) return;

  const red = rows.filter(r => r && r.level === "red");
  const orange = rows.filter(r => r && r.level === "orange");
  const ok = rows.filter(r => r && r.level === "ok");

  const block = (title, list, borderColor) => {
    if (list.length === 0) {
      return `
        <div class="kpi" style="margin-top:10px;">
          <div class="t">${title}</div>
          <div class="v">Aucune</div>
        </div>`;
    }

    const items = list
      .sort((a, b) => a.city.name.localeCompare(b.city.name))
      .map(r => `
        <div style="
          margin-top:10px;
          padding:12px 12px;
          border-radius:14px;
          border:1px solid ${borderColor};
          background:rgba(255,255,255,.03);
        ">
          <b style="font-size:16px">${r.city.name}</b>
          <span style="opacity:.75"> (${r.group})</span><br>
          <span style="opacity:.95">${formatFRDate(r.day)} — ${r.reason}</span>
        </div>
      `)
      .join("");

    return `
      <div class="card" style="margin-top:12px;">
        <h2 style="padding:14px 14px 0;">${title} (${list.length})</h2>
        <div class="content">${items}</div>
      </div>
    `;
  };

  cityGroupsDiv.innerHTML = `
    <div class="small" style="margin-top:6px;">
      Synthèse automatique sur 4 jours (24 villes) • Seuils: rafales ${THRESH.gust_orange}/${THRESH.gust_red} km/h • pluie ${THRESH.rain_orange}/${THRESH.rain_red} mm
    </div>
    ${block("🔴 ALERTE ROUGE", red, "rgba(255,80,80,.55)")}
    ${block("🟠 VIGILANCE ORANGE", orange, "rgba(255,170,50,.55)")}
    <div class="small" style="margin-top:10px;opacity:.8;">
      ✅ Villes sans alerte majeure : ${ok.length}
    </div>
  `;
}

// Calcule la “pire” alerte sur 4 jours pour une ville
function computeWorstCityAlert(city, dailyData) {
  const times = dailyData.daily.time;
  const gusts = dailyData.daily.wind_gusts_10m_max;
  const winds = dailyData.daily.wind_speed_10m_max;
  const rains = dailyData.daily.precipitation_sum;

  let worst = null;

  for (let i = 0; i < times.length; i++) {
    const day = times[i];
    const gust = gusts?.[i] ?? null;
    const wind = winds?.[i] ?? null;
    const rain = rains?.[i] ?? null;

    const a = computeDayAlert({ gust, wind, rain });
    if (!a) continue;

    if (!worst) worst = { city, group: city.group, day, ...a };
    else if (a.level === "red" && worst.level !== "red") worst = { city, group: city.group, day, ...a };
  }

  if (!worst) return { city, group: city.group, level: "ok" };
  return worst;
}

// -------------------- ✅ Carte points (FIX BÉTON) --------------------
const DZ_BOUNDS = {
  latMin: 18.9,
  latMax: 37.2,
  lonMin: -8.8,
  lonMax: 12.1
};

function projectToMap(lat, lon, w, h) {
  const x = (lon - DZ_BOUNDS.lonMin) / (DZ_BOUNDS.lonMax - DZ_BOUNDS.lonMin);
  const y = 1 - (lat - DZ_BOUNDS.latMin) / (DZ_BOUNDS.latMax - DZ_BOUNDS.latMin);
  return {
    left: Math.max(0, Math.min(1, x)) * w,
    top: Math.max(0, Math.min(1, y)) * h
  };
}

function renderDZLegend(countOk, countOrange, countRed) {
  if (!dzLegendEl) return;
  dzLegendEl.innerHTML = `
    <span class="dzLegendPill"><span class="dzLegendDot" style="background:rgba(80,200,120,.95)"></span> OK (${countOk})</span>
    <span class="dzLegendPill"><span class="dzLegendDot" style="background:rgba(255,170,50,.95)"></span> Orange (${countOrange})</span>
    <span class="dzLegendPill"><span class="dzLegendDot" style="background:rgba(255,80,80,.95)"></span> Rouge (${countRed})</span>
    <span class="dzLegendPill" style="opacity:.8;">📍 Clique un point pour ouvrir la ville</span>
  `;
}

function renderVigilanceMap(rows) {
  if (!dzMapEl) return;

  // ✅ sécurité: la carte doit être relative
  dzMapEl.style.position = "relative";

  // effacer uniquement les anciens points
  dzMapEl.querySelectorAll(".dzDot").forEach(el => el.remove());

  const w = dzMapEl.clientWidth || 600;
  const h = dzMapEl.clientHeight || 360;

  let countOk = 0, countOrange = 0, countRed = 0;

  rows.forEach(r => {
    if (!r || !r.city) return;

    const { left, top } = projectToMap(r.city.lat, r.city.lon, w, h);

    // ✅ bouton = clic fiable mobile + style en dur (CSS peut être cassé)
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dzDot";
    dot.title = r.city.name;

    const color =
      r.level === "red" ? "#ff4d4d" :
      r.level === "orange" ? "#ffb020" :
      "#39ff88";

    dot.style.cssText = `
      position:absolute;
      left:${left}px;
      top:${top}px;
      width:12px;
      height:12px;
      border-radius:999px;
      border:2px solid rgba(0,0,0,.45);
      background:${color};
      box-shadow:0 0 0 6px rgba(0,0,0,.12);
      transform:translate(-50%,-50%);
      padding:0;
      margin:0;
      cursor:pointer;
      z-index:5;
      outline:none;
      appearance:none;
      -webkit-appearance:none;
    `;

    if (r.level === "red") countRed++;
    else if (r.level === "orange") countOrange++;
    else countOk++;

    dot.addEventListener("click", () => {
      citySelect.value = JSON.stringify(r.city);
      refreshSelectedCity();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    dzMapEl.appendChild(dot);
  });

  renderDZLegend(countOk, countOrange, countRed);
}

// -------------------- National refresh --------------------
async function refreshNationalAlerts() {
  const all = flattenCities();
  if (!cityGroupsDiv) return;

  cityGroupsDiv.innerHTML = `<div class="small">Chargement synthèse nationale (24 villes)…</div>`;

  const results = await mapWithLimit(all, 6, async (c) => {
    const data = await fetchCityDailyForAlerts(c);
    return computeWorstCityAlert(c, data);
  });

  const cleaned = results.filter(r => r && !r.error);

  renderNationalSummary(cleaned);

  // ✅ rendu carte après layout (mobile)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => renderVigilanceMap(cleaned));
  });

  setStatus("OK");
}

// -------------------- Liste villes (select) --------------------
function loadCities() {
  citySelect.innerHTML = "";

  CITIES.forEach(group => {
    const optGroup = document.createElement("optgroup");
    optGroup.label = group.group;

    group.items.forEach(city => {
      const option = document.createElement("option");
      option.value = JSON.stringify(city);
      option.textContent = city.name;
      optGroup.appendChild(option);
    });

    citySelect.appendChild(optGroup);
  });

  citySelect.value = JSON.stringify(DEFAULT_CITY);
}

// -------------------- Actions ville --------------------
async function refreshSelectedCity() {
  const city = JSON.parse(citySelect.value);

  setStatus("Chargement…");
  clearBanner();
  forecastDiv.innerHTML = "Chargement des prévisions…";

  try {
    const data = await fetchCityDetails(city);
    setStatus("OK");
    renderCityForecast(city, data);
  } catch (e) {
    console.error(e);
    setStatus("Erreur");
    forecastDiv.innerHTML = "Erreur de chargement météo";
    showBanner("❌ Impossible de charger la météo. Réessaie.", "red");
  }
}

// -------------------- Events --------------------
citySelect.addEventListener("change", () => {
  refreshSelectedCity();
});

const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    refreshSelectedCity();
    refreshNationalAlerts();
  });
}

// -------------------- Init --------------------
(async function init() {
  loadCities();
  await refreshSelectedCity();
  await refreshNationalAlerts();
})();
