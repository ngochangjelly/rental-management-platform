// "Report not closed" marker for property grid cards (Financial Reports,
// Bulk Property Reports): a yellow warning badge on the card, a count badge
// for the header, and the hover tooltip that explains the badge and links to
// that property's financial report for the month in a new tab.

export const UNCLOSED_REPORT_COLOR = '#ffc107';

const BADGE_SELECTOR = '[data-unclosed-report]';
// Long enough to move the pointer from the badge across the gap into the tip.
const HIDE_DELAY_MS = 250;
const VIEWPORT_MARGIN = 8;
const BADGE_GAP = 8;

const escAttr = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Deep link the router resolves: #/financial/<property-slug>/<year>/<month>.
// Returns '' when the property has no unit/address to build a slug from.
export function financialReportUrl(property, year, month) {
  const slug = window.SlugUtils?.propertySlug(property || {});
  if (!slug || !year || !month) return '';
  return `${location.origin}${location.pathname}${location.search}#/financial/${slug}/${Number(year)}/${Number(month)}`;
}

// Badge for one property card. Hovering (or tapping) it opens the tooltip.
export function renderUnclosedReportBadge({ property, year, month, monthLabel }, extraStyle = '') {
  installTooltipListeners();
  const label =
    [property?.unit, property?.address].filter(Boolean).join(', ') ||
    property?.propertyId ||
    '';
  return `<span class="badge text-dark" data-unclosed-report data-report-url="${escAttr(financialReportUrl(property, year, month))}" data-month-label="${escAttr(monthLabel)}" data-property-label="${escAttr(label)}" role="button" aria-label="Report for ${escAttr(monthLabel)} not closed yet" style="background-color:${UNCLOSED_REPORT_COLOR};font-size:8px;box-shadow:0 1px 3px rgba(0,0,0,0.45);cursor:help;${extraStyle}"><i class="bi bi-exclamation-triangle-fill"></i></span>`;
}

export function renderUnclosedCountBadge(count, monthLabel, extraStyle = '') {
  if (!count) return '';
  return `<span class="badge text-dark" style="background-color:${UNCLOSED_REPORT_COLOR};font-size:0.7rem;${extraStyle}" title="${count} ${count === 1 ? 'report' : 'reports'} for ${escAttr(monthLabel)} not closed yet"><i class="bi bi-exclamation-triangle-fill me-1"></i>Not closed: ${count}</span>`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
// One shared element appended to <body> (the cards clip their overflow), shown
// next to whichever badge is hovered. It stays open while the pointer is on
// the badge or the tooltip, so the button inside it is reachable.

let tip = null;
let hideTimer = null;
let listenersInstalled = false;

function buildTip() {
  tip = document.createElement('div');
  tip.className = 'unclosed-report-tip';
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = `
    <div class="unclosed-report-tip-title"><i class="bi bi-exclamation-triangle-fill"></i><span data-role="title"></span></div>
    <div class="unclosed-report-tip-text" data-role="text"></div>
    <a class="btn btn-warning btn-sm unclosed-report-tip-btn" data-role="link" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right me-1"></i>Open report</a>
    <div class="unclosed-report-tip-arrow" data-role="arrow"></div>`;
  document.body.appendChild(tip);
}

const isTipVisible = () => !!tip && tip.classList.contains('show');

function cancelHide() {
  clearTimeout(hideTimer);
  hideTimer = null;
}

function hideTip() {
  cancelHide();
  if (tip) tip.classList.remove('show');
}

function scheduleHide() {
  if (hideTimer || !isTipVisible()) return;
  hideTimer = setTimeout(hideTip, HIDE_DELAY_MS);
}

function showTip(badge) {
  cancelHide();
  if (!tip) buildTip();

  const { reportUrl, monthLabel, propertyLabel } = badge.dataset;
  tip.querySelector('[data-role="title"]').textContent = propertyLabel || '';
  tip.querySelector('[data-role="text"]').textContent =
    `This property's financial report for ${monthLabel} is not closed yet.`;
  const link = tip.querySelector('[data-role="link"]');
  link.style.display = reportUrl ? '' : 'none';
  if (reportUrl) link.href = reportUrl;
  else link.removeAttribute('href');

  tip.classList.add('show');

  // Above the badge when there is room, otherwise below; kept on screen.
  const rect = badge.getBoundingClientRect();
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const above = rect.top - height - BADGE_GAP >= VIEWPORT_MARGIN;
  const centerX = rect.left + rect.width / 2;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(centerX - width / 2, window.innerWidth - width - VIEWPORT_MARGIN),
  );
  tip.style.left = `${left}px`;
  tip.style.top = `${above ? rect.top - height - BADGE_GAP : rect.bottom + BADGE_GAP}px`;
  tip.dataset.placement = above ? 'top' : 'bottom';
  tip.querySelector('[data-role="arrow"]').style.left =
    `${Math.max(12, Math.min(centerX - left, width - 12))}px`;
}

// Delegated on document, so badges keep working however often a grid
// re-renders its cards.
function installTooltipListeners() {
  if (listenersInstalled || typeof document === 'undefined') return;
  listenersInstalled = true;

  document.addEventListener('mouseover', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const badge = target.closest(BADGE_SELECTOR);
    if (badge) {
      showTip(badge);
    } else if (isTipVisible()) {
      if (tip.contains(target)) cancelHide();
      else scheduleHide();
    }
  });

  // Capture phase: a click on the badge must not reach the card underneath
  // (which would select/deselect the property). On touch screens the tap is
  // what opens the tooltip.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const badge = target.closest(BADGE_SELECTOR);
      if (badge) {
        event.stopPropagation();
        event.preventDefault();
        showTip(badge);
      } else if (isTipVisible()) {
        // Let the "Open report" link do its thing, then close.
        if (tip.contains(target)) {
          if (target.closest('a')) setTimeout(hideTip, 0);
        } else {
          hideTip();
        }
      }
    },
    true,
  );

  // The tooltip is position:fixed, so it would drift off its badge.
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTip();
  });
  document.documentElement.addEventListener('mouseleave', scheduleHide);
}
