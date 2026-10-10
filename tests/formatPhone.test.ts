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
});

import { extractPhones, samePhoneDigits } from '../lib/formatPhone';

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
});

describe('samePhoneDigits', () => {
  it('so sánh theo chữ số, bỏ qua phân cách', () => {
    expect(samePhoneDigits('0345 678 664', '0345678664')).toBe(true);
    expect(samePhoneDigits('0345-678-664', '0345.678.664')).toBe(true);
    expect(samePhoneDigits('0345678664', '0987654334')).toBe(false);
    expect(samePhoneDigits('', '')).toBe(false);
  });
});
