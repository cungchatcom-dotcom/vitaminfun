# EDUPLAY — Question Type Schemas (v1.1)

> **Vị trí trong repo:** `docs/question-schemas.md`
> **Mục đích:** Hợp đồng dữ liệu (data contract) cho 16 dạng câu hỏi. Là nguồn chân lý duy nhất cho: grader phía server, Question Builder trong LMS, renderer phía học sinh, và API attempt.
> **Quy tắc vàng:** Mọi thay đổi schema phải cập nhật file này TRƯỚC, kèm bump `schemaVersion`, rồi mới sửa code. Grader của mỗi dạng PHẢI có unit test trước khi merge.

## Nhật ký phiên bản

| Ngày | Bản | Thay đổi |
|---|---|---|
| — | 1.0 | 15 dạng ban đầu |
| 11/08/2026 | 1.1 | Thêm `GAP_DROPDOWN` (§5b). Đổi tên `LISTEN_GAP_FILL` → `GAP_FILL`. Viết lại §16: **grader nằm ở backend Python**, không nằm trong gói TypeScript |

> **`schemaVersion` trên từng câu hỏi vẫn là `1`.** Bản 1.1 chỉ THÊM dạng mới và
> đổi tên một hằng số chưa từng được ghi vào database, không đổi cấu trúc dữ liệu
> của dạng nào đang tồn tại — nên dữ liệu cũ (nếu có) vẫn đọc được nguyên vẹn.

---

## 0. Quy ước chung

### 0.1. Ba loại JSON trên mỗi câu hỏi

| Field (DB) | Ai tạo | Ai đọc | Nội dung |
|---|---|---|---|
| `Question.contentJson` | Giáo viên (Builder) | Renderer (học sinh) | Đề bài: text, media, lựa chọn... **KHÔNG chứa đáp án** |
| `Question.answerJson` | Giáo viên (Builder) | Grader (server-only) | Đáp án đúng + cấu hình chấm. **Không bao giờ gửi xuống client khi mode=exam** |
| `AnswerRecord.answerJson` (gọi là `responseJson` trong code) | Học sinh (Player) | Grader, Review UI | Câu trả lời của học sinh |

⚠️ **Bảo mật:** API trả câu hỏi cho mode `exam` phải strip `answerJson`. Mode `review` (sau nộp bài/sau deadline theo cấu hình assignment) mới được trả kèm đáp án + `explanation`.

### 0.2. Envelope chung (mọi dạng đều có)

```ts
// packages/shared/src/question.ts
interface QuestionBase {
  id: string;
  type: QType;                 // enum 15 dạng bên dưới
  schemaVersion: 1;            // bump khi breaking change
  points: number;              // điểm tối đa, mặc định 1
  content: unknown;            // = contentJson, schema theo dạng
  answer?: unknown;            // = answerJson, chỉ có ở server/review
  explanation?: RichText;      // giải thích hiện ở màn review
  media?: {                    // media dùng chung cho câu (part-level media nằm ở Part)
    imageUrl?: string;
    audioUrl?: string;
    audioMaxPlays?: number;    // mặc định 2 (giống thi thật); null = không giới hạn
  };
  tags?: string[];             // "vocab:animals", "grammar:past-simple"
}

type QType =
  | "MCQ_SINGLE" | "MCQ_MULTI"
  | "GAP_FILL" | "GAP_DROPDOWN"
  | "LISTEN_DRAG_NAME" | "LISTEN_PICK_IMAGE" | "LISTEN_COLOR_PLACE"
  | "MATCHING" | "PASSAGE_WORD_BANK" | "TRUE_FALSE_NG" | "REORDER"
  | "SHORT_ANSWER" | "ESSAY"
  | "SPEAK_PICTURE" | "READ_ALOUD"
  | "VOCAB_GAME";
```

> **Vì sao `GAP_FILL` không còn tiền tố `LISTEN_`:** dạng này dùng cho cả bài
> nghe lẫn bài đọc — có audio hay không là do `media.audioUrl`, không phải do
> tên dạng. Giữ tên cũ thì giáo viên soạn bài đọc phải chọn một dạng tên là
> "nghe", vừa khó hiểu vừa làm hỏng bộ lọc trong kho đề. Đổi bây giờ là miễn phí
> vì chưa có bản ghi nào trong database.

