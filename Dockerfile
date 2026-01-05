FROM node:22-slim

WORKDIR /app

# Install netcat for wait-for-db script
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Copy wait script
COPY wait-for-db.sh ./
RUN chmod +x wait-for-db.sh

# Start the application
CMD ["./wait-for-db.sh", "db", "sh", "-c", "pnpm db:push && node dist/index.js"]
