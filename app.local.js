const THREE = window.THREE;
const OrbitControls = window.OrbitControls;
const TransformControls = window.TransformControls;
const GLTFLoader = window.GLTFLoader;

if (!THREE || !OrbitControls || !TransformControls || !GLTFLoader) {
  throw new Error("3D-Bibliothek konnte nicht geladen werden.");
}

const DEFAULT_HALL_PRESET = "realComplete";

const HALL_PRESETS = {
  realComplete: {
    label: "Echte Halle komplett",
    width: 30.24,
    depth: 20.16,
    wallHeight: 6.41,
    model: "./models/halls/Echte_Halle_Komplett_v3_open.glb",
    modelLines: true,
  },
  realLarge: {
    label: "Echte große Hallenhälfte",
    width: 20.16,
    depth: 20.16,
    wallHeight: 6.41,
    model: "./models/halls/Echte_Halle_Grosse_Hallenhaelfte_v3_open.glb",
    modelLines: true,
  },
  realSmall: {
    label: "Echte kleine Hallenhälfte",
    width: 10.16,
    depth: 20.16,
    wallHeight: 6.41,
    model: "./models/halls/Echte_Halle_Kleine_Hallenhaelfte_v3_open.glb",
    modelLines: true,
  },
  small: { label: "Einfache Box 20 x 10 m", width: 20, depth: 10, wallHeight: 4.2 },
  large: { label: "Einfache Box 20 x 20 m", width: 20, depth: 20, wallHeight: 4.2 },
};

const HALL = {
  width: HALL_PRESETS[DEFAULT_HALL_PRESET].width,
  depth: HALL_PRESETS[DEFAULT_HALL_PRESET].depth,
  wallHeight: HALL_PRESETS[DEFAULT_HALL_PRESET].wallHeight,
  floorClearance: 0.045,
};

const STORAGE_KEY = "hallenplaner-3d-v1-realhall";
const PLAN_TABS_STORAGE_KEY = "hallenplaner-3d-plan-tabs-v1";
const PANEL_STORAGE_KEY = "hallenplaner-3d-panels-ui2";
const MODEL_CACHE = new Map();
const ROTATION_SNAP_DEGREES = 15;
const COLOR_PALETTE = ["#087f8c", "#2563eb", "#cf4d3f", "#e4572e", "#f2b705", "#2f855a", "#7c3aed", "#111827"];
const DEFAULT_CAMERA = {
  position: new THREE.Vector3(7, 18, -28),
  target: new THREE.Vector3(0, 0, 0),
};
const CAMERA_VIEWS = {
  open: { label: "Innen offen", x: 0.25, z: -1.18, distance: 1.18, tilt: 52 },
  right: { label: "Rechte Innenkante", x: 1.2, z: -0.68, distance: 1.16, tilt: 48 },
  left: { label: "Linke Innenkante", x: -1.2, z: -0.68, distance: 1.16, tilt: 48 },
  low: { label: "Niedrig innen", x: 0.2, z: -1.2, distance: 0.96, tilt: 33 },
  top: { label: "Vogelblick", x: 0.04, z: 0.04, distance: 1.0, tilt: 88 },
};
const TOOL_VARIANTS = {
  text: [
    { id: "label", label: "Schild", kind: "text", text: "Text", width: 2.8, depth: 0.62 },
    { id: "station", label: "Station", kind: "text", text: "Station", width: 2.4, depth: 0.7 },
    { id: "note", label: "Notiz", kind: "text", text: "Hinweis", width: 2.2, depth: 0.56 },
    { id: "wide", label: "Breit", kind: "text", text: "Aufgabe", width: 3.6, depth: 0.64 },
  ],
  number: [
    { id: "badge", label: "Badge", kind: "number", style: "badge" },
    { id: "pin", label: "Pin", kind: "number", style: "pin" },
    { id: "disc", label: "Boden", kind: "number", style: "disc" },
    { id: "flag", label: "Fahne", kind: "number", style: "flag" },
    { id: "large", label: "Groß", kind: "number", style: "large" },
  ],
  people: [
    { id: "one", label: "1 Person", kind: "people", count: 1 },
    { id: "two", label: "2 Personen", kind: "people", count: 2 },
    { id: "three", label: "3 Personen", kind: "people", count: 3 },
    { id: "four", label: "4 Personen", kind: "people", count: 4 },
    { id: "six", label: "6 Personen", kind: "people", count: 6 },
  ],
  line: [
    { id: "solid", label: "Durchgezogen", kind: "line", style: "solid" },
    { id: "dashed", label: "Gestrichelt", kind: "line", style: "dashed" },
    { id: "dotted", label: "Punkte", kind: "line", style: "dotted" },
    { id: "double", label: "Doppelt", kind: "line", style: "double" },
    { id: "measure", label: "Endmarken", kind: "line", style: "measure" },
  ],
  arrow: [
    { id: "straight", label: "Kurz", kind: "arrow", style: "straight" },
    { id: "long", label: "Lang", kind: "arrow", style: "long" },
    { id: "double", label: "Doppelpfeil", kind: "arrow", style: "double" },
    { id: "corner", label: "Ecke", kind: "arrow", style: "corner" },
    { id: "curve", label: "Kurve", kind: "arrow", style: "curve", curveSharpness: 1 },
  ],
  zone: [
    { id: "rect", label: "Rechteck", kind: "zone", shape: "rect" },
    { id: "circle", label: "Kreis", kind: "zone", shape: "circle" },
    { id: "target", label: "Ziel", kind: "zone", shape: "target" },
    { id: "lane", label: "Bahn", kind: "zone", shape: "lane" },
    { id: "blocked", label: "Sperre", kind: "zone", shape: "blocked" },
  ],
};

const els = {};
const state = {
  assets: [],
  assetMap: new Map(),
  categories: [],
  category: null,
  query: "",
  hallPreset: DEFAULT_HALL_PRESET,
  lineMode: "mixed",
  showGrid: true,
  zoom: 100,
  cameraView: "open",
  cameraTilt: 52,
  snapEnabled: true,
  snapDegrees: ROTATION_SNAP_DEGREES,
  currentTool: "select",
  variants: {
    text: "label",
    number: "badge",
    people: "one",
    line: "solid",
    arrow: "straight",
    zone: "rect",
  },
  transformMode: "translate",
  directDrag: null,
  selected: null,
  copied: null,
  nextId: 1,
  saveTimer: 0,
  statusTimer: 0,
  restoring: false,
  switchingPlan: false,
  plans: [],
  activePlanId: "",
  history: [],
  redoStack: [],
  meta: {
    studentName: "",
    studentClass: "",
    lessonTitle: "",
    duration: "",
    goal: "",
    description: "",
    variation: "",
    safety: "",
    materialNotes: "",
  },
};

let scene;
let camera;
let renderer;
let orbitControls;
let transformControls;
let rotationNudgeGroup;
let loader;
let hallGroup;
let lineGroup;
let gridHelper;
let placedRoot;
let raycaster;
let floorPlane;
let pointer;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

async function init() {
  applyDesignPreviewFromQuery();
  bindElements();
  setupScene();
  await buildHall();
  bindUi();
  syncCollapseButtons();
  await loadAssetManifest();
  await restorePlanTabs();
  syncInputs();
  applyCameraView();
  updateInspector();
  updateMaterialSummary();
  setTransformMode("translate");
  renderVariantBar();
  resizeRenderer();
  pushHistory();
  renderer.setAnimationLoop(render);
}

function applyDesignPreviewFromQuery() {
  const design = new URLSearchParams(window.location.search).get("design");
  const allowed = new Set(["court-paper", "soft-sport", "warm-hall", "blueprint-light"]);
  if (allowed.has(design)) document.body.dataset.designPreview = design;
}

function bindElements() {
  [
    "workspace",
    "plannerPanel",
    "viewport",
    "chromeToggleBtn",
    "assetCount",
    "assetSearch",
    "assetList",
    "categoryTabs",
    "leftResizer",
    "rightResizer",
    "planTabs",
    "addPlanTabBtn",
    "hallSelect",
    "lineSelect",
    "gridToggle",
    "zoomSlider",
    "zoomValue",
    "cameraViewSelect",
    "cameraTiltSlider",
    "cameraTiltValue",
    "snapSelect",
    "snapToggle",
    "toolbarToggleBtn",
    "fullscreenBtn",
    "variantBar",
    "customImageBtn",
    "customImageInput",
    "newPlanBtn",
    "quickNewBtn",
    "undoBtn",
    "quickUndoBtn",
    "redoBtn",
    "quickRedoBtn",
    "savePlanBtn",
    "loadPlanInput",
    "exportPngBtn",
    "printBtn",
    "selectionName",
    "objectControls",
    "copyMaterialBtn",
    "materialNotes",
    "materialSummary",
    "loadingOverlay",
    "dropHint",
    "sceneStatus",
    "printSheet",
    "printCanvas",
    "printTitle",
    "printName",
    "printClass",
    "printDuration",
    "printGoal",
    "printMaterial",
    "printDescription",
    "printVariation",
    "printSafety",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  Object.keys(state.meta).forEach((key) => {
    els[key] = document.getElementById(key);
  });
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8eef0);

  camera = new THREE.PerspectiveCamera(50, 1, 0.05, 250);
  camera.position.copy(DEFAULT_CAMERA.position);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  els.viewport.appendChild(renderer.domElement);

  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = false;
  orbitControls.dampingFactor = 0;
  orbitControls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  orbitControls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  orbitControls.rotateSpeed = 1.0;
  orbitControls.zoomSpeed = 1.0;
  orbitControls.panSpeed = 1.0;
  orbitControls.screenSpacePanning = true;
  orbitControls.target.copy(DEFAULT_CAMERA.target);
  orbitControls.maxPolarAngle = Math.PI * 0.49;
  orbitControls.minPolarAngle = Math.PI * 0.08;
  orbitControls.minDistance = 4;
  orbitControls.maxDistance = 54;
  orbitControls.zoomToCursor = true;

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.9);
  transformControls.setTranslationSnap(0.25);
  transformControls.addEventListener("dragging-changed", (event) => {
    orbitControls.enabled = !event.value;
    if (!event.value && state.selected) commitHistoryOnly();
  });
  transformControls.addEventListener("objectChange", () => {
    if (!state.selected) return;
    clampObjectToHall(state.selected);
    maybeSnapObjectRotation(state.selected);
    updateInspector();
    saveToStorage();
  });
  scene.add(transformControls);
  rotationNudgeGroup = createRotationNudgeControls();
  scene.add(rotationNudgeGroup);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b8175, 1.25));

  const sun = new THREE.DirectionalLight(0xffffff, 2.35);
  sun.position.set(7, 15, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  scene.add(sun);

  placedRoot = new THREE.Group();
  placedRoot.name = "Placed 3D Hallenplan Objects";
  scene.add(placedRoot);

  raycaster = new THREE.Raycaster();
  floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  pointer = new THREE.Vector2();
  loader = new GLTFLoader();

  window.addEventListener("resize", resizeRenderer);
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
  renderer.domElement.addEventListener("pointerdown", handleScenePointerDown, { capture: true });
  renderer.domElement.addEventListener("dragover", handleDragOver);
  renderer.domElement.addEventListener("dragleave", handleDragLeave);
  renderer.domElement.addEventListener("drop", handleDrop);
}

