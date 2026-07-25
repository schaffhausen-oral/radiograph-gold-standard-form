let imageFiles = [];
let currentImageIndex = 0;
let currentImageObjectUrl = null;

document.addEventListener("DOMContentLoaded", async function () {
  setJavaScriptStatus("JavaScript status: loaded");

  bindEvents();
  restoreObserverInfo();
  updateSavedCount();
  updateProgressDashboard();

  await restoreSavedImages();
});

function bindEvents() {
  const imageUpload = document.getElementById("imageUpload");
  const prevImageBtn = document.getElementById("prevImageBtn");
  const nextImageBtn = document.getElementById("nextImageBtn");
  const jumpImageBtn = document.getElementById("jumpImageBtn");

  const saveButton = document.getElementById("saveAssessmentBtn");
  const saveNextBtn = document.getElementById("saveNextBtn");
  const nextUnsavedBtn = document.getElementById("nextUnsavedBtn");

  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const clearDataBtn = document.getElementById("clearDataBtn");
  const exportBackupBtn = document.getElementById("exportBackupBtn");
  const importBackupBtn = document.getElementById("importBackupBtn");
  const backupFileInput = document.getElementById("backupFileInput");

  if (imageUpload) {
    imageUpload.addEventListener("change", handleImageUpload);
  }

  if (prevImageBtn) {
    prevImageBtn.addEventListener("click", showPreviousImage);
  }

  if (nextImageBtn) {
    nextImageBtn.addEventListener("click", showNextImage);
  }

  if (jumpImageBtn) {
    jumpImageBtn.addEventListener("click", jumpToImage);
  }

  if (saveButton) {
    saveButton.addEventListener("click", function () {
      saveAssessment(true);
    });
  }

  if (saveNextBtn) {
    saveNextBtn.addEventListener("click", saveAndNextImage);
  }

  if (nextUnsavedBtn) {
    nextUnsavedBtn.addEventListener("click", goToNextUnsavedImage);
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportAssessmentsAsCSV);
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", clearSavedData);
  }

  if (exportBackupBtn) {
    exportBackupBtn.addEventListener("click", exportBackupJSON);
  }

  if (importBackupBtn && backupFileInput) {
    importBackupBtn.addEventListener("click", function () {
      backupFileInput.click();
    });
  }

  if (backupFileInput) {
    backupFileInput.addEventListener("change", importBackupJSON);
  }
}

async function handleImageUpload(event) {
  const selectedFiles = Array.from(event.target.files || []);
  const supportedExtension = /\.(jpe?g|png|webp|bmp|gif)$/i;

  imageFiles = selectedFiles.filter(function (file) {
    return (
      (file.type && file.type.startsWith("image/")) ||
      supportedExtension.test(file.name)
    );
  });

  imageFiles.sort(function (a, b) {
    return a.name.localeCompare(
      b.name,
      undefined,
      { numeric: true }
    );
  });

  currentImageIndex = 0;

  if (imageFiles.length === 0) {
    clearImageViewer();

    alert(
      "No valid image files selected. Please select JPG, JPEG, PNG, WEBP, BMP, or GIF files."
    );

    return;
  }

  const imageProgress = document.getElementById("imageProgress");

  if (imageProgress) {
    imageProgress.textContent =
      "Saving " + imageFiles.length + " radiograph images locally...";
  }

  try {
    const persistentStorageGranted =
      await requestPersistentRadiographStorage();

    await saveRadiographFilesToDB(imageFiles);

    registerUploadedImages(imageFiles);
    showCurrentImage();

    const storageEstimate = await getRadiographStorageEstimate();
    let storageMessage = "";

    if (
      storageEstimate &&
      typeof storageEstimate.usage === "number" &&
      typeof storageEstimate.quota === "number"
    ) {
      const usedMB = (
        storageEstimate.usage /
        (1024 * 1024)
      ).toFixed(1);

      const quotaMB = (
        storageEstimate.quota /
        (1024 * 1024)
      ).toFixed(1);

      storageMessage =
        "\nBrowser storage used: " +
        usedMB +
        " MB of approximately " +
        quotaMB +
        " MB.";
    }

    alert(
      imageFiles.length +
        " radiograph images were saved in this browser.\n\n" +
        "They will be restored automatically after closing and reopening this website on the same laptop and browser.\n\n" +
        (
          persistentStorageGranted
            ? "Persistent browser storage is active."
            : "The browser did not guarantee persistent storage. Keep a separate copy of the original images."
        ) +
        storageMessage
    );
  } catch (error) {
    console.error("Image storage error:", error);

    clearImageViewer();

    alert(
      "The images could not be saved in this browser.\n\n" +
      "Possible causes include insufficient storage space or disabled browser storage.\n\n" +
      "Error: " +
      (error.message || "Unknown error")
    );
  }
}

