let imageFiles = [];
let currentImageIndex = 0;

document.addEventListener("DOMContentLoaded", function () {
  const jsStatus = document.getElementById("jsStatus");
  if (jsStatus) {
    jsStatus.textContent = "JavaScript status: loaded";
  }

  const imageUpload = document.getElementById("imageUpload");
  const prevImageBtn = document.getElementById("prevImageBtn");
  const nextImageBtn = document.getElementById("nextImageBtn");
  const saveButton = document.getElementById("saveAssessmentBtn");
  const saveNextBtn = document.getElementById("saveNextBtn");
  const nextUnsavedBtn = document.getElementById("nextUnsavedBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const clearDataBtn = document.getElementById("clearDataBtn");
  const exportBackupBtn = document.getElementById("exportBackupBtn");
  const importBackupBtn = document.getElementById("importBackupBtn");
  const backupFileInput = document.getElementById("backupFileInput");
  const jumpImageBtn = document.getElementById("jumpImageBtn");

  restoreObserverInfo();
  updateSavedCount();
  updateProgressDashboard();

  if (imageUpload) {
    imageUpload.addEventListener("change", handleImageUpload);
  }

  if (prevImageBtn) {
    prevImageBtn.addEventListener("click", showPreviousImage);
  }

  if (nextImageBtn) {
    nextImageBtn.addEventListener("click", showNextImage);
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

  if (jumpImageBtn) {
    jumpImageBtn.addEventListener("click", jumpToImage);
  }
});

function handleImageUpload(event) {
  imageFiles = Array.from(event.target.files);

  imageFiles.sort(function (a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  currentImageIndex = 0;

  if (imageFiles.length === 0) {
    alert("No image selected.");
    return;
  }

  showCurrentImage();
}

function showCurrentImage() {
  if (imageFiles.length === 0) {
    return;
  }

  const file = imageFiles[currentImageIndex];
  const imageUrl = URL.createObjectURL(file);
  const imageId = getImageIdFromFileName(file.name);

  const radiographImage = document.getElementById("radiographImage");
  const imageProgress = document.getElementById("imageProgress");
  const imageIdInput = document.getElementById("imageId");

  if (radiographImage) {
    radiographImage.src = imageUrl;
    radiographImage.style.display = "block";
  }

  if (imageProgress) {
    imageProgress.textContent =
      "Image " + (currentImageIndex + 1) + " of " + imageFiles.length + " | " + imageId;
  }

  if (imageIdInput) {
    imageIdInput.value = imageId;
  }

  clearAssessmentFields();
  loadExistingAssessmentForCurrentImage();
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
    alert("Please upload/select a radiograph image before saving.");
    return false;
  }

  if (!assessment.target_tooth) {
    alert("Please select Target Tooth before saving.");
    return false;
  }

  saveObserverInfo();

  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];

  const duplicateIndex = existingData.findIndex(function (item) {
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

  localStorage.setItem("radiograph_assessments", JSON.stringify(existingData));

  updateSavedCount();
  updateProgressDashboard();

  if (showAlert) {
    alert("Assessment saved successfully. Total saved records: " + existingData.length);
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
    updateProgressDashboard();
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

  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];

  const savedImageIds = new Set(
    existingData
      .filter(function (record) {
        return record.evaluator_id === evaluatorId;
      })
      .map(function (record) {
        return record.image_id;
      })
  );

  for (let step = 1; step <= imageFiles.length; step++) {
    const nextIndex = (currentImageIndex + step) % imageFiles.length;
    const nextImageId = getImageIdFromFileName(imageFiles[nextIndex].name);

    if (!savedImageIds.has(nextImageId)) {
      currentImageIndex = nextIndex;
      showCurrentImage();
      return;
    }
  }

  alert("All uploaded images have been saved for this Evaluator ID.");
}

function jumpToImage() {
  if (imageFiles.length === 0) {
    alert("Please upload radiograph images first.");
    return;
  }

  const jumpInput = document.getElementById("jumpImageNumber");

  if (!jumpInput) {
    alert("Jump input not found.");
    return;
  }

  const imageNumber = Number(jumpInput.value);

  if (!imageNumber || imageNumber < 1 || imageNumber > imageFiles.length) {
    alert("Please enter a valid image number between 1 and " + imageFiles.length + ".");
    return;
  }

  currentImageIndex = imageNumber - 1;
  showCurrentImage();
}

function loadExistingAssessmentForCurrentImage() {
  const evaluatorId = getValue("evaluatorId");
  const imageId = getValue("imageId");

  if (!evaluatorId || !imageId) {
    return;
  }

  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];

  const existingRecord = existingData.find(function (item) {
    return item.evaluator_id === evaluatorId && item.image_id === imageId;
  });

  if (!existingRecord) {
    return;
  }

  setValue("targetTooth", existingRecord.target_tooth);
  setValue("imageQuality", existingRecord.image_quality);
  setValue("angulation", existingRecord.angulation);
  setValue("pellRamus", existingRecord.pell_ramus);
  setValue("pellDepth", existingRecord.pell_depth);
  setValue("ianRisk", existingRecord.overall_ian_risk);
  setValue("confidenceScore", existingRecord.confidence_score);
  setValue("comment", existingRecord.comment);
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
    "Are you sure you want to export the CSV file? Please confirm that this evaluator's data is ready to send to the principal investigator."
  );

  if (!exportConfirmed) {
    return;
  }
  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];

  if (existingData.length === 0) {
    alert("No saved assessment data to export.");
    return;
  }

  const evaluatorId = getValue("evaluatorId");

  let dataToExport = existingData;

  if (evaluatorId) {
    dataToExport = existingData.filter(function (record) {
      return record.evaluator_id === evaluatorId;
    });
  }

  if (dataToExport.length === 0) {
    alert("No saved data found for this Evaluator ID.");
    return;
  }

  const headers = [
    "evaluator_id",
    "participant_id",
    "experience_years",
    "specialty",
    "image_id",
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

  const csvRows = [];
  csvRows.push(headers.join(","));

  dataToExport.forEach(function (record) {
    const row = headers.map(function (header) {
      return escapeCSV(record[header] || "");
    });

    csvRows.push(row.join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const fileEvaluatorId = evaluatorId || "unknown_evaluator";
  const today = new Date().toISOString().slice(0, 10);
  const fileName = fileEvaluatorId + "_radiograph_assessment_" + today + ".csv";

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = fileName;
  downloadLink.click();

  URL.revokeObjectURL(downloadLink.href);
}

function escapeCSV(value) {
  const stringValue = String(value).replace(/"/g, '""');
  return '"' + stringValue + '"';
}

function clearSavedData() {
  const typedConfirmation = prompt(
    "Are you sure you want to delete all saved assessment data from this browser?\n\nThis action cannot be undone.\n\nType DELETE to confirm."
  );

  if (typedConfirmation !== "DELETE") {
    alert("Clear saved data was cancelled.");
    return;
  }

  localStorage.removeItem("radiograph_assessments");

  updateSavedCount();
  updateProgressDashboard();

  alert("Saved data cleared. Saved records: 0");
}

  if (!confirmed) {
    return;
  }

  localStorage.removeItem("radiograph_assessments");
  updateSavedCount();
  updateProgressDashboard();

  alert("Saved data cleared.");
}

function updateSavedCount() {
  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];
  const savedCount = document.getElementById("savedCount");

  if (savedCount) {
    savedCount.textContent = "Saved records: " + existingData.length;
  }
}

function saveObserverInfo() {
  const observerInfo = {
    evaluator_id: getValue("evaluatorId"),
    participant_id: getValue("participantId"),
    experience_years: getValue("experienceYears"),
    specialty: getValue("specialty")
  };

  localStorage.setItem("observer_info", JSON.stringify(observerInfo));
}

function restoreObserverInfo() {
  const observerInfo = JSON.parse(localStorage.getItem("observer_info")) || {};

  setValue("evaluatorId", observerInfo.evaluator_id);
  setValue("participantId", observerInfo.participant_id);
  setValue("experienceYears", observerInfo.experience_years);
  setValue("specialty", observerInfo.specialty);
}

function exportBackupJSON() {
  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];
  const observerInfo = JSON.parse(localStorage.getItem("observer_info")) || {};

  if (existingData.length === 0) {
    alert("No saved data to back up.");
    return;
  }

  const backupData = {
    project: "Radiograph Gold Standard Platform",
    export_type: "backup_json",
    exported_at: new Date().toISOString(),
    observer_info: observerInfo,
    assessments: existingData
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: "application/json"
  });

  const evaluatorId = getValue("evaluatorId") || "unknown_evaluator";
  const today = new Date().toISOString().slice(0, 10);
  const fileName = evaluatorId + "_backup_" + today + ".json";

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = fileName;
  downloadLink.click();

  URL.revokeObjectURL(downloadLink.href);
}

function importBackupJSON(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const backupData = JSON.parse(e.target.result);

      if (!backupData.assessments || !Array.isArray(backupData.assessments)) {
        alert("Invalid backup file.");
        return;
      }

      localStorage.setItem(
        "radiograph_assessments",
        JSON.stringify(backupData.assessments)
      );

      if (backupData.observer_info) {
        localStorage.setItem(
          "observer_info",
          JSON.stringify(backupData.observer_info)
        );
      }

      restoreObserverInfo();
      updateSavedCount();
      updateProgressDashboard();

      alert("Backup imported successfully. Saved records: " + backupData.assessments.length);
    } catch (error) {
      alert("Cannot import backup file. Please check the JSON file.");
    }
  };

  reader.readAsText(file);
}

