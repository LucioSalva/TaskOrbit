const countBusinessDays = (startDate, endDate) => {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

const calculateEstimatedMinutes = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) {
    return null;
  }
  const startDate = new Date(fechaInicio);
  const endDate = new Date(fechaFin);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  if (endDate < startDate) {
    return null;
  }
  const days = countBusinessDays(startDate, endDate);
  if (days <= 0) {
    return null;
  }
  return days * 8 * 60;
};

module.exports = { countBusinessDays, calculateEstimatedMinutes };
