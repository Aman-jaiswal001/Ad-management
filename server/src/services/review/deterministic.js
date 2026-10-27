import { escapeRegex } from "../../utils/text.js";
import { HIGH_RISK_SEVERITIES } from "../../config/constants.js";

const ABSOLUTE_PHRASES = [
  "100% secure",
  "100 percent secure",
  "completely secure",
  "guaranteed",
  "never fails",
  "risk-free",
  "always works",
  "zero risk",
  "unhackable",
];

export function runDeterministicChecks({
  content,
  terminology = [],
  claims = [],
  rules = [],
  requiredDisclaimers = [],
  now = new Date(),
}) {
  const findings = [];
  const text = content || "";

  for (const term of terminology) {
    for (const variant of term.prohibitedVariants || []) {
      if (!variant) continue;
      const matches = findMatches(text, variant);
      for (const matchedText of matches) {
        findings.push({
          category: "inconsistent_terminology",
          severity: "High",
          title: `Discouraged term "${variant}"`,
          matchedText,
          explanation: term.explanation || `"${variant}" is not the official term.`,
          suggestedCorrection: term.suggestedReplacement || term.officialTerm,
          confidence: 0.99,
          requiresHumanReview: false,
          issueKind: "confirmed_rule_violation",
          origin: "deterministic",
          sourceReferences: [],
        });
      }
    }
  }

  for (const claim of claims) {
    const expired = claim.expiresAt && new Date(claim.expiresAt) < now;
    if (expired) {
      const snippet = (claim.claimText || "").slice(0, 80);
      if (snippet && text.toLowerCase().includes(snippet.toLowerCase().slice(0, 40))) {
        findings.push({
          category: "outdated_facts",
          severity: "High",
          title: "Expired approved claim used in content",
          matchedText: snippet,
          explanation: "This claim is past its expiry/review date and must not be used as current evidence.",
          suggestedCorrection: "Remove or replace with a currently approved claim.",
          confidence: 0.95,
          requiresHumanReview: true,
          issueKind: "confirmed_rule_violation",
          origin: "deterministic",
          sourceReferences: claim.source
            ? [{ sourceId: String(claim.source), sourceName: "Approved claim source", sourceVersion: 1 }]
            : [],
        });
      }
    }
  }

  for (const rule of rules) {
    for (const phrase of rule.exactPhrases || []) {
      if (!phrase) continue;
      const matches = findMatches(text, phrase);
      for (const matchedText of matches) {
        const severity = rule.severity || "Medium";
        findings.push({
          category: rule.category || "brand_rule_violation",
          severity,
          title: rule.title,
          matchedText,
          explanation: rule.ruleText || rule.description,
          suggestedCorrection: "Revise or remove the prohibited phrasing.",
          confidence: 0.98,
          requiresHumanReview: HIGH_RISK_SEVERITIES.includes(severity),
          issueKind: "confirmed_rule_violation",
          origin: "deterministic",
          sourceReferences: rule.source
            ? [
                {
                  sourceId: String(rule.source),
                  sourceName: "Brand rule source",
                  sourceVersion: rule.sourceVersion || 1,
                },
              ]
            : [],
        });
      }
    }
  }

  for (const phrase of ABSOLUTE_PHRASES) {
    const matches = findMatches(text, phrase);
    for (const matchedText of matches) {
      findings.push({
        category: "absolute_exaggerated_claims",
        severity: "Critical",
        title: `Absolute claim: "${phrase}"`,
        matchedText,
        explanation:
          "Absolute security or performance claims require specific approval and supporting evidence.",
        suggestedCorrection: "Qualify the claim and cite an approved fact, or remove the absolute language.",
        confidence: 0.97,
        requiresHumanReview: true,
        issueKind: "confirmed_rule_violation",
        origin: "deterministic",
        sourceReferences: [],
      });
    }
  }

  for (const disclaimer of requiredDisclaimers) {
    if (!disclaimer) continue;
    if (!text.toLowerCase().includes(disclaimer.toLowerCase())) {
      findings.push({
        category: "missing_disclaimers",
        severity: "Medium",
        title: "Missing required disclaimer",
        matchedText: "",
        explanation: `Configured disclaimer was not found: "${disclaimer}".`,
        suggestedCorrection: `Add the required disclaimer: ${disclaimer}`,
        confidence: 0.9,
        requiresHumanReview: false,
        issueKind: "confirmed_rule_violation",
        origin: "deterministic",
        sourceReferences: [],
      });
    }
  }

  return dedupeFindings(findings);
}

export function findMatches(text, phrase) {
  if (!text || !phrase) return [];
  const re = new RegExp(escapeRegex(phrase), "gi");
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

export function dedupeFindings(findings) {
  const seen = new Set();
  const out = [];
  for (const f of findings) {
    const key = `${f.category}|${(f.matchedText || "").toLowerCase()}|${(f.title || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function mergeFindings(deterministic, ai) {
  return dedupeFindings([...(deterministic || []), ...(ai || [])]);
}

export function generateRetrievalQueries({ content, terminology, rules, claims }) {
  const queries = [];
  queries.push(content.slice(0, 1500));
  for (const t of terminology.slice(0, 8)) {
    queries.push(`${t.officialTerm} ${(t.prohibitedVariants || []).join(" ")} ${t.explanation || ""}`);
  }
  for (const r of rules.slice(0, 8)) {
    queries.push(`${r.title} ${r.ruleText}`);
  }
  for (const c of claims.slice(0, 8)) {
    queries.push(c.claimText);
  }
  const promo = content.match(
    /\b(best|fastest|#1|number one|guaranteed|secure|instant|unlimited|always)\b/gi
  );
  if (promo?.length) {
    queries.push(`promotional claims ${promo.slice(0, 6).join(" ")}`);
  }
  return [...new Set(queries.filter((q) => q && q.trim()))].slice(0, 6);
}
