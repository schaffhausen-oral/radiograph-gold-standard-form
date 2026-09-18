/* =========================================================
   RADIOGRAPH GOLD STANDARD PLATFORM — CLOUD MODE
   ========================================================= */

let radiographs = [];

let currentImageIndex = 0;

let currentEvaluatorId = "";

let currentUserId = "";

let assessmentMap = new Map();

let autosaveTimer = null;

let appReady = false;



const ASSESSMENT_FIELD_IDS = [

  "targetTooth",

  "imageQuality",

  "angulation",

  "pellRamus",

  "pellDepth",

  "ianRisk",

  "confidenceScore",

  "comment"

];



document.addEventListener(
  "DOMContentLoaded",

  async function () {

    setJavaScriptStatus(
      "JavaScript status: loaded"
    );


    prepareCloudInterface();


    bindStaticEvents();


    bindAutosaveEvents();


    restoreObserverInfo();


    await restoreCloudSession();

  }
);



/* =========================================================
   LOGIN / SESSION
   ========================================================= */


function prepareCloudInterface() {

  injectLoginOverlay();

  injectCloudTopControls();

}



function injectLoginOverlay() {

  if (
    document.getElementById(
      "cloudLoginOverlay"
    )
  ) {
    return;
  }


  const overlay =
    document.createElement("div");


  overlay.id =
    "cloudLoginOverlay";


  overlay.innerHTML = `

    <div class="cloud-login-card">

      <div class="cloud-login-kicker">
        Radiograph Gold Standard Platform
      </div>

      <h2>
        Observer Sign In
      </h2>

      <p>
        กรอก Evaluator ID และรหัสผ่าน
        ที่ได้รับจากทีมวิจัย
      </p>

      <label for="cloudEvaluatorId">
        Evaluator ID
      </label>

      <input
        id="cloudEvaluatorId"
        type="text"
        placeholder="E01"
        autocomplete="username"
      >

      <label for="cloudPassword">
        Password
      </label>

      <input
        id="cloudPassword"
        type="password"
        placeholder="Password"
        autocomplete="current-password"
      >

      <button
        id="cloudLoginBtn"
        type="button"
      >
        Sign In
      </button>

      <div id="cloudLoginStatus">
        Not signed in.
      </div>

    </div>

  `;


  const style =
    document.createElement("style");


  style.textContent = `

    #cloudLoginOverlay {

      position: fixed;

      inset: 0;

      z-index: 99999;

      display: flex;

      align-items: center;

      justify-content: center;

      padding: 24px;

      background:
        rgba(15,18,35,.84);

      backdrop-filter:
        blur(9px);

    }


    .cloud-login-card {

      width:
        min(440px, 100%);

      background:
        #fff;

      border-radius:
        18px;

      padding:
        28px;

      box-shadow:
        0 24px 70px
        rgba(0,0,0,.28);

    }


    .cloud-login-card h2 {

      margin:
        6px 0 8px;

    }


    .cloud-login-card p {

      margin:
        0 0 18px;

      color:
        #555;

      line-height:
        1.5;

    }


    .cloud-login-kicker {

      font-size:
        12px;

      letter-spacing:
        .08em;

      text-transform:
        uppercase;

      font-weight:
        700;

      opacity:
        .65;

    }


    .cloud-login-card label {

      display:
        block;

      margin-top:
        14px;

      margin-bottom:
        6px;

      font-weight:
        600;

    }


    .cloud-login-card input {

      width:
        100%;

      box-sizing:
        border-box;

      padding:
        12px 13px;

      border:
        1px solid #ccc;

      border-radius:
        10px;

      font-size:
        16px;

    }


    #cloudLoginBtn {

      width:
        100%;

      margin-top:
        18px;

      padding:
        12px;

      border:
        0;

      border-radius:
        10px;

      cursor:
        pointer;

      font-size:
        16px;

      font-weight:
        700;

    }


    #cloudLoginStatus {

      margin-top:
        14px;

      min-height:
        22px;

      white-space:
        pre-line;

      font-size:
        14px;

    }


    #cloudTopControls {

      position:
        fixed;

      right:
        18px;

      top:
        18px;

      z-index:
        9000;

      display:
        none;

      gap:
        8px;

      align-items:
        center;

      padding:
        8px 10px;

      background:
        rgba(255,255,255,.95);

      border-radius:
        12px;

      box-shadow:
        0 5px 18px
        rgba(0,0,0,.14);

    }


    #cloudTopControls button {

      cursor:
        pointer;

    }


    #cloudSaveIndicator {

      font-size:
        13px;

      font-weight:
        700;

    }

  `;


  document.head.appendChild(
    style
  );


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "cloudLoginBtn"
    )
    .addEventListener(
      "click",
      signInObserver
    );


  document
    .getElementById(
      "cloudPassword"
    )
    .addEventListener(
      "keydown",

      function (event) {

        if (
          event.key === "Enter"
        ) {

          signInObserver();

        }

      }
    );

}