async function restoreSavedImages() {
  try {
    const savedFiles = await loadRadiographFilesFromDB();

    if (savedFiles.length === 0) {
      updateUploadedImageCount();
      return;
    }

    imageFiles = savedFiles;

    imageFiles.sort(function (a, b) {
      return a.name.localeCompare(
        b.name,
        undefined,
        { numeric: true }
      );
    });

    currentImageIndex = 0;
    showCurrentImage();
  } catch (error) {
    console.error("Saved image restoration error:", error);

    updateUploadedImageCount();
  }
}

function showCurrentImage() {
  if (imageFiles.length === 0) {
    clearImageViewer();
    return;
  }

  const file = imageFiles[currentImageIndex];
  const imageId = getImageIdFromFileName(file.name);

  if (currentImageObjectUrl) {
    URL.revokeObjectURL(currentImageObjectUrl);
  }

  currentImageObjectUrl = URL.createObjectURL(file);

  const radiographImage =
    document.getElementById("radiographImage");

  const imageProgress =
    document.getElementById("imageProgress");

  const imageIdInput =
    document.getElementById("imageId");

  if (radiographImage) {
    radiographImage.onload = function () {
      radiographImage.classList.add("has-image");
    };

    radiographImage.onerror = function () {
      radiographImage.classList.remove("has-image");

      alert(
        "This file cannot be displayed by the browser: " +
        file.name
      );
    };

    radiographImage.src = currentImageObjectUrl;
  }

  if (imageProgress) {
    imageProgress.textContent =
      "Image " +
      (currentImageIndex + 1) +
      " of " +
      imageFiles.length +
      " | " +
      imageId;
  }

  if (imageIdInput) {
    imageIdInput.value = imageId;
  }

  clearAssessmentFields();
  loadExistingAssessmentForCurrentImage();
  updateProgressDashboard();
}

function clearImageViewer() {
  const radiographImage =
    document.getElementById("radiographImage");

  const imageProgress =
    document.getElementById("imageProgress");

  const imageIdInput =
    document.getElementById("imageId");

  if (currentImageObjectUrl) {
    URL.revokeObjectURL(currentImageObjectUrl);
    currentImageObjectUrl = null;
  }

  if (radiographImage) {
    radiographImage.removeAttribute("src");
    radiographImage.classList.remove("has-image");
  }

  if (imageProgress) {
    imageProgress.textContent = "No image loaded";
  }

  if (imageIdInput) {
    imageIdInput.value = "";
  }

  updateProgressDashboard();
}

function getImageIdFromFileName(fileName) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function showPreviousImage() {
  if (imageFiles.length === 0) {
    alert("Please upload radiograph images first.");
    return;
  }

  if (currentImageIndex > 0) {
    currentImageIndex--;
    showCurrentImage();
  }
}

function showNextImage() {
  if (imageFiles.length === 0) {
    alert("Please upload radiograph images first.");
    return;
  }

  if (currentImageIndex < imageFiles.length - 1) {
    currentImageIndex++;
    showCurrentImage();
  }
}

function jumpToImage() {
  if (imageFiles.length === 0) {
    alert("Please upload radiograph images first.");
    return;
  }

  const jumpInput =
    document.getElementById("jumpImageNumber");

  if (!jumpInput) {
    alert("Jump input not found.");
    return;
  }

  const imageNumber = Number(jumpInput.value);

  if (
    !imageNumber ||
    imageNumber < 1 ||
    imageNumber > imageFiles.length
  ) {
    alert(
      "Please enter a valid image number between 1 and " +
      imageFiles.length +
      "."
    );

    return;
  }

  currentImageIndex = imageNumber - 1;
  showCurrentImage();
}

