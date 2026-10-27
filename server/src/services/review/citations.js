export function attachValidCitations(aiFinding, retrieved) {
  const bySource = new Map();
  for (const hit of retrieved || []) {
    bySource.set(String(hit.sourceId), hit);
  }
  const requested = aiFinding.sourceIds || [];
  const refs = [];
  for (const id of requested) {
    const hit = bySource.get(String(id));
    if (!hit) continue;
    refs.push({
      sourceId: String(hit.sourceId),
      sourceName: hit.sourceName || "",
      sourceVersion: hit.sourceVersion || 1,
      section: hit.section || aiFinding.section || "",
      pageNumber: hit.pageNumber || aiFinding.pageNumber,
      quote: (hit.text || "").slice(0, 280),
    });
  }
  const missing = requested.length > 0 && refs.length === 0;
  let issueKind = aiFinding.issueKind || "potential_issue";
  let explanation = aiFinding.explanation;
  if (missing || (requested.length === 0 && aiFinding.category === "unsupported_claims")) {
    issueKind = "needs_verification";
    explanation = `${explanation} Evidence was not attached from retrieved workspace sources. This does not prove the claim is false; an approved source is required.`;
  }
  return {
    ...aiFinding,
    origin: "ai",
    sourceReferences: refs,
    issueKind,
    explanation,
  };
}

export function validateCitationIds(sourceIds, retrieved) {
  const allowed = new Set((retrieved || []).map((h) => String(h.sourceId)));
  return (sourceIds || []).filter((id) => allowed.has(String(id)));
}