function bindUi() {
  els.chromeToggleBtn.addEventListener("click", toggleChromeCollapse);
  els.toolbarToggleBtn.addEventListener("click", toggleToolsCollapse);
  setupPanelResizers();

  els.planTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-plan-id]");
    if (button) switchPlanTab(button.dataset.planId);
  });
  els.addPlanTabBtn.addEventListener("click", addPlanTab);

  els.assetSearch.addEventListener("input", () => {
    state.query = els.assetSearch.value.trim();
    renderAssetLibrary();
  });

  els.customImageBtn.addEventListener("click", () => els.customImageInput.click());
  els.customImageInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (file) await addImageMaterialFromFile(file, new THREE.Vector3(0, 0, 0));
    event.target.value = "";
  });

  els.hallSelect.addEventListener("change", async () => {
    state.hallPreset = els.hallSelect.value;
    await applyHallPreset();
    clampObjectsToHall();
    commitChange();
  });
  els.lineSelect.addEventListener("change", () => {
    state.lineMode = els.lineSelect.value;
    buildFloorLines();
    syncHallSpecificControls();
    commitChange();
  });
  els.gridToggle.addEventListener("change", () => {
    state.showGrid = els.gridToggle.checked;
    if (gridHelper) gridHelper.visible = state.showGrid;
    commitChange();
  });
  els.zoomSlider.addEventListener("input", () => {
    state.zoom = Number(els.zoomSlider.value);
    applyZoom();
    saveToStorage();
  });
  els.cameraViewSelect.addEventListener("change", () => {
    state.cameraView = els.cameraViewSelect.value;
    const presetTilt = CAMERA_VIEWS[state.cameraView]?.tilt;
    if (presetTilt) state.cameraTilt = presetTilt;
    applyCameraView();
    syncInputs();
    saveToStorage();
  });
  els.cameraTiltSlider.addEventListener("input", () => {
    state.cameraTilt = Number(els.cameraTiltSlider.value);
    applyCameraView();
    saveToStorage();
  });
  els.snapSelect.addEventListener("change", () => {
    updateTransformSnap();
    saveToStorage();
  });
  els.snapToggle.addEventListener("change", () => {
    updateTransformSnap();
    saveToStorage();
  });

  document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });
  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => applyTemplate(button.dataset.template));
  });

  els.fullscreenBtn.addEventListener("click", toggleFieldFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  els.newPlanBtn.addEventListener("click", () => newPlan(true));
  els.quickNewBtn.addEventListener("click", () => newPlan(true));
  els.undoBtn.addEventListener("click", undo);
  els.quickUndoBtn.addEventListener("click", undo);
  els.redoBtn.addEventListener("click", redo);
  els.quickRedoBtn.addEventListener("click", redo);
  els.savePlanBtn.addEventListener("click", downloadPlan);
  els.loadPlanInput.addEventListener("change", loadPlanFile);
  els.exportPngBtn.addEventListener("click", exportPng);
  els.printBtn.addEventListener("click", printPlan);
  window.addEventListener("afterprint", () => document.body.classList.remove("print-mode"));
  document.addEventListener("keydown", handleKeyboard);

  Object.keys(state.meta).forEach((key) => {
    const element = els[key];
    if (!element) return;
    element.addEventListener("input", () => {
      state.meta[key] = element.value;
      saveToStorage();
    });
  });

  els.copyMaterialBtn.addEventListener("click", () => {
    state.meta.materialNotes = getMaterialSummaryText();
    els.materialNotes.value = state.meta.materialNotes;
    saveToStorage();
  });
}

function toggleChromeCollapse() {
  const collapsed = !document.body.classList.contains("chrome-collapsed");
  document.body.classList.toggle("chrome-collapsed", collapsed);
  syncCollapseButtons();
  window.setTimeout(resizeRenderer, 190);
}

function toggleToolsCollapse() {
  const collapsed = !document.body.classList.contains("tools-collapsed");
  document.body.classList.toggle("tools-collapsed", collapsed);
  syncCollapseButtons();
  window.setTimeout(resizeRenderer, 190);
}

function syncCollapseButtons() {
  const chromeCollapsed = document.body.classList.contains("chrome-collapsed");
  const toolsCollapsed = document.body.classList.contains("tools-collapsed");
  els.chromeToggleBtn.textContent = chromeCollapsed ? "Angaben anzeigen" : "Angaben einklappen";
  els.chromeToggleBtn.setAttribute("aria-pressed", String(chromeCollapsed));
  els.toolbarToggleBtn.textContent = toolsCollapsed ? "Werkzeuge anzeigen" : "Werkzeuge einklappen";
  els.toolbarToggleBtn.setAttribute("aria-pressed", String(toolsCollapsed));
}

function setupPanelResizers() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY) || "{}");
    if (saved.left) setPanelWidth("left", saved.left);
    if (saved.right) setPanelWidth("right", saved.right);
  } catch {
    localStorage.removeItem(PANEL_STORAGE_KEY);
  }

  bindPanelResizer(els.leftResizer, "left");
  bindPanelResizer(els.rightResizer, "right");
}

function bindPanelResizer(handle, side) {
  if (!handle) return;
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");

    const onMove = (moveEvent) => {
      const rect = els.workspace.getBoundingClientRect();
      const max = Math.max(260, Math.floor(rect.width * 0.42));
      const width = side === "left"
        ? moveEvent.clientX - rect.left
        : rect.right - moveEvent.clientX;
      setPanelWidth(side, clamp(Math.round(width), 220, max));
      resizeRenderer();
    };

    const onUp = () => {
      handle.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      persistPanelWidths();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });
}

function setPanelWidth(side, width) {
  const property = side === "left" ? "--left-panel-width" : "--right-panel-width";
  els.workspace.style.setProperty(property, `${Math.round(width)}px`);
}

function persistPanelWidths() {
  const styles = getComputedStyle(els.workspace);
  localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({
    left: parseInt(styles.getPropertyValue("--left-panel-width"), 10) || 300,
    right: parseInt(styles.getPropertyValue("--right-panel-width"), 10) || 330,
  }));
}

function getHallPreset(key = state.hallPreset) {
  return HALL_PRESETS[key] || HALL_PRESETS[DEFAULT_HALL_PRESET];
}

function normalizeHallPresetKey(key) {
  return HALL_PRESETS[key] ? key : DEFAULT_HALL_PRESET;
}

function applyPresetDimensions(preset) {
  HALL.width = preset.width;
  HALL.depth = preset.depth;
  HALL.wallHeight = preset.wallHeight || 4.2;
}

async function applyHallPreset() {
  state.hallPreset = normalizeHallPresetKey(state.hallPreset);
  await buildHall();
  resetCamera();
}

async function buildHall() {
  if (hallGroup) scene.remove(hallGroup);
  hallGroup = new THREE.Group();
  lineGroup = null;
  gridHelper = null;
  scene.add(hallGroup);

  const preset = getHallPreset();
  applyPresetDimensions(preset);
  hallGroup.name = preset.model ? preset.label : "Einfache Hallenbox";
  setLoading(true);

  try {
    if (preset.model) {
      await addModelHall(preset);
      addPlanningGrid(0.055, 0.18);
      buildFloorLines();
      syncHallSpecificControls();
      return;
    }

    buildPlaceholderHall();
    syncHallSpecificControls();
  } catch (error) {
    console.error(error);
    showStatus("Echte Halle konnte nicht geladen werden, einfache Box aktiv");
    applyPresetDimensions({ ...preset, model: "", modelLines: false, wallHeight: 4.2 });
    buildPlaceholderHall();
    syncHallSpecificControls();
  } finally {
    setLoading(false);
  }
}

async function addModelHall(preset) {
  const source = await loadModel(preset.model);
  const model = source.clone(true);
  model.name = `${preset.label} Layout`;
  model.traverse((node) => {
    node.userData.isHallLayout = true;
    const lineSport = getHallLineSport(node.name);
    if (lineSport) {
      node.userData.hallLineSport = lineSport;
      node.userData.baseVisible = node.visible !== false;
    }
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    if (node.material?.map) node.material.map.colorSpace = THREE.SRGBColorSpace;
  });

  hallGroup.add(model);
  centerHallModel(model);
}

function getHallLineSport(name = "") {
  const normalized = String(name).toLowerCase();
  if (normalized.includes("basketball")) return "basketball";
  if (normalized.includes("volleyball")) return "volleyball";
  if (normalized.includes("handball")) return "handball";
  return "";
}

function updateModelLineVisibility() {
  if (!hallGroup) return;
  hallGroup.traverse((node) => {
    const sport = node.userData.hallLineSport;
    if (!sport) return;
    node.visible = Boolean(node.userData.baseVisible) && (
      state.lineMode === "mixed"
      || state.lineMode === sport
    );
  });
}

function centerHallModel(model) {
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (Number.isFinite(size.x) && size.x > 1) HALL.width = size.x;
  if (Number.isFinite(size.z) && size.z > 1) HALL.depth = size.z;
  if (Number.isFinite(size.y) && size.y > 1) HALL.wallHeight = size.y;
}

function buildPlaceholderHall() {
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xefbf82,
    roughness: 0.64,
    metalness: 0.02,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.width, HALL.depth), floorMaterial);
  floor.name = "Light Orange Hall Floor";
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  hallGroup.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfe2e4,
    roughness: 0.72,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(HALL.width, HALL.wallHeight), wallMaterial);
  backWall.position.set(0, HALL.wallHeight / 2, -HALL.depth / 2);
  backWall.receiveShadow = true;
  hallGroup.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(HALL.depth, HALL.wallHeight), wallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-HALL.width / 2, HALL.wallHeight / 2, 0);
  leftWall.receiveShadow = true;
  hallGroup.add(leftWall);

  const edgeGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-HALL.width / 2, 0.025, -HALL.depth / 2),
    new THREE.Vector3(HALL.width / 2, 0.025, -HALL.depth / 2),
    new THREE.Vector3(-HALL.width / 2, 0.025, -HALL.depth / 2),
    new THREE.Vector3(-HALL.width / 2, 0.025, HALL.depth / 2),
  ]);
  hallGroup.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x8d958f })));

  addPlanningGrid(0.012, 0.42);
  buildFloorLines();
}

function addPlanningGrid(height = 0.012, opacity = 0.42) {
  const size = Math.max(HALL.width, HALL.depth);
  const divisions = Math.max(10, Math.round(size));
  gridHelper = new THREE.GridHelper(size, divisions, 0xd2c3ad, 0xeadfcd);
  gridHelper.name = "Planungsraster";
  gridHelper.position.y = height;
  gridHelper.visible = state.showGrid;
  const materials = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
  materials.forEach((material) => {
    material.transparent = true;
    material.opacity = opacity;
    material.depthWrite = false;
  });
  hallGroup.add(gridHelper);
}

function syncHallSpecificControls() {
  const preset = getHallPreset();
  if (!els.lineSelect) return;
  els.lineSelect.disabled = false;
  els.lineSelect.title = preset.modelLines
    ? "Filtert die modellierten Hallenlinien. Handball wird als klare Zusatzlinie eingeblendet."
    : "Blendet typische Hallenlinien ein: gemischt, neutral oder nur eine Sportart.";
}

function buildFloorLines() {
  if (lineGroup) hallGroup.remove(lineGroup);
  lineGroup = null;
  updateModelLineVisibility();
  lineGroup = new THREE.Group();
  lineGroup.name = "Hall Lines";
  hallGroup.add(lineGroup);

  if (getHallPreset().modelLines) {
    if (state.lineMode === "handball") addHandballLines();
    return;
  }

  addRect(HALL.width - 0.8, HALL.depth - 0.8, 0xffffff);
  addLine([
    [-HALL.width / 2 + 0.4, 0],
    [HALL.width / 2 - 0.4, 0],
  ], 0xffffff);
  addCircle(0, 0, Math.min(1.45, HALL.depth * 0.16), 0xffffff);

  if (state.lineMode === "neutral") return;
  if (state.lineMode === "mixed" || state.lineMode === "basketball") addBasketballLines();
  if (state.lineMode === "mixed" || state.lineMode === "volleyball") addVolleyballLines();
  if (state.lineMode === "mixed" || state.lineMode === "handball") addHandballLines();
}

function addBasketballLines() {
  const color = 0xa04739;
  const w = Math.min(15, HALL.width - 1.2);
  const d = Math.min(9, HALL.depth - 1.2);
  addRect(w, d, color);
  addCircle(0, 0, 1.75, color);
  addRectAt(0, -HALL.depth / 2 + 1.8, 4.8, 3.0, color);
  addRectAt(0, HALL.depth / 2 - 1.8, 4.8, 3.0, color);
}

function addVolleyballLines() {
  const color = 0x2e6fb3;
  const w = Math.min(18, HALL.width - 1.2);
  const d = Math.min(9, HALL.depth - 1.2);
  addRect(w, d, color);
  addLine([[-w / 2, -d / 6], [w / 2, -d / 6]], color);
  addLine([[-w / 2, d / 6], [w / 2, d / 6]], color);
}

function addHandballLines() {
  const color = 0x2f855a;
  const w = Math.min(24, HALL.width - 0.8);
  const d = Math.min(13, HALL.depth - 0.8);
  addRect(w, d, color);
  addLine([[-2.4, -HALL.depth / 2 + 1.1], [2.4, -HALL.depth / 2 + 1.1]], color);
  addLine([[-2.4, HALL.depth / 2 - 1.1], [2.4, HALL.depth / 2 - 1.1]], color);
  addCircle(0, -HALL.depth / 2 + 1.1, 2.3, color, 0, Math.PI);
  addCircle(0, HALL.depth / 2 - 1.1, 2.3, color, Math.PI, Math.PI * 2);
}

