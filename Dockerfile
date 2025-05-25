# Base image
FROM node:22

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Start the app
CMD ["npm", "start"]
