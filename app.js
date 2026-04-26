const SUPABASE_URL = "https://txdkcgotbeghwzlhcrzf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_32jx4KbrFRdjkxSRUGN76A_pTrETJx0";
const SITE_BASE_URL = "https://rocketrynorr.github.io/Sorting/";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const state = {
  user: null,
  locations: [],
  items: [],
  places: [],
  categories: [],
  settings: { dark_mode: false },
  loading: true
};

let activeMode = "home";
let activeLocationId = "";
let searchTerm = "";
let draggedItemId = "";
let labelLocationId = "";
let shareTarget = null;

const labelPresets = {
  small: { width: 70, height: 38, qrSize: 24, titleSize: 14, textSize: 8, itemLimit: 3, layout: "side" },
  medium: { width: 100, height: 70, qrSize: 38, titleSize: 24, textSize: 11, itemLimit: 8, layout: "side" },
  large: { width: 160, height: 100, qrSize: 58, titleSize: 34, textSize: 14, itemLimit: 12, layout: "side" }
};

const els = {
  appShell: document.querySelector(".app-shell"),
  dashboard: document.querySelector("#dashboard"),
  accountMenu: document.querySelector("#accountMenu"),
  accountButton: document.querySelector("#accountButton"),
  accountDropdown: document.querySelector("#accountDropdown"),
  authPanel: document.querySelector("#authPanel"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authMessage: document.querySelector("#authMessage"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
  syncStatus: document.querySelector("#syncStatus"),
  exportButton: document.querySelector("#exportButton"),
  searchInput: document.querySelector("#searchInput"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  mobileModeSelect: document.querySelector("#mobileModeSelect"),
  modePanel: document.querySelector("#modePanel"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  summaryLocations: document.querySelector("#summaryLocations"),
  summaryItems: document.querySelector("#summaryItems"),
  summaryPlaces: document.querySelector("#summaryPlaces"),
  labelDesigner: document.querySelector("#labelDesigner"),
  labelDesignerForm: document.querySelector("#labelDesignerForm"),
  closeLabelDesigner: document.querySelector("#closeLabelDesigner"),
  previewLabelButton: document.querySelector("#previewLabelButton"),
  labelPreset: document.querySelector("#labelPreset"),
  labelWidth: document.querySelector("#labelWidth"),
  labelHeight: document.querySelector("#labelHeight"),
  labelQrSize: document.querySelector("#labelQrSize"),
  labelTitleSize: document.querySelector("#labelTitleSize"),
  labelTextSize: document.querySelector("#labelTextSize"),
  labelItemLimit: document.querySelector("#labelItemLimit"),
  labelLayout: document.querySelector("#labelLayout"),
  labelShowPlace: document.querySelector("#labelShowPlace"),
  labelShowCount: document.querySelector("#labelShowCount"),
  labelShowContents: document.querySelector("#labelShowContents"),
  labelShowUrl: document.querySelector("#labelShowUrl"),
  labelPreview: document.querySelector("#labelPreview"),
  shareDialog: document.querySelector("#shareDialog"),
  shareForm: document.querySelector("#shareForm"),
  shareDialogTitle: document.querySelector("#shareDialogTitle"),
  closeShareDialog: document.querySelector("#closeShareDialog"),
  shareEmail: document.querySelector("#shareEmail"),
  shareHelp: document.querySelector("#shareHelp"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
  homeTemplate: document.querySelector("#homeTemplate"),
  locationDetailTemplate: document.querySelector("#locationDetailTemplate")
};

function setMessage(message) {
  if (els.authMessage) {
    els.authMessage.textContent = message || "";
  }
}

function setSyncStatus(message, online = false) {
  if (els.syncStatus) {
    els.syncStatus.textContent = message;
    els.syncStatus.classList.toggle("online", online);
  }
}

function showError(error) {
  if (!error) return;
  setMessage(error.message || "Something went wrong.");
  setSyncStatus("Sync issue");
}

function getAuthCredentials() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;

  if (!email || !password) {
    setMessage("Enter an email and password first.");
    return null;
  }

  if (password.length < 6) {
    setMessage("Password must be at least 6 characters.");
    return null;
  }

  return { email, password };
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

function matchesSearch(location, item = null) {
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

function getVisibleLocations() {
  if (!searchTerm) return state.locations;

  return state.locations.filter((location) => {
    const items = getLocationItems(location.id);
    return matchesSearch(location) || items.some((item) => matchesSearch(location, item));
  });
}

function isOwnRecord(record) {
  return Boolean(record && state.user && record.user_id === state.user.id);
}

function getAccountInitial() {
  const email = state.user?.email || "";
  return email ? email.charAt(0).toUpperCase() : "A";
}

function getPlaceNames() {
  const saved = state.places.map((place) => place.name).filter(Boolean);
  const used = state.locations.map((location) => location.area).filter(Boolean);
  return [...new Set([...saved, ...used])].sort((a, b) => a.localeCompare(b));
}

function getPlaceOptions(selectedPlace = "") {
  const names = getPlaceNames();
  const selected = selectedPlace || names[0] || "";
  const options = names.map((name) => {
    const isSelected = name === selected ? " selected" : "";
    return `<option value="${escapeHtml(name)}"${isSelected}>${escapeHtml(name)}</option>`;
  }).join("");

  return options || `<option value="" disabled selected>Add place tags in Settings</option>`;
}

function getCategoryNames() {
  const saved = state.categories.map((category) => category.name).filter(Boolean);
  const used = state.items.map((item) => item.category).filter(Boolean);
  return [...new Set([...saved, ...used])].sort((a, b) => a.localeCompare(b));
}

function getCategoryOptions(selectedCategory = "") {
  const names = getCategoryNames();
  const selected = selectedCategory || names[0] || "";
  const options = names.map((name) => {
    const isSelected = name === selected ? " selected" : "";
    return `<option value="${escapeHtml(name)}"${isSelected}>${escapeHtml(name)}</option>`;
  }).join("");

  return options || `<option value="" disabled selected>Add category tags in Settings</option>`;
}

function setActiveLocation(locationId, updateHash = true) {
  activeLocationId = locationId;
  if (updateHash && locationId) {
    window.location.hash = `location=${encodeURIComponent(locationId)}`;
  }
  render();
}

function setMode(mode) {
  activeMode = mode;
  if (els.mobileModeSelect) {
    els.mobileModeSelect.value = mode;
  }
  render();
}

function applyTheme() {
  document.body.classList.toggle("dark-mode", Boolean(state.settings.dark_mode));
}

function createNode(tagName, className = "", text = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function getNumberInput(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function getLabelOptions() {
  return {
    width: getNumberInput(els.labelWidth, 100),
    height: getNumberInput(els.labelHeight, 70),
    qrSize: getNumberInput(els.labelQrSize, 38),
    titleSize: getNumberInput(els.labelTitleSize, 24),
    textSize: getNumberInput(els.labelTextSize, 11),
    itemLimit: getNumberInput(els.labelItemLimit, 8),
    layout: els.labelLayout.value,
    showPlace: els.labelShowPlace.checked,
    showCount: els.labelShowCount.checked,
    showContents: els.labelShowContents.checked,
    showUrl: els.labelShowUrl.checked
  };
}

function applyLabelPreset(presetName) {
  const preset = labelPresets[presetName];
  if (!preset) return;

  els.labelWidth.value = preset.width;
  els.labelHeight.value = preset.height;
  els.labelQrSize.value = preset.qrSize;
  els.labelTitleSize.value = preset.titleSize;
  els.labelTextSize.value = preset.textSize;
  els.labelItemLimit.value = preset.itemLimit;
  els.labelLayout.value = preset.layout;
}

function openLabelDesigner(location) {
  if (!els.labelDesigner) {
    createLabel(location);
    return;
  }

  labelLocationId = location.id;
  document.querySelector("#labelDesignerTitle").textContent = `${location.name} Label`;
  els.labelDesigner.classList.remove("hidden");
  renderLabelPreview();
}

function closeLabelDesigner() {
  labelLocationId = "";
  els.labelDesigner.classList.add("hidden");
}

function renderLabelPreview() {
  if (!els.labelPreview || !labelLocationId) return;

  const location = state.locations.find((candidate) => candidate.id === labelLocationId);
  if (!location) return;

  const options = getLabelOptions();
  const items = getLocationItems(location.id);
  const previewItems = options.showContents ? items.slice(0, Math.max(options.itemLimit, 0)) : [];
  const isQrOnly = options.layout === "qr-only";
  const scale = Math.min(1.6, 250 / Math.max(options.width, options.height));
  const label = createNode("div", `preview-label ${options.layout}`);
  label.style.width = `${options.width * scale}px`;
  label.style.minHeight = `${options.height * scale}px`;
  label.style.gridTemplateColumns = options.layout === "side" ? `${options.qrSize * scale}px 1fr` : "";

  const qr = createNode("div", "preview-qr", "QR");
  qr.style.width = `${options.qrSize * scale}px`;
  qr.style.height = `${options.qrSize * scale}px`;
  label.append(qr);

  if (!isQrOnly) {
    const body = createNode("div");
    if (options.showPlace) body.append(createNode("p", "eyebrow", location.area || "Storage"));
    const title = createNode("h3", "", location.name);
    title.style.fontSize = `${Math.max(options.titleSize * 0.8, 10)}px`;
    body.append(title);
    if (options.showCount) body.append(createNode("p", "item-meta", `${items.length} item${items.length === 1 ? "" : "s"}`));
    if (previewItems.length) {
      const list = createNode("ul");
      previewItems.forEach((item) => {
        list.append(createNode("li", "", `${item.name} x${item.quantity}`));
      });
      body.append(list);
    }
    if (options.showUrl) body.append(createNode("p", "item-meta", getLocationUrl(location.id)));
    label.append(body);
  }

  els.labelPreview.replaceChildren(label);
}

function openShareDialog(type, record, title) {
  if (!isOwnRecord(record)) {
    setMessage("You can only share records you own.");
    return;
  }

  shareTarget = { type, record };
  els.shareDialogTitle.textContent = `Share ${title}`;
  els.shareHelp.textContent = "They need to sign into this app with the same email.";
  els.shareEmail.value = "";
  els.shareDialog.classList.remove("hidden");
  els.shareEmail.focus();
}

function closeShareDialog() {
  shareTarget = null;
  els.shareDialog.classList.add("hidden");
}

function createLabel(location, options = getLabelOptions(), autoPrint = false) {
  const items = getLocationItems(location.id);
  const previewItems = options.showContents ? items.slice(0, Math.max(options.itemLimit, 0)) : [];
  const overflowCount = Math.max(items.length - previewItems.length, 0);
  const labelWindow = window.open("", "storageLabel", "width=900,height=700");

  if (!labelWindow) {
    window.alert("Please allow popups so the printable label can open.");
    return;
  }

  const itemRows = previewItems.length
    ? previewItems.map((item) => `<li>${escapeHtml(item.name)} <span>Qty ${escapeHtml(item.quantity)}</span></li>`).join("")
    : "";
  const isQrOnly = options.layout === "qr-only";
  const layoutClass = isQrOnly ? "qr-only" : options.layout;
  const bodyWidth = Math.max(options.width - options.qrSize - 16, 25);
  const placeMarkup = options.showPlace && !isQrOnly ? `<p class="place">${escapeHtml(location.area || "Storage")}</p>` : "";
  const countMarkup = options.showCount && !isQrOnly ? `<p class="count">${items.length} item${items.length === 1 ? "" : "s"}</p>` : "";
  const contentsMarkup = options.showContents && !isQrOnly
    ? `<section class="contents"><h2>Contents</h2>${itemRows ? `<ul>${itemRows}</ul>` : "<p>No items added yet</p>"}${overflowCount > 0 ? `<p class="more">+ ${overflowCount} more item${overflowCount === 1 ? "" : "s"}</p>` : ""}</section>`
    : "";
  const urlMarkup = options.showUrl ? `<div class="url">${escapeHtml(getLocationUrl(location.id))}</div>` : "";

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
          .page { min-height: 100vh; display: grid; place-items: center; padding: 18px; }
          .label { width: ${options.width}mm; min-height: ${options.height}mm; display: grid; gap: 4mm; border: 0.6mm solid #11181a; border-radius: 2mm; background: white; padding: 4mm; overflow: hidden; }
          .label.side { grid-template-columns: ${options.qrSize}mm minmax(${bodyWidth}mm, 1fr); align-items: start; }
          .label.stacked { grid-template-columns: 1fr; justify-items: center; text-align: center; }
          .label.qr-only { grid-template-columns: 1fr; place-items: center; width: ${options.width}mm; min-height: ${options.height}mm; }
          .qr { display: grid; gap: 2mm; align-content: start; justify-items: center; }
          .qr img { width: ${options.qrSize}mm; height: ${options.qrSize}mm; border: 0.25mm solid #d8ddd7; }
          .body { min-width: 0; }
          .url { max-width: 100%; overflow-wrap: anywhere; font-size: ${Math.max(options.textSize - 3, 6)}pt; color: #485254; }
          .place { margin: 0 0 1mm; color: #206f63; font-size: ${Math.max(options.textSize, 7)}pt; font-weight: 800; text-transform: uppercase; }
          h1 { margin: 0; font-size: ${options.titleSize}pt; line-height: 1.05; overflow-wrap: anywhere; }
          .count { margin: 2mm 0 3mm; font-size: ${Math.max(options.textSize + 2, 8)}pt; font-weight: 800; }
          h2 { margin: 0 0 1.5mm; font-size: ${Math.max(options.textSize - 1, 7)}pt; text-transform: uppercase; }
          ul { margin: 0; padding-left: 20px; }
          li, .contents p { margin: 1mm 0; font-size: ${options.textSize}pt; }
          li span { color: #5d686a; font-size: ${Math.max(options.textSize - 1, 7)}pt; }
          .more { margin-top: 1.5mm; color: #5d686a; font-weight: 700; font-size: ${options.textSize}pt; }
          .actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
          button { min-height: 42px; border: 1px solid #cfd7d0; border-radius: 6px; background: white; padding: 0 14px; font: inherit; font-weight: 800; cursor: pointer; }
          .print { background: #206f63; color: white; border-color: #206f63; }
          @page { size: ${options.width}mm ${options.height}mm; margin: 0; }
          @media print { body { background: white; } .page { display: block; min-height: auto; padding: 0; } .label { border-radius: 0; box-shadow: none; } .actions { display: none; } }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="label ${layoutClass}" aria-label="Storage label">
            <div class="qr">
              <img src="${getQrUrl(location.id)}" alt="QR code for ${escapeHtml(location.name)}">
              ${urlMarkup}
            </div>
            ${isQrOnly ? "" : `<div class="body">
              ${placeMarkup}
              <h1>${escapeHtml(location.name)}</h1>
              ${countMarkup}
              ${contentsMarkup}
            </div>`}
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
  if (autoPrint) {
    labelWindow.setTimeout(() => labelWindow.print(), 600);
  }
}

async function loadCloudData() {
  if (!supabaseClient) {
    state.loading = false;
    setMessage("Supabase could not load. Refresh the page or check your connection.");
    setSyncStatus("Sync unavailable");
    render();
    return;
  }

  if (!state.user) {
    state.locations = [];
    state.items = [];
    state.places = [];
    state.categories = [];
    state.settings = { dark_mode: false };
    applyTheme();
    state.loading = false;
    render();
    return;
  }

  state.loading = true;
  setSyncStatus("Syncing...");
  render();

  const [
    { data: locations, error: locationsError },
    { data: items, error: itemsError },
    { data: places, error: placesError },
    { data: categories, error: categoriesError },
    { data: settings, error: settingsError }
  ] = await Promise.all([
    supabaseClient.from("locations").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("items").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("places").select("*").order("name", { ascending: true }),
    supabaseClient.from("categories").select("*").order("name", { ascending: true }),
    supabaseClient.from("user_settings").select("*").eq("user_id", state.user.id).maybeSingle()
  ]);

  if (locationsError || itemsError) {
    showError(locationsError || itemsError);
    state.loading = false;
    render();
    return;
  }

  state.locations = locations || [];
  state.items = items || [];
  state.places = placesError ? [] : places || [];
  state.categories = categoriesError ? [] : categories || [];
  state.settings = settingsError || !settings ? { dark_mode: false } : settings;
  applyTheme();
  if (placesError || categoriesError || settingsError) {
    setMessage("Run the updated Supabase setup SQL to enable tags and settings.");
  } else {
    await createDefaultPlaces();
    await createDefaultCategories();
    await ensureUserSettings();
  }

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
    return null;
  }

  state.locations.unshift(data);
  activeLocationId = data.id;
  setSyncStatus("Synced", true);
  render();
  return data;
}

async function updateLocation(locationId, updates) {
  const { data, error } = await supabaseClient
    .from("locations")
    .update(updates)
    .eq("id", locationId)
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.locations = state.locations.map((location) => location.id === locationId ? data : location);
  setSyncStatus("Synced", true);
  render();
}

async function createPlace(name) {
  const cleanName = name.trim();
  if (!cleanName) return;

  const { data, error } = await supabaseClient
    .from("places")
    .insert({ name: cleanName, user_id: state.user.id })
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.places.push(data);
  state.places.sort((a, b) => a.name.localeCompare(b.name));
  setSyncStatus("Synced", true);
  render();
}

async function createDefaultPlaces() {
  if (!state.user || state.places.length || state.locations.length) return;

  const defaults = ["Home", "Work", "Car"];
  const { data, error } = await supabaseClient
    .from("places")
    .insert(defaults.map((name) => ({ name, user_id: state.user.id })))
    .select();

  if (!error) {
    state.places = data || [];
  }
}

async function ensureUserSettings() {
  if (!state.user || state.settings.user_id) return;

  const { data, error } = await supabaseClient
    .from("user_settings")
    .insert({ user_id: state.user.id, dark_mode: Boolean(state.settings.dark_mode) })
    .select()
    .single();

  if (!error && data) {
    state.settings = data;
    applyTheme();
  }
}

async function updateDarkMode(enabled) {
  state.settings = { ...state.settings, dark_mode: enabled };
  applyTheme();

  const { data, error } = await supabaseClient
    .from("user_settings")
    .upsert({
      user_id: state.user.id,
      dark_mode: enabled,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.settings = data;
  applyTheme();
  setSyncStatus("Synced", true);
  render();
}

async function createCategory(name) {
  const cleanName = name.trim();
  if (!cleanName) return;

  const { data, error } = await supabaseClient
    .from("categories")
    .insert({ name: cleanName, user_id: state.user.id })
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.categories.push(data);
  state.categories.sort((a, b) => a.name.localeCompare(b.name));
  setSyncStatus("Synced", true);
  render();
}

async function createDefaultCategories() {
  if (!state.user || state.categories.length || state.items.length) return;

  const defaults = ["Tools", "Cables", "Documents", "Kitchen", "Camping", "Cleaning", "Electronics", "Clothes"];
  const { data, error } = await supabaseClient
    .from("categories")
    .insert(defaults.map((name) => ({ name, user_id: state.user.id })))
    .select();

  if (!error) {
    state.categories = data || [];
  }
}

async function deleteCategory(category) {
  const used = state.items.some((item) => item.category === category.name);
  const message = used
    ? `${category.name} is used by items. Delete the tag anyway? Existing items keep their current category text.`
    : `Delete ${category.name}?`;
  if (!window.confirm(message)) return;

  const { error } = await supabaseClient.from("categories").delete().eq("id", category.id);

  if (error) {
    showError(error);
    return;
  }

  state.categories = state.categories.filter((candidate) => candidate.id !== category.id);
  setSyncStatus("Synced", true);
  render();
}

async function deletePlace(place) {
  const used = state.locations.some((location) => location.area === place.name);
  const message = used
    ? `${place.name} is used by locations. Delete the tag anyway? Existing locations keep their current place text.`
    : `Delete ${place.name}?`;
  if (!window.confirm(message)) return;

  const { error } = await supabaseClient.from("places").delete().eq("id", place.id);

  if (error) {
    showError(error);
    return;
  }

  state.places = state.places.filter((candidate) => candidate.id !== place.id);
  setSyncStatus("Synced", true);
  render();
}

async function shareRecord(type, record, recipientEmail) {
  const cleanEmail = recipientEmail.trim().toLowerCase();
  if (!cleanEmail || !record || !state.user) return;

  const config = {
    location: { table: "location_shares", idColumn: "location_id" },
    item: { table: "item_shares", idColumn: "item_id" },
    place: { table: "place_shares", idColumn: "place_id" }
  }[type];

  if (!config) return;

  const { error } = await supabaseClient
    .from(config.table)
    .insert({
      owner_id: state.user.id,
      [config.idColumn]: record.id,
      recipient_email: cleanEmail
    });

  if (error) {
    showError(error);
    return;
  }

  setMessage(`Shared with ${cleanEmail}.`);
  setSyncStatus("Shared", true);
  closeShareDialog();
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
  form.reset();
  setSyncStatus("Synced", true);
  render();
}

async function moveItem(itemId, locationId) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item || item.location_id === locationId) return;

  const { data, error } = await supabaseClient
    .from("items")
    .update({ location_id: locationId })
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.items = state.items.map((candidate) => candidate.id === itemId ? data : candidate);
  setSyncStatus("Moved", true);
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

function renderEmptyState() {
  const content = els.emptyStateTemplate.content.cloneNode(true);

  if (state.loading) {
    content.querySelector("h2").textContent = "Loading your storage";
    content.querySelector("p").textContent = "Fetching your synced data.";
  } else if (!state.user) {
    content.querySelector("h2").textContent = "Sign in to start";
    content.querySelector("p").textContent = "Your locations and items will sync after you sign in.";
  }

  els.modePanel.replaceChildren(content);
}

function renderLocationList(container) {
  const visibleLocations = getVisibleLocations();
  container.replaceChildren();

  visibleLocations.forEach((location) => {
    const items = getLocationItems(location.id);
    const button = document.createElement("button");
    button.className = `location-button${location.id === activeLocationId ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span>
        <span class="location-name"></span>
        <span class="location-meta"></span>
        ${isOwnRecord(location) ? "" : `<span class="shared-badge">Shared</span>`}
      </span>
      <strong>${items.length}</strong>
    `;
    button.querySelector(".location-name").textContent = location.name;
    button.querySelector(".location-meta").textContent = location.area || "No area";
    button.addEventListener("click", () => setActiveLocation(location.id));
    container.append(button);
  });
}

function renderLocationDetail(container) {
  const location = getActiveLocation();
  if (!location) {
    const content = els.emptyStateTemplate.content.cloneNode(true);
    container.replaceChildren(content);
    return;
  }

  const content = els.locationDetailTemplate.content.cloneNode(true);
  const area = content.querySelector(".location-area");
  const title = content.querySelector(".location-title");
  const qrImage = content.querySelector(".qr-image");
  const qrUrl = content.querySelector(".qr-url");
  const itemForm = content.querySelector(".item-form");
  const categorySelect = content.querySelector(".item-category");
  const itemsList = content.querySelector(".items-list");
  const itemCount = content.querySelector(".item-count");

  area.textContent = location.area || "Storage location";
  title.textContent = location.name;
  qrImage.src = getQrUrl(location.id);
  qrImage.alt = `QR code for ${location.name}`;
  qrUrl.value = getLocationUrl(location.id);
  categorySelect.innerHTML = getCategoryOptions();
  itemForm.querySelector("button").disabled = !isOwnRecord(location) || !getCategoryNames().length;

  const visibleItems = getLocationItems(location.id).filter((item) => matchesSearch(location, item));
  itemCount.textContent = visibleItems.length;
  content.querySelector(".delete-location-button").disabled = !isOwnRecord(location);

  visibleItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "item-row";
    row.innerHTML = `
      <div>
        <p class="item-name-text"></p>
        <p class="item-meta"></p>
      </div>
      <div class="edit-actions">
        <button class="action-dot" type="button" aria-label="Share item">...</button>
        <button class="danger-button" type="button">Remove</button>
      </div>
    `;
    row.querySelector(".item-name-text").textContent = item.name;
    row.querySelector(".item-meta").textContent = [
      `Qty ${item.quantity}`,
      item.category,
      item.notes
    ].filter(Boolean).join(" - ");
    row.querySelector(".action-dot").addEventListener("click", () => openShareDialog("item", item, item.name));
    row.querySelector(".danger-button").disabled = !isOwnRecord(item);
    row.querySelector(".danger-button").addEventListener("click", () => deleteItem(item.id));
    itemsList.append(row);
  });

  if (!visibleItems.length) {
    const empty = createNode("p", "item-meta", searchTerm ? "No matching items in this location." : "No items yet.");
    itemsList.append(empty);
  }

  itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isOwnRecord(location)) {
      setMessage("Shared locations are view-only.");
      return;
    }
    await createItem(location, itemForm);
  });

  content.querySelector(".share-location-button").addEventListener("click", () => openShareDialog("location", location, location.name));
  content.querySelector(".label-button").addEventListener("click", () => openLabelDesigner(location));
  content.querySelector(".delete-location-button").addEventListener("click", () => deleteLocation(location));

  container.replaceChildren(content);
}

function renderHome() {
  const content = els.homeTemplate.content.cloneNode(true);
  content.querySelector("#locationCount").textContent = getVisibleLocations().length;
  renderLocationList(content.querySelector("#locationList"));
  renderLocationDetail(content.querySelector("#locationDetail"));
  els.modePanel.replaceChildren(content);
}

function renderAddMode() {
  const wrapper = createNode("section", "add-grid");
  const locationPanel = createNode("form", "panel compact-form");
  locationPanel.innerHTML = `
    <h2>Add Location</h2>
    <label>
      Name
      <input class="new-location-name" autocomplete="off" placeholder="Blue tub 03" required>
    </label>
    <label>
      Place
      <select class="new-location-area">${getPlaceOptions()}</select>
    </label>
    <p class="muted-copy">Manage place tags in Settings.</p>
    <button class="primary-button" type="submit">Create Location</button>
  `;
  locationPanel.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = locationPanel.querySelector(".new-location-name").value.trim();
    const area = locationPanel.querySelector(".new-location-area").value.trim();
    if (!name) return;
    locationPanel.reset();
    await createLocation(name, area);
  });

  const itemPanel = createNode("form", "panel item-form");
  const locationOptions = state.locations
    .map((location) => `<option value="${escapeHtml(location.id)}">${escapeHtml(location.area || "Storage")} - ${escapeHtml(location.name)}</option>`)
    .join("");
  itemPanel.innerHTML = `
    <h2>Add Item</h2>
    <label>
      Location
      <select class="item-location" required>${locationOptions}</select>
    </label>
    <div class="item-form-grid">
      <label>
        Item
        <input class="item-name" autocomplete="off" placeholder="Extension cord" required>
      </label>
      <label>
        Qty
        <input class="item-quantity" type="number" min="1" step="1" value="1" required>
      </label>
    </div>
    <label>
      Category
      <select class="item-category" required>${getCategoryOptions()}</select>
    </label>
    <label>
      Notes
      <textarea class="item-notes" rows="3" placeholder="Black cable, 5m"></textarea>
    </label>
    <button class="primary-button" type="submit">Add Item</button>
  `;

  itemPanel.addEventListener("submit", async (event) => {
    event.preventDefault();
    const locationId = itemPanel.querySelector(".item-location").value;
    const location = state.locations.find((candidate) => candidate.id === locationId);
    if (!location) return;
    await createItem(location, itemPanel);
  });

  if (!state.locations.length) {
    itemPanel.querySelector("button").disabled = true;
  }
  if (!getCategoryNames().length) {
    itemPanel.querySelector("button").disabled = true;
  }
  if (!getPlaceNames().length) {
    locationPanel.querySelector("button").disabled = true;
  }

  wrapper.append(locationPanel, itemPanel);
  els.modePanel.replaceChildren(wrapper);
}

function renderEditMode() {
  const wrapper = createNode("section", "edit-grid");
  const visibleLocations = getVisibleLocations();

  visibleLocations.forEach((location) => {
    const form = createNode("form", "panel edit-card");
    form.innerHTML = `
      <div>
        <p class="eyebrow">${escapeHtml(location.area || "Storage")}</p>
        <h2>${escapeHtml(location.name)}</h2>
        ${isOwnRecord(location) ? "" : `<span class="shared-badge">Shared</span>`}
      </div>
      <label>
        Name
        <input class="edit-name" value="${escapeHtml(location.name)}" required>
      </label>
      <label>
        Place
        <select class="edit-area">${getPlaceOptions(location.area || "")}</select>
      </label>
      <div class="edit-actions">
        <button class="primary-button" type="submit">Save</button>
        <button class="action-dot share-button" type="button" aria-label="Share location">...</button>
        <button class="ghost-button label-button" type="button">Label</button>
        <button class="danger-button delete-button" type="button">Delete</button>
      </div>
    `;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!isOwnRecord(location)) {
        setMessage("Shared locations are view-only.");
        return;
      }
      await updateLocation(location.id, {
        name: form.querySelector(".edit-name").value.trim(),
        area: form.querySelector(".edit-area").value.trim()
      });
    });
    form.querySelector(".primary-button").disabled = !isOwnRecord(location);
    form.querySelector(".share-button").addEventListener("click", () => openShareDialog("location", location, location.name));
    form.querySelector(".label-button").addEventListener("click", () => openLabelDesigner(location));
    form.querySelector(".delete-button").disabled = !isOwnRecord(location);
    form.querySelector(".delete-button").addEventListener("click", () => deleteLocation(location));
    wrapper.append(form);
  });

  if (!visibleLocations.length) {
    const empty = createNode("div", "empty-state");
    empty.innerHTML = `<div class="empty-mark">QR</div><h2>No locations to edit</h2><p>Create a location first.</p>`;
    wrapper.append(empty);
  }

  els.modePanel.replaceChildren(wrapper);
}

function renderMoveMode() {
  const board = createNode("section", "move-board");
  const visibleLocations = getVisibleLocations();

  visibleLocations.forEach((location) => {
    const column = createNode("section", "move-location");
    column.dataset.locationId = location.id;
    column.innerHTML = `
      <div class="move-location-header">
        <div>
          <p class="eyebrow">${escapeHtml(location.area || "Storage")}</p>
          <h2 class="move-location-title">${escapeHtml(location.name)}</h2>
        </div>
        <span class="count-pill">${getLocationItems(location.id).length}</span>
      </div>
      <div class="move-items"></div>
    `;

    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      await moveItem(draggedItemId, location.id);
      draggedItemId = "";
    });

    const itemsContainer = column.querySelector(".move-items");
    const items = getLocationItems(location.id).filter((item) => matchesSearch(location, item));

    items.forEach((item) => {
      const card = createNode("article", "move-item");
      card.draggable = true;
      card.dataset.itemId = item.id;
      card.innerHTML = `
        <span class="move-item-name"></span>
        <span class="move-item-meta"></span>
      `;
      card.querySelector(".move-item-name").textContent = item.name;
      card.querySelector(".move-item-meta").textContent = [
        `Qty ${item.quantity}`,
        item.category,
        item.notes
      ].filter(Boolean).join(" - ");
      card.addEventListener("dragstart", (event) => {
        draggedItemId = item.id;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      itemsContainer.append(card);
    });

    if (!items.length) {
      itemsContainer.append(createNode("div", "drop-hint", "Drop items here"));
    }

    board.append(column);
  });

  if (!visibleLocations.length) {
    const empty = createNode("div", "empty-state");
    empty.innerHTML = `<div class="empty-mark">QR</div><h2>No places to sort</h2><p>Add a location before moving items.</p>`;
    board.append(empty);
  }

  els.modePanel.replaceChildren(board);
}

function renderSettingsMode() {
  const wrapper = createNode("section", "add-grid");
  const preferencesPanel = createNode("section", "panel compact-form");
  preferencesPanel.innerHTML = `
    <h2>Preferences</h2>
    <label class="toggle-row">
      <span>
        Dark mode
        <small>Saved to your account</small>
      </span>
      <input class="dark-mode-toggle" type="checkbox"${state.settings.dark_mode ? " checked" : ""}>
    </label>
  `;
  preferencesPanel.querySelector(".dark-mode-toggle").addEventListener("change", (event) => {
    updateDarkMode(event.target.checked);
  });

  const addPanel = createNode("form", "panel compact-form");
  addPanel.innerHTML = `
    <h2>Place Tags</h2>
    <p class="muted-copy">Create reusable place tags like Home, Work, Car, Shed, or Storage Unit.</p>
    <label>
      New tag
      <input class="new-place-name" autocomplete="off" placeholder="Home" required>
    </label>
    <button class="primary-button" type="submit">Add Place Tag</button>
  `;
  addPanel.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = addPanel.querySelector(".new-place-name");
    await createPlace(input.value);
    addPanel.reset();
  });

  const listPanel = createNode("section", "panel");
  listPanel.innerHTML = `
    <div class="section-heading">
      <h2>Saved Tags</h2>
      <span class="count-pill">${state.places.length}</span>
    </div>
    <div class="items-list"></div>
  `;
  const list = listPanel.querySelector(".items-list");

  state.places.forEach((place) => {
    const row = createNode("article", "item-row");
    const usedCount = state.locations.filter((location) => location.area === place.name).length;
    row.innerHTML = `
      <div>
        <p class="item-name-text"></p>
        <p class="item-meta"></p>
      </div>
      <div class="edit-actions">
        <button class="action-dot" type="button" aria-label="Share place">...</button>
        <button class="danger-button" type="button">Remove</button>
      </div>
    `;
    row.querySelector(".item-name-text").textContent = place.name;
    row.querySelector(".item-meta").textContent = `${usedCount} location${usedCount === 1 ? "" : "s"}`;
    row.querySelector(".action-dot").addEventListener("click", () => openShareDialog("place", place, place.name));
    row.querySelector(".action-dot").disabled = !isOwnRecord(place);
    row.querySelector(".danger-button").disabled = !isOwnRecord(place);
    row.querySelector(".danger-button").addEventListener("click", () => deletePlace(place));
    list.append(row);
  });

  if (!state.places.length) {
    list.append(createNode("p", "item-meta", "No place tags yet."));
  }

  const categoryAddPanel = createNode("form", "panel compact-form");
  categoryAddPanel.innerHTML = `
    <h2>Category Tags</h2>
    <p class="muted-copy">Create reusable item categories like Tools, Cables, Documents, or Kitchen.</p>
    <label>
      New category
      <input class="new-category-name" autocomplete="off" placeholder="Tools" required>
    </label>
    <button class="primary-button" type="submit">Add Category Tag</button>
  `;
  categoryAddPanel.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = categoryAddPanel.querySelector(".new-category-name");
    await createCategory(input.value);
    categoryAddPanel.reset();
  });

  const categoryListPanel = createNode("section", "panel");
  categoryListPanel.innerHTML = `
    <div class="section-heading">
      <h2>Saved Categories</h2>
      <span class="count-pill">${state.categories.length}</span>
    </div>
    <div class="items-list"></div>
  `;
  const categoryList = categoryListPanel.querySelector(".items-list");

  state.categories.forEach((category) => {
    const row = createNode("article", "item-row");
    const usedCount = state.items.filter((item) => item.category === category.name).length;
    row.innerHTML = `
      <div>
        <p class="item-name-text"></p>
        <p class="item-meta"></p>
      </div>
      <button class="danger-button" type="button">Remove</button>
    `;
    row.querySelector(".item-name-text").textContent = category.name;
    row.querySelector(".item-meta").textContent = `${usedCount} item${usedCount === 1 ? "" : "s"}`;
    row.querySelector(".danger-button").addEventListener("click", () => deleteCategory(category));
    categoryList.append(row);
  });

  if (!state.categories.length) {
    categoryList.append(createNode("p", "item-meta", "No category tags yet."));
  }

  wrapper.append(preferencesPanel, addPanel, listPanel, categoryAddPanel, categoryListPanel);
  els.modePanel.replaceChildren(wrapper);
}

function renderSharedMode() {
  const wrapper = createNode("section", "edit-grid");
  const sharedLocations = getVisibleLocations().filter((location) => !isOwnRecord(location));

  sharedLocations.forEach((location) => {
    const card = createNode("article", "panel edit-card");
    const items = getLocationItems(location.id);
    card.innerHTML = `
      <div>
        <p class="eyebrow">${escapeHtml(location.area || "Shared")}</p>
        <h2>${escapeHtml(location.name)}</h2>
        <span class="shared-badge">Shared with you</span>
      </div>
      <p class="muted-copy">${items.length} item${items.length === 1 ? "" : "s"}</p>
      <div class="edit-actions">
        <button class="ghost-button open-shared-button" type="button">Open</button>
        <button class="ghost-button label-button" type="button">Label</button>
      </div>
    `;
    card.querySelector(".open-shared-button").addEventListener("click", () => {
      activeMode = "home";
      setActiveLocation(location.id);
    });
    card.querySelector(".label-button").addEventListener("click", () => openLabelDesigner(location));
    wrapper.append(card);
  });

  if (!sharedLocations.length) {
    const empty = createNode("div", "empty-state");
    empty.innerHTML = `<div class="empty-mark">QR</div><h2>No shared locations yet</h2><p>Shared locations appear here after another user shares with your email.</p>`;
    wrapper.append(empty);
  }

  els.modePanel.replaceChildren(wrapper);
}

function renderModePanel() {
  if (state.loading || !state.user) {
    renderEmptyState();
    return;
  }

  if (activeMode === "add") {
    renderAddMode();
    return;
  }

  if (activeMode === "edit") {
    renderEditMode();
    return;
  }

  if (activeMode === "move") {
    renderMoveMode();
    return;
  }

  if (activeMode === "shared") {
    renderSharedMode();
    return;
  }

  if (activeMode === "settings") {
    renderSettingsMode();
    return;
  }

  renderHome();
}

function renderSummary() {
  const places = new Set(state.locations.map((location) => (location.area || "Storage").toLowerCase()));
  els.summaryLocations.textContent = state.locations.length;
  els.summaryItems.textContent = state.items.length;
  els.summaryPlaces.textContent = state.locations.length ? places.size : 0;
}

function render() {
  const signedIn = Boolean(state.user);
  els.appShell.classList.toggle("auth-only", !signedIn);
  els.authPanel.classList.toggle("hidden", signedIn);
  els.dashboard.classList.toggle("hidden", !signedIn);
  els.accountMenu.classList.toggle("hidden", !signedIn);
  els.accountButton.textContent = getAccountInitial();
  els.exportButton.disabled = !signedIn || !supabaseClient;

  els.modeTabs.forEach((tab) => {
    tab.disabled = !supabaseClient;
  });

  if (!signedIn) {
    setSyncStatus(supabaseClient ? "Sign in" : "Sync unavailable");
  }

  els.modeTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === activeMode));
  if (els.mobileModeSelect) {
    els.mobileModeSelect.value = activeMode;
  }
  renderSummary();
  if (signedIn) {
    renderModePanel();
  }
}

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    setMessage("Supabase could not load. Refresh the page and try again.");
    return;
  }

  const credentials = getAuthCredentials();
  if (!credentials) return;

  setMessage("Signing in...");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password
  });

  if (error) {
    showError(error);
    return;
  }

  els.authForm.reset();
  setMessage("");
});

