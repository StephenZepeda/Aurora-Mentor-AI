/* ========================================
   API.JS - Backend communication & polling
   ======================================== */

const APIController = (() => {
  const HOOK_URL = "https://aurora.developertesting.xyz/CollegeAdvisor";
  const FETCH_URL = "https://aurora.developertesting.xyz/CollegeFetch";

  let pollAbort = null;
  let pollTimeout = null;
  let activePollToken = 0;
  let hasFinalResult = false;
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

  function tryParseJSON(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function extractSchoolsFromAny(data) {
    if (Array.isArray(data?.schools)) return { type: 'schools', value: data.schools };
    if (data?.invalid_fields) return { type: 'invalid', value: data.invalid_fields };

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
      return { type: 'pending' };
    }
    if (succ && typeof succ === 'object') {
      if (Array.isArray(succ?.schools)) return { type: 'schools', value: succ.schools };
      if (succ?.invalid_fields) return { type: 'invalid', value: succ.invalid_fields };
      return { type: 'pending' };
    }

    if (typeof data === 'string') {
      const parsed = tryParseJSON(data);
      if (parsed) {
        if (Array.isArray(parsed?.schools)) return { type: 'schools', value: parsed.schools };
        if (parsed?.invalid_fields) return { type: 'invalid', value: parsed.invalid_fields };
      }
    }

    if (typeof data?.error === 'string' && /invalid id|not found/i.test(data.error)) {
      return { type: 'pending' };
    }

    return null;
  }

  async function pollLoop(jobId, token, signal, maxWaitMs, avgMs, onSchools, onError) {
    const start = performance.now();

    if (avgMs && avgMs > 0) {
      await wait(Math.max(0, avgMs), signal);
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

        const x = extractSchoolsFromAny(data);
        if (x?.type === 'schools') return onSchools(x.value);
        if (x?.type === 'invalid') return onError("Invalid fields: " + JSON.stringify(x.value));
      } catch (e) {
        if (signal.aborted || token !== activePollToken || hasFinalResult) return;
      }

      const elapsed = performance.now() - start;
      if (elapsed >= maxWaitMs) {
        return onError("Processing timed out. Please try again.");
      }
      await wait(2000, signal);
    }
  }

  async function startPolling(jobId, avgMs, samples, onSchools, onError, onProgress) {
    currentJobId = jobId;
    hasFinalResult = false;

    if (onProgress && avgMs) onProgress(avgMs, samples);

    abortPolling();
    pollAbort = new AbortController();
    const signal = pollAbort.signal;
    const myToken = ++activePollToken;

    const MAX_WAIT_MS = 6 * 60 * 1000;
    
    pollLoop(jobId, myToken, signal, MAX_WAIT_MS, avgMs, onSchools, onError);
  }

  async function submitForm(payload, onSchools, onError, onProgress) {
    abortPolling();
    hasFinalResult = false;
    currentJobId = null;

    try {
      const res = await fetch(HOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);

      const direct = extractSchoolsFromAny(data);
      if (direct?.type === 'schools') return onSchools(direct.value);
      if (direct?.type === 'invalid') return onError("Invalid fields: " + JSON.stringify(direct.value));

      const id = ["id", "job_id", "request_id"].map(k => data?.[k]).find(Boolean);
      if (id) {
        return startPolling(id, data?.avg_chatgpt_ms, data?.samples, onSchools, onError, onProgress);
      }

      if (res.ok) {
        console.warn("Unexpected server response");
      } else {
        onError("Server error: " + res.status);
      }
    } catch {
      onError("Network error submitting form.");
    }
  }

  function resetState() {
    hasFinalResult = false;
    currentJobId = null;
    abortPolling();
  }

  function markComplete() {
    hasFinalResult = true;
  }

  return { submitForm, resetState, markComplete, abortPolling };
})();
