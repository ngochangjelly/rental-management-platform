/**
 * Shared contract clause content and formatting utilities.
 *
 * Single source of truth for all contract clause wording used by both
 * the authenticated ContractManagementComponent and the public /create-contract page.
 * To change any clause text, edit only this file — both flows update automatically.
 */

import { getRoomTypeDisplayName, parseRoomType } from '../utils/room-type-mapper.js';

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatDate(dateString) {
  if (!dateString) return "[Date]";
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${day}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
  } catch {
    return dateString;
  }
}

export function formatDateForFilename(dateString) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}${monthNames[date.getMonth()]}${year}`;
  } catch {
    return "";
  }
}

export function formatPaymentMethod(method) {
  return { CASH: "Cash", BANK_TRANSFER: "Bank Transfer", CHECK: "Check" }[method] || method || "Cash";
}

export function formatRoomType(roomType) {
  if (!roomType) return "[Room Type]";
  const standardized = getRoomTypeDisplayName(roomType);
  if (standardized !== roomType) return standardized;

  // Legacy/unrelated unit types not covered by the standardized room families.
  const labels = {
    MEDIUM_SINGLE_1_PAX: "Medium Single Room (1 Pax)",
    LARGE_SINGLE_1_PAX: "Large Single Room (1 Pax)",
    SMALL_SHARED_2_PAX: "Small Shared Room (2 Pax)",
    MEDIUM_SHARED_2_PAX: "Medium Shared Room (2 Pax)",
    LARGE_SHARED_2_PAX: "Large Shared Room (2 Pax)",
    MASTER_BEDROOM: "Master Bedroom",
    COMMON_ROOM: "Common Room",
    STUDIO: "Studio",
    ONE_BEDROOM: "1 Bedroom",
    TWO_BEDROOM: "2 Bedroom",
    THREE_BEDROOM: "3 Bedroom",
  };
  return labels[roomType] || roomType;
}

export function numberToWords(num) {
  const ones = ["","one","two","three","four","five","six","seven","eight","nine","ten",
    "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

  if (num === 0) return "zero";
  if (num < 0) return "minus " + numberToWords(-num);
  if (num < 20) return ones[num];
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
  }
  if (num < 1000) {
    const remainder = num % 100;
    let result = ones[Math.floor(num / 100)] + " hundred";
    if (remainder !== 0) result += " " + numberToWords(remainder);
    return result;
  }
  const remainder = num % 1000;
  let result = numberToWords(Math.floor(num / 1000)) + " thousand";
  if (remainder !== 0) result += " " + numberToWords(remainder);
  return result;
}

export function formatMonthsText(months) {
  if (!months || months == 0) return "0 (ZERO) month";
  const num = parseFloat(months);
  if (num === 0.5) return "0.5 (HALF) month";
  if (num === 1) return "1 (ONE) month";
  if (num === 1.5) return "1.5 (ONE AND A HALF) months";
  if (num === 2) return "2 (TWO) months";
  if (num === 2.5) return "2.5 (TWO AND A HALF) months";
  if (num === 3) return "3 (THREE) months";
  const word = numberToWords(Math.floor(num)).toUpperCase();
  return num % 1 === 0.5 ? `${num} (${word} AND A HALF) months` : `${num} (${word}) months`;
}

export function hasAircon(roomType) {
  return !(roomType || "").includes("NO_AIRCON");
}

export function calculateLeasePeriod(moveInDate, moveOutDate) {
  if (!moveInDate || !moveOutDate) return null;
  try {
    const start = new Date(moveInDate);
    const end = new Date(moveOutDate);
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months--;
    const monthsEnd = new Date(start);
    monthsEnd.setMonth(monthsEnd.getMonth() + months);
    const remainingDays = Math.floor((end - monthsEnd) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(remainingDays / 7);
    const days = remainingDays % 7;
    const parts = [];
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? "s" : ""}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : "0 days";
  } catch {
    return null;
  }
}

export function formatLeasePeriod(contractData) {
  const cd = contractData || {};
  if (cd.leasePeriod && cd.leasePeriod.trim()) return cd.leasePeriod;
  return calculateLeasePeriod(cd.moveInDate, cd.moveOutDate) || "[Lease Period]";
}

export function formatTenancyPeriod(contractData) {
  const cd = contractData || {};
  const i = cd.moveInDate;
  const o = cd.moveOutDate;
  if (!i && !o) return "[Tenancy Period]";
  if (!i) return `[Move-in Date] - ${formatDate(o)}`;
  if (!o) return `${formatDate(i)} - [Move-out Date]`;
  return `${formatDate(i)} - ${formatDate(o)}`;
}

export function calculateTotalRental(contractData) {
  const cd = contractData || {};
  const monthly = parseFloat(cd.monthlyRental) || 0;
  const lp = (cd.leasePeriod || "").toLowerCase();
  let months = 0;
  if (lp.includes("month")) {
    const m = lp.match(/(\d+)\s*months?/);
    if (m) months = parseInt(m[1]);
  } else if (lp.includes("year")) {
    const m = lp.match(/(\d+)\s*years?/);
    if (m) months = parseInt(m[1]) * 12;
  }
  return monthly * months;
}

// ─── Section 1 clause content ─────────────────────────────────────────────────

/**
 * Returns the base clause text array for Section 1 of the contract.
 * These are the texts that appear AFTER the deposit/advance clauses (a/b).
 * Dynamic clauses use contractData fields to produce the correct wording.
 */
export function getSection1BaseClauseTexts(contractData) {
  const cd = contractData || {};
  const clauses = [
    "To use and manage the room, premises, and furniture therein in a careful manner and to keep the interior of the premises in a GOOD, CLEAN, TIDY, and TENANTABLE condition except for normal fair wear and tear.",
    "Not to do or permit to be done upon the premises or room anything which may be unlawful, immoral, or become a nuisance or annoyance to occupiers of adjoining or adjacent room(s).",
    "To use the premises for the purpose of private residence only and not to assign, sublet, or otherwise part possession of the premises or any part thereof without the written consent of Tenant A.",
    "To peaceably and quietly at the expiration of the tenancy deliver up to Tenant A the room in like condition as the same was delivered to Tenant B at the commencement of this Agreement, except for fair wear and tear.",
    "Not to create a nuisance, not to use the premises or any part thereof in a manner which may become a nuisance or annoyance to TenantA or the occupants of the premises, building or to neighbouring parties.",
    "Strictly NO PETS in the premises.",
    "No illegal or immoral activities, not to do or suffer to be done anything in or upon the said premises or any part thereof, any activities of an illegal or immoral nature.",
    "To permit Tenant A to carry out due diligence checks to ensure that at all times during the currency of this Agreement, Tenant B and/or permitted occupants are not illegal immigrants and comply with all the rules and regulations relating to the Immigration Act and the Employment of Foreign Workers Act.",
    "To provide TenantA, upon request, for physical inspection, all immigration and employment documents, including but not limited to the passports of all non-local occupants, the employment pass and/or work permits, proof of employment.",
    "To permit the Main tenant and workmen with all necessary appliances to enter upon the said premises at all reasonable times by prior appointment for the purpose whether of viewing the condition thereof or of doing such works and things as may be required for any repairs, alterations or improvements whether of the said premises or of any parts of any building to which the said premises may form a part of or adjoin.",
    "The Main tenant shall not enter the premises or remove, relocate, or dispose of Tenant B's belongings without prior written consent from Tenant B, except in cases of emergency or as otherwise permitted by law.",
    "Not to bring or store or permit to be brought or stored in the premises or any part thereof any goods which are of a dangerous, obnoxious, inflammable or hazardous nature.",
    "At the expiration of the term hereby created, to deliver up the room peacefully and quietly in like condition as the same was delivered to Tenant B at the commencement of the term hereby created. As the room is delivered in clean condition, Tenant B is expected to clear all personal belongings from the room and the premises, and clean the room and their designated area to the same condition as delivered. Failing to do so will result in a minimum deduction of SGD$150 from the security deposit for cleaning expenses.",
    `For a 6-month agreement, SGD$${cd.acDeduction6Month || 100} will be deducted from the deposit for air-conditioner servicing. For a 1-year agreement, SGD$${cd.acDeduction1Year || 200} will be deducted. This applies only to rooms with an air-conditioner.${cd.airconFreeOfCharge ? " (As a special arrangement, Tenant A has kindly waived this deduction for Tenant B. Tenant B is free of charge for this term.)" : ""}`,
    "Costs of damage to common area facilities provided by Tenant A will be shared by both parties. For the first SGD$200 of any single bill, the cost will be divided among all subtenants of the unit. Any amount exceeding SGD$200 will be borne by Tenant A. This applies only to leases of 6 months and above.",
    "No smoking or vaping in the premises (first violation will result in a warning; subsequent violations will lead to contract termination). Vaping is illegal in Singapore and carries criminal penalties including potential imprisonment.",
    "Visitors can be allowed to stay overnight upon permission request from Tenant B to Tenant A.",
    "No gathering (with/without alcoholic consumption) without permission from Tenant A.",
    "Strictly keep silent after 10:00 pm (the tenant will receive a warning for the first two times; the third time violation will lead to the contract's termination).",
    "Tenant B shall provide written notice to Tenant A at least thirty (30) days before the expiration of the lease term, indicating whether Tenant B intends to renew the tenancy or vacate the premises upon the lease's conclusion.",
    "Strictly NO DRUGS or drug-related activities in the premises. Drug possession, consumption, or trafficking is illegal in Singapore and carries severe penalties including imprisonment, caning, and even death penalty for serious drug offenses. Any violation will result in immediate termination of this Agreement and forfeiture of all deposits.",
    "No electricity reconnection, rewiring, or electrical modifications without prior written consent from Tenant A. Unauthorized electrical work can cause fires, leading to significant property damage and personal injury. Any unauthorized electrical modifications will result in immediate termination of this Agreement and Tenant B will be liable for all damages.",
    "Early Termination And Notice Period: Should Tenant B wish to terminate this Agreement prior to the expiration of the lease term, Tenant B shall give to Tenant A not less than thirty (30) calendar days' prior written notice of such intention to quit and surrender the premises. Upon compliance with this notice requirement and subject to Tenant B fulfilling all obligations under this Agreement including but not limited to payment of all outstanding rent, utilities, and restoration of the premises to its original condition (fair wear and tear excepted), the security deposit shall be refunded in full within seven (7) days of the termination date. However, should Tenant B fail to provide the requisite thirty (30) days' written notice, or terminate this Agreement without such notice, Tenant B shall forfeit the entire security deposit as liquidated damages for breach of this covenant, and such forfeiture shall be in addition to any other remedies available to Tenant A at law or in equity.",
    "The landlord has agreed for the main tenant to share the house with friends/authorized occupants.",
  ];

  if (cd.pestControlClause) {
    clauses.push(
      "PEST INFESTATION LIABILITY: The Tenant B acknowledges that the premises have been inspected and are delivered free from any pest infestation including but not limited to bedbugs, cockroaches, ants, and other vermin. The Tenant B shall ensure proper hygiene and cleanliness of all personal belongings, bedding, and furniture before moving into the premises. In the event that any pest infestation is discovered within the premises during the tenancy period, the Tenant B shall be liable for pest control treatment costs and replacement of any damaged furniture, fixtures, or belongings up to a maximum amount of SGD$1,000.00. The Tenant B agrees to immediately notify Tenant A upon discovery of any signs of pest infestation and shall cooperate fully in any pest control measures undertaken.",
    );
  }

  return clauses;
}

// ─── Section 2 clause content ─────────────────────────────────────────────────

/**
 * Returns the full Section 2 clause text array, with letters already applied.
 */
export function buildSection2Clauses(contractData) {
  const cd = contractData || {};
  const clauses = [];

  if (cd.fullPaymentReceived) {
    clauses.push(
      "If any covenants, conditions or stipulations on Tenant B's part herein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained.",
    );
  } else {
    clauses.push(
      "If the rent hereby reserved or any part thereof shall be unpaid for 7 (SEVEN) days after becoming payable (whether formally demanded in writing or not) OR if any covenants, conditions or stipulations on Tenant B's part therein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained. Tenant A shall terminate the agreement and forfeit the deposit forthwith.",
    );
  }

  const elecBudget = cd.electricityBudget || "400";
  clauses.push(
    "Notwithstanding herein contained, Tenant A shall be under no liability to Tenant B for accidents happening, injuries sustained, or loss of life and damage to the property, goods, or chattels in the premises or in any part.",
    cd.electricityFree
      ? "a) ELECTRICITY: The electricity (SP bills) for the whole unit is totally subsidized by Tenant A. Tenant B shall not be liable for any electricity charges."
      : `a) ELECTRICITY: A monthly budget of S$${elecBudget} (SINGAPORE DOLLARS ${numberToWords(parseInt(elecBudget)).toUpperCase()} ONLY) is set for the SP bills for the whole unit. Under circumstances where the total utility bill exceeds the limit cap, the outstanding due will be divided proportionally between all tenants of the unit. Tenant A reserved the right to claim from Tenant B. ONLY APPLY FOR A ROOM WITH AN AIR CONDITIONER.`,
    "b) Tenant B must produce an original/photocopy of documents such as NRIC/Passport/Work Permit/Employment Pass/Student Pass to prove his/her identity and legitimate stay in Singapore.",
    "c) Security deposit will be refunded within 7 (SEVEN) days at the end of the lease after deducting any outstanding fees, with no interest.",
  );

  if (!cd.fullPaymentReceived) {
    clauses.push(
      "d) Tenant B will be asked to leave the apartment within 1 (ONE) to 7 (SEVEN) days at the discretion of Tenant A for breach of agreement, and/or any terms and conditions stated in this Agreement if the rental is not paid by the first day of each calendar month.",
    );
  }

  const lawLetter = cd.fullPaymentReceived ? "d" : "e";
  const cleaningLetter = cd.fullPaymentReceived ? "e" : "f";
  clauses.push(
    `${lawLetter}) The law applicable in any action arising out of this lease shall be the law of the Republic of Singapore, and the parties hereto submit themselves to the jurisdiction of the laws of Singapore.`,
  );
  clauses.push(
    `${cleaningLetter}) Cleaning fee: SGD$${cd.cleaningFee || ""} / 1pax (covers cleaning of the common area, kitchen, common toilet, and master bedroom toilet).`,
  );

  return clauses;
}

/**
 * Locate the index of the air-conditioner servicing clause within the array
 * returned by getSection1BaseClauseTexts / getSection1BaseClauseTextsVi (the
 * two arrays are built in lockstep, clause-for-clause). Callers use this to
 * skip the clause consistently in either language without string-matching
 * the (untranslated or translated) clause text directly.
 */
export function getAirconClauseIndexInSection1(contractData) {
  const texts = getSection1BaseClauseTexts(contractData);
  return texts.findIndex((t) => t.includes("air-conditioner servicing"));
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Vietnamese translation layer ──────────────────────────────────────────
//
// Professional Vietnamese renderings of the same clauses above, written for
// a Vietnamese-speaking tenant to understand the real legal meaning of the
// English contract (not a literal machine translation). Kept in lockstep,
// clause-for-clause, with the English arrays so getAirconClauseIndexInSection1
// applies to both. Edit the English clauses above AND their Vietnamese
// counterpart below together — they are not auto-derived from each other.
// ═══════════════════════════════════════════════════════════════════════════

export function formatDateVi(dateString) {
  if (!dateString) return "[Ngày]";
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
  } catch {
    return dateString;
  }
}

export function formatPaymentMethodVi(method) {
  return { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản ngân hàng", CHECK: "Séc" }[method] || method || "Tiền mặt";
}

const ROOM_FAMILY_LABELS_VI = {
  COMMON: "Phòng chung",
  BIG_SINGLE: "Phòng đơn lớn",
  SMALL_SINGLE: "Phòng đơn nhỏ",
  STORE: "Phòng kho",
};

const ROOM_TYPE_LABELS_VI = {
  MEDIUM_SINGLE_1_PAX: "Phòng đơn vừa (1 người)",
  LARGE_SINGLE_1_PAX: "Phòng đơn lớn (1 người)",
  SMALL_SHARED_2_PAX: "Phòng ghép nhỏ (2 người)",
  MEDIUM_SHARED_2_PAX: "Phòng ghép vừa (2 người)",
  LARGE_SHARED_2_PAX: "Phòng ghép lớn (2 người)",
  MASTER_BEDROOM: "Phòng chủ (Master Bedroom)",
  COMMON_ROOM: "Phòng chung (Common Room)",
  STUDIO: "Căn hộ Studio",
  ONE_BEDROOM: "Căn hộ 1 phòng ngủ",
  TWO_BEDROOM: "Căn hộ 2 phòng ngủ",
  THREE_BEDROOM: "Căn hộ 3 phòng ngủ",
};

export function formatRoomTypeVi(roomType) {
  if (!roomType) return "[Loại phòng]";
  const { family, number } = parseRoomType(roomType);
  if (family === "MASTER") return "Phòng chủ (Master)";
  if (family && ROOM_FAMILY_LABELS_VI[family]) return `${ROOM_FAMILY_LABELS_VI[family]} ${number}`;
  return ROOM_TYPE_LABELS_VI[roomType] || roomType;
}

/**
 * Vietnamese number-to-words, following standard reading rules (linh/lẻ,
 * mươi/mốt/lăm/tư substitutions). Good for the amounts that appear in this
 * contract (hundreds/thousands, e.g. electricity budgets).
 */
export function numberToWordsVi(num) {
  const ones = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const scales = ["", "nghìn", "triệu", "tỷ"];

  if (num === 0) return "không";
  if (num < 0) return "âm " + numberToWordsVi(-num);

  const readThreeDigits = (n, hasHigherPart) => {
    const hundred = Math.floor(n / 100);
    const rem = n % 100;
    const tens = Math.floor(rem / 10);
    const unit = rem % 10;
    const parts = [];

    if (hundred > 0) {
      parts.push(ones[hundred] + " trăm");
    } else if (hasHigherPart && rem > 0) {
      parts.push("không trăm");
    }

    if (rem > 0) {
      if (tens === 0) {
        parts.push((hundred > 0 || hasHigherPart ? "linh " : "") + (unit === 5 && (hundred > 0 || hasHigherPart) ? "năm" : ones[unit]));
      } else if (tens === 1) {
        parts.push("mười" + (unit === 0 ? "" : unit === 1 ? " một" : unit === 5 ? " lăm" : " " + ones[unit]));
      } else {
        parts.push(
          ones[tens] +
            " mươi" +
            (unit === 0 ? "" : unit === 1 ? " mốt" : unit === 4 ? " tư" : unit === 5 ? " lăm" : " " + ones[unit]),
        );
      }
    }

    return parts.join(" ");
  };

  const groups = [];
  let n = Math.floor(num);
  while (n > 0) {
    groups.unshift(n % 1000);
    n = Math.floor(n / 1000);
  }

  const words = [];
  groups.forEach((g, i) => {
    if (g === 0) return;
    const scaleIdx = groups.length - 1 - i;
    words.push(readThreeDigits(g, i > 0) + (scales[scaleIdx] ? " " + scales[scaleIdx] : ""));
  });

  return words.join(" ").trim();
}

export function formatMonthsTextVi(months) {
  if (!months || months == 0) return "0 (KHÔNG) tháng";
  const num = parseFloat(months);
  const numStr = String(num).replace(".", ",");
  if (num === 0.5) return "0,5 (NỬA) tháng";
  if (num % 1 === 0.5) {
    const word = numberToWordsVi(Math.floor(num)).toUpperCase();
    return `${numStr} (${word} RƯỠI) tháng`;
  }
  const word = numberToWordsVi(num).toUpperCase();
  return `${numStr} (${word}) tháng`;
}

// English "month/week/day" unit words -> Vietnamese, used to translate the
// auto-computed lease-period string (e.g. "6 months, 2 weeks") without
// re-deriving it from scratch.
function translateDurationUnitsToVi(text) {
  if (!text) return text;
  return String(text)
    .replace(/\byears?\b/gi, "năm")
    .replace(/\bmonths?\b/gi, "tháng")
    .replace(/\bweeks?\b/gi, "tuần")
    .replace(/\bdays?\b/gi, "ngày");
}

export function calculateLeasePeriodVi(moveInDate, moveOutDate) {
  if (!moveInDate || !moveOutDate) return null;
  const calculated = calculateLeasePeriod(moveInDate, moveOutDate);
  return calculated ? translateDurationUnitsToVi(calculated) : null;
}

export function formatLeasePeriodVi(contractData) {
  const cd = contractData || {};
  if (cd.leasePeriod && cd.leasePeriod.trim()) return translateDurationUnitsToVi(cd.leasePeriod);
  return calculateLeasePeriodVi(cd.moveInDate, cd.moveOutDate) || "[Thời hạn thuê]";
}

export function formatTenancyPeriodVi(contractData) {
  const cd = contractData || {};
  const i = cd.moveInDate;
  const o = cd.moveOutDate;
  if (!i && !o) return "[Thời gian thuê]";
  if (!i) return `[Ngày dọn vào] - ${formatDateVi(o)}`;
  if (!o) return `${formatDateVi(i)} - [Ngày dọn ra]`;
  return `${formatDateVi(i)} - ${formatDateVi(o)}`;
}

// ─── Section 1 clause content (Vietnamese) ─────────────────────────────────

/**
 * Vietnamese counterpart of getSection1BaseClauseTexts. Must stay in the
 * exact same order (and push the pest-control clause under the exact same
 * condition) as the English version so clause lettering and
 * getAirconClauseIndexInSection1 line up between the two languages.
 */
export function getSection1BaseClauseTextsVi(contractData) {
  const cd = contractData || {};
  const clauses = [
    "Sử dụng và quản lý phòng, căn hộ cùng toàn bộ nội thất bên trong một cách cẩn thận, đồng thời giữ gìn nội thất căn hộ luôn trong tình trạng TỐT, SẠCH SẼ, GỌN GÀNG và CÓ THỂ CHO THUÊ ĐƯỢC, ngoại trừ hao mòn tự nhiên thông thường.",
    "Không được thực hiện hoặc cho phép thực hiện trong căn hộ hoặc phòng bất kỳ hành vi nào trái pháp luật, trái đạo đức, hoặc gây phiền toái, làm ảnh hưởng đến những người đang cư trú tại (các) phòng liền kề hoặc lân cận.",
    "Chỉ sử dụng căn hộ cho mục đích để ở riêng tư; không được chuyển nhượng, cho thuê lại, hoặc chuyển giao quyền chiếm hữu căn hộ hay bất kỳ phần nào của căn hộ dưới bất kỳ hình thức nào khi chưa có sự đồng ý bằng văn bản của Bên A.",
    "Khi hết thời hạn thuê, bàn giao lại phòng cho Bên A một cách ôn hòa, trong tình trạng tương tự như tình trạng phòng đã được bàn giao cho Bên B vào thời điểm bắt đầu Hợp đồng này, ngoại trừ hao mòn tự nhiên thông thường.",
    "Không được gây phiền toái; không được sử dụng căn hộ hoặc bất kỳ phần nào của căn hộ theo cách có thể gây phiền toái hoặc ảnh hưởng đến Bên A, những người cư trú khác trong căn hộ, tòa nhà, hoặc các hộ lân cận.",
    "TUYỆT ĐỐI KHÔNG NUÔI THÚ CƯNG trong căn hộ.",
    "Không được thực hiện các hoạt động trái pháp luật hoặc trái đạo đức; không được thực hiện hoặc để xảy ra trong căn hộ nêu trên hay bất kỳ phần nào của căn hộ bất kỳ hoạt động nào có tính chất trái pháp luật hoặc trái đạo đức.",
    "Cho phép Bên A tiến hành các biện pháp kiểm tra cần thiết nhằm bảo đảm rằng trong suốt thời hạn của Hợp đồng này, Bên B và/hoặc những người cư trú được phép không phải là người nhập cư trái phép, và tuân thủ đầy đủ các quy định pháp luật liên quan đến Luật Xuất Nhập Cảnh (Immigration Act) và Luật Sử Dụng Lao Động Nước Ngoài (Employment of Foreign Workers Act).",
    "Xuất trình cho Bên A, khi có yêu cầu, để kiểm tra trực tiếp toàn bộ giấy tờ liên quan đến xuất nhập cảnh và việc làm, bao gồm nhưng không giới hạn ở hộ chiếu của tất cả người cư trú không phải công dân/thường trú nhân Singapore, thẻ Employment Pass và/hoặc Work Permit, cùng các giấy tờ chứng minh việc làm.",
    "Cho phép Bên A (người thuê chính) và thợ sửa chữa, cùng các trang thiết bị cần thiết, được ra vào căn hộ nêu trên vào những thời điểm hợp lý sau khi đã hẹn trước, nhằm mục đích kiểm tra tình trạng căn hộ hoặc thực hiện các công việc sửa chữa, cải tạo, nâng cấp cần thiết đối với căn hộ hoặc bất kỳ phần nào của tòa nhà mà căn hộ thuộc về hoặc liền kề.",
    "Bên A (người thuê chính) không được tự ý vào phòng hoặc di dời, chuyển chỗ, tiêu hủy tài sản của Bên B khi chưa có sự đồng ý trước bằng văn bản của Bên B, trừ trường hợp khẩn cấp hoặc được pháp luật cho phép.",
    "Không được mang vào, cất giữ, hoặc cho phép mang vào, cất giữ trong căn hộ hay bất kỳ phần nào của căn hộ bất kỳ hàng hóa nào có tính chất nguy hiểm, độc hại, dễ cháy nổ hoặc gây nguy hại.",
    "Khi hết thời hạn thuê được thiết lập theo Hợp đồng này, bàn giao lại phòng một cách ôn hòa, trong tình trạng tương tự như tình trạng phòng đã được bàn giao cho Bên B vào thời điểm bắt đầu thời hạn thuê. Do phòng được bàn giao trong tình trạng sạch sẽ, Bên B có trách nhiệm dọn dẹp toàn bộ đồ đạc cá nhân ra khỏi phòng và căn hộ, đồng thời vệ sinh phòng và khu vực được chỉ định về tình trạng tương tự như khi được bàn giao. Nếu không thực hiện, Bên B sẽ bị trừ tối thiểu SGD$150 từ tiền đặt cọc để trang trải chi phí dọn vệ sinh.",
    `Đối với hợp đồng thuê 6 tháng, SGD$${cd.acDeduction6Month || 100} sẽ được trừ từ tiền đặt cọc để bảo trì máy lạnh (điều hòa). Đối với hợp đồng thuê 1 năm, SGD$${cd.acDeduction1Year || 200} sẽ được trừ. Điều khoản này chỉ áp dụng đối với phòng có trang bị máy lạnh.${cd.airconFreeOfCharge ? " (Theo thỏa thuận đặc biệt, Bên A đồng ý miễn khoản phí này cho Bên B. Bên B được miễn phí khoản này trong thời hạn thuê.)" : ""}`,
    "Chi phí sửa chữa thiệt hại đối với các tiện ích khu vực chung do Bên A cung cấp sẽ được cả hai bên cùng chia sẻ. Đối với mỗi hóa đơn, SGD$200 đầu tiên sẽ được chia đều cho tất cả những người thuê phòng trong căn hộ. Phần chi phí vượt quá SGD$200 sẽ do Bên A chịu trách nhiệm. Điều khoản này chỉ áp dụng cho hợp đồng thuê từ 6 tháng trở lên.",
    "Không được hút thuốc lá hoặc hút thuốc lá điện tử (vaping) trong căn hộ (vi phạm lần đầu sẽ bị cảnh cáo; các lần vi phạm tiếp theo sẽ dẫn đến việc chấm dứt Hợp đồng). Hút thuốc lá điện tử là hành vi bất hợp pháp tại Singapore và có thể bị xử lý hình sự, bao gồm cả hình phạt tù.",
    "Khách có thể được phép ở qua đêm nếu Bên B xin phép và được Bên A đồng ý trước.",
    "Không được tổ chức tụ họp (có hoặc không sử dụng đồ uống có cồn) khi chưa được sự cho phép của Bên A.",
    "Tuyệt đối giữ yên tĩnh sau 22:00 (người thuê sẽ bị nhắc nhở/cảnh cáo trong hai lần vi phạm đầu tiên; vi phạm lần thứ ba sẽ dẫn đến việc chấm dứt Hợp đồng).",
    "Bên B phải thông báo bằng văn bản cho Bên A ít nhất ba mươi (30) ngày trước khi hết thời hạn thuê, nêu rõ Bên B có ý định gia hạn hợp đồng thuê hay sẽ trả phòng khi hợp đồng kết thúc.",
    "TUYỆT ĐỐI KHÔNG SỬ DỤNG MA TÚY hoặc thực hiện bất kỳ hoạt động nào liên quan đến ma túy trong căn hộ. Việc tàng trữ, sử dụng hoặc buôn bán ma túy là hành vi bất hợp pháp tại Singapore và có thể bị xử phạt nghiêm khắc, bao gồm phạt tù, hình phạt roi (caning), và thậm chí tử hình đối với các tội phạm ma túy nghiêm trọng. Bất kỳ vi phạm nào sẽ dẫn đến việc chấm dứt Hợp đồng ngay lập tức và Bên B sẽ mất toàn bộ tiền đặt cọc.",
    "Không được tự ý đấu nối lại điện, đi lại dây điện, hoặc thực hiện bất kỳ thay đổi nào về hệ thống điện khi chưa có sự đồng ý trước bằng văn bản của Bên A. Việc tự ý can thiệp vào hệ thống điện có thể gây cháy nổ, dẫn đến thiệt hại nghiêm trọng về tài sản và tính mạng. Bất kỳ hành vi tự ý thay đổi hệ thống điện nào sẽ dẫn đến việc chấm dứt Hợp đồng ngay lập tức và Bên B phải chịu trách nhiệm bồi thường toàn bộ thiệt hại.",
    "Chấm Dứt Hợp Đồng Trước Hạn Và Thời Gian Báo Trước: Trường hợp Bên B muốn chấm dứt Hợp đồng này trước khi hết thời hạn thuê, Bên B phải thông báo bằng văn bản cho Bên A trước ít nhất ba mươi (30) ngày về ý định chấm dứt hợp đồng và trả lại căn hộ. Sau khi hoàn tất nghĩa vụ báo trước này, và với điều kiện Bên B đã thực hiện đầy đủ mọi nghĩa vụ theo Hợp đồng — bao gồm nhưng không giới hạn ở việc thanh toán toàn bộ tiền thuê, tiện ích còn nợ, và khôi phục căn hộ về tình trạng ban đầu (ngoại trừ hao mòn tự nhiên thông thường) — tiền đặt cọc sẽ được hoàn trả đầy đủ trong vòng bảy (7) ngày kể từ ngày chấm dứt hợp đồng. Tuy nhiên, nếu Bên B không thông báo trước ba mươi (30) ngày theo quy định, hoặc chấm dứt Hợp đồng mà không có thông báo như vậy, Bên B sẽ mất toàn bộ tiền đặt cọc như một khoản bồi thường thiệt hại ấn định (liquidated damages) cho việc vi phạm điều khoản này, và việc mất tiền đặt cọc này không loại trừ các biện pháp khắc phục khác mà Bên A có quyền áp dụng theo pháp luật hoặc theo lẽ công bằng.",
    "Chủ nhà (landlord) đã đồng ý cho người thuê chính (Bên A) chia sẻ căn hộ với bạn bè/những người cư trú được ủy quyền.",
  ];

  if (cd.pestControlClause) {
    clauses.push(
      "TRÁCH NHIỆM VỀ CÔN TRÙNG GÂY HẠI: Bên B xác nhận rằng căn hộ đã được kiểm tra và bàn giao trong tình trạng không có côn trùng gây hại, bao gồm nhưng không giới hạn ở rệp giường (bedbugs), gián, kiến và các loại côn trùng khác. Bên B có trách nhiệm đảm bảo vệ sinh sạch sẽ đối với toàn bộ đồ đạc cá nhân, chăn ga gối đệm và nội thất trước khi dọn vào căn hộ. Trong trường hợp phát hiện côn trùng gây hại trong căn hộ trong thời gian thuê, Bên B sẽ chịu trách nhiệm về chi phí xử lý côn trùng và thay thế bất kỳ nội thất, thiết bị hoặc đồ đạc bị hư hại, với mức tối đa là SGD$1.000,00. Bên B đồng ý thông báo ngay cho Bên A khi phát hiện bất kỳ dấu hiệu nào của côn trùng gây hại và sẽ hợp tác đầy đủ trong các biện pháp xử lý côn trùng được thực hiện.",
    );
  }

  return clauses;
}

// ─── Section 2 clause content (Vietnamese) ─────────────────────────────────

/**
 * Vietnamese counterpart of buildSection2Clauses. Letter placement mirrors
 * the English version exactly (same conditional a/b/c/d/e lettering).
 */
export function buildSection2ClausesVi(contractData) {
  const cd = contractData || {};
  const clauses = [];

  if (cd.fullPaymentReceived) {
    clauses.push(
      "Nếu bất kỳ cam kết, điều kiện hoặc điều khoản nào quy định đối với Bên B trong Hợp đồng này không được thực hiện, hoặc nếu tại bất kỳ thời điểm nào Bên B rơi vào tình trạng phá sản, thì trong bất kỳ trường hợp nào nêu trên, Bên A có quyền hợp pháp, vào bất kỳ thời điểm nào sau đó, tái chiếm hữu phòng và di dời toàn bộ tài sản của Bên B ra khỏi căn hộ mà không phải chịu trách nhiệm về bất kỳ tổn thất hoặc thiệt hại nào phát sinh từ việc di dời đó. Theo đó, Hợp đồng này sẽ chấm dứt hoàn toàn, nhưng không ảnh hưởng đến quyền khởi kiện của Bên A đối với bất kỳ vi phạm nào của Bên B đối với các cam kết nêu trong Hợp đồng này.",
    );
  } else {
    clauses.push(
      "Nếu tiền thuê nhà theo Hợp đồng này hoặc bất kỳ phần nào của khoản tiền đó không được thanh toán trong vòng 7 (BẢY) ngày kể từ ngày đến hạn (dù đã được yêu cầu chính thức bằng văn bản hay chưa), HOẶC nếu bất kỳ cam kết, điều kiện hoặc điều khoản nào quy định đối với Bên B không được thực hiện, hoặc nếu tại bất kỳ thời điểm nào Bên B rơi vào tình trạng phá sản, thì trong bất kỳ trường hợp nào nêu trên, Bên A có quyền hợp pháp, vào bất kỳ thời điểm nào sau đó, tái chiếm hữu phòng và di dời toàn bộ tài sản của Bên B ra khỏi căn hộ mà không phải chịu trách nhiệm về bất kỳ tổn thất hoặc thiệt hại nào phát sinh từ việc di dời đó. Theo đó, Hợp đồng này sẽ chấm dứt hoàn toàn, nhưng không ảnh hưởng đến quyền khởi kiện của Bên A đối với bất kỳ vi phạm nào của Bên B đối với các cam kết nêu trong Hợp đồng này. Bên A sẽ chấm dứt Hợp đồng ngay lập tức và tịch thu tiền đặt cọc.",
    );
  }

  const elecBudget = cd.electricityBudget || "400";
  clauses.push(
    "Bất kể các nội dung khác trong Hợp đồng này, Bên A sẽ không chịu bất kỳ trách nhiệm nào đối với Bên B về các tai nạn xảy ra, thương tích, thiệt hại về tính mạng hoặc thiệt hại đối với tài sản, đồ đạc trong căn hộ hay bất kỳ phần nào của căn hộ.",
    cd.electricityFree
      ? "a) TIỀN ĐIỆN: Toàn bộ chi phí tiền điện (hóa đơn SP) cho căn hộ được Bên A bao trọn. Bên B không phải chịu bất kỳ khoản phí tiền điện nào."
      : `a) TIỀN ĐIỆN: Hạn mức tiền điện (hóa đơn SP) hàng tháng cho toàn bộ căn hộ được ấn định là S$${elecBudget} (${numberToWordsVi(parseInt(elecBudget)).toUpperCase()} ĐÔ LA SINGAPORE). Trong trường hợp tổng hóa đơn tiện ích vượt quá hạn mức này, phần chênh lệch sẽ được chia theo tỷ lệ cho tất cả người thuê trong căn hộ. Bên A có quyền yêu cầu Bên B thanh toán phần chênh lệch này. Điều khoản này chỉ áp dụng đối với phòng có trang bị máy lạnh.`,
    "b) Bên B phải xuất trình bản gốc/bản sao các giấy tờ như NRIC/Hộ chiếu/Work Permit/Employment Pass/Student Pass để chứng minh danh tính và tình trạng cư trú hợp pháp tại Singapore.",
    "c) Tiền đặt cọc sẽ được hoàn trả trong vòng 7 (BẢY) ngày kể từ khi kết thúc hợp đồng thuê, sau khi đã khấu trừ các khoản phí còn nợ (nếu có), và không tính lãi.",
  );

  if (!cd.fullPaymentReceived) {
    clauses.push(
      "d) Nếu tiền thuê không được thanh toán vào ngày 1 hàng tháng, Bên B sẽ được yêu cầu rời khỏi căn hộ trong vòng 1 (MỘT) đến 7 (BẢY) ngày theo quyết định của Bên A, do vi phạm hợp đồng và/hoặc các điều khoản, điều kiện quy định trong Hợp đồng này.",
    );
  }

  const lawLetter = cd.fullPaymentReceived ? "d" : "e";
  const cleaningLetter = cd.fullPaymentReceived ? "e" : "f";
  clauses.push(
    `${lawLetter}) Pháp luật áp dụng cho bất kỳ tranh chấp nào phát sinh từ hợp đồng thuê này là pháp luật của Cộng hòa Singapore, và các bên đồng ý chịu sự điều chỉnh của pháp luật Singapore.`,
  );
  clauses.push(
    `${cleaningLetter}) Phí vệ sinh: SGD$${cd.cleaningFee || ""} / 1 người (bao gồm vệ sinh khu vực chung, nhà bếp, nhà vệ sinh chung và nhà vệ sinh phòng master).`,
  );

  return clauses;
}