function addRect(width, depth, color) {
  addRectAt(0, 0, width, depth, color);
}

function addRectAt(centerX, centerZ, width, depth, color) {
  const halfW = width / 2;
  const halfD = depth / 2;
  addLine([
    [centerX - halfW, centerZ - halfD],
    [centerX + halfW, centerZ - halfD],
    [centerX + halfW, centerZ - halfD],
    [centerX + halfW, centerZ + halfD],
    [centerX + halfW, centerZ + halfD],
    [centerX - halfW, centerZ + halfD],
    [centerX - halfW, centerZ + halfD],
    [centerX - halfW, centerZ - halfD],
  ], color);
}

function addCircle(centerX, centerZ, radius, color, start = 0, end = Math.PI * 2) {
  const points = [];
  const segments = 72;
  for (let i = 0; i < segments; i += 1) {
    const a0 = start + ((end - start) * i) / segments;
    const a1 = start + ((end - start) * (i + 1)) / segments;
    points.push([centerX + Math.cos(a0) * radius, centerZ + Math.sin(a0) * radius]);
    points.push([centerX + Math.cos(a1) * radius, centerZ + Math.sin(a1) * radius]);
  }
  addLine(points, color);
}

function addLine(points, color) {
  const lineHeight = getHallPreset().modelLines ? 0.082 : 0.026;
  const vectors = points.map(([x, z]) => new THREE.Vector3(x, lineHeight, z));
  const geometry = new THREE.BufferGeometry().setFromPoints(vectors);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  lineGroup.add(new THREE.LineSegments(geometry, material));
}

async function loadAssetManifest() {
  let manifest = window.HALLENPLANER_3D_MANIFEST;
  if (!manifest) {
    const response = await fetch("./models/manifest.json");
    if (!response.ok) throw new Error(`Manifest konnte nicht geladen werden: ${response.status}`);
    manifest = await response.json();
  }
  state.assets = manifest.assets || [];
  state.assetMap = new Map(state.assets.map((asset) => [asset.key, asset]));
  state.categories = Array.from(new Set(state.assets.map((asset) => asset.category))).filter(Boolean);
  els.assetCount.textContent = "Kategorien";
  renderCategories();
  renderAssetLibrary();
}

function renderCategories() {
  els.categoryTabs.replaceChildren();
  els.categoryTabs.hidden = false;

  if (!state.category) {
    const heading = document.createElement("span");
    heading.className = "category-path";
    heading.textContent = "Kategorien";
    els.categoryTabs.append(heading);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "category-back";
  button.setAttribute("aria-label", "Zurück zu den Hauptkategorien");
  button.textContent = "←";
  button.addEventListener("click", () => {
    state.category = null;
    renderCategories();
    renderAssetLibrary();
  });
  const title = document.createElement("span");
  title.className = "category-path";
  title.textContent = state.category;
  els.categoryTabs.append(button, title);
}

function renderCategoryOverview(query) {
  els.assetList.className = "asset-grid is-category-list";
  const categories = state.categories
    .map((category) => ({
      category,
      assets: state.assets.filter((asset) => asset.category === category),
    }))
    .filter((entry) => {
      if (!query) return true;
      return normalizeText(entry.category).includes(query)
        || entry.assets.some((asset) => normalizeText(asset.label).includes(query));
    });

  els.assetCount.textContent = "Kategorien";
  categories.forEach(({ category }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-card";
    button.innerHTML = "<strong></strong>";
    button.querySelector("strong").textContent = category;
    button.addEventListener("click", () => {
      state.category = category;
      renderCategories();
      renderAssetLibrary();
    });
    els.assetList.append(button);
  });
  if (!categories.length) renderEmptyAssetState("Keine Kategorie gefunden");
}

function renderAssetLibrary() {
  els.assetList.replaceChildren();
  const query = normalizeText(state.query);
  if (!state.category) {
    renderCategoryOverview(query);
    return;
  }
  els.assetList.className = "asset-grid";
  const filtered = state.assets.filter((asset) => {
    const categoryMatch = asset.category === state.category;
    const queryMatch = !query || normalizeText(`${asset.label} ${asset.category}`).includes(query);
    return categoryMatch && queryMatch;
  });
  els.assetCount.textContent = state.category;

  filtered.forEach((asset) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "asset-card";
    card.draggable = true;
    card.dataset.assetKey = asset.key;
    card.innerHTML = `
      <img src="./${asset.thumbnail}" alt="" loading="lazy" />
      <strong></strong>
      <span>${asset.variant === "v2" ? "beste Version v2" : "3D Asset"}</span>
    `;
    card.querySelector("strong").textContent = asset.label;
    card.addEventListener("click", () => addAssetAtCenter(asset));
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-hallen-asset", asset.key);
      event.dataTransfer.setData("text/plain", asset.label);
    });
    els.assetList.append(card);
  });
  if (!filtered.length) renderEmptyAssetState("Keine Materialien gefunden");
}

function renderEmptyAssetState(message) {
  const empty = document.createElement("div");
  empty.className = "asset-empty";
  empty.textContent = message;
  els.assetList.append(empty);
}

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

function handleDragOver(event) {
  const transferTypes = Array.from(event.dataTransfer.types || []);
  const hasAsset = transferTypes.includes("application/x-hallen-asset");
  const hasImage = transferTypes.includes("Files");
  if (!hasAsset && !hasImage) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  els.dropHint.hidden = false;
  els.dropHint.classList.add("is-hot");
}

function handleDragLeave() {
  els.dropHint.classList.remove("is-hot");
  els.dropHint.hidden = true;
}

async function handleDrop(event) {
  event.preventDefault();
  handleDragLeave();
  const key = event.dataTransfer.getData("application/x-hallen-asset");
  const asset = state.assetMap.get(key);
  const point = getFloorPointFromEvent(event) || new THREE.Vector3(0, 0, 0);
  if (asset) {
    await addAssetToScene(asset, point);
    return;
  }
  const imageFile = getImageFileFromTransfer(event.dataTransfer);
  if (imageFile) await addImageMaterialFromFile(imageFile, point);
}

async function addAssetAtCenter(asset) {
  await addAssetToScene(asset, new THREE.Vector3(0, 0, 0));
}

async function addAssetToScene(asset, point, saved = null, options = {}) {
  setLoading(true);
  try {
    const object = await createAssetObject(asset);
    object.userData.id = saved?.id || makeId();
    object.userData.kind = "asset";
    object.userData.assetKey = asset.key;
    object.userData.assetLabel = asset.label;
    object.userData.model = asset.model;
    object.userData.isPlaced = true;
    object.userData.flipX = saved?.flipX || false;
    object.userData.flipZ = saved?.flipZ || false;

    object.position.set(
      clamp(point.x, -HALL.width / 2 + 0.2, HALL.width / 2 - 0.2),
      HALL.floorClearance,
      clamp(point.z, -HALL.depth / 2 + 0.2, HALL.depth / 2 - 0.2)
    );

    if (saved) applySavedTransform(object, saved);
    clampObjectToHall(object);
    placedRoot.add(object);
    if (!options.silent) selectObject(object);
    if (!options.skipCommit) commitChange();
  } catch (error) {
    console.error(error);
    showStatus("Asset konnte nicht geladen werden");
  } finally {
    setLoading(false);
  }
}

async function createAssetObject(asset) {
  const source = await loadModel(asset.model);
  const clone = source.clone(true);
  clone.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    if (node.material?.map) node.material.map.colorSpace = THREE.SRGBColorSpace;
  });

  const wrapper = new THREE.Group();
  wrapper.name = asset.label;
  const sourceBox = new THREE.Box3().setFromObject(clone);
  const center = sourceBox.getCenter(new THREE.Vector3());
  clone.position.sub(center);
  clone.position.y -= sourceBox.min.y - center.y;
  wrapper.add(clone);

  const size = sourceBox.getSize(new THREE.Vector3());
  const horizontalSource = Math.max(size.x, size.z, 0.001);
  const horizontalTarget = Math.max(asset.width, asset.depth, 0.25);
  const scale = clamp(horizontalTarget / horizontalSource, 0.015, 18);
  wrapper.scale.setScalar(scale);
  wrapper.userData.baseScale = scale;
  return wrapper;
}

async function loadModel(url) {
  const resolvedUrl = resolveModelUrl(url);
  if (MODEL_CACHE.has(resolvedUrl)) return MODEL_CACHE.get(resolvedUrl);
  const gltf = await loader.loadAsync(resolvedUrl);
  MODEL_CACHE.set(resolvedUrl, gltf.scene);
  return gltf.scene;
}

function resolveModelUrl(url) {
  const modelData = window.HALLENPLANER_MODEL_DATA;
  if (!modelData) return url;
  const key = String(url || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");
  return modelData[key] || url;
}

function getImageFileFromTransfer(dataTransfer) {
  return Array.from(dataTransfer.files || []).find((file) => file?.type?.startsWith("image/"));
}

async function addImageMaterialFromFile(file, point) {
  if (!file?.type?.startsWith("image/")) {
    showStatus("Bitte eine Bilddatei verwenden");
    return;
  }

  setLoading(true);
  try {
    const imageSrc = await fileToOptimizedDataUrl(file);
    const image = await loadImageElement(imageSrc);
    const aspect = clamp(image.naturalWidth / Math.max(image.naturalHeight, 1), 0.2, 5);
    const maxSide = 2.6;
    const width = aspect >= 1 ? maxSide : maxSide * aspect;
    const depth = aspect >= 1 ? maxSide / aspect : maxSide;
    addImageMaterialToScene({
      label: file.name.replace(/\.[^.]+$/, "") || "Eigenes Bild",
      imageSrc,
      width,
      depth,
    }, point);
    showStatus("Bild eingefügt");
  } catch (error) {
    console.error(error);
    showStatus("Bild konnte nicht eingefügt werden");
  } finally {
    setLoading(false);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = src;
  });
}

async function fileToOptimizedDataUrl(file) {
  const raw = await readFileAsDataUrl(file);
  if (file.type === "image/svg+xml") return raw;

  const image = await loadImageElement(raw);
  const maxTextureSide = 1400;
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (largestSide <= maxTextureSide && file.size <= 900000) return raw;

  const scale = Math.min(1, maxTextureSide / largestSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.9);
}

function addImageMaterialToScene(data, point, saved = null, options = {}) {
  const imageSrc = saved?.imageSrc || data?.imageSrc;
  if (!imageSrc) return null;

  const width = Number(saved?.width || data?.width || 2.4);
  const depth = Number(saved?.depth || data?.depth || 1.6);
  const label = saved?.text || data?.label || "Eigenes Bild";
  const object = new THREE.Group();
  object.name = label;
  object.userData = {
    id: saved?.id || makeId(),
    kind: "image",
    variant: "image",
    style: "image",
    width,
    depth,
    imageSrc,
    text: label,
    isPlaced: true,
    baseScale: saved?.baseScale || 1,
    assetLabel: label,
  };
  object.add(makeImagePlane(imageSrc, width, depth));
  object.position.set(
    saved?.position?.x ?? clamp(point.x, -HALL.width / 2 + 0.2, HALL.width / 2 - 0.2),
    saved?.position?.y ?? HALL.floorClearance,
    saved?.position?.z ?? clamp(point.z, -HALL.depth / 2 + 0.2, HALL.depth / 2 - 0.2)
  );
  if (saved) applySavedTransform(object, saved);
  clampObjectToHall(object);
  placedRoot.add(object);
  if (!options.silent) selectObject(object);
  if (!options.skipCommit) commitChange();
  return object;
}

function makeImagePlane(imageSrc, width, depth) {
  const group = new THREE.Group();
  const texture = new THREE.TextureLoader().load(imageSrc, () => renderer.render(scene, camera));
  texture.colorSpace = THREE.SRGBColorSpace;
  const maxAnisotropy = typeof renderer.capabilities.getMaxAnisotropy === "function"
    ? renderer.capabilities.getMaxAnisotropy()
    : 1;
  texture.anisotropy = Math.min(maxAnisotropy, 8);

  const plane = markGenerated(new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
  ));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.048;
  group.add(plane);

  const border = makeBorder(width, depth, 0xffffff);
  border.position.y = 0.03;
  group.add(border);
  return group;
}

