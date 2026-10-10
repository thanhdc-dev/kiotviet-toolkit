import { loadSettings, watchSettings } from '../lib/settings';
import { createPhoneFormatter } from '../lib/walker';

export default defineContentScript({
  matches: ['https://*.kiotviet.vn/*'],
  runAt: 'document_idle',
  allFrames: true,
  async main() {
    const formatter = createPhoneFormatter();
    formatter.start();
    formatter.configure(await loadSettings());
    watchSettings((settings) => formatter.configure(settings));
  },
});
