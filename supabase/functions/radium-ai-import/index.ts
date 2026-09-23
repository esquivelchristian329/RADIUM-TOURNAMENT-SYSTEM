import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const ALLOWED_ROLES = new Set(["ADMIN", "TOURNAMENT_MANAGER"]);
const MODEL = Deno.env.get("RADIUM_AI_MODEL") || "gpt-5.6-luna";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

async function getRole(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return { userId: null, role: null };
  const token = auth.slice(7).trim();
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return { userId: null, role: null };
  let payload: any;
  try {
    payload = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return { userId: null, role: null };
  }
  const userId = payload?.sub || null;
  if (!userId) return { userId: null, role: null };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("Supabase environment is not configured.");

  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Profile authorization check failed (${res.status}).`);
  const rows = await res.json();
  const role = String(rows?.[0]?.role || "").toUpperCase();
  return { userId, role };
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rowIndex: { type: "integer" },
          fields: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              nickname: { type: "string" },
              sex: { type: "string", enum: ["Male", "Female", ""] },
              birthdate: { type: "string" },
              age: { type: ["number", "null"] },
              weightKg: { type: ["number", "null"] },
              team: { type: "string" },
              coach: { type: "string" },
              contact: { type: "string" },
              email: { type: "string" },
              eventsText: { type: "string" },
              parentGuardianName: { type: "string" },
              parentGuardianContact: { type: "string" },
              consent: { type: "string" },
            },
            required: ["name", "nickname", "sex", "birthdate", "age", "weightKg", "team", "coach", "contact", "email", "eventsText", "parentGuardianName", "parentGuardianContact", "consent"],
          },
          events: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                event: { type: "string", enum: ["Arnis Anyo", "Padded Stick", "Livestick", "Knifepoint", ""] },
                anyoType: { type: "string", enum: ["Individual", "Synchronized", "Mixed", ""] },
                style: { type: "string", enum: ["Traditional", "Non-Traditional", ""] },
                weapon: { type: "string", enum: ["Single Weapon", "Double Weapon", "Espada y Daga", "Any", ""] },
                original: { type: "string" },
                confidence: { type: "number" },
                needsReview: { type: "boolean" },
              },
              required: ["event", "anyoType", "style", "weapon", "original", "confidence", "needsReview"],
            },
          },
          confidence: { type: "number" },
          notes: { type: "string" },
          needsReview: { type: "boolean" },
        },
        required: ["rowIndex", "fields", "events", "confidence", "notes", "needsReview"],
      },
    },
  },
  required: ["rows"],
};

function systemPrompt(categories: any[]) {
  const categoryNames = categories.map((c) => ({
    name: c?.name || "",
    event: c?.event || c?.event_type || "",
    sex: c?.sex || c?.gender || "",
    ageFrom: c?.ageFrom ?? c?.age_min ?? null,
    ageTo: c?.ageTo ?? c?.age_max ?? null,
    weightFrom: c?.weightFrom ?? c?.weight_min ?? null,
    weightTo: c?.weightTo ?? c?.weight_max ?? null,
    anyoType: c?.anyoType ?? c?.division ?? "",
    anyoStyle: c?.anyoStyle ?? c?.style ?? "",
    anyoWeapon: c?.anyoWeapon ?? c?.weapon ?? "",
  }));
  return `You are the RADIUM Tournament System import interpreter. Your job is to understand messy Google Forms response headers and player answers and normalize their meaning. Do not invent facts. Do not decide tournament categories; RADIUM's deterministic rules engine will do that after you normalize the data.

Official event vocabulary:
- Arnis Anyo
- Padded Stick
- Livestick
- Knifepoint

Official Anyo vocabulary:
- Type: Individual, Synchronized, Mixed
- Style: Traditional, Non-Traditional
- Weapon: Single Weapon, Double Weapon, Espada y Daga

Important interpretation rules:
- Treat minor spelling, punctuation, capitalization, spacing, abbreviations, synonyms, and different phrasing as equivalent when the meaning is clear.
- Examples: 'Combative Paddd Stik', 'stick fighting padded', and 'padded stick combat' can mean Padded Stick.
- 'live stick', 'live-stick', 'livestick combat' can mean Livestick.
- 'solo anyo one weapon', 'individual traditional form single weapon', etc. can describe Individual Arnis Anyo.
- Never convert a vague answer such as 'stick combat' into a confident event if multiple official events are plausible; mark needsReview.
- If a field is absent or genuinely unclear, return an empty string or numeric value only when actually present. Do not guess.
- A number embedded in prose may be normalized, e.g. '54 kilos' -> 54 for weightKg.
- Interpret sex words such as boy/boys/man/men/male/M as Male and girl/girls/woman/women/female/F as Female when clearly intended.
- Interpret dates expressed in ordinary formats, but do not invent a date.

Here are the currently configured RADIUM categories. They are reference context only; do not select one in your output:
${JSON.stringify(categoryNames)}`;
}

async function callOpenAI(rows: any[], categories: any[]) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured in the Supabase Edge Function secrets.");

  const input = rows.map((row, i) => ({ rowIndex: i, row }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      instructions: systemPrompt(categories),
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: "radium_import_understanding", strict: true, schema } },
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || `OpenAI request failed (${response.status}).`;
    throw new Error(msg);
  }

  // The REST Responses API returns generated content in `output`; some SDKs
  // expose `output_text` as a convenience property. This Edge Function calls
  // REST directly, so support both representations.
  let text = typeof data?.output_text === "string" ? data.output_text.trim() : "";
  if (!text && Array.isArray(data?.output)) {
    const chunks: string[] = [];
    for (const item of data.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (typeof part?.text === "string") chunks.push(part.text);
        }
      } else if (typeof item?.text === "string") {
        chunks.push(item.text);
      }
    }
    text = chunks.join("").trim();
  }
  if (!text) {
    const refusal = Array.isArray(data?.output) && data.output.some((item: any) =>
      Array.isArray(item?.content) && item.content.some((part: any) => part?.type === "refusal")
    );
    throw new Error(refusal ? "OpenAI refused the import interpretation request." : "OpenAI returned no structured output.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("OpenAI returned structured content that could not be parsed as JSON.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST required" });
  try {
    const auth = await getRole(req);
    if (!auth.userId || !ALLOWED_ROLES.has(auth.role || "")) {
      return json(403, { error: "Admin or Tournament Manager access is required for AI import understanding." });
    }

    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const categories = Array.isArray(body?.categories) ? body.categories : [];
    if (!rows.length) return json(400, { error: "No import rows were provided." });
    if (rows.length > 100) return json(400, { error: "AI import is limited to 100 response rows per request." });

    const result = await callOpenAI(rows, categories);
    return json(200, { model: MODEL, ...result });
  } catch (error) {
    console.error("radium-ai-import", error);
    return json(500, { error: error?.message || String(error) });
  }
});
