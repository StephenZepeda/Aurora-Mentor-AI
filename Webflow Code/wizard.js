/* ========================================
   WIZARD.JS - Multi-step form navigation
   ======================================== */

const WizardController = (() => {
  let stepIndex = 0;
  let steps = [];
  let dots = [];
  let prevBtn, submitBtn;

  function init() {
    steps = Array.from(document.querySelectorAll('.ai-step'));
    dots = Array.from(document.querySelectorAll('.ai-step-dot'));
    prevBtn = document.getElementById('prev-btn');
    submitBtn = document.getElementById('submit-btn');

    // Wire up navigation
    prevBtn?.addEventListener('click', () => showStep(stepIndex - 1));
    submitBtn?.addEventListener('click', (e) => {
      if (submitBtn.type === 'button') {
        e.preventDefault();
        showStep(stepIndex + 1);
      }
      // If type='submit', let it bubble to form handler
    });
    dots.forEach((d, i) => d.addEventListener('click', () => showStep(i)));

    showStep(0);
  }

  function syncDots() {
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === stepIndex);
      d.classList.toggle('done', i < stepIndex);
    });
  }

  function showStep(i) {
    stepIndex = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, idx) => s.classList.toggle('ai-hidden', idx !== stepIndex));
    if (prevBtn) prevBtn.disabled = (stepIndex === 0);
    if (submitBtn) {
      submitBtn.textContent = (stepIndex === steps.length - 1) ? 'Get My Matches' : 'Next';
      submitBtn.type = (stepIndex === steps.length - 1) ? 'submit' : 'button';
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
