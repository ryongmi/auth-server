# -------------------------
# Base for installing deps
# -------------------------
FROM node:23-alpine AS deps

WORKDIR /app

COPY .npmrc.docker .npmrc
COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

# -------------------------
# Build stage (with devDependencies)
# -------------------------
FROM node:23-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# -------------------------
# Local development (hot reload)
# -------------------------
FROM node:23-alpine AS local

WORKDIR /app

COPY .npmrc.docker .npmrc
# COPY package*.json ./
COPY package.json ./

# RUN npm install
RUN npm cache clean --force && npm install

COPY . .

# ESM 설정
ENV NODE_OPTIONS="--experimental-specifier-resolution=node"

# RUN npm run build

EXPOSE 8000

CMD ["npm", "run", "start:debug"]

# -------------------------
# Development server (배포 테스트 서버)
# 운영과 동일한 환경 + build 결과만 사용
# -------------------------
FROM node:23-alpine AS development

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

COPY package*.json ./

EXPOSE 8000

USER node

CMD ["npm", "run", "start:dev"]

# -------------------------
# Production server (운영)
# -------------------------
FROM node:23-alpine AS production

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

COPY package*.json ./

EXPOSE 8000

USER node

CMD ["npm", "run", "start:prod"]

#----------------------------------------------

# FROM node:23-alpine AS base
# WORKDIR /app
# COPY .npmrc.docker ./.npmrc
# COPY package*.json ./
# RUN npm ci --only=production && npm cache clean --force

# # Dev install (for dev or build with devDeps)
# FROM node:23-alpine AS dev-deps
# WORKDIR /app
# COPY .npmrc.docker ./.npmrc
# COPY package.json ./
# # RUN npm install
# RUN npm cache clean --force && npm install
# COPY . .

# # Local dev (debug)
# FROM dev-deps AS local
# CMD ["npm", "run", "start:debug"]

# # Local stage
# # FROM deps AS local
# # WORKDIR /app
# # COPY .npmrc.docker ./.npmrc
# # COPY package.json ./
# # RUN npm cache clean --force && npm install
# # COPY . .
# # EXPOSE 8000
# # CMD ["npm", "run", "start:debug"]

# # Development stage
# FROM node:23-alpine AS development
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci
# COPY . .
# EXPOSE 8000
# CMD ["npm", "run", "start:dev"]

# # Build stage
# FROM node:23-alpine AS build
# WORKDIR /app
# COPY --from=base /app/node_modules ./node_modules
# # COPY package*.json ./
# # RUN npm ci
# COPY . .
# RUN npm run build

# # Production stage
# FROM node:23-alpine AS production
# WORKDIR /app
# COPY --from=base /app/node_modules ./node_modules
# COPY --from=build /app/dist ./dist
# COPY package*.json ./
# EXPOSE 8000
# USER node
# CMD ["npm", "run", "start:prod"]