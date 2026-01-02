/* ========================================
   AIDVISOR.JS - Main application entry
   ======================================== */

// Outcomes field dynamic behavior
function initOutcomesField() {
  const outcomesMap = {
    "Co-ops/internships": "e.g., aerospace co-op, Big Tech SWE internship",
    "Job placement": "e.g., Goldman Sachs IB, FAANG SWE, top consulting",
    "Grad school prep": "e.g., MD pathway with research, PhD in AI focus",
    "Entrepreneurship": "e.g., startup incubator/accelerator, strong VC ties"
  };

  const outcomesSel = document.getElementById('outcomes_priority');
  const outcomesWrap = document.getElementById('outcomes_details_wrap');
  const outcomesInput = document.getElementById('outcomes_details');
  const outcomesLabel = document.getElementById('outcomes_details_label');

  function refreshOutcomes() {
    const v = outcomesSel?.value || "";
    if (!v) {
      outcomesWrap?.classList.add('ai-hidden');
      if (outcomesInput) outcomesInput.value = "";
      return;
    }
    if (outcomesInput) outcomesInput.placeholder = outcomesMap[v] || "Tell us more";
    if (outcomesLabel) outcomesLabel.textContent = `More about "${v}"`;
    outcomesWrap?.classList.remove('ai-hidden');
  }

  outcomesSel?.addEventListener('change', refreshOutcomes);
  refreshOutcomes();
}

// Draft management
function initDraftButton() {
  const saveDraftBtn = document.getElementById('save-draft-btn');
  saveDraftBtn?.addEventListener('click', () => {
    FormController.saveDraft();
    saveDraftBtn.textContent = 'Saved!';
    setTimeout(() => saveDraftBtn.textContent = 'Save Draft', 1200);
  });
}

// Form submission
function initFormSubmit() {
  const form = document.getElementById('admissions-form');
  const submitBtn = document.getElementById('submit-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn?.disabled) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing…";
    }

    UIController.showProcessing();
    APIController.resetState();
    UIController.clearInvalidHighlights();

    const payload = FormController.buildPayload();
    
    // For free users, limit to 3 schools
    if (MembershipController.isFree()) {
      payload.school_amount = 3;
    }

    await APIController.submitForm(
      payload,
      (schools) => {
        APIController.markComplete();
        UIController.renderSchools(schools);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Get My Matches';
        }
      },
      (error) => {
        APIController.markComplete();
        UIController.renderErrors(error);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Get My Matches';
        }
      },
      (avgMs, samples) => {
        UIController.startProgress(avgMs, samples);
      }
    );
  });
}

// Refine re-run
function initRefineButton() {
  const refineBtn = document.getElementById("btn-refine-rerun");
  const submitBtn = document.getElementById('submit-btn');

  refineBtn?.addEventListener("click", async () => {
    if (submitBtn?.disabled) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing…";
    }

    UIController.showProcessing();
    APIController.resetState();
    UIController.clearInvalidHighlights();

    window.__merge_with_previous_on_next_render__ = true;

    const payload = FormController.buildPayload();
    
    // For free users, limit to 3 schools
    if (MembershipController.isFree()) {
      payload.school_amount = 3;
    }

    await APIController.submitForm(
      payload,
      (schools) => {
        APIController.markComplete();
        UIController.renderSchools(schools);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Get My Matches';
        }
      },
      (error) => {
        APIController.markComplete();
        UIController.renderErrors(error);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Get My Matches';
        }
      },
      (avgMs, samples) => {
        UIController.startProgress(avgMs, samples);
      }
    );
  });
}

