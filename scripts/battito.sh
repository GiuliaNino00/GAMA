#!/usr/bin/env bash
# PRESENZE GAMA — Battito
# ---------------------------------------------------------------------------
# Ogni 5 minuti (timer systemd) guarda l'app COME LA VEDE UN TELEFONO DA FUORI:
#   1. cerca il nome di URL_PUBBLICO in un DNS pubblico (non in quello del server,
#      che con Tailscale trova se stesso anche quando da fuori il nome non esiste);
#   2. chiede /salute a quell'indirizzo: risponde ok solo se app e database vanno.
# Se va tutto bene manda il battito a BATTITO_URL (un controllo di healthchecks.io).
# Se no manda BATTITO_URL/fail con il motivo: l'avviso parte subito.
# Se il server e' spento o senza internet il battito non arriva proprio, e
# healthchecks.io avvisa da solo allo scadere dell'attesa. Gli avvisi li gira su ntfy.
#
# Legge URL_PUBBLICO e BATTITO_URL dall'ambiente (il servizio usa il file .env).

set -u

URL="${URL_PUBBLICO:-}"
NOME="${URL#https://}"; NOME="${NOME%%/*}"
if [ -z "${BATTITO_URL:-}" ] || [ "$URL" = "$NOME" ] || [ -z "$NOME" ]; then
  echo "Mancano BATTITO_URL o URL_PUBBLICO (https://...) nel file .env" >&2
  exit 2
fi

# Una prova completa. Scrive il problema su stdout, niente se va tutto bene.
prova() {
  local ip="" dns risposta
  for dns in 8.8.8.8 9.9.9.9; do
    ip=$(dig +short +time=3 +tries=1 A "$NOME" @"$dns" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)
    [ -n "$ip" ] && break
  done
  if [ -z "$ip" ]; then
    echo "il nome $NOME non si trova nel DNS pubblico: da fuori l'app non e' raggiungibile (Funnel da ripubblicare?)"
    return
  fi
  risposta=$(curl -sS -m 15 --resolve "$NOME:443:$ip" "https://$NOME/salute" 2>&1)
  case "$risposta" in
    *'"ok":true'*) ;;
    *) echo "il nome c'e' ($ip) ma l'app da fuori non risponde bene: ${risposta:0:200}" ;;
  esac
}

# Un intoppo di pochi secondi non e' un guasto: prima di dare l'allarme si riprova.
problema=""
for tentativo in 1 2 3; do
  problema=$(prova)
  [ -z "$problema" ] && break
  [ "$tentativo" -lt 3 ] && sleep 20
done

if [ -z "$problema" ]; then
  curl -fsS -m 10 --retry 3 -o /dev/null "$BATTITO_URL" || echo "Battito non consegnato (internet?)" >&2
  exit 0
fi

echo "Problema: $problema" >&2
curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$problema" "$BATTITO_URL/fail" || echo "Allarme non consegnato (internet?)" >&2
exit 1
