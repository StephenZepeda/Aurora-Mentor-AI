/* ========================================
   WIZARD.JS - Multi-step form navigation
   ======================================== */

const WizardController = (() => {
  let currentStepNumber = 0; // The actual step number (data-step value)
  let stepElements = []; // All step sections
  let dots = [];
  let prevBtn, submitBtn;

  function init() {
    stepElements = Array.from(document.querySelectorAll('section.ai-step'));
    dots = Array.from(document.querySelectorAll('.ai-step-dot'));
    prevBtn = document.getElementById('prev-btn');
    submitBtn = document.getElementById('submit-btn');

    // Wire up navigation
    prevBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToStep(currentStepNumber - 1);
    });
    submitBtn?.addEventListener('click', (e) => {
      if (submitBtn.type === 'button') {
        e.preventDefault();
        // Always advance to the next step number sequentially
        navigateToStep(currentStepNumber + 1);
      }
      // If type='submit', let it bubble to form handler
    });
    dots.forEach((d, i) => {
      d.addEventListener('click', () => {
        const stepNum = Number(d.getAttribute('data-step'));
        navigateToStep(Number.isFinite(stepNum) ? stepNum : i);
      });
    });

    showStep(0);
  }

  function syncDots() {
    dots.forEach((d) => {
      const stepNum = Number(d.getAttribute('data-step'));
      d.classList.toggle('active', stepNum === currentStepNumber);
      d.classList.toggle('done', stepNum < currentStepNumber);
    });
  }

  function navigateToStep(targetStepNumber) {
    // Find the max step number available
    const maxStepNumber = Math.max(...stepElements.map(s => Number(s.getAttribute('data-step')) ?? -1));
    // Clamp to valid range
    const newStepNumber = Math.max(0, Math.min(maxStepNumber, targetStepNumber));
    showStep(newStepNumber);
  }

  function showStep(stepNumber) {
    currentStepNumber = stepNumber;
    
    // Show/hide sections based on their data-step attribute
    stepElements.forEach((s) => {
      const sectionStepNum = Number(s.getAttribute('data-step'));
      s.classList.toggle('ai-hidden', sectionStepNum !== stepNumber);
    });
    
    // Update button states
    if (prevBtn) prevBtn.disabled = (stepNumber === 0);
    if (submitBtn) {
      const maxStepNumber = Math.max(...stepElements.map(s => Number(s.getAttribute('data-step')) ?? -1));
      submitBtn.textContent = (stepNumber === maxStepNumber) ? 'Get My Matches' : 'Next';
      submitBtn.type = (stepNumber === maxStepNumber) ? 'submit' : 'button';
    }
    syncDots();
    document.querySelector('.ai-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function sectionIndexForNode(node) {
    const sec = node?.closest?.("section.ai-step");
    if (!sec) return null;
    const idx = Number(sec.getAttribute("data-step"));
    return Number.isFinite(idx) ? idx : null;
  }

  function jumpToField(id) {
    const node = document.getElementById(id);
    if (!node) return;
    const idx = sectionIndexForNode(node);
    if (idx != null) showStep(idx);
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.focus?.({ preventScroll: true }), 250);
  }

  return { init, showStep, jumpToField };
})();
