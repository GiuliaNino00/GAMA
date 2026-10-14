/**
 * Fuso orario dell'azienda.
 * Va importato PER PRIMO in ogni punto d'ingresso (server, importazione, comandi):
 * cosi' "oggi", "le 18:00" e "il primo del mese" sono quelli italiani anche se
 * il server e' configurato in UTC.
 */
process.env.TZ = process.env.TZ || 'Europe/Rome';
