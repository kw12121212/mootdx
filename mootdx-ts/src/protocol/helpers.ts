/**
 * Decode a variable-length signed integer from a TDX binary buffer.
 *
 * First byte: bit7 = continuation, bit6 = sign, bits0-5 = data.
 * Subsequent bytes: bit7 = continuation, bits0-6 = data (shifted by 6 + 7*(n-1)).
 *
 * Returns [value, newOffset].
 */
export function getPrice(buf: Buffer | Uint8Array, offset: number): [number, number] {
  let posByte = 6;
  const b = buf[offset]!;
  let intdata = b & 0x3f;
  const sign = !!(b & 0x40);

  if (b & 0x80) {
    let pos = offset;
    while (true) {
      pos += 1;
      const next = buf[pos]!;
      intdata += (next & 0x7f) << posByte;
      posByte += 7;
      if (!(next & 0x80)) break;
    }
    return [sign ? -intdata : intdata, pos + 1];
  }

  return [sign ? -intdata : intdata, offset + 1];
}

/**
 * Decode a packed 32-bit integer into a floating-point volume value.
 *
 * The integer is split into 4 bytes treated as mantissa/exponent pairs
 * with power-of-2 scaling — a reverse-engineered TDX decompression routine.
 */
export function getVolume(ivol: number): number {
  const hheax = (ivol >>> 24) & 0xff;
  const hleax = (ivol >>> 16) & 0xff;
  const lheax = (ivol >>> 8) & 0xff;
  const lleax = ivol & 0xff;

  const logpoint = hheax;
  const dwEcx = logpoint * 2 - 0x7f;
  const dwEdx = logpoint * 2 - 0x86;
  const dwEsi = logpoint * 2 - 0x8e;
  const dwEax = logpoint * 2 - 0x96;

  const tmpEax = dwEcx < 0 ? -dwEcx : dwEcx;
  let dbl_xmm6 = 2.0 ** tmpEax;
  if (dwEcx < 0) dbl_xmm6 = 1.0 / dbl_xmm6;

  let dbl_xmm4: number;
  if (hleax > 0x80) {
    const dwtmpeax = dwEdx + 1;
    const tmpdbl_xmm3 = 2.0 ** dwtmpeax;
    dbl_xmm4 = 2.0 ** dwEdx * 128.0 + (hleax & 0x7f) * tmpdbl_xmm3;
  } else if (dwEdx >= 0) {
    dbl_xmm4 = 2.0 ** dwEdx * hleax;
  } else {
    dbl_xmm4 = (1 / 2.0 ** (-dwEdx)) * hleax;
  }

  let dbl_xmm3 = 2.0 ** dwEsi * lheax;
  let dbl_xmm1 = 2.0 ** dwEax * lleax;

  if (hleax & 0x80) {
    dbl_xmm3 *= 2.0;
    dbl_xmm1 *= 2.0;
  }

  return dbl_xmm6 + dbl_xmm4 + dbl_xmm3 + dbl_xmm1;
}

/**
 * Decode a datetime from a TDX binary buffer.
 *
 * For categories < 4, 7, or 8: unpacks a packed 4-byte format where `zipday`
 * encodes year/month/day and `tminutes` encodes hour/minute.
 * For other categories: unpacks a 4-byte integer as YYYYMMDD.
 *
 * Returns [year, month, day, hour, minute, newOffset].
 */
export function getDatetime(
  buf: Buffer | Uint8Array,
  offset: number,
  category: number,
): [number, number, number, number, number, number] {
  const view = new DataView(buf instanceof Uint8Array ? buf.buffer : buf);

  if (category < 4 || category === 7 || category === 8) {
    const zipday = view.getUint16(offset, true);
    const tminutes = view.getUint16(offset + 2, true);

    const year = (zipday >>> 11) + 2004;
    const month = ((zipday % 2048) / 100) | 0;
    const day = (zipday % 2048) % 100;
    const hour = (tminutes / 60) | 0;
    const minute = tminutes % 60;

    return [year, month, day, hour, minute, offset + 4];
  }

  const zipday = view.getUint32(offset, true);
  const year = (zipday / 10000) | 0;
  const month = ((zipday % 10000) / 100) | 0;
  const day = zipday % 100;

  return [year, month, day, 15, 0, offset + 4];
}

/**
 * Decode hour and minute from a 2-byte unsigned short (total minutes).
 *
 * Returns [hour, minute, newOffset].
 */
export function getTime(
  buf: Buffer | Uint8Array,
  offset: number,
): [number, number, number] {
  const view = new DataView(buf instanceof Uint8Array ? buf.buffer : buf);
  const tminutes = view.getUint16(offset, true);
  const hour = (tminutes / 60) | 0;
  const minute = tminutes % 60;
  return [hour, minute, offset + 2];
}
