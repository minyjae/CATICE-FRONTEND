FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --prefer-offline

COPY . .

# override outDir เพราะ vite.config.js ชี้ไป ../Catice2/web (สำหรับ dev embed)
RUN npm run build -- --outDir /app/dist

EXPOSE 4173

# vite preview เสิร์ฟ built files — host 0.0.0.0 เพื่อรับ traffic จากนอก container
CMD ["npx", "vite", "preview", "--outDir", "/app/dist", "--host", "0.0.0.0", "--port", "4173"]
