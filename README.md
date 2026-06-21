# Council of Self

**Một hội đồng AI 5 thành viên giúp bạn nhìn rõ một quyết định khó, từ nhiều góc nhìn cùng lúc.**

🔗 [https://council-of-self.vercel.app/](#) · Backend: FastAPI · Frontend: Next.js · DB & Auth: Supabase

---

## Ý tưởng

Mỗi ngày chúng ta đối mặt với những quyết định không hề nhỏ nhưng cũng chẳng "đủ to" để ngồi bàn bạc với ai: *Có nên nhận lời mời làm việc này không? Có nên kết thúc mối quan hệ này không?* Thường thì các luồng suy nghĩ — lý trí, cảm xúc, lo sợ rủi ro, muốn trải nghiệm — cứ chồng chéo lẫn nhau trong đầu, không bên nào được lắng nghe trọn vẹn.

**Council of Self** giả lập một "hội đồng nội tâm" gồm 4 cố vấn AI có tính cách đối lập nhau một cách có chủ đích — **Lý Trí, Con Tim, Người Cẩn Trọng, Người Tự Do** — để chúng tranh luận trực tiếp về câu hỏi của bạn. Sau vài vòng tranh luận, một **Chủ Tọa** AI sẽ tổng hợp lại thành một bản nhận định rõ ràng: đâu là điểm các cố vấn đồng ý, đâu là mâu thuẫn không thể dung hòa, và nên nghiêng về hướng nào tùy theo điều bạn thực sự ưu tiên.

Hệ thống không đưa ra "câu trả lời đúng" — nó giúp bạn **nhìn thấy rõ những đánh đổi** mà bình thường vẫn mơ hồ trong đầu.

## Trải nghiệm sử dụng

1. Đặt một câu hỏi quyết định bằng ngôn ngữ tự nhiên.
2. Xem 4 cố vấn tranh luận trực tiếp theo thời gian thực, qua nhiều vòng nếu họ thực sự bất đồng.
3. Nhận bản tổng kết từ Chủ Tọa: điểm đồng thuận, mâu thuẫn cốt lõi, khuyến nghị theo từng ưu tiên, và một đoạn chia sẻ riêng mang tính cá nhân hơn.
4. Mọi phiên đều được lưu lại để xem lại sau.

## Công nghệ sử dụng

| | |
|---|---|
| Frontend | Next.js, TailwindCSS, giao diện kính mờ (glassmorphism) |
| Backend | FastAPI, kiến trúc multi-agent chạy song song qua streaming (SSE) |
| Dữ liệu & Đăng nhập | Supabase (Postgres, Auth — hỗ trợ cả email và Google) |
| AI | OpenAI API — phân tầng model: model nhẹ cho 4 cố vấn, model mạnh hơn cho Chủ Tọa |
| Triển khai | Vercel (Frontend) + Render (Backend) |

## Một vài quyết định thiết kế đáng chú ý

- **4 cố vấn dùng model nhẹ, Chủ Tọa dùng model mạnh hơn** — vì việc tổng hợp nhiều luồng tranh luận xung đột đòi hỏi khả năng suy luận sâu hơn nhiều so với việc phát biểu một góc nhìn đơn lẻ.
- **Số vòng tranh luận do hệ thống tự quyết định bằng quy tắc cố định, không giao cho AI tự phán đoán** — để tránh tình trạng AI cứ lưỡng lự mãi không biết khi nào nên dừng.
- **Luôn có phương án dự phòng khi một cố vấn không phản hồi kịp** — để một lỗi nhỏ không làm hỏng cả phiên tranh luận.

## Chạy thử ở máy local

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Cần file `.env` (Backend) và `.env.local` (Frontend) — xem file mẫu `.env.example` trong từng thư mục.

---
