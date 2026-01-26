FROM node:22-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

EXPOSE 5173

# Serve the static files on port 5173 to match docker-compose
CMD ["serve", "-s", "dist", "-l", "5173"]
