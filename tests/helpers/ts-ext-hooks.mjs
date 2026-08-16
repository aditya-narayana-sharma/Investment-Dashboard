/** Resolves extensionless relative TS imports used by the app bundler. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    if (/\.(?:[cm]?[jt]s|json)$/.test(specifier)) throw error;
    if (!(specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:"))) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}
