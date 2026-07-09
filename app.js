let imageFiles = [];
let currentImageIndex = 0;

document.addEventListener("DOMContentLoaded", function () {
  const imageUpload = document.getElementById("imageUpload");
  const prevImageBtn = document.getElementById("prevImageBtn");
  const nextImageBtn = document.getElementById("nextImageBtn");
  const saveButton = document.getElementById("saveAssessmentBtn");

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
    saveButton.addEventListener("click", saveAssessment);
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

  const radiographImage = document.getElementById("radiographImage");
  const imageProgress = document.getElementById("imageProgress");
  const imageIdInput = document.getElementById("imageId");

  const imageId = getImageIdFromFileName(file.name);

  radiographImage.src = imageUrl;
  radiographImage.style.display = "block";

  imageProgress.textContent =
    "Image " + (currentImageIndex + 1) + " of " + imageFiles.length + " | " + imageId;

  imageIdInput.value = imageId;

  loadExistingAssessmentForCurrentImage();
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
    clearAssessmentFields();
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
    clearAssessmentFields();
    showCurrentImage();
  }
}

function saveAssessment() {
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

  if (!assessment.evaluator_id || !assessment.image_id || !assessment.target_tooth) {
    alert("Please complete Evaluator ID, Image ID, and Target Tooth before saving.");
    return;
  }

  const existingData = JSON.parse(localStorage.getItem("radiograph_assessments")) || [];

  const duplicateIndex = existingData.findIndex(function (item) {
    return item.evaluator_id === assessment.evaluator_id &&
           item.image_id === assessment.image_id &&
           item.target_tooth === assessment.target_tooth;
  });

  if (duplicateIndex >= 0) {
    existingData[duplicateIndex] = assessment;
  } else {
    existingData.push(assessment);
  }

  localStorage.setItem("radiograph_assessments", JSON.stringify(existingData));

  alert("Assessment saved successfully. Total saved records: " + existingData.length);
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
