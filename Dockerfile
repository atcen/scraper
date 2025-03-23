FROM mcr.microsoft.com/playwright:v1.51.1-noble

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx playwright install

EXPOSE 3000

CMD ["node", "index.js"]
