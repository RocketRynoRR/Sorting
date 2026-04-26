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

  content.querySelector(".print-button").addEventListener("click", () => window.print());
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