### 0.3. Kiểu dùng chung

```ts
type RichText = string;        // markdown subset: **bold**, _it_, xuống dòng. Sanitize khi render.
type MediaRef = { url: string; alt?: string };

interface GradeResult {
  score: number;               // 0..points, cho phép lẻ (partial credit)
  isCorrect: boolean;          // score === points
  detail?: unknown;            // per-item đúng/sai để tô màu ở màn review
  needsManual?: boolean;       // true => chờ giáo viên/AI (ESSAY, SPEAK_*)
}

// Chữ ký grader thuần (pure function, không I/O) — test được 100%
type Grader<C, A, R> = (content: C, answer: A, response: R, points: number) => GradeResult;
```

### 0.4. Chuẩn hóa text (dùng cho mọi dạng gõ chữ)

```ts
interface TextMatchRule {
  caseSensitive?: boolean;     // mặc định false
  ignorePunctuation?: boolean; // mặc định true  (bỏ . , ! ? ' ")
  trimSpaces?: boolean;        // mặc định true  (trim + collapse space)
  ignoreDiacritics?: boolean;  // mặc định false (chỉ bật cho đáp án tiếng Việt)
  typoTolerance?: 0 | 1;       // Levenshtein cho phép; mặc định 0. Chỉ nên bật 1 cho từ ≥ 5 ký tự
}
// normalize("It's  a Dog!") với default => "its a dog"
```

Unit test bắt buộc cho normalizer: hoa/thường, dấu câu, khoảng trắng kép, chuỗi rỗng, unicode NFC/NFD, số viết chữ ("two" vs "2" — KHÔNG tự quy đổi, giáo viên phải liệt kê cả 2 vào `accepted`).

### 0.5. Partial credit

Mặc định các dạng nhiều mục con (MATCHING, GAP_FILL, WORD_BANK, DRAG_NAME...):
`score = points × (số mục đúng / tổng mục)`, làm tròn 2 chữ số thập phân.
Builder có switch `allOrNothing: true` để tắt partial credit (mặc định false).

---

## 1. MCQ_SINGLE — Trắc nghiệm 1 đáp án

Dạng phổ dụng nhất. Lựa chọn có thể là text, ảnh, hoặc audio.

```ts
interface McqSingleContent {
  prompt: RichText;                    // "Which one is a mango?"
  options: Array<{
    id: string;                        // "a","b","c","d" — ổn định, không đổi khi shuffle
    text?: RichText;
    image?: MediaRef;
    audio?: MediaRef;                  // dạng "nghe 3 audio chọn 1"
  }>;                                  // 2..6 options
  shuffleOptions?: boolean;            // mặc định true
  layout?: "list" | "grid2" | "grid4"; // grid cho option ảnh
}
interface McqSingleAnswer   { correctOptionId: string }
interface McqSingleResponse { selectedOptionId: string | null }
```

**Grader:** `score = (selected === correct) ? points : 0`. Null (bỏ trống) = 0, không âm điểm.
**Builder validation:** ≥2 options, đúng 1 correct, option phải có ít nhất 1 trong text/image/audio.

---

## 2. MCQ_MULTI — Trắc nghiệm nhiều đáp án

```ts
interface McqMultiContent extends Omit<McqSingleContent, never> {
  minSelect?: number;                  // hiện hint "Chọn 2 đáp án"
  maxSelect?: number;
}
interface McqMultiAnswer   { correctOptionIds: string[] }         // ≥1
interface McqMultiResponse { selectedOptionIds: string[] }
```

**Grader (mặc định `allOrNothing: true` cho dạng này** — tránh mẹo chọn hết):
đúng khi 2 tập bằng nhau. Nếu builder bật partial: `score = points × max(0, (đúng − chọn sai)/tổng đúng)`.

---

## 3. LISTEN_DRAG_NAME — Nghe & kéo tên vào tranh (Cambridge Listening Part 1)

Tranh lớn, kéo các "label" (tên người/vật) thả vào drop-zone vẽ trên tranh.

