# DEPLOY — Ubuntu Server

> **Giai đoạn 1:** chạy lệnh trực tiếp cho dễ test. Docker để sau (Bước 9).
> **Máy đích:** Ubuntu Server · **Máy dev:** Windows
> **Ràng buộc:** mỗi bên **1 lệnh phát hành + 1 lệnh chạy**. Migration và seed nằm trong lệnh PHÁT HÀNH, không nằm trong lệnh chạy — xem §4.
> Đọc trước: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 0. Chạy trên máy dev (Windows)

> Phần này dành cho máy phát triển. Từ §1 trở đi là server Ubuntu.

### 0.1. Tạo database (làm một lần)

PostgreSQL trên máy dev hiện đang nghe ở **cổng 5433**, không phải 5432 mặc định.
Kiểm tra lại nếu cần:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.OwningProcess -in (Get-Process postgres).Id } |
  Select-Object LocalAddress, LocalPort
```

Tạo database:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -h localhost -p 5433 vitaminfun
```

Muốn dùng tài khoản riêng thay vì `postgres` (khuyến khích — vitaminfun không cần
quyền superuser):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createuser.exe" -U postgres -h localhost -p 5433 --pwprompt vitaminfun
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe"   -U postgres -h localhost -p 5433 -O vitaminfun vitaminfun
```

Rồi sửa hai dòng trong `.env` ở gốc repo cho khớp user/mật khẩu/cổng:

```dotenv
DATABASE_URL=postgresql+asyncpg://<user>:<mật khẩu>@localhost:5433/vitaminfun
DATABASE_URL_SYNC=postgresql+psycopg://<user>:<mật khẩu>@localhost:5433/vitaminfun
```

### 0.2. Tạo bảng và nạp dữ liệu mẫu

```powershell
cd D:\Programs\vitaminfun\api
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m app.seeds.seed_all
```

Lệnh đầu tạo bảng `users`. Lệnh sau tạo ba tài khoản mẫu — email và mật khẩu lấy
từ `.env` (`SEED_*`), **không viết cứng trong code**. Cả hai lệnh chạy lại bao
nhiêu lần cũng được: `upgrade head` bỏ qua migration đã chạy, còn seed thấy tài
khoản đã tồn tại thì không đụng vào mật khẩu.

Nạp nội dung Chương 1 của world Lost in Atlantis (6 màn, 24 nhiệm vụ, 72 câu
hỏi) từ `public/data/stages/world_01/`:

```powershell
.\.venv\Scripts\python.exe -m app.seeds.import_world_01
```

**Không** nằm trong `seed_all` và không chạy khi triển khai: đây là nội dung
soạn sẵn của một world cụ thể, còn `seed_all` chỉ dựng cái khung mà mọi bản cài
đều cần. Chạy lại bao nhiêu lần cũng được — script tìm màn theo
`(chương, thứ tự)` và nhiệm vụ theo `quest_object_key` rồi ghi đè lên đúng bản
đang có, không tạo thêm bản sao.

Màn 1 giữ nguyên ảnh nền, ảnh vật thể, toạ độ và chiều cao nhân vật đã dựng tay
trên giao diện; script chỉ ghi đè phần nhiệm vụ và sổ tay của nó.

Xem trước SQL mà không chạm database:

```powershell
.\.venv\Scripts\alembic.exe upgrade head --sql
```

Quay lui:

```powershell
.\.venv\Scripts\alembic.exe downgrade -1
```

### 0.3. Chạy hai app

```powershell
# Cửa sổ 1 — API  (http://localhost:8000/docs)
cd D:\Programs\vitaminfun\api
.\.venv\Scripts\python.exe -m app --serve

