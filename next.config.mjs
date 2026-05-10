import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer ships standard PDF font assets (.afm files) that
  // Next.js's server bundler otherwise drops, surfacing at runtime as
  // `Cannot read properties of undefined (reading 'unitsPerEm')` from any
  // render call. Marking the family as external keeps node_modules in the
  // require resolution path at runtime.
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@react-pdf/pdfkit',
    '@react-pdf/font',
    '@react-pdf/layout',
    '@react-pdf/render',
    '@react-pdf/image',
    '@react-pdf/png-js',
    '@react-pdf/textkit',
    '@react-pdf/stylesheet',
    '@react-pdf/primitives',
    '@react-pdf/reconciler',
    '@react-pdf/fns',
    'fontkit',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'oaidalleapiprodscus.blob.core.windows.net' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
