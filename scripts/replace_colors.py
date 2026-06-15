#!/usr/bin/env python3
"""Replace hardcoded colours with CSS custom-property vars.

Context-aware: only matches colours inside CSS-property positions
(background:, color:, border:…, style.prop =) so that
AVATAR_COLORS arrays and other non-style strings are left alone.
"""
import re, sys, os

# ── token map ────────────────────────────────────────────────────────────────
# Ordered longest/most-specific first so shorter patterns don't partially match.

BG_MAP = [
    # Very dark (app bg)
    ('#0a0a0f',  'var(--dart-bg-app)'),
    ('#08080A',  'var(--dart-bg-app)'),
    ('#0B0B0E',  'var(--dart-bg-app)'),
    ('#0d0d0d',  'var(--dart-bg-app)'),
    # Card alt
    ('#0E0E11',  'var(--dart-bg-card-alt)'),
    ('#0F0F12',  'var(--dart-bg-card-alt)'),
    # Chip
    ('#16161A',  'var(--dart-bg-chip)'),
    ('#1e1e1e',  'var(--dart-bg-chip)'),
    ('#1a1800',  'var(--dart-bg-chip)'),   # amber-tinted dark
    ('#fff8e1',  'var(--dart-bg-chip)'),   # amber-tinted light  → chip in dark theme
    # Card  (dark)
    ('#121216',  'var(--dart-bg-card)'),
    ('#111111',  'var(--dart-bg-card)'),
    ('#1a1a1a',  'var(--dart-bg-card)'),
    ('#1A1A1A',  'var(--dart-bg-card)'),
    # Card  (old light → dark card in new theme)
    ('#f8f8f8',  'var(--dart-bg-card)'),
    ('#f5f5f5',  'var(--dart-bg-card)'),
    ('#f5f5f0',  'var(--dart-bg-card)'),
    ('#f0f0f0',  'var(--dart-bg-card)'),
    ('#ffffff',  'var(--dart-bg-card)'),
    # Border-like bg
    ('#e0e0e0',  'var(--dart-border)'),
    ('#ddd',     'var(--dart-border)'),
    ('#eee',     'var(--dart-border)'),
    # Chip (mid-dark buttons)
    ('#222222',  'var(--dart-bg-chip)'),
    ('#333333',  'var(--dart-bg-chip)'),
    ('#2a2a2a',  'var(--dart-border)'),
    ('#555555',  'var(--dart-bg-chip)'),
    # Gold
    ('#e8c44a',  'var(--dart-gold)'),
    ('#D4AF37',  'var(--dart-gold)'),
    ('#F4D77E',  'var(--dart-gold-light)'),
    ('#C9A227',  'var(--dart-gold-dark)'),
    # Success
    ('#2a7a2a',  'var(--dart-success)'),
    ('#2e7d32',  'var(--dart-success)'),
    ('#2EC971',  'var(--dart-success)'),
    ('#6bba8a',  'var(--dart-success)'),
    # Danger
    ('#C8362B',  'var(--dart-danger)'),
    ('#c62828',  'var(--dart-danger)'),
    ('#e53935',  'var(--dart-danger)'),
    ('#c00',     'var(--dart-danger)'),
    ('#C00',     'var(--dart-danger)'),
    # Warning
    ('#E8A53A',  'var(--dart-warning)'),
    ('#e8a53a',  'var(--dart-warning)'),
    ('#ff9800',  'var(--dart-warning)'),
]

# For bg, treat short 3-digit "#fff" specially (after all 6-digit patterns)
BG_MAP_SHORT = [
    ('#fff',  'var(--dart-bg-card)'),
    ('#ccc',  'var(--dart-border)'),  # inactive/off-state grey bg
    ('#111',  'var(--dart-bg-card)'),
    ('#222',  'var(--dart-bg-chip)'),
    ('#333',  'var(--dart-bg-chip)'),
    ('#555',  'var(--dart-bg-chip)'),
]

