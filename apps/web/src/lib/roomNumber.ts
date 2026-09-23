/** A short, non-secret reference for comparing the same table across devices. */
export function roomNumber(roomId: string): string {
  if (/^\d{6}$/.test(roomId)) return roomId;
  let hash = 0x811c9dc5;
  for (let index = 0; index < roomId.length; index += 1) {
    hash = Math.imul(hash ^ roomId.charCodeAt(index), 0x01000193);
  }
  return String(100000 + (hash >>> 0) % 900000);
}
