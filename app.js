/* =========================================================
   THIRD MOLAR GOLD STANDARD PLATFORM — ASSESSMENT FORM v2
   ========================================================= */

let radiographs = [];
let currentImageIndex = 0;

let currentEvaluatorId = "";
let currentUserId = "";

let imageAssessmentMap = new Map();
let toothAssessmentMap = new Map();

let autosaveTimer = null;
let appReady = false;

let currentRadiographObjectUrl = null;
let imageLoadToken = 0;

const TOOTH_NUMBERS = ["38", "48"];

const IAN_KEYS = [
  "DarkeningRoot",
  "DeflectionRoot",
  "NarrowingRoot",
  "DarkBifidRoot",
  "InterruptionWhiteLine",
  "DiversionCanal",
  "NarrowingCanal"
];

document.addEventListener("DOMContentLoaded", async () => {
  setText("jsStatus", "JavaScript status: loaded");

  injectLoginOverlay();
  injectTopControls();

  bindStaticEvents();
  bindAssessmentEvents();
  bindIanCheckboxLogic();
  restoreObserverInfo();

  await restoreCloudSession();
});


/* =========================================================
   LOGIN / SESSION
   ========================================================= */

function injectLoginOverlay() {
  if (document.getElementById("cloudLoginOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "cloudLoginOverlay";
  overlay.innerHTML = `
    <div class="cloud-login-card">
      <div class="cloud-login-kicker">Radiograph Gold Standard Platform</div>
      <h2>Observer Sign In</h2>
      <p>กรอก Evaluator ID และรหัสผ่านที่ได้รับจากทีมวิจัย</p>

      <label for="cloudEvaluatorId">Evaluator ID</label>
      <input id="cloudEvaluatorId" type="text" placeholder="E01" autocomplete="username">

      <label for="cloudPassword">Password</label>
      <input id="cloudPassword" type="password" placeholder="Password" autocomplete="current-password">

      <button id="cloudLoginBtn" type="button">Sign In</button>
      <div id="cloudLoginStatus">Not signed in.</div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #cloudLoginOverlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(15,18,35,.86);
      backdrop-filter: blur(8px);
    }

    .cloud-login-card {
      width: min(440px, 100%);
      background: #fff;
      color: #1d2050;
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 24px 70px rgba(0,0,0,.28);
    }

    .cloud-login-kicker {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      opacity: .65;
      font-weight: 700;
    }

    .cloud-login-card h2 {
      margin: 8px 0;
    }

    .cloud-login-card p {
      color: #62667d;
      line-height: 1.5;
    }

    .cloud-login-card label {
      display: block;
      margin: 13px 0 6px;
    }

    .cloud-login-card input {
      width: 100%;
      padding: 12px;
      border: 1px solid #c8cbd8;
      border-radius: 10px;
    }

    #cloudLoginBtn {
      width: 100%;
      margin-top: 18px;
    }

    #cloudLoginStatus {
      margin-top: 12px;
      min-height: 20px;
      white-space: pre-line;
      font-size: 14px;
    }

    #cloudTopControls {
      position: fixed;
      top: 14px;
      right: 14px;
      z-index: 9000;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255,255,255,.96);
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0,0,0,.14);
    }

    #cloudSaveIndicator {
      font-size: 13px;
      font-weight: 700;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  document.getElementById("cloudLoginBtn")
    .addEventListener("click", signInObserver);

  document.getElementById("cloudPassword")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") signInObserver();
    });
}


function injectTopControls() {
  if (document.getElementById("cloudTopControls")) return;

  const controls = document.createElement("div");
  controls.id = "cloudTopControls";
  controls.innerHTML = `
    <span id="cloudEvaluatorBadge"></span>
    <span id="cloudSaveIndicator"></span>
    <button id="cloudLogoutBtn" type="button">Sign Out</button>
  `;

  document.body.appendChild(controls);

  document.getElementById("cloudLogoutBtn")
    .addEventListener("click", signOutObserver);
}


async function signInObserver() {
  const status = document.getElementById("cloudLoginStatus");

  const evaluatorId = String(
    document.getElementById("cloudEvaluatorId").value || ""
  ).trim().toUpperCase();

  const password = document.getElementById("cloudPassword").value || "";

  if (!window.EVALUATOR_EMAILS || !window.EVALUATOR_EMAILS[evaluatorId]) {
    status.textContent = "Invalid Evaluator ID.";
    return;
  }

  if (!password) {
    status.textContent = "Please enter your password.";
    return;
  }

  status.textContent = "Signing in...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: window.EVALUATOR_EMAILS[evaluatorId],
    password
  });

  if (error || !data.user) {
    status.textContent =
      "Sign in failed.\n" + (error ? error.message : "Unknown authentication error.");
    return;
  }

  const verified = await verifyEvaluatorIdentity(data.user.id, evaluatorId);

  if (!verified) {
    await supabaseClient.auth.signOut();
    status.textContent = "Evaluator identity verification failed.";
    return;
  }

  await startCloudStudy(data.user.id, evaluatorId);
}


async function restoreCloudSession() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    showLoginOverlay();
    return;
  }

  const { data: evaluator, error: evaluatorError } =
    await supabaseClient
      .from("evaluators")
      .select("evaluator_id")
      .eq("user_id", data.user.id)
      .single();

  if (evaluatorError || !evaluator) {
    await supabaseClient.auth.signOut();
    showLoginOverlay("This account is not registered as a study evaluator.");
    return;
  }

  await startCloudStudy(data.user.id, evaluator.evaluator_id);
}


async function verifyEvaluatorIdentity(userId, evaluatorId) {
  const { data, error } =
    await supabaseClient
      .from("evaluators")
      .select("evaluator_id")
      .eq("user_id", userId)
      .single();

  return !error && data && data.evaluator_id === evaluatorId;
}


async function startCloudStudy(userId, evaluatorId) {
  currentUserId = userId;
  currentEvaluatorId = evaluatorId;

  setValue("evaluatorId", evaluatorId);
  setText("cloudEvaluatorBadge", "Evaluator: " + evaluatorId);

  document.getElementById("cloudTopControls").style.display = "flex";

  hideLoginOverlay();
  saveObserverInfo();
  setCloudSaveIndicator("Loading dataset...");

  const loaded = await loadCloudDataset();
  if (!loaded) return;

  const assessmentsLoaded = await loadOwnV2Assessments();
  if (!assessmentsLoaded) return;

  chooseResumeImage();

  appReady = true;
  await showCurrentImage();
}


async function signOutObserver() {
  await flushAutosave();
  releaseCurrentRadiographUrl();

  await supabaseClient.auth.signOut();

  appReady = false;
  radiographs = [];

  imageAssessmentMap.clear();
  toothAssessmentMap.clear();

  currentImageIndex = 0;
  currentEvaluatorId = "";
  currentUserId = "";

  clearCurrentForm();

  const image = document.getElementById("radiographImage");
  if (image) image.removeAttribute("src");

  document.getElementById("cloudTopControls").style.display = "none";
  document.getElementById("cloudPassword").value = "";
  document.getElementById("cloudEvaluatorId").value = "";

  showLoginOverlay("Signed out.");
}


function showLoginOverlay(message) {
  const overlay = document.getElementById("cloudLoginOverlay");
  if (overlay) overlay.style.display = "flex";

  if (message) setText("cloudLoginStatus", message);
}


function hideLoginOverlay() {
  const overlay = document.getElementById("cloudLoginOverlay");
  if (overlay) overlay.style.display = "none";
}


/* =========================================================
   DATASET / SAVED DATA
   ========================================================= */

async function loadCloudDataset() {
  const { data, error } =
    await supabaseClient
      .from("radiographs")
      .select("id,image_order,image_id,file_name,storage_path")
      .order("image_order", { ascending: true })
      .range(0, 999);

  if (error) {
    showViewerError("Cannot load radiograph dataset:\n" + error.message);
    setCloudSaveIndicator("Dataset error");
    return false;
  }

  radiographs = data || [];

  if (radiographs.length !== 1000) {
    showViewerError(
      "Dataset validation failed.\nExpected 1000 radiographs but received " +
      radiographs.length +
      "."
    );

    setCloudSaveIndicator("Dataset incomplete");
    return false;
  }

  return true;
}


async function loadOwnV2Assessments() {
  const [imageResult, toothResult] = await Promise.all([
    supabaseClient
      .from("image_assessments_v2")
      .select("*")
      .eq("evaluator_user_id", currentUserId),

    supabaseClient
      .from("tooth_assessments_v2")
      .select("*")
      .eq("evaluator_user_id", currentUserId)
  ]);

  if (imageResult.error) {
    alert(
      "Cannot load image assessments v2:\n" +
      imageResult.error.message +
      "\n\nDid you run supabase-v2-migration.sql?"
    );
    return false;
  }

  if (toothResult.error) {
    alert(
      "Cannot load tooth assessments v2:\n" +
      toothResult.error.message +
      "\n\nDid you run supabase-v2-migration.sql?"
    );
    return false;
  }

  imageAssessmentMap.clear();
  toothAssessmentMap.clear();

  (imageResult.data || []).forEach((record) => {
    imageAssessmentMap.set(record.radiograph_id, record);
  });

  (toothResult.data || []).forEach((record) => {
    toothAssessmentMap.set(
      toothKey(record.radiograph_id, record.tooth_number),
      record
    );
  });

  updateProgressDashboard();
  return true;
}


function chooseResumeImage() {
  const firstDraft = radiographs.findIndex((radiograph) => {
    const record = imageAssessmentMap.get(radiograph.id);
    return record && record.status === "draft";
  });

  if (firstDraft >= 0) {
    currentImageIndex = firstDraft;
    return;
  }

  const firstIncomplete = radiographs.findIndex((radiograph) => {
    const record = imageAssessmentMap.get(radiograph.id);
    return !record || record.status !== "completed";
  });

  currentImageIndex =
    firstIncomplete >= 0
      ? firstIncomplete
      : Math.max(radiographs.length - 1, 0);
}


/* =========================================================
   IMAGE VIEWER
   ========================================================= */

async function showCurrentImage() {
  if (!appReady || !radiographs.length) return;

  const token = ++imageLoadToken;
  const record = radiographs[currentImageIndex];

  setText(
    "imageProgress",
    `Image ${currentImageIndex + 1} of ${radiographs.length} | ${record.image_id}`
  );

  setText("imageIdDisplay", record.image_id);

  clearCurrentForm();
  loadCurrentAssessmentIntoForm(record.id);
  updateProgressDashboard();

  const image = document.getElementById("radiographImage");
  const loading = document.getElementById("radiographLoading");
  const errorBox = document.getElementById("radiographError");

  if (!image) {
    showViewerError("System error: radiographImage is missing.");
    return;
  }

  releaseCurrentRadiographUrl();
  image.removeAttribute("src");

  if (loading) {
    loading.hidden = false;
    loading.textContent = "กำลังโหลดภาพรังสี...";
  }

  if (errorBox) {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  setCloudSaveIndicator("Loading image...");

  const { data: blob, error } =
    await supabaseClient
      .storage
      .from("radiographs")
      .download(record.storage_path);

  if (token !== imageLoadToken) return;

  if (error) {
    showViewerError(
      `ไม่สามารถดาวน์โหลด ${record.image_id} ได้\n${error.message}\nPath: ${record.storage_path}`
    );
    setCloudSaveIndicator("Image download failed");
    return;
  }

  if (!blob) {
    showViewerError(`ไม่พบข้อมูลไฟล์สำหรับ ${record.image_id}`);
    return;
  }

  const arrayBuffer = await blob.arrayBuffer();

  if (!arrayBuffer.byteLength) {
    showViewerError(`ไฟล์ ${record.image_id} มีขนาด 0 bytes`);
    return;
  }

  const mime = detectRadiographMime(arrayBuffer);

  if (!mime) {
    if (isDicomFile(arrayBuffer)) {
      showViewerError(
        `${record.image_id} เป็น DICOM ซึ่งไม่สามารถแสดงด้วย <img> โดยตรง`
      );
    } else {
      showViewerError(
        `${record.image_id} ไม่ใช่ PNG / JPEG / WebP / GIF / BMP ที่ browser รองรับ`
      );
    }
    return;
  }

  const correctedBlob = new Blob([arrayBuffer], { type: mime });
  currentRadiographObjectUrl = URL.createObjectURL(correctedBlob);

  image.onload = () => {
    if (token !== imageLoadToken) return;
    if (loading) loading.hidden = true;
    if (errorBox) errorBox.hidden = true;
    setCloudSaveIndicator(getCurrentAssessmentIndicator());
  };

  image.onerror = () => {
    if (token !== imageLoadToken) return;
    if (loading) loading.hidden = true;

    showViewerError(
      `Browser ไม่สามารถ decode ${record.image_id} ได้\nDetected type: ${mime}`
    );

    setCloudSaveIndicator("Image decode failed");
  };

  image.src = currentRadiographObjectUrl;
  image.alt = "Panoramic radiograph " + record.image_id;
}


function showViewerError(message) {
  const loading = document.getElementById("radiographLoading");
  const errorBox = document.getElementById("radiographError");

  if (loading) loading.hidden = true;

  if (errorBox) {
    errorBox.hidden = false;
    errorBox.textContent = message;
  } else {
    alert(message);
  }
}


function retryCurrentImage() {
  if (appReady) showCurrentImage();
}


function releaseCurrentRadiographUrl() {
  if (currentRadiographObjectUrl) {
    URL.revokeObjectURL(currentRadiographObjectUrl);
    currentRadiographObjectUrl = null;
  }
}


function detectRadiographMime(arrayBuffer) {
  const b = new Uint8Array(arrayBuffer);

  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
    return "image/jpeg";
  }

  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4E &&
    b[3] === 0x47 &&
    b[4] === 0x0D &&
    b[5] === 0x0A &&
    b[6] === 0x1A &&
    b[7] === 0x0A
  ) {
    return "image/png";
  }

  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "image/webp";
  }

  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38
  ) {
    return "image/gif";
  }

  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4D) {
    return "image/bmp";
  }

  return null;
}


function isDicomFile(arrayBuffer) {
  const b = new Uint8Array(arrayBuffer);

  return (
    b.length >= 132 &&
    b[128] === 0x44 &&
    b[129] === 0x49 &&
    b[130] === 0x43 &&
    b[131] === 0x4D
  );
}


/* =========================================================
   FORM EVENTS
   ========================================================= */

function bindStaticEvents() {
  bindClick("retryImageBtn", retryCurrentImage);
  bindClick("prevImageBtn", previousImage);
  bindClick("nextImageBtn", nextImage);
  bindClick("jumpImageBtn", jumpToImage);
  bindClick("nextUnsavedBtn", goToNextUnsavedImage);

  bindClick("saveAssessmentBtn", () => completeCurrentImage(true));
  bindClick("saveNextBtn", saveAndNext);

  bindClick("exportCsvBtn", exportToothLevelCSV);
}


function bindAssessmentEvents() {
  [
    "imageQuality",
    "overallComment",
    "participantId",
    "experienceYears",
    "specialty"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    const eventName =
      element.tagName === "TEXTAREA" || element.type === "text"
        ? "input"
        : "change";

    element.addEventListener(eventName, () => {
      if (["participantId", "experienceYears", "specialty"].includes(id)) {
        saveObserverInfo();
        return;
      }

      scheduleAutosave();
    });
  });

  TOOTH_NUMBERS.forEach((tooth) => {
    const status = document.getElementById(`tooth${tooth}Status`);

    status.addEventListener("change", () => {
      updateToothDetailsVisibility(tooth, true);
      updateToothBadge(tooth);
      scheduleAutosave();
    });

    [
      `tooth${tooth}Angulation`,
      `tooth${tooth}PellRamus`,
      `tooth${tooth}PellDepth`,
      `tooth${tooth}IanRisk`,
      `tooth${tooth}Confidence`,
      `tooth${tooth}Comment`
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;

      const eventName =
        element.tagName === "TEXTAREA" ? "input" : "change";

      element.addEventListener(eventName, scheduleAutosave);
    });
  });
}


function bindIanCheckboxLogic() {
  TOOTH_NUMBERS.forEach((tooth) => {
    const signBoxes = IAN_KEYS.map((key) =>
      document.getElementById(`tooth${tooth}Ian${key}`)
    );

    const noneBox =
      document.getElementById(`tooth${tooth}IanNoneObserved`);

    const cannotBox =
      document.getElementById(`tooth${tooth}IanCannotDetermine`);

    signBoxes.forEach((box) => {
      box.addEventListener("change", () => {
        if (box.checked) {
          noneBox.checked = false;
          cannotBox.checked = false;
        }

        scheduleAutosave();
      });
    });

    noneBox.addEventListener("change", () => {
      if (noneBox.checked) {
        signBoxes.forEach((box) => { box.checked = false; });
        cannotBox.checked = false;
      }

      scheduleAutosave();
    });

    cannotBox.addEventListener("change", () => {
      if (cannotBox.checked) {
        signBoxes.forEach((box) => { box.checked = false; });
        noneBox.checked = false;
      }

      scheduleAutosave();
    });
  });
}


function updateToothDetailsVisibility(tooth, clearWhenHidden = false) {
  const status = getValue(`tooth${tooth}Status`);
  const details = document.getElementById(`tooth${tooth}Details`);

  const impacted = status === "impacted";
  details.hidden = !impacted;

  if (!impacted && clearWhenHidden) {
    clearToothDetails(tooth);
  }
}


function updateToothBadge(tooth) {
  const status = getValue(`tooth${tooth}Status`);
  const badge = document.getElementById(`tooth${tooth}Badge`);

  badge.className = "tooth-badge";

  if (!status) {
    badge.textContent = "Not assessed";
    return;
  }

  const labels = {
    impacted: "Impacted",
    present_not_impacted: "Present, not impacted",
    absent_not_visible: "Absent / not visible",
    cannot_determine: "Cannot determine"
  };

  badge.textContent = labels[status] || status;

  if (status === "impacted") {
    badge.classList.add("impacted");
  } else if (status === "cannot_determine") {
    badge.classList.add("unknown");
  } else {
    badge.classList.add("nonimpacted");
  }
}


/* =========================================================
   AUTOSAVE / SAVE
   ========================================================= */

function scheduleAutosave() {
  if (!appReady) return;

  clearTimeout(autosaveTimer);
  setCloudSaveIndicator("Saving draft...");

  autosaveTimer = setTimeout(async () => {
    autosaveTimer = null;

    const existing =
      imageAssessmentMap.get(radiographs[currentImageIndex].id);

    const validNow =
      getMissingRequiredFields().length === 0;

    const status =
      existing &&
      existing.status === "completed" &&
      validNow
        ? "completed"
        : "draft";

    await saveCurrentState(status, false);
  }, 700);
}


async function flushAutosave() {
  if (!autosaveTimer) return;

  clearTimeout(autosaveTimer);
  autosaveTimer = null;

  const existing =
    imageAssessmentMap.get(radiographs[currentImageIndex].id);

  const validNow =
    getMissingRequiredFields().length === 0;

  const status =
    existing &&
    existing.status === "completed" &&
    validNow
      ? "completed"
      : "draft";

  await saveCurrentState(status, false);
}


async function saveCurrentState(status, showErrorAlert = true) {
  if (!appReady || !currentUserId || !radiographs[currentImageIndex]) {
    return false;
  }

  const radiograph = radiographs[currentImageIndex];

  const imagePayload = {
    evaluator_user_id: currentUserId,
    radiograph_id: radiograph.id,
    image_quality: nullIfEmpty(getValue("imageQuality")),
    overall_comment: nullIfEmpty(getValue("overallComment")),
    status,
    form_version: "v2"
  };

  const toothPayloads = TOOTH_NUMBERS.map((tooth) =>
    buildToothPayload(radiograph.id, tooth)
  );

  setCloudSaveIndicator(status === "completed" ? "Saving..." : "Saving draft...");

  const [imageResult, toothResult] = await Promise.all([
    supabaseClient
      .from("image_assessments_v2")
      .upsert(imagePayload, {
        onConflict: "evaluator_user_id,radiograph_id"
      })
      .select()
      .single(),

    supabaseClient
      .from("tooth_assessments_v2")
      .upsert(toothPayloads, {
        onConflict: "evaluator_user_id,radiograph_id,tooth_number"
      })
      .select()
  ]);

  if (imageResult.error || toothResult.error) {
    console.error("v2 save error", {
      image: imageResult.error,
      teeth: toothResult.error
    });

    setCloudSaveIndicator("Save failed");

    if (showErrorAlert) {
      alert(
        "Assessment could not be saved.\n\n" +
        (imageResult.error?.message || toothResult.error?.message || "Unknown error")
      );
    }

    return false;
  }

  imageAssessmentMap.set(
    imageResult.data.radiograph_id,
    imageResult.data
  );

  (toothResult.data || []).forEach((record) => {
    toothAssessmentMap.set(
      toothKey(record.radiograph_id, record.tooth_number),
      record
    );
  });

  setCloudSaveIndicator(
    status === "completed"
      ? "Completed ✓"
      : "Draft saved"
  );

  updateProgressDashboard();

  return true;
}


function buildToothPayload(radiographId, tooth) {
  const impacted =
    getValue(`tooth${tooth}Status`) === "impacted";

  return {
    evaluator_user_id: currentUserId,
    radiograph_id: radiographId,
    tooth_number: tooth,

    impaction_status:
      nullIfEmpty(getValue(`tooth${tooth}Status`)),

    angulation:
      impacted
        ? nullIfEmpty(getValue(`tooth${tooth}Angulation`))
        : null,

    pell_ramus:
      impacted
        ? nullIfEmpty(getValue(`tooth${tooth}PellRamus`))
        : null,

    pell_depth:
      impacted
        ? nullIfEmpty(getValue(`tooth${tooth}PellDepth`))
        : null,

    ian_darkening_root:
      impacted && getChecked(`tooth${tooth}IanDarkeningRoot`),

    ian_deflection_root:
      impacted && getChecked(`tooth${tooth}IanDeflectionRoot`),

    ian_narrowing_root:
      impacted && getChecked(`tooth${tooth}IanNarrowingRoot`),

    ian_dark_bifid_root:
      impacted && getChecked(`tooth${tooth}IanDarkBifidRoot`),

    ian_interruption_white_line:
      impacted && getChecked(`tooth${tooth}IanInterruptionWhiteLine`),

    ian_diversion_canal:
      impacted && getChecked(`tooth${tooth}IanDiversionCanal`),

    ian_narrowing_canal:
      impacted && getChecked(`tooth${tooth}IanNarrowingCanal`),

    ian_none_observed:
      impacted && getChecked(`tooth${tooth}IanNoneObserved`),

    ian_cannot_determine:
      impacted && getChecked(`tooth${tooth}IanCannotDetermine`),

    overall_ian_risk:
      impacted
        ? nullIfEmpty(getValue(`tooth${tooth}IanRisk`))
        : null,

    confidence_score:
      impacted && getValue(`tooth${tooth}Confidence`)
        ? Number(getValue(`tooth${tooth}Confidence`))
        : null,

    comment:
      impacted
        ? nullIfEmpty(getValue(`tooth${tooth}Comment`))
        : null,

    form_version: "v2"
  };
}


async function completeCurrentImage(showConfirmation) {
  if (!appReady) return false;

  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }

  const missing = getMissingRequiredFields();

  if (missing.length) {
    alert(
      "Please complete the following before marking this image complete:\n\n" +
      missing.join("\n")
    );

    return false;
  }

  const saved = await saveCurrentState("completed", true);

  if (saved && showConfirmation) {
    alert("Assessment completed and saved.");
  }

  return saved;
}


async function saveAndNext() {
  const saved = await completeCurrentImage(false);

  if (!saved) return;

  if (currentImageIndex < radiographs.length - 1) {
    currentImageIndex++;
    await showCurrentImage();
  } else {
    alert("Assessment saved. This is the last image.");
  }
}


function getMissingRequiredFields() {
  const missing = [];

  if (!getValue("imageQuality")) {
    missing.push("• Image Quality");
  }

  TOOTH_NUMBERS.forEach((tooth) => {
    const status = getValue(`tooth${tooth}Status`);

    if (!status) {
      missing.push(`• Tooth ${tooth}: Impaction Status`);
      return;
    }

    if (status !== "impacted") return;

    if (!getValue(`tooth${tooth}Angulation`)) {
      missing.push(`• Tooth ${tooth}: Angulation`);
    }

    if (!getValue(`tooth${tooth}PellRamus`)) {
      missing.push(`• Tooth ${tooth}: Pell & Gregory Ramus`);
    }

    if (!getValue(`tooth${tooth}PellDepth`)) {
      missing.push(`• Tooth ${tooth}: Pell & Gregory Depth`);
    }

    if (!hasIanSelection(tooth)) {
      missing.push(`• Tooth ${tooth}: IAN Radiographic Signs`);
    }

    if (!getValue(`tooth${tooth}IanRisk`)) {
      missing.push(`• Tooth ${tooth}: Overall IAN Risk`);
    }

    if (!getValue(`tooth${tooth}Confidence`)) {
      missing.push(`• Tooth ${tooth}: Confidence Score`);
    }
  });

  return missing;
}


function hasIanSelection(tooth) {
  const ids = [
    ...IAN_KEYS.map((key) => `tooth${tooth}Ian${key}`),
    `tooth${tooth}IanNoneObserved`,
    `tooth${tooth}IanCannotDetermine`
  ];

  return ids.some(getChecked);
}


/* =========================================================
   LOAD FORM
   ========================================================= */

function loadCurrentAssessmentIntoForm(radiographId) {
  const imageRecord =
    imageAssessmentMap.get(radiographId);

  if (imageRecord) {
    setValue("imageQuality", imageRecord.image_quality);
    setValue("overallComment", imageRecord.overall_comment);
  }

  TOOTH_NUMBERS.forEach((tooth) => {
    const record =
      toothAssessmentMap.get(toothKey(radiographId, tooth));

    if (!record) {
      updateToothDetailsVisibility(tooth, false);
      updateToothBadge(tooth);
      return;
    }

    setValue(`tooth${tooth}Status`, record.impaction_status);
    setValue(`tooth${tooth}Angulation`, record.angulation);
    setValue(`tooth${tooth}PellRamus`, record.pell_ramus);
    setValue(`tooth${tooth}PellDepth`, record.pell_depth);
    setValue(`tooth${tooth}IanRisk`, record.overall_ian_risk);
    setValue(`tooth${tooth}Confidence`, record.confidence_score);
    setValue(`tooth${tooth}Comment`, record.comment);

    setChecked(`tooth${tooth}IanDarkeningRoot`, record.ian_darkening_root);
    setChecked(`tooth${tooth}IanDeflectionRoot`, record.ian_deflection_root);
    setChecked(`tooth${tooth}IanNarrowingRoot`, record.ian_narrowing_root);
    setChecked(`tooth${tooth}IanDarkBifidRoot`, record.ian_dark_bifid_root);
    setChecked(`tooth${tooth}IanInterruptionWhiteLine`, record.ian_interruption_white_line);
    setChecked(`tooth${tooth}IanDiversionCanal`, record.ian_diversion_canal);
    setChecked(`tooth${tooth}IanNarrowingCanal`, record.ian_narrowing_canal);
    setChecked(`tooth${tooth}IanNoneObserved`, record.ian_none_observed);
    setChecked(`tooth${tooth}IanCannotDetermine`, record.ian_cannot_determine);

    updateToothDetailsVisibility(tooth, false);
    updateToothBadge(tooth);
  });

  setCloudSaveIndicator(getCurrentAssessmentIndicator());
}


function clearCurrentForm() {
  setValue("imageQuality", "");
  setValue("overallComment", "");

  TOOTH_NUMBERS.forEach((tooth) => {
    setValue(`tooth${tooth}Status`, "");
    clearToothDetails(tooth);

    const details = document.getElementById(`tooth${tooth}Details`);
    if (details) details.hidden = true;

    updateToothBadge(tooth);
  });
}


function clearToothDetails(tooth) {
  setValue(`tooth${tooth}Angulation`, "");
  setValue(`tooth${tooth}PellRamus`, "");
  setValue(`tooth${tooth}PellDepth`, "");
  setValue(`tooth${tooth}IanRisk`, "");
  setValue(`tooth${tooth}Confidence`, "");
  setValue(`tooth${tooth}Comment`, "");

  IAN_KEYS.forEach((key) => {
    setChecked(`tooth${tooth}Ian${key}`, false);
  });

  setChecked(`tooth${tooth}IanNoneObserved`, false);
  setChecked(`tooth${tooth}IanCannotDetermine`, false);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

async function previousImage() {
  if (!appReady || currentImageIndex <= 0) return;

  await flushAutosave();

  currentImageIndex--;
  await showCurrentImage();
}


async function nextImage() {
  if (!appReady || currentImageIndex >= radiographs.length - 1) return;

  await flushAutosave();

  currentImageIndex++;
  await showCurrentImage();
}


async function jumpToImage() {
  if (!appReady) return;

  const number = Number(getValue("jumpImageNumber"));

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > radiographs.length
  ) {
    alert(`Enter an image number between 1 and ${radiographs.length}.`);
    return;
  }

  await flushAutosave();

  currentImageIndex = number - 1;
  await showCurrentImage();
}


async function goToNextUnsavedImage() {
  if (!appReady) return;

  await flushAutosave();

  for (let step = 1; step <= radiographs.length; step++) {
    const index =
      (currentImageIndex + step) %
      radiographs.length;

    const record =
      imageAssessmentMap.get(radiographs[index].id);

    if (!record || record.status !== "completed") {
      currentImageIndex = index;
      await showCurrentImage();
      return;
    }
  }

  alert("All 1000 radiographs are completed.");
}


/* =========================================================
   PROGRESS / COMPLETION
   ========================================================= */

function updateProgressDashboard() {
  const completed =
    Array.from(imageAssessmentMap.values())
      .filter((record) => record.status === "completed")
      .length;

  setText("savedImageCount", completed);
  setText("remainingImageCount", Math.max(radiographs.length - completed, 0));

  const current =
    radiographs[currentImageIndex];

  const record =
    current
      ? imageAssessmentMap.get(current.id)
      : null;

  const currentStatus =
    document.getElementById("currentSaveStatus");

  if (currentStatus) {
    if (record?.status === "completed") {
      currentStatus.textContent = "Completed";
      currentStatus.className = "saved";
    } else if (record) {
      currentStatus.textContent = "Draft saved";
      currentStatus.className = "unsaved";
    } else {
      currentStatus.textContent = "Not saved";
      currentStatus.className = "unsaved";
    }
  }

  checkStudyCompletion(completed);
}


function getCurrentAssessmentIndicator() {
  const current =
    radiographs[currentImageIndex];

  if (!current) return "";

  const record =
    imageAssessmentMap.get(current.id);

  if (!record) return "Not saved";

  return record.status === "completed"
    ? "Completed ✓"
    : "Draft saved";
}


function checkStudyCompletion(completedCount) {
  const overlay =
    document.getElementById("studyCompletionOverlay");

  if (
    overlay &&
    radiographs.length === 1000 &&
    completedCount === 1000
  ) {
    overlay.classList.add("show");
  }
}


document.addEventListener("click", (event) => {
  if (event.target?.id === "completionCloseBtn") {
    document
      .getElementById("studyCompletionOverlay")
      ?.classList.remove("show");
  }
});


/* =========================================================
   EXPORT — 1 TOOTH / SITE = 1 ROW
   ========================================================= */

function exportToothLevelCSV() {
  if (!appReady) return;

  const headers = [
    "evaluator_id",
    "image_order",
    "image_id",
    "file_name",
    "image_quality",
    "image_status",
    "tooth_number",
    "impaction_status",
    "angulation",
    "pell_ramus",
    "pell_depth",
    "ian_darkening_root",
    "ian_deflection_root",
    "ian_narrowing_root",
    "ian_dark_bifid_root",
    "ian_interruption_white_line",
    "ian_diversion_canal",
    "ian_narrowing_canal",
    "ian_none_observed",
    "ian_cannot_determine",
    "overall_ian_risk",
    "confidence_score",
    "tooth_comment",
    "overall_image_comment",
    "form_version"
  ];

  const rows = [headers.join(",")];

  radiographs.forEach((radiograph) => {
    const imageRecord =
      imageAssessmentMap.get(radiograph.id) || {};

    TOOTH_NUMBERS.forEach((tooth) => {
      const toothRecord =
        toothAssessmentMap.get(toothKey(radiograph.id, tooth)) || {};

      const row = {
        evaluator_id: currentEvaluatorId,
        image_order: radiograph.image_order,
        image_id: radiograph.image_id,
        file_name: radiograph.file_name,
        image_quality: imageRecord.image_quality || "",
        image_status: imageRecord.status || "unlabelled",
        tooth_number: tooth,
        impaction_status: toothRecord.impaction_status || "",
        angulation: toothRecord.angulation || "",
        pell_ramus: toothRecord.pell_ramus || "",
        pell_depth: toothRecord.pell_depth || "",
        ian_darkening_root: boolCsv(toothRecord.ian_darkening_root),
        ian_deflection_root: boolCsv(toothRecord.ian_deflection_root),
        ian_narrowing_root: boolCsv(toothRecord.ian_narrowing_root),
        ian_dark_bifid_root: boolCsv(toothRecord.ian_dark_bifid_root),
        ian_interruption_white_line: boolCsv(toothRecord.ian_interruption_white_line),
        ian_diversion_canal: boolCsv(toothRecord.ian_diversion_canal),
        ian_narrowing_canal: boolCsv(toothRecord.ian_narrowing_canal),
        ian_none_observed: boolCsv(toothRecord.ian_none_observed),
        ian_cannot_determine: boolCsv(toothRecord.ian_cannot_determine),
        overall_ian_risk: toothRecord.overall_ian_risk || "",
        confidence_score: toothRecord.confidence_score || "",
        tooth_comment: toothRecord.comment || "",
        overall_image_comment: imageRecord.overall_comment || "",
        form_version: "v2"
      };

      rows.push(
        headers
          .map((header) => escapeCSV(row[header]))
          .join(",")
      );
    });
  });

  const blob =
    new Blob(
      ["\uFEFF" + rows.join("\n")],
      { type: "text/csv;charset=utf-8;" }
    );

  const date =
    new Date().toISOString().slice(0, 10);

  downloadBlob(
    blob,
    `${currentEvaluatorId}_tooth_level_v2_${date}.csv`
  );
}


/* =========================================================
   OBSERVER INFO
   ========================================================= */

function saveObserverInfo() {
  const data = {
    participant_id: getValue("participantId"),
    experience_years: getValue("experienceYears"),
    specialty: getValue("specialty")
  };

  localStorage.setItem(
    "observer_info_v2",
    JSON.stringify(data)
  );
}


function restoreObserverInfo() {
  const data =
    JSON.parse(
      localStorage.getItem("observer_info_v2") || "{}"
    );

  setValue("participantId", data.participant_id);
  setValue("experienceYears", data.experience_years);
  setValue("specialty", data.specialty);
}


/* =========================================================
   HELPERS
   ========================================================= */

function toothKey(radiographId, tooth) {
  return `${radiographId}:${tooth}`;
}


function setCloudSaveIndicator(text) {
  setText("cloudSaveIndicator", text);
}


function bindClick(id, handler) {
  document
    .getElementById(id)
    ?.addEventListener("click", handler);
}


function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}


function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}


function getChecked(id) {
  return Boolean(document.getElementById(id)?.checked);
}


function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(value);
}


function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}


function nullIfEmpty(value) {
  return value === "" ? null : value;
}


function boolCsv(value) {
  if (value === true) return "1";
  if (value === false) return "0";
  return "";
}


function escapeCSV(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}


function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