// Custom select enhancer
function initCustomSelects() {
  const selects = Array.from(document.querySelectorAll('select.ai-select'));
  selects.forEach(sel => enhanceSelect(sel));

  function enhanceSelect(sel) {
    if (!sel || sel.dataset.enhanced === "1" || sel.multiple) return;
    sel.dataset.enhanced = "1";

    const wrap = document.createElement('div');
    wrap.className = 'ai-select-wrap';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);

    sel.classList.add('ai-select-native');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-select-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = getSelectedText(sel) || sel.getAttribute('placeholder') || 'Select one';
    wrap.appendChild(btn);

    const menu = document.createElement('ul');
    menu.className = 'ai-select-menu';
    menu.setAttribute('role', 'listbox');
    const menuId = 'menu-' + Math.random().toString(36).slice(2, 8);
    menu.id = menuId;
    btn.setAttribute('aria-controls', menuId);
    wrap.appendChild(menu);

    Array.from(sel.children).forEach(child => {
      if (child.tagName === 'OPTGROUP') {
        const header = document.createElement('li');
        header.className = 'ai-select-group';
        header.textContent = child.label;
        menu.appendChild(header);
        Array.from(child.children).forEach(opt => addOption(opt));
      } else if (child.tagName === 'OPTION') {
        addOption(child);
      }
    });

    function addOption(opt) {
      const li = document.createElement('li');
      li.className = 'ai-select-option';
      li.setAttribute('role', 'option');
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      if (opt.disabled) { li.classList.add('is-disabled'); li.setAttribute('aria-disabled', 'true'); }
      if (opt.selected) { li.setAttribute('aria-selected', 'true'); }
      li.addEventListener('click', () => {
        if (li.classList.contains('is-disabled')) return;
        selectValue(opt.value, opt.textContent);
        closeMenu();
      });
      li.addEventListener('mouseenter', () => setActive(li));
      menu.appendChild(li);
    }

    btn.addEventListener('click', () => { wrap.classList.contains('open') ? closeMenu() : openMenu(); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) closeMenu(); });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(); }
    });
    menu.addEventListener('keydown', (e) => {
      const items = getEnabledItems();
      let i = items.indexOf(menu.querySelector('.ai-select-option.is-active'));
      if (e.key === 'ArrowDown') { e.preventDefault(); i = Math.min(i + 1, items.length - 1); setActive(items[i]); }
      if (e.key === 'ArrowUp') { e.preventDefault(); i = Math.max(i - 1, 0); setActive(items[i]); }
      if (e.key === 'Home') { e.preventDefault(); setActive(items[0]); }
      if (e.key === 'End') { e.preventDefault(); setActive(items[items.length - 1]); }
      if (e.key === 'Enter') { e.preventDefault(); items[i]?.click(); }
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); btn.focus(); }
    });

    function openMenu() { wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); focusCurrent(); }
    function closeMenu() { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); clearActive(); }
    function getEnabledItems() { return Array.from(menu.querySelectorAll('.ai-select-option:not(.is-disabled)')); }
    function setActive(el) { clearActive(); if (el) { el.classList.add('is-active'); el.scrollIntoView({ block: 'nearest' }); } }
    function clearActive() { menu.querySelectorAll('.ai-select-option.is-active').forEach(n => n.classList.remove('is-active')); }
    function focusCurrent() {
      menu.tabIndex = -1; menu.focus();
      const current = menu.querySelector('[aria-selected="true"]') || getEnabledItems()[0];
      if (current) setActive(current);
    }
    function selectValue(value, label) {
      sel.value = value;
      btn.textContent = label || 'Select one';
      menu.querySelectorAll('[aria-selected="true"]').forEach(n => n.removeAttribute('aria-selected'));
      const li = Array.from(menu.querySelectorAll('.ai-select-option')).find(n => n.dataset.value === value);
      if (li) li.setAttribute('aria-selected', 'true');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function getSelectedText(selEl) {
      const o = selEl.options[selEl.selectedIndex];
      return o ? o.text : '';
    }
  }
}

// Initialize refine UI as hidden
function initRefineUI() {
  const refine = document.getElementById("ai-refine");
  if (refine) refine.style.display = "none";
}

// Expose a re-initialization hook for dynamically injected HTML
window.AidVisorInit = function AidVisorInit() {
  try {
    // Initialize all modules
    if (typeof WizardController?.init === 'function') WizardController.init();
    if (typeof FormController?.loadDraft === 'function') FormController.loadDraft();
    if (typeof DetailsController?.init === 'function') DetailsController.init();

    // Initialize UI components
    initOutcomesField();
    initCustomSelects();
    initDraftButton();
    initFormSubmit();
    initRefineButton();
    initRefineUI();

    // Hide results on initial load
    const el = id => document.getElementById(id);
    el("ai-errors")?.classList.add("ai-hidden");
    el("ai-schools")?.classList.add("ai-hidden");
    el("ai-results")?.classList.add("ai-hidden");
    el("ai-processing")?.classList.add("ai-hidden");
  } catch (e) {
    console.error('AidVisorInit failed:', e);
  }
};

// Main initialization (runs on first page load)
(function init() { window.AidVisorInit?.(); })();
