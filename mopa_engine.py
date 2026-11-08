import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def hex_to_bgr(hex_code, default_bgr):
    """Converts #RRGGBB to [B, G, R] float32 array."""
    try:
        hex_code = hex_code.strip().lstrip('#')
        if len(hex_code) == 6:
            r = int(hex_code[0:2], 16)
            g = int(hex_code[2:4], 16)
            b = int(hex_code[4:6], 16)
            return np.array([b, g, r], dtype=np.float32)
    except Exception:
        pass
    return np.array(default_bgr, dtype=np.float32)

def generate_mopa_image(
    text="",
    font_path="fonts/bundled/WorkSans-VariableFont_wght.ttf",
    font_size=281,
    stroke_thickness=0.0,
    seed=18780,
    pitch=13.0,
    teeth_threshold=0.25,
    saw_angle=0.45,
    burr_shift_x=4.0,
    burr_shift_y=1.0,
    burr_weight=0.7,
    jitter_range=5,
    outer_lip_intensity=0.18,
    outer_lip_dist=2.8,
    inner_trench_intensity=0.28,
    inner_trench_dist=7.5,
    slag_noise_weight=0.40,
    fine_noise_weight=0.06,
    c_dark_hex="#7e7268",
    c_mid_hex="#a69583",
    c_light_hex="#c0ae9b",
    crop_pad=4,
    letter_spacing=20,
    output_path=None
):
    """
    Renders high-fidelity MOPA laser marked serial text matching authentic iPhone
    laser chassis engraving with smooth optical Gaussian edge transitions, recast
    melt bead lip highlights, and recessed trench depth without pixelated stair-steps
    or artificial sawteeth.
    """
    if not text or not str(text).strip():
        empty_canvas = np.zeros((1, 1, 4), dtype=np.uint8)
        if output_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            cv2.imwrite(output_path, empty_canvas)
        return empty_canvas

    # Fallback search if specified font path doesn't exist
    if not os.path.exists(font_path):
        for candidate in [
            "fonts/bundled/WorkSans-VariableFont_wght.ttf",
            r"C:\Users\hosom\Downloads\mopa\fonts\bundled\WorkSans-VariableFont_wght.ttf",
            r"C:\Users\hosom\Downloads\Work_Sans\WorkSans-VariableFont_wght.ttf"
        ]:
            if os.path.exists(candidate):
                font_path = candidate
                break

    font = ImageFont.truetype(font_path, font_size)

    # Padding accounting for stroke expansion and optical edge falloff
    thick_val = float(stroke_thickness)
    pad = 40 + max(0, int(abs(thick_val) * 2.5))

    # 1. Render base text mask with crisp character spacing
    if letter_spacing > 0 and len(text) > 1:
        total_w = 0
        max_h = 0
        char_bboxes = []
        for ch in text:
            bbox = font.getbbox(ch)
            cw = bbox[2] - bbox[0]
            ch_h = bbox[3] - bbox[1]
            char_bboxes.append((ch, bbox, cw, ch_h))
            total_w += cw + letter_spacing
            if ch_h > max_h:
                max_h = ch_h
        total_w -= letter_spacing

        full_bbox = font.getbbox(text)
        top_offset = full_bbox[1]
        w = max(50, total_w + pad * 2)
        h = max(30, (full_bbox[3] - full_bbox[1]) + pad * 2)

        mask_img = Image.new("L", (w, h), 0)
        draw = ImageDraw.Draw(mask_img)

        curr_x = pad
        for ch, bbox, cw, ch_h in char_bboxes:
            draw.text((curr_x - bbox[0], pad - top_offset), ch, font=font, fill=255)
            curr_x += cw + letter_spacing
    else:
        left, top, right, bottom = font.getbbox(text)
        w = max(50, (right - left) + pad * 2)
        h = max(30, (bottom - top) + pad * 2)

        mask_img = Image.new("L", (w, h), 0)
        draw = ImageDraw.Draw(mask_img)
        draw.text((pad - left, pad - top), text, font=font, fill=255)

    base_mask = np.array(mask_img, dtype=np.float32) / 255.0

    # 1b. Stroke Thickness Adjustment (Corner-Preserving Signed Distance Transform)
    if abs(thick_val) > 0.05:
        bin_mask = (base_mask > 0.45).astype(np.uint8)
        if bin_mask.max() > 0:
            dist_in_base = cv2.distanceTransform(bin_mask, cv2.DIST_L2, 5)
            dist_out_base = cv2.distanceTransform(1 - bin_mask, cv2.DIST_L2, 5)
            signed_dist = dist_in_base - dist_out_base
            thickened = np.clip(signed_dist + thick_val + 0.5, 0.0, 1.0)
            base_mask = thickened

    # 2. Smooth Optical & Thermal Laser Edge Transition (TEM00 Gaussian Beam Profile)
    # Replaces harsh binary stair-steps with organic, smooth optical antialiasing matching macro photos
    smooth_mask = cv2.GaussianBlur(base_mask, (7, 7), 1.6)

    # 3. Exact Distance Transform for Laser Trench & Raised Melt Recast Lip
    bin_core = (base_mask > 0.4).astype(np.uint8)
    dist = cv2.distanceTransform(bin_core, cv2.DIST_L2, 5)

    # Raised recast lip (bright highlight bead near edge)
    outer_lip = np.exp(-((dist - float(outer_lip_dist)) ** 2) / 6.0) * float(outer_lip_intensity)
    # Inner trench depression (recessed groove inside stroke)
    inner_trench = -np.exp(-((dist - float(inner_trench_dist)) ** 2) / 12.0) * float(inner_trench_intensity)

    # 4. Organic Melt Slag & Micro-Pitted Metal Texture
    rng = np.random.default_rng(int(seed) if seed is not None else 18780)
    coarse_noise = rng.normal(0, 1, (max(1, h // 4), max(1, w // 7))).astype(np.float32)
    slag = cv2.resize(coarse_noise, (w, h), interpolation=cv2.INTER_CUBIC)
    slag = (slag - slag.min()) / (slag.max() - slag.min() + 1e-6)

    fine_noise = rng.normal(0, 1, (h, w)).astype(np.float32)
    fine_noise = cv2.GaussianBlur(fine_noise, (3, 3), 0)

    # Galvo laser raster hatch inside the trench
    y_grid, x_grid = np.mgrid[0:h, 0:w].astype(np.float32)
    p = max(2.0, float(pitch))
    scan_hatch = np.cos((y_grid + x_grid * float(saw_angle)) * (2.0 * np.pi / p)) * 0.07

    height_map = (
        0.56
        + (slag - 0.5) * float(slag_noise_weight)
        + fine_noise * float(fine_noise_weight)
        + scan_hatch
        + outer_lip
        + inner_trench
    )
    height_map = np.clip(height_map, 0.0, 1.0)

    # 5. Dual-Branch Oxidation Colors Calibrated to Macro Photos
    c_dark = hex_to_bgr(c_dark_hex, [104, 114, 126])   # #7e7268 (Thermal edge & trench)
    c_mid = hex_to_bgr(c_mid_hex, [131, 149, 166])     # #a69583 (Warm brass/anodize body)
    c_light = hex_to_bgr(c_light_hex, [155, 174, 192]) # #c0ae9b (Specular recast rim)

    low_branch = height_map < 0.5
    t_low = (height_map * 2.0)[..., None]
    t_high = ((height_map - 0.5) * 2.0)[..., None]

    bgr = np.where(
        low_branch[..., None],
        c_dark + (c_mid - c_dark) * t_low,
        c_mid + (c_light - c_mid) * t_high
    )

    # Smooth Heat Affected Zone (HAZ) edge darkening seamlessly blending into chassis
    edge_darken = np.clip(dist / 3.5, 0.48, 1.0)[..., None]
    bgr = bgr * edge_darken

    # 6. Continuous Antialiased Alpha Channel
    alpha = np.clip(smooth_mask * 255.0, 0.0, 255.0).astype(np.uint8)

    bgra = np.dstack([bgr.astype(np.uint8), alpha])

    # Crop tightly around rendered text
    coords = cv2.findNonZero((alpha > 2).astype(np.uint8))
    if coords is not None:
        x, y, cw, ch = cv2.boundingRect(coords)
        cp = max(0, int(crop_pad))
        x1, y1 = max(0, x - cp), max(0, y - cp)
        x2, y2 = min(w, x + cw + cp), min(h, y + ch + cp)
        result = bgra[y1:y2, x1:x2]
    else:
        result = bgra

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        cv2.imwrite(output_path, result)

    return result
