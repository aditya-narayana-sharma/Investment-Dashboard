import crypto from "node:crypto";
import { Config } from "./config.js";
import { KiteMcpError } from "./errors.js";
import { Logger, maskSecret } from "./logger.js";
import { RateLimiter } from "./rate-limit.js";

export type Credentials = {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
};

export type RequestOptions = {
  query?: Record<string, string | number | boolean | Array<string | number>>;
  form?: Record<string, unknown>;
  auth?: boolean;
  rawText?: boolean;
};

export class KiteClient {
  private credentials: Credentials;
  private readonly limiter: RateLimiter;

  constructor(
    private readonly config: Config,
    private readonly logger: Logger
  ) {
    this.credentials = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      accessToken: config.accessToken
    };
    this.limiter = new RateLimiter(config.rateLimitRps);
  }

  setCredentials(credentials: Credentials) {
    this.credentials = { ...this.credentials, ...credentials };
    this.logger.info("updated Kite credentials", {
      apiKey: maskSecret(this.credentials.apiKey),
      accessToken: maskSecret(this.credentials.accessToken),
      hasApiSecret: Boolean(this.credentials.apiSecret)
    });
  }

  clearCredentials() {
    this.credentials = {};
    this.logger.info("cleared Kite credentials");
  }

  getCredentialStatus() {
    return {
      api_key: maskSecret(this.credentials.apiKey),
      access_token: maskSecret(this.credentials.accessToken),
      has_api_secret: Boolean(this.credentials.apiSecret),
      authenticated: Boolean(this.credentials.apiKey && this.credentials.accessToken)
    };
  }

  loginUrl(apiKey = this.credentials.apiKey, redirectParams?: Record<string, string>) {
    if (!apiKey) throw this.configError("build login URL", "Set KITE_API_KEY or pass api_key.");
    const url = new URL("https://kite.zerodha.com/connect/login");
    url.searchParams.set("v", "3");
    url.searchParams.set("api_key", apiKey);
    if (redirectParams && Object.keys(redirectParams).length > 0) {
      url.searchParams.set("redirect_params", new URLSearchParams(redirectParams).toString());
    }
    return url.toString();
  }

  async generateSession(input: { requestToken: string; apiKey?: string; apiSecret?: string }) {
    const apiKey = input.apiKey ?? this.credentials.apiKey;
    const apiSecret = input.apiSecret ?? this.credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      throw this.configError("generate session", "Set KITE_API_KEY and KITE_API_SECRET, or pass both fields.");
    }
    const checksum = crypto.createHash("sha256").update(apiKey + input.requestToken + apiSecret).digest("hex");
    const response = await this.request("POST", "/session/token", {
      auth: false,
      form: {
        api_key: apiKey,
        request_token: input.requestToken,
        checksum
      }
    });
    const data = response as Record<string, unknown>;
    const accessToken = typeof data.access_token === "string" ? data.access_token : undefined;
    if (accessToken) this.setCredentials({ apiKey, apiSecret, accessToken });
    return response;
  }

  async logout() {
    const apiKey = this.credentials.apiKey;
    const accessToken = this.credentials.accessToken;
    if (!apiKey || !accessToken) {
      throw this.configError("logout", "Set KITE_API_KEY and KITE_ACCESS_TOKEN first.");
    }
    const result = await this.request("DELETE", "/session/token", {
      auth: false,
      query: { api_key: apiKey, access_token: accessToken }
    });
    this.clearCredentials();
    return result;
  }

  async request(method: string, path: string, options: RequestOptions = {}): Promise<unknown> {
    const operation = `${method} ${path}`;
    const url = new URL(path, this.config.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      "X-Kite-Version": "3",
      "User-Agent": "kite-connect-mcp-server/0.1.0"
    };
    let body: BodyInit | undefined;
    if (options.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = encodeForm(options.form);
    }
    if (options.auth !== false) {
      const { apiKey, accessToken } = this.credentials;
      if (!apiKey || !accessToken) {
        throw this.configError(operation, "Set KITE_API_KEY and KITE_ACCESS_TOKEN, or call kite_auth_set_access_token.");
      }
      headers.Authorization = `token ${apiKey}:${accessToken}`;
    }

    await this.limiter.wait();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    this.logger.debug("kite request", { operation, url: url.pathname });
    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal });
      const text = await response.text();
      if (options.rawText && response.ok) return text;
      const json = parseJson(text, operation);
      if (!response.ok || isKiteError(json)) {
        throw providerError(operation, response.status, json);
      }
      return (json as { data?: unknown }).data ?? json;
    } catch (error) {
      if (error instanceof KiteMcpError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new KiteMcpError(`Kite request timed out while calling ${operation}`, {
          operation,
          retryable: true,
          nextStep: "Retry later or increase KITE_REQUEST_TIMEOUT_MS."
        });
      }
      throw new KiteMcpError(`Kite request failed while calling ${operation}: ${String(error)}`, {
        operation,
        retryable: true,
        nextStep: "Check network connectivity and Kite API availability."
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private configError(operation: string, nextStep: string) {
    return new KiteMcpError(`Kite credentials are not configured for ${operation}`, {
      operation,
      retryable: false,
      nextStep
    });
  }
}

function encodeForm(form: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value === undefined || value === null) continue;
    params.set(key, typeof value === "string" ? value : String(value));
  }
  return params;
}

function parseJson(text: string, operation: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new KiteMcpError(`Kite returned a non-JSON response for ${operation}`, {
      operation,
      retryable: false,
      nextStep: "Inspect the endpoint, credentials, and Kite API status."
    });
  }
}

function isKiteError(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { status?: string }).status === "error");
}

function providerError(operation: string, status: number, value: unknown): KiteMcpError {
  const payload = value as { message?: string; error_type?: string };
  const retryable = status === 429 || status >= 500;
  const nextStep =
    status === 403 || status === 401
      ? "Refresh the daily access token and ensure the API key matches it."
      : status === 429
        ? "Slow down requests or lower KITE_RATE_LIMIT_RPS."
        : retryable
          ? "Retry after a short delay."
          : "Check the request parameters against Kite Connect docs.";
  return new KiteMcpError(`Kite API error during ${operation}: ${payload.message ?? "unknown error"}`, {
    operation,
    status,
    code: payload.error_type,
    retryable,
    nextStep
  });
}
