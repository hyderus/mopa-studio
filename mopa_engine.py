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
    stroke_thickness=6.5,
    seed=18780,
    pitch=13.0,
    teeth_threshold=0.25,
    saw_angle=0.45,
    burr_shift_x=5.5,
    burr_shift_y=1.5,
    burr_weight=0.9,
    jitter_range=5,
    outer_lip_intensity=0.16,
    outer_lip_dist=2.5,
    inner_trench_intensity=0.3,
    inner_trench_dist=6.5,
    slag_noise_weight=0.45,
    fine_noise_weight=0.08,
    c_dark_hex="#4a2c14",
    c_mid_hex="#c99762",
    c_light_hex="#f2d39e",
    crop_pad=4,
    letter_spacing=20,
    output_path=None
):
    """
    Renders high-fidelity MOPA laser marked serial text with metallic melt trenches,
    micro-burrs, and optical interference coloring on a transparent BGRA canvas.
    Default parameters configured to:
      - Font: Work Sans Variable
      - Font Size: 281 px
      - Stroke Thickness: 6.5 px
      - Letter Spacing: 20 px
      - Crop Edge Margin: 4 px
      - Sawtooth Burr Pitch: 13.0
      - Galvo Scan Saw Angle: 0.45
      - Burr Teeth Density: 0.25
      - Scan-Line Edge Jitter: 5 px
      - Raised Melt Lip Height: 0.16
      - Inner Trench Depth: 0.3
      - Melt Slag Texture Roughness: 0.45
      - Random Noise Seed: 18780
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
            r"C:\Users\hosom\Downloads\Work_Sans\WorkSans-VariableFont_wght.ttf"
        ]:
            if os.path.exists(candidate):
                font_path = candidate
                break

    font = ImageFont.truetype(font_path, font_size)

    # Padding accounting for stroke expansion
    thick_val = float(stroke_thickness)
    pad = 40 + max(0, int(thick_val * 2.5))

    # 1. Render base text mask
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

    # 1b. Apply Stroke Thickness Adjustment (Thicker / Thinner)
    if abs(thick_val) > 0.05:
        bin_mask = (base_mask > 0.45).astype(np.uint8)
        if bin_mask.max() > 0:
            dist_in = cv2.distanceTransform(bin_mask, cv2.DIST_L2, 5)
            dist_out = cv2.distanceTransform(1 - bin_mask, cv2.DIST_L2, 5)
            signed_dist = dist_in - dist_out
            base_mask = np.clip(signed_dist + thick_val + 0.5, 0.0, 1.0)

    # 2. Angled sawtooth edge burrs
    rng = np.random.default_rng(int(seed) if seed is not None else 18780)
    y_grid, x_grid = np.mgrid[0:h, 0:w].astype(np.float32)

    # Periodic sawtooth pattern angled along galvo scan path
    pitch = max(1.0, float(pitch))
    saw_wave = ((y_grid + x_grid * float(saw_angle)) % pitch) / pitch
    teeth = (saw_wave > float(teeth_threshold)).astype(np.float32)

    # Shift mask right and down to form protruding burrs on trailing edges
    M_burr = np.float32([[1, 0, float(burr_shift_x)], [0, 1, float(burr_shift_y)]])
    shifted_mask = cv2.warpAffine(base_mask, M_burr, (w, h))
    burr_layer = shifted_mask * teeth

    # Fine random horizontal scan-line jitter along all edges
    jit_max = max(0, int(jitter_range))
    if jit_max > 0:
        row_jitter = rng.integers(-jit_max, jit_max + 1, size=(h, 1))
        jittered_mask = np.zeros_like(base_mask)
        for y in range(h):
            jittered_mask[y, :] = np.roll(base_mask[y, :], int(row_jitter[y, 0]))
    else:
        jittered_mask = base_mask

    combined = np.maximum(jittered_mask, burr_layer * float(burr_weight))
    combined_blur = cv2.GaussianBlur(combined, (5, 5), 1.0)
    solid_mask = (combined_blur > 0.38).astype(np.uint8) * 255

    # 3. Internal laser trench and melted metal texture
    dist = cv2.distanceTransform(solid_mask, cv2.DIST_L2, 5)

    # Galvo fill + contour pass: raised outer lip and dark inner trench
    outer_lip = np.exp(-((dist - float(outer_lip_dist)) ** 2) / 3.0) * float(outer_lip_intensity)
    inner_trench = -np.exp(-((dist - float(inner_trench_dist)) ** 2) / 5.0) * float(inner_trench_intensity)

    # Pitted slag texture stretched slightly along horizontal scan axis
    coarse_noise = rng.normal(0, 1, (max(1, h // 4), max(1, w // 7))).astype(np.float32)
    slag = cv2.resize(coarse_noise, (w, h), interpolation=cv2.INTER_CUBIC)
    slag = (slag - slag.min()) / (slag.max() - slag.min() + 1e-6)

    fine_noise = rng.normal(0, 1, (h, w)).astype(np.float32)
    fine_noise = cv2.GaussianBlur(fine_noise, (3, 3), 0)

    height_map = (
        0.58
        + (slag - 0.5) * float(slag_noise_weight)
        + fine_noise * float(fine_noise_weight)
        + outer_lip
        + inner_trench
    )
    height_map = np.clip(height_map, 0.0, 1.0)

    # 4. Map height values to colors (BGR order)
    c_dark = hex_to_bgr(c_dark_hex, [20, 44, 74])
    c_mid = hex_to_bgr(c_mid_hex, [98, 151, 201])
    c_light = hex_to_bgr(c_light_hex, [158, 211, 242])

    low_branch = height_map < 0.5
    t_low = (height_map * 2.0)[..., None]
    t_high = ((height_map - 0.5) * 2.0)[..., None]

    bgr = np.where(
        low_branch[..., None],
        c_dark + (c_mid - c_dark) * t_low,
        c_mid + (c_light - c_mid) * t_high
    )

    # Darken outermost edge for blending onto dark surfaces
    edge_darken = np.clip(dist / 2.0, 0.35, 1.0)[..., None]
    bgr = bgr * edge_darken

    # 5. Clean alpha channel
    alpha = cv2.GaussianBlur(solid_mask, (3, 3), 0.6)
    bgra = np.dstack([bgr.astype(np.uint8), alpha])

    # Crop tightly around rendered number
    coords = cv2.findNonZero(alpha)
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
