FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --prefer-offline

COPY . .

# VITE_API_URL ต้องมีตอน build (Vite ฝังค่าลง bundle ตอน vite build ไม่ใช่ runtime)
# Railway ส่ง service variable เข้ามาเป็น build arg ให้อัตโนมัติ → ประกาศ ARG เพื่อรับ แล้ว set เป็น ENV
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# override outDir เพราะ vite.config.js ชี้ไป ../Catice2/web (สำหรับ dev embed)
RUN npm run build -- --outDir /app/dist

EXPOSE 4173

# vite preview เสิร์ฟ built files — host 0.0.0.0 เพื่อรับ traffic จากนอก container
CMD ["npx", "vite", "preview", "--outDir", "/app/dist", "--host", "0.0.0.0", "--port", "4173"]
