// Krimo Météo Algérie
// API gratuite : Open-Meteo

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");

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
}

// Récupérer la météo
async function fetchWeather(city) {
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
  } catch (e) {
    console.error(e);
    forecastDiv.innerHTML = "Erreur de chargement météo";
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

      🌡️ ${tMin}° / ${tMax}°<br>
      💨 Vent : ${windMax} km/h<br>
      🌬️ Rafales : ${gustMax} km/h<br>

      💧 Humidité : ${hum.avg !== null ? hum.avg.toFixed(0) : "--"} %<br>
      🧭 Pression : ${pres.avg !== null ? pres.avg.toFixed(0) : "--"} hPa<br>

      🌧️ Pluie : ${rain} mm<br>
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

// Initialisation
loadCities();