function injectCloudTopControls() {

  if (
    document.getElementById(
      "cloudTopControls"
    )
  ) {
    return;
  }


  const controls =
    document.createElement("div");


  controls.id =
    "cloudTopControls";


  controls.innerHTML = `

    <span id="cloudEvaluatorBadge">
    </span>

    <span id="cloudSaveIndicator">
    </span>

    <button
      id="cloudLogoutBtn"
      type="button"
    >
      Sign Out
    </button>

  `;


  document.body.appendChild(
    controls
  );


  document
    .getElementById(
      "cloudLogoutBtn"
    )
    .addEventListener(
      "click",
      signOutObserver
    );

}



async function signInObserver() {

  const status =
    document.getElementById(
      "cloudLoginStatus"
    );


  const evaluatorId =
    String(
      document
        .getElementById(
          "cloudEvaluatorId"
        )
        .value || ""
    )
      .trim()
      .toUpperCase();


  const password =
    document
      .getElementById(
        "cloudPassword"
      )
      .value || "";


  if (
    !window.EVALUATOR_EMAILS ||
    !window.EVALUATOR_EMAILS[
      evaluatorId
    ]
  ) {

    status.textContent =
      "Invalid Evaluator ID.";

    return;

  }


  if (!password) {

    status.textContent =
      "Please enter your password.";

    return;

  }


  status.textContent =
    "Signing in...";


  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .signInWithPassword({

        email:
          window
            .EVALUATOR_EMAILS[
              evaluatorId
            ],

        password:
          password

      });


  if (
    error ||
    !data.user
  ) {

    status.textContent =
      "Sign in failed.\n" +
      (
        error
          ? error.message
          : "Unknown authentication error."
      );

    return;

  }


  const verified =
    await verifyEvaluatorIdentity(

      data.user.id,

      evaluatorId

    );


  if (!verified) {

    await supabaseClient
      .auth
      .signOut();


    status.textContent =
      "Evaluator identity verification failed.";


    return;

  }


  await startCloudStudy(

    data.user.id,

    evaluatorId

  );

}



async function restoreCloudSession() {

  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getUser();


  if (
    error ||
    !data.user
  ) {

    showLoginOverlay();

    return;

  }


  const {
    data: evaluator,
    error: evaluatorError
  } =
    await supabaseClient
      .from(
        "evaluators"
      )
      .select(
        "evaluator_id"
      )
      .eq(
        "user_id",
        data.user.id
      )
      .single();


  if (
    evaluatorError ||
    !evaluator
  ) {

    await supabaseClient
      .auth
      .signOut();


    showLoginOverlay(

      "This account is not registered as a study evaluator."

    );


    return;

  }


  await startCloudStudy(

    data.user.id,

    evaluator.evaluator_id

  );

}



async function verifyEvaluatorIdentity(
  userId,
  evaluatorId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "evaluators"
      )
      .select(
        "evaluator_id"
      )
      .eq(
        "user_id",
        userId
      )
      .single();


  return (

    !error &&

    data &&

    data.evaluator_id ===
      evaluatorId

  );

}



