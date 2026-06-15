import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://192.168.50.78:8000/api/:path*/',
            },
        ];
    },
};

export default nextConfig;