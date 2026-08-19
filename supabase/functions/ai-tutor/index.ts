import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function fallback(question: string) {
  const q = question.toLowerCase()
  if (q.includes("quiz")) {
    return `Quick check on "${question}":\n1) What is the core idea in one sentence?\n2) Where would you use it in a real project?\n3) What mistake do beginners make?`
  }
  if (q.includes("project")) {
    return `Project idea for "${question}": build a small app with a list, detail, and form screen, then submit the GitHub link from Projects.`
  }
  if (q.includes("interview")) {
    return `Interview angle: explain "${question}" with a definition, a real example, a trade-off, and one follow-up you would ask.`
  }
  return `Student-friendly take on "${question}": (1) what it is, (2) why it matters, (3) one example, (4) one practice step. Add an OPENAI_API_KEY secret on the server for live GPT replies.`
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { messages } = (await req.json()) as {
      messages?: { role: string; content: string }[]
    }
    const history = messages ?? []
    const lastUser = [...history].reverse().find(m => m.role === "user")?.content ?? ""
    const key = Deno.env.get("OPENAI_API_KEY")

    if (!key) {
      return Response.json(
        { reply: fallback(lastUser), source: "fallback" },
        { headers: { ...cors, "Content-Type": "application/json" } },
      )
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
          ...history.map(m => ({
            role: m.role === "assistant" || m.role === "user" ? m.role : "user",
            content: m.content,
          })),
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return Response.json(
        { reply: fallback(lastUser), source: "fallback", error: err.slice(0, 200) },
        { headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? fallback(lastUser)
    return Response.json(
      { reply, source: "openai" },
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    )
  }
})
