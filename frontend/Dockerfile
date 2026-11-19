# Fáze 1: Sestavení Angular aplikace
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Fáze 2: Servírování přes lehký Nginx server
FROM nginx:alpine

# Kopírování zkompilovaného frontendu do Nginx složky
COPY --from=build /app/dist/drevenka-frontend/browser /usr/share/nginx/html

# Kopírování konfigurace Nginx s proxy na backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
