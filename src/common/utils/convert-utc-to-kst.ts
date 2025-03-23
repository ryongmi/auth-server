export function convertUTCtoKST(utcDateString): Date {
  // UTC 형식의 문자열을 Date 객체로 변환합니다.
  const utcDate = new Date(utcDateString);

  // UTC 시간대를 한국 시간대로 변환합니다.
  const kstOffset = 9 * 60; // 한국 시간대는 UTC+9
  const kstTime = new Date(utcDate.getTime() + kstOffset * 60 * 1000);

  return kstTime;
}