async function startCloudStudy(
  userId,
  evaluatorId
) {

  currentUserId =
    userId;


  currentEvaluatorId =
    evaluatorId;


  setValue(
    "evaluatorId",
    evaluatorId
  );


  const evaluatorMainInput =
    document.getElementById(
      "evaluatorId"
    );


  if (
    evaluatorMainInput
  ) {

    evaluatorMainInput.readOnly =
      true;

  }


  const badge =
    document.getElementById(
      "cloudEvaluatorBadge"
    );


  if (badge) {

    badge.textContent =
      "Evaluator: " +
      evaluatorId;

  }


  const controls =
    document.getElementById(
      "cloudTopControls"
    );


  if (controls) {

    controls.style.display =
      "flex";

  }


  hideLoginOverlay();


  setCloudSaveIndicator(
    "Loading dataset..."
  );


  saveObserverInfo();


  const loaded =
    await loadCloudDataset();


  if (!loaded) {

    return;

  }


  await loadOwnAssessments();


  chooseResumeImage();


  appReady =
    true;


  await showCurrentImage();

}



async function signOutObserver() {

  await flushAutosave();


  await supabaseClient
    .auth
    .signOut();


  appReady =
    false;


  radiographs =
    [];


  assessmentMap.clear();


  currentImageIndex =
    0;


  currentEvaluatorId =
    "";


  currentUserId =
    "";


  clearAssessmentFields();


  const image =
    document.getElementById(
      "radiographImage"
    );


  if (image) {

    image.removeAttribute(
      "src"
    );


    image.classList.remove(
      "has-image"
    );

  }


  const controls =
    document.getElementById(
      "cloudTopControls"
    );


  if (controls) {

    controls.style.display =
      "none";

  }


  document
    .getElementById(
      "cloudPassword"
    )
    .value = "";


  document
    .getElementById(
      "cloudEvaluatorId"
    )
    .value = "";


  showLoginOverlay(
    "Signed out."
  );

}



function showLoginOverlay(
  message
) {

  const overlay =
    document.getElementById(
      "cloudLoginOverlay"
    );


  if (overlay) {

    overlay.style.display =
      "flex";

  }


  if (message) {

    const status =
      document.getElementById(
        "cloudLoginStatus"
      );


    if (status) {

      status.textContent =
        message;

    }

  }

}



function hideLoginOverlay() {

  const overlay =
    document.getElementById(
      "cloudLoginOverlay"
    );


  if (overlay) {

    overlay.style.display =
      "none";

  }

}



/* =========================================================
   DATASET / RADIOGRAPH VIEWER
   ========================================================= */


async function loadCloudDataset() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "radiographs"
      )
      .select(

        "id,image_order,image_id,file_name,storage_path"

      )
      .order(

        "image_order",

        {
          ascending: true
        }

      )
      .range(
        0,
        999
      );


  if (error) {

    showViewerError(

      "Cannot load radiograph dataset: " +
      error.message

    );


    setCloudSaveIndicator(
      "Dataset error"
    );


    return false;

  }


  radiographs =
    data || [];


  if (
    radiographs.length !==
    1000
  ) {

    showViewerError(

      "Dataset validation failed. " +

      "Expected 1000 radiographs but received " +

      radiographs.length +

      "."

    );


    setCloudSaveIndicator(
      "Dataset incomplete"
    );


    return false;

  }


  return true;

}



async function loadOwnAssessments() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "assessments"
      )
      .select("*")
      .eq(
        "evaluator_user_id",
        currentUserId
      );


  if (error) {

    alert(

      "Cannot load saved assessments:\n" +

      error.message

    );


    return;

  }


  assessmentMap.clear();


  (
    data || []
  )
    .forEach(

      function (record) {

        assessmentMap.set(

          record.radiograph_id,

          record

        );

      }

    );


  updateSavedCount();


  updateProgressDashboard();

}



function chooseResumeImage() {

  const firstDraftIndex =
    radiographs.findIndex(

      function (image) {

        const assessment =
          assessmentMap.get(
            image.id
          );


        return (

          assessment &&

          assessment.status ===
            "draft"

        );

      }

    );


  if (
    firstDraftIndex >= 0
  ) {

    currentImageIndex =
      firstDraftIndex;

    return;

  }


  const firstIncompleteIndex =
    radiographs.findIndex(

      function (image) {

        const assessment =
          assessmentMap.get(
            image.id
          );


        return (

          !assessment ||

          assessment.status !==
            "completed"

        );

      }

    );


  currentImageIndex =

    firstIncompleteIndex >= 0

      ? firstIncompleteIndex

      : Math.max(

          radiographs.length - 1,

          0

        );

}



