/** Tanggal jalan berikutnya untuk sebuah jadwal (atau null bila sudah berakhir). */
export function nextRun(r, now = new Date()) {
  const start = new Date(`${r.start_date}T00:00:00`);
  const last = r.last_run ? new Date(`${r.last_run}T00:00:00`) : null;
  let y = now.getFullYear(), m = now.getMonth();
  for (let i = 0; i < 24; i++) {
    const dim = new Date(y, m + 1, 0).getDate();
    const due = new Date(y, m, Math.min(r.day_of_month, dim));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (due >= start && (!last || due > last) && due >= today) {
      if (r.end_date && due > new Date(`${r.end_date}T00:00:00`)) return null;
      return due;
    }
    m++; if (m > 11) { m = 0; y++; }
  }
  return null;
}
