let radiographs = [];
let assessments = new Map();
let currentImageIndex = 0;
let currentUserId = "";
let currentEvaluatorId = "";
let autosaveTimer = null;
let appReady = false;

const FIELD_IDS = [
  "targetTooth",
  "imageQuality",
  "angulation",
  "pellRamus",
  "pellDepth",
  "ianRisk",
  "confidenceScore",
  "comment"
];

document.addEventListener("DOMContentLoaded", async function () {
  setJavaScriptStatus("JavaScript status: loaded");
  prepareCloudUI();
  bindButtons();
  bindAutosave();
  restoreObserverInfo();
  await restoreSession();
});

function prepareCloudUI() {
  const imageUpload = document.getElementById("imageUpload");
  if (imageUpload) imageUpload.style.display = "none";

  const uploadLabel = document.querySelector('label[for="imageUpload"]');
  if (uploadLabel) uploadLabel.style.display = "none";

  const clearBtn = document.getElementById("clearDataBtn");
  if (clearBtn) clearBtn.style.display = "none";

  const importBtn = document.getElementById("importBackupBtn");
  if (importBtn) importBtn.style.display = "none";

  if (!document.getElementById("cloudLoginOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "cloudLoginOverlay";
    overlay.innerHTML = `
      <div class="cloud-login-card">
        <div class="cloud-kicker">Radiograph Gold Standard Platform</div>
        <h2>Observer Sign In</h2>
        <p>Use the evaluator ID and password provided by the research team.</p>
        <label>Evaluator ID</label>
        <input id="cloudEvaluatorId" type="text" placeholder="E01" autocomplete="username">
        <label>Password</label>
        <input id="cloudPassword" type="password" placeholder="Password" autocomplete="current-password">
        <button id="cloudLoginBtn" type="button">Sign In</button>
        <div id="cloudLoginStatus">Not signed in.</div>
      </div>`;
    document.body.appendChild(overlay);

    const style = document.createElement("style");
    style.textContent = `
      #cloudLoginOverlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,18,35,.84);backdrop-filter:blur(8px)}
      .cloud-login-card{width:min(440px,100%);background:#fff;border-radius:18px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.3)}
      .cloud-login-card h2{margin:6px 0 8px}.cloud-login-card p{color:#555;line-height:1.5}.cloud-kicker{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.65}
      .cloud-login-card label{display:block;margin:14px 0 6px;font-weight:600}.cloud-login-card input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccc;border-radius:10px;font-size:16px}
      #cloudLoginBtn{width:100%;margin-top:18px;padding:12px;border:0;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer}#cloudLoginStatus{margin-top:14px;white-space:pre-line;font-size:14px}
      #cloudTopBar{position:fixed;top:16px;right:16px;z-index:9000;display:none;gap:10px;align-items:center;background:rgba(255,255,255,.95);padding:8px 10px;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.15)}
      #cloudSaveText{font-size:13px;font-weight:700}
    `;
    document.head.appendChild(style);

    document.getElementById("cloudLoginBtn").addEventListener("click", login);
    document.getElementById("cloudPassword").addEventListener("keydown", function (e) {
      if (e.key === "Enter") login();
    });
  }

  if (!document.getElementById("cloudTopBar")) {
    const bar = document.createElement("div");
    bar.id = "cloudTopBar";
    bar.innerHTML = `
      <span id="cloudEvaluatorText"></span>
      <span id="cloudSaveText"></span>
      <button id="cloudLogoutBtn" type="button">Sign Out</button>`;
    document.body.appendChild(bar);
    document.getElementById("cloudLogoutBtn").addEventListener("click", logout);
  }
}

async function login() {
  const status = document.getElementById("cloudLoginStatus");
  const evaluatorId = String(document.getElementById("cloudEvaluatorId").value || "").trim().toUpperCase();
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
    status.textContent = "Sign in failed.\n" + (error ? error.message : "Unknown error");
    return;
  }

  const { data: identity, error: identityError } = await supabaseClient
    .from("evaluators")
    .select("evaluator_id")
    .eq("user_id", data.user.id)
    .single();

  if (identityError || !identity || identity.evaluator_id !== evaluatorId) {
    await supabaseClient.auth.signOut();
    status.textContent = "Evaluator identity verification failed.";
    return;
  }

  await startStudy(data.user.id, evaluatorId);
}