function updateProgressDashboard() {
  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];
  const evaluatorId = getValue("evaluatorId");

  let savedForEvaluator = existingData;

  if (evaluatorId) {
    savedForEvaluator = existingData.filter(function (record) {
      return record.evaluator_id === evaluatorId;
    });
  }

  const savedImageIds = new Set(
    savedForEvaluator.map(function (record) {
      return record.image_id;
    })
  );

  const savedCount = savedImageIds.size;
  const totalImages = imageFiles.length;
  const remainingCount = totalImages > 0 ? Math.max(totalImages - savedCount, 0) : 0;

  const savedImageCountElement = document.getElementById("savedImageCount");
  const remainingImageCountElement = document.getElementById("remainingImageCount");
  const currentSaveStatusElement = document.getElementById("currentSaveStatus");

  if (savedImageCountElement) {
    savedImageCountElement.textContent = savedCount;
  }

  if (remainingImageCountElement) {
    remainingImageCountElement.textContent = remainingCount;
  }

  if (currentSaveStatusElement) {
    const currentImageId = getValue("imageId");
    const isCurrentSaved = savedImageIds.has(currentImageId);

    if (isCurrentSaved) {
      currentSaveStatusElement.textContent = "Saved";
      currentSaveStatusElement.className = "saved";
    } else {
      currentSaveStatusElement.textContent = "Not saved";
      currentSaveStatusElement.className = "unsaved";
    }
  }
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value || "";
  }
}
