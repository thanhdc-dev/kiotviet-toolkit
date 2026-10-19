import './style.css';
import { browser } from 'wxt/browser';
import { formatPhone, type Separator } from '../../lib/formatPhone';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  watchSettings,
  type Settings,
} from '../../lib/settings';

const SAMPLES = ['0357747884', '0912345678'];
const SEPARATOR_PATTERN = /[ .-]/;

const preview = document.querySelector<HTMLElement>('#preview')!;
const enabledInput = document.querySelector<HTMLInputElement>('#enabled')!;
const showAllInput = document.querySelector<HTMLInputElement>('#showAll')!;
const separators = document.querySelector<HTMLFieldSetElement>('#separators')!;
const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="separator"]')];
const activeStatus = document.querySelector<HTMLElement>('#activeStatus');
const phoneSubOptions = document.querySelector<HTMLElement>('#phoneSubOptions');
const versionBadge = document.querySelector<HTMLElement>('.badge');

if (versionBadge && typeof browser !== 'undefined' && browser.runtime?.getManifest) {
  const version = browser.runtime.getManifest().version;
  if (version) versionBadge.textContent = `v${version}`;
}

// Setup tabs
const tabButtons = [...document.querySelectorAll<HTMLButtonElement>('.tab-btn')];
const tabPanels = [...document.querySelectorAll<HTMLElement>('.tab-panel')];

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    tabPanels.forEach((p) => {
      p.hidden = true;
      p.classList.remove('active');
    });

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const targetId = btn.getAttribute('aria-controls');
    if (targetId) {
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.hidden = false;
        targetPanel.classList.add('active');
      }
    }
  });
});

// Check current tab to update status if on KiotViet
if (typeof browser !== 'undefined' && browser.tabs?.query) {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const activeTab = tabs[0];
    const currentUrl = activeTab?.url ?? '';
    if (activeStatus) {
      const isKiotViet =
        Boolean(currentUrl && (currentUrl.includes('.kiotviet.vn') || currentUrl.includes('//kiotviet.vn')));
      if (isKiotViet) {
        activeStatus.textContent = 'Đang trên KiotViet';
        activeStatus.classList.add('is-active');
      } else {
        activeStatus.textContent = 'Sẵn sàng khi mở KiotViet';
        activeStatus.classList.remove('is-active');
      }
    }
  }).catch(() => {
    // ignore when tabs query is not permitted
  });
}

let state: Settings = DEFAULT_SETTINGS;

function renderPreview(settings: Settings): void {
  const sample = SAMPLES[0] ?? '0357747884';
  const text = (settings.enabled ? formatPhone(sample, settings.separator) : null) ?? sample;
  preview.classList.toggle('off', !settings.enabled);
  preview.replaceChildren(
    ...[...text].map((char) => {
      if (!SEPARATOR_PATTERN.test(char)) return document.createTextNode(char);
      const span = document.createElement('span');
      span.className = 'sep';
      span.textContent = char;
      return span;
    }),
  );
}

function render(settings: Settings): void {
  state = settings;
  enabledInput.checked = settings.enabled;
  showAllInput.checked = settings.showAllNumbers;
  separators.disabled = !settings.enabled;
  if (phoneSubOptions) {
    phoneSubOptions.classList.toggle('is-disabled', !settings.enabled);
  }
  for (const radio of radios) radio.checked = radio.value === settings.separator;
  renderPreview(settings);
}

enabledInput.addEventListener('change', () => {
  render({ ...state, enabled: enabledInput.checked });
  void saveSettings({ enabled: enabledInput.checked });
});

showAllInput.addEventListener('change', () => {
  render({ ...state, showAllNumbers: showAllInput.checked });
  void saveSettings({ showAllNumbers: showAllInput.checked });
});

for (const radio of radios) {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    const separator = radio.value as Separator;
    render({ ...state, separator });
    void saveSettings({ separator });
  });
}

render(state);
void loadSettings().then(render);
watchSettings(render);