function addAnnotation(type, point, saved = null, options = {}) {
  const variant = saved?.variant || inferVariant(type, saved);
  const object = new THREE.Group();
  object.name = getKindLabel(type);
  object.userData = {
    id: saved?.id || makeId(),
    kind: type,
    variant,
    style: saved?.style || variant,
    shape: saved?.shape || variant,
    count: saved?.count || (type === "group" ? 4 : 1),
    curveSharpness: saved?.curveSharpness || 1,
    width: saved?.width,
    depth: saved?.depth,
    isPlaced: true,
    color: saved?.color || state.color || COLOR_PALETTE[0],
    text: saved?.text || defaultAnnotationText(type),
    baseScale: saved?.baseScale || 1,
    assetLabel: getKindLabel(type),
  };
  rebuildAnnotation(object);
  object.position.set(
    saved?.position?.x ?? clamp(point.x, -HALL.width / 2 + 0.2, HALL.width / 2 - 0.2),
    saved?.position?.y ?? HALL.floorClearance,
    saved?.position?.z ?? clamp(point.z, -HALL.depth / 2 + 0.2, HALL.depth / 2 - 0.2)
  );
  if (saved) applySavedTransform(object, saved);
  clampObjectToHall(object);
  placedRoot.add(object);
  if (!options.silent) selectObject(object);
  if (!options.skipCommit) commitChange();
  return object;
}

function inferVariant(type, saved = {}) {
  if (saved.variant) return saved.variant;
  if (type === "person") return "one";
  if (type === "group") return "four";
  const variants = Object.values(TOOL_VARIANTS).flat();
  return variants.find((variant) => variant.kind === type)?.id || type;
}

function rebuildAnnotation(object) {
  clearChildren(object);
  const color = new THREE.Color(object.userData.color || COLOR_PALETTE[0]);
  const rawKind = object.userData.kind;
  const kind = rawKind === "person" || rawKind === "group" ? "people" : rawKind;
  object.userData.billboard = kind === "number";

  if (kind === "text") {
    object.add(makeTextPlane(object.userData.text || "Text", object.userData.color, object.userData.width || 2.8, object.userData.depth || 0.62));
  }
  if (kind === "number") {
    object.add(makeNumberMarker(object.userData.text || "1", object.userData.color || "#cf4d3f", object.userData.style || "badge"));
  }
  if (kind === "people") {
    const count = rawKind === "group" ? 4 : rawKind === "person" ? 1 : clamp(Number(object.userData.count) || 1, 1, 8);
    getPeopleOffsets(count).forEach(([x, z]) => {
      object.add(makePersonFigure(color, x, z));
    });
  }
  if (kind === "zone") {
    object.add(makeZoneShape(object.userData.shape || "rect", color));
  }
  if (kind === "line") object.add(makeLineSymbol(object.userData.style || "solid", color));
  if (kind === "arrow") object.add(makeArrowSymbol(object.userData.style || "straight", color, object.userData.curveSharpness || 1));
}

function makeNumberMarker(text, color, style) {
  const group = new THREE.Group();
  const radius = style === "large" ? 0.72 : 0.52;
  const disc = markGenerated(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.045, 64),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, roughness: 0.42 })
  ));
  disc.position.y = 0.035;
  group.add(disc);

  const ring = markGenerated(new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.018, 12, 64),
    new THREE.MeshBasicMaterial({ color })
  ));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.065;
  group.add(ring);

  if (style === "flag") {
    const pole = markGenerated(new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.95, 12),
      new THREE.MeshBasicMaterial({ color })
    ));
    pole.position.set(-0.26, 0.48, 0);
    group.add(pole);
  }

  const sprite = makeNumberSprite(text, style === "pin" ? "#d32220" : color, style);
  sprite.position.y = style === "disc" ? 0.72 : 1.15;
  sprite.scale.setScalar(style === "large" ? 1.38 : 1.08);
  group.add(sprite);
  return group;
}

function makeNumberSprite(text, color, style) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = style === "pin" ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.82)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d32220";
  ctx.font = "900 138px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text).slice(0, 3), 128, 135);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.userData.generated = true;
  return sprite;
}

function getPeopleOffsets(count) {
  const layouts = {
    1: [[0, 0]],
    2: [[-0.25, 0], [0.25, 0]],
    3: [[-0.34, 0.12], [0.34, 0.12], [0, -0.28]],
    4: [[-0.36, -0.24], [0.36, -0.24], [-0.36, 0.28], [0.36, 0.28]],
    5: [[-0.48, -0.28], [0, -0.28], [0.48, -0.28], [-0.24, 0.32], [0.24, 0.32]],
    6: [[-0.52, -0.32], [0, -0.32], [0.52, -0.32], [-0.52, 0.32], [0, 0.32], [0.52, 0.32]],
  };
  return layouts[count] || layouts[6];
}

function makeZoneShape(shape, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
  if (shape === "circle" || shape === "target") {
    const disc = markGenerated(new THREE.Mesh(new THREE.CircleGeometry(1.2, 72), material));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.024;
    group.add(disc);
    group.add(makeCircleBorder(1.2, color));
    if (shape === "target") {
      group.add(makeCircleBorder(0.75, color));
      group.add(makeCircleBorder(0.34, color));
    }
    return group;
  }

  const width = shape === "lane" ? 4.2 : 3.2;
  const depth = shape === "lane" ? 1.0 : 2.0;
  const plane = markGenerated(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.024;
  group.add(plane);
  group.add(makeBorder(width, depth, color));
  if (shape === "blocked") {
    for (let i = -2; i <= 2; i += 1) {
      const hatch = makeFlatBar(2.7, 0.035, color);
      hatch.rotation.y = Math.PI / 4;
      hatch.position.set(i * 0.45, 0.06, 0);
      group.add(hatch);
    }
  }
  return group;
}

function makeLineSymbol(style, color) {
  const group = new THREE.Group();
  if (style === "dashed") {
    for (let i = 0; i < 5; i += 1) {
      const dash = makeFlatBar(0.42, 0.07, color);
      dash.position.x = -1.2 + i * 0.6;
      group.add(dash);
    }
    return group;
  }
  if (style === "dotted") {
    for (let i = 0; i < 7; i += 1) {
      const dot = markGenerated(new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.045, 22),
        new THREE.MeshBasicMaterial({ color })
      ));
      dot.position.set(-1.2 + i * 0.4, 0.07, 0);
      group.add(dot);
    }
    return group;
  }
  if (style === "double") {
    const top = makeFlatBar(2.8, 0.055, color);
    const bottom = makeFlatBar(2.8, 0.055, color);
    top.position.z = -0.12;
    bottom.position.z = 0.12;
    group.add(top, bottom);
    return group;
  }
  if (style === "measure") {
    group.add(makeFlatBar(2.8, 0.055, color));
    const left = makeFlatBar(0.5, 0.055, color);
    const right = makeFlatBar(0.5, 0.055, color);
    left.rotation.y = Math.PI / 2;
    right.rotation.y = Math.PI / 2;
    left.position.x = -1.4;
    right.position.x = 1.4;
    group.add(left, right);
    return group;
  }
  group.add(makeFlatBar(2.8, 0.07, color));
  return group;
}

function makeArrowSymbol(style, color, curveSharpness = 1) {
  const group = new THREE.Group();
  if (style === "corner") {
    const horizontal = makeFlatBar(1.5, 0.1, color);
    horizontal.position.x = 0.75;
    const vertical = makeFlatBar(1.3, 0.1, color);
    vertical.rotation.y = Math.PI / 2;
    vertical.position.set(1.5, 0.07, 0.65);
    group.add(horizontal, vertical, makeArrowHead(new THREE.Vector3(0, 0, 1), color, new THREE.Vector3(1.5, 0.085, 1.36)));
    return group;
  }
  if (style === "curve") {
    const sharpness = clamp(Number(curveSharpness) || 1, 0.4, 2.4);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.2, 0.08, 0.42),
      new THREE.Vector3(-0.55, 0.08, -0.2 - 0.52 * sharpness),
      new THREE.Vector3(0.35, 0.08, -0.36 - 0.36 * sharpness),
      new THREE.Vector3(1.0, 0.08, -0.2),
    ]);
    const tube = markGenerated(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, 0.045, 10, false),
      new THREE.MeshBasicMaterial({ color })
    ));
    const end = curve.getPoint(1);
    const tangent = curve.getTangent(1).normalize();
    group.add(tube, makeArrowHead(tangent, color, end.clone().add(tangent.clone().multiplyScalar(0.22))));
    return group;
  }

  const length = style === "long" ? 3.4 : 2.35;
  group.add(makeFlatBar(length, 0.1, color));
  group.add(makeArrowHead(new THREE.Vector3(1, 0, 0), color, new THREE.Vector3(length / 2 + 0.23, 0.085, 0)));
  if (style === "double") {
    group.add(makeArrowHead(new THREE.Vector3(-1, 0, 0), color, new THREE.Vector3(-length / 2 - 0.23, 0.085, 0)));
  }
  return group;
}

function makeFlatBar(length, thickness, color) {
  const bar = markGenerated(new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.045, thickness),
    new THREE.MeshBasicMaterial({ color })
  ));
  bar.position.y = 0.07;
  return bar;
}

function makeArrowHead(direction, color, position) {
  const head = markGenerated(new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.42, 28),
    new THREE.MeshBasicMaterial({ color })
  ));
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  head.position.copy(position);
  return head;
}

function markGenerated(object) {
  object.userData.generated = true;
  if (object.isMesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
  return object;
}

function makeTextPlane(text, color, width, depth) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,253,248,0.88)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  roundedRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 58px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text).slice(0, 24), canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  mesh.userData.generated = true;
  return mesh;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function makeLimbBetween(start, end, radius, material, segments = 14) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const length = Math.max(direction.length(), 0.001);
  const limb = markGenerated(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.92, length, segments),
    material
  ));
  limb.position.copy(from.clone().add(to).multiplyScalar(0.5));
  limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  limb.castShadow = true;
  return limb;
}

function makePersonFigure(color, x, z) {
  const group = new THREE.Group();
  const shirtColor = new THREE.Color(color);
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.46 });
  const shortsMaterial = new THREE.MeshStandardMaterial({ color: 0x17202a, roughness: 0.58 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c19b, roughness: 0.56 });
  const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.50 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.64 });
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.54,
    roughness: 0.78,
  });

  const base = markGenerated(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.018, 36), baseMaterial));
  base.position.set(x, 0.012, z);
  base.receiveShadow = true;

  const leftShoe = markGenerated(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.22), shoeMaterial));
  leftShoe.position.set(x - 0.075, 0.045, z - 0.035);
  const rightShoe = markGenerated(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.22), shoeMaterial));
  rightShoe.position.set(x + 0.075, 0.045, z + 0.035);

  const leftLeg = makeLimbBetween([x - 0.070, 0.085, z - 0.025], [x - 0.055, 0.405, z - 0.010], 0.035, skinMaterial);
  const rightLeg = makeLimbBetween([x + 0.070, 0.085, z + 0.020], [x + 0.055, 0.405, z + 0.008], 0.035, skinMaterial);

  const shorts = markGenerated(new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.195, 0.145, 22), shortsMaterial));
  shorts.position.set(x, 0.455, z);
  shorts.castShadow = true;

  const torso = markGenerated(new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.190, 0.375, 24), shirtMaterial));
  torso.position.set(x, 0.680, z);
  torso.castShadow = true;

  const shoulderStripe = markGenerated(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.030, 0.050), shoeMaterial));
  shoulderStripe.position.set(x, 0.825, z - 0.128);
  shoulderStripe.castShadow = true;

  const leftArm = makeLimbBetween([x - 0.145, 0.770, z - 0.010], [x - 0.255, 0.515, z + 0.070], 0.030, skinMaterial);
  const rightArm = makeLimbBetween([x + 0.145, 0.770, z - 0.010], [x + 0.255, 0.545, z - 0.075], 0.030, skinMaterial);
  const leftHand = markGenerated(new THREE.Mesh(new THREE.SphereGeometry(0.040, 14, 10), skinMaterial));
  leftHand.position.set(x - 0.260, 0.505, z + 0.075);
  const rightHand = markGenerated(new THREE.Mesh(new THREE.SphereGeometry(0.040, 14, 10), skinMaterial));
  rightHand.position.set(x + 0.260, 0.535, z - 0.080);

  const neck = markGenerated(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.075, 16), skinMaterial));
  neck.position.set(x, 0.900, z);
  const head = markGenerated(new THREE.Mesh(new THREE.SphereGeometry(0.120, 24, 16), skinMaterial));
  head.position.set(x, 1.005, z);
  head.castShadow = true;

  const hair = markGenerated(new THREE.Mesh(
    new THREE.SphereGeometry(0.123, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    hairMaterial
  ));
  hair.position.set(x, 1.030, z);
  hair.castShadow = true;

  const faceMarker = markGenerated(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), hairMaterial));
  faceMarker.position.set(x, 1.010, z - 0.116);

  group.add(
    base,
    leftShoe,
    rightShoe,
    leftLeg,
    rightLeg,
    shorts,
    torso,
    shoulderStripe,
    leftArm,
    rightArm,
    leftHand,
    rightHand,
    neck,
    head,
    hair,
    faceMarker
  );
  group.scale.y = 1.45;
  return group;
}

