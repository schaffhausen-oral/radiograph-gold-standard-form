document.addEventListener("DOMContentLoaded", function () {
  const saveButton = document.getElementById("saveAssessmentBtn");

  if (!saveButton) {
    return;
  }

  saveButton.addEventListener("click", function () {
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
    existingData.push(assessment);

    localStorage.setItem("radiograph_assessments", JSON.stringify(existingData));

    alert("Assessment saved successfully. Total saved records: " + existingData.length);
  });
});

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}
