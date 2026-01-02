/* ========================================
   MEMBERSHIP.JS - Freemium tier gating
   Integrates with Memberstack for Free/Pro plans
   ======================================== */

const MembershipController = (() => {
  // Memberstack integration
  const MAX_FREE_SCHOOLS = 3;
  const MAX_VISIBLE_SCHOOLS = 10; // For filtering display

  let userPlan = null;
  let memberEmail = null;

  // Initialize Memberstack integration
  function init() {
    // Check for Memberstack on page load
    detectMembershipTier();
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

  // Get number of visible schools for this user
  function getVisibleSchoolCount() {
    return isPro() ? MAX_VISIBLE_SCHOOLS : MAX_FREE_SCHOOLS;
  }

  // Filter schools based on membership tier
  function filterSchoolsForDisplay(schools) {
    if (!Array.isArray(schools)) return [];
    
    if (isPro()) {
      return schools; // Pro users see all schools
    }
    
    // Free users: mark schools beyond limit as blurred
    return schools.map((school, index) => ({
      ...school,
      isBlurred: index >= MAX_FREE_SCHOOLS,
      blurReason: index >= MAX_FREE_SCHOOLS ? 'free_limit' : null
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
        window.location.href = '/pricing';
      }
    });
  }

  // Render school card with blur overlay if needed
  function renderSchoolCard(school, index) {
    const isBlurred = school.isBlurred;
    const blurClass = isBlurred ? 'ai-blurred' : '';
    const cat = (school.category || "").toLowerCase();
    const cls = cat === 'safety' ? 'safety' : cat === 'match' ? 'match' : cat === 'reach' ? 'reach' : '';
    
    let cardHTML = `<div class="ai-card-result ${blurClass}" data-school-index="${index}" data-is-blurred="${isBlurred}">
      <h3>${escapeHtml(school.name || "")}</h3>
      <div>
        ${school.category ? `<span class="ai-pill ${cls}">${escapeHtml(school.category)}</span>` : ""}
        ${school.chance_percent != null ? `<span class="ai-pill">${school.chance_percent}% chance</span>` : ""}
        ${school.distance_from_location ? `<span class="ai-pill">${escapeHtml(school.distance_from_location)}</span>` : ""}
      </div>
      <p>${escapeHtml(school.reasoning || "")}</p>`;
    
    if (isBlurred) {
      cardHTML += `<div class="ai-blur-banner" style="
        margin-top: 12px;
        padding: 10px;
        background: rgba(0,0,0,0.05);
        border-radius: 4px;
        text-align: center;
        font-size: 12px;
        color: #666;
      ">🔒 Upgrade to Pro to see more schools</div>`;
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

  // Public API
  return {
    init,
    detectMembershipTier,
    isPro,
    isFree,
    getVisibleSchoolCount,
    filterSchoolsForDisplay,
    renderSchoolCard,
    canViewFullDetails,
    showDetailTeaser,
    showUpgradeModal,
    initDetailTeaser
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    MembershipController.init();
    MembershipController.initDetailTeaser();
  });
} else {
  MembershipController.init();
  MembershipController.initDetailTeaser();
}