function saveAssessment(showAlert) {
  const assessment = {
    evaluator_id: getValue("evaluatorId"),
    participant_id: getValue("participantId"),
    experience_years: getValue("experienceYears"),
    specialty: getValue("specialty"),

    image_id: getValue("imageId"),
    target_tooth: getValue("targetTooth"),
    image_quality: getValue("imageQuality"),
    angulation: getValue("angulation"),
    pell_ramus: getValue("pellRamus"),
    pell_depth: getValue("pellDepth"),
    overall_ian_risk: getValue("ianRisk"),
    confidence_score: getValue("confidenceScore"),
    comment: getValue("comment"),

    saved_at: new Date().toISOString()
  };

  if (!assessment.evaluator_id) {
    alert("Please complete Evaluator ID before saving.");
    return false;
  }

  if (!assessment.image_id) {
    alert(
      "Please upload or select a radiograph image before saving."
    );

    return false;
  }

  if (!assessment.target_tooth) {
    alert("Please select Target Tooth before saving.");
    return false;
  }

  saveObserverInfo();

  const existingData =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  const duplicateIndex =
    existingData.findIndex(function (item) {
      return (
        item.evaluator_id === assessment.evaluator_id &&
        item.image_id === assessment.image_id &&
        item.target_tooth === assessment.target_tooth
      );
    });

  if (duplicateIndex >= 0) {
    existingData[duplicateIndex] = assessment;
  } else {
    existingData.push(assessment);
  }

  localStorage.setItem(
    "radiograph_assessments",
    JSON.stringify(existingData)
  );

  markImageAsLabelled(assessment.image_id);

  updateSavedCount();
  updateProgressDashboard();

  if (showAlert) {
    alert(
      "Assessment saved successfully. Total saved records: " +
      existingData.length
    );
  }

  return true;
}

function saveAndNextImage() {
  const saved = saveAssessment(false);

  if (!saved) {
    return;
  }

  if (imageFiles.length === 0) {
    return;
  }

  if (currentImageIndex < imageFiles.length - 1) {
    currentImageIndex++;
    showCurrentImage();
  } else {
    alert("Assessment saved. This is the last image.");
  }
}

function goToNextUnsavedImage() {
  if (imageFiles.length === 0) {
    alert("Please upload radiograph images first.");
    return;
  }

  const evaluatorId = getValue("evaluatorId");

  if (!evaluatorId) {
    alert("Please complete Evaluator ID first.");
    return;
  }

  const existingData =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  const savedImageIds = new Set(
    existingData
      .filter(function (record) {
        return record.evaluator_id === evaluatorId;
      })
      .map(function (record) {
        return record.image_id;
      })
  );

  for (
    let step = 1;
    step <= imageFiles.length;
    step++
  ) {
    const nextIndex =
      (currentImageIndex + step) % imageFiles.length;

    const nextImageId =
      getImageIdFromFileName(
        imageFiles[nextIndex].name
      );

    if (!savedImageIds.has(nextImageId)) {
      currentImageIndex = nextIndex;
      showCurrentImage();
      return;
    }
  }

  alert(
    "All uploaded images have been saved for this Evaluator ID."
  );
}

function loadExistingAssessmentForCurrentImage() {
  const evaluatorId = getValue("evaluatorId");
  const imageId = getValue("imageId");

  if (!evaluatorId || !imageId) {
    return;
  }

  const existingData =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  const existingRecord =
    existingData.find(function (item) {
      return (
        item.evaluator_id === evaluatorId &&
        item.image_id === imageId
      );
    });

  if (!existingRecord) {
    return;
  }

  setValue(
    "targetTooth",
    existingRecord.target_tooth
  );

  setValue(
    "imageQuality",
    existingRecord.image_quality
  );

  setValue(
    "angulation",
    existingRecord.angulation
  );

  setValue(
    "pellRamus",
    existingRecord.pell_ramus
  );

  setValue(
    "pellDepth",
    existingRecord.pell_depth
  );

  setValue(
    "ianRisk",
    existingRecord.overall_ian_risk
  );

  setValue(
    "confidenceScore",
    existingRecord.confidence_score
  );

  setValue(
    "comment",
    existingRecord.comment
  );
}

