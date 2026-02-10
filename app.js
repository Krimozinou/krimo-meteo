// ===== Krimo Météo Algérie — FIX STABLE =====

const citySelect = document.getElementById("citySelect");
const forecastDiv = document.getElementById("forecast");
const statusBadge = document.getElementById("statusBadge");
const alertBanner = document.getElementById("alertBanner");
const cityGroupsDiv = document.getElementById("cityGroups");

function getMapEl() {
  return document.getElementById("vigilanceMap") || document.getElementById("dzMap");
}

const THRESH = {
  gust_orange: 75,
  gust_red: 100,
  wind_orange: 50,
  rain_orange: 25,
  rain_red: 50
};

function setStatus(t){ if(statusBadge) statusBadge.textContent="● "+t }
function clearBanner(){ if(alertBanner){alertBanner.classList.add("hidden");alertBanner.textContent=""} }
function showBanner(t){ if(alertBanner){alertBanner.textContent=t;alertBanner.classList.remove("hidden")} }

function computeDayAlert({gust,wind,rain}){
  if(gust>=THRESH.gust_red) return {level:"red",reason:`Rafales ${Math.round(gust)} km/h`}
  if(gust>=THRESH.gust_orange) return {level:"orange",reason:`Rafales ${Math.round(gust)} km/h`}
  return null
}

function flattenCities(){
  return CITIES.flatMap(g=>g.items.map(c=>({...c,group:g.group})))
}

// ================= PRÉVISIONS JOURS =================
async function fetchCityDetails(city){
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&timezone=auto&forecast_days=4&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,sunrise,sunset`)
  return r.json()
}

function renderCityForecast(city,data){
  forecastDiv.innerHTML = `<div class="days"></div>`;
  const daysWrap = forecastDiv.querySelector(".days");

  for(let i=0;i<4;i++){
    const gust=data.daily.wind_gusts_10m_max[i];
    const alert=computeDayAlert({gust});

    const d=document.createElement("div");
    d.className="day";
    d.innerHTML=`
      <b>${data.daily.time[i]}</b><br>
      🌡️ ${data.daily.temperature_2m_min[i]}° / ${data.daily.temperature_2m_max[i]}°<br>
      💨 Vent ${data.daily.wind_speed_10m_max[i]} km/h<br>
      🌬️ Rafales ${gust} km/h<br>
      🌧️ Pluie ${data.daily.precipitation_sum[i]} mm
    `;
    if(alert){
      d.style.border="1px solid orange";
    }
    daysWrap.appendChild(d);
  }
}

// ================= CARTE POINTS =================
const DZ_BOUNDS={latMin:19,latMax:37,lonMin:-9,lonMax:12};

function project(lat,lon,w,h){
  return{
    x:(lon-DZ_BOUNDS.lonMin)/(DZ_BOUNDS.lonMax-DZ_BOUNDS.lonMin)*w,
    y:(1-(lat-DZ_BOUNDS.latMin)/(DZ_BOUNDS.latMax-DZ_BOUNDS.latMin))*h
  }
}

async function refreshNationalAlerts(){
  const map=getMapEl();
  if(!map) return;

  map.innerHTML="";
  map.style.position="relative";

  const all=flattenCities();
  for(const c of all){
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&daily=wind_gusts_10m_max&forecast_days=1&timezone=auto`)
    const d=await r.json();
    const gust=d.daily.wind_gusts_10m_max[0];

    const dot=document.createElement("div");
    dot.style.position="absolute";
    dot.style.zIndex="10";
    dot.style.width="12px";
    dot.style.height="12px";
    dot.style.borderRadius="50%";
    dot.style.background=gust>=100?"red":gust>=75?"orange":"lime";

    const p=project(c.lat,c.lon,map.clientWidth,map.clientHeight);
    dot.style.left=p.x+"px";
    dot.style.top=p.y+"px";

    map.appendChild(dot);
  }
}

// ================= INIT =================
async function refreshSelectedCity(){
  const city=JSON.parse(citySelect.value);
  setStatus("Chargement…");
  clearBanner();
  const data=await fetchCityDetails(city);
  renderCityForecast(city,data);
  setStatus("OK");
}

document.getElementById("refreshBtn").onclick=()=>{
  refreshSelectedCity();
  refreshNationalAlerts();
}

(function init(){
  CITIES.forEach(g=>{
    const og=document.createElement("optgroup");
    og.label=g.group;
    g.items.forEach(c=>{
      const o=document.createElement("option");
      o.value=JSON.stringify(c);
      o.textContent=c.name;
      og.appendChild(o);
    });
    citySelect.appendChild(og);
  });
  citySelect.value=JSON.stringify(DEFAULT_CITY);
  refreshSelectedCity();
  refreshNationalAlerts();
})();
