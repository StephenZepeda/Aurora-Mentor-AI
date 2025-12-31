/* ========================================
   DETAILS.JS - School detail panels
   ======================================== */

const DetailsController = (() => {
  const SCHOOL_DETAILS_ENDPOINT = "https://aurora.developertesting.xyz/CollegeAdvisorDetails";
  const SCHOOL_DETAILS_STATUS = "https://aurora.developertesting.xyz/CollegeAdvisorDetailsStatus";

  const __esc = (s) => String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  function init() {
    document.addEventListener("click", (e) => {
      const card = e.target.closest(".ai-card-result");
      if (!card) return;

      const container = card.closest("#ai-schools");
      if (!container) return;

      const name = card.querySelector("h3")?.textContent?.trim();
      if (!name) return;

      toggleSchoolDetail(card, name);
    });
  }

  function toggleSchoolDetail(card, schoolName) {
    const container = card.closest("#ai-schools") || document;

    let next = card.nextElementSibling;
    if (next && next.classList.contains("ai-school-detail-panel")) {
      next.remove();
      card.classList.remove("is-open");
      return;
    }

    container.querySelectorAll(".ai-school-detail-panel").forEach(p => p.remove());
    container.querySelectorAll(".ai-card-result.is-open").forEach(c => c.classList.remove("is-open"));

    const panel = document.createElement("div");
    panel.className = "ai-school-detail-panel";
    panel.style.marginTop = "0.5rem";

    card.classList.add("is-open");
    card.insertAdjacentElement("afterend", panel);

    openSchoolDetailInline(panel, schoolName);
  }

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
      profile = typeof FormController !== 'undefined' ? FormController.buildPayload() : null;
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

        if (data && (data.title || data.summary || data.sections || data.lookingFor || data.fit || data.scholarships)) {
          return renderSchoolDetail(panel, schoolName, data);
        }

        if (!data || !data.id) throw new Error("Malformed response");

        startProgressPollInline(panel, schoolName, data.id, {
          avgMs: (typeof data.avg_chatgpt_ms === "number" && isFinite(data.avg_chatgpt_ms) && data.avg_chatgpt_ms > 0)
            ? data.avg_chatgpt_ms
            : 20000,
          samples: Number(data.samples) || 0
        });
      })
      .catch(err => {
        if (!panel.isConnected) return;
        showErrorInline(panel, err);
      });
  }

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

    const FALLBACK_AVG = 20000;
    const baseAvgMs = typeof avgMs === "number" && isFinite(avgMs) && avgMs > 0 ? avgMs : FALLBACK_AVG;

    container.innerHTML = `
      <div class="ai-card">
        <h2>${__esc(schoolName)}</h2>
        <p>Generating tailored details…</p>
        <div class="ai-progress-wrap" style="margin-top:12px;background:#eee;border-radius:8px;overflow:hidden;height:10px;">
          <div class="ai-progress-bar" style="height:10px;width:0%;transition:width .2s;"></div>
        </div>
        <div class="ai-progress-meta">
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
    let pollDelay = 600;
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
      const pctTime = clamp((elapsed / baseAvgMs) * 100, 0, 95);
      if (bar) bar.style.width = pctTime.toFixed(1) + "%";

      updateEta(elapsed);

      fetch(`${SCHOOL_DETAILS_STATUS}?id=${encodeURIComponent(id)}`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(status => {
          if (cancelled || !container.isConnected) return;

          if (status.status === "processing") {
            pollDelay = Math.min(1500, pollDelay + 100);
            setTimeout(tick, pollDelay);
          } else if (status.status === "done" && status.data) {
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

  return { init };
})();
