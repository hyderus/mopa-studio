import os
import re
import time
import uuid
import zipfile
import base64
import cv2
from flask import Flask, render_template, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from PIL import ImageFont

from mopa_engine import generate_mopa_image

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB max upload

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLED_FONTS_DIR = os.path.join(BASE_DIR, "fonts", "bundled")
UPLOADED_FONTS_DIR = os.path.join(BASE_DIR, "fonts", "uploaded")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

for directory in [BUNDLED_FONTS_DIR, UPLOADED_FONTS_DIR, OUTPUT_DIR]:
    os.makedirs(directory, exist_ok=True)

ALLOWED_FONT_EXTENSIONS = {'.ttf', '.otf', '.woff', '.woff2'}

# Ensure Work Sans is present in bundled fonts
WORK_SANS_EXTERNAL = r"C:\Users\hosom\Downloads\Work_Sans\WorkSans-VariableFont_wght.ttf"
WORK_SANS_BUNDLED = os.path.join(BUNDLED_FONTS_DIR, "WorkSans-VariableFont_wght.ttf")
if not os.path.exists(WORK_SANS_BUNDLED) and os.path.exists(WORK_SANS_EXTERNAL):
    try:
        import shutil
        shutil.copy2(WORK_SANS_EXTERNAL, WORK_SANS_BUNDLED)
    except Exception:
        pass

