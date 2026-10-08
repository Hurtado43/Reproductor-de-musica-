import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Raíz explícita: hay un package-lock.json ajeno en el directorio personal del
  // usuario y, sin esto, Next.js tiene que adivinar la raíz del proyecto.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
