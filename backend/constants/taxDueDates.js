export const TAX_DUE_DATES = {
  "PPH 21": {
    payment_due_day: 10,
    report_due_day: 20,
    due_relative_to: "bulan_berikutnya",
    needs_review: false,
    notes: "-"
  },
  "PPH 25": {
    payment_due_day: 15,
    report_due_day: 20,
    due_relative_to: "bulan_berikutnya",
    needs_review: false,
    notes: "-"
  },
  "PPN": {
    payment_due_day: null,
    report_due_day: "akhir_bulan",
    due_relative_to: "bulan_berikutnya",
    needs_review: false,
    notes: "Bayar & lapor bersamaan"
  },
  "UNIFIKASI": {
    payment_due_day: 10,
    report_due_day: 20,
    due_relative_to: "bulan_berikutnya",
    needs_review: true,
    notes: "Per jenis objek pajak, sederhanakan dulu jadi satu tanggal"
  },
  "1771 BADAN": {
    payment_due_day: null,
    report_due_day: "akhir_bulan_4",
    due_relative_to: "tahun_berikutnya",
    needs_review: false,
    notes: "SPT Tahunan Badan"
  },
  "1770 OP": {
    payment_due_day: null,
    report_due_day: "akhir_bulan_3",
    due_relative_to: "tahun_berikutnya",
    needs_review: false,
    notes: "SPT Tahunan Orang Pribadi"
  },
  "PHR": {
    payment_due_day: "bervariasi",
    report_due_day: "bervariasi",
    due_relative_to: "tergantung_daerah",
    needs_review: true,
    notes: "TIDAK seragam nasional — perlu input manual per klien/daerah"
  },
  "LKPM": {
    payment_due_day: null,
    report_due_day: "per_triwulan",
    due_relative_to: null,
    needs_review: true,
    notes: "Periode triwulanan, bukan bulanan"
  },
  "BRUTO PP55": {
    payment_due_day: null,
    report_due_day: "akhir_bulan",
    due_relative_to: "bulan_berikutnya",
    needs_review: false,
    notes: "-"
  }
};