# Cửa sổ 2 — Web (http://localhost:5000, theo PORT trong .env)
cd D:\Programs\vitaminfun\web
pnpm dev
```

Kiểm tra nhanh:

```powershell
curl.exe -s http://localhost:8000/health        # mong đợi status: ok
```

`status: degraded` với `db: error` nghĩa là database chưa tạo hoặc `.env` sai
chuỗi kết nối.

### 0.4. Đổi cổng

Cả hai cổng nằm trong `.env` ở gốc repo. Không có chỗ nào khác, và **không**
truyền qua dòng lệnh.

```dotenv
API_PORT=8000        # backend
PORT=5000            # frontend — tên biến do Next quy định, không đổi được
CORS_ORIGINS=http://localhost:5000     # phải khớp cổng frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1   # phải khớp cổng backend
API_INTERNAL_URL=http://localhost:8000/api/v1      # phải khớp cổng backend
```

Đổi cổng frontend thì phải sửa **cả `CORS_ORIGINS`**. Chưa cần ngay ở giai đoạn
này (trình duyệt không gọi thẳng API — mọi thứ đi qua Server Component), nhưng
sẽ cần từ Bước 7 khi WebSocket nối trực tiếp từ trình duyệt.

> **Vì sao `pnpm dev` phải đi qua `scripts/with-root-env.mjs`:** CLI của Next đọc
> `process.env.PORT` **ngay lúc khởi động**, trước khi nạp `next.config.ts`. Nạp
> `.env` bên trong `next.config.ts` là quá muộn — cổng đã bị chốt ở 3000. Triệu
> chứng rất khó đoán: sửa `PORT` trong `.env` mà không có gì thay đổi cả. Wrapper
> nạp `.env` rồi mới gọi `next`, nhờ vậy lệnh chạy vẫn không chứa giá trị cấu
> hình nào.
>
> Hệ quả: **luôn chạy qua `pnpm dev` / `pnpm build` / `pnpm start`**, đừng gọi
> `next dev` trực tiếp.

### 0.5. Sinh lại kiểu TypeScript sau khi đổi API

```powershell
cd D:\Programs\vitaminfun\web
pnpm gen:api-types      # cần API đang chạy
pnpm typecheck
```

Đổi schema ở backend mà quên chạy lệnh này thì frontend vẫn biên dịch trót lọt và
gãy lúc người dùng bấm nút. Chạy nó là cách để lỗi xuất hiện ở chỗ rẻ hơn.

### 0.6. "Port đang được sử dụng" — và cách tìm đúng thủ phạm

`API_RELOAD=true` khiến uvicorn chạy **hai tầng tiến trình**: cha theo dõi file,
con phục vụ HTTP. Tắt cha không sạch thì con vẫn sống và vẫn ôm cổng. Chúng tích
tụ dần qua mỗi lần khởi động lại.

**Dùng `netstat`, đừng dùng `Get-NetTCPConnection`.** Đã gặp trường hợp lệnh sau
chỉ báo một PID *đã chết*, còn kẻ giữ cổng thật thì không liệt kê:

```
TCP  0.0.0.0:8000  LISTENING  7272     <- con song, giu that
TCP  0.0.0.0:8000  LISTENING  22972    <- da chet, chi la bong
```

```powershell
# xem ai giu
netstat -ano | Select-String ":8000\s"

# tat het
netstat -ano | Select-String ":8000\s+.*LISTENING" |
  ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

Muốn hết hẳn chuyện tiến trình mồ côi thì đặt `API_RELOAD=false` trong `.env` —
đổi lại phải tự khởi động lại API mỗi khi sửa code Python.

### 0.7. Đừng chạy `pnpm build` khi `pnpm dev` đang chạy

Hai lệnh dùng chung thư mục `.next`. Chạy đè lên nhau làm hỏng bundle, và triệu
chứng là **mọi trang trả 500** với lỗi kiểu:

```
Cannot find module './vendor-chunks/@formatjs+icu-messageformat-parser@2.11.4.js'
```

Không phải lỗi mã nguồn, mà là `.next` bị hai tiến trình ghi chồng. Cách chữa:

```powershell
# dừng cả hai tiến trình trước
Remove-Item -Recurse -Force D:\Programs\vitaminfun\web\.next
pnpm dev        # hoặc pnpm build ; pnpm start
```

### 0.8. Một cái bẫy đã gặp

`api/alembic.ini` **chỉ được chứa ASCII**. Alembic đọc file này bằng encoding của
hệ điều hành; trên Windows là cp1252, nên một dấu tiếng Việt trong đó làm mọi lệnh
`alembic` chết bằng `UnicodeDecodeError`. Chú thích có dấu chỉ để trong file `.py`.

---

## 1. Vì sao chỉ cần 2 tiến trình

```
api/   1 process FastAPI  (REST + WebSocket cùng app)   → 1 lệnh chạy
web/   1 app Next.js      (giáo viên + học sinh + game) → 1 lệnh chạy
```

