/** `13:05`: the time of day in Israel, so a time reads the same on every commander's screen. */
export const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(iso));
