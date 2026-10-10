import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'KiotViet Toolkit',
    description:
      'Bộ công cụ & tiện ích mở rộng đa năng hỗ trợ tối ưu hiển thị và thao tác trên KiotViet.',
    permissions: ['storage'],
    host_permissions: ['https://*.kiotviet.vn/*'],
    commands: {
      open_popup: {
        suggested_key: {
          default: 'Ctrl+Shift+K',
          mac: 'Command+Shift+K',
        },
        description: 'Mở nhanh KiotViet Toolkit popup',
      },
    },
  },
});
