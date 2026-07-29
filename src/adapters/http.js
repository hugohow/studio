// User-Agent commun à tous les adaptateurs : identifiable et honnête (lecture seule).
// ⚠️ Nécessaire : depuis le 26/06/2026, l'API Studio Bleu répond 429 aux UA de bots par
// défaut ("node", "python-requests", …). Un UA explicite passe sans limite de volume.
export const USER_AGENT = "studio-slots-bot/1.0 (feed de disponibilite, lecture seule)";
