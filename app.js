const SUPABASE_URL = "https://txdkcgotbeghwzlhcrzf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_32jx4KbrFRdjkxSRUGN76A_pTrETJx0";
const SITE_BASE_URL = "https://rocketrynorr.github.io/Sorting/";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const state = {
  user: null,
  locations: [],
  items: [],
  loading: true
};

let activeLocationId = "";
let searchTerm = "";

const els = {
  authPanel: document.querySelector("#authPanel"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authMessage: document.querySelector("#authMessage"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
  syncStatus: document.querySelector("#syncStatus"),
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

function setMessage(message) {
  els.authMessage.textContent = message || "";
}

function setSyncStatus(message, online = false) {
  els.syncStatus.textContent = message;
  els.syncStatus.classList.toggle("online", online);
}

function showError(error) {
  if (!error) return;
  setMessage(error.message || "Something went wrong.");
  setSyncStatus("Sync issue");
}

function getLocationItems(locationId) {
  return state.items.filter((item) => item.location_id === locationId);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function setActiveLocation(locationId, updateHash = true) {
  activeLocationId = locationId;
  if (updateHash && locationId) {
    window.location.hash = `location=${encodeURIComponent(locationId)}`;
  }
  render();
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
          body { margin: 0; background: #f2f4ef; color: #11181a; font-family: Arial, Helvetica, sans-serif; }
          .page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
          .label { width: min(700px, 100%); min-height: 320px; display: grid; grid-template-columns: 220px 1fr; gap: 22px; border: 2px solid #11181a; border-radius: 8px; background: white; padding: 22px; }
          .qr { display: grid; gap: 10px; align-content: start; }
          .qr img { width: 200px; height: 200px; border: 1px solid #d8ddd7; }
          .url { overflow-wrap: anywhere; font-size: 11px; color: #485254; }
          .place { margin: 0 0 4px; color: #206f63; font-size: 14px; font-weight: 800; text-transform: uppercase; }
          h1 { margin: 0; font-size: 34px; line-height: 1.05; }
          .count { margin: 12px 0 16px; font-size: 18px; font-weight: 800; }
          h2 { margin: 0 0 8px; font-size: 15px; text-transform: uppercase; }
          ul { margin: 0; padding-left: 20px; }
          li { margin: 5px 0; font-size: 15px; }
          li span { color: #5d686a; font-size: 13px; }
          .more { margin-top: 8px; color: #5d686a; font-weight: 700; }
          .actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
          button { min-height: 42px; border: 1px solid #cfd7d0; border-radius: 6px; background: white; padding: 0 14px; font: inherit; font-weight: 800; cursor: pointer; }
          .print { background: #206f63; color: white; border-color: #206f63; }
          @media print { body { background: white; } .page { display: block; min-height: auto; padding: 0; } .label { width: 100%; border-radius: 0; } .actions { display: none; } }
          @media (max-width: 620px) { .label { grid-template-columns: 1fr; } }
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

async function loadCloudData() {
  if (!state.user) {
    state.locations = [];
    state.items = [];
    state.loading = false;
    render();
    return;
  }

  state.loading = true;
  setSyncStatus("Syncing...");
  render();

  const [{ data: locations, error: locationsError }, { data: items, error: itemsError }] = await Promise.all([
    supabaseClient.from("locations").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("items").select("*").order("created_at", { ascending: false })
  ]);

  if (locationsError || itemsError) {
    showError(locationsError || itemsError);
    state.loading = false;
    render();
    return;
  }

  state.locations = locations || [];
  state.items = items || [];

  const hashLocation = readHashLocation();
  activeLocationId = state.locations.some((location) => location.id === hashLocation)
    ? hashLocation
    : state.locations.some((location) => location.id === activeLocationId)
      ? activeLocationId
      : state.locations[0]?.id || "";

  state.loading = false;
  setSyncStatus("Synced", true);
  render();
}

async function createLocation(name, area) {
  const { data, error } = await supabaseClient
    .from("locations")
    .insert({ name, area, user_id: state.user.id })
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.locations.unshift(data);
  activeLocationId = data.id;
  setSyncStatus("Synced", true);
  setActiveLocation(data.id);
}

async function createItem(location, form) {
  const item = {
    location_id: location.id,
    user_id: state.user.id,
    name: form.querySelector(".item-name").value.trim(),
    quantity: Number(form.querySelector(".item-quantity").value) || 1,
    category: form.querySelector(".item-category").value.trim(),
    notes: form.querySelector(".item-notes").value.trim()
  };

  if (!item.name) return;

  const { data, error } = await supabaseClient
    .from("items")
    .insert(item)
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.items.unshift(data);
  setSyncStatus("Synced", true);
  render();
}

async function deleteItem(itemId) {
  const { error } = await supabaseClient.from("items").delete().eq("id", itemId);

  if (error) {
    showError(error);
    return;
  }

  state.items = state.items.filter((item) => item.id !== itemId);
  setSyncStatus("Synced", true);
  render();
}

async function deleteLocation(location) {
  const confirmed = window.confirm(`Delete ${location.name} and its items?`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from("locations").delete().eq("id", location.id);

  if (error) {
    showError(error);
    return;
  }

  state.locations = state.locations.filter((candidate) => candidate.id !== location.id);
  state.items = state.items.filter((item) => item.location_id !== location.id);
  activeLocationId = state.locations[0]?.id || "";
  setSyncStatus("Synced", true);
  render();
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
  if (state.loading) {
    content.querySelector("h2").textContent = "Loading your storage";
    content.querySelector("p").textContent = "Fetching your synced data.";
  } else if (!state.user) {
    content.querySelector("h2").textContent = "Sign in to start";
    content.querySelector("p").textContent = "Your locations and items will sync after you sign in.";
  }
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
    row.querySelector("button").addEventListener("click", () => deleteItem(item.id));
    itemsList.append(row);
  });

  if (!visibleItems.length) {
    const empty = document.createElement("p");
    empty.className = "item-meta";
    empty.textContent = searchTerm ? "No matching items in this location." : "No items yet.";
    itemsList.append(empty);
  }

  itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createItem(location, itemForm);
  });

  content.querySelector(".label-button").addEventListener("click", () => createLabel(location));
  content.querySelector(".delete-location-button").addEventListener("click", () => deleteLocation(location));

  els.locationDetail.replaceChildren(content);
}

function render() {
  const signedIn = Boolean(state.user);
  els.authPanel.classList.toggle("hidden", signedIn);
  els.signOutButton.classList.toggle("hidden", !signedIn);
  els.locationForm.querySelector("button").disabled = !signedIn;
  els.exportButton.disabled = !signedIn;

  if (!signedIn) {
    setSyncStatus("Sign in");
  }

  renderLocations();
  renderDetail();
}

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Signing in...");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value
  });

  if (error) {
    showError(error);
    return;
  }

  els.authForm.reset();
  setMessage("");
});

els.signUpButton.addEventListener("click", async () => {
  setMessage("Creating account...");
  const { error } = await supabaseClient.auth.signUp({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value
  });

  if (error) {
    showError(error);
    return;
  }

  setMessage("Account created. Check your email if confirmation is enabled, then sign in.");
});

els.signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

els.locationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) return;

  const name = els.locationName.value.trim();
  if (!name) return;

  const area = els.locationArea.value.trim();
  els.locationForm.reset();
  await createLocation(name, area);
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
  const exportData = {
    locations: state.locations,
    items: state.items,
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
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

supabaseClient.auth.onAuthStateChange((_event, session) => {
  state.user = session?.user || null;
  setMessage("");
  loadCloudData();
});

supabaseClient.auth.getSession().then(({ data }) => {
  state.user = data.session?.user || null;
  loadCloudData();
});

render();