function clearAssessmentFields() {
  setValue("targetTooth", "");
  setValue("imageQuality", "");
  setValue("angulation", "");
  setValue("pellRamus", "");
  setValue("pellDepth", "");
  setValue("ianRisk", "");
  setValue("confidenceScore", "");
  setValue("comment", "");
}

function exportAssessmentsAsCSV() {
  const exportConfirmed = confirm(
    "Are you sure you want to export the CSV file?\n\n" +
    "The exported file will include both labelled and unlabelled radiographs."
  );

  if (!exportConfirmed) {
    return;
  }

  const manifest =
    JSON.parse(
      localStorage.getItem("radiograph_image_manifest")
    ) || [];

  const assessments =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  if (manifest.length === 0) {
    alert(
      "No uploaded radiograph records are available to export."
    );

    return;
  }

  const evaluatorId = getValue("evaluatorId");

  const evaluatorAssessments = evaluatorId
    ? assessments.filter(function (record) {
        return record.evaluator_id === evaluatorId;
      })
    : assessments;

  const assessmentMap = new Map();

  evaluatorAssessments.forEach(function (record) {
    assessmentMap.set(record.image_id, record);
  });

  const headers = [
    "evaluator_id",
    "image_id",
    "file_name",
    "upload_order",
    "label_status",
    "target_tooth",
    "image_quality",
    "angulation",
    "pell_ramus",
    "pell_depth",
    "overall_ian_risk",
    "confidence_score",
    "comment",
    "saved_at"
  ];

  const csvRows = [headers.join(",")];

  manifest.forEach(function (imageRecord) {
    const assessment =
      assessmentMap.get(imageRecord.image_id) || {};

    const row = {
      evaluator_id:
        assessment.evaluator_id ||
        evaluatorId ||
        "",

      image_id: imageRecord.image_id,
      file_name: imageRecord.file_name,
      upload_order: imageRecord.upload_order,

      label_status:
        assessment.image_id
          ? "Labelled"
          : "Unlabelled",

      target_tooth:
        assessment.target_tooth || "",

      image_quality:
        assessment.image_quality || "",

      angulation:
        assessment.angulation || "",

      pell_ramus:
        assessment.pell_ramus || "",

      pell_depth:
        assessment.pell_depth || "",

      overall_ian_risk:
        assessment.overall_ian_risk || "",

      confidence_score:
        assessment.confidence_score || "",

      comment:
        assessment.comment || "",

      saved_at:
        assessment.saved_at || ""
    };

    csvRows.push(
      headers
        .map(function (header) {
          return escapeCSV(row[header]);
        })
        .join(",")
    );
  });

  const csvContent =
    "\uFEFF" + csvRows.join("\n");

  const blob = new Blob(
    [csvContent],
    {
      type: "text/csv;charset=utf-8;"
    }
  );

  const fileEvaluatorId =
    evaluatorId || "unknown_evaluator";

  const today =
    new Date().toISOString().slice(0, 10);

  const fileName =
    fileEvaluatorId +
    "_radiograph_registry_and_assessment_" +
    today +
    ".csv";

  const downloadUrl =
    URL.createObjectURL(blob);

  const downloadLink =
    document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(downloadUrl);
}