COLOR_MAP = [
    ('#ffffff', 'var(--dart-text)'),
    ('#FBFBF8', 'var(--dart-text)'),
    ('#C9C9D1', 'var(--dart-text-sec)'),
    ('#A6A6AE', 'var(--dart-text-sec)'),
    ('#cccccc', 'var(--dart-text-sec)'),
    ('#aaaaaa', 'var(--dart-text-sec)'),
    ('#999999', 'var(--dart-text-sec)'),
    ('#888888', 'var(--dart-text-sec)'),
    ('#666666', 'var(--dart-text-muted)'),
    ('#555555', 'var(--dart-text-muted)'),
    ('#333333', 'var(--dart-text-sec)'),
    ('#6E6E78', 'var(--dart-text-muted)'),
    ('#9A9AA2', 'var(--dart-text-ter)'),
    ('#7E7E86', 'var(--dart-text-muted)'),
    ('#1a1a1a', 'var(--dart-bg-card)'),  # very dark "text" → card bg token
    ('#1A1A1A', 'var(--dart-bg-card)'),
    ('#e8c44a', 'var(--dart-gold)'),
    ('#D4AF37', 'var(--dart-gold)'),
    ('#F4D77E', 'var(--dart-gold-light)'),
    ('#C9A227', 'var(--dart-gold-dark)'),
    ('#2e7d32', 'var(--dart-success)'),
    ('#2EC971', 'var(--dart-success)'),
    ('#6bba8a', 'var(--dart-success)'),
    ('#C8362B', 'var(--dart-danger)'),
    ('#c62828', 'var(--dart-danger)'),
    ('#e53935', 'var(--dart-danger)'),
    ('#c00',    'var(--dart-danger)'),
    ('#C00',    'var(--dart-danger)'),
    ('#E8A53A', 'var(--dart-warning)'),
    ('#e8a53a', 'var(--dart-warning)'),
    ('#ff9800', 'var(--dart-warning)'),
    ('#e91e63', 'var(--dart-danger)'),   # pink → danger (only in colour context)
]

COLOR_MAP_SHORT = [
    ('#fff', 'var(--dart-text)'),
    ('#ccc', 'var(--dart-text-sec)'),
    ('#aaa', 'var(--dart-text-sec)'),
    ('#999', 'var(--dart-text-sec)'),
    ('#888', 'var(--dart-text-sec)'),
    ('#777', 'var(--dart-text-muted)'),
    ('#666', 'var(--dart-text-muted)'),
    ('#555', 'var(--dart-text-muted)'),
    ('#333', 'var(--dart-text-sec)'),
]

BORDER_SOLID_MAP = [
    ('#e8c44a', 'var(--dart-gold)'),
    ('#D4AF37', 'var(--dart-gold)'),
    ('#e53935', 'var(--dart-danger)'),
    ('#C8362B', 'var(--dart-danger)'),
    ('#fdd',    'var(--dart-danger)'),
    ('#e0e0e0', 'var(--dart-border)'),
    ('#2a2a2a', 'var(--dart-border)'),
    ('#1a1a1a', 'var(--dart-border)'),
    ('#555555', 'var(--dart-border-alt)'),
    ('#333333', 'var(--dart-border)'),
    ('#444444', 'var(--dart-border)'),
    ('#ddd',    'var(--dart-border)'),
    ('#eee',    'var(--dart-border)'),
    ('#333',    'var(--dart-border)'),
    ('#444',    'var(--dart-border)'),
    ('#555',    'var(--dart-border-alt)'),
]

# JS style property direct assignments: style.background = "#COLOR"
# Also handle ternary: ?"#COLOR_A":"#COLOR_B"
JS_ASSIGN_BG = [*BG_MAP, *BG_MAP_SHORT]
JS_ASSIGN_COLOR = [*COLOR_MAP, *COLOR_MAP_SHORT]


def hex_word_end(color):
    """Return pattern for color with word-boundary at end."""
    # hex digits are \w chars, so \b works after them
    return re.escape(color) + r'\b'


