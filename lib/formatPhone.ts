export type Separator = 'space' | 'dot' | 'dash';

export const SEPARATOR_CHARS: Record<Separator, string> = {
  space: ' ',
  dot: '.',
  dash: '-',
};

// Di động: 03x, 05x, 07x, 08x, 09x (10 số). Bàn: 02x (11 số).
const MOBILE = /^0[35789]\d{8}$/;
const LANDLINE = /^02\d{9}$/;
// Chuỗi liền, không có ký tự lạ: [+84 | 84 | 0] + 9-10 chữ số.
const CANDIDATE = /^(\+84|84|0)(\d{9,10})$/;
// Mã vùng 3 số (Hà Nội 024, TP.HCM 028); các tỉnh khác dùng mã vùng 4 số (0254...).
const THREE_DIGIT_AREA = new Set(['024', '028']);

function groupMobile(national: string, international: boolean): string[] {
  if (international) {
    const rest = national.slice(1); // 9 số
    return [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6)];
  }
  return [national.slice(0, 4), national.slice(4, 7), national.slice(7)];
}

function groupLandline(national: string, international: boolean): string[] {
  const area3 = THREE_DIGIT_AREA.has(national.slice(0, 3));
  if (international) {
    const rest = national.slice(1); // 10 số
    return area3
      ? [rest.slice(0, 2), rest.slice(2, 6), rest.slice(6)]
      : [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6)];
  }
  return area3
    ? [national.slice(0, 3), national.slice(3, 7), national.slice(7)]
    : [national.slice(0, 4), national.slice(4, 7), national.slice(7)];
}

function formatWithNote(phoneFormatted: string, rawNote?: string): string {
  if (!rawNote) return phoneFormatted;
  const trimmedNote = rawNote.trim();
  if (!trimmedNote) return phoneFormatted;

  if (trimmedNote.startsWith('(') || trimmedNote.startsWith('[')) {
    return `${phoneFormatted} ${trimmedNote}`;
  }
  if (trimmedNote.startsWith('-')) {
    const after = trimmedNote.slice(1).trim();
    return after ? `${phoneFormatted} - ${after}` : phoneFormatted;
  }
  if (trimmedNote.startsWith(':')) {
    const after = trimmedNote.slice(1).trim();
    return after ? `${phoneFormatted}: ${after}` : phoneFormatted;
  }
  return `${phoneFormatted} ${trimmedNote}`;
}

export interface ParsedPhone {
  prefix: string;
  digits: string;
  compactPhone: string;
  hasInternalSeparators: boolean;
  note?: string;
}

/**
 * Tách một chuỗi thành phần số điện thoại Việt Nam và phần ghi chú (nếu có).
 * Trả về `null` nếu chuỗi không bắt đầu bằng số điện thoại hợp lệ hoặc ghi chú không đúng định dạng.
 */
