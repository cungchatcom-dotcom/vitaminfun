# DEPLOY — Ubuntu Server

> **Giai đoạn 1:** chạy lệnh trực tiếp cho dễ test. Docker để sau (Bước 9).
> **Máy đích:** Ubuntu Server · **Máy dev:** Windows
> **Ràng buộc:** deploy = **1 lệnh cho BE, 1 lệnh cho FE**. Migration và seed nằm *trong* lệnh deploy.
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

# Cửa sổ 2 — Web (http://localhost:3000)
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

## 1. Vì sao chỉ cần 2 lệnh

```
api/   1 process FastAPI  (REST + WebSocket cùng app)   → 1 lệnh
web/   1 app Next.js      (giáo viên + học sinh + game) → 1 lệnh
```

Giao diện giáo viên, giao diện học sinh và màn chơi Phaser đều nằm trong **một** Next.js app, phân biệt bằng route group và vai trò — nên không có app thứ hai để deploy. Phaser chỉ được tải ở route màn chơi nhờ `dynamic(ssr: false)`, không làm nặng phần còn lại.

Không dùng pnpm workspace hay Turborepo: hai thư mục độc lập, mỗi bên tự quản phụ thuộc của mình.

---

## 2. Chuẩn bị server (làm một lần)

```bash
# Node 20 + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pnpm

# Python 3.12
sudo apt install -y python3.12 python3.12-venv python3-pip

# PostgreSQL
sudo apt install -y postgresql
sudo -u postgres createuser --pwprompt vitaminfun
sudo -u postgres createdb -O vitaminfun vitaminfun

# Mã nguồn
git clone <repo> /srv/vitaminfun && cd /srv/vitaminfun
python3.12 -m venv api/.venv
cp .env.example .env       # rồi sửa DATABASE_URL, SECRET_KEY, CORS_ORIGINS...
```

Redis chưa cần ở giai đoạn này. Chỉ bắt buộc từ **Bước 7** (WebSocket phòng chơi).

---

## 3. Biến môi trường

Một file `.env` duy nhất ở gốc, cả hai app cùng đọc.

```dotenv
# --- Database ---
DATABASE_URL=postgresql+asyncpg://vitaminfun:***@localhost:5432/vitaminfun
DATABASE_URL_SYNC=postgresql+psycopg://vitaminfun:***@localhost:5432/vitaminfun

# --- API ---
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4
API_PREFIX=/api/v1
SECRET_KEY=<đổi, đừng dùng giá trị mặc định>
CORS_ORIGINS=https://<tên-miền>

# --- Web ---
# Tên biến PORT do Next quy định, không đổi được. Nạp vào tiến trình bởi
# web/scripts/with-root-env.mjs TRƯỚC khi Next khởi động — xem §0.4.
PORT=3000
NEXT_PUBLIC_API_URL=https://<tên-miền>/api/v1
API_INTERNAL_URL=http://127.0.0.1:8000/api/v1

# --- Lưu trữ media ---
STORAGE_BACKEND=local
STORAGE_LOCAL_PATH=/srv/vitaminfun-storage
STORAGE_PUBLIC_URL=https://<tên-miền>/media

# --- Cache / Realtime (Bước 7) ---
CACHE_USE_REDIS=false
REDIS_URL=redis://localhost:6379/0
```

Hai điều quan trọng:

- **`STORAGE_LOCAL_PATH` phải nằm ngoài thư mục mã nguồn.** Để trong repo thì một lần `git clean` hoặc `git pull` là mất hết ảnh giáo viên đã upload.
- **Không có giá trị cấu hình nào trong lệnh deploy.** Cổng, số worker, đường dẫn — tất cả ở đây. Có mặc định trong lệnh nghĩa là cổng thật nằm ở hai nơi và sẽ có ngày chúng lệch nhau.

---

## 4. Chạy — tập lệnh từng bước

```bash
cd /srv/vitaminfun
set -a && . ./.env && set +a          # nạp .env vào môi trường shell
```

### BACKEND

```bash
# 1. Thư viện Python
api/.venv/bin/pip install -r api/requirements.txt

# 2. Migration
cd api && .venv/bin/alembic upgrade head && cd ..

# 3. Seed (idempotent — chạy lại bao nhiêu lần cũng ra kết quả như nhau)
cd api && .venv/bin/python -m app.seeds.seed_all && cd ..

# 4. Chạy API
cd api && .venv/bin/python -m app --serve
```

Bước 4 không truyền `--host/--port/--workers`: `python -m app --serve` đọc chúng từ `settings`, tức là từ `.env`.

### FRONTEND

```bash
# 1. Thư viện Node
cd web && pnpm install --frozen-lockfile

# 2. Build
pnpm build

# 3. Chạy
pnpm start
```

`pnpm start` không truyền `-p`: Next đọc `PORT` từ môi trường.

### Kiểm tra

```bash
curl -s  "http://localhost:$API_PORT$API_PREFIX/health"
curl -sI "http://localhost:$PORT" | head -1
```

### Gói lại thành 1 lệnh mỗi bên

Khi đã chạy ổn, thêm vào `package.json` ở gốc:

