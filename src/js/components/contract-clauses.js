/**
 * Shared contract clause content and formatting utilities.
 *
 * Single source of truth for all contract clause wording used by both
 * the authenticated ContractManagementComponent and the public /create-contract page.
 * To change any clause text, edit only this file — both flows update automatically.
 */

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
  const labels = {
    COMMON1: "Common 1",
    COMMON2: "Common 2",
    MASTER: "Master",
    COMPARTMENT1: "Compartment 1",
    COMPARTMENT2: "Compartment 2",
    STORE: "Store",
    COMMON_1_PAX: "Common 1 Pax",
    COMMON_2_PAX: "Common 2 Pax",
    COMMON_3_PAX: "Common 3 Pax",
    SMALL_SINGLE_1_PAX: "Small Single 1 Pax",
    SMALL_SINGLE_2_PAX: "Small Single 2 Pax",
    BIG_SINGLE_1_PAX: "Big Single 1 Pax",
    BIG_SINGLE_2_PAX: "Big Single 2 Pax",
    SINGLE_1_PAX_NO_AIRCON: "Single 1 Pax No Aircon",
    SINGLE_2_PAX_NO_AIRCON: "Single 2 Pax No Aircon",
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
    `For a 6-month agreement, SGD$${cd.forfeitAcCleanFee ? "0" : "100"} will be deducted from the deposit for air-conditioner servicing. For a 1-year agreement, SGD$${cd.forfeitAcCleanFee ? "0" : "200"} will be deducted. This applies only to rooms with an air-conditioner.${cd.airconFreeOfCharge ? " (As a special arrangement, Tenant A has kindly waived this deduction for Tenant B. Tenant B is free of charge for this term.)" : ""}${cd.forfeitAcCleanFee ? " (AC cleaning fee forfeited: $0 deduction applies for this term.)" : ""}`,
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
    `${cleaningLetter}) Cleaning fee: SGD$${cd.forfeitAcCleanFee ? "0" : cd.cleaningFee || "20"} / 1pax`,
  );

  return clauses;
}