Giao diện giáo viên, giao diện học sinh và màn chơi Phaser đều nằm trong **một** Next.js app, phân biệt bằng route group và vai trò — nên không có app thứ hai để deploy. Phaser chỉ được tải ở route màn chơi nhờ `dynamic(ssr: false)`, không làm nặng phần còn lại.

Không dùng pnpm workspace hay Turborepo: hai thư mục độc lập, mỗi bên tự quản phụ thuộc của mình.

### Trình duyệt KHÔNG bao giờ gọi thẳng API

Đây là điều quyết định hình dạng của cả file cấu hình nginx bên dưới, nên nói rõ ngay:

```
trình duyệt ──HTTPS──> nginx ──> Next.js (PORT)
                                    │
                                    ├─ Server Component  ─┐
                                    └─ /api/be/*  (proxy) ─┴──> FastAPI (API_PORT, chỉ 127.0.0.1)
```

Token phiên nằm trong cookie `httpOnly`, nên mã chạy trên trình duyệt không đọc được để tự gắn `Authorization`. Route handler `web/src/app/api/be/[...path]/route.ts` chạy ở server, đọc cookie và gắn hộ. Hệ quả:

- **FastAPI không cần lộ ra Internet.** Nó chỉ cần nghe ở `127.0.0.1`.
- **`CORS_ORIGINS` chưa được dùng tới**, vì không có cuộc gọi khác origin nào. Vẫn đặt đúng để dành cho Bước 7 (WebSocket nối thẳng từ trình duyệt).
- **`NEXT_PUBLIC_API_URL` để TRỐNG.** `apiBaseUrl()` ưu tiên `API_INTERNAL_URL`; biến `NEXT_PUBLIC_*` chỉ còn là đường lùi, và đặt nó thành một URL công khai là hứa một cánh cửa không tồn tại.

---

## 2. Chuẩn bị server (làm một lần)

### 2.1. Gói hệ thống

```bash
sudo apt update
sudo apt install -y curl git nginx postgresql

# Node 20 + pnpm  (Next 15 cần Node >= 18.18)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pnpm
```

**Python 3.12** — Ubuntu 24.04 đã có sẵn:

```bash
sudo apt install -y python3.12 python3.12-venv
```

Ubuntu **22.04** thì mặc định là 3.10 và lệnh trên báo `Unable to locate package`. Thêm PPA trước:

```bash
sudo add-apt-repository -y ppa:deadsnakes/ppa && sudo apt update
sudo apt install -y python3.12 python3.12-venv
```

Kiểm tra trước khi đi tiếp — sai bản Python thì lỗi nổ ra tận lúc `pip install`:

```bash
python3.12 --version   # mong đợi 3.12.x
node --version         # mong đợi v20.x
pnpm --version
```

### 2.2. Người dùng chạy dịch vụ

Không chạy bằng `root`. Tài khoản này không cần shell đăng nhập:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin vitaminfun
```

### 2.3. Database

```bash
sudo -u postgres createuser --pwprompt vitaminfun     # nhập mật khẩu, nhớ lấy
sudo -u postgres createdb -O vitaminfun vitaminfun
```

Không cần superuser: migration chỉ tạo bảng, index và ràng buộc trong schema của chính nó.

### 2.4. Mã nguồn và kho media

```bash
sudo mkdir -p /srv && cd /srv
sudo git clone https://github.com/cungchatcom-dotcom/vitaminfun.git
sudo mkdir -p /srv/vitaminfun-storage
sudo chown -R vitaminfun:vitaminfun /srv/vitaminfun /srv/vitaminfun-storage

sudo -u vitaminfun python3.12 -m venv /srv/vitaminfun/api/.venv
```

**`/srv/vitaminfun-storage` nằm NGOÀI thư mục mã nguồn, và đó là bắt buộc.** Để trong repo thì một lần `git clean -xdf` hay một lần checkout nhầm nhánh là mất sạch ảnh, audio và video giáo viên đã tải lên — thứ duy nhất trên server không có bản sao ở đâu khác.

---

## 3. Biến môi trường

Một file `.env` duy nhất ở gốc repo, cả hai app cùng đọc: FastAPI qua `pydantic-settings`, Next qua `web/scripts/with-root-env.mjs`.

```bash
sudo -u vitaminfun cp /srv/vitaminfun/.env.example /srv/vitaminfun/.env
sudo -u vitaminfun nano /srv/vitaminfun/.env
sudo chmod 600 /srv/vitaminfun/.env          # trong này có mật khẩu database
```

Sinh khoá JWT (tối thiểu 32 ký tự, app từ chối khởi động nếu ngắn hơn):

```bash
python3.12 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Nội dung cho production:

