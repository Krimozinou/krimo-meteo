// Krimo Météo Algérie
// API gratuite : Open-Meteo

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");
const refreshBtn = document.getElementById("refreshBtn");
const statusBadge = document.getElementById("statusBadge");
const alertBanner = document.getElementById("alertBanner");

// --- Seuils d'alerte (tu peux changer) ---
const ALERTS = {
  gust_kmh: 70,     // rafales
  wind_kmh: 50,     // vent moyen/max
  rain_mm: 20       // pluie/jour
};

function setStatus(type, text) {
  // type: "loading" | "ok" | "error"
  statusBadge.textContent = text;

  if (type === "loading") {
    statusBadge.style.color = "var(--muted)";
  } else if (type === "ok") {
    statusBadge.style.color = "#9CFFB3";
  } else {
    statusBadge.style.color = "#FFD6D6";
  }
}

function showAlert(message) {
  if (!message) {
    alertBanner.classList.add("hidden");
    alertBanner.textContent = "";
    return;
  }
  alertBanner.textContent = message;
  alertBanner.classList.remove("hidden");
}

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

// Format date "YYYY-MM-DD" -> "Ven 13"
function formatDayLabel(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

// Met à jour les cartes Windy (vent/pluie) en fonction de la ville
function updateWindyMaps(city) {
  const windMap = document.getElementById("windyMap");
  const rainMap = document.getElementById("rainMap");
  if (!windMap || !rainMap) return;

  const lat = city.lat;
  const lon = city.lon;

  const base =
    `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}` +
    `&detailLat=${lat}&detailLon=${lon}` +
    `&zoom=7&level=surface&product=ecmwf&metricWind=km%2Fh&metricTemp=%C2%B0C`;

  windMap.src = `${base}&overlay=wind`;
  rainMap.src = `${base}&overlay=rain`;
}

// Remplir la liste des villes
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
  updateWindyMaps(DEFAULT_CITY);
  fetchWeather(DEFAULT_CITY);
}

// Récupérer la météo
async function fetchWeather(city) {
  setStatus("loading", "● Chargement…");
  showAlert(""); // reset alerte
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

    displayForecast(city, data);
    setStatus("ok", "● OK");
  } catch (e) {
    console.error(e);
    setStatus("error", "● Erreur");
    forecastDiv.innerHTML = "Erreur de chargement météo";
    showAlert("⚠️ Impossible de charger les données météo. Réessaie.");
  }
}

// Affichage prévisions + alertes
function displayForecast(city, data) {
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

  // Construire une alerte globale (sur 4 jours)
  let maxGust = 0;
  let maxWind = 0;
  let maxRain = 0;
  let worstDay = null;

  for (let i = 0; i < 4; i++) {
    const gust = data.daily.wind_gusts_10m_max[i] ?? 0;
    const wind = data.daily.wind_speed_10m_max[i] ?? 0;
    const rain = data.daily.precipitation_sum[i] ?? 0;

    if (gust > maxGust) { maxGust = gust; worstDay = data.daily.time[i]; }
    if (wind > maxWind) maxWind = wind;
    if (rain > maxRain) maxRain = rain;
  }

  // Afficher alerte si dépassement
  const alertMsgs = [];
  if (maxGust >= ALERTS.gust_kmh) alertMsgs.push(`🌬️ Rafales fortes (${maxGust} km/h)`);
  if (maxWind >= ALERTS.wind_kmh) alertMsgs.push(`💨 Vent fort (${maxWind} km/h)`);
  if (maxRain >= ALERTS.rain_mm) alertMsgs.push(`🌧️ Pluie marquée (${maxRain} mm)`);

  if (alertMsgs.length > 0) {
    showAlert(`⚠️ ALERTE ${city.name} – ${formatDayLabel(worstDay)} : ${alertMsgs.join(" • ")}`);
  } else {
    showAlert(""); // pas d'alerte
  }

  // Cartes jours
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
      <div class="title">
        <b>${formatDayLabel(day)}</b>
        <span>${day}</span>
      </div>

      <div style="margin-top:8px;font-size:13px;line-height:1.6">
        🌡️ <b>${tMin}°</b> / <b>${tMax}°</b><br>
        💨 Vent : <b>${windMax} km/h</b><br>
        🌬️ Rafales : <b>${gustMax} km/h</b><br>
        💧 Humidité : <b>${hum.avg !== null ? hum.avg.toFixed(0) : "--"} %</b><br>
        🧭 Pression : <b>${pres.avg !== null ? pres.avg.toFixed(0) : "--"} hPa</b><br>
        🌧️ Pluie : <b>${rain} mm</b><br>
        🌅 ${sunrise} | 🌇 ${sunset}
      </div>
    `;

    forecastDiv.appendChild(card);
  }
}

// Events
citySelect.addEventListener("change", e => {
  const city = JSON.parse(e.target.value);
  updateWindyMaps(city);
  fetchWeather(city);
});

refreshBtn.addEventListener("click", () => {
  const city = JSON.parse(citySelect.value);
  updateWindyMaps(city);
  fetchWeather(city);
});

// Initialisation
loadCities();
