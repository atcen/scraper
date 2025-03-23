FROM mcr.microsoft.com/playwright:v1.51.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci && npx playwright install

COPY . .

CMD ["npm", "start"]