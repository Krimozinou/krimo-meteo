// Krimo Météo Algérie
// API gratuite : Open-Meteo

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");

const refreshBtn = document.getElementById("refreshBtn");
const statusBadge = document.getElementById("statusBadge");
const alertBanner = document.getElementById("alertBanner");

// --- Helpers hourly -> daily ---
function groupHourlyByDay(times, values) {
  const map = new Map(); // "YYYY-MM-DD" => [vals]
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

// --- UI helpers ---
function setBadge(text) {
  if (!statusBadge) return;
  statusBadge.textContent = text;
}

function setAlert(text) {
  if (!alertBanner) return;
  if (!text) {
    alertBanner.classList.add("hidden");
    alertBanner.textContent = "";
    return;
  }
  alertBanner.textContent = text;
  alertBanner.classList.remove("hidden");
}

// --- Alertes automatiques (seuils modifiables) ---
function buildAlerts(data) {
  // On prend surtout le 1er jour (jour 0)
  const gust = data.daily?.wind_gusts_10m_max?.[0];
  const rain = data.daily?.precipitation_sum?.[0];

  const alerts = [];

  // Seuils vent (tu peux changer)
  if (gust >= 110) alerts.push(`🚨 VENT VIOLENT : rafales jusqu’à ${Math.round(gust)} km/h`);
  else if (gust >= 90) alerts.push(`⚠️ FORT COUP DE VENT : rafales jusqu’à ${Math.round(gust)} km/h`);
  else if (gust >= 70) alerts.push(`⚠️ VENT FORT : rafales jusqu’à ${Math.round(gust)} km/h`);

  // Seuil pluie (tu peux changer)
  if (rain >= 30) alerts.push(`🚨 PLUIES IMPORTANTES : cumul ~${Math.round(rain)} mm`);
  else if (rain >= 15) alerts.push(`⚠️ PLUIES SOUTENUES : cumul ~${Math.round(rain)} mm`);

  return alerts.join(" • ");
}

// --- Cartes Windy centrées sur la ville ---
function updateMaps(city) {
  const lat = city.lat;
  const lon = city.lon;

  const windMap = document.getElementById("windyMap");
  const rainMap = document.getElementById("rainMap");

  if (windMap) {
    windMap.src =
      `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}` +
      `&detailLat=${lat}&detailLon=${lon}` +
      `&zoom=7&level=surface&overlay=wind&product=ecmwf` +
      `&metricWind=km%2Fh&metricTemp=%C2%B0C`;
  }

  if (rainMap) {
    rainMap.src =
      `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}` +
      `&detailLat=${lat}&detailLon=${lon}` +
      `&zoom=7&level=surface&overlay=rain&product=ecmwf` +
      `&metricWind=km%2Fh&metricTemp=%C2%B0C`;
  }
}

// Remplir la liste des villes
function loadCities() {
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
  fetchWeather(DEFAULT_CITY);
  updateMaps(DEFAULT_CITY);
}

// Récupérer la météo
async function fetchWeather(city) {
  setBadge("● Chargement…");
  setAlert("");
  forecastDiv.innerHTML = "Chargement des prévisions…";

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&timezone=auto` +
    `&forecast_days=4` +
    `&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,sunrise,sunset` +
    `&hourly=relative_humidity_2m,surface_pressure`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    displayForecast(data);
    updateMaps(city);

    const alertText = buildAlerts(data);
    setAlert(alertText);

    setBadge("● OK");
  } catch (e) {
    console.error(e);
    forecastDiv.innerHTML = "❌ Erreur de chargement météo";
    setBadge("● Erreur");
  }
}

// Affichage
function displayForecast(data) {
  forecastDiv.innerHTML = "";

  // hourly -> map par jour
  const humidityByDay = groupHourlyByDay(
    data.hourly.time,
    data.hourly.relative_humidity_2m
  );
  const pressureByDay = groupHourlyByDay(
    data.hourly.time,
    data.hourly.surface_pressure
  );

  for (let i = 0; i < 4; i++) {
    const day = data.daily.time[i];

    const tMin = data.daily.temperature_2m_min[i];
    const tMax = data.daily.temperature_2m_max[i];

    const windMax = data.daily.wind_speed_10m_max[i];
    const gustMax = data.daily.wind_gusts_10m_max[i];

    const rain = data.daily.precipitation_sum[i];

    const sunrise = data.daily.sunrise[i].slice(11, 16);
    const sunset = data.daily.sunset[i].slice(11, 16);

    // Résumés humidité / pression pour ce jour
    const hum = summarizeDay(humidityByDay.get(day));
    const pres = summarizeDay(pressureByDay.get(day));

    const card = document.createElement("div");
    card.className = "day";

    card.innerHTML = `
      <h3>${day}</h3>

      🌡️ <b>${tMin}°</b> / <b>${tMax}°</b><br>
      💨 Vent : <b>${windMax} km/h</b><br>
      🌬️ Rafales : <b>${gustMax} km/h</b><br>

      💧 Humidité : <b>${hum.avg !== null ? hum.avg.toFixed(0) : "--"} %</b><br>
      🧭 Pression : <b>${pres.avg !== null ? pres.avg.toFixed(0) : "--"} hPa</b><br>

      🌧️ Pluie : <b>${rain} mm</b><br>
      🌅 ${sunrise} | 🌇 ${sunset}
    `;

    forecastDiv.appendChild(card);
  }
}

// Changement de ville
citySelect.addEventListener("change", e => {
  const city = JSON.parse(e.target.value);
  fetchWeather(city);
});

// Bouton Actualiser
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    const city = JSON.parse(citySelect.value);
    fetchWeather(city);
  });
}

// Initialisation
loadCities();
