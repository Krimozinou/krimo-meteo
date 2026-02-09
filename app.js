// Krimo Météo Algérie — Version B+ (icônes météo + carte Algérie + mode alerte majeure)
// API : Open-Meteo (gratuite)

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");

const statusBadge = document.getElementById("statusBadge");
const alertBanner = document.getElementById("alertBanner");
const cityGroupsDiv = document.getElementById("cityGroups"); // Synthèse nationale
const dzMap = document.getElementById("dzMap");
const dzMapLegend = document.getElementById("dzMapLegend");

let NATIONAL_HAS_RED = false;

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

function setMajorAlertMode(on) {
  document.body.classList.toggle("major-alert", !!on);
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

// -------------------- Icônes météo (Open-Meteo weather_code) --------------------
function weatherIcon(code) {
  // source logique Open-Meteo (wmo)
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";

  if (code === 45 || code === 48) return "🌫️";

  if (code === 51 || code === 53 || code === 55) return "🌦️";
  if (code === 56 || code === 57) return "🌧️";

  if (code === 61 || code === 63 || code === 65) return "🌧️";
  if (code === 66 || code === 67) return "🌧️";

  if (code === 71 || code === 73 || code === 75) return "❄️";
  if (code === 77) return "🌨️";

  if (code === 80 || code === 81 || code === 82) return "🌧️";

  if (code === 85 || code === 86) return "🌨️";

  if (code === 95) return "⛈️";
  if (code === 96 || code === 99) return "⛈️";

  return "🌡️";
}

function weatherLabel(code) {
  if (code === 0) return "Ciel dégagé";
  if (code === 1) return "Peu nuageux";
  if (code === 2) return "Partiellement nuageux";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brouillard";
  if (code === 51 || code === 53 || code === 55) return "Bruine";
  if (code === 56 || code === 57) return "Bruine verglaçante";
  if (code === 61 || code === 63 || code === 65) return "Pluie";
  if (code === 66 || code === 67) return "Pluie verglaçante";
  if (code === 71 || code === 73 || code === 75) return "Neige";
  if (code === 77) return "Grains de neige";
  if (code === 80 || code === 81 || code === 82) return "Averses";
  if (code === 85 || code === 86) return "Averses de neige";
  if (code === 95) return "Orage";
  if (code === 96 || code === 99) return "Orage fort";
  return "Conditions variables";
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
// 1) Détails ville (daily + hourly)
async function fetchCityDetails(city) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&timezone=auto` +
    `&forecast_days=4` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,sunrise,sunset` +
    `&hourly=relative_humidity_2m,surface_pressure`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// 2) Alerte nationale (daily seulement = plus léger)
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

// Petite limite de concurrence (pour éviter 24 fetch en même temps)
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

// -------------------- Rendu détails ville --------------------
function renderCityForecast(city, data) {
  forecastDiv.innerHTML = "";

  const humidityByDay = groupHourlyByDay(
    data.hourly.time,
    data.hourly.relative_humidity_2m
  );
  const pressureByDay = groupHourlyByDay(
    data.hourly.time,
    data.hourly.surface_pressure
  );

  const dailyAlerts = [];
  let hasRedForSelected = false;

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

    const code = data.daily.weather_code?.[i];
    const icon = weatherIcon(code);
    const label = weatherLabel(code);

    const dayAlert = computeDayAlert({ gust: gustMax, wind: windMax, rain });
    if (dayAlert) {
      dailyAlerts.push({ day, ...dayAlert });
      if (dayAlert.level === "red") hasRedForSelected = true;
    }

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
        <b>${formatFRDate(day)} • ${icon} ${label}</b>
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
    forecastDiv.appendChild(card);
  }

  // Bandeau résumé (ville sélectionnée)
  if (dailyAlerts.length > 0) {
    const hasRed = dailyAlerts.some(a => a.level === "red");
    const level = hasRed ? "red" : "orange";
    const lines = dailyAlerts.map(a => `${formatFRDate(a.day)} : ${a.reason}`);
    showBanner(
      `⚠️ ${hasRed ? "ALERTE" : "VIGILANCE"} — ${city.name} : ${lines.join(" • ")}`,
      level
    );
  } else {
    showBanner(`✅ Pas d’alerte importante sur ${city.name} (sur 4 jours).`, "info");
  }

  // MODE ALERTE MAJEURE = rouge (ville OU national)
  setMajorAlertMode(hasRedForSelected || NATIONAL_HAS_RED);
}

// -------------------- Rendu synthèse nationale (24 villes) --------------------
function renderNationalSummary(rows) {
  if (!cityGroupsDiv) return;

  const red = rows.filter(r => r && r.level === "red");
  const orange = rows.filter(r => r && r.level === "orange");
  const ok = rows.filter(r => r && r.level === "ok");

  const htmlBlock = (title, list, color) => {
    if (list.length === 0) {
      return `
        <div class="kpi" style="margin-top:10px;">
          <div class="t">${title}</div>
          <div class="v">Aucune</div>
        </div>`;
    }

    const items = list
      .sort((a,b) => a.city.name.localeCompare(b.city.name))
      .map(r => `
        <div style="
          margin-top:10px;
          padding:10px 12px;
          border-radius:14px;
          border:1px solid ${color};
          background:rgba(255,255,255,.03);
        ">
          <b>${r.city.name}</b> <span style="opacity:.75">(${r.group})</span><br>
          <span style="opacity:.9">${formatFRDate(r.day)} — ${r.reason}</span>
        </div>
      `).join("");

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
    ${htmlBlock("🔴 ALERTE ROUGE", red, "rgba(255,80,80,.55)")}
    ${htmlBlock("🟠 VIGILANCE ORANGE", orange, "rgba(255,170,50,.55)")}
    <div class="small" style="margin-top:10px;opacity:.8;">
      Villes sans alerte majeure : ${ok.length}
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

    // Priorité rouge > orange
    if (!worst) worst = { city, group: city.group, day, ...a };
    else if (a.level === "red" && worst.level !== "red") worst = { city, group: city.group, day, ...a };
  }

  if (!worst) return { city, group: city.group, level: "ok" };
  return worst;
}

// -------------------- Carte Algérie (points cliquables) --------------------
function selectCityByName(name) {
  // sélectionner l'option qui a le bon texte
  for (const opt of citySelect.querySelectorAll("option")) {
    if (opt.textContent === name) {
      citySelect.value = opt.value;
      return true;
    }
  }
  return false;
}

function renderDzMap(rows) {
  if (!dzMap) return;

  const allCities = flattenCities();

  // map name -> level
  const levelByName = new Map();
  for (const r of rows) {
    if (!r || !r.city) continue;
    levelByName.set(r.city.name, r.level || "ok");
  }

  // bounds (sur les 24 villes sélectionnées)
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const c of allCities) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLon = Math.min(minLon, c.lon);
    maxLon = Math.max(maxLon, c.lon);
  }

  dzMap.querySelectorAll(".dzDot").forEach(n => n.remove());

  let countRed = 0, countOrange = 0, countOk = 0;

  for (const c of allCities) {
    const level = levelByName.get(c.name) || "ok";
    if (level === "red") countRed++;
    else if (level === "orange") countOrange++;
    else countOk++;

    const x = (c.lon - minLon) / (maxLon - minLon || 1);
    const y = (maxLat - c.lat) / (maxLat - minLat || 1);

    const dot = document.createElement("div");
    dot.className = `dzDot ${level}`;
    dot.style.left = `${x * 100}%`;
    dot.style.top = `${y * 100}%`;
    dot.title = `${c.name} — ${level === "red" ? "ALERTE ROUGE" : level === "orange" ? "VIGILANCE ORANGE" : "OK"}`;

    dot.addEventListener("click", () => {
      const okSel = selectCityByName(c.name);
      if (okSel) refreshSelectedCity();
    });

    dzMap.appendChild(dot);
  }

  if (dzMapLegend) {
    dzMapLegend.innerHTML = `
      <span class="dzLegendPill"><span class="dzLegendDot" style="background:rgba(80,200,120,.95)"></span> OK (${countOk})</span>
      <span class="dzLegendPill"><span class="dzLegendDot" style="background:rgba(255,170,50,.95)"></span> Orange (${countOrange})</span>
      <span class="dzLegendPill"><span class="dzLegendDot" style="background:rgba(255,80,80,.95)"></span> Rouge (${countRed})</span>
      <span class="dzLegendPill">📍 Clique un point pour ouvrir la ville</span>
    `;
  }
}

async function refreshNationalAlerts() {
  const all = flattenCities();
  if (!cityGroupsDiv) return;

  cityGroupsDiv.innerHTML = `<div class="small">Chargement synthèse nationale (24 villes)…</div>`;

  // 24 requêtes daily légères, limit 6 en parallèle
  const results = await mapWithLimit(all, 6, async (c) => {
    const data = await fetchCityDailyForAlerts(c);
    return computeWorstCityAlert(c, data);
  });

  const cleaned = results.filter(r => r && !r.error).map(r => r);

  // national red ?
  NATIONAL_HAS_RED = cleaned.some(r => r.level === "red");

  renderNationalSummary(cleaned);
  renderDzMap(cleaned);

  // Mode alerte majeure si rouge au niveau national
  // (si la ville sélectionnée est ok, ça reste major si national rouge)
  setMajorAlertMode(NATIONAL_HAS_RED);
}

// -------------------- Remplir liste ville --------------------
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

// -------------------- Actions (ville sélectionnée) --------------------
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
    setMajorAlertMode(true);
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