```dotenv
# --- Chung ---
APP_ENV=production
APP_DEBUG=false

# --- Database ---
DATABASE_URL=postgresql+asyncpg://vitaminfun:<mật khẩu>@localhost:5432/vitaminfun
DATABASE_URL_SYNC=postgresql+psycopg://vitaminfun:<mật khẩu>@localhost:5432/vitaminfun

# --- API ---
API_HOST=127.0.0.1
API_PORT=8000
API_WORKERS=4
API_RELOAD=false
API_PREFIX=/api/v1
JWT_SECRET_KEY=<chuỗi vừa sinh ở trên>
CORS_ORIGINS=https://<tên-miền>

# --- Web ---
PORT=5000
NEXT_PUBLIC_API_URL=
API_INTERNAL_URL=http://127.0.0.1:8000/api/v1

# --- Lưu trữ media ---
STORAGE_BACKEND=local
STORAGE_LOCAL_PATH=/srv/vitaminfun-storage
STORAGE_PUBLIC_URL=https://<tên-miền>/media

# --- Realtime (Bước 7) ---
CACHE_USE_REDIS=false
REDIS_URL=redis://localhost:6379/0

# --- Tài khoản mẫu ---
SEED_ADMIN_EMAIL=admin@<tên-miền>
SEED_TEACHER_EMAIL=teacher@<tên-miền>
SEED_STUDENT_EMAIL=student@<tên-miền>
SEED_DEFAULT_PASSWORD=<mật khẩu mạnh, KHÔNG phải vitaminfun123>
```

### Năm dòng dễ sai nhất

| Biến | Cái bẫy |
|---|---|
| `JWT_SECRET_KEY` | Tên là **`JWT_SECRET_KEY`**, không phải `SECRET_KEY`. Đặt sai tên thì app vẫn chạy — bằng khoá mặc định — cho tới khi `APP_ENV=production` bắt được và từ chối khởi động. Đó là cái lưới, không phải chỗ để dựa vào. |
| `SEED_DEFAULT_PASSWORD` | `APP_ENV=production` mà vẫn để `vitaminfun123` thì **app không khởi động**, kèm đúng câu giải thích. Cố ý: mật khẩu mẫu là thứ đầu tiên phải đổi khi lên server thật. |
| `API_HOST` | `127.0.0.1`, không phải `0.0.0.0`. Không có lý do gì để FastAPI nghe ra Internet — mọi thứ đi qua Next (§1). `0.0.0.0` là mở cổng 8000 ra ngoài mà không ai để ý. |
| `STORAGE_PUBLIC_URL` | Giá trị này bị **ĐÓNG BĂNG vào từng hàng `media_assets.url` lúc tải file lên**. Đổi nó về sau **không sửa được các file đã tải** — chúng giữ nguyên URL cũ và hỏng hết. Đặt đúng ngay từ đầu, kể cả khi chưa gắn HTTPS. |
| `API_RELOAD` | Phải `false`. `true` thì uvicorn chạy hai tầng tiến trình, bỏ qua `API_WORKERS`, và để lại tiến trình mồ côi ôm cổng mỗi lần khởi động lại. |

---

## 4. Deploy

Hai bước, và **chúng là hai thứ khác nhau** — trộn vào nhau là cái sai đắt nhất trong file này:

- **Phát hành** — cài thư viện, migration, seed, build. Chạy **một lần** mỗi lần deploy.
- **Chạy** — `python -m app --serve` và `pnpm start`. systemd giữ chúng sống và khởi động lại khi chết.

Gộp phát hành vào lệnh chạy thì `Restart=always` biến thành: cứ mỗi lần API chết là `pip install` và `alembic upgrade` chạy lại — và một vòng lặp chết sẽ chạy migration hàng chục lần một phút.

### 4.1. Phát hành

