# --- STAGE 1: Build React static assets ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (leverages Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy source files and build
COPY . .
RUN npm run build

# --- STAGE 2: Serve files using Nginx ---
FROM nginx:stable-alpine

# Set permissions for default nginx directories
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx

# Remove default nginx public assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend assets from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run as nginx user
USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
