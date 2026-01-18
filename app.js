const CITY_COORDS = {
  Chandigarh: { lat: 30.7333, lon: 76.7794 },
  Kasauli: { lat: 30.898, lon: 76.964 },
  Shimla: { lat: 31.1048, lon: 77.1734 },
  Solan: { lat: 30.908, lon: 77.101 },
  Kiratpur: { lat: 31.021, lon: 76.571 },
  NerChowk: { lat: 31.6, lon: 76.9 },
  Bhuntar: { lat: 31.88, lon: 77.15 },
  Kullu: { lat: 31.957, lon: 77.109 },
  Manali: { lat: 32.2432, lon: 77.1892 },
  Kasol: { lat: 32.01, lon: 77.315 },
  Dharamshala: { lat: 32.219, lon: 76.323 },
  Dalhousie: { lat: 32.537, lon: 75.971 },
  Mandi: { lat: 31.708, lon: 76.932 },
  Kaza: { lat: 32.225, lon: 78.07 }
};

const GRAPH = {
  Chandigarh: {
    Kiratpur: { km: 80, min: 110 },
    Solan: { km: 45, min: 80 },
    Kasauli: { km: 55, min: 90 },
    Dharamshala: { km: 240, min: 420 },
    Dalhousie: { km: 315, min: 520 }
  },
  Kiratpur: {
    NerChowk: { km: 130, min: 180 }
  },
  NerChowk: {
    Mandi: { km: 10, min: 20 },
    Bhuntar: { km: 70, min: 110 }
  },
  Mandi: {
    Kullu: { km: 50, min: 90 }
  },
  Bhuntar: {
    Kullu: { km: 10, min: 20 },
    Kasol: { km: 32, min: 70 }
  },
  Kullu: {
    Manali: { km: 40, min: 80 }
  },
  Solan: {
    Shimla: { km: 45, min: 100 }
  },
  Shimla: {
    Kullu: { km: 210, min: 420 }
  },
  Manali: {
    Kaza: { km: 180, min: 480 }
  },
  Kasol: {},
  Dharamshala: {},
  Dalhousie: {},
  Kaza: {}
};

function neighbors(node) {
  return GRAPH[node] ? Object.entries(GRAPH[node]) : [];
}

function dijkstra(start, goal, weightKey = "min") {
  const dist = new Map();
  const prev = new Map();
  const pq = new Map();
  Object.keys(GRAPH).forEach(n => {
    dist.set(n, Infinity);
    prev.set(n, null);
  });
  dist.set(start, 0);
  pq.set(start, 0);

  while (pq.size) {
    let u = null, best = Infinity;
    for (const [k, v] of pq) {
      if (v < best) {
        best = v;
        u = k;
      }
    }
    pq.delete(u);
    if (u === goal) break;

    for (const [v, edge] of neighbors(u)) {
      const w = edge[weightKey];
      const alt = dist.get(u) + w;
      if (alt < dist.get(v)) {
        dist.set(v, alt);
        prev.set(v, u);
        pq.set(v, alt);
      }
    }
  }

  const path = [];
  let cur = goal;
  if (!prev.has(cur) && cur !== start) return { path: [], cost: Infinity };
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return { path, cost: dist.get(goal) };
}

function pathDistance(path) {
  let km = 0, min = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const edge = GRAPH[a][b];
    if (edge) {
      km += edge.km;
      min += edge.min;
    }
  }
  return { km, min };
}

function kmToFuelCost(km, mileage, fuelPrice) {
  if (mileage <= 0) return 0;
  const liters = km / mileage;
  return liters * fuelPrice;
}

async function getWeatherFor(city) {
  const c = CITY_COORDS[city] || CITY_COORDS["Manali"];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
    "&current=temperature_2m,precipitation,wind_speed_10m" +
    "&hourly=temperature_2m,precipitation_probability&timezone=auto";
  const res = await fetch(url);
  const data = await res.json();
  const cur = data.current || {};
  return {
    temperature: cur.temperature_2m,
    wind: cur.wind_speed_10m,
    precipitation: cur.precipitation
  };
}