```bash
cd /srv/vitaminfun
sudo -u vitaminfun git pull
sudo -u vitaminfun ./scripts/deploy-api.sh      # pip + alembic + seed
sudo -u vitaminfun ./scripts/deploy-web.sh      # pnpm install + build
```

Hai script chỉ là cái vỏ gọi đúng những lệnh dưới đây; muốn chạy tay thì:

```bash
# BACKEND
api/.venv/bin/python -m pip install -r api/requirements.txt
cd api && .venv/bin/alembic upgrade head && .venv/bin/python -m app.seeds.seed_all && cd ..

# FRONTEND
cd web && pnpm install --frozen-lockfile && pnpm build && cd ..
```

Cả hai chạy lại bao nhiêu lần cũng được: `upgrade head` bỏ qua migration đã chạy, seed thấy tài khoản đã tồn tại thì không đụng vào mật khẩu.

**Nội dung world 1** (6 màn, 24 nhiệm vụ, 72 câu hỏi) **không** nằm trong `seed_all` và không chạy khi deploy — `seed_all` chỉ dựng cái khung mà mọi bản cài đều cần. Muốn có thì gọi riêng, và cũng chạy lại được:

```bash
cd api && .venv/bin/python -m app.seeds.import_world_01
```

### 4.2. Chạy

```bash
cd /srv/vitaminfun/api && .venv/bin/python -m app --serve     # đọc API_HOST/PORT/WORKERS từ .env
cd /srv/vitaminfun/web && pnpm start                          # đọc PORT từ .env
```

Không lệnh nào nhận `--host` / `--port` / `-p`. Có tham số dòng lệnh nghĩa là cổng thật nằm ở hai nơi, và sẽ có ngày chúng lệch nhau.

Ở tiền cảnh thì đăng xuất SSH là tắt — §6 dựng systemd. Muốn thử nhanh trước thì `tmux new -s api` / `tmux new -s web`, thoát bằng `Ctrl+B` rồi `D`.

### 4.3. Kiểm tra

```bash
curl -s  http://127.0.0.1:8000/health          # {"status":"ok", ...}
curl -sI http://127.0.0.1:5000 | head -1       # HTTP/1.1 200 OK
```

`status: degraded` kèm `db: error` = sai chuỗi kết nối hoặc database chưa tạo. Đó là câu trả lời cho gần hết mọi sự cố lần đầu.

---

## 5. Hai cái bẫy Windows → Ubuntu

### 5.1. Đường dẫn venv khác nhau

| Hệ điều hành | Thư mục |
|---|---|
| Windows (dev) | `api/.venv/Scripts/` |
| Ubuntu (deploy) | `api/.venv/bin/` |

Lệnh deploy ở §4 dùng `bin/` vì chỉ chạy trên Ubuntu. Nếu sau này viết script tiện ích chạy được cả hai bên thì phải phân giải theo `process.platform` / `sys.platform`, **đừng viết cứng một trong hai**.

### 5.2. Ubuntu phân biệt hoa/thường

Windows coi `GameState.ts` và `gamestate.ts` là một; Ubuntu thì không. Import sai hoa/thường chạy tốt trên máy dev và **gãy khi `pnpm build` trên server**.

- Giữ `"forceConsistentCasingInFileNames": true` trong `tsconfig.json` (Next đặt sẵn — đừng tắt).
- **Tên file asset chỉ dùng `a-z0-9-_`**, không dấu tiếng Việt, không khoảng trắng.

`.gitattributes` ở gốc repo đã ép `eol=lf` cho `*.sh` và `*.py`, nên script checkout ra không dính `bad interpreter: /bin/bash^M`. Đừng gỡ nó.

### 5.3. KHÔNG dùng route group — dấu ngoặc đơn đi vào tên file chunk

`web/src/app/[locale]/` **không có thư mục nào đặt trong ngoặc đơn**, và đừng thêm lại. Đây không phải sở thích về cách sắp xếp; đó là một lỗi đã mất nửa ngày để tìm ra.

Route group `(auth)` của Next không xuất hiện trong URL — nhưng nó **xuất hiện nguyên vẹn trong đường dẫn file chunk**:

```
/_next/static/chunks/app/%5Blocale%5D/(auth)/login/page-860550ad0659df05.js
```

Và `next start` **404 khi dấu ngoặc đơn tới nơi ở dạng đã mã hoá**. Đo trên cùng một file, cùng một máy:

| đường dẫn tới Next | `next dev` | `next start` |
|---|---|---|
| `…/(auth)/…` | 200 | 200 |
| `…/%28auth%29/…` | **200** | **404** |

Dấu ngoặc **vuông** thì vô can — `%5Blocale%5D` và `[locale]` prod đều nhận, nên `[locale]` giữ nguyên được.

Hậu quả khi có một proxy mã hoá dấu ngoặc trên đường đi — Cloudflare Tunnel là trường hợp đã gặp thật:

- `pnpm dev` chạy tốt, `pnpm start` hỏng. Đúng cái tổ hợp làm người ta đi tìm nhầm chỗ, vì bản năng đầu tiên là nghi bản build.
- Trình duyệt báo `ChunkLoadError`, trang hiện `error.tsx` — không có gì trong lỗi nhắc tới dấu ngoặc.
- `curl` từ chính máy chủ thì **200**, vì curl gửi dấu ngoặc nguyên bản. Nên mọi phép kiểm tại chỗ đều nói "không sao".

### Bỏ route group không mất gì

Route group chỉ có một công dụng: gom **nhiều** thư mục vào chung một `layout.tsx` mà không hiện trong URL. Bốn nhóm cũ của dự án này đều bọc **đúng một** thư mục, và ba trong bốn nhóm còn không có `layout.tsx` nào — tức là chúng không gom cái gì với cái gì.

Chuyển `layout.tsx` xuống thẳng thư mục con là tương đương tuyệt đối. Danh sách route sau khi bỏ **giống hệt** trước, cả 20 đường.

Nếu sau này thật sự cần một layout dùng chung cho nhiều nhánh, hãy đặt layout ở thư mục cha có sẵn, hoặc dựng một component khung và gọi từ từng layout — đừng đổi lấy dấu ngoặc trong tên file chunk.

---

## 6. systemd

Hai unit, mỗi unit **chỉ chạy**, không cài đặt gì. Không dùng `EnvironmentFile`: `.env` là định dạng dotenv với chú thích tiếng Việt, còn systemd đọc nó theo luật riêng và sẽ hiểu sai — mà cũng không cần, vì cả hai app tự nạp `.env` từ gốc repo.

`/etc/systemd/system/vitaminfun-api.service`

```ini
[Unit]
Description=Vitaminfun API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=exec
User=vitaminfun
WorkingDirectory=/srv/vitaminfun/api
ExecStart=/srv/vitaminfun/api/.venv/bin/python -m app --serve
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/vitaminfun-web.service`