els.signUpButton.addEventListener("click", async () => {
  if (!supabaseClient) {
    setMessage("Supabase could not load. Refresh the page and try again.");
    return;
  }

  const credentials = getAuthCredentials();
  if (!credentials) return;

  setMessage("Creating account...");
  const { data, error } = await supabaseClient.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: SITE_BASE_URL
    }
  });

  if (error) {
    showError(error);
    return;
  }

  setMessage(data.session ? "Account created. You are signed in." : "Account created. Check your email, confirm the account, then sign in.");
});

els.signOutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  els.accountDropdown.classList.add("hidden");
  await supabaseClient.auth.signOut();
});

els.accountButton.addEventListener("click", () => {
  els.accountDropdown.classList.toggle("hidden");
});

els.accountDropdown.querySelector('[data-account-action="settings"]').addEventListener("click", () => {
  els.accountDropdown.classList.add("hidden");
  setMode("settings");
});

document.addEventListener("click", (event) => {
  if (!els.accountMenu.contains(event.target)) {
    els.accountDropdown.classList.add("hidden");
  }
});

els.modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

els.mobileModeSelect?.addEventListener("change", (event) => {
  setMode(event.target.value);
});

if (els.labelPreset) {
els.labelPreset.addEventListener("change", () => {
  applyLabelPreset(els.labelPreset.value);
  renderLabelPreview();
});

  [
    els.labelWidth,
    els.labelHeight,
    els.labelQrSize,
    els.labelTitleSize,
    els.labelTextSize,
    els.labelItemLimit,
    els.labelLayout
  ].filter(Boolean).forEach((control) => {
    control.addEventListener("input", () => {
    if (els.labelPreset.value !== "custom") {
      els.labelPreset.value = "custom";
    }
    renderLabelPreview();
  });
});

[
  els.labelShowPlace,
  els.labelShowCount,
  els.labelShowContents,
  els.labelShowUrl
].filter(Boolean).forEach((control) => {
  control.addEventListener("change", renderLabelPreview);
});
}