```json
{
  "scripts": {
    "deploy:api": "api/.venv/bin/pip install -r api/requirements.txt && cd api && .venv/bin/alembic upgrade head && .venv/bin/python -m app.seeds.seed_all && .venv/bin/python -m app --serve",
    "deploy:web": "cd web && pnpm install --frozen-lockfile && pnpm build && pnpm start"
  }
}
```

Script chỉ là cái vỏ gọi đúng những lệnh ở trên — tập lệnh từng bước mới là bản gốc.

---

## 5. Hai cái bẫy Windows → Ubuntu

### 5.1. Đường dẫn venv khác nhau

| Hệ điều hành | Thư mục |
|---|---|
| Windows (dev) | `api/.venv/Scripts/` |
| Ubuntu (deploy) | `api/.venv/bin/` |

Lệnh deploy ở §4 dùng `bin/` vì chỉ chạy trên Ubuntu. Nếu sau này viết script tiện ích chạy được cả hai bên thì phải phân giải theo `process.platform` / `sys.platform`, **đừng viết cứng một trong hai**.

### 5.2. Ubuntu phân biệt hoa/thường và không ưa tên file lạ

Windows coi `GameState.ts` và `gamestate.ts` là một; Ubuntu thì không. Import sai hoa/thường chạy tốt trên máy dev và **gãy khi build trên server**.

- Giữ `"forceConsistentCasingInFileNames": true` trong `tsconfig.json` (Next đặt sẵn — đừng tắt).
- **Tên file asset chỉ dùng `a-z0-9-_`**, không dấu tiếng Việt, không khoảng trắng. Asset hiện tại đang vi phạm (`Màn chơi 1 - bg.jpg`) — đổi tên ở Bước 5.

Thêm `.gitattributes` ở gốc repo để tránh `bad interpreter: /bin/bash^M`:

```gitattributes
* text=auto eol=lf
*.sh   text eol=lf
*.png  binary
*.jpg  binary
*.webp binary
*.mp3  binary
```

---

## 6. Chạy nền

`python -m app --serve` chạy ở tiền cảnh, đăng xuất SSH là tắt.

**Đang test:** `tmux`
```bash
tmux new -s api   → chạy lệnh backend  → Ctrl+B rồi D
tmux new -s web   → chạy lệnh frontend → Ctrl+B rồi D
```

**Khi ổn định:** systemd, vẫn giữ đúng 1 lệnh mỗi bên

`/etc/systemd/system/vitaminfun-api.service`
```ini
[Unit]
Description=Vitaminfun API
After=network.target postgresql.service

[Service]
WorkingDirectory=/srv/vitaminfun
ExecStart=/usr/bin/pnpm deploy:api
EnvironmentFile=/srv/vitaminfun/.env
Restart=always
User=vitaminfun

[Install]
WantedBy=multi-user.target
```

Từ đó: `sudo systemctl restart vitaminfun-api`.

---

## 7. Nginx

Các giá trị `<...>` phải khớp `.env`.

```nginx
server {
  listen 80;
  server_name <tên-miền>;
  client_max_body_size 32M;                        # giáo viên upload audio/ảnh

  location /api/   { proxy_pass http://127.0.0.1:<API_PORT>; }
  location /media/ { alias <STORAGE_LOCAL_PATH>/; }
  location / {
    proxy_pass http://127.0.0.1:<PORT>;
    proxy_set_header Host $host;
    # BẮT BUỘC. Next đứng sau nginx chỉ thấy HTTP thường, nên không có header
    # này thì cookie phiên bị đặt thiếu cờ `Secure` dù trình duyệt đang dùng
    # HTTPS. Xem web/src/lib/secure-cookie.ts.
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Bắt buộc từ Bước 7 — WebSocket phòng chơi
  location /ws/ {
    proxy_pass http://127.0.0.1:<API_PORT>;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

`proxy_read_timeout 3600s` ở block `/ws/`: mặc định nginx đóng kết nối im lặng sau 60s, biểu hiện ra là "đang chơi tự nhiên mất kết nối sau đúng một phút".

`client_max_body_size 32M`: mặc định nginx chặn upload >1MB, biểu hiện ra là giáo viên upload file audio bị lỗi 413 mà không rõ vì sao.

---

## 8. Ràng buộc phải giữ để deploy luôn là 2 lệnh

| Ràng buộc | Vì sao |
|---|---|
| Seed **idempotent** | Deploy lần 2 không được nhân đôi 30 màn chơi. Phải có test "chạy 2 lần cho kết quả giống hệt" |
| Không có bước thủ công sau deploy | Tạo thư mục, copy asset, chạy SQL tay — tất cả phải nằm trong migration hoặc seed |
| Asset **không** vào bundle Next | Ảnh/audio qua `media_assets` + `STORAGE_*`. Nhét vào bundle thì mỗi lần đổi ảnh phải build lại |
| Mọi cấu hình qua `.env`, có trong `.env.example` | Deploy không được phải sửa code |
| Giáo viên + học sinh + game chung **một** Next.js app | Đây là lý do FE chỉ cần 1 lệnh |
