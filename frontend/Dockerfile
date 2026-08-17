# ─── Qurish bosqichi ────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* o'zgaruvchilari Next.js tomonidan QURISH vaqtida sahifalar
# ichiga yozib qo'yiladi — konteyner ishga tushgandan keyin ularni
# o'zgartirib bo'lmaydi, shuning uchun build vaqtida argument sifatida
# uzatiladi (docker-compose.prod.yml'dagi `args:` orqali)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

# ─── Ishga tushirish bosqichi ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3001
CMD ["npm", "run", "start", "--", "-p", "3001"]
