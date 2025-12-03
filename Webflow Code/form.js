/* ========================================
   FORM.JS - Form data collection & validation
   ======================================== */

const FormController = (() => {
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

  const el = id => document.getElementById(id);
  const value = id => (el(id) ? (el(id).value ?? null) : null);
  const csv = id => {
    const s = value(id);
    if (!s) return [];
    return s.split(/[,;]| \| /g).map(t => t.trim()).filter(Boolean);
  };

  function csvToList(inputId) {
    const raw = (el(inputId)?.value || "").trim();
    if (!raw) return [];
    return raw.split(/[,;|\n]/g).map(s => s.trim()).filter(Boolean);
  }

  function getGeoFeatures() {
    const box = el('geo_features');
    const vals = Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
    const other = el('geo_features_other').value?.trim();
    if (other) vals.push(other);
    return vals;
  }

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

      // Refine controls
      include_colleges: csvToList("include_colleges"),
      exclude_colleges: csvToList("exclude_colleges")
    };
  }

  function saveDraft() {
    const payload = buildPayload();
    localStorage.setItem('ai_advisor_draft', JSON.stringify(payload));
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem('ai_advisor_draft');
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        const node = el(k);
        if (!node) continue;
        if (Array.isArray(v)) node.value = v.join(', ');
        else node.value = v ?? '';
      }
    } catch { }
  }

  function findFieldId(name = "") {
    const n = String(name).trim();
    if (!n) return null;
    if (el(n)) return n;

    const lc = n.toLowerCase();
    for (const key in FIELD_ID_MAP) {
      if (lc === key) return FIELD_ID_MAP[key];
    }
    for (const key in FIELD_ID_MAP) {
      if (lc.includes(key)) return FIELD_ID_MAP[key];
    }
    const slug = lc.replace(/[_-]/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    for (const key in FIELD_ID_MAP) {
      if (slug === key || slug.includes(key)) return FIELD_ID_MAP[key];
    }
    return null;
  }

  return { buildPayload, saveDraft, loadDraft, csvToList, findFieldId };
})();
