/* ========================================
   WIZARD.JS - Multi-step form navigation
   ======================================== */

const WizardController = (() => {
  let currentStepNumber = 0; // The actual step number (data-step value)
  let stepElements = []; // All step sections
  let dots = [];
  let prevBtn, submitBtn;
  let initialized = false; // Flag to ensure init only runs once

  function init() {
    // Prevent duplicate initialization
    if (initialized) {
      console.log('WizardController already initialized, skipping');
      return;
    }
    initialized = true;

    // Query all step sections by looking for elements with data-step attribute
    stepElements = Array.from(document.querySelectorAll('[data-step]')).filter(el => {
      // Only include section elements or div elements that are direct steps (not dots)
      return (el.tagName === 'SECTION' || el.className.includes('ai-step')) && 
             el.className.includes('ai-step') &&
             !el.className.includes('ai-step-dot');
    });
    
    dots = Array.from(document.querySelectorAll('.ai-step-dot'));
    prevBtn = document.getElementById('prev-btn');
    submitBtn = document.getElementById('submit-btn');

    // Log for debugging
    console.log('Wizard init: found', stepElements.length, 'steps and', dots.length, 'dots');

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
    dots.forEach((d) => {
      d.addEventListener('click', () => {
        const stepNum = Number(d.getAttribute('data-step'));
        if (Number.isFinite(stepNum)) {
          navigateToStep(stepNum);
        }
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
    console.log('Navigate to step:', targetStepNumber, 'current:', currentStepNumber);
    showStep(targetStepNumber);
  }

  function showStep(stepNumber) {
    // Validate the step number
    if (!Number.isFinite(stepNumber)) {
      console.warn('Invalid step number:', stepNumber);
      return;
    }

    currentStepNumber = stepNumber;
    console.log('Showing step:', stepNumber);
    
    // Show/hide sections based on their data-step attribute
    let found = false;
    stepElements.forEach((s) => {
      const sectionStepNum = Number(s.getAttribute('data-step'));
      const isTarget = sectionStepNum === stepNumber;
      if (isTarget) found = true;
      
      if (isTarget) {
        s.classList.remove('ai-hidden');
      } else {
        s.classList.add('ai-hidden');
      }
    });
    
    if (!found) {
      console.warn('Step', stepNumber, 'not found in step elements');
    }
    
    // Update button states
    if (prevBtn) prevBtn.disabled = (stepNumber === 0);
    if (submitBtn) {
      const stepNumbers = stepElements.map(s => Number(s.getAttribute('data-step'))).filter(Number.isFinite);
      const maxStepNumber = Math.max(...stepNumbers, 0);
      const isLastStep = stepNumber === maxStepNumber;
      submitBtn.textContent = isLastStep ? 'Get My Matches' : 'Next';
      submitBtn.type = isLastStep ? 'submit' : 'button';
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
