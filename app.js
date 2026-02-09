// Krimo Météo Algérie
// API gratuite : Open-Meteo

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");

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

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,pressure_msl_mean,relative_humidity_2m_mean,sunrise,sunset&timezone=Africa/Algiers`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    displayForecast(data);
  } catch (e) {
    forecastDiv.innerHTML = "Erreur de chargement météo";
  }
}

// Affichage
function displayForecast(data) {
  forecastDiv.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const card = document.createElement("div");
    card.className = "day";

    card.innerHTML = `
      <h3>${data.daily.time[i]}</h3>
      🌡️ ${data.daily.temperature_2m_min[i]}° / ${data.daily.temperature_2m_max[i]}°<br>
      💨 Vent : ${data.daily.windspeed_10m_max[i]} km/h<br>
      💧 Humidité : ${data.daily.relative_humidity_2m_mean[i]} %<br>
      🧭 Pression : ${data.daily.pressure_msl_mean[i]} hPa<br>
      🌅 ${data.daily.sunrise[i].slice(11,16)} |
      🌇 ${data.daily.sunset[i].slice(11,16)}
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
