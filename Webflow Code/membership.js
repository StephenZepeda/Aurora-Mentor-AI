/* ========================================
   MEMBERSHIP.JS - Freemium tier gating
   Integrates with Memberstack for Free/Pro plans
   ======================================== */

const MembershipController = (() => {
  // Memberstack integration
  const MAX_FREE_SCHOOLS = 3; // Preview schools for free users
  const MAX_PRO_SCHOOLS = 30; // Full list for pro users
  const MAX_FREE_RERUNS = 1; // Free users get one re-run
  const FREE_BANNER_ID = 'ai-free-plan-banner';
  const BASE_STYLE_ID = 'ai-membership-base-styles';
  const RERUN_COUNT_KEY = 'ai_rerun_count';

  let userPlan = null;
  let memberEmail = null;
  let rerunCount = 0;

  // Initialize Memberstack integration
  function init() {
    ensureBaseStyles();
    // Check for Memberstack on page load
    detectMembershipTier();
    loadRerunCount();
    renderFreePlanBanner();
  }

  function ensureBaseStyles() {
    if (document.getElementById(BASE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = BASE_STYLE_ID;
    style.textContent = `
      .ai-free-banner {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: linear-gradient(120deg, #0f172a, #1d4ed8);
        color: #fff;
        border-radius: 14px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.2);
        margin-bottom: 16px;
      }

      .ai-free-banner__label {
        padding: 6px 10px;
        background: rgba(255,255,255,0.12);
        border-radius: 8px;
        font-size: 12px;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        font-weight: 800;
      }

      .ai-free-banner__text {
        font-size: 14px;
        line-height: 1.45;
      }

      .ai-banner-upgrade-btn {
        background: #fbbf24;
        color: #0f172a;
        border: none;
        padding: 10px 14px;
        border-radius: 10px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(251,191,36,0.35);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .ai-banner-upgrade-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 30px rgba(251,191,36,0.45);
      }

      .ai-banner-upgrade-btn:active {
        transform: translateY(0);
        box-shadow: 0 8px 16px rgba(251,191,36,0.35);
      }

      @media (max-width: 640px) {
        .ai-free-banner {
          grid-template-columns: 1fr;
          text-align: center;
          row-gap: 8px;
        }

        .ai-banner-upgrade-btn {
          width: 100%;
        }
      }

      .ai-upgrade-prompt-card {
        background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #a78bfa 100%);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        padding: 32px;
        margin: 24px 0;
        box-shadow: 0 10px 40px rgba(91, 33, 182, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 32px;
      }

      .ai-upgrade-prompt-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
      }

      .ai-upgrade-prompt-icon {
        font-size: 64px;
        flex-shrink: 0;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
        animation: pulse-lock 2s ease-in-out infinite;
      }

      @keyframes pulse-lock {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .ai-upgrade-prompt-content {
        flex: 1;
        text-align: left;
      }

      .ai-upgrade-prompt-card h3 {
        margin: 0 0 10px 0;
        font-size: 26px;
        font-weight: 800;
        color: #ffffff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        letter-spacing: -0.5px;
      }

      .ai-upgrade-prompt-card > p {
        margin: 0 0 16px 0;
        color: rgba(255, 255, 255, 0.95);
        font-size: 15px;
        line-height: 1.5;
      }

      .ai-upgrade-features {
        list-style: none;
        padding: 16px 20px;
        margin: 0 0 16px 0;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px 16px;
      }

      .ai-upgrade-features li {
        margin: 0;
        color: #ffffff;
        font-size: 14px;
        padding-left: 4px;
        line-height: 1.4;
        font-weight: 500;
      }

      .ai-upgrade-features li::before {
        content: '✓';
        margin-right: 10px;
        color: #a7f3d0;
        font-weight: 700;
        font-size: 16px;
      }

      .ai-upgrade-from-results {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
        color: #1e293b !important;
        border: none !important;
        padding: 12px 28px !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        border-radius: 10px !important;
        box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.2) !important;
        transition: all 0.2s ease !important;
        cursor: pointer !important;
        text-transform: none !important;
        white-space: nowrap !important;
      }

      .ai-upgrade-from-results:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 12px 32px rgba(251, 191, 36, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.3) !important;
      }

      .ai-upgrade-from-results:active {
        transform: translateY(0) !important;
      }

      @media (max-width: 768px) {
        .ai-upgrade-prompt-card {
          flex-direction: column;
          text-align: center;
          gap: 20px;
          padding: 28px 24px;
        }

        .ai-upgrade-prompt-content {
          text-align: center;
        }

        .ai-upgrade-features {
          grid-template-columns: 1fr;
        }

        .ai-upgrade-from-results {
          width: 100% !important;
        }
      }

      .ai-rerun-limit-notice {
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        padding: 12px 16px;
        margin: 12px 0;
        color: #856404;
        font-size: 14px;
      }

      .ai-rerun-limit-notice strong {
        color: #664d03;
      }
    `;

    document.head.appendChild(style);
  }

  // Detect user's membership plan from Memberstack
  function detectMembershipTier() {
    // Memberstack stores plan info in window.MemberStack
    if (typeof window.MemberStack !== 'undefined' && window.MemberStack?.getCurrentMember) {
      try {
        const member = window.MemberStack.getCurrentMember();
        if (member && member.membershipInfo) {
          const planName = member.membershipInfo.plan?.name || 'Free';
          userPlan = planName.toLowerCase();
          memberEmail = member.email || null;
          console.log('[Membership] Detected plan:', userPlan, 'Email:', memberEmail);
        }
      } catch (e) {
        console.warn('[Membership] Could not detect Memberstack:', e);
        userPlan = 'free';
      }
    } else {
      // Fallback: assume free if Memberstack not loaded
      userPlan = 'free';
    }
  }

  // Check if user has pro plan
  function isPro() {
    return userPlan === 'pro';
  }

  // Check if user is free
  function isFree() {
    return userPlan === 'free' || !userPlan;
  }

  function renderFreePlanBanner() {
    if (!isFree()) {
      document.getElementById(FREE_BANNER_ID)?.remove();
      return;
    }

    if (document.getElementById(FREE_BANNER_ID)) return;

    const host = document.getElementById('main-ai-wrap') || document.querySelector('.ai-wrap') || document.body;
    const banner = document.createElement('div');
    banner.id = FREE_BANNER_ID;
    banner.className = 'ai-free-banner';
    banner.innerHTML = `
      <div class="ai-free-banner__label">Free Plan</div>
      <div class="ai-free-banner__text">You're on the Free plan with 3 preview schools. Upgrade to Pro to unlock all matched schools and full details.</div>
      <button class="ai-banner-upgrade-btn" id="ai-banner-upgrade">Upgrade to Pro</button>
    `;

    if (host.firstChild) {
      host.insertBefore(banner, host.firstChild);
    } else {
      host.appendChild(banner);
    }

    document.getElementById('ai-banner-upgrade')?.addEventListener('click', () => {
      showUpgradeModal('all matched schools and full details');
    });
  }

  // Re-run tracking
  function loadRerunCount() {
    try {
      const stored = localStorage.getItem(RERUN_COUNT_KEY);
      rerunCount = stored ? parseInt(stored, 10) : 0;
    } catch (e) {
      rerunCount = 0;
    }
  }

  function incrementRerunCount() {
    rerunCount++;
    try {
      localStorage.setItem(RERUN_COUNT_KEY, String(rerunCount));
    } catch (e) {
      console.warn('[Membership] Could not save rerun count:', e);
    }
  }

  function canRerun() {
    if (isPro()) return true;
    return rerunCount < MAX_FREE_RERUNS;
  }

  function getRemainingReruns() {
    if (isPro()) return Infinity;
    return Math.max(0, MAX_FREE_RERUNS - rerunCount);
  }

  function resetRerunCount() {
    rerunCount = 0;
    try {
      localStorage.removeItem(RERUN_COUNT_KEY);
    } catch (e) {
      console.warn('[Membership] Could not reset rerun count:', e);
    }
  }

  // Get number of visible schools for this user
  function getVisibleSchoolCount() {
    return isPro() ? MAX_PRO_SCHOOLS : MAX_FREE_SCHOOLS;
  }

  // Filter schools based on membership tier
  function filterSchoolsForDisplay(schools) {
    if (!Array.isArray(schools)) return [];
    
    if (isPro()) {
      return schools; // Pro users see all schools with full details
    }
    
    // Free users: only show preview (3-5 schools)
    return schools.slice(0, MAX_FREE_SCHOOLS).map((school) => ({
      ...school,
      isPreview: true,
      hiddenDetails: true // Hide reach/target/safety, acceptance %, financial fit
    }));
  }

  // Show upgrade prompt modal
  function showUpgradeModal(feature = 'detailed school information') {
    const modal = document.createElement('div');
    modal.className = 'ai-upgrade-modal';
    modal.innerHTML = `
      <div class="ai-upgrade-overlay" id="ai-upgrade-overlay"></div>
      <div class="ai-upgrade-dialog">
        <button class="ai-upgrade-close" id="ai-upgrade-close">&times;</button>
        <h2>Unlock Full Features</h2>
        <p>Upgrade to <strong>Pro</strong> to access ${feature}.</p>
        <div class="ai-upgrade-benefits">
          <ul>
            <li>✓ See all matched schools</li>
            <li>✓ Full school details & profiles</li>
            <li>✓ AI-powered essay developer</li>
            <li>✓ Application strategy coaching</li>
          </ul>
        </div>
        <button class="ai-btn ai-primary" id="ai-upgrade-btn">Upgrade to Pro</button>
        <button class="ai-btn ai-secondary" id="ai-upgrade-dismiss">Continue as Free User</button>
      </div>
    `;

    // Add styles
    if (!document.getElementById('ai-membership-styles')) {
      const style = document.createElement('style');
      style.id = 'ai-membership-styles';
      style.textContent = `
        .ai-upgrade-modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
        }
        
        .ai-upgrade-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
        }
        
        .ai-upgrade-dialog {
          position: relative;
          z-index: 10001;
          background: white;
          border-radius: 12px;
          padding: 32px;
          max-width: 420px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: slideUp 0.3s ease-out;
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .ai-upgrade-dialog h2 {
          margin: 0 0 12px 0;
          font-size: 22px;
          color: #1a1a1a;
        }
        
        .ai-upgrade-dialog > p {
          margin: 0 0 20px 0;
          color: #666;
          font-size: 15px;
        }
        
        .ai-upgrade-benefits {
          margin: 20px 0;
          padding: 16px;
          background: #f8f8f8;
          border-radius: 8px;
        }
        
        .ai-upgrade-benefits ul {
          margin: 0;
          padding-left: 20px;
          list-style: none;
        }
        
        .ai-upgrade-benefits li {
          margin: 8px 0;
          color: #333;
          font-size: 14px;
        }
        
        .ai-upgrade-benefits li:before {
          content: '';
          margin-right: 8px;
        }
        
        .ai-upgrade-dialog .ai-btn {
          display: block;
          width: 100%;
          padding: 12px;
          margin: 10px 0;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }
        
        .ai-upgrade-dialog .ai-btn.ai-primary {
          background: #0066cc;
          color: white;
        }
        
        .ai-upgrade-dialog .ai-btn.ai-primary:hover {
          background: #0052a3;
        }
        
        .ai-upgrade-dialog .ai-btn.ai-secondary {
          background: transparent;
          border: 1px solid #ddd;
          color: #333;
        }
        
        .ai-upgrade-dialog .ai-btn.ai-secondary:hover {
          background: #f5f5f5;
        }
        
        .ai-upgrade-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #999;
          padding: 0;
          width: 32px;
          height: 32px;
        }
        
        .ai-upgrade-close:hover {
          color: #333;
        }
        
        /* Blurred school card styling */
        .ai-card-result.ai-blurred {
          position: relative;
          opacity: 0.6;
        }
        
        .ai-card-result.ai-blurred::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(255,255,255,0.3);
          backdrop-filter: blur(3px);
          border-radius: 8px;
          pointer-events: none;
        }
        
        .ai-school-detail-teaser {
          position: relative;
          text-align: center;
          padding: 32px 24px;
          background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
          border-radius: 8px;
          margin: 12px 0;
        }
        
        .ai-school-detail-teaser h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          color: #1a1a1a;
        }
        
        .ai-school-detail-teaser p {
          margin: 0 0 16px 0;
          color: #666;
          font-size: 14px;
        }
        
        .ai-school-detail-teaser .ai-btn {
          padding: 10px 20px;
          font-size: 14px;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    // Event handlers
    document.getElementById('ai-upgrade-close')?.addEventListener('click', () => modal.remove());
    document.getElementById('ai-upgrade-overlay')?.addEventListener('click', () => modal.remove());
    document.getElementById('ai-upgrade-dismiss')?.addEventListener('click', () => modal.remove());
    
    // Upgrade button - redirect to pricing/checkout
    document.getElementById('ai-upgrade-btn')?.addEventListener('click', () => {
      if (typeof window.MemberStack !== 'undefined' && window.MemberStack?.openCheckout) {
        window.MemberStack.openCheckout({ plan: 'pro' });
      } else {
        // Fallback URL if Memberstack not available
        window.location.href = '/plans';
      }
    });
  }

  // Generate upgrade prompt card for remaining schools
  function generateUpgradePromptCard(remainingCount) {
    return `
      <div class="ai-upgrade-prompt-card">
        <div class="ai-upgrade-prompt-icon">🔒</div>
        <div class="ai-upgrade-prompt-content">
          <h3>Unlock 7+ More Schools</h3>
          <p>You're seeing 3 preview schools. Upgrade to Pro to see your full personalized list.</p>
          <ul class="ai-upgrade-features">
            <li>Full school list (15-30 matches)</li>
            <li>Reach / Target / Safety labels</li>
            <li>Acceptance likelihood for each school</li>
            <li>Financial fit analysis & net cost</li>
            <li>Detailed match reasoning</li>
            <li>Application strategy recommendations</li>
            <li>School comparison tools</li>
            <li>Unlimited re-runs with different inputs</li>
          </ul>
          <button class="ai-btn ai-primary ai-upgrade-from-results">Upgrade to Pro</button>
        </div>
      </div>
    `;
  }

  // Render school card with gating for free users
  function renderSchoolCard(school, index) {
    const isBlurred = school.isBlurred;
    const isPreview = school.isPreview;
    const hiddenDetails = school.hiddenDetails;
    const blurClass = isBlurred ? 'ai-blurred' : '';
    const cat = (school.category || "").toLowerCase();
    const cls = cat === 'safety' ? 'safety' : cat === 'match' ? 'match' : cat === 'reach' ? 'reach' : '';
    
    let cardHTML = `<div class="ai-card-result ${blurClass}" data-school-index="${index}" data-is-blurred="${isBlurred}" data-is-fake="${school.isFake ? 'true' : 'false'}" data-is-preview="${isPreview ? 'true' : 'false'}">
      <div class="ai-card-content">
        <h3>${escapeHtml(school.name || "")}</h3>
        <div>`;
    
    // Free users: hide reach/target/safety and acceptance %
    if (hiddenDetails && !isPro()) {
      cardHTML += `${school.distance_from_location ? `<span class="ai-pill">${escapeHtml(school.distance_from_location)}</span>` : ""}`;
    } else {
      cardHTML += `
          ${school.category ? `<span class="ai-pill ${cls}">${escapeHtml(school.category)}</span>` : ""}
          ${school.chance_percent != null ? `<span class="ai-pill">${school.chance_percent}% chance</span>` : ""}
          ${school.distance_from_location ? `<span class="ai-pill">${escapeHtml(school.distance_from_location)}</span>` : ""}`;
    }
    
    cardHTML += `
        </div>
        <p>${escapeHtml(school.reasoning || "")}</p>
      </div>`;
    
    if (isBlurred) {
      cardHTML += `<div class="ai-paywall-overlay">
        <div class="ai-paywall-lock">🔒</div>
        <div class="ai-paywall-text">Upgrade to Pro</div>
      </div>`;
    }
    
    cardHTML += `</div>`;
    return cardHTML;
  }

  // Escape HTML
  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, c => ({ 
      "&": "&amp;", "<": "&lt;", ">": "&gt;", 
      '"': "&quot;", "'": "&#39;" 
    }[c]));
  }

  // Check if detail view should be gated
  function canViewFullDetails() {
    return isPro();
  }

  // Show detail teaser for free users
  function showDetailTeaser(schoolName) {
    return `
      <div class="ai-school-detail-teaser">
        <h3>Want full details for ${escapeHtml(schoolName)}?</h3>
        <p>Upgrade to Pro to see AI-generated school profiles, essay tips, and personalized fit analysis.</p>
        <button class="ai-btn ai-primary" id="ai-teaser-upgrade">Unlock Full Details</button>
      </div>
    `;
  }

  // Initialize detail teaser event
  function initDetailTeaser() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'ai-teaser-upgrade') {
        showUpgradeModal('detailed school information');
      }
    });
  }

  // Handle paywall overlay clicks
  function initPaywallClicks() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.ai-paywall-overlay')) {
        window.location.href = '/plans';
      }
    });
  }

  // Public API
  return {
    init,
    detectMembershipTier,
    isPro,
    isFree,
    getVisibleSchoolCount,
    filterSchoolsForDisplay,
    renderSchoolCard,
    generateUpgradePromptCard,
    canViewFullDetails,
    showDetailTeaser,
    showUpgradeModal,
    renderFreePlanBanner,
    initDetailTeaser,
    initPaywallClicks,
    // Re-run tracking
    canRerun,
    incrementRerunCount,
    getRemainingReruns,
    resetRerunCount
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    MembershipController.init();
    MembershipController.initDetailTeaser();
    MembershipController.initPaywallClicks();
  });
} else {
  MembershipController.init();
  MembershipController.initDetailTeaser();
  MembershipController.initPaywallClicks();
}