async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data.user) return;

  const { data: identity, error: identityError } = await supabaseClient
    .from("evaluators")
    .select("evaluator_id")
    .eq("user_id", data.user.id)
    .single();

  if (identityError || !identity) return;
  await startStudy(data.user.id, identity.evaluator_id);
}

async function startStudy(userId, evaluatorId) {
  currentUserId = userId;
  currentEvaluatorId = evaluatorId;
  appReady = false;

  setValue("evaluatorId", evaluatorId);
  const evaluatorInput = document.getElementById("evaluatorId");
  if (evaluatorInput) evaluatorInput.readOnly = true;

  document.getElementById("cloudEvaluatorText").textContent = "Evaluator: " + evaluatorId;
  document.getElementById("cloudTopBar").style.display = "flex";
  document.getElementById("cloudLoginOverlay").style.display = "none";
  setCloudSaveText("Loading...");

  saveObserverInfo();

  const { data: dataset, error: datasetError } = await supabaseClient
    .from("radiographs")
    .select("id,image_order,image_id,file_name,storage_path")
    .order("image_order", { ascending: true })
    .range(0, 999);

  if (datasetError) {
    alert("Cannot load radiographs:\n" + datasetError.message);
    return;
  }

  radiographs = dataset || [];
  if (radiographs.length !== 1000) {
    alert("Dataset error: expected 1000 radiographs, received " + radiographs.length + ".");
    return;
  }

  const { data: ownRows, error: assessmentError } = await supabaseClient
    .from("assessments")
    .select("*")
    .eq("evaluator_user_id", currentUserId);

  if (assessmentError) {
    alert("Cannot load saved assessments:\n" + assessmentError.message);
    return;
  }

  assessments.clear();
  (ownRows || []).forEach(row => assessments.set(row.radiograph_id, row));

  const firstDraft = radiographs.findIndex(img => {
    const a = assessments.get(img.id);
    return a && a.status === "draft";
  });
  const firstIncomplete = radiographs.findIndex(img => {
    const a = assessments.get(img.id);
    return !a || a.status !== "completed";
  });

  currentImageIndex = firstDraft >= 0 ? firstDraft : (firstIncomplete >= 0 ? firstIncomplete : 999);
  appReady = true;
  updateSavedCount();
  updateProgressDashboard();
  await showCurrentImage();
}

async function logout() {
  await flushAutosave();
  await supabaseClient.auth.signOut();
  appReady = false;
  radiographs = [];
  assessments.clear();
  currentImageIndex = 0;
  currentUserId = "";
  currentEvaluatorId = "";
  clearAssessmentFields();
  document.getElementById("cloudTopBar").style.display = "none";
  document.getElementById("cloudLoginOverlay").style.display = "flex";
  document.getElementById("cloudPassword").value = "";
  document.getElementById("cloudEvaluatorId").value = "";
  document.getElementById("cloudLoginStatus").textContent = "Signed out.";
}

async function showCurrentImage() {
  if (!appReady || !radiographs.length) return;

  const record = radiographs[currentImageIndex];
  const image = document.getElementById("radiographImage");
  const progress = document.getElementById("imageProgress");

  setValue("imageId", record.image_id);
  if (progress) progress.textContent = `Image ${currentImageIndex + 1} of ${radiographs.length} | ${record.image_id}`;

  clearAssessmentFields();
  loadAssessmentToForm(record.id);
  updateProgressDashboard();

  if (!image) return;
  image.classList.remove("has-image");

  const { data, error } = await supabaseClient.storage
    .from("radiographs")
    .createSignedUrl(record.storage_path, 3600);

  if (error) {
    alert("Cannot load " + record.image_id + ":\n" + error.message);
    return;
  }

  image.onload = () => image.classList.add("has-image");
  image.onerror = () => image.classList.remove("has-image");
  image.src = data.signedUrl;
  image.alt = "Panoramic radiograph " + record.image_id;
}

