import http from "http";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  maxTokens?: number;
  max_tokens?: number;
  temperature?: number;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const normalizeMessage = (m: Message) => {
  let text = "";
  if (typeof m.content === "string") {
    text = m.content;
  } else if (Array.isArray(m.content)) {
    text = m.content.map((c) => (typeof c === "string" ? c : "text" in c ? c.text : "")).join("\n");
  } else if (typeof m.content === "object" && "text" in m.content) {
    text = (m.content as any).text;
  }
  return {
    role: m.role,
    content: text,
  };
};

/**
 * Invoke vLLM (Gemma 4 AWQ on Port 8100) or local LiteLLM proxy (Port 4000)
 * No OpenAI API key required!
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const messages = params.messages.map(normalizeMessage);
  const maxTokens = params.maxTokens || params.max_tokens || 800;
  const temperature = params.temperature ?? 0.7;

  const payload = JSON.stringify({
    model: "cyankiwi/gemma-4-26B-A4B-it-AWQ-4bit",
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  // Try direct vLLM on Port 8100 first, fallback to LiteLLM on Port 4000
  return new Promise((resolve, reject) => {
    const postToUrl = (port: number, isFallback = false) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 30000,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              if (res.statusCode && res.statusCode >= 400) {
                if (!isFallback && port === 8100) {
                  return postToUrl(4000, true);
                }
                return reject(new Error(`vLLM HTTP ${res.statusCode}: ${body}`));
              }
              const json = JSON.parse(body);
              resolve(json);
            } catch (err: any) {
              if (!isFallback && port === 8100) {
                return postToUrl(4000, true);
              }
              reject(new Error(`Failed to parse vLLM response: ${err.message}`));
            }
          });
        }
      );

      req.on("error", (err) => {
        if (!isFallback && port === 8100) {
          return postToUrl(4000, true);
        }
        reject(new Error(`vLLM Connection Error (Port ${port}): ${err.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        if (!isFallback && port === 8100) {
          return postToUrl(4000, true);
        }
        reject(new Error("vLLM request timed out"));
      });

      req.write(payload);
      req.end();
    };

    postToUrl(8100);
  });
}