async function showCurrentImage() {

  if (
    !appReady ||
    !radiographs.length
  ) {

    return;

  }


  const record =
    radiographs[
      currentImageIndex
    ];


  const progress =
    document.getElementById(
      "imageProgress"
    );


  const image =
    document.getElementById(
      "radiographImage"
    );


  const loading =
    document.getElementById(
      "radiographLoading"
    );


  const errorBox =
    document.getElementById(
      "radiographError"
    );


  if (!image) {

    showViewerError(

      "System error: radiographImage element is missing from index.html."

    );


    return;

  }


  if (progress) {

    progress.textContent =

      "Image " +

      (
        currentImageIndex + 1
      ) +

      " of " +

      radiographs.length +

      " | " +

      record.image_id;

  }


  setValue(

    "imageId",

    record.image_id

  );


  clearAssessmentFields();


  loadAssessmentIntoForm(
    record.id
  );


  updateProgressDashboard();


  image.classList.remove(
    "has-image"
  );


  image.removeAttribute(
    "src"
  );


  if (loading) {

    loading.hidden =
      false;


    loading.textContent =
      "กำลังโหลดภาพรังสี...";

  }


  if (errorBox) {

    errorBox.hidden =
      true;


    errorBox.textContent =
      "";

  }


  setCloudSaveIndicator(
    "Loading image..."
  );


  /*
    Create a fresh signed URL every time.

    ไม่ใช้ cached signed URL
    เพื่อป้องกัน URL หมดอายุ
  */

  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from(
        "radiographs"
      )
      .createSignedUrl(

        record.storage_path,

        3600

      );


  if (error) {

    const message =

      "ไม่สามารถโหลด " +

      record.image_id +

      " จาก Storage ได้\n" +

      error.message +

      "\nPath: " +

      record.storage_path;


    console.error(

      message,

      error

    );


    showViewerError(
      message
    );


    setCloudSaveIndicator(
      "Image load failed"
    );


    return;

  }


  if (
    !data ||
    !data.signedUrl
  ) {

    const message =

      "ไม่พบ signed URL สำหรับ " +

      record.image_id;


    console.error(

      message,

      data

    );


    showViewerError(
      message
    );


    setCloudSaveIndicator(
      "Image URL missing"
    );


    return;

  }


  image.onload =
    function () {


      image.classList.add(
        "has-image"
      );


      if (loading) {

        loading.hidden =
          true;

      }


      if (errorBox) {

        errorBox.hidden =
          true;

      }


      setCloudSaveIndicator(

        getCurrentAssessmentIndicator()

      );

    };


  image.onerror =
    function () {


      const message =

        "Browser ไม่สามารถแสดงภาพ " +

        record.image_id +

        " ได้ " +

        "กรุณากด Retry Image " +

        "หรือแจ้งทีมวิจัย";


      console.error(

        message,

        data.signedUrl

      );


      image.classList.remove(
        "has-image"
      );


      showViewerError(
        message
      );


      setCloudSaveIndicator(
        "Image display failed"
      );

    };


  image.src =
    data.signedUrl;


  image.alt =

    "Panoramic radiograph " +

    record.image_id;

}



function showViewerError(
  message
) {

  const loading =
    document.getElementById(
      "radiographLoading"
    );


  const errorBox =
    document.getElementById(
      "radiographError"
    );


  if (loading) {

    loading.hidden =
      true;

  }


  if (errorBox) {

    errorBox.hidden =
      false;


    errorBox.textContent =
      message;

  }

  else {

    alert(
      message
    );

  }

}



function retryCurrentImage() {

  if (!appReady) {

    return;

  }


  showCurrentImage();

}



function showPreviousImage() {

  if (
    !appReady ||
    currentImageIndex <= 0
  ) {

    return;

  }


  flushAutosave()
    .finally(

      async function () {

        currentImageIndex--;


        await showCurrentImage();

      }

    );

}



