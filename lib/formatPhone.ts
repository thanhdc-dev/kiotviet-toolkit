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

/**
 * Định dạng số điện thoại Việt Nam.
 * Trả về `null` nếu chuỗi không phải một số điện thoại hợp lệ dạng liền,
 * để nơi gọi giữ nguyên nội dung gốc.
 */
export function formatPhone(raw: string, separator: Separator = 'space'): string | null {
  const match = CANDIDATE.exec(raw);
  if (!match) return null;

  const [, prefix = '0', digits = ''] = match;
  const national = '0' + digits;
  const international = prefix !== '0';

  let groups: string[];
  if (MOBILE.test(national)) groups = groupMobile(national, international);
  else if (LANDLINE.test(national)) groups = groupLandline(national, international);
  else return null;

  if (international) groups = [prefix, ...groups];
  return groups.join(SEPARATOR_CHARS[separator]);
}

const PART_SEPARATORS = /[,;/|\n]+/;
const INNER_NOISE = /[\s.\-()]/g;

/**
 * Tách một chuỗi chứa một hoặc nhiều số điện thoại (ngăn cách bởi `, ; / |` hoặc xuống dòng).
 * - Phần hợp lệ được trả về dạng liền (đã bỏ khoảng trắng, dấu chấm, gạch ngang bên trong).
 * - Phần không nhận diện được vẫn được giữ nguyên (đã trim) để không làm mất thông tin.
 * - Bỏ phần rỗng và phần trùng lặp.
 */
export function extractPhones(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(PART_SEPARATORS)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const compact = trimmed.replace(INNER_NOISE, '');
    const value = formatPhone(compact) !== null ? compact : trimmed;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

/** So sánh hai số chỉ theo chữ số, bỏ qua dấu cách và các ký tự phân cách. */
export function samePhoneDigits(a: string, b: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, '');
  const da = digits(a);
  return da !== '' && da === digits(b);
}