```ts
interface DragNameContent {
  image: MediaRef;                     // tranh nền
  labels: Array<{ id: string; text: string }>;      // "Jack","Lucy"... có thể nhiều hơn số zone (nhiễu)
  zones: Array<{
    id: string;
    x: number; y: number; w: number; h: number;     // % so với ảnh (0..100) → responsive
  }>;
  audioScript?: string;                // lưu để review hiện transcript + để TTS
}
interface DragNameAnswer   { mapping: Record<string /*zoneId*/, string /*labelId*/> }
// Không phải zone nào cũng có đáp án (zone nhiễu được phép) — chỉ chấm các zone có trong mapping
interface DragNameResponse { placements: Record<string /*zoneId*/, string /*labelId*/> }
```

**Grader:** đếm zone trong `answer.mapping` mà `placements[zoneId] === labelId`. Partial credit mặc định.
**Renderer:** mobile = tap label rồi tap zone (không bắt buộc drag); zone highlight khi hover; 1 label chỉ dùng 1 lần trừ khi `allowReuse`.
**Builder:** upload ảnh → vẽ zone bằng chuột trực tiếp trên preview (lưu %), gán label cho zone.

---

## 4. LISTEN_PICK_IMAGE — Nghe & chọn tranh đúng

Là MCQ_SINGLE với option ảnh + audio bắt buộc ở `media.audioUrl`. **Không tạo type riêng trong engine** — Builder chỉ là preset của MCQ_SINGLE (`layout: "grid2"`, yêu cầu audio). Ghi ở đây để đội content hiểu mapping.

---

## 5. GAP_FILL — Điền từ vào ô trống (nghe hoặc đọc)

Giáo viên gõ câu rồi bấm **+ Ô trống** để chèn chỗ trống vào giữa câu; mỗi ô
trống có một danh sách cách viết được chấp nhận.

```ts
interface GapFillContent {
  // Cú pháp template: "My name is {{1}}. I am {{2}} years old."
  // Builder KHÔNG bắt giáo viên gõ {{1}} bằng tay — nút "+ Ô trống" chèn hộ.
  template: string;                    // renderer parse {{n}} thành ô input
  gapHints?: Record<string, string>;   // {"2": "(a number)"}
  audioScript?: string;
}
interface GapFillAnswer {
  gaps: Record<string, {               // key = "1","2"...
    accepted: string[];                // ["seven","7"] — liệt kê mọi biến thể chấp nhận
    match?: TextMatchRule;
  }>;
}
interface GapFillResponse { gaps: Record<string, string> }
```

**Grader:** mỗi gap đúng nếu `normalize(response) ∈ normalize(accepted[])` (áp `typoTolerance` nếu bật). Partial credit theo gap.
**Test bắt buộc:** " Seven " ✓, "seven." ✓, "sevn" ✗ (tolerance 0) / ✓ (tolerance 1), gap bỏ trống ✗.
**Dạng này tái dùng cho Reading/Writing gap-fill** (không có audio thì là điền từ thường — vẫn 1 type, phân biệt bằng `media.audioUrl` có hay không).

---

## 5b. GAP_DROPDOWN — Ô trống chọn từ danh sách xổ xuống

Cùng ý tưởng chèn ô trống như `GAP_FILL`, nhưng học sinh **chọn** thay vì **gõ**.
Mỗi ô trống có một đáp án đúng và vài đáp án sai; renderer xáo trộn rồi đổ vào
một ô chọn.

```ts
interface GapDropdownContent {
  template: string;                    // "hello {{1}}, my name is {{2}}"
  // Lựa chọn của TỪNG ô trống. Renderer chỉ nhận `options` đã xáo trộn, KHÔNG
  // biết cái nào đúng — đáp án nằm ở answerJson và không rời khỏi server.
  gaps: Record<string, {
    options: Array<{ id: string; text: string }>;   // 2..6, gồm cả đáp án đúng
  }>;
  shuffleOptions?: boolean;            // mặc định true
}
interface GapDropdownAnswer   { gaps: Record<string, string /*optionId đúng*/> }
interface GapDropdownResponse { gaps: Record<string, string | null> }
```