function bindButtons() {
  bindClick("prevImageBtn", async function () {
    if (!appReady || currentImageIndex <= 0) return;
    await flushAutosave();
    currentImageIndex--;
    await showCurrentImage();
  });

  bindClick("nextImageBtn", async function () {
    if (!appReady || currentImageIndex >= radiographs.length - 1) return;
    await flushAutosave();
    currentImageIndex++;
    await showCurrentImage();
  });

  bindClick("jumpImageBtn", async function () {
    if (!appReady) return;
    const n = Number(getValue("jumpImageNumber"));
    if (!Number.isInteger(n) || n < 1 || n > radiographs.length) {
      alert("Enter an image number between 1 and " + radiographs.length + ".");
      return;
    }
    await flushAutosave();
    currentImageIndex = n - 1;
    await showCurrentImage();
  });

  bindClick("saveAssessmentBtn", async function () {
    await completeCurrentAssessment(true);
  });

  bindClick("saveNextBtn", async function () {
    const ok = await completeCurrentAssessment(false);
    if (!ok) return;
    if (currentImageIndex < radiographs.length - 1) {
      currentImageIndex++;
      await showCurrentImage();
    }
  });

  bindClick("nextUnsavedBtn", async function () {
    await flushAutosave();
    for (let step = 1; step <= radiographs.length; step++) {
      const i = (currentImageIndex + step) % radiographs.length;
      const a = assessments.get(radiographs[i].id);
      if (!a || a.status !== "completed") {
        currentImageIndex = i;
        await showCurrentImage();
        return;
      }
    }
    alert("All 1000 radiographs are completed.");
  });

  bindClick("exportCsvBtn", exportAssessmentsAsCSV);
  bindClick("exportBackupBtn", exportBackupJSON);
}

function bindAutosave() {
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === "TEXTAREA" ? "input" : "change", scheduleDraftAutosave);
  });

  ["participantId", "experienceYears", "specialty"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", saveObserverInfo);
  });
}

function scheduleDraftAutosave() {
  if (!appReady) return;
  setCloudSaveText("Saving draft...");
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveDraft, 800);
}

async function flushAutosave() {
  if (!autosaveTimer) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  await saveDraft();
}

function assessmentPayload(status) {
  const r = radiographs[currentImageIndex];
  return {
    evaluator_user_id: currentUserId,
    radiograph_id: r.id,
    target_tooth: emptyToNull(getValue("targetTooth")),
    image_quality: emptyToNull(getValue("imageQuality")),
    angulation: emptyToNull(getValue("angulation")),
    pell_ramus: emptyToNull(getValue("pellRamus")),
    pell_depth: emptyToNull(getValue("pellDepth")),
    overall_ian_risk: emptyToNull(getValue("ianRisk")),
    confidence_score: getValue("confidenceScore") ? Number(getValue("confidenceScore")) : null,
    comment: emptyToNull(getValue("comment")),
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null
  };
}

async function saveDraft() {
  if (!appReady) return false;

  const { data, error } = await supabaseClient
    .from("assessments")
    .upsert(assessmentPayload("draft"), { onConflict: "evaluator_user_id,radiograph_id" })
    .select()
    .single();

  if (error) {
    console.error(error);
    setCloudSaveText("Save failed");
    return false;
  }

  assessments.set(data.radiograph_id, data);
  setCloudSaveText("Draft saved");
  updateSavedCount();
  updateProgressDashboard();
  return true;
}

async function completeCurrentAssessment(showAlert) {
  await flushAutosave();

  const required = [
    ["targetTooth", "Target Tooth"],
    ["imageQuality", "Image Quality"],
    ["angulation", "Angulation"],
    ["pellRamus", "Pell & Gregory Ramus"],
    ["pellDepth", "Pell & Gregory Depth"],
    ["ianRisk", "IAN Risk"],
    ["confidenceScore", "Confidence Score"]
  ];

  const missing = required.filter(([id]) => !getValue(id)).map(([,name]) => "• " + name);
  if (missing.length) {
    alert("Complete these fields before marking the image complete:\n\n" + missing.join("\n"));
    return false;
  }

  setCloudSaveText("Saving...");

  const { data, error } = await supabaseClient
    .from("assessments")
    .upsert(assessmentPayload("completed"), { onConflict: "evaluator_user_id,radiograph_id" })
    .select()
    .single();

  if (error) {
    console.error(error);
    setCloudSaveText("Save failed");
    alert("Assessment could not be saved:\n" + error.message);
    return false;
  }

  assessments.set(data.radiograph_id, data);
  setCloudSaveText("Completed ✓");
  updateSavedCount();
  updateProgressDashboard();
  if (showAlert) alert("Assessment completed and saved.");
  return true;
}

