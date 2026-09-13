import "./adilWarpLoader.css";

type LoaderState = {
  active: boolean;
  pendingApi: number;
  shownAt: number;
  lastMutationAt: number;
  sawContentMutation: boolean;
  finishTimer: number | null;
  maxTimer: number | null;
};

const STATE: LoaderState = {
  active: false,
  pendingApi: 0,
  shownAt: 0,
  lastMutationAt: 0,
  sawContentMutation: false,
  finishTimer: null,
  maxTimer: null,
};

const MIN_VISIBLE_MS = 360;
const QUIET_AFTER_RENDER_MS = 180;
const NO_CHANGE_FALLBACK_MS = 850;
const MAX_VISIBLE_MS = 3000;
const FINISH_MS = 190;

let overlay: HTMLDivElement | null = null;

const NAV_WORDS = [
  "overview",
  "dashboard",
  "course",
  "courses",
  "my course",
  "students",
  "payments",
  "cco activations",
  "cco main buy",
  "network",
  "commissions",
  "settings",
  "customer support",
  "consultants",
  "reports",
  "q&a",
  "questions",
  "profile",
  "progress",
  "certificates",
];

const ACTION_WORDS = [
  "save",
  "submit",
  "register",
  "approve",
  "reject",
  "delete",
  "remove",
  "edit",
  "update",
  "upload",
  "add ",
  "create",
  "send",
  "pay",
  "mark paid",
  "logout",
  "close",
  "cancel",
];

function makePanel(kind: string, tag: string, title: string, sub: string, body: string) {
  return `
    <div class="aa-warp-panel aa-warp-${kind}" aria-hidden="true">
      <span class="aa-warp-tag">${tag}</span>
      <div class="aa-warp-panel-body">${body}</div>
      <span class="aa-warp-title">${title}</span>
      <span class="aa-warp-sub">${sub}</span>
    </div>`;
}

function createOverlay() {
  if (document.getElementById("aa-global-warp-loader")) {
    overlay = document.getElementById("aa-global-warp-loader") as HTMLDivElement;
    return;
  }

  const node = document.createElement("div");
  node.id = "aa-global-warp-loader";
  node.className = "aa-global-warp-loader";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-label", "Loading");

  const cryptoBody = `
    <div class="aa-chart">
      <i style="--x:8%;--h:35%;--c:#6cff7c"></i>
      <i style="--x:21%;--h:55%;--c:#ff6b6b"></i>
      <i style="--x:34%;--h:43%;--c:#6cff7c"></i>
      <i style="--x:47%;--h:69%;--c:#6cff7c"></i>
      <i style="--x:60%;--h:58%;--c:#ff6b6b"></i>
      <i style="--x:73%;--h:80%;--c:#6cff7c"></i>
      <i style="--x:86%;--h:90%;--c:#6cff7c"></i>
      <b></b>
    </div>`;

  const codeBody = `
    <div class="aa-code">
      <span><b>const</b> student = &#123;</span>
      <span>&nbsp;&nbsp;course: <em>"ICT Pro"</em>,</span>
      <span>&nbsp;&nbsp;progress: <em>72</em>,</span>
      <span>&nbsp;&nbsp;status: <em>"Active"</em></span>
      <span>&#125;</span>
    </div>`;

  const koreanBody = `
    <div class="aa-hangul">
      <i>가</i><i>나</i><i>다</i><i>라</i>
      <i>한</i><i>국</i><i>어</i><i>학</i>
    </div>`;

  const dashboardBody = `
    <div class="aa-mini-dashboard">
      <div><i class="g"></i><i></i><b></b></div>
      <div><i></i><i class="g"></i><b></b></div>
    </div>`;

  node.innerHTML = `
    <div class="aa-warp-scene">
      <div class="aa-warp-ring aa-r1"></div>
      <div class="aa-warp-ring aa-r2"></div>
      <div class="aa-warp-ring aa-r3"></div>
      <div class="aa-warp-ring aa-r4"></div>

      ${makePanel("crypto", "CRYPTO TRADING", "Market Structure", "BTC / USDT", cryptoBody)}
      ${makePanel("code", "ICT LEARNING", "Web Development", "Practical Skills", codeBody)}
      ${makePanel("korean", "EPS-TOPIK KOREAN", "Korean Language", "Vocabulary", koreanBody)}
      ${makePanel("dashboard", "STUDENT PORTAL", "Learning Dashboard", "Secure Access", dashboardBody)}

      <div class="aa-warp-logo">
        <div class="aa-warp-logo-orb"></div>
        <img src="/adil-loader-logo.png" alt="" />
      </div>

      <div class="aa-warp-loading">
        <div class="aa-warp-track"><span></span></div>
        <strong>LOADING</strong>
      </div>
    </div>`;

  document.body.appendChild(node);
  overlay = node;
}

function clearTimer(timer: number | null) {
  if (timer !== null) window.clearTimeout(timer);
}