**Vì sao tách khỏi `MCQ_SINGLE` dù cũng là chọn một trong nhiều:** một câu có
**nhiều** ô trống, mỗi ô một bộ lựa chọn riêng và được chấm riêng (partial
credit). Nhồi vào MCQ thì phải bịa thêm khái niệm "nhóm lựa chọn" — đắt hơn hẳn
việc thêm một dạng.

**Vì sao tách khỏi `PASSAGE_WORD_BANK`:** ở word bank mọi ô dùng chung một kho
từ và từ đã dùng thì mờ đi; ở đây mỗi ô có kho riêng, dùng lại thoải mái.

**Grader:** partial theo ô — `score = points × (số ô đúng / tổng số ô)`. Ô bỏ
trống tính sai, không âm điểm.

**Builder validation:** mỗi ô ≥ 2 lựa chọn, đúng 1 đáp án đúng, các lựa chọn
trong cùng một ô không được trùng chữ (trùng thì học sinh chọn cái nào cũng
tưởng đúng).

**Test bắt buộc:** đúng hết, sai hết, đúng một nửa, ô bỏ trống, `optionId` không
tồn tại trong `content` (dữ liệu bịa từ client → tính sai, không nổ lỗi).

---

## 6. LISTEN_COLOR_PLACE — Nghe & tô màu / đặt vật vào tranh (Cambridge Listening Part 5)

"Colour the ball next to the tree red. Put the star on the door."

```ts
interface ColorPlaceContent {
  image: MediaRef;
  palette: Array<{ id: string; name: string; hex: string }>;   // màu được phép
  stickers?: Array<{ id: string; image: MediaRef }>;           // vật thể để đặt (star, ball...)
  zones: Array<{ id: string; x: number; y: number; w: number; h: number;
                 kind: "color" | "sticker" }>;
  audioScript?: string;
}
interface ColorPlaceAnswer {
  actions: Array<
    | { zoneId: string; kind: "color";   colorId: string }
    | { zoneId: string; kind: "sticker"; stickerId: string }
  >;
}
interface ColorPlaceResponse {
  actions: Array<{ zoneId: string; kind: "color" | "sticker"; valueId: string }>;
}
```

**Tương tác:** chọn màu trên palette → tap vùng để tô (vùng đổi màu overlay 40% opacity); chọn sticker → tap vùng để đặt. Tap lại để xóa.
**Grader:** partial theo từng action trong answer; action thừa của học sinh không trừ điểm (v1).

---

## 7. MATCHING — Nối cột A–B

```ts
interface MatchingContent {
  left:  Array<{ id: string; text?: RichText; image?: MediaRef }>;
  right: Array<{ id: string; text?: RichText; image?: MediaRef }>;  // có thể nhiều hơn left (nhiễu)
  shuffleRight?: boolean;              // mặc định true
}
interface MatchingAnswer   { pairs: Record<string /*leftId*/, string /*rightId*/> }
interface MatchingResponse { pairs: Record<string /*leftId*/, string /*rightId*/> }
```

**Renderer:** desktop = kéo dây nối; mobile = tap trái rồi tap phải, cặp đã nối hiện cùng màu, tap lại để hủy.
**Grader:** partial theo cặp.

---

## 8. PASSAGE_WORD_BANK — Điền từ vào đoạn văn từ word bank (Reading Part 3/4)

```ts
interface WordBankContent {
  passage: string;                     // template {{1}}, {{2}} như GAP_FILL
  bank: Array<{ id: string; text: string; image?: MediaRef }>;  // nhiều hơn số gap (nhiễu)
  allowReuse?: boolean;                // mặc định false — dùng rồi mờ đi
}
interface WordBankAnswer   { gaps: Record<string /*gapKey*/, string /*bankItemId*/> }
interface WordBankResponse { gaps: Record<string /*gapKey*/, string /*bankItemId*/ | null> }
```

**Grader:** partial theo gap. Khác GAP_FILL: so sánh bằng `bankItemId` (không cần fuzzy text).

---

## 9. TRUE_FALSE_NG — Đúng / Sai / Không đề cập

