import { z } from "zod";
import { ROLES } from "../features/auth/roles";

// โดเมนอีเมลที่ยอมรับ (provider สาธารณะที่ใช้กันทั่วไป)
const ALLOWED_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "yahoo.co.th",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "zoho.com",
]);

const validRoles = ROLES.map(([v]) => v) as [string, ...string[]];

const emailSchema = z
  .email("รูปแบบอีเมลไม่ถูกต้อง")
  .refine(
    (v) => ALLOWED_DOMAINS.has(v.split("@")[1]?.toLowerCase() ?? ""),
    "ใช้ได้เฉพาะ @gmail.com, @outlook.com, @yahoo.com และ provider ทั่วไปอื่น ๆ"
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    role: z.enum(validRoles, { message: "กรุณาเลือกตำแหน่ง" }),
    password: z
      .string()
      .min(4, "รหัสผ่านต้องมีอย่างน้อย 84ตัวอักษร"),
    //   .regex(/[A-Z]/, "ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว")
    //   .regex(/[0-9]/, "ต้องมีตัวเลขอย่างน้อย 1 ตัว"),
    confirm: z.string().min(1, "กรุณายืนยันรหัสผ่าน"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirm"],
  });

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