function showNextImage() {

  if (
    !appReady ||
    currentImageIndex >=
      radiographs.length - 1
  ) {

    return;

  }


  flushAutosave()
    .finally(

      async function () {

        currentImageIndex++;


        await showCurrentImage();

      }

    );

}



function jumpToImage() {

  if (!appReady) {

    return;

  }


  const jumpInput =
    document.getElementById(
      "jumpImageNumber"
    );


  const number =
    Number(

      jumpInput
        ? jumpInput.value
        : ""

    );


  if (

    !Number.isInteger(
      number
    ) ||

    number < 1 ||

    number >
      radiographs.length

  ) {

    alert(

      "Enter an image number between 1 and " +

      radiographs.length +

      "."

    );


    return;

  }


  flushAutosave()
    .finally(

      async function () {


        currentImageIndex =
          number - 1;


        await showCurrentImage();

      }

    );

}



/* =========================================================
   AUTOSAVE / COMPLETION
   ========================================================= */


function bindAutosaveEvents() {

  ASSESSMENT_FIELD_IDS
    .forEach(

      function (id) {


        const element =
          document.getElementById(
            id
          );


        if (!element) {

          return;

        }


        const eventName =

          element.tagName ===
            "TEXTAREA" ||

          element.type ===
            "text"

            ? "input"

            : "change";


        element.addEventListener(

          eventName,

          scheduleDraftAutosave

        );

      }

    );


  [

    "participantId",

    "experienceYears",

    "specialty"

  ]
    .forEach(

      function (id) {


        const element =
          document.getElementById(
            id
          );


        if (!element) {

          return;

        }


        element.addEventListener(

          "change",

          saveObserverInfo

        );

      }

    );

}



function scheduleDraftAutosave() {

  if (

    !appReady ||

    !currentUserId ||

    !radiographs[
      currentImageIndex
    ]

  ) {

    return;

  }


  setCloudSaveIndicator(
    "Saving draft..."
  );


  clearTimeout(
    autosaveTimer
  );


  autosaveTimer =
    setTimeout(

      function () {

        saveDraftAssessment();

      },

      800

    );

}



async function flushAutosave() {

  if (
    autosaveTimer
  ) {


    clearTimeout(
      autosaveTimer
    );


    autosaveTimer =
      null;


    await saveDraftAssessment();

  }

}



function buildAssessmentPayload(
  status
) {

  const record =
    radiographs[
      currentImageIndex
    ];


  return {

    evaluator_user_id:
      currentUserId,


    radiograph_id:
      record.id,


    target_tooth:
      nullIfEmpty(
        getValue(
          "targetTooth"
        )
      ),


    image_quality:
      nullIfEmpty(
        getValue(
          "imageQuality"
        )
      ),


    angulation:
      nullIfEmpty(
        getValue(
          "angulation"
        )
      ),


    pell_ramus:
      nullIfEmpty(
        getValue(
          "pellRamus"
        )
      ),


    pell_depth:
      nullIfEmpty(
        getValue(
          "pellDepth"
        )
      ),


    overall_ian_risk:
      nullIfEmpty(
        getValue(
          "ianRisk"
        )
      ),


    confidence_score:

      getValue(
        "confidenceScore"
      )

        ? Number(

            getValue(
              "confidenceScore"
            )

          )

        : null,


    comment:
      nullIfEmpty(
        getValue(
          "comment"
        )
      ),


    status:
      status

  };

}



async function saveDraftAssessment() {

  if (

    !appReady ||

    !currentUserId ||

    !radiographs[
      currentImageIndex
    ]

  ) {

    return false;

  }


  const payload =
    buildAssessmentPayload(
      "draft"
    );


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "assessments"
      )
      .upsert(

        payload,

        {
          onConflict:
            "evaluator_user_id,radiograph_id"
        }

      )
      .select()
      .single();


  if (error) {

    console.error(

      "Draft autosave failed:",

      error

    );


    setCloudSaveIndicator(
      "Save failed"
    );


    return false;

  }


  assessmentMap.set(

    data.radiograph_id,

    data

  );


  setCloudSaveIndicator(
    "Draft saved"
  );


  updateSavedCount();


  updateProgressDashboard();


  return true;

}