```ts
interface TfngContent {
  passage?: RichText;                  // đoạn đọc (hoặc dùng chung ở Part.instructions)
  statements: Array<{ id: string; text: RichText }>;
  mode: "TF" | "TFNG" | "YN" | "YNNG";   // nhãn hiển thị
}
interface TfngAnswer   { keys: Record<string, "T" | "F" | "NG"> }
interface TfngResponse { keys: Record<string, "T" | "F" | "NG" | null> }
```

**Grader:** partial theo statement.

---

## 10. REORDER — Sắp xếp từ thành câu / câu thành đoạn

```ts
interface ReorderContent {
  prompt?: RichText;                   // "Put the words in order."
  items: Array<{ id: string; text: RichText; image?: MediaRef }>;
  unit: "word" | "sentence";           // chỉ ảnh hưởng styling
  // items được server shuffle sẵn khi trả về (seed theo attemptId để reload không đổi thứ tự)
}
interface ReorderAnswer {
  correctOrder: string[];              // mảng itemId theo thứ tự đúng
  alternativeOrders?: string[][];      // câu có nhiều đáp án đúng ("Yesterday I went..." / "I went... yesterday")
}
interface ReorderResponse { order: string[] }
```

**Grader:** đúng nếu `order` khớp `correctOrder` hoặc 1 trong `alternativeOrders`. Mặc định all-or-nothing (partial theo vị trí gây tranh cãi, bỏ ở v1).

---

## 11. SHORT_ANSWER — Viết câu trả lời ngắn

```ts
interface ShortAnswerContent {
  prompt: RichText;                    // "What is the girl holding?" (+ media.imageUrl)
  maxWords?: number;                   // Cambridge hay giới hạn "1-4 words" → hiện counter
  placeholder?: string;
}
interface ShortAnswerAnswer {
  accepted: string[];                  // ["a red ball","red ball","the red ball"]
  match?: TextMatchRule;
  aiFallback?: boolean;                // mặc định false. true = không khớp accepted thì gửi LLM chấm ngữ nghĩa
}
interface ShortAnswerResponse { text: string }
```

**Grader:** khớp `accepted` → điểm ngay. Nếu `aiFallback` bật và không khớp → `needsManual: true`, đẩy vào queue AI chấm (kết quả ghi đè sau, kèm `aiFeedbackJson.confidence`; confidence < 0.7 → chuyển giáo viên duyệt).

---

## 12. ESSAY — Viết đoạn / luận

```ts
interface EssayContent {
  prompt: RichText;
  minWords?: number; maxWords?: number;          // word counter realtime, chặn nộp nếu < minWords (cấu hình được)
  imagePrompts?: MediaRef[];                     // viết theo tranh
  rubricNote?: RichText;                         // hiện cho học sinh: "Chấm theo: nội dung, ngữ pháp, từ vựng"
}
interface EssayAnswer {
  rubric: Array<{ id: string; name: string; weight: number; description: string }>;
  // ví dụ: [{id:"content",name:"Nội dung",weight:0.4,...},{id:"grammar",weight:0.3},{id:"vocab",weight:0.3}]
  sampleAnswer?: string;                         // cho AI tham chiếu + hiện ở review
  aiPregrade: boolean;                           // mặc định true
}
interface EssayResponse { text: string }
```

**Luồng chấm:** submit → `needsManual: true` → (nếu `aiPregrade`) LLM chấm từng tiêu chí rubric + comment inline dạng
`{ spans: [{from, to, type: "grammar"|"vocab"|"suggestion", note}] , scores: {content: 3.5,...}, overall }`
→ giáo viên thấy bản chấm nháp trong LMS, sửa/duyệt → điểm final. Học sinh chỉ thấy điểm sau khi giáo viên duyệt (hoặc auto-release sau 48h nếu admin bật).

---

## 13. SPEAK_PICTURE — Nói theo tranh / trả lời giám khảo ảo

