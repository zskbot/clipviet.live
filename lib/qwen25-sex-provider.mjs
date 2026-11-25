const MODEL_ID = "ystemsrx/Qwen2.5-Sex";
const MODEL_CARD_URL = "https://huggingface.co/ystemsrx/Qwen2.5-Sex";

export function getQwen25SexProviderStatus(env = process.env) {
  const enabled = env.QWEN25_SEX_ENABLED === "true";
  const endpoint = env.QWEN25_SEX_API_URL || "";
  const hasKey = Boolean(env.QWEN25_SEX_API_KEY);
  let endpointValid = false;

  if (endpoint) {
    try {
      endpointValid = new URL(endpoint).protocol === "https:";
    } catch {
      endpointValid = false;
    }
  }

  const configured = enabled && endpointValid && hasKey;

  return {
    id: "qwen25-sex",
    model: MODEL_ID,
    modelCard: MODEL_CARD_URL,
    enabled: configured,
    configured,
    status: configured ? "configured" : "disabled",
    capabilities: ["metadata-assistance-review", "content-risk-review"],
    generationEnabled: false,
    requiresHumanReview: true,
    reason: configured ? null : "Provider is disabled or missing a valid HTTPS endpoint/API key.",
  };
}
