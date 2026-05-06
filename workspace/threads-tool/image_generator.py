"""
スイーツ王子 画像生成モジュール

サポート:
    - OpenAI gpt-image-1（推奨・現状の主力）
    - Google Imagen 4 / Gemini Image（要有料プラン、フォールバック）

使い方:
    # OpenAI（デフォルト）
    python image_generator.py "プロンプト" --aspect 9:16

    # 品質指定
    python image_generator.py "プロンプト" --quality medium

    # 縦長 vs 正方形
    python image_generator.py "プロンプト" --aspect 9:16
    python image_generator.py "プロンプト" --aspect 1:1

    # Google系を使う場合
    python image_generator.py "プロンプト" --provider gemini --model imagen

セキュリティ:
    - APIキーは .env からのみ読み込み（ハードコード禁止）
    - エラー時もキー値はログに出さない
    - 例外メッセージ・レスポンスダンプ時もキーをマスク
"""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

# Windows コンソール文字化け対策
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).parent
ENV_PATH = ROOT / ".env"
DEFAULT_OUT_DIR = ROOT / "generated_images"

# ──────────────────────────────────────────
# プロバイダ／モデル定義
# ──────────────────────────────────────────

OPENAI_ENDPOINT = "https://api.openai.com/v1/images/generations"
OPENAI_EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits"

# OpenAI gpt-image-1 サポートサイズ
OPENAI_SIZE_MAP = {
    "1:1":  "1024x1024",
    "9:16": "1024x1536",   # 縦長（Threads向き）
    "16:9": "1536x1024",   # 横長
}

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_MODELS = {
    "flash":          {"name": "gemini-2.5-flash-image",        "method": "generateContent"},
    "pro":            {"name": "gemini-3-pro-image-preview",    "method": "generateContent"},
    "imagen":         {"name": "imagen-4.0-generate-001",       "method": "predict"},
    "imagen-fast":    {"name": "imagen-4.0-fast-generate-001",  "method": "predict"},
    "imagen-ultra":   {"name": "imagen-4.0-ultra-generate-001", "method": "predict"},
}


# ──────────────────────────────────────────
# 認証情報読込（マスク表示）
# ──────────────────────────────────────────

def _load_env():
    """.env を読み込んで dict で返す"""
    if not ENV_PATH.exists():
        return {}
    creds = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        creds[k.strip()] = v.strip()
    return creds


def _get_key(creds, key_name, label):
    val = creds.get(key_name, "")
    if not val or val.startswith(("sk-proj-...", "AIzaSy...", "sk-...")):
        print(f"❌ {label} が .env に未設定です（{key_name}）")
        sys.exit(1)
    return val


def mask_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***"
    return f"{key[:7]}...{key[-4:]}"


# ──────────────────────────────────────────
# 共通HTTP（キーを必ずマスクしてエラー出力）
# ──────────────────────────────────────────

def _http_post(url, payload, api_key, headers=None):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        body_safe = body.replace(api_key, mask_key(api_key))
        try:
            err = json.loads(body_safe)
            msg = err.get("error", {}).get("message", body_safe)
        except Exception:
            msg = body_safe
        print(f"❌ APIエラー ({e.code}): {msg}")
        sys.exit(1)
    except Exception as e:
        emsg = str(e).replace(api_key, mask_key(api_key))
        print(f"❌ 接続エラー: {emsg}")
        sys.exit(1)


# ──────────────────────────────────────────
# OpenAI gpt-image-1
# ──────────────────────────────────────────

