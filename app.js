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
let searchOpen = false;
const expandedLocationIds = new Set();

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
  searchToggleButton: document.querySelector("#searchToggleButton"),
  searchInput: document.querySelector("#searchInput"),
  searchToolbar: document.querySelector("#searchToolbar"),
  searchResults: document.querySelector("#searchResults"),
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
  labelScale: document.querySelector("#labelScale"),
  labelLayout: document.querySelector("#labelLayout"),
  labelAlignX: document.querySelector("#labelAlignX"),
  labelAlignY: document.querySelector("#labelAlignY"),
  labelShowPlace: document.querySelector("#labelShowPlace"),
  labelShowParent: document.querySelector("#labelShowParent"),
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

function getChildLocations(locationId) {
  return state.locations.filter((location) => location.parent_location_id === locationId);
}

function getActiveLocation() {
  return state.locations.find((location) => location.id === activeLocationId) || state.locations[0];
}

function getLocationById(locationId) {
  return state.locations.find((location) => location.id === locationId) || null;
}

function getLocationPath(location) {
  const names = [location.name];
  let parent = getLocationById(location.parent_location_id);
  const seen = new Set([location.id]);

  while (parent && !seen.has(parent.id)) {
    names.unshift(parent.name);
    seen.add(parent.id);
    parent = getLocationById(parent.parent_location_id);
  }

  return names.join(" > ");
}

function getLocationDepth(location) {
  let depth = 0;
  let parent = getLocationById(location.parent_location_id);
  const seen = new Set([location.id]);

  while (parent && !seen.has(parent.id)) {
    depth += 1;
    seen.add(parent.id);
    parent = getLocationById(parent.parent_location_id);
  }

  return depth;
}