function escapeCSV(value) {
  const stringValue =
    String(value ?? "").replace(/"/g, '""');

  return '"' + stringValue + '"';
}

async function clearSavedData() {
  const typedConfirmation = prompt(
    "Are you sure you want to delete all saved assessment data and locally saved radiograph images from this browser?\n\n" +
    "This action cannot be undone.\n\n" +
    "Type DELETE to confirm."
  );

  if (typedConfirmation !== "DELETE") {
    alert("Clear saved data was cancelled.");
    return;
  }

  try {
    localStorage.removeItem(
      "radiograph_assessments"
    );

    localStorage.removeItem(
      "radiograph_image_manifest"
    );

    localStorage.removeItem(
      "observer_info"
    );

    await deleteAllRadiographFilesFromDB();

    imageFiles = [];
    currentImageIndex = 0;

    clearAssessmentFields();
    clearImageViewer();
    restoreObserverInfo();
    updateSavedCount();
    updateProgressDashboard();

    alert(
      "All saved assessments, image records, and locally stored radiograph images were cleared."
    );
  } catch (error) {
    console.error("Clear data error:", error);

    alert(
      "Some saved data could not be cleared.\n\n" +
      "Error: " +
      (error.message || "Unknown error")
    );
  }
}

function updateSavedCount() {
  const existingData =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  const savedCount =
    document.getElementById("savedCount");

  if (savedCount) {
    savedCount.textContent =
      "Saved records: " + existingData.length;
  }
}

function saveObserverInfo() {
  const observerInfo = {
    evaluator_id: getValue("evaluatorId"),
    participant_id: getValue("participantId"),
    experience_years: getValue("experienceYears"),
    specialty: getValue("specialty")
  };

  localStorage.setItem(
    "observer_info",
    JSON.stringify(observerInfo)
  );
}

function restoreObserverInfo() {
  const observerInfo =
    JSON.parse(
      localStorage.getItem("observer_info")
    ) || {};

  setValue(
    "evaluatorId",
    observerInfo.evaluator_id
  );

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

function exportBackupJSON() {
  const existingData =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  const observerInfo =
    JSON.parse(
      localStorage.getItem("observer_info")
    ) || {};

  const imageManifest =
    JSON.parse(
      localStorage.getItem("radiograph_image_manifest")
    ) || [];

  if (
    existingData.length === 0 &&
    imageManifest.length === 0
  ) {
    alert(
      "No registered images or saved assessment data to back up."
    );

    return;
  }

  const backupData = {
    project:
      "Radiograph Gold Standard Platform",

    export_type:
      "backup_json",

    exported_at:
      new Date().toISOString(),

    observer_info:
      observerInfo,

    image_manifest:
      imageManifest,

    assessments:
      existingData,

    note:
      "This JSON backup does not contain the radiograph image files stored in IndexedDB."
  };

  const blob = new Blob(
    [JSON.stringify(backupData, null, 2)],
    {
      type: "application/json"
    }
  );

  const evaluatorId =
    getValue("evaluatorId") ||
    "unknown_evaluator";

  const today =
    new Date().toISOString().slice(0, 10);

  const fileName =
    evaluatorId +
    "_backup_" +
    today +
    ".json";

  const downloadUrl =
    URL.createObjectURL(blob);

  const downloadLink =
    document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(downloadUrl);
}

function importBackupJSON(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const backupData =
        JSON.parse(e.target.result);

      if (
        !backupData.assessments ||
        !Array.isArray(
          backupData.assessments
        )
      ) {
        alert(
          "Invalid backup file: assessments data is missing."
        );

        return;
      }

      localStorage.setItem(
        "radiograph_assessments",
        JSON.stringify(
          backupData.assessments
        )
      );

      if (backupData.observer_info) {
        localStorage.setItem(
          "observer_info",
          JSON.stringify(
            backupData.observer_info
          )
        );
      }

      if (
        backupData.image_manifest &&
        Array.isArray(
          backupData.image_manifest
        )
      ) {
        localStorage.setItem(
          "radiograph_image_manifest",
          JSON.stringify(
            backupData.image_manifest
          )
        );
      }

      restoreObserverInfo();
      updateSavedCount();
      updateProgressDashboard();
      updateUploadedImageCount();

      alert(
        "Backup imported successfully.\n\n" +
        "Registered images: " +
        (
          Array.isArray(
            backupData.image_manifest
          )
            ? backupData.image_manifest.length
            : 0
        ) +
        "\nSaved assessments: " +
        backupData.assessments.length +
        "\n\nThe JSON backup does not include the radiograph image files."
      );
    } catch (error) {
      console.error(
        "Backup import error:",
        error
      );

      alert(
        "Cannot import backup file. Please check that the selected file is a valid JSON backup."
      );
    }
  };

  reader.onerror = function () {
    alert(
      "Cannot read the selected backup file."
    );
  };

  reader.readAsText(file);
  event.target.value = "";
}