function makeBorder(width, depth, color) {
  const hw = width / 2;
  const hd = depth / 2;
  const points = [
    new THREE.Vector3(-hw, 0.03, -hd), new THREE.Vector3(hw, 0.03, -hd),
    new THREE.Vector3(hw, 0.03, -hd), new THREE.Vector3(hw, 0.03, hd),
    new THREE.Vector3(hw, 0.03, hd), new THREE.Vector3(-hw, 0.03, hd),
    new THREE.Vector3(-hw, 0.03, hd), new THREE.Vector3(-hw, 0.03, -hd),
  ];
  return markGenerated(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  ));
}

function makeCircleBorder(radius, color) {
  const points = [];
  const segments = 88;
  for (let i = 0; i < segments; i += 1) {
    const a0 = (Math.PI * 2 * i) / segments;
    const a1 = (Math.PI * 2 * (i + 1)) / segments;
    points.push(
      new THREE.Vector3(Math.cos(a0) * radius, 0.034, Math.sin(a0) * radius),
      new THREE.Vector3(Math.cos(a1) * radius, 0.034, Math.sin(a1) * radius)
    );
  }
  return markGenerated(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  ));
}

function clearChildren(object) {
  while (object.children.length) {
    const child = object.children.pop();
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material?.map && node.userData.generated) node.material.map.dispose();
      if (node.material && node.userData.generated) node.material.dispose();
    });
  }
}

function defaultAnnotationText(type) {
  if (type === "number") {
    return String(placedRoot.children.filter((object) => object.userData.kind === "number").length + 1);
  }
  if (type === "text") return "Text";
  return "";
}

function createRotationNudgeControls() {
  const group = new THREE.Group();
  group.name = "Rotation Nudge Controls";
  group.visible = false;
  group.renderOrder = 1000;
  group.add(createRotationNudgeSprite(-45));
  group.add(createRotationNudgeSprite(45));
  return group;
}

function createRotationNudgeSprite(degrees) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  drawRotationNudgeIcon(context, degrees > 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = degrees < 0 ? "45 Grad links drehen" : "45 Grad rechts drehen";
  sprite.userData.isRotationNudge = true;
  sprite.userData.rotationNudgeDegrees = degrees;
  return sprite;
}

function drawRotationNudgeIcon(context, clockwise) {
  context.clearRect(0, 0, 128, 128);
  context.fillStyle = "rgba(255, 252, 245, 0.96)";
  context.strokeStyle = "rgba(8, 127, 140, 0.95)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(64, 64, 52, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.strokeStyle = "#087f8c";
  context.fillStyle = "#087f8c";
  context.lineWidth = 10;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (clockwise) {
    context.beginPath();
    context.arc(64, 58, 28, Math.PI * 0.95, Math.PI * 0.05, false);
    context.stroke();
    context.beginPath();
    context.moveTo(92, 54);
    context.lineTo(105, 58);
    context.lineTo(96, 69);
    context.closePath();
    context.fill();
  } else {
    context.beginPath();
    context.arc(64, 58, 28, Math.PI * 0.05, Math.PI * 0.95, true);
    context.stroke();
    context.beginPath();
    context.moveTo(36, 54);
    context.lineTo(23, 58);
    context.lineTo(32, 69);
    context.closePath();
    context.fill();
  }

  context.font = "800 28px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("45", 64, 91);
}

function updateRotationNudgeControls() {
  if (!rotationNudgeGroup) return;
  const object = state.selected;
  if (!object || object.userData.kind !== "asset") {
    rotationNudgeGroup.visible = false;
    return;
  }

  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.y)) {
    rotationNudgeGroup.visible = false;
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  cameraRight.y = 0;
  if (cameraRight.lengthSq() < 0.0001) cameraRight.set(1, 0, 0);
  cameraRight.normalize();

  const distance = camera.position.distanceTo(center);
  const spriteScale = clamp(distance * 0.06, 0.62, 1.38);
  const objectSpan = Math.max(size.x, size.z, 0.8);
  const offset = clamp(objectSpan * 0.18 + spriteScale * 0.92, 0.95, 2.65);
  const height = box.max.y + spriteScale * 1.42;

  rotationNudgeGroup.visible = true;
  rotationNudgeGroup.children.forEach((sprite) => {
    const direction = sprite.userData.rotationNudgeDegrees < 0 ? -1 : 1;
    sprite.position.copy(center).addScaledVector(cameraRight, direction * offset);
    sprite.position.y = height;
    sprite.scale.set(spriteScale, spriteScale, 1);
  });
}

function handleRotationNudgePointerDown(event) {
  if (!rotationNudgeGroup?.visible || !state.selected) return false;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(rotationNudgeGroup.children, false)[0];
  if (!hit?.object?.userData?.isRotationNudge) return false;

  event.preventDefault();
  event.stopPropagation();
  rotateSelectedByDegrees(hit.object.userData.rotationNudgeDegrees);
  return true;
}

function rotateSelectedByDegrees(degrees) {
  if (!state.selected) return;
  state.selected.rotation.y += THREE.MathUtils.degToRad(degrees);
  maybeSnapObjectRotation(state.selected);
  clampObjectToHall(state.selected);
  updateRotationNudgeControls();
  showStatus(`${Math.abs(degrees)} Grad ${degrees < 0 ? "links" : "rechts"} gedreht`);
  commitChange();
}

function getFloorPointFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(floorPlane, point)) return null;
  point.x = clamp(point.x, -HALL.width / 2 + 0.2, HALL.width / 2 - 0.2);
  point.z = clamp(point.z, -HALL.depth / 2 + 0.2, HALL.depth / 2 - 0.2);
  point.y = 0;
  return point;
}

function startDirectObjectDrag(event, object, startPoint) {
  if (!object || state.transformMode !== "translate" || !startPoint) return false;
  event.preventDefault();
  event.stopPropagation();

  const grabOffset = startPoint.clone().sub(object.position);
  grabOffset.y = 0;
  state.directDrag = { object, grabOffset, pointerId: event.pointerId, moved: false };
  orbitControls.enabled = false;
  transformControls.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);

  const finishDrag = () => {
    renderer.domElement.removeEventListener("pointermove", moveObject);
    renderer.domElement.removeEventListener("pointerup", finishDrag);
    renderer.domElement.removeEventListener("pointercancel", finishDrag);
    if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    orbitControls.enabled = true;
    transformControls.enabled = true;
    if (state.directDrag?.moved) commitHistoryOnly();
    state.directDrag = null;
  };

  const moveObject = (moveEvent) => {
    if (!state.directDrag || state.directDrag.pointerId !== moveEvent.pointerId) return;
    const point = getFloorPointFromEvent(moveEvent);
    if (!point) return;
    moveEvent.preventDefault();
    object.position.x = point.x - grabOffset.x;
    object.position.z = point.z - grabOffset.z;
    clampObjectToHall(object);
    state.directDrag.moved = true;
    updateInspector();
    saveToStorage();
    updateMaterialSummary();
  };

  renderer.domElement.addEventListener("pointermove", moveObject);
  renderer.domElement.addEventListener("pointerup", finishDrag);
  renderer.domElement.addEventListener("pointercancel", finishDrag);
  return true;
}

function handleScenePointerDown(event) {
  if (transformControls.dragging || state.directDrag || event.button !== 0) return;
  if (handleRotationNudgePointerDown(event)) return;
  const floorPoint = getFloorPointFromEvent(event);
  const point = floorPoint || new THREE.Vector3(0, 0, 0);
  if (state.currentTool !== "select") {
    event.preventDefault();
    event.stopPropagation();
    addActiveToolAnnotation(point);
    setTool("select");
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(placedRoot.children, true);
  const object = intersects.length ? findPlacedRoot(intersects[0].object) : null;
  selectObject(object);
  if (object) {
    event.preventDefault();
    event.stopPropagation();
    startDirectObjectDrag(event, object, floorPoint);
  }
}

function findPlacedRoot(object) {
  let current = object;
  while (current && current.parent !== placedRoot) current = current.parent;
  return current?.userData?.isPlaced ? current : null;
}

function selectObject(object) {
  state.selected = object || null;
  if (state.selected) {
    transformControls.setSize(isFlatSymbol(state.selected) ? 0.65 : 0.9);
    transformControls.attach(state.selected);
  } else {
    transformControls.detach();
  }
  updateRotationNudgeControls();
  updateInspector();
}

function isFlatSymbol(object) {
  return ["text", "number", "line", "arrow", "zone", "people", "person", "group", "image"].includes(object?.userData?.kind);
}

function setTool(tool) {
  state.currentTool = tool;
  document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  renderVariantBar();
  if (tool !== "select") {
    selectObject(null);
  }
  saveToStorage();
}

function renderVariantBar() {
  const variants = TOOL_VARIANTS[state.currentTool] || [];
  if (!variants.length) {
    els.variantBar.hidden = true;
    els.plannerPanel.classList.remove("has-variants");
    els.variantBar.replaceChildren();
    return;
  }

  els.variantBar.hidden = false;
  els.plannerPanel.classList.add("has-variants");
  els.variantBar.replaceChildren();

  const label = document.createElement("span");
  label.className = "variant-label";
  label.textContent = `${getKindLabel(variants[0].kind)}:`;
  els.variantBar.append(label);

  variants.forEach((variant) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `variant-button${state.variants[state.currentTool] === variant.id ? " is-active" : ""}`;
    button.dataset.variant = variant.id;
    button.title = variant.title || variant.label;
    button.textContent = variant.label;
    button.addEventListener("click", () => {
      state.variants[state.currentTool] = variant.id;
      renderVariantBar();
      saveToStorage();
    });
    els.variantBar.append(button);
  });
}

function addActiveToolAnnotation(point) {
  const variant = getActiveVariant(state.currentTool);
  const data = {
    kind: variant.kind,
    variant: variant.id,
    style: variant.style,
    shape: variant.shape,
    count: variant.count,
    curveSharpness: variant.curveSharpness,
    text: variant.text || defaultAnnotationText(variant.kind),
    width: variant.width,
    depth: variant.depth,
  };
  addAnnotation(data.kind, point, data);
}

function getActiveVariant(tool) {
  const variants = TOOL_VARIANTS[tool] || [];
  const activeId = state.variants[tool] || variants[0]?.id;
  return variants.find((variant) => variant.id === activeId) || variants[0] || { id: tool, kind: tool };
}

function setTransformMode(mode) {
  state.transformMode = mode;
  transformControls.setMode(mode);
  if (mode === "translate") {
    transformControls.showX = false;
    transformControls.showY = true;
    transformControls.showZ = false;
  } else if (mode === "rotate") {
    transformControls.showX = false;
    transformControls.showY = true;
    transformControls.showZ = false;
  } else {
    transformControls.showX = true;
    transformControls.showY = true;
    transformControls.showZ = true;
  }
  updateTransformSnap();
}

function updateTransformSnap() {
  state.snapEnabled = true;
  state.snapDegrees = ROTATION_SNAP_DEGREES;
  transformControls.setRotationSnap(THREE.MathUtils.degToRad(ROTATION_SNAP_DEGREES));
}

function maybeSnapObjectRotation(object) {
  if (!object) return;
  const step = ROTATION_SNAP_DEGREES;
  const degrees = THREE.MathUtils.radToDeg(object.rotation.y);
  const snapped = Math.round(degrees / step) * step;
  object.rotation.y = THREE.MathUtils.degToRad(snapped);
}

function clampObjectsToHall() {
  placedRoot.children.forEach(clampObjectToHall);
}

function clampObjectToHall(object) {
  if (!object) return;
  object.position.x = clamp(object.position.x, -HALL.width / 2 + 0.1, HALL.width / 2 - 0.1);
  object.position.z = clamp(object.position.z, -HALL.depth / 2 + 0.1, HALL.depth / 2 - 0.1);
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.y)) return;
  const lift = HALL.floorClearance - box.min.y;
  if (lift > 0) object.position.y += lift;
}