async function completeCurrentAssessment(
  showAlert
) {

  if (!appReady) {

    return false;

  }


  await flushAutosave();


  const missing =
    getMissingRequiredFields();


  if (
    missing.length > 0
  ) {

    alert(

      "Please complete the following before marking this image complete:\n\n" +

      missing.join("\n")

    );


    return false;

  }


  setCloudSaveIndicator(
    "Saving..."
  );


  const payload =
    buildAssessmentPayload(
      "completed"
    );


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "assessments"
      )
      .upsert(

        payload,

        {
          onConflict:
            "evaluator_user_id,radiograph_id"
        }

      )
      .select()
      .single();


  if (error) {

    console.error(

      "Completion save failed:",

      error

    );


    setCloudSaveIndicator(
      "Save failed"
    );


    alert(

      "Assessment could not be saved:\n" +

      error.message

    );


    return false;

  }


  assessmentMap.set(

    data.radiograph_id,

    data

  );


  setCloudSaveIndicator(
    "Completed ✓"
  );


  updateSavedCount();


  updateProgressDashboard();


  if (showAlert) {

    alert(

      "Assessment completed and saved."

    );

  }


  return true;

}



function getMissingRequiredFields() {

  const required = [

    [
      "targetTooth",
      "Target Tooth"
    ],

    [
      "imageQuality",
      "Image Quality"
    ],

    [
      "angulation",
      "Angulation"
    ],

    [
      "pellRamus",
      "Pell & Gregory Ramus"
    ],

    [
      "pellDepth",
      "Pell & Gregory Depth"
    ],

    [
      "ianRisk",
      "IAN Risk"
    ],

    [
      "confidenceScore",
      "Confidence Score"
    ]

  ];


  return required

    .filter(

      function (item) {

        return !getValue(
          item[0]
        );

      }

    )

    .map(

      function (item) {

        return "• " +
          item[1];

      }

    );

}



async function saveAssessment(
  showAlert
) {

  return await completeCurrentAssessment(

    showAlert !== false

  );

}



async function saveAndNextImage() {

  const saved =
    await completeCurrentAssessment(
      false
    );


  if (!saved) {

    return;

  }


  if (

    currentImageIndex <
    radiographs.length - 1

  ) {

    currentImageIndex++;


    await showCurrentImage();

  }

  else {

    alert(

      "Assessment saved. This is the last image."

    );

  }

}



async function goToNextUnsavedImage() {

  if (!appReady) {

    return;

  }


  await flushAutosave();


  for (

    let step = 1;

    step <= radiographs.length;

    step++

  ) {


    const index =

      (
        currentImageIndex +
        step
      )

      %

      radiographs.length;


    const record =
      assessmentMap.get(

        radiographs[index].id

      );


    if (

      !record ||

      record.status !==
        "completed"

    ) {

      currentImageIndex =
        index;


      await showCurrentImage();


      return;

    }

  }


  alert(

    "All 1000 radiographs are completed."

  );

}



function loadAssessmentIntoForm(
  radiographId
) {

  const record =
    assessmentMap.get(
      radiographId
    );


  if (!record) {

    setCloudSaveIndicator(
      "Not saved"
    );


    return;

  }


  setValue(

    "targetTooth",

    record.target_tooth

  );


  setValue(

    "imageQuality",

    record.image_quality

  );


  setValue(

    "angulation",

    record.angulation

  );


  setValue(

    "pellRamus",

    record.pell_ramus

  );


  setValue(

    "pellDepth",

    record.pell_depth

  );


  setValue(

    "ianRisk",

    record.overall_ian_risk

  );


  setValue(

    "confidenceScore",

    record.confidence_score

  );


  setValue(

    "comment",

    record.comment

  );


  setCloudSaveIndicator(

    record.status ===
      "completed"

      ? "Completed ✓"

      : "Draft saved"

  );

}



