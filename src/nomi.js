/**
 * Nomi dei dipendenti: come si scrivono e come compaiono sul foglio.
 */

/**
 * Ripulisce un nome scritto a mano e lo rifiuta se non sembra un nome:
 * maiuscolo, spazi singoli, solo lettere (accenti compresi), apostrofi,
 * punti e trattini, almeno due parole. Restituisce '' se non va.
 */
export function nomePulito(grezzo) {
  const t = String(grezzo || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (t.length < 4 || t.length > 60) return '';
  if (!/^[A-ZÀ-ÖØ-Ý' .-]+$/.test(t)) return '';
  if (t.split(' ').filter(Boolean).length < 2) return '';
  return t;
}

/**
 * Dalla forma lunga a quella del foglio: "ROSSI MARIO" -> "ROSSI M.".
 * Se la forma breve e' gia' presa (fratelli, omonimi) si tiene il nome intero,
 * come fate gia' con ACQUAVIVA MARIO e ACQUAVIVA MARCO.
 */
export function nomeBreve(completo, nomiPresi) {
  const pezzi = completo.split(' ');
  const cognome = pezzi.slice(0, -1).join(' ');
  const nome = pezzi[pezzi.length - 1];
  const breve = cognome + ' ' + nome.charAt(0) + '.';
  const presi = new Set((nomiPresi || []).map((n) => String(n).toUpperCase()));
  return presi.has(breve.toUpperCase()) ? completo : breve;
}

/** Nome di un utente dell'app (socio o amministratore): libero ma pulito. */
export function nomeUtente(grezzo) {
  const t = String(grezzo || '').trim().replace(/\s+/g, ' ');
  if (t.length < 2 || t.length > 40) return '';
  if (/[<>"&]/.test(t)) return '';
  return t;
}
