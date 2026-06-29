import "../lib/engine/load-env";

import { classifyBatch, type Niche } from "../lib/engine/classifier";

/**
 * Offline evaluation harness for the niche classifier. Runs a labeled set
 * through Groq and reports accuracy, latency and failure rate. No paid tooling.
 * Usage: npm run eval:classifier
 */
const SAMPLES: { title: string; expected: Niche }[] = [
  { title: "ساعة يد رجالية فاخرة جلد", expected: "Men's Fashion" },
  { title: "قلادة ذهبية نسائية مرصعة", expected: "Women's Jewelry" },
  { title: "كريم تفتيح وترطيب البشرة", expected: "Beauty & Cosmetics" },
  { title: "حامل هاتف مغناطيسي للسيارة", expected: "Automotive Accessories" },
  { title: "لعبة سيارة تحكم عن بعد للأطفال", expected: "Toys & Games" },
  { title: "آلة تحضير القهوة الإسبريسو", expected: "Kitchen Gadgets" },
  { title: "سماعات بلوتوث لاسلكية", expected: "Electronics & Gadgets" },
  { title: "Robe de soirée élégante femme", expected: "Women's Fashion" },
  { title: "حذاء رياضي رجالي", expected: "Men's Fashion" },
  { title: "مكنسة كهربائية روبوت ذكية", expected: "Home & Decor" },
];

async function main() {
  const hasKey =
    !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "placeholder";
  if (!hasKey) {
    console.log("[eval] GROQ_API_KEY not set — predictions will be 'Uncategorized'.");
  }

  const start = Date.now();
  let predicted: Niche[] = [];
  let failed = false;
  try {
    predicted = await classifyBatch(SAMPLES.map((s) => ({ title: s.title })));
  } catch (err) {
    failed = true;
    console.error("[eval] classification failed:", (err as Error).message);
  }
  const latencyMs = Date.now() - start;

  let correct = 0;
  SAMPLES.forEach((s, i) => {
    const got = predicted[i] ?? "Uncategorized";
    const ok = got === s.expected;
    if (ok) correct += 1;
    console.log(`${ok ? "✓" : "✗"} "${s.title}" → ${got} (expected ${s.expected})`);
  });

  const accuracy = (correct / SAMPLES.length) * 100;
  console.log(
    `\n[eval] accuracy=${accuracy.toFixed(1)}% (${correct}/${SAMPLES.length}) ` +
      `latency=${latencyMs}ms failureRate=${failed ? 100 : 0}%`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
