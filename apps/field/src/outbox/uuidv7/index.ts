import { getRandomValues } from 'expo-crypto';

const COUNTER_MAX = 0xfff;

let lastMs = 0;
let counter = 0;

/**
 * A time-ordered UUID (version 7, RFC 9562): the first 48 bits are the Unix time in milliseconds, so ids sort in
 * creation order. The 12 bits after the version are a counter, so ids made in the same millisecond (or after the clock
 * went back) still rise. Used as the id of an outbox item, which the server can later use to drop a repeat (#98).
 */
export function uuidv7(): string {
  let ms = Date.now();
  if (ms > lastMs) {
    lastMs = ms;
    // Start each millisecond below the top, so the counter has room to rise.
    counter = getRandomValues(new Uint16Array(1))[0]! & 0x7ff;
  } else {
    ms = lastMs;
    counter += 1;
    if (counter > COUNTER_MAX) {
      // The counter is full: borrow the next millisecond.
      lastMs += 1;
      ms = lastMs;
      counter = 0;
    }
  }

  const bytes = getRandomValues(new Uint8Array(16));
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = 0x70 | (counter >> 8);
  bytes[7] = counter & 0xff;
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
