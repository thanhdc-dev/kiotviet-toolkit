import { describe, expect, it } from 'vitest';
import { formatPhone } from '../lib/formatPhone';

describe('formatPhone', () => {
  it('định dạng số di động 10 số theo 4-3-3', () => {
    expect(formatPhone('0357747884')).toBe('0357 747 884');
    expect(formatPhone('0912345678')).toBe('0912 345 678');
    expect(formatPhone('0845123456')).toBe('0845 123 456');
  });

  it('giữ tiền tố +84 hoặc 84 như bản gốc', () => {
    expect(formatPhone('+84357747884')).toBe('+84 357 747 884');
    expect(formatPhone('84357747884')).toBe('84 357 747 884');
  });

  it('định dạng số bàn mã vùng 3 số theo 3-4-4', () => {
    expect(formatPhone('02437477884')).toBe('024 3747 7884');
    expect(formatPhone('02838123456')).toBe('028 3812 3456');
    expect(formatPhone('+842437477884')).toBe('+84 24 3747 7884');
  });

  it('định dạng số bàn mã vùng 4 số theo 4-3-4', () => {
    expect(formatPhone('02543747788')).toBe('0254 374 7788');
    expect(formatPhone('+842543747788')).toBe('+84 254 374 7788');
  });

  it('hỗ trợ các kiểu phân cách', () => {
    expect(formatPhone('0357747884', 'dot')).toBe('0357.747.884');
    expect(formatPhone('0357747884', 'dash')).toBe('0357-747-884');
    expect(formatPhone('+84357747884', 'dot')).toBe('+84.357.747.884');
  });

  it('không đổi các chuỗi không phải số điện thoại', () => {
    const untouched = [
      '',
      '0357',
      '035774788', // 9 số
      '03577478845', // 11 số nhưng đầu 03 không phải số bàn
      '1357747884', // không bắt đầu bằng 0
      '4357747884',
      '0157747884', // đầu số 01x không hợp lệ
      '0657747884',
      '8935001234567', // mã vạch EAN-13
      'HD0357747884',
      '0357747884A',
      '0357 747 884', // đã có phân cách
      '+8403577478', // sai độ dài
      '84 357 747 884',
      '0357747884 0912345678',
    ];
    for (const value of untouched) expect(formatPhone(value), value).toBeNull();
  });

  it('không format lại kết quả đã format', () => {
    const once = formatPhone('0357747884')!;
    expect(formatPhone(once)).toBeNull();
  });

  it('định dạng số điện thoại có ghi chú kèm theo', () => {
    expect(formatPhone('0984968450(Nguyệt)')).toBe('0984 968 450 (Nguyệt)');
    expect(formatPhone('0984968450 (Nguyệt)')).toBe('0984 968 450 (Nguyệt)');
    expect(formatPhone('0984968450 (chị Lan)')).toBe('0984 968 450 (chị Lan)');
    expect(formatPhone('0984968450 [Nguyệt]')).toBe('0984 968 450 [Nguyệt]');
    expect(formatPhone('0984968450 - Nguyệt')).toBe('0984 968 450 - Nguyệt');
    expect(formatPhone('0984968450-Nguyệt')).toBe('0984 968 450 - Nguyệt');
    expect(formatPhone('0984968450: Nguyệt')).toBe('0984 968 450: Nguyệt');
    expect(formatPhone('0984968450:Nguyệt')).toBe('0984 968 450: Nguyệt');
    expect(formatPhone('0984968450 (gọi sau 17h)')).toBe('0984 968 450 (gọi sau 17h)');
    expect(formatPhone('+84984968450(Nguyệt)')).toBe('+84 984 968 450 (Nguyệt)');
    expect(formatPhone('02437477884(bàn HN)')).toBe('024 3747 7884 (bàn HN)');
    expect(formatPhone('0984968450(Nguyệt)', 'dot')).toBe('0984.968.450 (Nguyệt)');
    expect(formatPhone('0984968450(Nguyệt)', 'dash')).toBe('0984-968-450 (Nguyệt)');
  });

  it('không format lại kết quả có ghi chú đã format', () => {
    const once = formatPhone('0984968450(Nguyệt)')!;
    expect(formatPhone(once)).toBeNull();
  });
});

import { extractPhones, samePhoneDigits, splitPhoneAndNote } from '../lib/formatPhone';

describe('extractPhones', () => {
  it('tách nhiều số theo , ; / | và xuống dòng', () => {
    expect(extractPhones('0345678664,0987654334')).toEqual(['0345678664', '0987654334']);
    expect(extractPhones('0345678664; 0987654334')).toEqual(['0345678664', '0987654334']);
    expect(extractPhones('0345678664 / 0987654334')).toEqual(['0345678664', '0987654334']);
    expect(extractPhones('0345678664\n0987654334')).toEqual(['0345678664', '0987654334']);
  });

  it('chuẩn hóa số có dấu cách, chấm, gạch ngang bên trong', () => {
    expect(extractPhones('0987 654 334,0345.678.664')).toEqual(['0987654334', '0345678664']);
  });

  it('bỏ phần rỗng và phần trùng lặp', () => {
    expect(extractPhones('0345678664,,0345 678 664')).toEqual(['0345678664']);
    expect(extractPhones('')).toEqual([]);
  });

  it('giữ nguyên phần không nhận diện được thay vì làm mất thông tin', () => {
    expect(extractPhones('0345678664,ext 12')).toEqual(['0345678664', 'ext 12']);
  });

  it('tách các số có ghi chú và giữ nguyên ghi chú', () => {
    expect(extractPhones('0345678664(chính),0987654334(phụ)')).toEqual([
      '0345678664(chính)',
      '0987654334(phụ)',
    ]);
    expect(extractPhones('0345.678.664 (chính); 0987 654 334 - phụ')).toEqual([
      '0345678664(chính)',
      '0987654334- phụ',
    ]);
  });
});

describe('samePhoneDigits', () => {
  it('so sánh theo chữ số, bỏ qua phân cách', () => {
    expect(samePhoneDigits('0345 678 664', '0345678664')).toBe(true);
    expect(samePhoneDigits('0345-678-664', '0345.678.664')).toBe(true);
    expect(samePhoneDigits('0345678664', '0987654334')).toBe(false);
    expect(samePhoneDigits('', '')).toBe(false);
  });

  it('so sánh chính xác khi có ghi chú kể cả khi ghi chú có chứa chữ số', () => {
    expect(samePhoneDigits('0984968450(Nguyệt)', '0984968450')).toBe(true);
    expect(samePhoneDigits('0984 968 450 (Nguyệt)', '0984968450')).toBe(true);
    expect(samePhoneDigits('0984968450 (gọi sau 17h)', '0984968450')).toBe(true);
    expect(samePhoneDigits('0984968450 (gọi sau 17h)', '0984968450 (máy lẻ 102)')).toBe(true);
  });
});

describe('splitPhoneAndNote', () => {
  it('tách đúng số và ghi chú', () => {
    expect(splitPhoneAndNote('0984968450(Nguyệt)')).toEqual({
      prefix: '0',
      digits: '984968450',
      compactPhone: '0984968450',
      hasInternalSeparators: false,
      note: '(Nguyệt)',
    });
    expect(splitPhoneAndNote('0984 968 450 (chị Lan)')).toEqual({
      prefix: '0',
      digits: '984968450',
      compactPhone: '0984968450',
      hasInternalSeparators: true,
      note: '(chị Lan)',
    });
  });
});
