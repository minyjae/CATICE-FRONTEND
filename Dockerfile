FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --prefer-offline

COPY . .

# VITE_API_URL ต้องมีตอน build (Vite ฝังค่าลง bundle ตอน vite build ไม่ใช่ runtime)
# ใส่ default = backend domain prod ไว้เลย → ไม่ต้องพึ่ง Railway ส่ง build arg (เปราะ)
# ยัง override ได้ผ่าน build arg ถ้าต้องการ (เช่น --build-arg VITE_API_URL=...)
ARG VITE_API_URL=https://catice-backend-production.up.railway.app
ENV VITE_API_URL=$VITE_API_URL

# override outDir เพราะ vite.config.js ชี้ไป ../Catice2/web (สำหรับ dev embed)
RUN npm run build -- --outDir /app/dist

EXPOSE 4173

# vite preview เสิร์ฟ built files — host 0.0.0.0 เพื่อรับ traffic จากนอก container
CMD ["npx", "vite", "preview", "--outDir", "/app/dist", "--host", "0.0.0.0", "--port", "4173"]
