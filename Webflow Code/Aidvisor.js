/* -------- Wizard state -------- */
const steps = Array.from(document.querySelectorAll('.ai-step'));
const dots = Array.from(document.querySelectorAll('.ai-step-dot'));
const prevBtn = document.getElementById('prev-btn');
const submitBtn = document.getElementById('submit-btn');
const saveDraftBtn = document.getElementById('save-draft-btn');
let stepIndex = 0;

window.__merge_with_previous_on_next_render__ = false;

function dedupeByName(arr) {
  const seen = new Set();
  return (arr || []).filter(item => {
    const k = (item?.name || "").toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
  prevBtn.disabled = (stepIndex === 0);
  submitBtn.textContent = (stepIndex === steps.length - 1) ? 'Get My Matches' : 'Next';
  submitBtn.type = (stepIndex === steps.length - 1) ? 'submit' : 'button';
  syncDots();
  document.querySelector('.ai-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Outcomes follow-up
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
  const v = outcomesSel.value || "";
  if (!v) { outcomesWrap.classList.add('ai-hidden'); outcomesInput.value = ""; return; }
  outcomesInput.placeholder = outcomesMap[v] || "Tell us more";
  outcomesLabel.textContent = `More about "${v}"`;
  outcomesWrap.classList.remove('ai-hidden');
}
outcomesSel.addEventListener('change', refreshOutcomes);
refreshOutcomes();

function csvToList(inputId) {
  const raw = (document.getElementById(inputId)?.value || "").trim();
  if (!raw) return [];
  return raw.split(/[,;|\n]/g).map(s => s.trim()).filter(Boolean);
}
function nameMatches(target, list) {
  if (!list.length) return true;
  const t = (target || "").toLowerCase();
  return list.some(q => t.includes(q.toLowerCase()));
}
function nameExcludes(target, excludeList) {
  if (!excludeList.length) return false;
  const t = (target || "").toLowerCase();
  return excludeList.some(q => t.includes(q.toLowerCase()));
}

// Geographic features collector
function getGeoFeatures() {
  const box = document.getElementById('geo_features');
  const vals = Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
  const other = document.getElementById('geo_features_other').value?.trim();
  if (other) vals.push(other);
  return vals;
}

// Move between steps
prevBtn.addEventListener('click', () => showStep(stepIndex - 1));
submitBtn.addEventListener('click', (e) => {
  if (submitBtn.type === 'button') {
    e.preventDefault();
    showStep(stepIndex + 1);
  }
});
dots.forEach((d, i) => d.addEventListener('click', () => showStep(i)));

// Draft save (local)
saveDraftBtn.addEventListener('click', () => {
  const payload = buildPayload();
  localStorage.setItem('ai_advisor_draft', JSON.stringify(payload));
  saveDraftBtn.textContent = 'Saved!';
  setTimeout(() => saveDraftBtn.textContent = 'Save Draft', 1200);
});
(function loadDraft() {
  try {
    const raw = localStorage.getItem('ai_advisor_draft');
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const [k, v] of Object.entries(data)) {
      const node = document.getElementById(k);
      if (!node) continue;
      if (Array.isArray(v)) node.value = v.join(', ');
      else node.value = v ?? '';
    }
  } catch { }
})();

/* ---------------- Predictive progress (avg-based) ---------------- */
let progressTimer = null;
let progressStartTs = 0;
let progressAvgMs = 0;
let progressSamples = 0;

const el = id => document.getElementById(id);

function formatMs(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`);
}
function showProgressUI() {
  el("ai-progress").classList.remove("ai-hidden");
  el("ai-eta").classList.remove("ai-hidden");
}
function hideProgressUI() {
  el("ai-progress").classList.add("ai-hidden");
  el("ai-eta").classList.add("ai-hidden");
  el("ai-progress-bar").style.width = "0%";
}
function startProgress(avgMs, samples) {
  progressAvgMs = Math.max(3000, Number(avgMs) || 0); // floor 3s to avoid instant fill
  progressSamples = Number(samples) || 0;
  progressStartTs = performance.now();
  showProgressUI();
  tickProgress();
}
function tickProgress() {
  const elapsed = performance.now() - progressStartTs;
  const linearPct = progressAvgMs ? (elapsed / progressAvgMs) * 100 : 0;
  const eased = 100 * (1 - Math.exp(-linearPct / 60)); // smooth ease-out
  const pct = Math.max(2, Math.min(96, isFinite(eased) ? eased : 0)); // plateau at 96%
  el("ai-progress-bar").style.width = pct.toFixed(1) + "%";

  if (progressAvgMs) {
    const THREE_MIN_MS = 3 * 60 * 1000;
    const remaining = Math.max(0, progressAvgMs - elapsed);
    el("ai-eta").textContent =
      elapsed > THREE_MIN_MS
        ? "Still working… this may take up to 5 minutes."
        : elapsed > progressAvgMs
          ? "Taking longer than usual… still working"
          : `~${formatMs(remaining)} remaining${progressSamples ? ` (based on ${progressSamples} runs)` : ""
          }`;
  } else {
    el("ai-eta").textContent = "Estimating…";
  }
  progressTimer = setTimeout(tickProgress, 200);
}
function stopProgress() {
  if (progressTimer) { clearTimeout(progressTimer); progressTimer = null; }
  el("ai-progress-bar").style.width = "100%";
  el("ai-eta").textContent = "Finalizing…";
  setTimeout(hideProgressUI, 900);
}

/* ---------------- Submit / polling (single-flight, tokenized) ---------------- */
const HOOK_URL = "https://developertesting.xyz/CollegeAdvisor";
const FETCH_URL = "https://developertesting.xyz/CollegeFetch";

let pollAbort = null;          // AbortController for current loop
let pollTimeout = null;        // hard timeout timer
let activePollToken = 0;       // increments each time we start polling
let hasFinalResult = false;    // once true, ignore anything else
let currentJobId = null;

function wait(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

function abortPolling() {
  if (pollAbort) { pollAbort.abort(); pollAbort = null; }
  if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
}

function hideProcessing() { el("ai-processing").classList.add("ai-hidden"); }
function showProcessing() {
  el("ai-results").classList.remove("ai-hidden");
  el("ai-errors").classList.add("ai-hidden");
  el("ai-schools").classList.add("ai-hidden");
  el("ai-processing").classList.remove("ai-hidden");
}

function finishRequest() {
  hideProcessing();
  submitBtn.disabled = false;
  submitBtn.textContent = 'Get My Matches';
  submitBtn.type = 'submit';
  abortPolling();      // stop loop & timers
  stopProgress();      // complete & fade progress
  currentJobId = null;
}

function renderErrors(msg) {
  if (hasFinalResult) return;   // ignore stale late errors
  hasFinalResult = true;
  el("ai-errors").innerHTML = `<strong>Error:</strong> ${msg}`;
  el("ai-results").classList.remove("ai-hidden");
  el("ai-errors").classList.remove("ai-hidden");
  el("ai-schools").classList.add("ai-hidden");
  finishRequest();
}

function drawSchools(list) {
  el("ai-schools").innerHTML = (list || []).map(s => {
    const cat = (s.category || "").toLowerCase();
    const cls = cat === 'safety' ? 'safety' : cat === 'match' ? 'match' : cat === 'reach' ? 'reach' : '';
    return `<div class="ai-card-result">
        <h3>${s.name || ""}</h3>
        <div>
          ${s.category ? `<span class="ai-pill ${cls}">${s.category}</span>` : ""}
          ${s.chance_percent != null ? `<span class="ai-pill">${s.chance_percent}% chance</span>` : ""}
          ${s.distance_from_location ? `<span class="ai-pill">${s.distance_from_location}</span>` : ""}
        </div>
        <p>${s.reasoning || ""}</p>
      </div>`;
  }).join("");
}

function renderSchools(list) {
  if (hasFinalResult) return;   // ignore any double-fires
  hasFinalResult = true;

  // Reveal refine UI
  const refine = document.getElementById("ai-refine");
  if (refine) refine.style.display = "block";

  // --- NEW: optionally merge with previous, then exclude ---
  let baseList = Array.isArray(list) ? list.slice() : [];
  if (window.__merge_with_previous_on_next_render__) {
    const prev = Array.isArray(window.__ai_raw_schools__) ? window.__ai_raw_schools__ : [];
    // union then dedupe by name
    let merged = dedupeByName([...prev, ...baseList]);

    // apply current exclusions AFTER merge
    const excludeList = csvToList("exclude_colleges");
    if (excludeList.length) {
      merged = merged.filter(item => !nameExcludes(item?.name || "", excludeList));
    }
    baseList = merged;

    // clear the one-shot flag
    window.__merge_with_previous_on_next_render__ = false;
  }

  // Keep a copy of the raw list for client-side filtering
  window.__ai_raw_schools__ = Array.isArray(baseList) ? baseList.slice() : [];

  // Initial render (unfiltered)
  drawSchools(window.__ai_raw_schools__);

  el("ai-results").classList.remove("ai-hidden");
  el("ai-errors").classList.add("ai-hidden");
  el("ai-schools").classList.remove("ai-hidden");
  finishRequest();
}

// -------- Robust extraction: handle {schools}, {success:"{...}"}, {success:{...}} --------
function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}
function extractSchoolsFromAny(data) {
  // Direct shape
  if (Array.isArray(data?.schools)) return { type: 'schools', value: data.schools };
  if (data?.invalid_fields) return { type: 'invalid', value: data.invalid_fields };

  // If server put JSON inside "success"
  const succ = data?.success;
  if (typeof succ === 'string') {
    const trimmed = succ.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const parsed = tryParseJSON(trimmed);
      if (parsed) {
        if (Array.isArray(parsed?.schools)) return { type: 'schools', value: parsed.schools };
        if (parsed?.invalid_fields) return { type: 'invalid', value: parsed.invalid_fields };
      }
    }
    // Non-JSON string in success → treat as pending (not ready)
    return { type: 'pending' };
  }
  if (succ && typeof succ === 'object') {
    if (Array.isArray(succ?.schools)) return { type: 'schools', value: succ.schools };
    if (succ?.invalid_fields) return { type: 'invalid', value: succ.invalid_fields };
    return { type: 'pending' };
  }

  // Some backends return the JSON directly (no wrapper)
  if (typeof data === 'string') {
    const parsed = tryParseJSON(data);
    if (parsed) {
      if (Array.isArray(parsed?.schools)) return { type: 'schools', value: parsed.schools };
      if (parsed?.invalid_fields) return { type: 'invalid', value: parsed.invalid_fields };
    }
  }

  // Treat explicit "invalid id" or not found as pending (until hard timeout)
  if (typeof data?.error === 'string' && /invalid id|not found/i.test(data.error)) {
    return { type: 'pending' };
  }

  // No recognized result yet
  return null;
}

async function pollLoop(jobId, token, signal, maxWaitMs, avgMs) {
  const start = performance.now();

  if (avgMs && avgMs > 0) {
    let wait_time = (avgMs / 2)
    await wait(Math.max(0, wait_time + (wait_time / 2)), signal);
  }

  while (!signal.aborted && jobId && token === activePollToken && !hasFinalResult) {
    try {
      const res = await fetch(FETCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId }),
        signal
      });
      const data = await res.json().catch(() => null);

      // Try all shapes
      const x = extractSchoolsFromAny(data);
      if (x?.type === 'schools') return renderSchools(x.value);
      if (x?.type === 'invalid') return renderErrors("Invalid fields: " + JSON.stringify(x.value));
      // else: pending/unknown → keep polling
    } catch (e) {
      if (signal.aborted || token !== activePollToken || hasFinalResult) return; // cancelled or superseded
      // transient hiccup → keep going
    }

    // Hard timeout enforcement here as a backstop
    const elapsed = performance.now() - start;
    if (elapsed >= maxWaitMs) {
      return renderErrors("Processing timed out. Please try again.");
    }
    await wait(2000, signal); // poll every 2s
  }
}

async function startPolling(jobId, avgMs, samples) {
  currentJobId = jobId;
  hasFinalResult = false;           // reset guard
  showProcessing();
  // Start progress if we have an average and haven't started already
  if (avgMs && !progressTimer) startProgress(avgMs, samples);

  // Cancel any previous polling and create a fresh token
  abortPolling();
  pollAbort = new AbortController();
  const signal = pollAbort.signal;
  const myToken = ++activePollToken;

  const MAX_WAIT_MS = 5 * 60 * 1000; // 300,000 ms
  const maxWait = MAX_WAIT_MS;

  pollTimeout = setTimeout(() => {
    abortPolling();
    renderErrors("Processing timed out. Please try again.");
  }, maxWait);

  // Still pass maxWait so downstream logic knows the ceiling
  pollLoop(jobId, myToken, signal, maxWait, avgMs);
}

// Helpers for payload
const value = id => (el(id) ? (el(id).value ?? null) : null);
const csv = id => {
  const s = value(id); if (!s) return [];
  return s.split(/[,;]| \| /g).map(t => t.trim()).filter(Boolean);
};

function buildPayload() {
  return {
    // My Stats
    gpa: value("gpa"),
    weighted_gpa: value("weighted_gpa"),
    test_score: value("test_score"),
    coursework: value("coursework"),
    class_rank: value("class_rank"),
    school_amount: value("school_amount"),

    // Academics
    intended_major: value("intended_major"),
    teaching_style: value("teaching_style"),
    teaching_style_other: value("teaching_style_other"),
    class_size: value("class_size"),
    accept_ap_ib: value("accept_ap_ib"),
    school_type: value("school_type"),
    school_type_other: value("school_type_other"),
    activities_keywords: csv("activities_keywords"),

    // Career
    career_goal: value("career_goal"),
    career_flexibility: value("career_flexibility"),
    program_features: value("program_features"),

    // Finances
    budget: value("budget"),
    efc_sai: value("efc_sai"),
    will_apply_aid: value("will_apply_aid"),
    scholarship_interest: value("scholarship_interest"),
    merit_aid_importance: value("merit_aid_importance"),

    // Strategy & timing
    curriculum_flexibility: value("curriculum_flexibility"),
    outcomes_priority: value("outcomes_priority"),
    outcomes_details: value("outcomes_details"),
    alumni_network_importance: value("alumni_network_importance"),
    start_year: value("start_year"),

    // Location
    zip_code: value("zip_code"),
    distance_from_home: value("distance_from_home"),
    campus_setting: value("campus_setting"),
    geographic_features: getGeoFeatures(),
    region_keywords: value("region_keywords"),
    climate: value("climate"),
    format: value("format"),
    school_preference: value("school_preference"),

    // Campus Life additions
    housing_preference: value("housing_preference"),
    housing_keywords: csv("housing_keywords"),

    // NEW: refine controls
    include_colleges: csvToList("include_colleges"),
    exclude_colleges: csvToList("exclude_colleges")
  };
}

const HOOK_URL_KEYS = ["id", "job_id", "request_id"];
const HOOK_RES_KEYS = ["id", "avg_chatgpt_ms", "samples", "schools", "invalid_fields", "error", "success"];

async function onSubmit(e) {
  if (submitBtn.type === 'button') { e.preventDefault(); return showStep(stepIndex + 1); }
  e.preventDefault();
  if (submitBtn.disabled) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Processing…";
  showProcessing();
  abortPolling();     // kill any prior runs
  hideProgressUI();
  hasFinalResult = false;
  currentJobId = null;

  try {
    const payload = buildPayload();
    const res = await fetch(HOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => null);

    // Direct success / validation responses
    const direct = extractSchoolsFromAny(data);
    if (direct?.type === 'schools') return renderSchools(direct.value);
    if (direct?.type === 'invalid') return renderErrors("Invalid fields: " + JSON.stringify(direct.value));

    // Start polling with predictive progress
    const id = HOOK_URL_KEYS.map(k => data?.[k]).find(Boolean);
    if (id) {
      if (data?.avg_chatgpt_ms) startProgress(data.avg_chatgpt_ms, data?.samples);
      return startPolling(id, data?.avg_chatgpt_ms, data?.samples);
    }

    if (res.ok) {
      // Unknown shape but OK → keep spinner; timeout will handle
      console.warn("Unexpected server response keys:", Object.keys(data || {}).filter(k => HOOK_RES_KEYS.includes(k)));
      showProcessing();
    } else {
      renderErrors("Server error: " + res.status);
    }
  } catch {
    renderErrors("Network error submitting form.");
  }
}

document.getElementById("btn-refine-local")?.addEventListener("click", () => {
  const includeList = csvToList("include_colleges");
  const excludeList = csvToList("exclude_colleges");
  const base = window.__ai_raw_schools__ || [];

  const filtered = base.filter(item => {
    const nm = item?.name || "";
    if (excludeList.length && nameExcludes(nm, excludeList)) return false;
    if (includeList.length && !nameMatches(nm, includeList)) return false;
    return true;
  });

  drawSchools(filtered);
});

// Re-run: same HOOK_URL, same payload, but include/exclude fields now included
document.getElementById("btn-refine-rerun")?.addEventListener("click", async () => {
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing…";
  showProcessing();
  abortPolling();
  hideProgressUI();
  hasFinalResult = false;
  currentJobId = null;

  window.__merge_with_previous_on_next_render__ = true;

  try {
    const payload = buildPayload(); // now includes include/exclude lists
    const res = await fetch(HOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);

    const direct = extractSchoolsFromAny(data);
    if (direct?.type === 'schools') return renderSchools(direct.value);
    if (direct?.type === 'invalid') return renderErrors("Invalid fields: " + JSON.stringify(direct.value));

    const id = ["id", "job_id", "request_id"].map(k => data?.[k]).find(Boolean);
    if (id) {
      if (data?.avg_chatgpt_ms) startProgress(data.avg_chatgpt_ms, data?.samples);
      return startPolling(id, data?.avg_chatgpt_ms, data?.samples);
    }

    if (res.ok) {
      // unknown shape but OK → keep spinner; timeout handles
      showProcessing();
    } else {
      renderErrors("Server error: " + res.status);
    }
  } catch {
    renderErrors("Network error submitting refine request.");
  }
});

// Make sure refine bar starts hidden on first load
(function ensureRefineHidden() {
  const refine = document.getElementById("ai-refine");
  if (refine) refine.style.display = "none";
})();

/* ---------------- Custom Select Enhancer (unchanged) ---------------- */
(function enhanceAllSelects() {
  const selects = Array.from(document.querySelectorAll('select.ai-select'));
  selects.forEach(sel => enhanceSelect(sel));

  function enhanceSelect(sel) {
    if (!sel || sel.dataset.enhanced === "1" || sel.multiple) return; // single only
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
})();

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Helpers ----------
  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

const FIELD_ID_MAP = {
  // My Stats
  gpa: "gpa",
  "weighted gpa": "weighted_gpa",
  weighted_gpa: "weighted_gpa",
  sat: "test_score",
  act: "test_score",
  "sat/act": "test_score",
  test: "test_score",
  test_score: "test_score",
  ap: "coursework",
  ib: "coursework",
  "dual enrollment": "coursework",
  coursework: "coursework",
  "class rank": "class_rank",
  rank: "class_rank",
  "school amount": "school_amount",
  amount: "school_amount",

  // Academics
  major: "intended_major",
  "intended major": "intended_major",
  "teaching style": "teaching_style",
  "class size": "class_size",
  "accept ap/ib": "accept_ap_ib",
  "school type": "school_type",
  activities: "activities_keywords",
  "activities keywords": "activities_keywords",

  // Career
  "career goal": "career_goal",
  "career flexibility": "career_flexibility",
  "program features": "program_features",

  // Finances
  budget: "budget",
  efc: "efc_sai",
  sai: "efc_sai",
  "financial aid": "will_apply_aid",
  "will apply aid": "will_apply_aid",
  "scholarship interest": "scholarship_interest",
  "merit aid": "merit_aid_importance",

  // Strategy & timing
  "curriculum flexibility": "curriculum_flexibility",
  outcomes: "outcomes_priority",
  "outcomes details": "outcomes_details",
  alumni: "alumni_network_importance",
  "alumni network": "alumni_network_importance",
  "start year": "start_year",

  // Location
  zip: "zip_code",
  "zip code": "zip_code",
  distance: "distance_from_home",
  "distance from home": "distance_from_home",
  "campus setting": "campus_setting",
  geographic: "geographic_features",
  "geographic features": "geographic_features",
  region: "region_keywords",
  climate: "climate",
  format: "format",

  // Preferences
  "school preference": "school_preference",
  "housing preference": "housing_preference",
  housing: "housing_preference",
  "housing keywords": "housing_keywords",

  // Campus life & other
  "social scene": "social_scene",
  "academic calendar": "academic_calendar",
  "study abroad": "study_abroad",

  // Refine controls
  "include colleges": "include_colleges",
  "exclude colleges": "exclude_colleges"
};


  function findFieldId(name = "") {
    const n = String(name).trim();
    if (!n) return null;
    // direct id match first
    if ($(n)) return n;

    const lc = n.toLowerCase();
    // exact synonym mapping
    for (const key in FIELD_ID_MAP) {
      if (lc === key) return FIELD_ID_MAP[key];
    }
    // fuzzy contains
    for (const key in FIELD_ID_MAP) {
      if (lc.includes(key)) return FIELD_ID_MAP[key];
    }
    // slug-style
    const slug = lc.replace(/[_-]/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    for (const key in FIELD_ID_MAP) {
      if (slug === key || slug.includes(key)) return FIELD_ID_MAP[key];
    }
    return null;
  }

  function sectionIndexForNode(node) {
    const sec = node?.closest?.("section.ai-step");
    if (!sec) return null;
    const idx = Number(sec.getAttribute("data-step"));
    return Number.isFinite(idx) ? idx : null;
  }

  function jumpToField(id) {
    const node = $(id);
    if (!node) return;
    const idx = sectionIndexForNode(node);
    if (idx != null && typeof showStep === "function") showStep(idx);
    // focus nicely
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.focus?.({ preventScroll: true }), 250);
  }

  function clearInvalidHighlights() {
    document.querySelectorAll(".ai-error, .ai-has-error").forEach(n => n.classList.remove("ai-error", "ai-has-error"));
  }

  function markInvalidFields(items) {
    clearInvalidHighlights();
    (items || []).forEach(it => {
      if (!it?.id) return;
      const node = $(it.id);
      if (!node) return;
      // handle enhanced selects
      const wrap = node.closest?.(".ai-select-wrap");
      if (wrap) wrap.classList.add("ai-has-error");
      // mark input/textarea/select
      if (node.classList) node.classList.add("ai-error");
    });
  }

  function normalizeInvalid(data) {
    const out = [];
    const push = (field, message) => out.push({
      field: String(field || "Field"),
      message: String(message || "Please correct this field."),
      id: findFieldId(field)
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

    hasFinalResult = true;
    $("ai-results").classList.remove("ai-hidden");
    $("ai-errors").classList.remove("ai-hidden");
    $("ai-schools").classList.add("ai-hidden");
    $("ai-errors").innerHTML = buildInvalidHTML(items);

    // listeners: jump to field
    $("ai-errors").addEventListener("click", (e) => {
      const tgt = e.target.closest?.("[data-go]");
      if (!tgt) return;
      const id = tgt.getAttribute("data-go");
      if (id) jumpToField(id);
    });

    finishRequest?.();
  }

  // ---------- Override renderErrors to catch "Invalid fields: ..." ----------
  const __oldRenderErrors = window.renderErrors;
  window.renderErrors = function patchedRenderErrors(msgOrObj) {
    // Case 1: direct object with invalid_fields
    if (msgOrObj && typeof msgOrObj === "object" && "invalid_fields" in msgOrObj) {
      return renderInvalidUI(msgOrObj.invalid_fields);
    }
    // Case 2: string like "Invalid fields: {...}"
    if (typeof msgOrObj === "string") {
      const m = msgOrObj.match(/^\s*Invalid\s+fields:\s*(.*)$/i);
      if (m) {
        let parsed = null;
        try { parsed = JSON.parse(m[1]); } catch { parsed = m[1]; }
        return renderInvalidUI(parsed);
      }
    }
    // Fallback to original (network/server/timeout)
    if (typeof __oldRenderErrors === "function") return __oldRenderErrors(msgOrObj);

    // Minimal fallback if original is missing
    hasFinalResult = true;
    $("ai-results").classList.remove("ai-hidden");
    $("ai-errors").classList.remove("ai-hidden");
    $("ai-schools").classList.add("ai-hidden");
    $("ai-errors").innerHTML = `
      <div class="ai-card-error">
        <div class="ai-error-head"><div class="ai-error-icon">!</div><h3 class="ai-error-title">Error</h3></div>
        <p>${escapeHtml(String(msgOrObj || "Something went wrong."))}</p>
      </div>`;
    finishRequest?.();
  };

  // Clear highlights whenever user submits again
  document.getElementById("admissions-form")?.addEventListener("submit", () => clearInvalidHighlights());
  document.getElementById("btn-refine-rerun")?.addEventListener("click", () => clearInvalidHighlights());
})();

// Init
(function init() {
  showStep(0);
  document.getElementById('admissions-form').addEventListener('submit', onSubmit);
  hideProcessing();
  el("ai-errors").classList.add("ai-hidden");
  el("ai-schools").classList.add("ai-hidden");
  el("ai-results").classList.add("ai-hidden");
})();

const SCHOOL_DETAILS_ENDPOINT = "https://developertesting.xyz/CollegeAdvisorDetails";
const SCHOOL_DETAILS_STATUS = "https://developertesting.xyz/CollegeAdvisorDetailsStatus";

// Fallback esc() if your file doesn't already define escapeHtml()
const __esc = (typeof escapeHtml === "function")
  ? escapeHtml
  : (s) => String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// -------------------- Inline dropdown behavior --------------------

// Global click delegation for cards rendered in #ai-schools
document.addEventListener("click", (e) => {
  const card = e.target.closest(".ai-card-result");
  if (!card) return;

  const container = card.closest("#ai-schools");
  if (!container) return; // only trigger for main list

  const name = card.querySelector("h3")?.textContent?.trim();
  if (!name) return;

  toggleSchoolDetail(card, name);
});

/**
 * Toggle the inline dropdown panel under a given card.
 */
function toggleSchoolDetail(card, schoolName) {
  const container = card.closest("#ai-schools") || document;

  // If this card is already open, close it
  let next = card.nextElementSibling;
  if (next && next.classList.contains("ai-school-detail-panel")) {
    next.remove();
    card.classList.remove("is-open");
    return;
  }

  // Close any other open panels in the list
  container.querySelectorAll(".ai-school-detail-panel").forEach(p => p.remove());
  container.querySelectorAll(".ai-card-result.is-open").forEach(c => c.classList.remove("is-open"));

  // Create a new panel right after this card
  const panel = document.createElement("div");
  panel.className = "ai-school-detail-panel";
  panel.style.marginTop = "0.5rem";

  card.classList.add("is-open");
  card.insertAdjacentElement("afterend", panel);

  // Load content into the panel
  openSchoolDetailInline(panel, schoolName);
}

/**
 * Load the details for a school into the inline panel.
 */
function openSchoolDetailInline(panel, schoolName) {
  if (!panel?.isConnected) return;

  panel.innerHTML = `
    <div class="ai-card">
      <h2>${__esc(schoolName)}</h2>
      <p>Fetching tailored details for you…</p>
      <div class="ai-spinner" style="width:24px;height:24px;border-radius:50%;border:3px solid #eee;border-top-color:#333;animation:spin 0.9s linear infinite;margin-top:8px;"></div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>`;

  let profile = null;
  try {
    profile = typeof buildPayload === "function" ? buildPayload() : null;
  } catch {
    profile = null;
  }

  fetch(SCHOOL_DETAILS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ school: schoolName, profile })
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(data => {
      if (!panel.isConnected) return;

      // Branch 1: cache hit -> final JSON already
      if (data && (data.title || data.summary || data.sections || data.lookingFor || data.fit || data.scholarships)) {
        return renderSchoolDetail(panel, schoolName, data);
      }

      // Branch 2: async path -> we expect { id, avg_chatgpt_ms, samples }
      if (!data || !data.id) throw new Error("Malformed response");

      startProgressPollInline(panel, schoolName, data.id, {
        avgMs: (typeof data.avg_chatgpt_ms === "number" && isFinite(data.avg_chatgpt_ms) && data.avg_chatgpt_ms > 0)
          ? data.avg_chatgpt_ms
          : 20000, // fallback ETA
        samples: Number(data.samples) || 0
      });
    })
    .catch(err => {
      if (!panel.isConnected) return;
      showErrorInline(panel, err);
    });
}

// -------------------- Progress UI + polling (inline) --------------------

function formatETA(ms) {
  ms = Math.max(0, Math.floor(ms));
  if (ms < 1000) return "under 1s remaining";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s remaining`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}m ${r}s remaining` : `${m}m remaining`;
}

function startProgressPollInline(container, schoolName, id, { avgMs, samples }) {
  if (!container?.isConnected) return;

  // Fallback so we always have a reasonable avg
  const FALLBACK_AVG = 20000; // 20s
  const baseAvgMs =
    typeof avgMs === "number" && isFinite(avgMs) && avgMs > 0 ? avgMs : FALLBACK_AVG;

  container.innerHTML = `
    <div class="ai-card">
      <h2>${__esc(schoolName)}</h2>
      <p>Generating tailored details…</p>
      <div class="ai-progress-wrap" style="margin-top:12px;background:#eee;border-radius:8px;overflow:hidden;height:10px;">
        <div class="ai-progress-bar" style="height:10px;width:0%;transition:width .2s;"></div>
      </div>
      <div class="ai-progress-meta" style="margin-top:8px;font-size:12px;color:#555;">
        <span class="eta">Estimating time…</span>
        ${samples > 5 ? `<span> • (based on ${samples} samples)</span>` : ``}
      </div>
      <div class="ai-progress-cancel" style="margin-top:10px;">
        <button class="ai-btn ai-secondary" id="ai-cancel-progress-inline">Cancel</button>
      </div>
    </div>`;

  const bar = container.querySelector(".ai-progress-bar");
  const etaEl = container.querySelector(".eta");
  const cancelBtn = container.querySelector("#ai-cancel-progress-inline");

  let cancelled = false;
  let pollDelay = 600; // ms
  const start = performance.now();

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  cancelBtn?.addEventListener("click", () => {
    cancelled = true;
    if (!container.isConnected) return;
    showCancelledInline(container);
  });

  function updateEta(elapsedMs) {
    if (!etaEl) return;

    const remaining = Math.max(baseAvgMs - elapsedMs, 0);

    // ----- NEW: “taking longer than usual” messaging -----
    if (elapsedMs > baseAvgMs * 3) {
      etaEl.textContent = "Still working… this one is taking longer than usual.";
    } else if (elapsedMs > baseAvgMs * 1.25) {
      etaEl.textContent = "Taking longer than the average… still generating details.";
    } else {
      etaEl.textContent = formatETA(remaining);
    }
  }

  function tick() {
    if (cancelled || !container.isConnected) return;

    const elapsed = performance.now() - start;

    // time-based % (cap at 95% until done)
    const pctTime = clamp((elapsed / baseAvgMs) * 100, 0, 95);
    if (bar) bar.style.width = pctTime.toFixed(1) + "%";

    // update ETA / “longer than avg” info
    updateEta(elapsed);

    // poll status
    fetch(`${SCHOOL_DETAILS_STATUS}?id=${encodeURIComponent(id)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(status => {
        if (cancelled || !container.isConnected) return;

        if (status.status === "processing") {
          // keep going; adjust backoff slightly up to 1500ms
          pollDelay = Math.min(1500, pollDelay + 100);
          setTimeout(tick, pollDelay);
        } else if (status.status === "done" && status.data) {
          // snap to 100 and render
          if (bar) bar.style.width = "100%";
          setTimeout(() => {
            if (!container.isConnected) return;
            renderSchoolDetail(container, schoolName, status.data);
          }, 300);
        } else if (status.status === "error") {
          throw new Error(status.message || "Unknown error");
        } else {
          throw new Error("Malformed status");
        }
      })
      .catch(err => {
        if (cancelled || !container.isConnected) return;
        showErrorInline(container, err);
      });
  }

  tick();
}


function showCancelledInline(container) {
  if (!container?.isConnected) return;
  container.innerHTML = `
    <div class="ai-card">
      <h3>Cancelled</h3>
      <p>You can click the school again to reload details.</p>
    </div>`;
}

function showErrorInline(container, err) {
  if (!container?.isConnected) return;
  container.innerHTML = `
    <div class="ai-card-error">
      <div class="ai-error-head">
        <div class="ai-error-icon">!</div>
        <h3 class="ai-error-title">Error</h3>
      </div>
      <p>${__esc(err?.message || String(err))}</p>
    </div>`;
}

// -------------------- Render helpers --------------------

function renderBullets(list) {
  if (!Array.isArray(list) || !list.length) return "";
  return "<ul>" + list.map(x => "<li>" + __esc(String(x)) + "</li>").join("") + "</ul>";
}

function renderScholarships(arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  const items = arr.map(s => {
    const req = Array.isArray(s.requirements) ? renderBullets(s.requirements) : "";
    const fit = s.candidate_fit ? `<p><em>Fit:</em> ${__esc(String(s.candidate_fit))}</p>` : "";
    return `
      <div class="ai-card" style="margin:12px 0;">
        <h4>${__esc(String(s.name || ""))}</h4>
        ${s.amount ? `<p><strong>Amount:</strong> ${__esc(String(s.amount))}</p>` : ""}
        ${req}
        ${fit}
      </div>`;
  }).join("");
  return "<div>" + items + "</div>";
}

function renderSchoolDetail(container, schoolName, data = {}) {
  if (!container?.isConnected) return;

  const title = data.title || schoolName;
  const summary = data.summary || data.overview || "";
  const looking = data.lookingFor || data.looking_for || [];
  const fit = data.fit || {};
  const sections = data.sections || [];
  const scholarships = data.scholarships || data.merit || [];

  container.innerHTML = `
    <div class="ai-card">
      <h2>${__esc(String(title))}</h2>
      ${summary ? `<p>${__esc(String(summary))}</p>` : ""}
      ${looking?.length ? `<h3>What this school looks for</h3>${renderBullets(looking)}` : ""}
      ${Array.isArray(fit.bullets) && fit.bullets.length ? `<h3>How you match</h3>${renderBullets(fit.bullets)}` : ""}
      ${scholarships?.length ? `<h3>Merit scholarships &amp; candidacy</h3>${renderScholarships(scholarships)}` : ""}
      ${sections.map(sec => (
        `<div class="ai-section" style="margin-top:16px;">
          ${sec.title ? `<h3>${__esc(String(sec.title))}</h3>` : ""}
          ${sec.html ? String(sec.html) : (sec.text ? `<p>${__esc(String(sec.text))}</p>` : "")}
        </div>`
      )).join("")}
    </div>`;
}
