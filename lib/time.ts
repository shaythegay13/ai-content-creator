// Convert a datetime-local value in an IANA zone; reject nonexistent DST times.
export function localDateTime(value: string, zone: string): Date {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))
    throw new Error('Choose a date and time.');
  const wanted = Date.parse(value + 'Z');
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const actual = Date.parse(zonedInput(new Date(guess), zone) + 'Z');
    guess += wanted - actual;
  }
  const result = new Date(guess);
  if (zonedInput(result, zone) !== value)
    throw new Error(
      'That local time does not exist because of daylight saving time.',
    );
  return result;
}
export function zonedInput(date: Date | string, zone: string) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(date));
  const get = (t: string) => p.find((x) => x.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
