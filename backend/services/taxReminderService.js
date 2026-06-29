import { Op } from "sequelize";
import { TaxObligation, TaxPeriod, Client, User } from "../models/index.js";
import { TAX_DUE_DATES } from "../constants/taxDueDates.js";
import { ROLES } from "../constants/roles.js";

const INDONESIAN_MONTHS = {
  JANUARI: 0, JAN: 0,
  FEBRUARI: 1, FEB: 1,
  MARET: 2, MAR: 2,
  APRIL: 3, APR: 3,
  MEI: 4, MAY: 4,
  JUNI: 5, JUN: 5,
  JULI: 6, JUL: 6,
  AGUSTUS: 7, AGU: 7, AUG: 7,
  SEPTEMBER: 8, SEP: 8,
  OKTOBER: 9, OKT: 9, OCT: 9,
  NOVEMBER: 10, NOV: 10,
  DESEMBER: 11, DES: 11, DEC: 11
};

export const calculateDueDate = (taxType, periodStr) => {
  const config = TAX_DUE_DATES[taxType?.toUpperCase()];
  if (!config) return null;
  if (config.needs_review && (config.payment_due_day === "bervariasi" || config.report_due_day === "bervariasi" || config.report_due_day === "per_triwulan")) {
    // Cannot compute due date generically yet
    return null;
  }

  const pStr = periodStr.toUpperCase();
  const yearMatch = pStr.match(/\d{4}/);
  if (!yearMatch) return null;
  let year = parseInt(yearMatch[0], 10);

  let month = -1;
  for (const [mName, mIdx] of Object.entries(INDONESIAN_MONTHS)) {
    if (pStr.includes(mName)) {
      month = mIdx;
      break;
    }
  }

  // Handle ANNUAL
  if (config.due_relative_to === "tahun_berikutnya") {
    year += 1;
    let targetMonth = 0; // default January
    if (config.report_due_day === "akhir_bulan_3") targetMonth = 2; // March
    if (config.report_due_day === "akhir_bulan_4") targetMonth = 3; // April
    
    // Return last day of target month
    return new Date(year, targetMonth + 1, 0, 23, 59, 59);
  }

  // Handle MONTHLY
  if (month === -1) return null; // Couldn't parse month

  if (config.due_relative_to === "bulan_berikutnya") {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  let day = 1;
  if (config.report_due_day === "akhir_bulan") {
    // Last day of the computed month
    return new Date(year, month + 1, 0, 23, 59, 59);
  } else if (typeof config.report_due_day === "number") {
    day = config.report_due_day;
  } else if (typeof config.payment_due_day === "number") {
    // If report is not a number but payment is
    day = config.payment_due_day;
  }
  
  return new Date(year, month, day, 23, 59, 59);
};

export const getTaxReminders = async (currentUser, daysAhead = 7) => {
  const whereObligation = {};
  if (currentUser.role !== ROLES.ADMIN) {
    whereObligation.pic_id = currentUser.id;
  }

  const activePeriods = await TaxPeriod.findAll({
    where: {
      status: {
        [Op.notIn]: ["COMPLETED", "FILED", "PAID"]
      }
    },
    include: [
      {
        model: TaxObligation,
        where: whereObligation,
        include: [
          { model: Client, attributes: ["id", "name"] },
          { model: User, attributes: ["id", "name"] }
        ]
      }
    ]
  });

  const now = new Date();
  const upcomingThreshold = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const upcoming = [];
  const overdue = [];

  activePeriods.forEach(period => {
    const taxType = period.TaxObligation.taxType;
    const dueDate = calculateDueDate(taxType, period.period);
    
    if (!dueDate) return;

    const data = {
      id: period.id,
      obligationId: period.TaxObligation.id,
      period: period.period,
      status: period.status,
      taxType,
      clientName: period.TaxObligation.Client?.name,
      picName: period.TaxObligation.User?.name,
      dueDate: dueDate.toISOString(),
      needsReview: TAX_DUE_DATES[taxType?.toUpperCase()]?.needs_review || false
    };

    if (dueDate < now) {
      overdue.push(data);
    } else if (dueDate <= upcomingThreshold) {
      upcoming.push(data);
    }
  });

  return { upcoming, overdue };
};