function showLoader() {
  createOverlay();
  if (!overlay) return;

  clearTimer(STATE.finishTimer);
  clearTimer(STATE.maxTimer);

  STATE.active = true;
  STATE.pendingApi = 0;
  STATE.shownAt = performance.now();
  STATE.lastMutationAt = performance.now();
  STATE.sawContentMutation = false;

  overlay.classList.remove("is-finishing");
  // Restart CSS animation cleanly on each page/tab navigation.
  overlay.classList.remove("is-active");
  void overlay.offsetWidth;
  overlay.classList.add("is-active");

  document.documentElement.classList.add("aa-loader-active");

  STATE.maxTimer = window.setTimeout(() => {
    if (STATE.active) finishLoader();
  }, MAX_VISIBLE_MS);
}

function finishLoader() {
  if (!STATE.active || !overlay) return;
  STATE.active = false;
  clearTimer(STATE.maxTimer);
  STATE.maxTimer = null;

  overlay.classList.add("is-finishing");

  STATE.finishTimer = window.setTimeout(() => {
    if (!overlay) return;
    overlay.classList.remove("is-active", "is-finishing");
    document.documentElement.classList.remove("aa-loader-active");
  }, FINISH_MS);
}

function maybeFinish() {
  if (!STATE.active) return;

  const now = performance.now();
  const visibleFor = now - STATE.shownAt;
  const quietFor = now - STATE.lastMutationAt;

  if (visibleFor < MIN_VISIBLE_MS) return;
  if (STATE.pendingApi > 0) return;

  if (STATE.sawContentMutation && quietFor >= QUIET_AFTER_RENDER_MS) {
    finishLoader();
    return;
  }

  if (!STATE.sawContentMutation && visibleFor >= NO_CHANGE_FALLBACK_MS) {
    finishLoader();
  }
}

function isSameOriginApi(input: RequestInfo | URL) {
  try {
    let raw: string;
    if (typeof input === "string") raw = input;
    else if (input instanceof URL) raw = input.href;
    else raw = input.url;

    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function installFetchTracking() {
  const currentFetch = window.fetch.bind(window);

  window.fetch = (async (...args: Parameters<typeof window.fetch>) => {
    const track = STATE.active && isSameOriginApi(args[0]);
    if (track) STATE.pendingApi += 1;

    try {
      return await currentFetch(...args);
    } finally {
      if (track) {
        STATE.pendingApi = Math.max(0, STATE.pendingApi - 1);
        STATE.lastMutationAt = performance.now();
        window.setTimeout(maybeFinish, QUIET_AFTER_RENDER_MS + 20);
      }
    }
  }) as typeof window.fetch;
}

function isModifiedClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function cleanText(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function looksLikeAction(element: Element) {
  const text = cleanText(element);
  return ACTION_WORDS.some((word) => text.includes(word));
}

function buttonLooksLikeNavigation(element: Element) {
  if (element.matches('[role="tab"]')) return true;
  if (element.matches(".course-visual-clickable")) return true;

  const text = cleanText(element);
  if (NAV_WORDS.some((word) => text === word || text.startsWith(`${word} `))) return true;

  const container = element.closest(
    'nav, aside, [class*="sidebar"], [class*="nav-"], [class*="-nav"], [class*="menu"], [class*="tabs"], [role="navigation"]'
  );
  return Boolean(container);
}

function shouldLoadForClick(event: MouseEvent) {
  if (isModifiedClick(event)) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;

  const clickable = target.closest('a[href], button, [role="tab"], [role="button"]');
  if (!clickable) return false;

  if (
    clickable.matches("[disabled], [aria-disabled='true']") ||
    clickable.closest("[data-no-page-loader='true']")
  ) {
    return false;
  }

  if (clickable instanceof HTMLAnchorElement) {
    const rawHref = clickable.getAttribute("href") ?? "";
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
      return false;
    }
    if (clickable.target === "_blank" || clickable.hasAttribute("download")) return false;

    try {
      const url = new URL(clickable.href, window.location.href);
      if (url.origin !== window.location.origin) return false;
      return url.pathname !== window.location.pathname || url.search !== window.location.search;
    } catch {
      return false;
    }
  }

  if (looksLikeAction(clickable)) return false;
  if (clickable.closest("form") && !clickable.matches('[role="tab"]')) return false;

  return buttonLooksLikeNavigation(clickable);
}

function installNavigationTracking() {
  document.addEventListener(
    "click",
    (event) => {
      if (shouldLoadForClick(event)) showLoader();
    },
    true
  );

  window.addEventListener("popstate", showLoader);
}

function installMutationTracking() {
  const root = document.getElementById("root") ?? document.body;

  const observer = new MutationObserver((mutations) => {
    if (!STATE.active) return;

    const meaningful = mutations.some((mutation) => {
      const target = mutation.target;
      return target instanceof Node && !(overlay && overlay.contains(target));
    });

    if (!meaningful) return;

    STATE.sawContentMutation = true;
    STATE.lastMutationAt = performance.now();
    window.setTimeout(maybeFinish, QUIET_AFTER_RENDER_MS + 20);
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false,
  });
}

function init() {
  createOverlay();
  installFetchTracking();
  installNavigationTracking();
  installMutationTracking();

  window.setInterval(() => {
    if (STATE.active) maybeFinish();
  }, 90);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

export {};