els.closeLabelDesigner?.addEventListener("click", closeLabelDesigner);

els.labelDesigner?.addEventListener("click", (event) => {
  if (event.target === els.labelDesigner) {
    closeLabelDesigner();
  }
});

els.previewLabelButton?.addEventListener("click", () => {
  const location = state.locations.find((candidate) => candidate.id === labelLocationId);
  if (location) {
    createLabel(location, getLabelOptions(), false);
  }
});

els.labelDesignerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const location = state.locations.find((candidate) => candidate.id === labelLocationId);
  if (location) {
    createLabel(location, getLabelOptions(), true);
  }
});

els.closeShareDialog.addEventListener("click", closeShareDialog);

els.shareDialog.addEventListener("click", (event) => {
  if (event.target === els.shareDialog) {
    closeShareDialog();
  }
});

els.shareForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!shareTarget) return;
  await shareRecord(shareTarget.type, shareTarget.record, els.shareEmail.value);
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
    activeMode = "home";
    setActiveLocation(locationId, false);
  }
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    setMessage("");
    loadCloudData();
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    state.user = data.session?.user || null;
    loadCloudData();
  });
} else {
  state.loading = false;
  setMessage("Supabase could not load. Refresh the page or check your connection.");
  setSyncStatus("Sync unavailable");
}

render();