function loadAssessmentToForm(radiographId) {
  const a = assessments.get(radiographId);
  if (!a) {
    setCloudSaveText("Not saved");
    return;
  }

  setValue("targetTooth", a.target_tooth);
  setValue("imageQuality", a.image_quality);
  setValue("angulation", a.angulation);
  setValue("pellRamus", a.pell_ramus);
  setValue("pellDepth", a.pell_depth);
  setValue("ianRisk", a.overall_ian_risk);
  setValue("confidenceScore", a.confidence_score);
  setValue("comment", a.comment);
  setCloudSaveText(a.status === "completed" ? "Completed ✓" : "Draft saved");
}

function updateSavedCount() {
  const completed = Array.from(assessments.values()).filter(a => a.status === "completed").length;
  const el = document.getElementById("savedCount");
  if (el) el.textContent = `Completed records: ${completed} / ${radiographs.length}`;
}

function updateProgressDashboard() {
  const completedIds = new Set(
    Array.from(assessments.values())
      .filter(a => a.status === "completed")
      .map(a => a.radiograph_id)
  );

  setText("savedImageCount", completedIds.size);
  setText("remainingImageCount", Math.max(radiographs.length - completedIds.size, 0));

  const current = radiographs[currentImageIndex];
  const a = current ? assessments.get(current.id) : null;
  const status = document.getElementById("currentSaveStatus");
  if (status) {
    status.textContent = a ? (a.status === "completed" ? "Completed" : "Draft saved") : "Not saved";
    status.className = a && a.status === "completed" ? "saved" : "unsaved";
  }
}

function exportAssessmentsAsCSV() {
  if (!appReady) return;

  const headers = [
    "evaluator_id","image_order","image_id","file_name","status",
    "target_tooth","image_quality","angulation","pell_ramus","pell_depth",
    "overall_ian_risk","confidence_score","comment","created_at","updated_at","completed_at"
  ];

  const lines = [headers.join(",")];
  radiographs.forEach(r => {
    const a = assessments.get(r.id) || {};
    const row = {
      evaluator_id: currentEvaluatorId,
      image_order: r.image_order,
      image_id: r.image_id,
      file_name: r.file_name,
      status: a.status || "unlabelled",
      target_tooth: a.target_tooth || "",
      image_quality: a.image_quality || "",
      angulation: a.angulation || "",
      pell_ramus: a.pell_ramus || "",
      pell_depth: a.pell_depth || "",
      overall_ian_risk: a.overall_ian_risk || "",
      confidence_score: a.confidence_score || "",
      comment: a.comment || "",
      created_at: a.created_at || "",
      updated_at: a.updated_at || "",
      completed_at: a.completed_at || ""
    };
    lines.push(headers.map(h => csv(row[h])).join(","));
  });

  downloadBlob(
    new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
    currentEvaluatorId + "_radiograph_assessment_" + new Date().toISOString().slice(0,10) + ".csv"
  );
}

function exportBackupJSON() {
  if (!appReady) return;
  const payload = {
    project: "Radiograph Gold Standard Platform",
    evaluator_id: currentEvaluatorId,
    exported_at: new Date().toISOString(),
    total_radiographs: radiographs.length,
    observer_info: JSON.parse(localStorage.getItem("observer_info")) || {},
    assessments: Array.from(assessments.values())
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    currentEvaluatorId + "_backup_" + new Date().toISOString().slice(0,10) + ".json"
  );
}

function saveObserverInfo() {
  localStorage.setItem("observer_info", JSON.stringify({
    participant_id: getValue("participantId"),
    experience_years: getValue("experienceYears"),
    specialty: getValue("specialty")
  }));
}

function restoreObserverInfo() {
  const x = JSON.parse(localStorage.getItem("observer_info")) || {};
  setValue("participantId", x.participant_id);
  setValue("experienceYears", x.experience_years);
  setValue("specialty", x.specialty);
}

function clearAssessmentFields() {
  FIELD_IDS.forEach(id => setValue(id, ""));
}

function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
}

function setCloudSaveText(text) {
  const el = document.getElementById("cloudSaveText");
  if (el) el.textContent = text;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setJavaScriptStatus(text) {
  const el = document.getElementById("jsStatus");
  if (el) el.textContent = text;
}

function emptyToNull(v) {
  return v === "" ? null : v;
}

function csv(v) {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"';
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