function updateProgressDashboard() {
  const existingData =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  const manifest =
    JSON.parse(
      localStorage.getItem("radiograph_image_manifest")
    ) || [];

  const evaluatorId = getValue("evaluatorId");

  let savedForEvaluator = existingData;

  if (evaluatorId) {
    savedForEvaluator =
      existingData.filter(function (record) {
        return (
          record.evaluator_id === evaluatorId
        );
      });
  }

  const savedImageIds = new Set(
    savedForEvaluator.map(function (record) {
      return record.image_id;
    })
  );

  const savedCount = savedImageIds.size;

  const totalImages =
    imageFiles.length > 0
      ? imageFiles.length
      : manifest.length;

  const remainingCount =
    totalImages > 0
      ? Math.max(
          totalImages - savedCount,
          0
        )
      : 0;

  setText(
    "savedImageCount",
    savedCount
  );

  setText(
    "remainingImageCount",
    remainingCount
  );

  const currentSaveStatusElement =
    document.getElementById(
      "currentSaveStatus"
    );

  if (currentSaveStatusElement) {
    const currentImageId =
      getValue("imageId");

    const isCurrentSaved =
      savedImageIds.has(currentImageId);

    currentSaveStatusElement.textContent =
      isCurrentSaved
        ? "Saved"
        : "Not saved";

    currentSaveStatusElement.className =
      isCurrentSaved
        ? "saved"
        : "unsaved";
  }
}

function setJavaScriptStatus(text) {
  const jsStatus =
    document.getElementById("jsStatus");

  if (jsStatus) {
    jsStatus.textContent = text;
  }
}

function registerUploadedImages(files) {
  const existingManifest =
    JSON.parse(
      localStorage.getItem("radiograph_image_manifest")
    ) || [];

  const existingAssessments =
    JSON.parse(
      localStorage.getItem("radiograph_assessments")
    ) || [];

  const manifestMap = new Map();

  existingManifest.forEach(function (item) {
    manifestMap.set(item.image_id, item);
  });

  files.forEach(function (file, index) {
    const imageId =
      getImageIdFromFileName(file.name);

    const hasAssessment =
      existingAssessments.some(
        function (assessment) {
          return (
            assessment.image_id === imageId
          );
        }
      );

    const previousRecord =
      manifestMap.get(imageId);

    manifestMap.set(imageId, {
      image_id: imageId,
      file_name: file.name,
      file_type: file.type || "",
      file_size_bytes: file.size || 0,
      upload_order: index + 1,

      label_status:
        hasAssessment
          ? "Labelled"
          : "Unlabelled",

      first_registered_at:
        previousRecord
          ? previousRecord.first_registered_at
          : new Date().toISOString(),

      last_selected_at:
        new Date().toISOString()
    });
  });

  const updatedManifest =
    Array.from(manifestMap.values());

  updatedManifest.sort(function (a, b) {
    return a.file_name.localeCompare(
      b.file_name,
      undefined,
      { numeric: true }
    );
  });

  updatedManifest.forEach(
    function (item, index) {
      item.upload_order = index + 1;
    }
  );

  localStorage.setItem(
    "radiograph_image_manifest",
    JSON.stringify(updatedManifest)
  );

  updateUploadedImageCount();
}

function updateUploadedImageCount() {
  const manifest =
    JSON.parse(
      localStorage.getItem("radiograph_image_manifest")
    ) || [];

  const imageProgress =
    document.getElementById("imageProgress");

  if (
    imageFiles.length === 0 &&
    imageProgress
  ) {
    imageProgress.textContent =
      "No image currently loaded | " +
      manifest.length +
      " images previously registered";
  }

  updateProgressDashboard();
}

function markImageAsLabelled(imageId) {
  const manifest =
    JSON.parse(
      localStorage.getItem("radiograph_image_manifest")
    ) || [];

  const updatedManifest =
    manifest.map(function (item) {
      if (item.image_id === imageId) {
        return {
          ...item,
          label_status: "Labelled",
          last_labelled_at:
            new Date().toISOString()
        };
      }

      return item;
    });

  localStorage.setItem(
    "radiograph_image_manifest",
    JSON.stringify(updatedManifest)
  );
}

function getValue(id) {
  const element =
    document.getElementById(id);

  return element
    ? String(element.value || "").trim()
    : "";
}

function setValue(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.value = value || "";
  }
}

function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}
