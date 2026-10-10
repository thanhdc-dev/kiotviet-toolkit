// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhoneFormatter, type FormatterOptions } from '../lib/walker';

const tick = () => new Promise((resolve) => setTimeout(resolve, 50));
const ON: FormatterOptions = { enabled: true, separator: 'space', showAllNumbers: true };

function cell(text: string, phones?: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'cell-phone';
  if (phones !== undefined) td.setAttribute('data-kvpf-phones', phones);
  td.textContent = text;
  return td;
}

describe('hiển thị nhiều số trong một ô', () => {
  let formatter: ReturnType<typeof createPhoneFormatter>;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    formatter = createPhoneFormatter();
  });

  afterEach(() => formatter.stop());

  it('mỗi số một dòng, có định dạng, và gắn thuộc tính hiển thị nhiều dòng', () => {
    const td = cell('0345678664', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    expect(td.textContent).toBe('0345 678 664\n0987 654 334');
    expect(td.hasAttribute('data-kvpf-multi')).toBe(true);
    expect(document.getElementById('kvpf-style')?.textContent).toContain('pre-line');
  });

  it('hoạt động khi text đang hiển thị đã được định dạng sẵn', () => {
    const td = cell('0345 678 664', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    expect(td.textContent).toBe('0345 678 664\n0987 654 334');
  });

  it('tách được số phụ chứa dấu cách hoặc nhiều số', () => {
    const td = cell('0345678664', '0345678664,0987 654 334; 0912345678');
    document.body.append(td);
    formatter.start();
    formatter.configure({ ...ON, separator: 'dot' });
    expect(td.textContent).toBe('0345.678.664\n0987.654.334\n0912.345.678');
  });

  it('chỉ có một số hoặc số phụ trùng số chính thì giữ dạng một dòng', () => {
    const a = cell('0345678664', '0345678664,0345 678 664');
    const b = cell('0345678664');
    document.body.append(a, b);
    formatter.start();
    formatter.configure(ON);
    expect(a.textContent).toBe('0345 678 664');
    expect(a.hasAttribute('data-kvpf-multi')).toBe(false);
    expect(b.textContent).toBe('0345 678 664');
  });

  it('bỏ qua attribute cũ khi số đang hiển thị không phải số chính của dòng', () => {
    const td = cell('0912345678', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    expect(td.textContent).toBe('0912 345 678');
    expect(td.hasAttribute('data-kvpf-multi')).toBe(false);
  });

  it('cập nhật khi main world ghi attribute sau khi ô đã được format', async () => {
    const td = cell('0345678664');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    expect(td.textContent).toBe('0345 678 664');
    td.setAttribute('data-kvpf-phones', '0345678664,0987654334');
    await tick();
    expect(td.textContent).toBe('0345 678 664\n0987 654 334');
    td.removeAttribute('data-kvpf-phones');
    await tick();
    expect(td.textContent).toBe('0345 678 664');
    expect(td.hasAttribute('data-kvpf-multi')).toBe(false);
  });

  it('dòng được tái sử dụng cho khách khác: không hiện số của khách cũ', async () => {
    const td = cell('0345678664', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    // AngularJS ghi text mới trước khi main world kịp cập nhật attribute
    td.firstChild!.nodeValue = '0912345678';
    await tick();
    expect(td.textContent).toBe('0912 345 678');
    expect(td.hasAttribute('data-kvpf-multi')).toBe(false);
    td.setAttribute('data-kvpf-phones', '0912345678,0356789012');
    await tick();
    expect(td.textContent).toBe('0912 345 678\n0356 789 012');
  });

  it('tắt "hiện mọi số" thì chỉ còn số chính, bật lại thì hiện đủ', () => {
    const td = cell('0345678664', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    formatter.configure({ ...ON, showAllNumbers: false });
    expect(td.textContent).toBe('0345 678 664');
    expect(td.hasAttribute('data-kvpf-multi')).toBe(false);
    formatter.configure(ON);
    expect(td.textContent).toBe('0345 678 664\n0987 654 334');
  });

  it('tắt định dạng nhưng vẫn hiện mọi số: giữ số gốc, mỗi số một dòng', () => {
    const td = cell('0345678664', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure({ enabled: false, separator: 'space', showAllNumbers: true });
    expect(td.textContent).toBe('0345678664\n0987654334');
  });

  it('tắt cả hai thì khôi phục hoàn toàn nội dung gốc', () => {
    const td = cell('0345678664', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    formatter.configure({ enabled: false, separator: 'space', showAllNumbers: false });
    expect(td.textContent).toBe('0345678664');
    expect(td.hasAttribute('data-kvpf-multi')).toBe(false);
  });

  it('đổi kiểu phân cách khi đang hiện nhiều số', async () => {
    const td = cell('0345678664', '0345678664,0987654334');
    document.body.append(td);
    formatter.start();
    formatter.configure(ON);
    formatter.configure({ ...ON, separator: 'dash' });
    await tick();
    expect(td.textContent).toBe('0345-678-664\n0987-654-334');
  });
});