```ts
interface SpeakPictureContent {
  examinerScript: string;              // "Look at the picture. What is the boy doing?"
  examinerAudio?: MediaRef;            // nếu không có → TTS từ script
  image?: MediaRef;
  prepSeconds: number;                 // mặc định 5
  maxAnswerSeconds: number;            // mặc định 30
  maxRetries: number;                  // mặc định 1 lần ghi lại (0 khi mode thi thật)
}
interface SpeakPictureAnswer {
  expectedPoints?: string[];           // ý cần nói: ["playing football","in the yard"]
  sampleAnswer: string;                // "The boy is playing football in the yard."
  rubric?: { pronunciation: number; grammarVocab: number; fluency: number }; // trọng số, mặc định 1/3 mỗi tiêu chí
  minWords?: number;                   // dưới ngưỡng → 0 điểm + nhắc "hãy nói thành câu đầy đủ"
}
interface SpeakPictureResponse {
  audioUrl: string;                    // client upload S3 (presigned) rồi gửi URL
  durationMs: number;
}
```

**Luồng chấm (async, target < 60s):**
```
grader trả needsManual:true ngay khi nộp
→ queue: STT (word timestamps) → pronunciation assessment (per-phoneme)
→ LLM rubric: so transcript với expectedPoints + sampleAnswer
→ aiFeedbackJson: {
    transcript, scores: {pronunciation, grammarVocab, fluency},   // thang 10
    mispronounced: [{word:"thirsty", expected:"/ˈθɜːsti/", got:"/ˈtɜːsti/", tipVi:"đặt lưỡi giữa răng khi phát âm /θ/"}],
    childFriendlyComment: "Con nói rất trôi chảy! Chú ý âm /θ/ nhé 🎉",
    sampleAnswer
  }
→ score = Σ(tiêu_chí × trọng_số)/10 × points → cập nhật AnswerRecord + push socket về client
```
**Edge cases phải test:** audio im lặng (0đ + thông báo dễ thương), audio < 1s, nói tiếng Việt (LLM phát hiện → 0đ pronunciation, comment nhắc nói tiếng Anh), STT lỗi (retry 2 lần → fallback needsManual cho giáo viên).

---

## 14. READ_ALOUD — Đọc to đoạn văn

```ts
interface ReadAloudContent {
  text: string;                        // đoạn cần đọc, ≤ 60 từ
  maxSeconds: number;                  // mặc định 45
  maxRetries: number;
}
interface ReadAloudAnswer {
  scoring: { accuracy: number; fluency: number; pronunciation: number };  // trọng số
}
interface ReadAloudResponse { audioUrl: string; durationMs: number }
```

**Chấm:** STT → align transcript với `text` (word-level diff) → accuracy = % từ đọc đúng; fluency = tốc độ + khoảng ngừng; pronunciation từ assessment. Review UI tô màu từng từ: xanh (đúng) / vàng (phát âm lệch) / đỏ (bỏ sót) — giống các app luyện đọc cho trẻ.

---

## 15. VOCAB_GAME — Mini game từ vựng

Một type chứa nhiều `gameMode` (không tách type — cùng data từ vựng):

```ts
interface VocabGameContent {
  gameMode: "FLASHCARD" | "MATCH_PAIRS" | "LISTEN_TAP" | "SCRAMBLE";
  cards: Array<{
    id: string;
    word: string;                      // "elephant"
    meaningVi?: string;
    image?: MediaRef;
    audio?: MediaRef;                  // không có → TTS
    ipa?: string;
  }>;
  timeLimitSeconds?: number;           // game tính giờ để tính sao
}
// FLASHCARD: lật thẻ tự học (không chấm, hoàn thành = xem hết → thưởng coin nhỏ)
// MATCH_PAIRS: lưới úp thẻ, lật 2 thẻ tìm cặp word-image
// LISTEN_TAP: nghe audio → tap đúng ảnh/từ trong 4 lựa chọn, chuỗi 10 câu
// SCRAMBLE: sắp xếp chữ cái thành từ (gợi ý = ảnh + audio)
interface VocabGameResponse {
  completed: boolean; correctCount: number; totalCount: number; timeMs: number;
}
```

**Grader:** client tự chơi, server verify sanity (timeMs hợp lý, correctCount ≤ total) rồi tính sao 1–3 + coin. Không dùng trong bài thi tính điểm (chỉ practice) → chống gian lận mức nhẹ là đủ.

