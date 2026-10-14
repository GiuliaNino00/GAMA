# PRESENZE GAMA — immagine Docker
# Costruzione:  docker compose build      Avvio:  docker compose up -d

# 1) si compilano le dipendenze (better-sqlite3 a volte ha bisogno del compilatore)
FROM node:22-bookworm-slim AS costruzione
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2) l'immagine finale, leggera
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    TZ=Europe/Rome \
    CARTELLA_DATI=/dati \
    PORTA=3000
WORKDIR /app
COPY --from=costruzione /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
VOLUME /dati
EXPOSE 3000
HEALTHCHECK --interval=1m --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/salute').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
