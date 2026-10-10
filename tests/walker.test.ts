// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhoneFormatter } from '../lib/walker';

const tick = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('createPhoneFormatter', () => {
  let formatter: ReturnType<typeof createPhoneFormatter>;

  beforeEach(() => {
    document.body.innerHTML = '';
    formatter = createPhoneFormatter();
  });

  afterEach(() => formatter.stop());

  it('format số điện thoại có sẵn trong trang và giữ khoảng trắng quanh số', () => {
    document.body.innerHTML = '<table><tr><td id="a"> 0357747884 </td></tr></table>';
    formatter.start();
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    expect(document.querySelector('#a')!.textContent).toBe(' 0357 747 884 ');
  });

  it('không sửa input, textarea, contenteditable', () => {
    document.body.innerHTML = `
      <input id="i" value="0357747884" />
      <textarea id="t">0357747884</textarea>
      <div id="c" contenteditable="true">0357747884</div>`;
    formatter.start();
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    expect((document.querySelector('#i') as HTMLInputElement).value).toBe('0357747884');
    expect(document.querySelector('#t')!.textContent).toBe('0357747884');
    expect(document.querySelector('#c')!.textContent).toBe('0357747884');
  });

  it('không sửa mã vạch, mã hóa đơn hoặc câu có số lẫn vào', () => {
    document.body.innerHTML = `
      <p id="a">8935001234567</p>
      <p id="b">HD0357747884</p>
      <p id="c">SĐT: 0357747884</p>`;
    formatter.start();
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    expect(document.querySelector('#a')!.textContent).toBe('8935001234567');
    expect(document.querySelector('#b')!.textContent).toBe('HD0357747884');
    expect(document.querySelector('#c')!.textContent).toBe('SĐT: 0357747884');
  });

  it('format node được thêm vào sau khi trang render lại (SPA)', async () => {
    formatter.start();
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    document.body.insertAdjacentHTML('beforeend', '<div id="late"><span>0912345678</span></div>');
    await tick();
    expect(document.querySelector('#late')!.textContent).toBe('0912 345 678');
  });

  it('format lại khi framework ghi đè nội dung text node', async () => {
    document.body.innerHTML = '<span id="s">0357747884</span>';
    formatter.start();
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    const text = document.querySelector('#s')!.firstChild as Text;
    text.nodeValue = '0912345678';
    await tick();
    expect(text.nodeValue).toBe('0912 345 678');
  });

  it('khôi phục số gốc khi tắt và áp dụng lại khi bật', () => {
    document.body.innerHTML = '<span id="s">0357747884</span>';
    formatter.start();
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    formatter.configure({ enabled: false, separator: 'space', showAllNumbers: true });
    expect(document.querySelector('#s')!.textContent).toBe('0357747884');
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    expect(document.querySelector('#s')!.textContent).toBe('0357 747 884');
  });

  it('đổi kiểu phân cách từ số gốc, không format chồng', async () => {
    document.body.innerHTML = '<span id="s">0357747884</span>';
    formatter.start();
    formatter.configure({ enabled: true, separator: 'space', showAllNumbers: true });
    formatter.configure({ enabled: true, separator: 'dash', showAllNumbers: true });
    await tick(); // mutation do chính extension tạo ra không được gây ảnh hưởng
    expect(document.querySelector('#s')!.textContent).toBe('0357-747-884');
  });

  it('khi đang tắt thì node mới thêm vào không bị format', async () => {
    formatter.start();
    formatter.configure({ enabled: false, separator: 'space', showAllNumbers: true });
    document.body.insertAdjacentHTML('beforeend', '<span id="n">0357747884</span>');
    await tick();
    expect(document.querySelector('#n')!.textContent).toBe('0357747884');
  });
});
