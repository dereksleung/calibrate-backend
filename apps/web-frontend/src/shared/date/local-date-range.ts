// TO-DO: Use date-fns in date functions in a small refactor. 
// Tolerating this agent-generated code for now, I don't allow agents to install dependencies themselves because of recent supply chain attacks.

const WEEKDAY_ABBREVIATIONS = ["Sn", "M", "T", "W", "Th", "F", "Sa"] as const;

export type LocalDateRange = {
  startDate: string;
  endDate: string;
};

export function getRollingSevenDayDateRange(now = new Date()): LocalDateRange {
  const endDate = formatLocalDate(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);

  return { startDate: formatLocalDate(start), endDate };
}

export function getLocalWeekdayAbbreviation(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  return WEEKDAY_ABBREVIATIONS[new Date(year, month - 1, day).getDay()];
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