function updateInspector() {
  const object = state.selected;
  if (!object) {
    els.selectionName.textContent = "Nichts ausgewählt";
    els.objectControls.className = "object-controls muted-block";
    els.objectControls.hidden = true;
    els.objectControls.innerHTML = "";
    return;
  }

  const kind = object.userData.kind;
  const canText = kind === "text" || kind === "number";
  const canColor = !["asset", "image"].includes(kind);
  const canElevate = kind === "asset";
  const label = getObjectLabel(object);
  const color = object.userData.color || COLOR_PALETTE[0];
  const baseScale = object.userData.baseScale || 1;
  const scalePercent = Math.round((Math.abs(object.scale.x) / baseScale) * 100);
  const elevation = Math.round(object.position.y * 100) / 100;
  const canCurveArrow = kind === "arrow" && object.userData.style === "curve";
  const curveSharpness = clamp(Number(object.userData.curveSharpness) || 1, 0.4, 2.4);

  els.selectionName.textContent = label;
  els.objectControls.className = "object-controls";
  els.objectControls.hidden = false;
  els.objectControls.innerHTML = `
    ${canText ? `
      <label class="wide-control">Beschriftung
        <input id="selectedTextInput" value="${escapeAttribute(object.userData.text || "")}" />
      </label>` : ""}
    <div class="control-grid">
      <label>X
        <input id="selectedXInput" type="number" step="0.1" value="${object.position.x.toFixed(1)}" />
      </label>
      <label>Z
        <input id="selectedZInput" type="number" step="0.1" value="${object.position.z.toFixed(1)}" />
      </label>
    </div>
    <label class="range-control">Drehung
      <div class="range-line">
        <input id="selectedRotationInput" type="number" step="${ROTATION_SNAP_DEGREES}" value="${Math.round(normalizeDegrees(THREE.MathUtils.radToDeg(object.rotation.y)))}" />
        <input id="selectedRotationSlider" type="range" min="-180" max="180" step="${ROTATION_SNAP_DEGREES}" value="${Math.round(normalizeDegrees(THREE.MathUtils.radToDeg(object.rotation.y)))}" />
      </div>
    </label>
    ${canCurveArrow ? `<label class="range-control">Kurve
      <div class="range-line">
        <input id="selectedCurveInput" type="number" min="0.4" max="2.4" step="0.1" value="${curveSharpness.toFixed(1)}" />
        <input id="selectedCurveSlider" type="range" min="0.4" max="2.4" step="0.05" value="${curveSharpness.toFixed(2)}" />
      </div>
    </label>` : ""}
    <label class="range-control">Größe
      <div class="range-line">
        <input id="selectedScaleInput" type="number" min="20" max="300" step="5" value="${scalePercent}" />
        <input id="selectedScaleSlider" type="range" min="20" max="300" step="5" value="${scalePercent}" />
      </div>
    </label>
    ${canElevate ? `<label class="range-control">Höhe
      <div class="range-line">
        <input id="selectedElevationInput" type="number" min="0.04" step="0.05" value="${elevation.toFixed(2)}" />
        <input id="selectedElevationSlider" type="range" min="0.04" max="2.2" step="0.02" value="${elevation.toFixed(2)}" />
      </div>
    </label>` : ""}
    <div class="mode-buttons" aria-label="Gizmo">
      <button type="button" data-mode="translate" class="${state.transformMode === "translate" ? "is-active" : ""}">Bewegen</button>
      <button type="button" data-mode="rotate" class="${state.transformMode === "rotate" ? "is-active" : ""}">Drehen</button>
      <button type="button" data-mode="scale" class="${state.transformMode === "scale" ? "is-active" : ""}">Skalieren</button>
    </div>
    ${canColor ? `
      <div class="palette-row" aria-label="Farben">
        ${COLOR_PALETTE.map((swatch) => `<button type="button" class="color-swatch${swatch === color ? " active" : ""}" data-color="${swatch}" style="--swatch:${swatch}" aria-label="Farbe ${swatch}"></button>`).join("")}
      </div>
      <label>Farbe
        <input id="selectedColorInput" type="color" value="${color}" />
      </label>` : ""}
    <div class="inline-controls">
      <button type="button" data-action="rotate-left">-${state.snapDegrees}</button>
      <button type="button" data-action="rotate-right">+${state.snapDegrees}</button>
      <button type="button" data-action="rotate-quarter">+90</button>
    </div>
    <div class="inline-controls">
      <button type="button" data-action="smaller">Kleiner</button>
      <button type="button" data-action="larger">Größer</button>
      ${kind === "asset" ? `<button type="button" data-action="flip-x">Spiegeln X</button><button type="button" data-action="flip-z">Spiegeln Z</button>` : ""}
    </div>
    <div class="inline-controls">
      <button type="button" data-action="duplicate">Kopieren</button>
      ${canElevate ? `<button type="button" data-action="lower">Tiefer</button><button type="button" data-action="raise">Höher</button>` : ""}
      <button type="button" class="danger-button" data-action="delete">Löschen</button>
    </div>
  `;
  bindInspectorControls(object.userData.id);
}

function bindInspectorControls(id) {
  const selected = () => placedRoot.children.find((object) => object.userData.id === id);
  const setPairedValue = (inputId, value) => {
    const input = document.getElementById(inputId);
    if (input) input.value = String(value);
  };
  const bindInput = (inputId, handler, eventName = "input") => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener(eventName, () => {
      const object = selected();
      if (!object) return;
      handler(object, input.value);
      clampObjectToHall(object);
      saveToStorage();
      updateMaterialSummary();
    });
    input.addEventListener("change", () => commitHistoryOnly());
  };

  bindInput("selectedTextInput", (object, value) => {
    object.userData.text = value;
    rebuildAnnotation(object);
  });
  bindInput("selectedXInput", (object, value) => {
    object.position.x = Number(value) || 0;
  });
  bindInput("selectedZInput", (object, value) => {
    object.position.z = Number(value) || 0;
  });
  bindInput("selectedRotationInput", (object, value) => {
    const degrees = normalizeDegrees(Number(value) || 0);
    object.rotation.y = THREE.MathUtils.degToRad(degrees);
    maybeSnapObjectRotation(object);
    setPairedValue("selectedRotationSlider", Math.round(normalizeDegrees(THREE.MathUtils.radToDeg(object.rotation.y))));
  });
  bindInput("selectedRotationSlider", (object, value) => {
    const degrees = normalizeDegrees(Number(value) || 0);
    object.rotation.y = THREE.MathUtils.degToRad(degrees);
    maybeSnapObjectRotation(object);
    setPairedValue("selectedRotationInput", Math.round(normalizeDegrees(THREE.MathUtils.radToDeg(object.rotation.y))));
  });
  bindInput("selectedScaleInput", (object, value) => {
    const percent = clamp(Number(value) || 100, 20, 300) / 100;
    const signX = object.scale.x < 0 ? -1 : 1;
    const signZ = object.scale.z < 0 ? -1 : 1;
    const base = object.userData.baseScale || 1;
    object.scale.set(base * percent * signX, base * percent, base * percent * signZ);
    setPairedValue("selectedScaleSlider", Math.round(percent * 100));
  });
  bindInput("selectedScaleSlider", (object, value) => {
    const percent = clamp(Number(value) || 100, 20, 300) / 100;
    const signX = object.scale.x < 0 ? -1 : 1;
    const signZ = object.scale.z < 0 ? -1 : 1;
    const base = object.userData.baseScale || 1;
    object.scale.set(base * percent * signX, base * percent, base * percent * signZ);
    setPairedValue("selectedScaleInput", Math.round(percent * 100));
  });
  bindInput("selectedElevationInput", (object, value) => {
    object.position.y = Math.max(HALL.floorClearance, Number(value) || HALL.floorClearance);
    setPairedValue("selectedElevationSlider", object.position.y.toFixed(2));
  });
  bindInput("selectedElevationSlider", (object, value) => {
    object.position.y = Math.max(HALL.floorClearance, Number(value) || HALL.floorClearance);
    setPairedValue("selectedElevationInput", object.position.y.toFixed(2));
  });
  bindInput("selectedCurveInput", (object, value) => {
    object.userData.curveSharpness = clamp(Number(value) || 1, 0.4, 2.4);
    rebuildAnnotation(object);
    setPairedValue("selectedCurveSlider", object.userData.curveSharpness.toFixed(2));
  });
  bindInput("selectedCurveSlider", (object, value) => {
    object.userData.curveSharpness = clamp(Number(value) || 1, 0.4, 2.4);
    rebuildAnnotation(object);
    setPairedValue("selectedCurveInput", object.userData.curveSharpness.toFixed(1));
  });
  bindInput("selectedColorInput", (object, value) => {
    object.userData.color = value;
    state.color = value;
    rebuildAnnotation(object);
  });

  els.objectControls.querySelectorAll("[data-color]").forEach((button) => {
    button.addEventListener("click", () => {
      const object = selected();
      if (!object) return;
      object.userData.color = button.dataset.color;
      state.color = button.dataset.color;
      rebuildAnnotation(object);
      commitChange();
    });
  });

  els.objectControls.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setTransformMode(button.dataset.mode);
      updateInspector();
    });
  });

  els.objectControls.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const object = selected();
      if (!object) return;
      runObjectAction(button.dataset.action, object);
    });
  });
}

function runObjectAction(action, object) {
  if (action === "rotate-left") object.rotation.y -= THREE.MathUtils.degToRad(state.snapDegrees);
  if (action === "rotate-right") object.rotation.y += THREE.MathUtils.degToRad(state.snapDegrees);
  if (action === "rotate-quarter") object.rotation.y += THREE.MathUtils.degToRad(90);
  if (action === "smaller") scaleObject(object, 0.85);
  if (action === "larger") scaleObject(object, 1.18);
  if (action === "flip-x") {
    object.scale.x *= -1;
    object.userData.flipX = !object.userData.flipX;
  }
  if (action === "flip-z") {
    object.scale.z *= -1;
    object.userData.flipZ = !object.userData.flipZ;
  }
  if (action === "lower") object.position.y = Math.max(HALL.floorClearance, object.position.y - 0.15);
  if (action === "raise") object.position.y += 0.15;
  if (action === "duplicate") {
    duplicateSelected(object);
    return;
  }
  if (action === "delete") {
    deleteSelected();
    return;
  }
  maybeSnapObjectRotation(object);
  clampObjectToHall(object);
  commitChange();
}

function scaleObject(object, factor) {
  object.scale.multiplyScalar(factor);
}

async function duplicateSelected(source = state.selected) {
  if (!source) return;
  const data = serializeObject(source);
  data.id = makeId();
  data.position.x += 0.5;
  data.position.z += 0.5;
  if (data.kind === "asset") {
    const asset = state.assetMap.get(data.key);
    if (asset) await addAssetToScene(asset, new THREE.Vector3(data.position.x, 0, data.position.z), data);
  } else if (data.kind === "image") {
    addImageMaterialToScene(data, new THREE.Vector3(data.position.x, 0, data.position.z), data);
  } else {
    addAnnotation(data.kind, new THREE.Vector3(data.position.x, 0, data.position.z), data);
  }
}

function deleteSelected() {
  if (!state.selected) return;
  const object = state.selected;
  transformControls.detach();
  placedRoot.remove(object);
  if (object.userData.kind !== "asset") clearChildren(object);
  state.selected = null;
  commitChange();
}

