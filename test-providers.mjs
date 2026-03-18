#!/usr/bin/env node
// Usage:
//   ZAI_KEY=...  node test-providers.mjs zai
//   ANTHROPIC_KEY=... node test-providers.mjs anthropic
//   OPENAI_KEY=... node test-providers.mjs openai

const SYSTEM = `You are an expert at creating McKinsey-style MECE (Mutually Exclusive, Collectively Exhaustive) reports from video transcripts.
Your task is to transform video transcripts into highly structured, executive-level notes.
Use hyphens (-) for ALL bullet points. Use ## for main sections, ### for subsections.`;

const TRANSCRIPT = `
Today we're going to talk about how Redis works under the hood. Redis is an in-memory data store,
which means all your data lives in RAM. This makes it incredibly fast — we're talking sub-millisecond
response times. But there's a tradeoff: your dataset is limited by available memory.

Redis is single-threaded for command processing. This sounds like a limitation but it's actually
a feature — it eliminates lock contention and makes reasoning about consistency trivial. One command
at a time, always. In benchmarks, a single Redis instance can handle about 100,000 operations per second
on commodity hardware.

For persistence, Redis gives you two options. RDB snapshots — Redis forks the process and writes a
point-in-time snapshot to disk. This is fast and compact but you can lose up to the last snapshot
interval of data, typically 5 minutes. AOF, Append Only File, logs every write operation. You can
configure fsync to happen every second or on every write. Every-second fsync gives you at most
1 second of potential data loss with about a 10% performance overhead. Every-write fsync is safe
but cuts throughput by roughly 50%.

Redis data structures are the real power. Strings for simple key-value. Lists implemented as linked
lists for push/pop from both ends — great for queues and stacks. Hashes store field-value pairs,
perfect for representing objects. Sets give you unique collections with O(1) add, remove, and lookup.
Sorted sets add a score to each member, enabling range queries — the backbone of leaderboards and
time-series data.

For scaling, Redis Cluster shards data across 16,384 hash slots. Each master node owns a range of
slots and can have replica nodes for failover. The client is responsible for routing to the right node.
Latency spikes during failover are typically under 30 seconds with automatic leader election.
`;

async function callZAI(key, thinking) {
  const res = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: "glm-5",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Generate MECE notes from this transcript:\n\n${TRANSCRIPT}` },
      ],
      max_tokens: thinking ? 16000 : 4096, // extra headroom for thinking tokens
      thinking: { type: thinking ? "enabled" : "disabled" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${data?.error?.message || JSON.stringify(data)}`);
  return data;
}

async function callAnthropic(key) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: `Generate MECE notes from this transcript:\n\n${TRANSCRIPT}` }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${data?.error?.message || JSON.stringify(data)}`);
  return data;
}

async function callOpenAI(key) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Generate MECE notes from this transcript:\n\n${TRANSCRIPT}` },
      ],
      max_tokens: 4096,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${data?.error?.message || JSON.stringify(data)}`);
  return data;
}

function printDivider(label) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(label);
  console.log("─".repeat(60));
}

function printUsage(usage) {
  console.log(`\nTokens — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`);
}

const target = process.argv[2] || "zai";

if (target === "zai") {
  const key = process.env.ZAI_KEY;
  if (!key) { console.error("ZAI_KEY not set"); process.exit(1); }

  printDivider("GLM-5  thinking=OFF");
  try {
    const d = await callZAI(key, false);
    const msg = d.choices[0].message;
    console.log(msg.content || "(empty content)");
    printUsage(d.usage);
  } catch (e) { console.error("❌", e.message); }

  printDivider("GLM-5  thinking=ON  (max_tokens=16000)");
  try {
    const d = await callZAI(key, true);
    const msg = d.choices[0].message;
    console.log("── thinking preview (first 300 chars) ──");
    console.log((msg.reasoning_content || "").slice(0, 300) + "...");
    console.log("\n── final answer ──");
    console.log(msg.content || "(empty — thinking used all tokens)");
    printUsage(d.usage);
  } catch (e) { console.error("❌", e.message); }

} else if (target === "anthropic") {
  const key = process.env.ANTHROPIC_KEY;
  if (!key) { console.error("ANTHROPIC_KEY not set"); process.exit(1); }
  printDivider("Claude Haiku 4.5");
  try {
    const d = await callAnthropic(key);
    console.log(d.content[0].text);
    printUsage(d.usage);
  } catch (e) { console.error("❌", e.message); }

} else if (target === "openai") {
  const key = process.env.OPENAI_KEY;
  if (!key) { console.error("OPENAI_KEY not set"); process.exit(1); }
  printDivider("GPT-5 Mini");
  try {
    const d = await callOpenAI(key);
    console.log(d.choices[0].message.content);
    printUsage(d.usage);
  } catch (e) { console.error("❌", e.message); }
}
