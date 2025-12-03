// Wait for main-ai-wrap to appear in the DOM
function waitForMainAIWrap(callback) {
    const checkInterval = 200; // check every 200ms
    const timeout = 8000; // stop after 8s if not found
    let waited = 0;

    const interval = setInterval(() => {
        const targetDiv = document.getElementById("main-ai-wrap");
        if (targetDiv) {
            clearInterval(interval);
            callback(targetDiv);
        } else if ((waited += checkInterval) >= timeout) {
            clearInterval(interval);
            console.warn("Timeout waiting for main-ai-wrap");
        }
    }, checkInterval);
}

// Memberstack check logic
if (window.$memberstackReady) {
    checkLoginStatus();
} else {
    document.addEventListener("memberstack.ready", checkLoginStatus);
}

function Plans_Compare(needle) {
    const haystack = ['pln_vip-wjjw0z47', 'pln_pro-hf560uas']

    console.log("✅ needle?=", needle, "haystack=", haystack);

    for (let i = 0; i < haystack.length; i++) {
        if (needle == haystack[i])
            return true;
    }
    return false;
}

function checkLoginStatus() {
    const memberstack = window.$memberstackDom;

    memberstack.getCurrentMember().then((member) => {
        const upgradePage = "/plans";
        const paidPlanPage = "/members/admission-profile";
        let isPaidMember = false;

        if (member.data) {
            console.log("✅ User is logged in:", member.data);
            const memberships = Array.isArray(member.data.planConnections)
                ? member.data.planConnections
                : [];

            console.log("✅ meberships?", memberships);

            isPaidMember = memberships.some((plan) => {
                console.log("🔍 Checking plan:", plan);

                const active = plan.status === "ACTIVE";
                const matchesPaid = Plans_Compare(plan.planId);
                console.log(`→ active: ${active}, matchesPaid: ${matchesPaid}`);

                return active && matchesPaid;
            });

            if (isPaidMember) {
                console.log("✅ User has a paid account");
                window.location.href = paidPlanPage;
                return;
            }
        }

        console.log("✖️ User is on the free plan");

        const notice = document.createElement("div");
        notice.textContent = "You are using the Free plan — click to upgrade";
        notice.style.cssText = `
      background: var(--main-card-color);
      color: #fff;
      font-size: 1rem;
      padding: 1rem 1.2rem;
      border-radius: 10px;
      text-align: center;
      margin: 1.5rem 0;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: transform 0.2s ease, background 0.2s ease;
      animation: fadeIn 0.4s ease;
    `;

        notice.addEventListener("mouseenter", () => {
            notice.style.background = "var(--accent-card-color)";
            notice.style.transform = "scale(1.02)";
        });
        notice.addEventListener("mouseleave", () => {
            notice.style.background = "var(--main-card-color)";
            notice.style.transform = "scale(1)";
        });
        notice.addEventListener("click", () => {
            window.location.href = upgradePage;
        });

        // Wait for main-ai-wrap before appending
        waitForMainAIWrap((targetDiv) => {
            targetDiv.appendChild(notice);
            console.log("✅ Notice added to main-ai-wrap");
        });
    }).catch((error) => {
        console.error("Error fetching member data:", error);
    });
}
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(-4px); }
//   to { opacity: 1; transform: translateY(0); }
// }