function getCurrentAssessmentIndicator() {

  const current =
    radiographs[
      currentImageIndex
    ];


  if (!current) {

    return "";

  }


  const record =
    assessmentMap.get(
      current.id
    );


  if (!record) {

    return "Not saved";

  }


  return (

    record.status ===
      "completed"

      ? "Completed ✓"

      : "Draft saved"

  );

}



/* =========================================================
   BUTTONS
   ========================================================= */


function bindStaticEvents() {

  bindClick(

    "prevImageBtn",

    showPreviousImage

  );


  bindClick(

    "nextImageBtn",

    showNextImage

  );


  bindClick(

    "jumpImageBtn",

    jumpToImage

  );


  bindClick(

    "retryImageBtn",

    retryCurrentImage

  );


  bindClick(

    "saveAssessmentBtn",

    function () {

      saveAssessment(
        true
      );

    }

  );


  bindClick(

    "saveNextBtn",

    saveAndNextImage

  );


  bindClick(

    "nextUnsavedBtn",

    goToNextUnsavedImage

  );


  bindClick(

    "exportCsvBtn",

    exportAssessmentsAsCSV

  );

}



function bindClick(
  id,
  handler
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.addEventListener(

      "click",

      handler

    );

  }

}



/* =========================================================
   PROGRESS
   ========================================================= */


function updateSavedCount() {

  const completed =
    Array
      .from(
        assessmentMap.values()
      )
      .filter(

        function (record) {

          return (

            record.status ===
            "completed"

          );

        }

      )
      .length;


  const savedCount =
    document.getElementById(
      "savedCount"
    );


  if (savedCount) {

    savedCount.textContent =

      "Completed records: " +

      completed +

      " / " +

      radiographs.length;

  }

}



function updateProgressDashboard() {

  const completedIds =
    new Set(

      Array
        .from(
          assessmentMap.values()
        )
        .filter(

          function (record) {

            return (

              record.status ===
              "completed"

            );

          }

        )
        .map(

          function (record) {

            return (
              record.radiograph_id
            );

          }

        )

    );


  const completed =
    completedIds.size;


  const remaining =
    Math.max(

      radiographs.length -
      completed,

      0

    );


  setText(

    "savedImageCount",

    completed

  );


  setText(

    "remainingImageCount",

    remaining

  );


  const current =
    radiographs[
      currentImageIndex
    ];


  const currentAssessment =

    current

      ? assessmentMap.get(
          current.id
        )

      : null;


  const currentStatus =
    document.getElementById(
      "currentSaveStatus"
    );


  if (currentStatus) {

    if (

      currentAssessment &&

      currentAssessment.status ===
        "completed"

    ) {

      currentStatus.textContent =
        "Completed";


      currentStatus.className =
        "saved";

    }

    else if (
      currentAssessment
    ) {

      currentStatus.textContent =
        "Draft saved";


      currentStatus.className =
        "unsaved";

    }

    else {

      currentStatus.textContent =
        "Not saved";


      currentStatus.className =
        "unsaved";

    }

  }


  checkStudyCompletion(
    completed
  );

}



function setCloudSaveIndicator(
  text
) {

  const element =
    document.getElementById(
      "cloudSaveIndicator"
    );


  if (element) {

    element.textContent =
      text;

  }

}



/* =========================================================
   EXPORT CSV
   ========================================================= */


