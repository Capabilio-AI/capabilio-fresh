import nextConfig from "eslint-config-next";

const config = [{ ignores: [".next/**", "node_modules/**", "supabase/**", "coverage/**"] }, ...nextConfig];

export default config;
