// Protocol tests must never inherit live model credentials from Windows or CI.
for (const name of ["FREE_API_KEY", "FREE_API_KEY_2", "FREE_API_KEY_3", "FREE_API_KEY_4", "DEEPSEEK_API_KEY"]) {
  process.env[name] = "";
}
