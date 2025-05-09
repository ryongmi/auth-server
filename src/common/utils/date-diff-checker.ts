export function isWithinMinutes(
  date1: Date,
  date2: Date,
  minutes: number,
): boolean {
  const diffInMilliseconds = Math.abs(date1.getTime() - date2.getTime());
  const diffInMinutes = diffInMilliseconds / (1000 * 60);
  return diffInMinutes <= minutes;
}