function formatTime(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function formatINR(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function preferFastestPath(start, dest) {
  const fastest = dijkstra(start, dest, "min");

  let shimlaForced = null;
  if (start === "Chandigarh" && (dest === "Manali" || dest === "Kullu")) {
    const toShimla = dijkstra("Chandigarh", "Shimla", "min");
    const shimlaToDest = dijkstra("Shimla", dest, "min");
    if (toShimla.path.length && shimlaToDest.path.length) {
      const forcedPath = [...toShimla.path, ...shimlaToDest.path.slice(1)];
      const cost = pathDistance(forcedPath).min;
      shimlaForced = { path: forcedPath, cost };
    }
  }

  return { fastest, shimlaForced };
}

function buildItinerary(path) {
  const steps = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const e = GRAPH[a][b];
    steps.push({ from: a, to: b, km: e.km, min: e.min });
  }
  return steps;
}

async function plan() {
  const dest = document.getElementById("destination").value;
  const people = +document.getElementById("people").value || 1;
  const days = +document.getElementById("days").value || 1;
  const mileage = +document.getElementById("mileage").value || 15;
  const fuelPrice = +document.getElementById("fuelPrice").value || 100;
  const tolls = +document.getElementById("tolls").value || 0;
  const stayPerDay = +document.getElementById("stayPerDay").value || 1000;
  const preferFastest = document.getElementById("preferFastest").checked;

  const start = "Chandigarh";
  const { fastest, shimlaForced } = preferFastestPath(start, dest);

  let chosen = fastest;
  if (!preferFastest && shimlaForced) {
    chosen = shimlaForced;
  } else if (shimlaForced && shimlaForced.cost < fastest.cost) {
    chosen = shimlaForced;
  }

  if (!chosen.path.length) {
    document.getElementById("route").innerText =
      "No route found in the current graph.";
    return;
  }

  const distTime = pathDistance(chosen.path);
  const fuelCost = kmToFuelCost(distTime.km * 2, mileage, fuelPrice);
  const stayCost = days * people * stayPerDay;
  const totalBudget = fuelCost + tolls + stayCost;

  document.getElementById("route").innerHTML = `
    <div class="text-sm text-indigo-200/80">Route</div>
    <div class="mt-1 code text-lg">${chosen.path.join(" → ")}</div>
    ${
      shimlaForced
        ? `<div class="mt-2 text-xs text-indigo-200/70">Comparison: Shimla route total time ${formatTime(
            shimlaForced.cost
          )} vs fastest ${formatTime(fastest.cost)}</div>`
        : ""
    }
  `;

  document.getElementById("distance").innerText =
    `${Math.round(distTime.km)} km (one-way)`;
  document.getElementById("time").innerText =
    `${formatTime(distTime.min)} (one-way)`;
  document.getElementById("budget").innerText =
    `${formatINR(totalBudget)} (round trip + stay)`;

  const steps = buildItinerary(chosen.path);
  const it = document.getElementById("itinerary");
  it.innerHTML = "";
  steps.forEach(s => {
    const li = document.createElement("li");
    li.className = "text-indigo-100/90";
    li.textContent = `${s.from} → ${s.to}: ${s.km} km, ${formatTime(s.min)}`;
    it.appendChild(li);
  });

  const w = document.getElementById("weather");
  w.innerHTML = '<div class="text-indigo-200/70">Loading weather…</div>';
  try {
    const wx = await getWeatherFor(dest === "Spiti" ? "Kaza" : dest);
    w.innerHTML = `
      <div class="glass rounded-xl p-4">
        <div class="text-sm text-indigo-200/70">Temperature now</div>
        <div class="text-2xl font-bold">${wx.temperature ?? "-"}°C</div>
      </div>
      <div class="glass rounded-xl p-4">
        <div class="text-sm text-indigo-200/70">Wind speed</div>
        <div class="text-2xl font-bold">${wx.wind ?? "-"} m/s</div>
      </div>
      <div class="glass rounded-xl p-4">
        <div class="text-sm text-indigo-200/70">Precipitation</div>
        <div class="text-2xl font-bold">${wx.precipitation ?? "-"} mm</div>
      </div>
    `;
  } catch (e) {
    w.innerHTML = '<div class="text-red-300">Failed to load weather.</div>';
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("planner-form")
    .addEventListener("submit", e => {
      e.preventDefault();
      plan();
    });
  plan();
});