function sortLocationsByName(locations) {
  return [...locations].sort((a, b) => {
    const areaCompare = (a.area || "").localeCompare(b.area || "");
    if (areaCompare) return areaCompare;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function getLocationTreeOptions(parentId = null, selectedId = "", excludedId = "", depth = 0) {
  return sortLocationsByName(
    state.locations.filter((location) => (location.parent_location_id || null) === parentId)
  )
    .filter((location) => location.id !== excludedId && !isDescendantLocation(location.id, excludedId))
    .map((location) => {
      const selected = location.id === selectedId ? " selected" : "";
      const prefix = depth ? `${"--".repeat(depth)} ` : "";
      const label = `${prefix}${location.name}${location.area ? ` (${location.area})` : ""}`;
      return [
        `<option value="${escapeHtml(location.id)}"${selected}>${escapeHtml(label)}</option>`,
        getLocationTreeOptions(location.id, selectedId, excludedId, depth + 1)
      ].join("");
    })
    .join("");
}

function getLocationAncestors(location) {
  const ancestors = [];
  let parent = getLocationById(location?.parent_location_id);
  const seen = new Set([location?.id].filter(Boolean));

  while (parent && !seen.has(parent.id)) {
    ancestors.unshift(parent);
    seen.add(parent.id);
    parent = getLocationById(parent.parent_location_id);
  }

  return ancestors;
}

function getOrderedLocations(parentId = null, depth = 0) {
  return sortLocationsByName(
    state.locations.filter((location) => (location.parent_location_id || null) === parentId)
  ).flatMap((location) => [
    { location, depth },
    ...getOrderedLocations(location.id, depth + 1)
  ]);
}

function getLocationDisplayPlace(location) {
  let current = location;
  const seen = new Set();

  while (current && !seen.has(current.id)) {
    if (current.area) return current.area;
    seen.add(current.id);
    current = getLocationById(current.parent_location_id);
  }

  return "No place";
}

function getPlaceHierarchyRows(placeName, visibleIdSet, searchActive) {
  const belongsToPlace = (location) => getLocationDisplayPlace(location) === placeName;
  const rows = [];

  const addBranch = (location, depth) => {
    if (!searchActive && depth > 0 && !expandedLocationIds.has(location.parent_location_id)) return;
    if (searchActive && !visibleIdSet.has(location.id)) return;
    rows.push({ location, depth });
    sortLocationsByName(getChildLocations(location.id).filter(belongsToPlace))
      .forEach((child) => addBranch(child, depth + 1));
  };

  sortLocationsByName(state.locations.filter((location) => {
    if (!belongsToPlace(location)) return false;
    const parent = getLocationById(location.parent_location_id);
    return !parent || !belongsToPlace(parent);
  })).forEach((location) => addBranch(location, 0));

  return rows;
}

function getLocationOptions(selectedId = "", excludedId = "") {
  const options = getLocationTreeOptions(null, selectedId, excludedId);

  return `<option value="">Top-level location</option>${options}`;
}

function isDescendantLocation(locationId, possibleAncestorId) {
  if (!locationId || !possibleAncestorId) return false;

  let current = getLocationById(locationId);
  const seen = new Set();

  while (current && !seen.has(current.id)) {
    if (current.parent_location_id === possibleAncestorId) return true;
    seen.add(current.id);
    current = getLocationById(current.parent_location_id);
  }

  return false;
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

function normalizeLocationSections(value) {
  const entries = Array.isArray(value)
    ? value
    : String(value || "").split(/\r?\n|,/);
  const seen = new Set();

  return entries
    .map((entry) => normalizeTagName(entry))
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getLocationSections(location) {
  return normalizeLocationSections(location?.sections || []);
}

function getSectionOptions(location, selectedSection = "") {
  const sections = getLocationSections(location);
  if (!sections.length) return "";

  return [
    `<option value="">Whole location</option>`,
    ...sections.map((section) => {
      const selected = section === selectedSection ? " selected" : "";
      return `<option value="${escapeHtml(section)}"${selected}>${escapeHtml(section)}</option>`;
    })
  ].join("");
}

function setupSectionPicker(form, location) {
  const field = form.querySelector(".item-section-field");
  const select = form.querySelector(".item-section");
  if (!field || !select) return;

  const options = getSectionOptions(location);
  field.classList.toggle("hidden", !options);
  select.innerHTML = options;
}

function matchesSearch(location, item = null) {
  if (!searchTerm) return true;

  const haystack = [
    location.name,
    location.area,
    ...getLocationSections(location),
    item?.name,
    item?.category,
    item?.section,
    item?.notes,
    item?.quantity
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm.toLowerCase());
}

function renderGlobalSearchResults() {
  if (!els.searchResults) return;

  const term = searchTerm.trim().toLowerCase();
  els.searchResults.classList.toggle("hidden", !term || !state.user);
  els.searchResults.replaceChildren();
  if (!term || !state.user) return;

  const locations = state.locations
    .filter((location) => matchesSearch(location))
    .slice(0, 6);
  const items = state.items
    .filter((item) => {
      const location = getLocationById(item.location_id);
      return location && matchesSearch(location, item);
    })
    .slice(0, 8);
  const categories = getCategoryNames()
    .filter((name) => name.toLowerCase().includes(term))
    .slice(0, 6);
  const total = locations.length + items.length + categories.length;

  if (!total) {
    els.searchResults.append(createNode("p", "item-meta", "No matching items, locations, or categories."));
    return;
  }

  const addResult = (label, meta, onClick) => {
    const button = document.createElement("button");
    button.className = "search-result";
    button.type = "button";
    button.innerHTML = `<span></span><small></small>`;
    button.querySelector("span").textContent = label;
    button.querySelector("small").textContent = meta;
    button.addEventListener("click", onClick);
    els.searchResults.append(button);
  };

  locations.forEach((location) => {
    addResult(getLocationPath(location), `Location - ${location.area || "Storage"}`, () => {
      activeMode = "home";
      setActiveLocation(location.id);
    });
  });

  items.forEach((item) => {
    const location = getLocationById(item.location_id);
    addResult(item.name, [
      "Item",
      item.category,
      location ? getLocationPath(location) : "",
      item.section ? `Section: ${item.section}` : ""
    ].filter(Boolean).join(" - "), () => {
      activeMode = "home";
      setActiveLocation(item.location_id);
    });
  });

  categories.forEach((category) => {
    addResult(category, "Category tag", () => {
      activeMode = "settings";
      render();
    });
  });
}

function getSearchMatches(limitResults = true) {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return { locations: [], items: [], categories: [] };

  const locations = state.locations.filter((location) => matchesSearch(location));
  const items = state.items.filter((item) => {
    const location = getLocationById(item.location_id);
    return location && matchesSearch(location, item);
  });
  const categories = getCategoryNames().filter((name) => name.toLowerCase().includes(term));

  return {
    locations: limitResults ? locations.slice(0, 8) : locations,
    items: limitResults ? items.slice(0, 12) : items,
    categories: limitResults ? categories.slice(0, 8) : categories
  };
}

function addSearchResult(container, label, meta, onClick) {
  const button = document.createElement("button");
  button.className = "search-result";
  button.type = "button";
  button.innerHTML = `<span></span><small></small>`;
  button.querySelector("span").textContent = label;
  button.querySelector("small").textContent = meta;
  button.addEventListener("click", onClick);
  container.append(button);
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

  return `${options}<option value="__new__">Add new category...</option>` || `<option value="__new__">Add new category...</option>`;
}

function setupCategoryPicker(form) {
  const select = form.querySelector(".item-category");
  const newCategoryField = form.querySelector(".new-category-field");
  const newCategoryInput = form.querySelector(".new-category-name");
  if (!select || !newCategoryField || !newCategoryInput) return;

  const update = () => {
    const addingNew = select.value === "__new__";
    newCategoryField.classList.toggle("hidden", !addingNew);
    newCategoryInput.required = addingNew;
    if (addingNew) {
      newCategoryInput.focus();
    } else {
      newCategoryInput.value = "";
    }
  };

  select.addEventListener("change", update);
  update();
}

function normalizeTagName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function setActiveLocation(locationId, updateHash = true) {
  activeLocationId = locationId;
  const location = getLocationById(locationId);
  getLocationAncestors(location).forEach((ancestor) => expandedLocationIds.add(ancestor.id));
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function imageInputToData(input) {
  const file = input?.files?.[0];
  if (!file) return "";

  const dataUrl = await readFileAsDataUrl(file);
  return await compressImageDataUrl(dataUrl);
}

function compressImageDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 900;
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function getNumberInput(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function getLabelOptions() {
  updateLabelControlLimits();
  const width = clamp(getNumberInput(els.labelWidth, 100), 50, 200);
  const height = clamp(getNumberInput(els.labelHeight, 70), 30, 140);
  const limits = getLabelLimits(width, height);
  return {
    width,
    height,
    qrSize: clamp(getNumberInput(els.labelQrSize, 38), 18, limits.maxQr),
    titleSize: clamp(getNumberInput(els.labelTitleSize, 24), 10, limits.maxTitle),
    textSize: clamp(getNumberInput(els.labelTextSize, 11), 7, limits.maxText),
    itemLimit: clamp(getNumberInput(els.labelItemLimit, 8), 0, limits.maxItems),
    scale: clamp(getNumberInput(els.labelScale, 100), 60, 100),
    layout: els.labelLayout.value,
    alignX: els.labelAlignX.value,
    alignY: els.labelAlignY.value,
    showPlace: els.labelShowPlace.checked,
    showParent: els.labelShowParent.checked,
    showCount: els.labelShowCount.checked,
    showContents: els.labelShowContents.checked,
    showUrl: els.labelShowUrl.checked
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getLabelLimits(width, height) {
  return {
    maxQr: Math.max(18, Math.min(width, height) - 12),
    maxTitle: Math.max(12, Math.min(42, Math.floor(height * 0.7))),
    maxText: Math.max(8, Math.min(18, Math.floor(height * 0.28))),
    maxItems: Math.max(0, Math.min(12, Math.floor((height - 25) / 7)))
  };
}

function updateLabelControlLimits() {
  if (!els.labelWidth) return;

  const width = clamp(getNumberInput(els.labelWidth, 100), 50, 200);
  const height = clamp(getNumberInput(els.labelHeight, 70), 30, 140);
  const limits = getLabelLimits(width, height);

  els.labelQrSize.max = limits.maxQr;
  els.labelTitleSize.max = limits.maxTitle;
  els.labelTextSize.max = limits.maxText;
  els.labelItemLimit.max = limits.maxItems;
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
  els.labelScale.value = 100;
  els.labelLayout.value = preset.layout;
  els.labelAlignX.value = "center";
  els.labelAlignY.value = "center";
  updateLabelControlLimits();
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
  const overflowCount = Math.max(items.length - previewItems.length, 0);
  const isQrOnly = options.layout === "qr-only";
  const parent = getLocationById(location.parent_location_id);
  const labelScale = options.scale / 100;
  const labelWidth = options.width * labelScale;
  const labelHeight = options.height * labelScale;
  const scaledQr = options.qrSize * labelScale;
  const scaledTitle = options.titleSize * labelScale;
  const scaledText = options.textSize * labelScale;
  const bodyWidth = Math.max(labelWidth - scaledQr - 16 * labelScale, 20);
  const pxPerMm = 3.78;
  const previewScale = Math.min(1.4, 310 / Math.max(options.width * pxPerMm, options.height * pxPerMm));
  const previewBox = createNode("div", "preview-scale-box");
  const page = createNode("div", "preview-page");
  const label = createNode("div", `preview-label ${options.layout}`);

  previewBox.style.width = `${options.width * pxPerMm * previewScale}px`;
  previewBox.style.height = `${options.height * pxPerMm * previewScale}px`;
  page.style.width = `${options.width}mm`;
  page.style.height = `${options.height}mm`;
  page.style.justifyItems = options.alignX;
  page.style.alignItems = options.alignY;
  page.style.transform = `scale(${previewScale})`;
  page.style.transformOrigin = "top left";

  label.style.width = `${labelWidth}mm`;
  label.style.height = `${labelHeight}mm`;
  label.style.gap = `${3 * labelScale}mm`;
  label.style.borderWidth = `${0.6 * labelScale}mm`;
  label.style.borderRadius = `${2 * labelScale}mm`;
  label.style.padding = `${3 * labelScale}mm`;
  label.style.gridTemplateColumns = options.layout === "side" ? `${scaledQr}mm minmax(${bodyWidth}mm, 1fr)` : "";

  const qr = createNode("div", "preview-qr");
  qr.style.gap = `${2 * labelScale}mm`;
  const qrImage = document.createElement("img");
  qrImage.src = getQrUrl(location.id);
  qrImage.alt = `QR code for ${location.name}`;
  qrImage.style.width = `${scaledQr}mm`;
  qrImage.style.height = `${scaledQr}mm`;
  qrImage.style.borderWidth = `${0.25 * labelScale}mm`;
  qr.append(qrImage);
  if (options.showUrl) {
    const url = createNode("div", "preview-url", getLocationUrl(location.id));
    url.style.fontSize = `${Math.max(scaledText - 3, 5)}pt`;
    qr.append(url);
  }
  label.append(qr);

  if (!isQrOnly) {
    const body = createNode("div", "preview-body");
    if (options.showPlace) {
      const place = createNode("p", "preview-place", location.area || "Storage");
      place.style.marginBottom = `${1 * labelScale}mm`;
      place.style.fontSize = `${Math.max(scaledText, 6)}pt`;
      body.append(place);
    }
    if (options.showParent && parent) {
      const parentLine = createNode("p", "preview-parent", `Parent Location: ${getLocationPath(parent)}`);
      parentLine.style.marginBottom = `${1 * labelScale}mm`;
      parentLine.style.fontSize = `${Math.max(scaledText, 6)}pt`;
      body.append(parentLine);
    }
    const title = createNode("h3", "", location.name);
    title.style.fontSize = `${scaledTitle}pt`;
    body.append(title);
    if (options.showCount) {
      const count = createNode("p", "preview-count", `${items.length} item${items.length === 1 ? "" : "s"}`);
      count.style.margin = `${2 * labelScale}mm 0 ${3 * labelScale}mm`;
      count.style.fontSize = `${Math.max(scaledText + 2, 7)}pt`;
      body.append(count);
    }
    if (options.showContents) {
      const contents = createNode("section", "preview-contents");
      const heading = createNode("h4", "", "Contents");
      heading.style.marginBottom = `${1.5 * labelScale}mm`;
      heading.style.fontSize = `${Math.max(scaledText - 1, 6)}pt`;
      contents.append(heading);
      if (previewItems.length) {
        const list = createNode("ul");
        list.style.paddingLeft = `${20 * labelScale}px`;
        contents.append(list);
        previewItems.forEach((item) => {
          const itemName = item.section ? `${item.section}: ${item.name}` : item.name;
          const row = document.createElement("li");
          row.style.margin = `${1 * labelScale}mm 0`;
          row.style.fontSize = `${scaledText}pt`;
          row.innerHTML = `${escapeHtml(itemName)} <span>Qty ${escapeHtml(item.quantity)}</span>`;
          row.querySelector("span").style.fontSize = `${Math.max(scaledText - 1, 6)}pt`;
          list.append(row);
        });
      } else {
        const empty = createNode("p", "", "No items added yet");
        empty.style.fontSize = `${scaledText}pt`;
        contents.append(empty);
      }
      if (overflowCount > 0) {
        const more = createNode("p", "preview-more", `+ ${overflowCount} more item${overflowCount === 1 ? "" : "s"}`);
        more.style.marginTop = `${1.5 * labelScale}mm`;
        more.style.fontSize = `${scaledText}pt`;
        contents.append(more);
      }
      body.append(contents);
    }
    label.append(body);
  }

  page.append(label);
  previewBox.append(page);
  els.labelPreview.replaceChildren(previewBox);
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
    ? previewItems.map((item) => `<li>${escapeHtml(item.section ? `${item.section}: ${item.name}` : item.name)} <span>Qty ${escapeHtml(item.quantity)}</span></li>`).join("")
    : "";
  const isQrOnly = options.layout === "qr-only";
  const parent = getLocationById(location.parent_location_id);
  const layoutClass = isQrOnly ? "qr-only" : options.layout;
  const labelScale = options.scale / 100;
  const labelWidth = options.width * labelScale;
  const labelHeight = options.height * labelScale;
  const scaledQr = options.qrSize * labelScale;
  const scaledTitle = options.titleSize * labelScale;
  const scaledText = options.textSize * labelScale;
  const bodyWidth = Math.max(labelWidth - scaledQr - 16 * labelScale, 20);
  const placeMarkup = options.showPlace && !isQrOnly ? `<p class="place">${escapeHtml(location.area || "Storage")}</p>` : "";
  const parentMarkup = options.showParent && parent && !isQrOnly ? `<p class="parent">Parent Location: ${escapeHtml(getLocationPath(parent))}</p>` : "";
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
          @page { size: ${options.width}mm ${options.height}mm; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; min-width: ${options.width}mm; background: white; }
          body { color: #11181a; font-family: Arial, Helvetica, sans-serif; }
          .page { width: ${options.width}mm; height: ${options.height}mm; display: grid; justify-items: ${options.alignX}; align-items: ${options.alignY}; overflow: hidden; break-inside: avoid; page-break-inside: avoid; page-break-after: avoid; }
          .label { width: ${labelWidth}mm; height: ${labelHeight}mm; max-width: 100%; max-height: 100%; display: grid; gap: ${3 * labelScale}mm; border: ${0.6 * labelScale}mm solid #11181a; border-radius: ${2 * labelScale}mm; background: white; padding: ${3 * labelScale}mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
          .label.side { grid-template-columns: ${scaledQr}mm minmax(${bodyWidth}mm, 1fr); align-items: start; }
          .label.stacked { grid-template-columns: 1fr; justify-items: center; text-align: center; }
          .label.qr-only { grid-template-columns: 1fr; place-items: center; }
          .qr { display: grid; gap: ${2 * labelScale}mm; align-content: start; justify-items: center; }
          .qr img { width: ${scaledQr}mm; height: ${scaledQr}mm; border: ${0.25 * labelScale}mm solid #d8ddd7; }
          .body { min-width: 0; }
          .url { max-width: 100%; overflow-wrap: anywhere; font-size: ${Math.max(scaledText - 3, 5)}pt; color: #485254; }
          .place { margin: 0 0 ${1 * labelScale}mm; color: #206f63; font-size: ${Math.max(scaledText, 6)}pt; font-weight: 800; text-transform: uppercase; }
          .parent { margin: 0 0 ${1 * labelScale}mm; color: #485254; font-size: ${Math.max(scaledText, 6)}pt; font-weight: 700; }
          h1 { margin: 0; font-size: ${scaledTitle}pt; line-height: 1.05; overflow-wrap: anywhere; }
          .count { margin: ${2 * labelScale}mm 0 ${3 * labelScale}mm; font-size: ${Math.max(scaledText + 2, 7)}pt; font-weight: 800; }
          h2 { margin: 0 0 ${1.5 * labelScale}mm; font-size: ${Math.max(scaledText - 1, 6)}pt; text-transform: uppercase; }
          ul { margin: 0; padding-left: ${20 * labelScale}px; }
          li, .contents p { margin: ${1 * labelScale}mm 0; font-size: ${scaledText}pt; }
          li span { color: #5d686a; font-size: ${Math.max(scaledText - 1, 6)}pt; }
          .more { margin-top: ${1.5 * labelScale}mm; color: #5d686a; font-weight: 700; font-size: ${scaledText}pt; }
          .actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
          button { min-height: 42px; border: 1px solid #cfd7d0; border-radius: 6px; background: white; padding: 0 14px; font: inherit; font-weight: 800; cursor: pointer; }
          .print { background: #206f63; color: white; border-color: #206f63; }
          @media print {
            html, body {
              width: ${options.width}mm;
              height: ${options.height}mm;
              min-width: 0;
              overflow: hidden;
            }
            body { background: white; }
            .page {
              width: ${options.width}mm;
              height: ${options.height}mm;
              padding: 0;
              margin: 0;
              overflow: hidden;
              break-inside: avoid;
              page-break-inside: avoid;
              page-break-after: avoid;
            }
            .label {
              border-radius: 0;
              box-shadow: none;
              width: ${labelWidth}mm;
              height: ${labelHeight}mm;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .actions { display: none !important; }
          }
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
              ${parentMarkup}
              <h1>${escapeHtml(location.name)}</h1>
              ${countMarkup}
              ${contentsMarkup}
            </div>`}
          </section>
        </main>
        <div class="actions">
          <button class="print" onclick="window.print()">Print Label</button>
          <button onclick="window.close()">Close</button>
        </div>
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
  getLocationAncestors(getLocationById(activeLocationId)).forEach((ancestor) => expandedLocationIds.add(ancestor.id));

  state.loading = false;
  setSyncStatus("Synced", true);
  render();
}

async function createLocation(name, area, parentLocationId = "", photoData = "", sections = []) {
  const { data, error } = await supabaseClient
    .from("locations")
    .insert({
      name,
      area,
      parent_location_id: parentLocationId || null,
      sections: normalizeLocationSections(sections),
      photo_data: photoData || null,
      user_id: state.user.id
    })
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

async function updateItem(itemId, updates) {
  const { data, error } = await supabaseClient
    .from("items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    showError(error);
    return;
  }

  state.items = state.items.map((item) => item.id === itemId ? data : item);
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

async function createCategory(name, renderAfter = true) {
  const cleanName = normalizeTagName(name);
  if (!cleanName) return;

  const existing = state.categories.find((category) => category.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

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
  if (renderAfter) render();
  return data;
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
  let category = form.querySelector(".item-category").value.trim();
  if (category === "__new__") {
    const entered = form.querySelector(".new-category-name")?.value.trim() || "";
    const created = await createCategory(entered || "", false);
    category = created?.name || "";
  }

  if (!category) {
    setMessage("Choose or add a category first.");
    return;
  }

  const photoData = await imageInputToData(form.querySelector(".item-photo"));
  const item = {
    location_id: location.id,
    user_id: state.user.id,
    name: form.querySelector(".item-name").value.trim(),
    quantity: Number(form.querySelector(".item-quantity").value) || 1,
    category,
    section: form.querySelector(".item-section")?.value.trim() || null,
    notes: form.querySelector(".item-notes").value.trim(),
    photo_data: photoData || null
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
  const matchedLocations = getVisibleLocations();
  const visibleIdSet = new Set(matchedLocations.map((location) => location.id));
  if (searchTerm) {
    matchedLocations.forEach((location) => {
      getLocationAncestors(location).forEach((ancestor) => visibleIdSet.add(ancestor.id));
    });
  }
  const placeNames = [...new Set(state.locations.map(getLocationDisplayPlace))]
    .sort((a, b) => a.localeCompare(b));
  container.replaceChildren();

  let renderedCount = 0;
  const renderLocationButton = ({ location, depth }) => {
    const items = getLocationItems(location.id);
    const childCount = getChildLocations(location.id).length;
    const isExpanded = expandedLocationIds.has(location.id);
    const button = document.createElement("button");
    button.className = `location-button${location.id === activeLocationId ? " active" : ""}`;
    button.type = "button";
    button.style.setProperty("--location-depth", depth);
    button.innerHTML = `
      <span class="tree-toggle" aria-hidden="true">${childCount ? (isExpanded ? "-" : "+") : ""}</span>
      <span>
        <span class="location-name"></span>
        <span class="location-meta"></span>
        ${isOwnRecord(location) ? "" : `<span class="shared-badge">Shared</span>`}
      </span>
      <strong>${items.length}</strong>
    `;
    button.querySelector(".location-name").textContent = location.name;
    button.querySelector(".location-meta").textContent = [
      location.parent_location_id ? `Inside ${getLocationById(location.parent_location_id)?.name || "Parent"}` : "",
      getLocationSections(location).length ? `${getLocationSections(location).length} section${getLocationSections(location).length === 1 ? "" : "s"}` : "",
      childCount ? `${childCount} nested location${childCount === 1 ? "" : "s"}` : ""
    ].filter(Boolean).join(" - ");
    button.addEventListener("click", () => {
      if (childCount) {
        if (isExpanded) {
          expandedLocationIds.delete(location.id);
        } else {
          expandedLocationIds.add(location.id);
        }
      }
      setActiveLocation(location.id);
    });
    container.append(button);
    renderedCount += 1;
  };

  placeNames.forEach((placeName) => {
    const rows = getPlaceHierarchyRows(placeName, visibleIdSet, Boolean(searchTerm));
    if (!rows.length) return;
    const heading = createNode("div", "place-group-heading");
    heading.innerHTML = `<span></span><strong>${rows.length}</strong>`;
    heading.querySelector("span").textContent = placeName;
    container.append(heading);
    rows.forEach(renderLocationButton);
  });

  if (!renderedCount) {
    container.append(createNode("p", "item-meta", searchTerm ? "No matching locations." : "No locations yet."));
  }
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
  title.textContent = getLocationPath(location);
  if (location.photo_data) {
    const photo = createNode("img", "location-photo");
    photo.src = location.photo_data;
    photo.alt = `${location.name} photo`;
    content.querySelector(".detail-header").after(photo);
  }
  qrImage.src = getQrUrl(location.id);
  qrImage.alt = `QR code for ${location.name}`;
  qrUrl.value = getLocationUrl(location.id);
  categorySelect.innerHTML = getCategoryOptions();
  setupCategoryPicker(itemForm);
  setupSectionPicker(itemForm, location);
  itemForm.querySelector("button").disabled = !isOwnRecord(location);

  const visibleItems = getLocationItems(location.id).filter((item) => matchesSearch(location, item));
  itemCount.textContent = visibleItems.length;
  content.querySelector(".delete-location-button").disabled = !isOwnRecord(location);

  visibleItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "item-row";
    row.innerHTML = `
      <div>
        ${item.photo_data ? `<img class="item-photo-thumb" src="${item.photo_data}" alt="">` : ""}
        <p class="item-name-text"></p>
        <p class="item-meta"></p>
      </div>
      <div class="edit-actions">
        <label class="photo-action">
          Photo
          <input class="replace-item-photo" type="file" accept="image/*" capture="environment">
        </label>
        <button class="ghost-button remove-photo-button" type="button">Remove Photo</button>
        <button class="action-dot" type="button" aria-label="Share item">...</button>
        <button class="danger-button" type="button">Remove</button>
      </div>
    `;
    row.querySelector(".item-name-text").textContent = item.name;
    row.querySelector(".item-meta").textContent = [
      `Qty ${item.quantity}`,
      item.category,
      item.section ? `Section: ${item.section}` : "",
      item.notes
    ].filter(Boolean).join(" - ");
    row.querySelector(".action-dot").addEventListener("click", () => openShareDialog("item", item, item.name));
    row.querySelector(".replace-item-photo").addEventListener("change", async (event) => {
      const photoData = await imageInputToData(event.target);
      if (photoData) await updateItem(item.id, { photo_data: photoData });
    });
    row.querySelector(".remove-photo-button").disabled = !item.photo_data || !isOwnRecord(item);
    row.querySelector(".remove-photo-button").addEventListener("click", () => updateItem(item.id, { photo_data: null }));
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
    <label>
      Inside
      <select class="new-parent-location">${getLocationOptions()}</select>
    </label>
    <label>
      Location photo
      <input class="new-location-photo" type="file" accept="image/*" capture="environment">
    </label>
    <label>
      Sections inside this location
      <textarea class="new-location-sections" rows="3" placeholder="Drawer 1&#10;Drawer 2&#10;Top tray"></textarea>
    </label>
    <p class="muted-copy">Manage place tags in Settings.</p>
    <button class="primary-button" type="submit">Create Location</button>
  `;
  locationPanel.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = locationPanel.querySelector(".new-location-name").value.trim();
    const area = locationPanel.querySelector(".new-location-area").value.trim();
    const parentLocationId = locationPanel.querySelector(".new-parent-location").value;
    const photoData = await imageInputToData(locationPanel.querySelector(".new-location-photo"));
    const sections = normalizeLocationSections(locationPanel.querySelector(".new-location-sections").value);
    if (!name) return;
    locationPanel.reset();
    await createLocation(name, area, parentLocationId, photoData, sections);
  });

  if (!getPlaceNames().length) {
    locationPanel.querySelector("button").disabled = true;
  }

  wrapper.append(locationPanel);
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
        <h2>${escapeHtml(getLocationPath(location))}</h2>
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
      <label>
        Inside
        <select class="edit-parent">${getLocationOptions(location.parent_location_id || "", location.id)}</select>
      </label>
      <label>
        Sections inside this location
        <textarea class="edit-sections" rows="4" placeholder="Drawer 1&#10;Drawer 2&#10;Top tray">${escapeHtml(getLocationSections(location).join("\n"))}</textarea>
      </label>
      ${location.photo_data ? `<img class="location-photo" src="${location.photo_data}" alt="">` : ""}
      <label>
        Replace photo
        <input class="edit-location-photo" type="file" accept="image/*" capture="environment">
      </label>
      <div class="edit-actions">
        <button class="primary-button" type="submit">Save</button>
        <button class="action-dot share-button" type="button" aria-label="Share location">...</button>
        <button class="ghost-button label-button" type="button">Label</button>
        <button class="ghost-button remove-photo-button" type="button">Remove Photo</button>
        <button class="danger-button delete-button" type="button">Delete</button>
      </div>
    `;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!isOwnRecord(location)) {
        setMessage("Shared locations are view-only.");
        return;
      }
      const photoData = await imageInputToData(form.querySelector(".edit-location-photo"));
      await updateLocation(location.id, {
        name: form.querySelector(".edit-name").value.trim(),
        area: form.querySelector(".edit-area").value.trim(),
        parent_location_id: form.querySelector(".edit-parent").value || null,
        sections: normalizeLocationSections(form.querySelector(".edit-sections").value),
        ...(photoData ? { photo_data: photoData } : {})
      });
    });
    form.querySelector(".primary-button").disabled = !isOwnRecord(location);
    form.querySelector(".share-button").addEventListener("click", () => openShareDialog("location", location, location.name));
    form.querySelector(".label-button").addEventListener("click", () => openLabelDesigner(location));
    form.querySelector(".remove-photo-button").disabled = !location.photo_data || !isOwnRecord(location);
    form.querySelector(".remove-photo-button").addEventListener("click", () => updateLocation(location.id, { photo_data: null }));
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
          <h2 class="move-location-title">${escapeHtml(getLocationPath(location))}</h2>
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
        <div class="mobile-move-controls">
          <select class="move-destination">${getLocationOptions("", item.location_id)}</select>
          <button class="ghost-button" type="button">Move</button>
        </div>
      `;
      card.querySelector(".move-item-name").textContent = item.name;
      card.querySelector(".move-item-meta").textContent = [
      `Qty ${item.quantity}`,
      item.category,
      item.section ? `Section: ${item.section}` : "",
      item.notes
    ].filter(Boolean).join(" - ");
      card.addEventListener("dragstart", (event) => {
        draggedItemId = item.id;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.querySelector("button").addEventListener("click", () => {
        const destination = card.querySelector(".move-destination").value;
        if (!destination) return;
        if (window.confirm(`Move ${item.name}?`)) {
          moveItem(item.id, destination);
        }
      });
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
    <div class="items-list tag-list-scroll"></div>
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
    <div class="items-list tag-list-scroll"></div>
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
  const sharedItems = state.items.filter((item) => !isOwnRecord(item));

  sharedLocations.forEach((location) => {
    const card = createNode("article", "panel edit-card");
    const items = getLocationItems(location.id);
    card.innerHTML = `
      <div>
        <p class="eyebrow">${escapeHtml(location.area || "Shared")}</p>
        <h2>${escapeHtml(getLocationPath(location))}</h2>
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

  sharedItems.forEach((item) => {
    const location = state.locations.find((entry) => entry.id === item.location_id);
    const card = createNode("article", "panel edit-card");
    const photo = item.photo_data
      ? `<img class="item-photo-thumb" src="${escapeHtml(item.photo_data)}" alt="">`
      : "";
    card.innerHTML = `
      <div>
        <p class="eyebrow">${escapeHtml(item.category || "Shared item")}</p>
        <h2>${escapeHtml(item.name)}</h2>
        <span class="shared-badge">Shared with you</span>
      </div>
      ${photo}
      <p class="muted-copy">${escapeHtml([
        `Qty ${item.quantity}`,
        location ? getLocationPath(location) : "Location unavailable",
        item.section ? `Section: ${item.section}` : "",
        item.notes
      ].filter(Boolean).join(" - "))}</p>
      <div class="edit-actions">
        ${location ? `<button class="ghost-button open-shared-button" type="button">Open Box</button>` : ""}
        ${item.photo_data ? `<button class="ghost-button photo-preview-button" type="button">View Photo</button>` : ""}
      </div>
    `;
    const openButton = card.querySelector(".open-shared-button");
    if (openButton && location) {
      openButton.addEventListener("click", () => {
        activeMode = "home";
        setActiveLocation(location.id);
      });
    }
    const photoButton = card.querySelector(".photo-preview-button");
    if (photoButton) {
      photoButton.addEventListener("click", () => window.open(item.photo_data, "_blank", "noopener"));
    }
    wrapper.append(card);
  });

  if (!sharedLocations.length && !sharedItems.length) {
    const empty = createNode("div", "empty-state");
    empty.innerHTML = `<div class="empty-mark">QR</div><h2>No shared items yet</h2><p>Shared locations and items appear here after another user shares with your email.</p>`;
    wrapper.append(empty);
  }

  els.modePanel.replaceChildren(wrapper);
}

function renderSearchMode() {
  const panel = createNode("section", "panel search-page");
  panel.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Search</p>
        <h2>Find Storage</h2>
      </div>
      <span class="count-pill">0</span>
    </div>
    <div class="search-page-actions">
      <label>
        Search
        <input class="search-page-input" autocomplete="off" placeholder="Find items, locations, categories">
      </label>
      <button class="ghost-button search-page-clear" type="button">Clear</button>
    </div>
    <div class="items-list search-page-results"></div>
  `;

  const input = panel.querySelector(".search-page-input");
  const results = panel.querySelector(".search-page-results");
  const count = panel.querySelector(".count-pill");
  input.value = searchTerm;
  input.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim();
    if (els.searchInput) els.searchInput.value = searchTerm;
    renderSearchMode();
  });
  panel.querySelector(".search-page-clear").addEventListener("click", () => {
    searchTerm = "";
    if (els.searchInput) els.searchInput.value = "";
    renderSearchMode();
  });

  const matches = getSearchMatches(false);
  const total = matches.locations.length + matches.items.length + matches.categories.length;
  count.textContent = total;

  if (!searchTerm) {
    results.append(createNode("p", "item-meta", "Type to search your items, locations, and categories."));
  } else if (!total) {
    results.append(createNode("p", "item-meta", "No matching items, locations, or categories."));
  }

  matches.locations.forEach((location) => {
    addSearchResult(results, getLocationPath(location), `Location - ${location.area || "Storage"}`, () => {
      activeMode = "home";
      setActiveLocation(location.id);
    });
  });

  matches.items.forEach((item) => {
    const location = getLocationById(item.location_id);
    addSearchResult(results, item.name, [
      "Item",
      item.category,
      location ? getLocationPath(location) : "",
      item.section ? `Section: ${item.section}` : ""
    ].filter(Boolean).join(" - "), () => {
      activeMode = "home";
      setActiveLocation(item.location_id);
    });
  });

  matches.categories.forEach((category) => {
    addSearchResult(results, category, "Category tag", () => {
      activeMode = "settings";
      render();
    });
  });

  els.modePanel.replaceChildren(panel);
  window.setTimeout(() => {
    const active = document.activeElement;
    if (!active || active === document.body) input.focus();
  }, 0);
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

  if (activeMode === "search") {
    renderSearchMode();
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
  if (els.searchToggleButton) {
    els.searchToggleButton.classList.toggle("hidden", !signedIn);
    els.searchToggleButton.setAttribute("aria-expanded", String(searchOpen));
  }
  if (els.searchToolbar) {
    els.searchToolbar.classList.toggle("hidden", !signedIn);
    els.searchToolbar.classList.toggle("open", searchOpen);
  }

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
  renderGlobalSearchResults();
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

els.searchToggleButton?.addEventListener("click", () => {
  searchOpen = false;
  activeMode = "search";
  render();
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
    els.labelScale,
    els.labelLayout,
    els.labelAlignX,
    els.labelAlignY
  ].filter(Boolean).forEach((control) => {
    const update = () => {
      if (els.labelPreset.value !== "custom") {
        els.labelPreset.value = "custom";
      }
      updateLabelControlLimits();
      renderLabelPreview();
    };
    control.addEventListener("input", update);
    control.addEventListener("change", update);
});

[
  els.labelShowPlace,
  els.labelShowParent,
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
  renderGlobalSearchResults();
  render();
});

els.clearSearchButton.addEventListener("click", () => {
  searchTerm = "";
  els.searchInput.value = "";
  renderGlobalSearchResults();
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
