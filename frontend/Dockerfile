# Build stage
FROM node:18-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Default nginx port
EXPOSE 80

# Overwrite default config if needed, or just let users proxy to 3000 in compose
# In docker-compose we map 3000:80
CMD ["nginx", "-g", "daemon off;"]