---

## 16. Nơi đặt grader và renderer

**Grader chạy ở BACKEND PYTHON. Không có bản TypeScript.**

Lý do không làm như bản 1.0 dự kiến (grader nằm trong gói TypeScript dùng chung):
backend của dự án là Python, mà điểm số **bắt buộc** do server quyết — `answerJson`
không được gửi xuống máy học sinh ở chế độ thi. Nếu grader viết bằng TypeScript
thì server vẫn phải có bản Python để chấm thật, tức là **hai bản logic chấm cho
cùng một dạng bài**. Hai bản sẽ lệch nhau, và lệch ở chỗ chấm điểm thì phụ huynh
là người phát hiện ra.

Đổi lại, học sinh muốn biết đúng/sai ngay thì gọi API (`POST /questions/{id}/check`
ở chế độ luyện tập). Một lượt gọi mạng nội bộ vài chục mili giây — rẻ hơn nhiều
so với việc phải đồng bộ hai bản logic mãi mãi.

```
apps/api/app/modules/questions/
  schemas.py            Pydantic: content / answer / response cho từng dạng
  grading/
    normalize.py        Chuẩn hoá text theo TextMatchRule (mục 0.4)
    graders.py          GRADERS: dict[QType, hàm chấm thuần] — bắt buộc có test trước
  service.py            Kiểm tra hợp lệ khi lưu, che đáp án khi trả về
  router.py             CRUD + chấm thử
```

**Hàm chấm là hàm thuần** (`content, answer, response, points → GradeResult`):
không đụng database, không gọi mạng, không đọc giờ hệ thống. Nhờ vậy test được
100% bằng bảng dữ liệu, và Pha 4 muốn chấm hàng loạt cũng không phải sửa gì.

**Thêm một dạng bài mới =** thêm schema vào `schemas.py` + thêm một hàm vào
`GRADERS` + thêm test. Không sửa router, không sửa service.

### Phía frontend

Frontend **chỉ hiển thị**, không tính điểm.

```
apps/web/src/components/question/
  types/<dạng>/Builder.tsx     form soạn cho giáo viên
  types/<dạng>/Renderer.tsx    hiển thị cho học sinh
  registry.ts                  QTYPE → { Builder, Renderer, defaults, icon }
```

**RendererProps chuẩn:**
```ts
interface RendererProps<C, R> {
  content: C;
  value: R | null;
  onChange: (r: R) => void;            // trang cha lo autosave (debounce 2s)
  mode: "exam" | "review" | "preview";
  reviewData?: { answer: unknown; detail: unknown };  // chỉ mode review
  disabled?: boolean;
}
```

Builder dùng **chính Renderer ở mode `preview`** để xem trước — giáo viên nhìn
thấy đúng cái học sinh sẽ thấy, và không có hai đường vẽ khác nhau cho cùng một
dạng bài.

## 17. Thứ tự implement

| Đợt | Types | Trạng thái |
|---|---|---|
| **Đợt 1** | `MCQ_SINGLE` · `MCQ_MULTI` · `GAP_FILL` · `GAP_DROPDOWN` | Đang làm — 3 nhóm giao diện, phủ phần lớn bài tập cơ bản |
| Đợt 2 | `MATCHING` · `REORDER` · `PASSAGE_WORD_BANK` · `TRUE_FALSE_NG` · `SHORT_ANSWER` | Hoàn thiện Reading/Writing |
| Đợt 3 | `LISTEN_DRAG_NAME` · `LISTEN_COLOR_PLACE` · `SPEAK_PICTURE` · `READ_ALOUD` | Cần thu âm và xử lý ảnh có vùng |
| Đợt 4 | `ESSAY` (AI chấm nháp) · `VOCAB_GAME` | Cần pipeline AI + hiệu ứng game |

`MCQ_SINGLE` và `MCQ_MULTI` dùng **chung một builder**, phân biệt bằng công tắc
"Chọn một đáp án / Chọn nhiều đáp án" — giống cách bản khảo sát làm. Hai dạng
riêng ở tầng dữ liệu vì cách chấm khác hẳn nhau.