```ini
[Unit]
Description=Vitaminfun Web
After=network.target vitaminfun-api.service

[Service]
Type=exec
User=vitaminfun
WorkingDirectory=/srv/vitaminfun/web
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`ExecStart` phải là **đường dẫn tuyệt đối** — systemd không tra `PATH`. Kiểm trước khi dán:

```bash
command -v pnpm      # thường là /usr/bin/pnpm khi cài qua npm của NodeSource
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vitaminfun-api vitaminfun-web
sudo systemctl status vitaminfun-api
sudo journalctl -u vitaminfun-api -f
```

Từ lần deploy sau:

```bash
cd /srv/vitaminfun && sudo -u vitaminfun git pull
sudo -u vitaminfun ./scripts/deploy-api.sh && sudo -u vitaminfun ./scripts/deploy-web.sh
sudo systemctl restart vitaminfun-api vitaminfun-web
```

---

## 7. Nginx

```nginx
server {
  listen 80;
  server_name <tên-miền>;

  # Trần upload của API là 32MB (media/service.py MAX_BYTES). Để đúng 32M thì
  # phần bọc multipart đẩy request qua ngưỡng và nginx trả 413 TRƯỚC khi
  # FastAPI kịp nói gì — giáo viên thấy "lỗi" mà không có mã lỗi nào.
  client_max_body_size 40M;
  client_body_timeout 300s;

  # File media phục vụ THẲNG TỪ ĐĨA, không đi qua Python.
  # Dấu `/` cuối ở cả `location` lẫn `alias` là bắt buộc.
  location /media/ {
    alias /srv/vitaminfun-storage/;
    access_log off;
    expires 30d;
  }

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    # BẮT BUỘC. Next đứng sau nginx chỉ thấy HTTP thường, nên không có header
    # này thì cookie phiên bị đặt thiếu cờ `Secure` dù trình duyệt đang dùng
    # HTTPS. Xem web/src/lib/secure-cookie.ts.
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### KHÔNG có `location /api/`

Đây là chỗ dễ sai nhất, và nó hỏng một cách khó đoán. `/api/` trông như "đường của backend", nhưng ba thứ khác nhau cùng bắt đầu bằng nó:

| Đường | Ai phục vụ |
|---|---|
| `/api/be/*` | **Next** — proxy gắn token (§1) |
| `/api/auth/*` | **Next** — đăng nhập, đăng xuất |
| `/api/v1/*` | FastAPI — nhưng trình duyệt không bao giờ gọi tới |

Thêm `location /api/ { proxy_pass http://127.0.0.1:8000; }` là ném cả `/api/be/*` lẫn `/api/auth/*` sang FastAPI, nơi không có route nào như vậy. Triệu chứng: **đăng nhập được, nhưng mọi thao tác trong trang đều lỗi 404** — và không có gì trong log Next để nhìn, vì Next không hề nhận được request.

Cứ để `location /` nhận tất cả. FastAPI ở `127.0.0.1` là đủ.

Từ **Bước 7** sẽ cần thêm đúng một block, vì WebSocket nối thẳng từ trình duyệt:

```nginx
  location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;      # mặc định 60s = "đang chơi thì mất kết nối sau đúng một phút"
  }
```

### HTTPS

```bash
sudo ln -s /etc/nginx/sites-available/vitaminfun /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <tên-miền>
```

Certbot tự sửa file trên thành `listen 443 ssl` và thêm block chuyển hướng 80 → 443. **Sau đó `STORAGE_PUBLIC_URL` phải là `https://`** — nếu lúc đó đã có file tải lên bằng `http://` thì xem §9.

---

## 8. Ràng buộc phải giữ để deploy luôn đơn giản

| Ràng buộc | Vì sao |
|---|---|
| Seed **idempotent** | Deploy lần 2 không được nhân đôi 30 màn chơi |
| Không có bước thủ công sau deploy | Tạo thư mục, copy asset, chạy SQL tay — tất cả phải nằm trong migration hoặc seed |
| Asset **không** vào bundle Next | Ảnh/audio/video qua `media_assets` + `STORAGE_*`. Nhét vào bundle thì mỗi lần đổi ảnh phải build lại |
| Mọi cấu hình qua `.env`, có trong `.env.example` | Deploy không được phải sửa code |
| Giáo viên + học sinh + game chung **một** Next.js app | Đây là lý do FE chỉ cần 1 tiến trình |
| Phát hành tách khỏi chạy | `Restart=always` không được kéo theo `pip install` và migration |

---

## 9. Mang dữ liệu từ máy dev sang (tuỳ chọn)

Bản cài mới bắt đầu **rỗng**: database chỉ có ba tài khoản mẫu, kho media không có file nào. Muốn giữ world và nội dung đã dựng trên máy dev thì phải chuyển **cả hai**, và phải sửa một cột.

```powershell
# Trên máy dev
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -h localhost -p 5433 -Fc vitaminfun -f vitaminfun.dump
```

```bash
# Chép sang server rồi nạp
pg_restore -U vitaminfun -h localhost -d vitaminfun --clean --if-exists vitaminfun.dump

# Kho media đi RIÊNG — nó không nằm trong database và cũng không nằm trong git
rsync -av <máy-dev>/vitaminfun-storage/ /srv/vitaminfun-storage/
sudo chown -R vitaminfun:vitaminfun /srv/vitaminfun-storage
```

Rồi **bắt buộc** sửa URL đã đóng băng — xem bảng ở §3:

```sql
UPDATE media_assets
   SET url = replace(url, 'http://localhost:8000/media', 'https://<tên-miền>/media')
 WHERE url LIKE 'http://localhost:8000/media%';
```

Bỏ qua bước này thì mọi ảnh nền, ảnh vật thể, audio và video mở màn trên server đều trỏ về `localhost` của chính máy học sinh — và hỏng lặng lẽ: trang vẫn dựng, chỉ là không có ảnh nào hiện ra.

Kiểm lại:

```sql
SELECT DISTINCT substring(url from '^https?://[^/]+') FROM media_assets;
```
