"""Contrast check for css/tokens.css — light and dark.

Not wired into Jest: run it by hand after touching a colour token.

    python3 test/check_contrast.py

Text pairs must clear 4.5:1 (WCAG 1.4.3) and boundary pairs 3:1 (1.4.11).
--inchi-rule-hairline is exempt by design: it separates rows inside a surface
whose own edge already bounds it, and no control takes its border from it.
"""
import re, sys, pathlib

TOKENS = pathlib.Path(__file__).resolve().parent.parent / "pages/css/tokens.css"


def decls(block):
    return dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", block))


def block_after(text, selector):
    i = text.index(selector)
    start = text.index("{", i) + 1
    depth, j = 1, start
    while depth:
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
        j += 1
    return decls(text[start:j - 1])


tokens = TOKENS.read_text()
LIGHT = block_after(tokens, ":root {")
DARK = {**LIGHT, **block_after(tokens, ':root[data-theme="dark"]')}

# ---- colour ---------------------------------------------------------------
def parse(value, env, backdrop=None):
    """-> (r, g, b) composited over `backdrop` if the value carries alpha."""
    value = value.strip()
    m = re.fullmatch(r"var\((--[\w-]+)\)", value)
    if m:
        return parse(env[m.group(1)], env, backdrop)
    m = re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", value)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.fullmatch(r"rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*/\s*([\d.]+)\s*\)", value)
    if m:
        r, g, b, a = (float(x) for x in m.groups())
        assert backdrop is not None, f"alpha colour {value} needs a backdrop"
        return tuple(c * a + d * (1 - a) for c, d in zip((r, g, b), backdrop))
    raise ValueError(f"unparsed colour: {value!r}")

def lum(rgb):
    def ch(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(fg, bg):
    a, b = sorted((lum(fg), lum(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)

# ---- what has to hold -----------------------------------------------------
TEXT, NONTEXT = 4.5, 3.0
PAIRS = [
    ("ink", "ground", TEXT), ("ink", "field", TEXT), ("ink", "field-sunken", TEXT),
    ("ink-muted", "ground", TEXT), ("ink-muted", "field", TEXT),
    ("ink-muted", "field-sunken", TEXT),
    ("ink-faint", "field", TEXT), ("ink-faint", "field-sunken", TEXT),
    ("brand", "ground", TEXT), ("brand", "field", TEXT),
    ("on-brand", "brand", TEXT),
    ("error", "ground", TEXT), ("error", "field", TEXT),
    ("ink", "error-quiet", TEXT), ("ink", "brand-quiet", TEXT),
    ("selection-text", "selection-bg", TEXT),
    ("ink", "highlight/field", TEXT),
    ("rule-hairline", "field", NONTEXT), ("rule-hairline", "ground", NONTEXT),
    ("rule-hairline", "field-sunken", NONTEXT),
    ("rule", "ground", NONTEXT), ("rule", "field", NONTEXT),
    ("rule-stroke", "field", NONTEXT), ("rule-stroke", "ground", NONTEXT),
    ("highlight-edge/field", "field", NONTEXT),
]
def colour(spec, env):
    """A token name, or 'a/b' meaning token a composited over token b."""
    if "/" in spec:
        top, under = spec.split("/")
        return parse(env["--inchi-" + top], env, parse(env["--inchi-" + under], env))
    return parse(env["--inchi-" + spec], env)

EXEMPT = {
    "rule-hairline": "elevation carries the boundary; the hairline separates "
                     "rows only (control borders use --inchi-rule)",
}

fails, waived = [], []
for mode, env in (("light", LIGHT), ("dark", DARK)):
    for fg, bg, minimum in PAIRS:
        r = ratio(colour(fg, env), colour(bg, env))
        if r < minimum:
            why = EXEMPT.get(fg)
            (waived if why else fails).append((mode, f"{fg} on {bg}", r, minimum, why))

if not fails:
    print("PASS — every pair clears its threshold in both themes.")
else:
    print(f"{len(fails)} failing pair(s):\n")
    for mode, pair, r, minimum, _ in fails:
        print(f"  {mode:5} {pair:36} {r:>7.2f}:1  needs {minimum}:1")
if waived:
    print("\nDeliberate deviations (decorative, not a control boundary):\n")
    for mode, pair, r, _, why in waived:
        print(f"  {mode:5} {pair:36} {r:.2f}:1  — {why}")

sys.exit(1 if fails else 0)