def edit_openai(prompt, image_paths, aspect_ratio, quality, api_key):
    """gpt-image-1 で画像編集（reference画像を入力）"""
    import uuid
    size = OPENAI_SIZE_MAP.get(aspect_ratio, "1024x1024")

    # multipart/form-data 構築
    boundary = "----" + uuid.uuid4().hex
    parts = []

    def add_field(name, value):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())

    def add_file(name, path):
        path = Path(path)
        with open(path, "rb") as f:
            data = f.read()
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'
            f'Content-Type: image/png\r\n\r\n'.encode()
        )
        parts.append(data)
        parts.append(b"\r\n")

    add_field("model", "gpt-image-1")
    add_field("prompt", prompt)
    add_field("size", size)
    add_field("quality", quality)
    add_field("n", "1")

    for p in image_paths:
        add_file("image[]", p)

    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    print(f"\n🎨 OpenAI gpt-image-1 で画像編集中...")
    print(f"   品質: {quality} / サイズ: {size}")
    print(f"   入力画像: {len(image_paths)}枚")
    for p in image_paths:
        print(f"     - {Path(p).name}")
    print(f"   APIキー: {mask_key(api_key)}")
    print(f"   プロンプト: {prompt[:80]}{'...' if len(prompt) > 80 else ''}\n")

    req = urllib.request.Request(
        OPENAI_EDIT_ENDPOINT,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace").replace(api_key, mask_key(api_key))
        try:
            err = json.loads(body_err)
            msg = err.get("error", {}).get("message", body_err)
        except Exception:
            msg = body_err
        print(f"❌ APIエラー ({e.code}): {msg}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 接続エラー: {str(e).replace(api_key, mask_key(api_key))}")
        sys.exit(1)

    images = []
    for item in result.get("data", []):
        b64 = item.get("b64_json")
        if b64:
            images.append(base64.b64decode(b64))

    if not images:
        safe = json.dumps(result, ensure_ascii=False, indent=2).replace(api_key, mask_key(api_key))
        print(f"❌ 画像が返ってきませんでした:\n{safe}")
        sys.exit(1)
    return images


def generate_openai(prompt, aspect_ratio, quality, sample_count, api_key):
    size = OPENAI_SIZE_MAP.get(aspect_ratio, "1024x1024")
    payload = {
        "model": "gpt-image-1",
        "prompt": prompt,
        "n": sample_count,
        "size": size,
        "quality": quality,
    }
    print(f"\n🎨 OpenAI gpt-image-1 で画像生成中...")
    print(f"   品質: {quality} / サイズ: {size}")
    print(f"   生成枚数: {sample_count}")
    print(f"   APIキー: {mask_key(api_key)}")
    print(f"   プロンプト: {prompt[:80]}{'...' if len(prompt) > 80 else ''}\n")

    headers = {"Authorization": f"Bearer {api_key}"}
    result = _http_post(OPENAI_ENDPOINT, payload, api_key, headers=headers)

    images = []
    for item in result.get("data", []):
        b64 = item.get("b64_json")
        if b64:
            images.append(base64.b64decode(b64))

    if not images:
        safe_dump = json.dumps(result, ensure_ascii=False, indent=2).replace(
            api_key, mask_key(api_key))
        print(f"❌ 画像が返ってきませんでした:\n{safe_dump}")
        sys.exit(1)

    return images


# ──────────────────────────────────────────
# Google Gemini / Imagen 4
# ──────────────────────────────────────────

def generate_gemini(prompt, aspect_ratio, sample_count, model_alias, api_key):
    spec = GEMINI_MODELS.get(model_alias)
    if not spec:
        print(f"❌ 不明なモデル: {model_alias}")
        sys.exit(1)

    print(f"\n🎨 Google {spec['name']} で画像生成中...")
    print(f"   メソッド: {spec['method']}")
    print(f"   アスペクト比: {aspect_ratio}")
    print(f"   生成枚数: {sample_count}")
    print(f"   APIキー: {mask_key(api_key)}")
    print(f"   プロンプト: {prompt[:80]}{'...' if len(prompt) > 80 else ''}\n")

    if spec["method"] == "predict":
        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": sample_count,
                "aspectRatio": aspect_ratio,
                "personGeneration": "allow_adult",
            },
        }
        url = f"{GEMINI_BASE}/{spec['name']}:predict?key={urllib.parse.quote(api_key)}"
        result = _http_post(url, payload, api_key)
        preds = result.get("predictions", [])
        images = [base64.b64decode(p["bytesBase64Encoded"]) for p in preds if p.get("bytesBase64Encoded")]
    else:
        aspect_hint = {
            "1:1": "Square 1:1.", "9:16": "Vertical 9:16 portrait.",
            "16:9": "Horizontal 16:9 landscape.",
        }.get(aspect_ratio, "")
        full_prompt = f"{prompt}\n\n{aspect_hint}".strip()
        payload = {
            "contents": [{"role": "user", "parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "candidateCount": sample_count,
            },
        }
        url = f"{GEMINI_BASE}/{spec['name']}:generateContent?key={urllib.parse.quote(api_key)}"
        result = _http_post(url, payload, api_key)
        images = []
        for cand in result.get("candidates", []):
            for part in cand.get("content", {}).get("parts", []):
                inline = part.get("inlineData") or part.get("inline_data")
                if inline and inline.get("data"):
                    images.append(base64.b64decode(inline["data"]))

    if not images:
        safe_dump = json.dumps(result, ensure_ascii=False, indent=2).replace(
            api_key, mask_key(api_key))
        print(f"❌ 画像が返ってきませんでした:\n{safe_dump}")
        sys.exit(1)

    return images


# ──────────────────────────────────────────
# ディスパッチ
# ──────────────────────────────────────────

def generate_image(prompt, provider="openai", aspect_ratio="9:16",
                   quality="medium", sample_count=1, model_alias="flash",
                   reference_images=None):
    creds = _load_env()

    if provider == "openai":
        api_key = _get_key(creds, "OPENAI_API_KEY", "OpenAI APIキー")
        if reference_images:
            return edit_openai(prompt, reference_images, aspect_ratio, quality, api_key)
        return generate_openai(prompt, aspect_ratio, quality, sample_count, api_key)
    elif provider == "gemini":
        api_key = _get_key(creds, "GEMINI_API_KEY", "Gemini APIキー")
        return generate_gemini(prompt, aspect_ratio, sample_count, model_alias, api_key)
    else:
        print(f"❌ 不明なプロバイダ: {provider}")
        sys.exit(1)


# ──────────────────────────────────────────
# 保存
# ──────────────────────────────────────────

def save_images(images, out_dir=None, prefix="img"):
    out_dir = Path(out_dir) if out_dir else DEFAULT_OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    paths = []
    for i, data in enumerate(images, 1):
        suffix = f"_{i}" if len(images) > 1 else ""
        path = out_dir / f"{prefix}_{timestamp}{suffix}.png"
        path.write_bytes(data)
        paths.append(path)
        print(f"  ✅ 保存: {path}")
    return paths


# ──────────────────────────────────────────
# CLI
# ──────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="スイーツ王子 画像生成（OpenAI/Gemini）")
    parser.add_argument("prompt", help="画像生成プロンプト（英語推奨）")
    parser.add_argument("--provider", default="openai",
                        choices=["openai", "gemini"],
                        help="使用プロバイダ（デフォルト: openai）")
    parser.add_argument("--aspect", default="9:16",
                        choices=["1:1", "9:16", "16:9", "3:4", "4:3"],
                        help="アスペクト比（デフォルト: 9:16）")
    parser.add_argument("--quality", default="medium",
                        choices=["low", "medium", "high"],
                        help="品質（OpenAIのみ。デフォルト: medium）")
    parser.add_argument("--model", default="flash",
                        choices=list(GEMINI_MODELS.keys()),
                        help="Geminiモデル（--provider gemini時のみ）")
    parser.add_argument("--count", type=int, default=1, help="生成枚数（1〜4）")
    parser.add_argument("--out", default=None, help="保存先ディレクトリ")
    parser.add_argument("--prefix", default="sweets", help="ファイル名プレフィクス")
    parser.add_argument("--ref", action="append", default=None,
                        help="入力画像のパス（指定するとImage Editモードになる、複数可）")
    args = parser.parse_args()

    images = generate_image(
        prompt=args.prompt,
        provider=args.provider,
        aspect_ratio=args.aspect,
        quality=args.quality,
        sample_count=args.count,
        model_alias=args.model,
        reference_images=args.ref,
    )

    print(f"\n✅ {len(images)}枚生成完了\n")
    paths = save_images(images, out_dir=args.out, prefix=args.prefix)

    print(f"\n🎨 完了\n")
    for p in paths:
        print(f"   {p.absolute()}")
    print()


if __name__ == "__main__":
    main()