async function applyTemplate(template) {
  setLoading(true);
  const silent = { skipCommit: true, silent: true };
  const addAsset = async (key, x, z, rotation = 0) => {
    const asset = state.assetMap.get(key);
    if (!asset) return;
    await addAssetToScene(asset, new THREE.Vector3(x, 0, z), { rotation: { x: 0, y: THREE.MathUtils.degToRad(rotation), z: 0 } }, silent);
  };
  const add = (kind, x, z, rotation = 0, color = state.color, text = "") => {
    addAnnotation(kind, new THREE.Vector3(x, 0, z), {
      rotation: { x: 0, y: THREE.MathUtils.degToRad(rotation), z: 0 },
      color,
      text: text || defaultAnnotationText(kind),
    }, silent);
  };

  try {
    if (template === "warmup") {
      add("zone", 0, 0, 0, "#087f8c");
      await addAsset("huetchen", -HALL.width / 2 + 1.2, -HALL.depth / 2 + 1.0);
      await addAsset("huetchen", HALL.width / 2 - 1.2, -HALL.depth / 2 + 1.0);
      await addAsset("huetchen", -HALL.width / 2 + 1.2, HALL.depth / 2 - 1.0);
      await addAsset("huetchen", HALL.width / 2 - 1.2, HALL.depth / 2 - 1.0);
      for (let i = 0; i < 8; i += 1) add("people", -5.2 + (i % 4) * 2.1, -1.2 + Math.floor(i / 4) * 2.4, 0, "#087f8c");
      add("arrow", 0, -2.6, 0, "#cf4d3f");
      add("arrow", 0, 2.6, 180, "#cf4d3f");
    }
    if (template === "circuit") {
      const stations = [
        ["turnmatte_klein", -6, -3.2, 0],
        ["minihuerde", 6, -3.2, 0],
        ["turnbank", 6, 3.2, 90],
        ["pezziball", -6, 3.2, 0],
      ];
      for (let i = 0; i < stations.length; i += 1) {
        const [key, x, z, rotation] = stations[i];
        await addAsset(key, x, z, rotation);
        add("number", x, z - 1.2, 0, "#cf4d3f", String(i + 1));
      }
      add("arrow", 0, -3.2, 0, "#2563eb");
      add("arrow", 6, 0, 90, "#2563eb");
      add("arrow", 0, 3.2, 180, "#2563eb");
      add("arrow", -6, 0, -90, "#2563eb");
    }
    if (template === "tag") {
      add("zone", 0, 0, 0, "#2563eb");
      for (let i = 0; i < 12; i += 1) {
        const color = i % 4 === 0 ? "#cf4d3f" : "#087f8c";
        add("people", -6 + (i % 6) * 2.4, -1.6 + Math.floor(i / 6) * 3.2, 0, color);
      }
      await addAsset("huetchen", -HALL.width / 2 + 1, -HALL.depth / 2 + 1);
      await addAsset("huetchen", HALL.width / 2 - 1, -HALL.depth / 2 + 1);
      await addAsset("huetchen", -HALL.width / 2 + 1, HALL.depth / 2 - 1);
      await addAsset("huetchen", HALL.width / 2 - 1, HALL.depth / 2 - 1);
      add("arrow", -2.5, 0.2, -30, "#cf4d3f");
      add("arrow", 3.2, 0.8, 145, "#cf4d3f");
    }
    if (template === "relay") {
      const lanes = HALL.depth > 12 ? 5 : 3;
      for (let lane = 0; lane < lanes; lane += 1) {
        const z = -((lanes - 1) * 0.8) + lane * 1.6;
        await addAsset("huetchen", -HALL.width / 2 + 1.4, z);
        await addAsset("huetchen", HALL.width / 2 - 1.4, z);
        await addAsset("staffelstab", -HALL.width / 2 + 2.6, z, 90);
        add("people", -HALL.width / 2 + 3.4, z, 0, "#087f8c");
        add("people", -HALL.width / 2 + 4.2, z, 0, "#2563eb");
        add("arrow", 0, z, 0, "#cf4d3f");
      }
    }
    commitChange();
    showStatus("Vorlage eingefügt");
  } finally {
    setLoading(false);
  }
}

function handleKeyboard(event) {
  const active = document.activeElement;
  const typing = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
  if (typing) return;

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    if (state.selected) state.copied = serializeObject(state.selected);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
    event.preventDefault();
    if (state.copied) duplicateFromData(state.copied);
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelected();
    return;
  }

  if (!state.selected || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const step = event.shiftKey ? 0.5 : 0.15;
  if (event.key === "ArrowLeft") state.selected.position.x -= step;
  if (event.key === "ArrowRight") state.selected.position.x += step;
  if (event.key === "ArrowUp") state.selected.position.z -= step;
  if (event.key === "ArrowDown") state.selected.position.z += step;
  clampObjectToHall(state.selected);
  commitChange();
}

async function duplicateFromData(data) {
  const copy = JSON.parse(JSON.stringify(data));
  copy.id = makeId();
  copy.position.x += 0.5;
  copy.position.z += 0.5;
  if (copy.kind === "asset") {
    const asset = state.assetMap.get(copy.key);
    if (asset) await addAssetToScene(asset, new THREE.Vector3(copy.position.x, 0, copy.position.z), copy);
  } else if (copy.kind === "image") {
    addImageMaterialToScene(copy, new THREE.Vector3(copy.position.x, 0, copy.position.z), copy);
  } else {
    addAnnotation(copy.kind, new THREE.Vector3(copy.position.x, 0, copy.position.z), copy);
  }
}

function newPlan(confirmFirst) {
  if (confirmFirst && placedRoot.children.length && !window.confirm("Aktuellen Plan löschen und neu beginnen?")) return;
  selectObject(null);
  [...placedRoot.children].forEach((child) => {
    placedRoot.remove(child);
    if (child.userData.kind !== "asset") clearChildren(child);
  });
  state.nextId = 1;
  state.meta.lessonTitle = "";
  state.meta.goal = "";
  state.meta.description = "";
  state.meta.variation = "";
  state.meta.safety = "";
  state.meta.materialNotes = "";
  syncInputs();
  commitChange();
}

function downloadPlan() {
  const data = JSON.stringify(serializePlan(), null, 2);
  const name = `${slugify(state.meta.lessonTitle || "3d-hallenplan")}.json`;
  downloadBlob(new Blob([data], { type: "application/json" }), name);
}

function loadPlanFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await loadPlan(JSON.parse(String(reader.result)));
      commitChange();
    } catch (error) {
      console.error(error);
      window.alert("Die Datei konnte nicht geladen werden.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

async function exportPng() {
  try {
    const blob = await getViewportBlob();
    downloadBlob(blob, `${slugify(state.meta.lessonTitle || "3d-hallenplan")}.png`);
  } catch (error) {
    console.error(error);
    window.alert("PNG-Export konnte nicht erstellt werden.");
  }
}

async function printPlan() {
  try {
    const dataUrl = await withCleanRender(() => renderer.domElement.toDataURL("image/png"));
    const image = document.createElement("img");
    image.src = dataUrl;
    image.alt = "3D Hallenplan";
    els.printCanvas.replaceChildren(image);
    els.printTitle.textContent = state.meta.lessonTitle || "3D Hallenplan";
    els.printName.textContent = state.meta.studentName || " ";
    els.printClass.textContent = state.meta.studentClass || " ";
    els.printDuration.textContent = state.meta.duration || " ";
    els.printGoal.textContent = state.meta.goal || " ";
    els.printMaterial.textContent = state.meta.materialNotes || getMaterialSummaryText() || " ";
    els.printDescription.textContent = state.meta.description || " ";
    els.printVariation.textContent = state.meta.variation || " ";
    els.printSafety.textContent = state.meta.safety || " ";
    document.body.classList.add("print-mode");
    window.setTimeout(() => window.print(), 120);
  } catch (error) {
    console.error(error);
    window.alert("PDF-Erstellung konnte nicht gestartet werden.");
  }
}

function getViewportBlob() {
  return withCleanRender(() => new Promise((resolve, reject) => {
    renderer.domElement.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas konnte nicht exportiert werden."));
    }, "image/png");
  }));
}

async function withCleanRender(callback) {
  const active = state.selected;
  const previousObject = transformControls.object;
  if (previousObject) transformControls.detach();
  renderer.render(scene, camera);
  try {
    return await callback();
  } finally {
    if (active && placedRoot.children.includes(active)) transformControls.attach(active);
    renderer.render(scene, camera);
  }
}

function updateMaterialSummary() {
  const text = getMaterialSummaryText();
  els.materialSummary.textContent = text || "Noch kein Material im Plan.";
}

function getMaterialSummaryText() {
  const counts = new Map();
  placedRoot.children.forEach((object) => {
    if (!["asset", "image"].includes(object.userData.kind)) return;
    const label = getObjectLabel(object);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([label, count]) => `${count} x ${label}`)
    .join("\n");
}

function serializePlan() {
  return {
    version: 2,
    hallPreset: state.hallPreset,
    lineMode: state.lineMode,
    showGrid: state.showGrid,
    zoom: state.zoom,
    cameraView: state.cameraView,
    cameraTilt: state.cameraTilt,
    snapDegrees: state.snapDegrees,
    snapEnabled: state.snapEnabled,
    nextId: state.nextId,
    meta: { ...state.meta },
    objects: placedRoot.children.map(serializeObject),
  };
}

function serializeObject(object) {
  return {
    id: object.userData.id,
    kind: object.userData.kind,
    key: object.userData.assetKey,
    variant: object.userData.variant,
    style: object.userData.style,
    shape: object.userData.shape,
    count: object.userData.count,
    curveSharpness: object.userData.curveSharpness,
    width: object.userData.width,
    depth: object.userData.depth,
    color: object.userData.color,
    text: object.userData.text,
    imageSrc: object.userData.imageSrc,
    assetLabel: object.userData.assetLabel,
    baseScale: object.userData.baseScale,
    flipX: object.userData.flipX,
    flipZ: object.userData.flipZ,
    position: vectorToData(object.position),
    rotation: vectorToData(object.rotation),
    scale: vectorToData(object.scale),
  };
}

function vectorToData(vector) {
  return { x: round(vector.x), y: round(vector.y), z: round(vector.z) };
}

function createEmptyMeta() {
  return {
    studentName: "",
    studentClass: "",
    lessonTitle: "",
    duration: "",
    goal: "",
    description: "",
    variation: "",
    safety: "",
    materialNotes: "",
  };
}

function createEmptyPlan(overrides = {}) {
  return {
    version: 2,
    hallPreset: DEFAULT_HALL_PRESET,
    lineMode: "mixed",
    showGrid: true,
    zoom: 100,
    cameraView: "open",
    cameraTilt: CAMERA_VIEWS.open.tilt,
    snapDegrees: ROTATION_SNAP_DEGREES,
    snapEnabled: true,
    nextId: 1,
    meta: createEmptyMeta(),
    objects: [],
    ...overrides,
  };
}

function makePlanTabId() {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makePlanTabName(plan, index) {
  const title = String(plan?.meta?.lessonTitle || "").trim();
  return title || `Plan ${index + 1}`;
}

function normalizePlanTab(tab, index) {
  if (!tab?.plan) return null;
  return {
    id: String(tab.id || makePlanTabId()),
    name: String(tab.name || makePlanTabName(tab.plan, index)),
    plan: tab.plan,
  };
}

function getActivePlanTab() {
  return state.plans.find((plan) => plan.id === state.activePlanId);
}

function ensurePlanTabs() {
  if (state.plans.length) return;
  const id = makePlanTabId();
  const plan = serializePlan();
  state.activePlanId = id;
  state.plans = [{ id, name: makePlanTabName(plan, 0), plan }];
}

function captureActivePlanTab() {
  ensurePlanTabs();
  const tab = getActivePlanTab();
  if (!tab) return;
  const index = state.plans.indexOf(tab);
  tab.plan = serializePlan();
  tab.name = makePlanTabName(tab.plan, index);
}

function persistPlanTabs(capture = true) {
  if (state.restoring || state.switchingPlan) return;
  if (capture) captureActivePlanTab();
  try {
    localStorage.setItem(PLAN_TABS_STORAGE_KEY, JSON.stringify({
      activePlanId: state.activePlanId,
      plans: state.plans,
    }));
  } catch (error) {
    console.warn("Plan-Tabs konnten nicht dauerhaft gespeichert werden.", error);
    showStatus("Plan-Tabs konnten wegen großer Bilddaten nicht dauerhaft gespeichert werden");
  }
  renderPlanTabs();
}

function renderPlanTabs() {
  if (!els.planTabs) return;
  ensurePlanTabs();
  els.planTabs.replaceChildren();
  state.plans.forEach((tab, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `plan-tab${tab.id === state.activePlanId ? " is-active" : ""}`;
    button.dataset.planId = tab.id;
    button.textContent = tab.name || makePlanTabName(tab.plan, index);
    button.title = `${button.textContent} öffnen`;
    els.planTabs.append(button);
  });
}

async function restorePlanTabs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_TABS_STORAGE_KEY) || "null");
    if (saved?.plans?.length) {
      state.plans = saved.plans.map(normalizePlanTab).filter(Boolean);
      if (state.plans.length) {
        state.activePlanId = state.plans.some((plan) => plan.id === saved.activePlanId)
          ? saved.activePlanId
          : state.plans[0].id;
        const active = getActivePlanTab();
        state.switchingPlan = true;
        try {
          await loadPlan(active.plan, { skipSave: true });
        } finally {
          state.switchingPlan = false;
        }
        renderPlanTabs();
        return;
      }
    }
  } catch (error) {
    console.warn("Gespeicherte Plan-Tabs wurden ignoriert.", error);
    localStorage.removeItem(PLAN_TABS_STORAGE_KEY);
  }

  await restorePlan();
  ensurePlanTabs();
  persistPlanTabs();
}

