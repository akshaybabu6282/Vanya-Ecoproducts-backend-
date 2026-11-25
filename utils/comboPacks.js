const NAME_ALIASES = {
  "corriander powder": "coriander powder",
  "corriander": "coriander",
  "sambar powder": "sambar masala",
};

export function normalizeProductName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function applyAliases(normalized) {
  if (!normalized) return "";
  if (NAME_ALIASES[normalized]) return NAME_ALIASES[normalized];
  return normalized.replace(/\bcorriander\b/g, "coriander");
}

export function isComboProduct(product) {
  const name = normalizeProductName(product?.name);
  return name.includes("value pack") || name.includes("combo pack");
}

export function parseIncludedProductNames(description) {
  return String(description || "")
    .split(/[\r\n]+/)
    .map((line) => line.replace(/^[\s\-•*\d.)]+/, "").trim())
    .filter((line) => {
      const lowered = line.toLowerCase();
      return line && lowered !== "undefined" && lowered !== "null";
    });
}

function coreName(normalized) {
  return applyAliases(normalized)
    .replace(/\b(powder|masala)\b/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchListedProduct(products, listedName) {
  const listedNorm = applyAliases(normalizeProductName(listedName));
  if (!listedNorm) return null;

  const candidates = (products || []).filter((product) => !isComboProduct(product));

  const exact = candidates.find(
    (product) => applyAliases(normalizeProductName(product.name)) === listedNorm
  );
  if (exact) return exact;

  const listedCore = coreName(listedNorm);
  if (!listedCore) return null;

  const byCore = candidates.filter(
    (product) => coreName(normalizeProductName(product.name)) === listedCore
  );
  if (byCore.length === 1) return byCore[0];

  return (
    byCore.find(
      (product) =>
        applyAliases(normalizeProductName(product.name)).split(" ").length ===
        listedNorm.split(" ").length
    ) || null
  );
}

export function comboContentsFrom(item, product) {
  const fromItem = parseIncludedProductNames(item?.mainDescription);
  if (fromItem.length >= 2) return fromItem;
  return parseIncludedProductNames(product?.mainDescription);
}
