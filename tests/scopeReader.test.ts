// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createScopeReader, PHONES_ATTR, SOURCES } from '../lib/scopeReader';

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

type FakeScope = { dataItem?: Record<string, unknown> };
const scopes = new WeakMap<Element, FakeScope>();

/** Giống jqLite: scope() trả về scope của phần tử tổ tiên gần nhất có scope. */
function fakeAngular() {
  return {
    element: (el: Element) => ({
      scope: () => {
        for (let cur: Element | null = el; cur; cur = cur.parentElement) {
          const found = scopes.get(cur);
          if (found) return found;
        }
        return undefined;
      },
    }),
  };
}

const customerRow = { dataItem: { ContactNumber: '0345678664', SubNumber: '0987654334' } };
const invoiceRow = {
  dataItem: {
    Customer: { ContactNumber: '0357868990', SubNumber: '0987654322' },
    CustomerContactNumber: '0357868990',
  },
};

function row(scope: FakeScope | undefined, cells: Array<string | HTMLElement>): HTMLTableRowElement {
  const tr = document.createElement('tr');
  if (scope) scopes.set(tr, scope);
  for (const content of cells) {
    const td = document.createElement('td');
    if (typeof content === 'string') td.textContent = content;
    else td.append(content);
    tr.append(td);
  }
  return tr;
}

describe('createScopeReader', () => {
  let reader: ReturnType<typeof createScopeReader>;

  beforeEach(() => {
    document.body.innerHTML = '';
    (window as unknown as { angular: unknown }).angular = fakeAngular();
    reader = createScopeReader(SOURCES);
  });

  afterEach(() => {
    reader.stop();
    delete (window as unknown as { angular?: unknown }).angular;
  });

  it('danh sách Khách hàng: ghi số chính và số phụ vào ô điện thoại', () => {
    const tr = row(customerRow, ['KH001', 'Nguyễn A', '0345 678 664']);
    document.body.append(tr);
    reader.start();
    const [code, name, phone] = [...tr.children];
    expect(phone!.getAttribute(PHONES_ATTR)).toBe('0345678664,0987654334');
    expect(code!.hasAttribute(PHONES_ATTR)).toBe(false);
    expect(name!.hasAttribute(PHONES_ATTR)).toBe(false);
  });

  it('hóa đơn và đặt hàng: đọc số từ dataItem.Customer', () => {
    const tr = row(invoiceRow, ['HD000123', 'Trần B', '0357868990']);
    document.body.append(tr);
    reader.start();
    expect(tr.children[2]!.getAttribute(PHONES_ATTR)).toBe('0357868990,0987654322');
  });

  it('số nằm trong thẻ con của ô vẫn nhận ra (scope lấy từ tổ tiên)', () => {
    const span = document.createElement('span');
    span.textContent = '0357868990';
    const tr = row(invoiceRow, ['HD000123', span]);
    document.body.append(tr);
    reader.start();
    expect(span.getAttribute(PHONES_ATTR)).toBe('0357868990,0987654322');
    expect(span.parentElement!.hasAttribute(PHONES_ATTR)).toBe(false);
  });

  it('không gắn attribute khi số hiển thị không phải số chính của dòng', () => {
    const tr = row(invoiceRow, ['0912345678']);
    document.body.append(tr);
    reader.start();
    expect(tr.children[0]!.hasAttribute(PHONES_ATTR)).toBe(false);
  });

  it('không gắn attribute khi không có số phụ, khách lẻ hoặc số phụ rỗng', () => {
    const a = row({ dataItem: { ContactNumber: '0345678664' } }, ['0345678664']);
    const b = row({ dataItem: { ContactNumber: '0345678664', SubNumber: '  ' } }, ['0345678664']);
    const c = row({ dataItem: { Customer: null } }, ['0345678664']);
    document.body.append(a, b, c);
    reader.start();
    for (const tr of [a, b, c]) expect(tr.children[0]!.hasAttribute(PHONES_ATTR)).toBe(false);
  });

  it('bỏ qua text không giống số điện thoại, mã vạch và ô nhập liệu', () => {
    const input = document.createElement('input');
    const tr = row(customerRow, ['HD0345678664', '8935001234567', '12,500,000', '0345678664 ghi chú']);
    tr.append(input);
    document.body.append(tr);
    reader.start();
    for (const td of tr.children) expect(td.hasAttribute(PHONES_ATTR)).toBe(false);
  });

  it('xử lý dòng mới được thêm vào sau (SPA render lại)', async () => {
    reader.start();
    const table = document.createElement('table');
    const tr = row(customerRow, ['0345678664']);
    table.append(tr);
    document.body.append(table);
    await tick();
    expect(tr.children[0]!.getAttribute(PHONES_ATTR)).toBe('0345678664,0987654334');
  });

  it('cập nhật khi binding đổi text và model của dòng đã đổi theo', async () => {
    const scope: FakeScope = { dataItem: { ContactNumber: '0345678664', SubNumber: '0987654334' } };
    const tr = row(scope, ['0345678664']);
    document.body.append(tr);
    reader.start();
    const td = tr.children[0]!;
    expect(td.hasAttribute(PHONES_ATTR)).toBe(true);
    scope.dataItem = { ContactNumber: '0912345678' };
    td.firstChild!.nodeValue = '0912345678';
    await tick();
    expect(td.hasAttribute(PHONES_ATTR)).toBe(false);
  });

  it('không xóa attribute khi content script đã ghi nhiều dòng vào ô', async () => {
    const tr = row(customerRow, ['0345678664']);
    document.body.append(tr);
    reader.start();
    const td = tr.children[0]!;
    td.firstChild!.nodeValue = '0345 678 664\n0987 654 334'; // đầu ra của content script
    await tick();
    expect(td.getAttribute(PHONES_ATTR)).toBe('0345678664,0987654334');
  });

  it('thử lại khi scope gắn vào ô muộn hơn DOM', async () => {
    const tr = row(undefined, ['0345678664']);
    document.body.append(tr);
    reader.start();
    expect(tr.children[0]!.hasAttribute(PHONES_ATTR)).toBe(false);
    scopes.set(tr, customerRow); // AngularJS link xong, không có mutation DOM nào
    await tick(260);
    expect(tr.children[0]!.getAttribute(PHONES_ATTR)).toBe('0345678664,0987654334');
  });

  it('chịu được khi AngularJS chưa có hoặc scope ném lỗi', () => {
    delete (window as unknown as { angular?: unknown }).angular;
    const tr = row(customerRow, ['0345678664']);
    document.body.append(tr);
    expect(() => reader.start()).not.toThrow();
    expect(tr.children[0]!.hasAttribute(PHONES_ATTR)).toBe(false);

    (window as unknown as { angular: unknown }).angular = {
      element: () => ({
        scope: () => {
          throw new Error('debug info disabled');
        },
      }),
    };
    reader.stop();
    reader = createScopeReader(SOURCES);
    expect(() => reader.start()).not.toThrow();
    expect(tr.children[0]!.hasAttribute(PHONES_ATTR)).toBe(false);
  });
});
