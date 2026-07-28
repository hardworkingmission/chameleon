FROM node:20-bookworm-slim AS build
WORKDIR /app

# pdf-to-img pulls in `canvas`, a native module. It ships prebuilt binaries
# for glibc (Debian) but not musl (Alpine), so we use a Debian base to avoid
# compiling it from source (which needs a compiler + network access for
# node-gyp's Node header download).
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime shared libs for the `canvas` native module (used by pdf-to-img).
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r chameleon && useradd -r -g chameleon chameleon

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p storage/uploads storage/converted logs \
  && chown -R chameleon:chameleon /app

USER chameleon

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
