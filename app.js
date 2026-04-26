const STORAGE_KEY = "homeQrStorage.v1";
const SITE_BASE_URL = "https://rocketrynorr.github.io/Sorting/";

const state = loadState();
let activeLocationId = "";
let searchTerm = "";

const els = {
  locationForm: document.querySelector("#locationForm"),
  locationName: document.querySelector("#locationName"),
  locationArea: document.querySelector("#locationArea"),
  locationList: document.querySelector("#locationList"),
  locationCount: document.querySelector("#locationCount"),
  locationDetail: document.querySelector("#locationDetail"),
  searchInput: document.querySelector("#searchInput"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  exportButton: document.querySelector("#exportButton"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
  locationDetailTemplate: document.querySelector("#locationDetailTemplate")
};

function loadState() {
  const fallback = { locations: [], items: [] };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.locations) || !Array.isArray(saved.items)) {
      return fallback;
    }
    return saved;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLocationItems(locationId) {
  return state.items.filter((item) => item.locationId === locationId);
}

function getActiveLocation() {
  return state.locations.find((location) => location.id === activeLocationId) || state.locations[0];
}

function getLocationUrl(locationId) {
  return `${SITE_BASE_URL}#location=${encodeURIComponent(locationId)}`;
}

function getQrUrl(locationId) {
  const data = encodeURIComponent(getLocationUrl(locationId));
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${data}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createLabel(location) {
  const items = getLocationItems(location.id);
  const previewItems = items.slice(0, 8);
  const overflowCount = Math.max(items.length - previewItems.length, 0);
  const labelWindow = window.open("", "storageLabel", "width=760,height=520");

  if (!labelWindow) {
    window.alert("Please allow popups so the printable label can open.");
    return;
  }

  const itemRows = previewItems.length
    ? previewItems.map((item) => `<li>${escapeHtml(item.name)} <span>Qty ${escapeHtml(item.quantity)}</span></li>`).join("")
    : "<li>No items added yet</li>";

  labelWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(location.name)} Label</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f2f4ef;
            color: #11181a;
            font-family: Arial, Helvetica, sans-serif;
          }
          .page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
          }
          .label {
            width: min(700px, 100%);
            min-height: 320px;
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: 22px;
            border: 2px solid #11181a;
            border-radius: 8px;
            background: white;
            padding: 22px;
          }
          .qr {
            display: grid;
            gap: 10px;
            align-content: start;
          }
          .qr img {
            width: 200px;
            height: 200px;
            border: 1px solid #d8ddd7;
          }
          .url {
            overflow-wrap: anywhere;
            font-size: 11px;
            color: #485254;
          }
          .place {
            margin: 0 0 4px;
            color: #206f63;
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
          }
          h1 {
            margin: 0;
            font-size: 34px;
            line-height: 1.05;
          }
          .count {
            margin: 12px 0 16px;
            font-size: 18px;
            font-weight: 800;
          }
          h2 {
            margin: 0 0 8px;
            font-size: 15px;
            text-transform: uppercase;
          }
          ul {
            margin: 0;
            padding-left: 20px;
          }
          li {
            margin: 5px 0;
            font-size: 15px;
          }
          li span {
            color: #5d686a;
            font-size: 13px;
          }
          .more {
            margin-top: 8px;
            color: #5d686a;
            font-weight: 700;
          }
          .actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 18px;
          }
          button {
            min-height: 42px;
            border: 1px solid #cfd7d0;
            border-radius: 6px;
            background: white;
            padding: 0 14px;
            font: inherit;
            font-weight: 800;
            cursor: pointer;
          }
          .print {
            background: #206f63;
            color: white;
            border-color: #206f63;
          }
          @media print {
            body { background: white; }
            .page { display: block; min-height: auto; padding: 0; }
            .label { width: 100%; border-radius: 0; }
            .actions { display: none; }
          }
          @media (max-width: 620px) {
            .label { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="label" aria-label="Storage label">
            <div class="qr">
              <img src="${getQrUrl(location.id)}" alt="QR code for ${escapeHtml(location.name)}">
              <div class="url">${escapeHtml(getLocationUrl(location.id))}</div>
            </div>
            <div>
              <p class="place">${escapeHtml(location.area || "Storage")}</p>
              <h1>${escapeHtml(location.name)}</h1>
              <p class="count">${items.length} item${items.length === 1 ? "" : "s"}</p>
              <h2>Contents</h2>
              <ul>${itemRows}</ul>
              ${overflowCount ? `<p class="more">+ ${overflowCount} more item${overflowCount === 1 ? "" : "s"}</p>` : ""}
            </div>
          </section>
          <div class="actions">
            <button class="print" onclick="window.print()">Print Label</button>
            <button onclick="window.close()">Close</button>
          </div>
        </main>
      </body>
    </html>
  `);

  labelWindow.document.close();
}

function readHashLocation() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("location") || "";
}

function setActiveLocation(locationId, updateHash = true) {
  activeLocationId = locationId;
  if (updateHash && locationId) {
    window.location.hash = `location=${encodeURIComponent(locationId)}`;
  }
  render();
}

function matchesSearch(location, item) {
  if (!searchTerm) return true;

  const haystack = [
    location.name,
    location.area,
    item?.name,
    item?.category,
    item?.notes,
    item?.quantity
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm.toLowerCase());
}

function renderLocations() {
  els.locationList.replaceChildren();
  els.locationCount.textContent = state.locations.length;

  state.locations.forEach((location) => {
    const items = getLocationItems(location.id);
    const button = document.createElement("button");
    button.className = `location-button${location.id === activeLocationId ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span>
        <span class="location-name"></span>
        <span class="location-meta"></span>
      </span>
      <strong>${items.length}</strong>
    `;
    button.querySelector(".location-name").textContent = location.name;
    button.querySelector(".location-meta").textContent = location.area || "No area";
    button.addEventListener("click", () => setActiveLocation(location.id));
    els.locationList.append(button);
  });
}

function renderEmptyState() {
  const content = els.emptyStateTemplate.content.cloneNode(true);
  els.locationDetail.replaceChildren(content);
}

function renderDetail() {
  const location = getActiveLocation();
  if (!location) {
    activeLocationId = "";
    renderEmptyState();
    return;
  }

  if (!activeLocationId) {
    activeLocationId = location.id;
  }

  const content = els.locationDetailTemplate.content.cloneNode(true);
  const area = content.querySelector(".location-area");
  const title = content.querySelector(".location-title");
  const qrImage = content.querySelector(".qr-image");
  const qrUrl = content.querySelector(".qr-url");
  const itemForm = content.querySelector(".item-form");
  const itemsList = content.querySelector(".items-list");
  const itemCount = content.querySelector(".item-count");

  area.textContent = location.area || "Storage location";
  title.textContent = location.name;
  qrImage.src = getQrUrl(location.id);
  qrImage.alt = `QR code for ${location.name}`;
  qrUrl.value = getLocationUrl(location.id);

  const visibleItems = getLocationItems(location.id).filter((item) => matchesSearch(location, item));
  itemCount.textContent = visibleItems.length;

  visibleItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "item-row";
    row.innerHTML = `
      <div>
        <p class="item-name-text"></p>
        <p class="item-meta"></p>
      </div>
      <button class="danger-button" type="button">Remove</button>
    `;
    row.querySelector(".item-name-text").textContent = item.name;
    row.querySelector(".item-meta").textContent = [
      `Qty ${item.quantity}`,
      item.category,
      item.notes
    ].filter(Boolean).join(" - ");
    row.querySelector("button").addEventListener("click", () => {
      const index = state.items.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) {
        state.items.splice(index, 1);
        saveState();
        render();
      }
    });
    itemsList.append(row);
  });

  if (!visibleItems.length) {
    const empty = document.createElement("p");
    empty.className = "item-meta";
    empty.textContent = searchTerm ? "No matching items in this location." : "No items yet.";
    itemsList.append(empty);
  }

  itemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const item = {
      id: createId("item"),
      locationId: location.id,
      name: itemForm.querySelector(".item-name").value.trim(),
      quantity: Number(itemForm.querySelector(".item-quantity").value) || 1,
      category: itemForm.querySelector(".item-category").value.trim(),
      notes: itemForm.querySelector(".item-notes").value.trim(),
      createdAt: new Date().toISOString()
    };

    if (!item.name) return;
    state.items.unshift(item);
    saveState();
    render();
  });

  content.querySelector(".label-button").addEventListener("click", () => createLabel(location));
  content.querySelector(".delete-location-button").addEventListener("click", () => {
    const confirmed = window.confirm(`Delete ${location.name} and its items?`);
    if (!confirmed) return;

    state.locations = state.locations.filter((candidate) => candidate.id !== location.id);
    state.items = state.items.filter((item) => item.locationId !== location.id);
    activeLocationId = state.locations[0]?.id || "";
    saveState();
    render();
  });

  els.locationDetail.replaceChildren(content);
}

function render() {
  renderLocations();
  renderDetail();
}

els.locationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.locationName.value.trim();
  if (!name) return;

  const location = {
    id: createId("loc"),
    name,
    area: els.locationArea.value.trim(),
    createdAt: new Date().toISOString()
  };

  state.locations.unshift(location);
  activeLocationId = location.id;
  els.locationForm.reset();
  saveState();
  setActiveLocation(location.id);
});

els.searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim();
  render();
});

els.clearSearchButton.addEventListener("click", () => {
  searchTerm = "";
  els.searchInput.value = "";
  render();
});

els.exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `home-qr-storage-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("hashchange", () => {
  const locationId = readHashLocation();
  if (locationId && state.locations.some((location) => location.id === locationId)) {
    setActiveLocation(locationId, false);
  }
});

const hashLocation = readHashLocation();
activeLocationId = state.locations.some((location) => location.id === hashLocation)
  ? hashLocation
  : state.locations[0]?.id || "";

render();
