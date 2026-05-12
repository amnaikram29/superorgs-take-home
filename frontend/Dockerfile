FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json* ./

# Install all deps (Linux/Node 20 — consistent with node:20-alpine)
RUN npm install --ignore-scripts=false

COPY . .

# Build static assets
RUN npm run build

# ---- Production image ----
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
