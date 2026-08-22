import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MAX_MESSAGES = 20
const MAX_CONTENT = 4000
const MAX_PER_MINUTE = 8
const MAX_PER_HOUR = 40
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

const hits = new Map<string, number[]>()

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: cors })
}

function rateLimited(userId: string): boolean {
  const now = Date.now()
  const prev = (hits.get(userId) ?? []).filter(t => now - t < HOUR)
  const minute = prev.filter(t => now - t < MINUTE)
  if (minute.length >= MAX_PER_MINUTE || prev.length >= MAX_PER_HOUR) {
    hits.set(userId, prev)
    return true
  }
  prev.push(now)
  hits.set(userId, prev)
  return false
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Not logged in" }, 401)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return json({ error: "Not logged in" }, 401)
    }

    const key = Deno.env.get("OPENAI_API_KEY")
    if (!key) {
      return json({ error: "AI tutor is not configured." }, 503)
    }

    if (rateLimited(userData.user.id)) {
      return json({ error: "Too many requests. Try again later." }, 429)
    }

    const { messages } = (await req.json()) as {
      messages?: { role?: string; content?: string }[]
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "Invalid messages" }, 400)
    }

    const history = messages.slice(-MAX_MESSAGES).map(m => ({
      role: m.role === "assistant" || m.role === "user" ? m.role : "user" as const,
      content: typeof m.content === "string" ? m.content.slice(0, MAX_CONTENT) : "",
    })).filter(m => m.content.length > 0)

    if (!history.length) {
      return json({ error: "Invalid messages" }, 400)
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "You are LearnSyra's AI tutor. Be clear, concise, and practical. Prefer short explanations, quizzes, and project ideas. Do not invent course grades.",
          },
          ...history,
        ],
      }),
    })

    if (!res.ok) {
      return json({ error: "AI tutor is unavailable right now." }, 502)
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content
    if (typeof reply !== "string" || !reply.trim()) {
      return json({ error: "AI tutor is unavailable right now." }, 502)
    }

    return json({ reply, source: "openai" })
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "AI failed" },
      400,
    )
  }
})