export function splitPhoneAndNote(raw: string): ParsedPhone | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let prefix = '';
  let rest = '';
  const thirdChar = trimmed[2];
  if (trimmed.startsWith('+84')) {
    prefix = '+84';
    rest = trimmed.slice(3);
  } else if (trimmed.startsWith('84') && thirdChar !== undefined && (thirdChar === ' ' || thirdChar === '.' || thirdChar === '-' || /\d/.test(thirdChar))) {
    prefix = '84';
    rest = trimmed.slice(2);
  } else if (trimmed.startsWith('0')) {
    prefix = '0';
    rest = trimmed.slice(1);
  } else {
    return null;
  }

  const cleanRest = rest.replace(/^[\s.-]+/, '');
  const firstDigit = cleanRest[0];
  let targetDigits: number;
  if (firstDigit === '2') {
    targetDigits = 10; // Bàn (02x + 9 chữ số)
  } else if (firstDigit && '35789'.includes(firstDigit)) {
    targetDigits = 9; // Di động (03/05/07/08/09 + 8 chữ số)
  } else {
    return null;
  }

  let digits = '';
  let endPhoneIdx = -1;
  let hasInternalSeparators = false;

  const firstRestChar = rest[0];
  if (firstRestChar === ' ' || firstRestChar === '.' || firstRestChar === '-') {
    hasInternalSeparators = true;
  }

  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === undefined) continue;
    if (ch >= '0' && ch <= '9') {
      digits += ch;
      if (digits.length === targetDigits) {
        endPhoneIdx = i + 1;
        break;
      }
    } else if (ch === ' ' || ch === '.' || ch === '-') {
      hasInternalSeparators = true;
    } else {
      return null;
    }
  }

  if (digits.length !== targetDigits || endPhoneIdx === -1) return null;

  const national = '0' + digits;
  if (targetDigits === 9 && !MOBILE.test(national)) return null;
  if (targetDigits === 10 && !LANDLINE.test(national)) return null;

  const compactPhone = (prefix === '0' ? '0' : prefix) + digits;
  const noteStr = rest.slice(endPhoneIdx);

  if (!noteStr.trim()) {
    return { prefix, digits, compactPhone, hasInternalSeparators };
  }

  const match = /^\s*(\S.*)$/.exec(noteStr);
  const noteContent = match?.[1];
  if (!noteContent) return { prefix, digits, compactPhone, hasInternalSeparators };

  const firstChar = noteContent[0];
  // Ghi chú hợp lệ phải bắt đầu bằng ngoặc hoặc dấu phân cách: (, [, -, :, /, ~
  if (!firstChar || !'([/:-~'.includes(firstChar)) {
    return null;
  }

  return { prefix, digits, compactPhone, hasInternalSeparators, note: noteContent };
}

/**
 * Định dạng số điện thoại Việt Nam (hỗ trợ kèm ghi chú ở đuôi).
 * Trả về `null` nếu chuỗi không phải một số điện thoại hợp lệ dạng liền,
 * hoặc số đã được phân cách sẵn, để nơi gọi giữ nguyên nội dung gốc.
 */
export function formatPhone(raw: string, separator: Separator = 'space'): string | null {
  const parsed = splitPhoneAndNote(raw);
  if (!parsed || parsed.hasInternalSeparators) return null;

  const { prefix, digits, note } = parsed;
  const national = '0' + digits;
  const international = prefix !== '0';

  let groups: string[];
  if (MOBILE.test(national)) groups = groupMobile(national, international);
  else if (LANDLINE.test(national)) groups = groupLandline(national, international);
  else return null;

  if (international) groups = [prefix, ...groups];
  const phoneFormatted = groups.join(SEPARATOR_CHARS[separator]);
  return formatWithNote(phoneFormatted, note);
}

const PART_SEPARATORS = /[,;/|\n]+/;

/**
 * Tách một chuỗi chứa một hoặc nhiều số điện thoại (ngăn cách bởi `, ; / |` hoặc xuống dòng).
 * - Phần hợp lệ được chuẩn hóa số về dạng liền và giữ nguyên phần ghi chú kèm theo.
 * - Phần không nhận diện được vẫn được giữ nguyên (đã trim) để không làm mất thông tin.
 * - Bỏ phần rỗng và phần trùng lặp.
 */
export function extractPhones(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(PART_SEPARATORS)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const parsed = splitPhoneAndNote(trimmed);
    let value: string;
    if (parsed) {
      value = parsed.note ? `${parsed.compactPhone}${parsed.note}` : parsed.compactPhone;
    } else {
      value = trimmed;
    }
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

/** So sánh hai số chỉ theo chữ số của phần số điện thoại, bỏ qua phân cách và phần ghi chú. */
export function samePhoneDigits(a: string, b: string): boolean {
  const pa = splitPhoneAndNote(a);
  const pb = splitPhoneAndNote(b);
  const da = pa ? pa.compactPhone.replace(/\D/g, '') : a.replace(/\D/g, '');
  const db = pb ? pb.compactPhone.replace(/\D/g, '') : b.replace(/\D/g, '');
  return da !== '' && da === db;
}