def is_allowed_font(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_FONT_EXTENSIONS

def get_font_info(font_path, category):
    try:
        f = ImageFont.truetype(font_path, 32)
        name_tuple = f.getname()
        display_name = f"{name_tuple[0]} {name_tuple[1]}".strip()
    except Exception:
        display_name = os.path.splitext(os.path.basename(font_path))[0]
        
    return {
        "id": os.path.basename(font_path),
        "filename": os.path.basename(font_path),
        "name": display_name,
        "category": category,
        "path": font_path,
        "url": f"/fonts/{category}/{os.path.basename(font_path)}",
        "size_kb": round(os.path.getsize(font_path) / 1024, 1)
    }

def resolve_font_path(font_id):
    """Finds font in bundled, uploaded, external or system directory. Defaults to Work Sans."""
    if not font_id or font_id == "WorkSans-VariableFont_wght.ttf":
        if os.path.exists(WORK_SANS_BUNDLED):
            return WORK_SANS_BUNDLED
        if os.path.exists(WORK_SANS_EXTERNAL):
            return WORK_SANS_EXTERNAL

    # Check uploaded
    p1 = os.path.join(UPLOADED_FONTS_DIR, font_id)
    if os.path.exists(p1):
        return p1
        
    # Check bundled
    p2 = os.path.join(BUNDLED_FONTS_DIR, font_id)
    if os.path.exists(p2):
        return p2

    # Check external work sans
    if os.path.exists(WORK_SANS_EXTERNAL):
        return WORK_SANS_EXTERNAL

    # Check Windows Fonts
    win_fonts = os.environ.get("WINDIR", "C:\\Windows") + "\\Fonts"
    p3 = os.path.join(win_fonts, font_id)
    if os.path.exists(p3):
        return p3

    # Fallback search in bundled
    bundled_files = os.listdir(BUNDLED_FONTS_DIR)
    if bundled_files:
        return os.path.join(BUNDLED_FONTS_DIR, bundled_files[0])
        
    return "arial.ttf"

def get_15digit_filename(text):
    """Extracts first 15 digits/characters from given text, e.g. 15digits.png"""
    clean = re.sub(r'[^a-zA-Z0-9]', '', str(text))[:15]
    if not clean:
        clean = "output"
    return f"{clean}.png"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/fonts/<path:subpath>")
def serve_font_file(subpath):
    fonts_dir = os.path.join(BASE_DIR, "fonts")
    file_path = os.path.join(fonts_dir, subpath)
    if os.path.exists(file_path):
        return send_from_directory(fonts_dir, subpath)
    # Check category fallback
    parts = subpath.split("/", 1)
    if len(parts) == 2:
        cat, fname = parts
        if cat == "bundled":
            return send_from_directory(BUNDLED_FONTS_DIR, fname)
        elif cat == "uploaded":
            return send_from_directory(UPLOADED_FONTS_DIR, fname)
        elif cat == "system":
            win_fonts = os.environ.get("WINDIR", "C:\\Windows") + "\\Fonts"
            return send_from_directory(win_fonts, fname)
    abort(404)

@app.route("/api/fonts", methods=["GET"])
def list_fonts():
    fonts = []
    
    # 1. Bundled fonts (Ensure Work Sans is first)
    if os.path.exists(WORK_SANS_BUNDLED):
        fonts.append(get_font_info(WORK_SANS_BUNDLED, "bundled"))
    elif os.path.exists(WORK_SANS_EXTERNAL):
        fonts.append(get_font_info(WORK_SANS_EXTERNAL, "bundled"))

    if os.path.exists(BUNDLED_FONTS_DIR):
        for f in sorted(os.listdir(BUNDLED_FONTS_DIR)):
            if is_allowed_font(f) and f != "WorkSans-VariableFont_wght.ttf":
                full = os.path.join(BUNDLED_FONTS_DIR, f)
                fonts.append(get_font_info(full, "bundled"))

    # 2. Uploaded custom fonts
    if os.path.exists(UPLOADED_FONTS_DIR):
        for f in sorted(os.listdir(UPLOADED_FONTS_DIR)):
            if is_allowed_font(f):
                full = os.path.join(UPLOADED_FONTS_DIR, f)
                fonts.append(get_font_info(full, "uploaded"))

    return jsonify({"fonts": fonts})

@app.route("/api/upload-font", methods=["POST"])
def upload_font():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
        
    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"success": False, "error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    if not filename or not is_allowed_font(filename):
        return jsonify({"success": False, "error": "Invalid font format. Please upload .ttf or .otf files."}), 400

    dest_path = os.path.join(UPLOADED_FONTS_DIR, filename)
    
    if os.path.exists(dest_path):
        base, ext = os.path.splitext(filename)
        filename = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
        dest_path = os.path.join(UPLOADED_FONTS_DIR, filename)

    file.save(dest_path)

    try:
        f = ImageFont.truetype(dest_path, 32)
        info = get_font_info(dest_path, "uploaded")
        return jsonify({
            "success": True,
            "message": f"Font '{info['name']}' uploaded successfully",
            "font": info
        })
    except Exception as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return jsonify({"success": False, "error": f"Failed to load font file: {str(e)}"}), 400

@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"success": False, "error": "No text provided"}), 400
    font_id = data.get("font_id", "WorkSans-VariableFont_wght.ttf")
    font_path = resolve_font_path(font_id)

    # Defaults matching user specifications
    font_size = int(data.get("font_size", 281))
    stroke_thickness = float(data.get("stroke_thickness", 6.5))
    letter_spacing = int(data.get("letter_spacing", 20))
    crop_pad = int(data.get("crop_pad", 4))
    
    seed = int(data.get("seed", 18780))
    pitch = float(data.get("pitch", 13.0))
    teeth_threshold = float(data.get("teeth_threshold", 0.25))
    saw_angle = float(data.get("saw_angle", 0.45))
    burr_shift_x = float(data.get("burr_shift_x", 5.5))
    burr_shift_y = float(data.get("burr_shift_y", 1.5))
    burr_weight = float(data.get("burr_weight", 0.9))
    jitter_range = int(data.get("jitter_range", 5))
    outer_lip_intensity = float(data.get("outer_lip_intensity", 0.16))
    outer_lip_dist = float(data.get("outer_lip_dist", 2.5))
    inner_trench_intensity = float(data.get("inner_trench_intensity", 0.3))
    inner_trench_dist = float(data.get("inner_trench_dist", 6.5))
    slag_noise_weight = float(data.get("slag_noise_weight", 0.45))
    fine_noise_weight = float(data.get("fine_noise_weight", 0.08))
    c_dark_hex = data.get("c_dark_hex", "#4a2c14")
    c_mid_hex = data.get("c_mid_hex", "#c99762")
    c_light_hex = data.get("c_light_hex", "#f2d39e")

    t0 = time.time()
    
    # Filename format: first 15 digits for given text.png
    out_filename = get_15digit_filename(text)
    out_filepath = os.path.join(OUTPUT_DIR, out_filename)

    try:
        img_bgra = generate_mopa_image(
            text=text,
            font_path=font_path,
            font_size=font_size,
            stroke_thickness=stroke_thickness,
            seed=seed,
            pitch=pitch,
            teeth_threshold=teeth_threshold,
            saw_angle=saw_angle,
            burr_shift_x=burr_shift_x,
            burr_shift_y=burr_shift_y,
            burr_weight=burr_weight,
            jitter_range=jitter_range,
            outer_lip_intensity=outer_lip_intensity,
            outer_lip_dist=outer_lip_dist,
            inner_trench_intensity=inner_trench_intensity,
            inner_trench_dist=inner_trench_dist,
            slag_noise_weight=slag_noise_weight,
            fine_noise_weight=fine_noise_weight,
            c_dark_hex=c_dark_hex,
            c_mid_hex=c_mid_hex,
            c_light_hex=c_light_hex,
            crop_pad=crop_pad,
            letter_spacing=letter_spacing,
            output_path=out_filepath
        )

        h, w, c = img_bgra.shape
        file_size_kb = round(os.path.getsize(out_filepath) / 1024, 1)

        success, buffer = cv2.imencode('.png', img_bgra)
        if not success:
            raise RuntimeError("Failed to encode PNG buffer")
        b64_str = base64.b64encode(buffer).decode('utf-8')
        data_uri = f"data:image/png;base64,{b64_str}"

        render_ms = round((time.time() - t0) * 1000, 1)

        return jsonify({
            "success": True,
            "image_data": data_uri,
            "filename": out_filename,
            "download_url": f"/download/{out_filename}",
            "width": w,
            "height": h,
            "file_size_kb": file_size_kb,
            "render_time_ms": render_ms
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/download/<filename>")
def download_file(filename):
    safe_name = secure_filename(filename)
    file_path = os.path.join(OUTPUT_DIR, safe_name)
    if not os.path.exists(file_path):
        abort(404)
    return send_from_directory(OUTPUT_DIR, safe_name, as_attachment=True)

@app.route("/api/batch", methods=["POST"])
def batch_generate():
    data = request.get_json() or {}
    items = data.get("texts", [])
    if isinstance(items, str):
        items = [line.strip() for line in items.splitlines() if line.strip()]
    elif isinstance(items, list):
        items = [str(x).strip() for x in items if str(x).strip()]

    if not items:
        return jsonify({"success": False, "error": "No texts provided"}), 400

    if len(items) > 50:
        return jsonify({"success": False, "error": "Max batch size is 50 items"}), 400

    font_id = data.get("font_id", "WorkSans-VariableFont_wght.ttf")
    font_path = resolve_font_path(font_id)
    font_size = int(data.get("font_size", 281))
    stroke_thickness = float(data.get("stroke_thickness", 6.5))
    letter_spacing = int(data.get("letter_spacing", 20))
    crop_pad = int(data.get("crop_pad", 4))
    
    seed = int(data.get("seed", 18780))
    pitch = float(data.get("pitch", 13.0))
    teeth_threshold = float(data.get("teeth_threshold", 0.25))
    saw_angle = float(data.get("saw_angle", 0.45))
    burr_shift_x = float(data.get("burr_shift_x", 5.5))
    burr_shift_y = float(data.get("burr_shift_y", 1.5))
    burr_weight = float(data.get("burr_weight", 0.9))
    jitter_range = int(data.get("jitter_range", 5))
    outer_lip_intensity = float(data.get("outer_lip_intensity", 0.16))
    outer_lip_dist = float(data.get("outer_lip_dist", 2.5))
    inner_trench_intensity = float(data.get("inner_trench_intensity", 0.3))
    inner_trench_dist = float(data.get("inner_trench_dist", 6.5))
    slag_noise_weight = float(data.get("slag_noise_weight", 0.45))
    fine_noise_weight = float(data.get("fine_noise_weight", 0.08))
    c_dark_hex = data.get("c_dark_hex", "#4a2c14")
    c_mid_hex = data.get("c_mid_hex", "#c99762")
    c_light_hex = data.get("c_light_hex", "#f2d39e")

    images_output = []
    used_names = set()

    for idx, text in enumerate(items):
        clean_15 = re.sub(r'[^a-zA-Z0-9]', '', str(text))[:15] or f"item_{idx+1}"
        fname = f"{clean_15}.png"
        
        if fname in used_names:
            fname = f"{clean_15}_{idx+1}.png"
        used_names.add(fname)

        fpath = os.path.join(OUTPUT_DIR, fname)
        
        img_bgra = generate_mopa_image(
            text=text,
            font_path=font_path,
            font_size=font_size,
            stroke_thickness=stroke_thickness,
            seed=seed,
            pitch=pitch,
            teeth_threshold=teeth_threshold,
            saw_angle=saw_angle,
            burr_shift_x=burr_shift_x,
            burr_shift_y=burr_shift_y,
            burr_weight=burr_weight,
            jitter_range=jitter_range,
            outer_lip_intensity=outer_lip_intensity,
            outer_lip_dist=outer_lip_dist,
            inner_trench_intensity=inner_trench_intensity,
            inner_trench_dist=inner_trench_dist,
            slag_noise_weight=slag_noise_weight,
            fine_noise_weight=fine_noise_weight,
            c_dark_hex=c_dark_hex,
            c_mid_hex=c_mid_hex,
            c_light_hex=c_light_hex,
            crop_pad=crop_pad,
            letter_spacing=letter_spacing,
            output_path=fpath
        )

        success, buffer = cv2.imencode('.png', img_bgra)
        if success:
            b64_str = base64.b64encode(buffer).decode('utf-8')
            data_uri = f"data:image/png;base64,{b64_str}"
        else:
            data_uri = f"/download/{fname}"

        images_output.append({
            "filename": fname,
            "download_url": f"/download/{fname}",
            "image_data": data_uri
        })

    return jsonify({
        "success": True,
        "count": len(images_output),
        "images": images_output
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