def build_css_prop_pattern(prop_re, color):
    """
    Match   prop: COLOR   (property-name then optional space then color).
    Uses lookbehind so only the color itself is in group 0.
    """
    return r'(?<=' + prop_re + r'\s{0,4})' + hex_word_end(color)


def apply_map(content, prop_re, color_map, short_map):
    """Replace colours that follow a CSS property pattern."""
    n = 0
    # long (6-digit) first
    for old, new in color_map:
        pat = r'(' + prop_re + r'\s{0,4})' + hex_word_end(old)
        result, count = re.subn(pat, r'\g<1>' + new, content)
        n += count
        content = result
    # then short (3-digit)
    for old, new in short_map:
        pat = r'(' + prop_re + r'\s{0,4})' + hex_word_end(old)
        result, count = re.subn(pat, r'\g<1>' + new, content)
        n += count
        content = result
    return content, n


def process(content):
    total = 0
    c = content

    # ── 1. background: ────────────────────────────────────────────────────────
    c, n = apply_map(c, r'background:', BG_MAP, BG_MAP_SHORT)
    total += n

    # ── 2. color: ────────────────────────────────────────────────────────────
    c, n = apply_map(c, r'color:', COLOR_MAP, COLOR_MAP_SHORT)
    total += n

    # ── 3. border: 1px solid COLOR  (and border-top/bottom/left/right) ───────
    for old, new in BORDER_SOLID_MAP:
        # border: Xpx solid COLOR
        pat = r'(border(?:-\w+)?\s*:\s*\d+px\s+solid\s*)' + hex_word_end(old)
        result, n = re.subn(pat, r'\g<1>' + new, c)
        total += n; c = result
        # border-color: COLOR
        pat = r'(border-color\s*:\s*)' + hex_word_end(old)
        result, n = re.subn(pat, r'\g<1>' + new, c)
        total += n; c = result

    # ── 4. JS style property direct assignment ─────────────────────────────
    # style.background = "#COLOR"  or  style.background="#COLOR"
    for old, new in JS_ASSIGN_BG:
        pat = r"(style\.background\s*=\s*['\"])" + hex_word_end(old)
        result, n = re.subn(pat, r'\g<1>' + new, c)
        total += n; c = result

    for old, new in JS_ASSIGN_COLOR:
        pat = r"(style\.color\s*=\s*['\"])" + hex_word_end(old)
        result, n = re.subn(pat, r'\g<1>' + new, c)
        total += n; c = result

    # style.borderColor = "#COLOR"
    for old, new in BORDER_SOLID_MAP:
        pat = r"(style\.borderColor\s*=\s*['\"])" + hex_word_end(old)
        result, n = re.subn(pat, r'\g<1>' + new, c)
        total += n; c = result

    # ── 5. Specific ternary patterns in JS style assignments ──────────────────
    # These are the exact ternary forms found in app.js that won't be caught
    # by the CSS-property lookbehind patterns above.
    ternary = [
        ('?"#e8c44a":"#ccc"',     '?"var(--dart-gold)":"var(--dart-border)"'),
        ('?"#e8c44a": "#ccc"',    '?"var(--dart-gold)": "var(--dart-border)"'),
        ('?bcol:"#2a2a2a"',        '?bcol:"var(--dart-border)"'),
        ('?"#fff":"#666"',         '?"var(--dart-text)":"var(--dart-text-muted)"'),
        ('?"#fff": "#666"',        '?"var(--dart-text)": "var(--dart-text-muted)"'),
    ]
    for old, new in ternary:
        n = c.count(old)
        c = c.replace(old, new)
        total += n

    # ── 6. background-color: ─────────────────────────────────────────────────
    c, n = apply_map(c, r'background-color:', BG_MAP, BG_MAP_SHORT)
    total += n

    return c, total


def main():
    if len(sys.argv) < 2:
        print("Usage: replace_colors.py FILE [FILE ...]")
        sys.exit(1)

    for path in sys.argv[1:]:
        with open(path, 'r', encoding='utf-8') as f:
            original = f.read()
        result, count = process(original)
        if count:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(result)
        print(f"{path}: {count} replacements")


if __name__ == '__main__':
    main()
