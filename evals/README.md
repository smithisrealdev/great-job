# ชุดวัดผล AI และการทดสอบทั้งเส้นทาง

## 1. ชุดวัดผล AI (`npm run eval`)

ต้องมี `ANTHROPIC_API_KEY` (เรียก API จริง มีค่าใช้จ่าย) ถ้าไม่มี สคริปต์จะบอกและออกด้วย code 1

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run eval
```

สิ่งที่ตรวจ
1. **แกะประกาศ**: อ่าน `evals/postings/*.txt` (และ `evals/postings/th/*.txt`) คู่กับ `NN.expected.json` แล้วเทียบ title, companyName (เทียบแบบหลวม ตัวพิมพ์เล็กใหญ่และมีคำนี้อยู่ในอีกฝั่งก็ถือว่าตรง), remote และ isJobPosting
2. **จัดอันดับ**: แต่ละ `evals/resumes/*.json` มี `profile`, `prefs`, `ranked` (ชื่อไฟล์ประกาศเรียงจากเหมาะที่สุดไปน้อยที่สุด) งานแรกต้องได้คะแนนสูงกว่างานสุดท้ายอย่างน้อย 15 และงานที่ตามมาห้ามได้คะแนนสูงกว่างานก่อนหน้าเกิน 5
3. **ไม่แต่งทักษะ**: ทุกข้อใน `matches` ห้ามอ้างทักษะ (จากรายการคำใน `evals/checks.ts`) ที่ไม่มีใน `profile.skills` หรือข้อความประสบการณ์

**ผ่าน** คือ: แกะถูกอย่างน้อย 90%, ลำดับทุกชุดถูก, ไม่มี FABRICATED แล้วจบด้วย `EVAL PASSED` (exit 0) ถ้าไม่ผ่านจะจบด้วย `EVAL FAILED` (exit 1) ให้ปรับ prompt ใน `lib/ai/` แล้วรันใหม่

ตรรกะตัดสินอยู่ใน `evals/checks.ts` และมี unit test ใน `tests/unit/evalChecks.test.ts` (รันได้โดยไม่ต้องมี API key)

### เพิ่มประกาศภาษาไทย
ผู้ดูแล product ส่งประมาณ 10 ชิ้น (server ดึงเว็บงานไทยไม่ได้) วางที่ `evals/postings/th/` ตั้งชื่อ `NN.txt` คู่กับ `NN.expected.json`:

```json
{ "title": "Backend Developer", "companyName": "บริษัท ตัวอย่าง จำกัด", "remote": false, "isJobPosting": true }
```

ไฟล์ที่ไม่ใช่ประกาศงานให้ใส่ `"isJobPosting": false` และ title/companyName เป็น `""` ตอนนี้ชุดไทยมี 0 ไฟล์ สคริปต์จะพิมพ์ `Thai set: 0 files` และทำงานต่อ

## 2. ทดสอบทั้งเส้นทาง (`npm run e2e`)

ต้องมี Docker สำหรับ Supabase local และไฟล์ `.env.local` ที่ตั้ง `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ของ stack local

```bash
npx supabase start
npx supabase db reset      # รัน migrations และ seed.sql (มีผู้ใช้ทดสอบ e2e-new / e2e-onboarded, รหัสผ่าน e2e-password)
AI_FAKE=1 npm run e2e
```

`playwright.config.ts` เปิด `npm run dev` พร้อม `AI_FAKE=1` (AI ตอบจาก `tests/fixtures/ai/` ไม่เรียก API จริง) และ `NEXT_PUBLIC_E2E=1` (แสดงฟอร์มล็อกอินด้วยรหัสผ่านที่หน้า login เฉพาะตอนนี้) ทั้งสองตัวใช้ไม่ได้ใน production: `AI_FAKE` ถูกเมินเมื่อ `NODE_ENV=production` และ production build ไม่ตั้ง `NEXT_PUBLIC_E2E`

**ผ่าน** คือ 3 test ผ่านทั้งหมด: onboarding แล้วเพิ่มงานและย้ายเป็นสัมภาษณ์, หน้า en แสดงป้ายภาษาอังกฤษ, หน้ารายการงานไม่เลื่อนแนวนอนที่ความกว้างมือถือ