async function switchPlanTab(planId) {
  if (!planId || planId === state.activePlanId) return;
  const target = state.plans.find((plan) => plan.id === planId);
  if (!target) return;

  captureActivePlanTab();
  state.activePlanId = target.id;
  state.switchingPlan = true;
  try {
    await loadPlan(target.plan || createEmptyPlan(), { skipSave: true });
  } finally {
    state.switchingPlan = false;
  }
  state.history = [];
  state.redoStack = [];
  pushHistory();
  persistPlanTabs();
  saveToStorage();
  showStatus(`${target.name || "Plan"} geöffnet`);
}

async function addPlanTab() {
  captureActivePlanTab();
  const tab = {
    id: makePlanTabId(),
    name: `Plan ${state.plans.length + 1}`,
    plan: createEmptyPlan({
      hallPreset: state.hallPreset,
      lineMode: state.lineMode,
      showGrid: state.showGrid,
      zoom: state.zoom,
      cameraView: state.cameraView,
      cameraTilt: state.cameraTilt,
      snapDegrees: state.snapDegrees,
      snapEnabled: state.snapEnabled,
    }),
  };
  state.plans.push(tab);
  state.activePlanId = tab.id;
  state.switchingPlan = true;
  try {
    await loadPlan(tab.plan, { skipSave: true });
  } finally {
    state.switchingPlan = false;
  }
  state.history = [];
  state.redoStack = [];
  pushHistory();
  persistPlanTabs();
  saveToStorage();
  showStatus("Neuer Plan angelegt");
}

async function restorePlan() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) await loadPlan(JSON.parse(saved));
  } catch (error) {
    console.warn("Gespeicherter Plan wurde ignoriert.", error);
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function loadPlan(plan, options = {}) {
  plan = plan || createEmptyPlan();
  state.restoring = true;
  selectObject(null);
  [...placedRoot.children].forEach((child) => {
    placedRoot.remove(child);
    if (child.userData.kind !== "asset") clearChildren(child);
  });

  state.hallPreset = normalizeHallPresetKey(plan.hallPreset || plan.hall || DEFAULT_HALL_PRESET);
  state.lineMode = plan.lineMode || plan.lines || "mixed";
  state.showGrid = plan.showGrid !== false;
  state.zoom = clamp(Number(plan.zoom) || 100, 70, 170);
  state.cameraView = plan.cameraView || "open";
  state.cameraTilt = clamp(Number(plan.cameraTilt) || 52, 30, 88);
  state.snapDegrees = ROTATION_SNAP_DEGREES;
  state.snapEnabled = true;
  state.nextId = Number(plan.nextId || 1);
  state.meta = { ...createEmptyMeta(), ...(plan.meta || {}) };
  syncInputs();
  await applyHallPreset();

  for (const saved of plan.objects || []) {
    const kind = saved.kind || (saved.type === "asset" ? "asset" : saved.type) || "asset";
    if (kind === "asset") {
      const key = saved.key || saved.assetKey;
      const asset = state.assetMap.get(key);
      if (asset) await addAssetToScene(asset, dataToPoint(saved.position, saved), normalizeSavedObject(saved, kind, key), { skipCommit: true, silent: true });
    } else if (kind === "image") {
      addImageMaterialToScene(saved, dataToPoint(saved.position, saved), normalizeSavedObject(saved, kind), { skipCommit: true, silent: true });
    } else {
      addAnnotation(kind, dataToPoint(saved.position, saved), normalizeSavedObject(saved, kind), { skipCommit: true, silent: true });
    }
  }
  const maxObjectId = Math.max(...placedRoot.children.map((object) => Number(object.userData.id) || 0), 0);
  state.nextId = Math.max(Number(plan.nextId) || 1, maxObjectId + 1);
  state.restoring = false;
  selectObject(null);
  updateMaterialSummary();
  if (!options.skipSave) saveToStorage();
}

function normalizeSavedObject(saved, kind, key = "") {
  const normalized = {
    id: saved.id,
    kind,
    key,
    color: saved.color,
    text: saved.text,
    imageSrc: saved.imageSrc,
    assetLabel: saved.assetLabel,
    variant: saved.variant,
    style: saved.style,
    shape: saved.shape,
    count: saved.count,
    curveSharpness: saved.curveSharpness,
    width: saved.width,
    depth: saved.depth,
    baseScale: saved.baseScale,
    flipX: saved.flipX,
    flipZ: saved.flipZ,
    position: saved.position || { x: saved.x || 0, y: HALL.floorClearance, z: saved.y || 0 },
    rotation: saved.rotation && typeof saved.rotation === "object"
      ? saved.rotation
      : { x: 0, y: THREE.MathUtils.degToRad(Number(saved.rotation) || 0), z: 0 },
    scale: saved.scale || { x: saved.width ? 1 : 1, y: 1, z: 1 },
  };
  return normalized;
}

function dataToPoint(position, legacy) {
  if (position) return new THREE.Vector3(position.x || 0, 0, position.z || 0);
  return new THREE.Vector3((legacy.x || 0) - HALL.width / 2, 0, (legacy.y || 0) - HALL.depth / 2);
}

function applySavedTransform(object, saved) {
  if (saved.position) object.position.set(saved.position.x || 0, saved.position.y || HALL.floorClearance, saved.position.z || 0);
  if (saved.rotation) object.rotation.set(saved.rotation.x || 0, saved.rotation.y || 0, saved.rotation.z || 0);
  if (saved.scale) object.scale.set(
    Number.isFinite(saved.scale.x) ? saved.scale.x : 1,
    Number.isFinite(saved.scale.y) ? saved.scale.y : 1,
    Number.isFinite(saved.scale.z) ? saved.scale.z : 1,
  );
  if (saved.baseScale) object.userData.baseScale = saved.baseScale;
  if (saved.color) object.userData.color = saved.color;
  if (saved.text) object.userData.text = saved.text;
  if (saved.imageSrc) object.userData.imageSrc = saved.imageSrc;
  if (saved.assetLabel) object.userData.assetLabel = saved.assetLabel;
  if (saved.variant) object.userData.variant = saved.variant;
  if (saved.style) object.userData.style = saved.style;
  if (saved.shape) object.userData.shape = saved.shape;
  if (saved.count) object.userData.count = saved.count;
  if (saved.curveSharpness) object.userData.curveSharpness = saved.curveSharpness;
  if (saved.width) object.userData.width = saved.width;
  if (saved.depth) object.userData.depth = saved.depth;
}

function saveToStorage() {
  if (state.restoring || state.switchingPlan) return;
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    const plan = serializePlan();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch (error) {
      console.warn("Plan konnte nicht dauerhaft gespeichert werden.", error);
      showStatus("Plan konnte wegen großer Bilddaten nicht dauerhaft gespeichert werden");
    }
    persistPlanTabs();
    updateMaterialSummary();
  }, 80);
}

function commitChange() {
  updateInspector();
  updateMaterialSummary();
  commitHistoryOnly();
}

function pushHistory() {
  state.history.push(JSON.stringify(serializePlan()));
  if (state.history.length > 80) state.history.shift();
  updateUndoRedo();
}

function commitHistoryOnly() {
  if (state.restoring) return;
  const snapshot = JSON.stringify(serializePlan());
  if (state.history.at(-1) !== snapshot) {
    state.history.push(snapshot);
    if (state.history.length > 80) state.history.shift();
    state.redoStack = [];
  }
  saveToStorage();
  updateUndoRedo();
}

async function undo() {
  if (state.history.length <= 1) return;
  state.redoStack.push(state.history.pop());
  await loadPlan(JSON.parse(state.history.at(-1)));
  updateUndoRedo();
}

async function redo() {
  if (!state.redoStack.length) return;
  const snapshot = state.redoStack.pop();
  state.history.push(snapshot);
  await loadPlan(JSON.parse(snapshot));
  updateUndoRedo();
}

function updateUndoRedo() {
  const canUndo = state.history.length > 1;
  const canRedo = state.redoStack.length > 0;
  [els.undoBtn, els.quickUndoBtn].forEach((button) => {
    if (button) button.disabled = !canUndo;
  });
  [els.redoBtn, els.quickRedoBtn].forEach((button) => {
    if (button) button.disabled = !canRedo;
  });
}

function syncInputs() {
  state.hallPreset = normalizeHallPresetKey(state.hallPreset);
  if (!CAMERA_VIEWS[state.cameraView]) state.cameraView = "open";
  els.hallSelect.value = state.hallPreset;
  els.lineSelect.value = state.lineMode;
  els.gridToggle.checked = state.showGrid;
  els.zoomSlider.value = String(state.zoom);
  els.zoomValue.textContent = `${state.zoom}%`;
  els.cameraViewSelect.value = state.cameraView;
  els.cameraTiltSlider.value = String(state.cameraTilt);
  els.cameraTiltValue.textContent = `${state.cameraTilt}`;
  els.snapSelect.value = String(state.snapDegrees);
  els.snapToggle.checked = state.snapEnabled;
  Object.keys(state.meta).forEach((key) => {
    if (els[key]) els[key].value = state.meta[key] || "";
  });
  applyZoom();
  updateTransformSnap();
  syncHallSpecificControls();
}

function applyZoom() {
  camera.zoom = state.zoom / 100;
  camera.updateProjectionMatrix();
  els.zoomValue.textContent = `${state.zoom}%`;
}

async function toggleFieldFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    document.body.classList.remove("field-fullscreen");
    resizeRenderer();
    return;
  }
  if (els.workspace.requestFullscreen) {
    try {
      await els.workspace.requestFullscreen();
    } catch {
      document.body.classList.add("field-fullscreen");
    }
  } else {
    document.body.classList.add("field-fullscreen");
  }
  resizeRenderer();
}

function syncFullscreenButton() {
  document.body.classList.toggle("field-fullscreen", Boolean(document.fullscreenElement));
  resizeRenderer();
}

function resetCamera() {
  applyCameraView();
}

function applyCameraView() {
  const view = CAMERA_VIEWS[state.cameraView] || CAMERA_VIEWS.open;
  const hallSize = Math.max(HALL.width, HALL.depth);
  const tilt = THREE.MathUtils.degToRad(state.cameraTilt || view.tilt || 52);
  const distance = hallSize * (view.distance || 1.1);
  const horizontal = Math.max(0.2, Math.cos(tilt) * distance);
  const height = Math.max(3.4, Math.sin(tilt) * distance);
  const direction = new THREE.Vector3(view.x, 0, view.z).normalize();

  camera.position.set(direction.x * horizontal, height, direction.z * horizontal);
  orbitControls.target.copy(DEFAULT_CAMERA.target);
  orbitControls.update();
  if (els.cameraTiltValue) els.cameraTiltValue.textContent = `${state.cameraTilt}`;
  resizeRenderer();
}

function resizeRenderer() {
  const rect = els.viewport.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setLoading(isLoading) {
  els.loadingOverlay.hidden = !isLoading;
}

function showStatus(message) {
  els.sceneStatus.textContent = message;
  els.sceneStatus.hidden = false;
  window.clearTimeout(state.statusTimer);
  state.statusTimer = window.setTimeout(() => {
    els.sceneStatus.hidden = true;
  }, 1800);
}

function getObjectLabel(object) {
  if (!object) return "";
  if (object.userData.kind === "asset") return object.userData.assetLabel || state.assetMap.get(object.userData.assetKey)?.label || "Gerät";
  if (object.userData.kind === "image") return object.userData.assetLabel || object.userData.text || "Eigenes Bild";
  return getKindLabel(object.userData.kind);
}

function getKindLabel(kind) {
  if (kind === "person") return "Person";
  if (kind === "group") return "Gruppe";
  if (kind === "people") return "Personen";
  if (kind === "number") return "Nummer";
  if (kind === "text") return "Text";
  if (kind === "zone") return "Zone";
  if (kind === "line") return "Linie";
  if (kind === "arrow") return "Pfeil";
  if (kind === "image") return "Bild";
  return "Objekt";
}

function makeId() {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function round(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value) {
  let degrees = value % 360;
  if (degrees > 180) degrees -= 360;
  if (degrees < -180) degrees += 360;
  return degrees;
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "3d-hallenplan";
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function render() {
  orbitControls.update();
  updateRotationNudgeControls();
  renderer.render(scene, camera);
}
