/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      // Required for DuckDB WASM to work in the browser
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      };
    }

    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'duckdb',
        'pdf-parse',
        '@duckdb/duckdb-wasm', // keep WASM bundle out of server bundle
      ];
    }

    return config;
  },
};

export default nextConfig;