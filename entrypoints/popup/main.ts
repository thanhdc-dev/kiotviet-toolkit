import './style.css';
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

let state: Settings = DEFAULT_SETTINGS;

function renderPreview(settings: Settings): void {
  const samples = settings.showAllNumbers ? SAMPLES : SAMPLES.slice(0, 1);
  const text = samples
    .map((sample) => (settings.enabled ? (formatPhone(sample, settings.separator) ?? sample) : sample))
    .join('\n');
  preview.classList.toggle('off', !settings.enabled);
  preview.replaceChildren(
    ...[...text].map((char) => {
      if (char === '\n' || !SEPARATOR_PATTERN.test(char)) return document.createTextNode(char);
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
