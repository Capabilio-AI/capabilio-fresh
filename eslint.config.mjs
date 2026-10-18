import nextConfig from "eslint-config-next";

const config = [{ ignores: [".next/**", ".claude/worktrees/**", "graft/**", ".omc/**", "node_modules/**", "supabase/**", "coverage/**"] }, ...nextConfig];

export default config;
