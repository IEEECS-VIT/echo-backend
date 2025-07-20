FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Optional: If you're using TypeScript
RUN npm install -g ts-node typescript nodemon

COPY . .

EXPOSE 5000

CMD ["npx", "nodemon", "--watch", "src", "--exec", "ts-node", "src/server.ts"]
