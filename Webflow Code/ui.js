/* ========================================
   UI.JS - UI rendering & state management
   ======================================== */

const UIController = (() => {
  const el = id => document.getElementById(id);

  let progressTimer = null;
  let progressStartTs = 0;
  let progressAvgMs = 0;
  let progressSamples = 0;

  window.__merge_with_previous_on_next_render__ = false;
  window.__ai_raw_schools__ = [];

  function dedupeByName(arr) {
    const seen = new Set();
    return (arr || []).filter(item => {
      const k = (item?.name || "").toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function nameExcludes(target, excludeList) {
    if (!excludeList.length) return false;
    const t = (target || "").toLowerCase();
    return excludeList.some(q => t.includes(q.toLowerCase()));
  }

  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ========== Progress Bar ==========
  function formatMs(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return (m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`);
  }

  function showProgressUI() {
    el("ai-progress")?.classList.remove("ai-hidden");
    el("ai-eta")?.classList.remove("ai-hidden");
  }

  function hideProgressUI() {
    el("ai-progress")?.classList.add("ai-hidden");
    el("ai-eta")?.classList.add("ai-hidden");
    if (el("ai-progress-bar")) el("ai-progress-bar").style.width = "0%";
  }

  function startProgress(avgMs, samples) {
    progressAvgMs = Math.max(3000, Number(avgMs) || 0);
    progressSamples = Number(samples) || 0;
    progressStartTs = performance.now();
    showProgressUI();
    tickProgress();
  }

  function tickProgress() {
    const elapsed = performance.now() - progressStartTs;
    const linearPct = progressAvgMs ? (elapsed / progressAvgMs) * 100 : 0;
    const eased = 100 * (1 - Math.exp(-linearPct / 60));
    const pct = Math.max(2, Math.min(96, isFinite(eased) ? eased : 0));
    if (el("ai-progress-bar")) el("ai-progress-bar").style.width = pct.toFixed(1) + "%";

    if (progressAvgMs) {
      const THREE_MIN_MS = 3 * 60 * 1000;
      const remaining = Math.max(0, progressAvgMs - elapsed);
      if (el("ai-eta")) {
        el("ai-eta").textContent =
          elapsed > THREE_MIN_MS
            ? "Still working… this may take up to 5 minutes."
            : elapsed > progressAvgMs
              ? "Taking longer than usual… still working"
              : `~${formatMs(remaining)} remaining${progressSamples ? ` (based on ${progressSamples} runs)` : ""}`;
      }
    } else {
      if (el("ai-eta")) el("ai-eta").textContent = "Estimating…";
    }
    progressTimer = setTimeout(tickProgress, 200);
  }

  function stopProgress() {
    if (progressTimer) { clearTimeout(progressTimer); progressTimer = null; }
    if (el("ai-progress-bar")) el("ai-progress-bar").style.width = "100%";
    if (el("ai-eta")) el("ai-eta").textContent = "Finalizing…";
    setTimeout(hideProgressUI, 900);
  }

  // ========== Processing Spinner ==========
  function showProcessing() {
    el("ai-results")?.classList.remove("ai-hidden");
    el("ai-errors")?.classList.add("ai-hidden");
    el("ai-schools")?.classList.add("ai-hidden");
    el("ai-processing")?.classList.remove("ai-hidden");
  }

  function hideProcessing() {
    el("ai-processing")?.classList.add("ai-hidden");
  }

  // ========== Schools Display ==========
  function drawSchools(list) {
    if (!el("ai-schools")) return;
    
    // Apply membership filtering
    let filteredList = list;
    if (typeof MembershipController !== 'undefined') {
      filteredList = MembershipController.filterSchoolsForDisplay(list);
    }
    
    let cardsHTML = (filteredList || []).map((s, index) => {
      // Use membership controller's render if available
      if (typeof MembershipController !== 'undefined') {
        return MembershipController.renderSchoolCard(s, index);
      }
      
      // Fallback to original rendering
      const cat = (s.category || "").toLowerCase();
      const cls = cat === 'safety' ? 'safety' : cat === 'match' ? 'match' : cat === 'reach' ? 'reach' : '';
      return `<div class="ai-card-result">
        <div class="ai-card-content">
          <h3>${s.name || ""}</h3>
          <div>
            ${s.category ? `<span class="ai-pill ${cls}">${s.category}</span>` : ""}
            ${s.chance_percent != null ? `<span class="ai-pill">${s.chance_percent}% chance</span>` : ""}
            ${s.distance_from_location ? `<span class="ai-pill">${s.distance_from_location}</span>` : ""}
          </div>
          <p>${s.reasoning || ""}</p>
        </div>
      </div>`;
    }).join("");
    
    if (typeof MembershipController !== 'undefined' && MembershipController.isFree() && filteredList.length > 0) {
      const fakeCardCount = 7;
      for (let i = 0; i < fakeCardCount; i++) {
        const fakeSchool = MembershipController.generateFakeCard(i);
        cardsHTML += MembershipController.renderSchoolCard(fakeSchool, filteredList.length + i);
      }
    }
    el("ai-schools").innerHTML = cardsHTML;
  }

  function renderSchools(list) {
    const refine = el("ai-refine");
    if (refine) refine.style.display = "block";

    let baseList = Array.isArray(list) ? list.slice() : [];
    if (window.__merge_with_previous_on_next_render__) {
      const prev = Array.isArray(window.__ai_raw_schools__) ? window.__ai_raw_schools__ : [];
      let merged = dedupeByName([...prev, ...baseList]);

      const excludeList = FormController.csvToList("exclude_colleges");
      if (excludeList.length) {
        merged = merged.filter(item => !nameExcludes(item?.name || "", excludeList));
      }
      baseList = merged;
      window.__merge_with_previous_on_next_render__ = false;
    }

    window.__ai_raw_schools__ = Array.isArray(baseList) ? baseList.slice() : [];
    drawSchools(window.__ai_raw_schools__);

    el("ai-results")?.classList.remove("ai-hidden");
    el("ai-errors")?.classList.add("ai-hidden");
    el("ai-schools")?.classList.remove("ai-hidden");
    hideProcessing();
    stopProgress();
  }

  // ========== Error Display ==========
  function renderErrors(msg) {
    if (el("ai-errors")) {
      el("ai-errors").innerHTML = `<strong>Error:</strong> ${msg}`;
    }
    el("ai-results")?.classList.remove("ai-hidden");
    el("ai-errors")?.classList.remove("ai-hidden");
    el("ai-schools")?.classList.add("ai-hidden");
    hideProcessing();
    stopProgress();
  }

  // ========== Validation Errors ==========
  function clearInvalidHighlights() {
    document.querySelectorAll(".ai-error, .ai-has-error").forEach(n => n.classList.remove("ai-error", "ai-has-error"));
  }

  function markInvalidFields(items) {
    clearInvalidHighlights();
    (items || []).forEach(it => {
      if (!it?.id) return;
      const node = el(it.id);
      if (!node) return;
      const wrap = node.closest?.(".ai-select-wrap");
      if (wrap) wrap.classList.add("ai-has-error");
      if (node.classList) node.classList.add("ai-error");
    });
  }

  function normalizeInvalid(data) {
    const out = [];
    const push = (field, message) => out.push({
      field: String(field || "Field"),
      message: String(message || "Please correct this field."),
      id: FormController.findFieldId(field)
    });

    if (data == null) return out;

    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === "string") push(item, "Please check this field.");
        else if (item && typeof item === "object") {
          if ("field" in item || "name" in item) {
            push(item.field || item.name, item.message || item.reason || item.error || "Invalid value.");
          } else {
            for (const [k, v] of Object.entries(item)) {
              if (Array.isArray(v)) push(k, v.join("; "));
              else if (v && typeof v === "object") push(k, v.message || v.reason || JSON.stringify(v));
              else push(k, String(v));
            }
          }
        } else {
          push("General", String(item));
        }
      }
      return out;
    }

    if (typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) push(k, v.join("; "));
        else if (v && typeof v === "object") push(k, v.message || v.reason || JSON.stringify(v));
        else push(k, String(v));
      }
      return out;
    }

    if (typeof data === "string") {
      push("General", data);
      return out;
    }

    push("General", "Please review the highlighted fields.");
    return out;
  }

  function buildInvalidHTML(items) {
    const li = items.map(it => {
      const chip = it.id
        ? `<button type="button" class="ai-error-chip" data-go="${escapeHtml(it.id)}">${escapeHtml(it.field)}</button>`
        : `<span class="ai-error-chip is-text">${escapeHtml(it.field)}</span>`;
      return `<li class="ai-error-item">
        ${chip}
        <span class="ai-error-text">${escapeHtml(it.message)}</span>
      </li>`;
    }).join("");

    return `
      <div class="ai-card-error">
        <div class="ai-error-head">
          <div class="ai-error-icon">!</div>
          <div>
            <h3 class="ai-error-title">We need a few fixes before we can match schools</h3>
            <p class="ai-error-sub">Click a chip to jump to that field.</p>
          </div>
        </div>
        <ul class="ai-error-list">${li}</ul>
      </div>`;
  }

  function renderInvalidUI(invalid) {
    const items = normalizeInvalid(invalid);
    markInvalidFields(items);

    el("ai-results")?.classList.remove("ai-hidden");
    el("ai-errors")?.classList.remove("ai-hidden");
    el("ai-schools")?.classList.add("ai-hidden");
    if (el("ai-errors")) el("ai-errors").innerHTML = buildInvalidHTML(items);

    el("ai-errors")?.addEventListener("click", (e) => {
      const tgt = e.target.closest?.("[data-go]");
      if (!tgt) return;
      const id = tgt.getAttribute("data-go");
      if (id && WizardController) WizardController.jumpToField(id);
    });

    hideProcessing();
    stopProgress();
  }

  function handleErrorMessage(msgOrObj) {
    if (msgOrObj && typeof msgOrObj === "object" && "invalid_fields" in msgOrObj) {
      return renderInvalidUI(msgOrObj.invalid_fields);
    }
    if (typeof msgOrObj === "string") {
      const m = msgOrObj.match(/^\s*Invalid\s+fields:\s*(.*)$/i);
      if (m) {
        let parsed = null;
        try { parsed = JSON.parse(m[1]); } catch { parsed = m[1]; }
        return renderInvalidUI(parsed);
      }
    }
    renderErrors(String(msgOrObj || "Something went wrong."));
  }

  return {
    showProcessing,
    hideProcessing,
    startProgress,
    stopProgress,
    renderSchools,
    renderErrors: handleErrorMessage,
    clearInvalidHighlights,
    drawSchools
  };
})();
