import { createScopeReader } from '../lib/scopeReader';

// Chạy trong MAIN world để đọc được scope của AngularJS (không dùng được API của extension ở đây).
export default defineContentScript({
  matches: ['https://*.kiotviet.vn/*'],
  runAt: 'document_idle',
  allFrames: true,
  world: 'MAIN',
  main() {
    createScopeReader().start();
  },
});
