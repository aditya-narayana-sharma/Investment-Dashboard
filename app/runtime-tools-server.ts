import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RuntimeToolStatus = {
  id: "python" | "node" | "npm" | "yfinance";
  label: string;
  status: "detected" | "unknown";
  path: string;
  detail: string;
};

async function which(command: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("/usr/bin/which", [command], { timeout: 4000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function pythonImportPath(pythonBin: string, moduleName: string): Promise<string> {
  if (!pythonBin) return "";
  try {
    const { stdout } = await execFileAsync(pythonBin, ["-c", `import ${moduleName}; print(getattr(${moduleName}, "__file__", ""))`], {
      timeout: 8000,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

function tool(
  id: RuntimeToolStatus["id"],
  label: string,
  path: string,
  detailWhenMissing: string,
): RuntimeToolStatus {
  if (!path) {
    return { id, label, status: "unknown", path: "", detail: detailWhenMissing };
  }
  return { id, label, status: "detected", path, detail: path };
}

export async function detectRuntimeTools(): Promise<RuntimeToolStatus[]> {
  const python = (await which("python3")) || (await which("python"));
  const node = await which("node");
  const npm = await which("npm");
  const yfinance = await pythonImportPath(python, "yfinance");
  return [
    tool("python", "Python", python, "python3 not on PATH — status unknown, not connected."),
    tool("node", "Node.js", node, "node not on PATH — status unknown, not connected."),
    tool("npm", "npm", npm, "npm not on PATH — status unknown, not connected."),
    tool("yfinance", "yfinance", yfinance, python
      ? "Python is present; yfinance import failed. Sector snapshots stay stale until the package is installed."
      : "yfinance status unknown until Python is detected."),
  ];
}
