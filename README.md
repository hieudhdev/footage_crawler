# Footage crawler

Lấy stock footage theo project từ Pexels, Pixabay, Unsplash (API chính thức).

## Setup

Node 20+.

```bash
npm install
copy .env.example .env
```

Điền key trong `.env`. Thiếu nền tảng nào thì bỏ qua nền tảng đó. Pexels đủ để thử video.

| Nền tảng | Biến | Lấy key |
| --- | --- | --- |
| Pexels | `PEXELS_API_KEY` | https://www.pexels.com/api/ |
| Pixabay | `PIXABAY_API_KEY` | https://pixabay.com/api/docs/ |
| Unsplash | `UNSPLASH_ACCESS_KEY` | https://unsplash.com/oauth/applications |

Unsplash chỉ có ảnh (`type: photo`). Video: Pexels trước, Pixabay khi thiếu.

## Chạy

Thêm JSON vào `examples/`:

```bash
npm start -- sample-project
```

Search (chỉ `source: stock`) → ghi đè manifest → mở review. Pick + Download trên UI. Log tải hiện trên terminal.

JSON khác: thả vào `examples/`, `npm start -- ten-file`.

## JSON (AI web xuất cái này)

Mẫu: `examples/sample-project.json`.

```json
[
  {
    "chapter": 1,
    "scene": 1,
    "type": "video",
    "source": "stock",
    "keyword": "aerial city sunrise; city skyline morning; urban dawn timelapse"
  },
  {
    "chapter": 2,
    "scene": 1,
    "type": "photo",
    "source": "ai",
    "keyword": "cinematic still of a forgotten king, fog, golden hour"
  }
]
```

| Field | Giá trị |
| --- | --- |
| `chapter`, `scene` | số → id `c01s01` |
| `type` | `video` hoặc `photo` |
| `source` | `stock` (tool chạy) / `archival` / `ai` (làm tay, skip API) |
| `keyword` | 2–4 cụm, cụ thể → chung, ngăn `;`. Archival/AI: tên archive hoặc prompt |

Duration mặc định 10s. Aspect mặc định `16:9`. Tên file = cụm keyword đầu. Output folder = tên file JSON.

## Output

```
projects/sample-project/
  manifest.json
  credits.json
  scenes/
    aerial-city-sunrise.mp4
```

## Ghi chú

- Một lần chạy = một JSON. Không crawl kho stock.
- Review UI credit photographer (điều kiện API).
- Unsplash: preview hotlink; download mới ping `download_location`.
- Pixabay search cache 24h.
