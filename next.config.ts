import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const nextConfig: NextConfig = { experimental: { serverActions: { bodySizeLimit: '5mb' } } }; // 4 MB résumé (RESUME_MAX_BYTES) + multipart overhead

export default withNextIntl(nextConfig);
