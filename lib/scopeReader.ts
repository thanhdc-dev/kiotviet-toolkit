/**
 * Chạy ở MAIN world của trang (cùng thế giới với AngularJS của KiotViet).
 * Với mỗi text node trông giống số điện thoại, đọc model của dòng chứa nó (chỉ đọc, không sửa)
 * rồi ghi danh sách số của khách vào attribute của phần tử cha để content script thường
 * (ISOLATED world) đọc được.
 *
 * Không phụ thuộc selector của từng màn hình: chỉ gắn attribute khi số đang hiển thị
 * đúng là số chính trong model, nên nhận diện được ô điện thoại ở bất kỳ danh sách nào.
 */
import { samePhoneDigits } from './formatPhone';
import { PHONES_ATTR, SKIP_SELECTOR } from './shared';

export { PHONES_ATTR };

export interface PhoneSource {
  /** Tên thuộc tính trên scope chứa dữ liệu dòng, ví dụ `dataItem`. */
  item: string;
  /** Đường dẫn tới các trường số điện thoại (hỗ trợ lồng nhau), số chính trước. */
  fields: string[];
}

/** Thêm màn hình mới bằng cách bổ sung một mục sau khi quét scope. */
export const SOURCES: PhoneSource[] = [
  // Danh sách Khách hàng
  { item: 'dataItem', fields: ['ContactNumber', 'SubNumber'] },
  // Hóa đơn, đặt hàng: thông tin khách nằm trong dataItem.Customer
  { item: 'dataItem', fields: ['Customer.ContactNumber', 'Customer.SubNumber'] },
];

// Lọc nhanh trước khi đụng tới scope: chỉ gồm chữ số và ký tự phân cách, 9-13 chữ số.
const PHONE_LIKE = /^\s*\+?[\d\s.-]+\s*$/;
const MIN_DIGITS = 9;
const MAX_DIGITS = 13;

// Scope của AngularJS có thể chưa gắn vào ô ngay lúc DOM được tạo.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

interface AngularLike {
  element(el: Element): { scope?: () => unknown };
}

function getPath(obj: unknown, path: string): unknown {
  let current = obj;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Trả về `null` khi chưa đọc được scope hoặc dữ liệu dòng; mảng (có thể rỗng) khi đã đọc được. */
function readPhones(el: Element, source: PhoneSource): string[] | null {
  const angular = (window as unknown as { angular?: AngularLike }).angular;
  if (!angular) return null;
  try {
    const scope = angular.element(el).scope?.() as Record<string, unknown> | undefined;
    const data = scope?.[source.item];
    if (data === undefined || data === null || typeof data !== 'object') return null;
    return source.fields
      .map((field) => getPath(data, field))
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  } catch {
    return null;
  }
}

function looksLikePhone(text: string): boolean {
  if (text.length > 24 || !PHONE_LIKE.test(text)) return false;
  const digits = text.replace(/\D/g, '').length;
  return digits >= MIN_DIGITS && digits <= MAX_DIGITS;
}

export function createScopeReader(sources: PhoneSource[] = SOURCES) {
  let observer: MutationObserver | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  /** @returns `true` nếu đã xác định được (có hoặc không có số phụ), `false` nếu scope chưa sẵn sàng. */
  function tagElement(el: Element, visibleText: string): boolean {
    let resolved = false;
    for (const source of sources) {
      const phones = readPhones(el, source);
      if (phones === null) continue;
      resolved = true;
      const first = phones[0];
      // Chỉ tin dữ liệu khi số đang hiển thị đúng là số chính của dòng.
      if (phones.length > 1 && first !== undefined && samePhoneDigits(visibleText, first)) {
        const value = phones.join(',');
        if (el.getAttribute(PHONES_ATTR) !== value) el.setAttribute(PHONES_ATTR, value);
        return true;
      }
    }
    if (resolved && el.hasAttribute(PHONES_ATTR)) el.removeAttribute(PHONES_ATTR);
    return resolved;
  }

  function tagTextNode(node: Text, attempt = 1): void {
    const value = node.nodeValue ?? '';
    if (!looksLikePhone(value)) return;
    const el = node.parentElement;
    if (!el || el.closest(SKIP_SELECTOR)) return;
    if (tagElement(el, value) || attempt >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (node.isConnected) tagTextNode(node, attempt + 1);
    }, RETRY_DELAY_MS * attempt);
    timers.add(timer);
  }

  function tagWithin(root: Node): void {
    if (root.nodeType === Node.TEXT_NODE) {
      tagTextNode(root as Text);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) tagTextNode(n as Text);
  }

  function onMutations(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === 'characterData') tagTextNode(record.target as Text);
      else record.addedNodes.forEach((node) => tagWithin(node));
    }
  }

  function start(): void {
    if (observer) return;
    tagWithin(document.documentElement);
    // Xử lý đồng bộ trong callback (microtask) để attribute luôn sẵn sàng sớm nhất có thể.
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true, // binding của AngularJS cập nhật text sau khi scope đã gắn vào ô
    });
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;
    timers.forEach(clearTimeout);
    timers.clear();
  }

  return { start, stop };
}
