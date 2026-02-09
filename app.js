// Krimo Météo Algérie
// API gratuite : Open-Meteo

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");

const statusBadge = document.getElementById("statusBadge");
const alertBanner = document.getElementById("alertBanner");

// -------------------- Helpers hourly -> daily --------------------
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

// -------------------- Helpers affichage --------------------
function setStatus(text) {
  if (!statusBadge) return;
  statusBadge.textContent = `● ${text}`;
}

function clearBanner() {
  if (!alertBanner) return;
  alertBanner.classList.add("hidden");
  alertBanner.textContent = "";
}

function showBanner(text, level) {
  if (!alertBanner) return;

  alertBanner.classList.remove("hidden");

  // Niveau -> style via inline (simple et fiable sur mobile)
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

// -------------------- Seuils alertes (tu peux changer) --------------------
const THRESH = {
  gust_orange: 75,   // rafales >= 75 → orange
  gust_red: 100,     // rafales >= 100 → rouge
  wind_orange: 50,   // vent moyen max >= 50 → orange
  rain_orange: 25,   // pluie >= 25mm → orange
  rain_red: 50       // pluie >= 50mm → rouge
};

// Retourne { level, label, reason }
function computeDayAlert({ gust, wind, rain }) {
  // Priorité: rafales -> pluie -> vent
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

function formatFRDate(yyyy_mm_dd) {
  // "2026-02-10" -> "Lun 10/02"
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

// -------------------- Remplir la liste des villes --------------------
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
}

// -------------------- Récupérer la météo --------------------
async function fetchWeather(city) {
  setStatus("Chargement…");
  clearBanner();
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

    setStatus("OK");
    displayForecast(data, city);
  } catch (e) {
    console.error(e);
    setStatus("Erreur");
    forecastDiv.innerHTML = "Erreur de chargement météo";
    showBanner("❌ Impossible de charger la météo. Réessaie.", "red");
  }
}

// -------------------- Affichage + alertes --------------------
function displayForecast(data, city) {
  forecastDiv.innerHTML = "";

  // hourly -> map par jour (humid/pression)
  const humidityByDay = groupHourlyByDay(
    data.hourly.time,
    data.hourly.relative_humidity_2m
  );
  const pressureByDay = groupHourlyByDay(
    data.hourly.time,
    data.hourly.surface_pressure
  );

  // On collecte les alertes de chaque jour
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

    // Résumés humidité / pression pour ce jour
    const hum = summarizeDay(humidityByDay.get(day));
    const pres = summarizeDay(pressureByDay.get(day));

    // Calcul alerte du jour
    const dayAlert = computeDayAlert({ gust: gustMax, wind: windMax, rain });
    if (dayAlert) {
      dailyAlerts.push({ day, ...dayAlert });
    }

    // Petit bandeau dans la carte jour
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

    forecastDiv.appendChild(card);
  }

  // Bandeau global (résumé)
  if (dailyAlerts.length > 0) {
    // Si au moins une rouge -> rouge, sinon orange
    const hasRed = dailyAlerts.some(a => a.level === "red");
    const level = hasRed ? "red" : "orange";

    // Texte résumé : "Vendredi: rafales 105 km/h, Samedi: ..."
    const lines = dailyAlerts.map(a => {
      return `${formatFRDate(a.day)} : ${a.reason}`;
    });

    showBanner(
      `⚠️ ${hasRed ? "ALERTE" : "VIGILANCE"} sur ${city.name} — ${lines.join(" • ")}`,
      level
    );
  } else {
    showBanner(`✅ Pas d’alerte importante sur ${city.name} (sur 4 jours).`, "info");
  }
}

// -------------------- Events --------------------
citySelect.addEventListener("change", e => {
  const city = JSON.parse(e.target.value);
  fetchWeather(city);
});

const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    const city = JSON.parse(citySelect.value);
    fetchWeather(city);
  });
}

// Initialisation
loadCities();