function exportAssessmentsAsCSV() {

  if (!appReady) {

    return;

  }


  const headers = [

    "evaluator_id",

    "image_order",

    "image_id",

    "file_name",

    "status",

    "target_tooth",

    "image_quality",

    "angulation",

    "pell_ramus",

    "pell_depth",

    "overall_ian_risk",

    "confidence_score",

    "comment",

    "created_at",

    "updated_at",

    "completed_at"

  ];


  const rows = [

    headers.join(",")

  ];


  radiographs.forEach(

    function (image) {


      const assessment =

        assessmentMap.get(
          image.id
        )

        || {};


      const row = {


        evaluator_id:
          currentEvaluatorId,


        image_order:
          image.image_order,


        image_id:
          image.image_id,


        file_name:
          image.file_name,


        status:
          assessment.status ||
          "unlabelled",


        target_tooth:
          assessment.target_tooth ||
          "",


        image_quality:
          assessment.image_quality ||
          "",


        angulation:
          assessment.angulation ||
          "",


        pell_ramus:
          assessment.pell_ramus ||
          "",


        pell_depth:
          assessment.pell_depth ||
          "",


        overall_ian_risk:
          assessment.overall_ian_risk ||
          "",


        confidence_score:
          assessment.confidence_score ||
          "",


        comment:
          assessment.comment ||
          "",


        created_at:
          assessment.created_at ||
          "",


        updated_at:
          assessment.updated_at ||
          "",


        completed_at:
          assessment.completed_at ||
          ""


      };


      rows.push(

        headers
          .map(

            function (header) {

              return escapeCSV(
                row[header]
              );

            }

          )
          .join(",")

      );

    }

  );


  const blob =
    new Blob(

      [
        "\uFEFF" +
        rows.join("\n")
      ],

      {
        type:
          "text/csv;charset=utf-8;"
      }

    );


  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );


  downloadBlob(

    blob,

    currentEvaluatorId +

    "_radiograph_assessment_" +

    today +

    ".csv"

  );

}



function downloadBlob(
  blob,
  fileName
) {

  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    fileName;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );

}



/* =========================================================
   OBSERVER INFO
   ========================================================= */


function saveObserverInfo() {

  const observerInfo = {


    evaluator_id:

      currentEvaluatorId ||

      getValue(
        "evaluatorId"
      ),


    participant_id:

      getValue(
        "participantId"
      ),


    experience_years:

      getValue(
        "experienceYears"
      ),


    specialty:

      getValue(
        "specialty"
      )


  };


  localStorage.setItem(

    "observer_info",

    JSON.stringify(
      observerInfo
    )

  );

}



function restoreObserverInfo() {

  const observerInfo =

    JSON.parse(

      localStorage.getItem(
        "observer_info"
      )

    )

    || {};


  setValue(

    "participantId",

    observerInfo.participant_id

  );


  setValue(

    "experienceYears",

    observerInfo.experience_years

  );


  setValue(

    "specialty",

    observerInfo.specialty

  );

}



/* =========================================================
   STUDY COMPLETION
   ========================================================= */


function checkStudyCompletion(
  completedCount
) {

  const overlay =
    document.getElementById(
      "studyCompletionOverlay"
    );


  if (!overlay) {

    return;

  }


  if (

    radiographs.length ===
      1000

    &&

    completedCount ===
      1000

  ) {

    overlay.classList.add(
      "show"
    );

  }

}



document.addEventListener(

  "click",

  function (event) {


    if (

      event.target &&

      event.target.id ===
        "completionCloseBtn"

    ) {


      const overlay =
        document.getElementById(
          "studyCompletionOverlay"
        );


      if (overlay) {

        overlay.classList.remove(
          "show"
        );

      }

    }

  }

);



/* =========================================================
   HELPERS
   ========================================================= */


function clearAssessmentFields() {

  setValue(
    "targetTooth",
    ""
  );


  setValue(
    "imageQuality",
    ""
  );


  setValue(
    "angulation",
    ""
  );


  setValue(
    "pellRamus",
    ""
  );


  setValue(
    "pellDepth",
    ""
  );


  setValue(
    "ianRisk",
    ""
  );


  setValue(
    "confidenceScore",
    ""
  );


  setValue(
    "comment",
    ""
  );

}



function nullIfEmpty(
  value
) {

  return (

    value === ""

      ? null

      : value

  );

}



function escapeCSV(
  value
) {

  const stringValue =
    String(
      value ?? ""
    )
      .replace(
        /"/g,
        '""'
      );


  return (
    '"' +
    stringValue +
    '"'
  );

}



function getValue(
  id
) {

  const element =
    document.getElementById(
      id
    );


  return (

    element

      ? String(
          element.value || ""
        ).trim()

      : ""

  );

}



function setValue(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.value =
      value ?? "";

  }

}



function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}



function setJavaScriptStatus(
  text
) {

  const jsStatus =
    document.getElementById(
      "jsStatus"
    );


  if (jsStatus) {

    jsStatus.textContent =
      text;

  }

}
