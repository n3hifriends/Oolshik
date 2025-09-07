export const normalize = (v?: unknown) =>
  (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
