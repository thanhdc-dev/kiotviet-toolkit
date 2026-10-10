import { extractPhones, formatPhone, samePhoneDigits, type Separator } from './formatPhone';
import { PHONES_ATTR, SKIP_SELECTOR } from './shared';

export interface FormatterOptions {
  /** Định dạng số điện thoại có phân cách. */
  enabled: boolean;
  separator: Separator;
  /** Hiện mọi số của khách (số chính + số phụ), mỗi số một dòng. */
  showAllNumbers: boolean;
}

interface Written {
  /** Nội dung text node trước khi extension chỉnh sửa. */
  raw: string;
  /** Nội dung extension đã ghi vào text node. */
  written: string;
  /** Phần tử cha đã được gắn `data-kvpf-multi` (nếu có). */
  host: Element | null;
}

// "+84" + 10 số = 13 ký tự; "0" + 9 số = 10 ký tự. Lọc nhanh trước khi chạy regex.
const MIN_LEN = 10;
const MAX_LEN = 13;

const MULTI_ATTR = 'data-kvpf-multi';
const STYLE_ID = 'kvpf-style';
// Giữ nguyên text node (framework vẫn sở hữu nó), chỉ đổi cách hiển thị ký tự xuống dòng.
const STYLE_CSS = `[${MULTI_ATTR}]{white-space:pre-line!important;font-size:.85em;line-height:1.35}`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_CSS;
  (document.head ?? document.documentElement).appendChild(style);
}

function setMulti(host: Element | null, on: boolean): void {
  if (!host) return;
  if (on) {
    ensureStyle();
    if (!host.hasAttribute(MULTI_ATTR)) host.setAttribute(MULTI_ATTR, '');
  } else {
    host.removeAttribute(MULTI_ATTR);
  }
}

export function createPhoneFormatter() {
  // Text node không gắn được attribute, nên nhớ số gốc bằng WeakMap.
  const written = new WeakMap<Text, Written>();
  const pending = new Set<Node>();
  let options: FormatterOptions = { enabled: true, separator: 'space', showAllNumbers: true };
  let observer: MutationObserver | null = null;
  let scheduled = false;

  function walk(root: Node, visit: (node: Text) => void): void {
    if (root.nodeType === Node.TEXT_NODE) {
      visit(root as Text);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) visit(n as Text);
  }

  const show = (phone: string): string =>
    options.enabled ? (formatPhone(phone, options.separator) ?? phone) : phone;

  /** Tính nội dung hiển thị mới từ nội dung gốc `base`, hoặc `null` nếu không cần đổi. */
  function compute(node: Text, base: string): { text: string; multi: boolean } | null {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_SELECTOR)) return null;
    const trimmed = base.trim();
    if (!trimmed) return null;

    if (options.showAllNumbers) {
      const attr = parent.getAttribute(PHONES_ATTR);
      if (attr) {
        const phones = extractPhones(attr);
        const first = phones[0];
        // Chỉ tin attribute khi số đang hiển thị đúng là số chính của dòng (tránh dữ liệu cũ khi dòng được tái sử dụng).
        if (phones.length >= 2 && first !== undefined && samePhoneDigits(trimmed, first)) {
          const lines = phones.map(show).join('\n');
          return { text: base.replace(trimmed, () => lines), multi: true };
        }
      }
    }

    if (!options.enabled) return null;
    if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) return null;
    const formatted = formatPhone(trimmed, options.separator);
    if (formatted === null) return null;
    return { text: base.replace(trimmed, () => formatted), multi: false };
  }

  function restore(node: Text): void {
    const record = written.get(node);
    if (!record) return;
    written.delete(node);
    if (node.nodeValue === record.written) node.nodeValue = record.raw;
    setMulti(record.host, false);
  }

  function apply(node: Text): void {
    const record = written.get(node);
    const current = node.nodeValue ?? '';
    const ours = record !== undefined && current === record.written;

    if (record && !ours) {
      // Framework đã ghi đè text node: bỏ bản ghi cũ và xử lý lại từ nội dung mới.
      written.delete(node);
      setMulti(record.host, false);
    }

    const base = ours && record ? record.raw : current;
    const result = compute(node, base);

    if (result === null) {
      if (ours) restore(node);
      return;
    }
    if (ours && result.text === current) return;

    const host = node.parentElement;
    written.set(node, { raw: base, written: result.text, host });
    node.nodeValue = result.text;
    setMulti(host, result.multi);
  }

  function flush(): void {
    scheduled = false;
    if (!options.enabled && !options.showAllNumbers) {
      pending.clear();
      return;
    }
    const nodes = [...pending];
    pending.clear();
    for (const node of nodes) {
      if (node.isConnected) walk(node, apply);
    }
  }

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
    else setTimeout(flush, 16);
  }

  function onMutations(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === 'characterData') {
        const node = record.target as Text;
        const own = written.get(node);
        // Bỏ qua mutation do chính extension tạo ra.
        if (own && node.nodeValue === own.written) continue;
        pending.add(node);
      } else if (record.type === 'attributes') {
        pending.add(record.target); // danh sách số của dòng vừa thay đổi
      } else {
        record.addedNodes.forEach((added) => pending.add(added));
      }
    }
    if (pending.size > 0) schedule();
  }

  /** Áp dụng cấu hình mới cho toàn trang: khôi phục nội dung gốc rồi hiển thị lại theo cấu hình. */
  function configure(next: FormatterOptions): void {
    options = next;
    walk(document.documentElement, restore);
    if (options.enabled || options.showAllNumbers) walk(document.documentElement, apply);
  }

  function start(): void {
    if (observer) return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true, // framework có thể ghi đè nodeValue khi cập nhật binding
      attributes: true,
      attributeFilter: [PHONES_ATTR],
    });
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;
    pending.clear();
    walk(document.documentElement, restore);
  }

  return { configure, start, stop };
}
