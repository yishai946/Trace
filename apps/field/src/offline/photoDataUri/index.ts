const CHUNK = 0x8000;

/** A photo's bytes as a `data:` address an image component can show, without writing a file. */
export function photoDataUri({ bytes, contentType }: { bytes: Uint8Array; contentType: string }): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}
