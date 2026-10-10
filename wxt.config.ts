import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'KiotViet – Định dạng số điện thoại',
    description:
      'Hiển thị số điện thoại có phân cách (0357 747 884) trên mọi màn hình KiotViet để dễ đọc.',
    permissions: ['storage'],
  },
});
