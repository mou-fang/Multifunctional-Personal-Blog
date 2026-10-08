"""Rebuild the pinned paint catalogue/model and independent Python reference fixtures.

Development only: Python, NumPy and SciPy are required by the upstream model.
The website and node tests consume the generated JSON without Python.
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
BASE = ROOT / "libs/paint-data-20261008"
UPSTREAM = BASE / "paintmixing"
if not hasattr(np, "trapz"):
    np.trapz = np.trapezoid  # NumPy 2 compatibility, same trapezoidal integration.
spec = importlib.util.spec_from_file_location("paint_reference", UPSTREAM / "PaintMixing.py")
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)
database = reference.PaintDatabase([str(UPSTREAM / name) for name in ["masstone.json", "mix1.json"]])
model = database.get_mixing_model()
wavelengths = model.paint_parameters["white"]["K"].wavelengths
cmf = reference.Colorimetry.predefined_spectra
scale = (cmf["Y"] * cmf["D65"]).integrate()
# Pre-integrate a basis for the EXACT upstream interpolation/trapezoidal grid.
xyz_weights = []
for channel in ["X", "Y", "Z"]:
    coefficients = []
    for index in range(len(wavelengths)):
        values = np.zeros_like(wavelengths)
        values[index] = 1.0
        spectrum = reference.Spectrum(wavelengths, values)
        coefficients.append(float((spectrum * cmf["D65"] * cmf[channel]).integrate() / scale))
    xyz_weights.append(coefficients)

labels = {"white": "白色", "cold yellow": "冷黄", "warm yellow": "暖黄", "yellow oxide": "氧化黄", "orange": "橙色", "red": "红色", "red oxide": "氧化红", "magenta": "品红", "violet": "紫色", "blue red shade": "红相蓝", "blue green shade": "绿相蓝", "green": "绿色", "black": "黑色"}
paints = []
for name in database.masstones:
    parameters = model.paint_parameters[name]
    assert min(parameters["K"].values) >= 0 and min(parameters["S"].values) > 0, name
    sample = model.mix([(database.get_paint(name), 1.0)])
    rgb = reference.Colorimetry.reflectance_to_rgb(sample)
    paints.append({"id": "kimera-" + name.replace(" ", "-"), "name": name.title(), "label": labels[name], "brand": "Kimera", "range": "Pure Pigments · PaintMixing 实测集", "type": "opaque", "binder": "acrylic", "hex": "#" + "".join(f"{round(float(x) * 255):02X}" for x in rgb), "group": "paintmixing-kimera-v1", "K": parameters["K"].values.tolist(), "S": parameters["S"].values.tolist()})

model_data = {"format": "claudeOne.paint-model", "version": 1, "convention": "two-diffuse-flux-4R", "illuminant": "D65", "observer": "CIE1931-2", "basis": "mass", "source": "https://github.com/miciwan/PaintMixing/tree/d14a2d10f72c78f8338e2bb5a34773affb377796", "wavelengths": wavelengths.tolist(), "xyzWeights": xyz_weights, "paints": paints}
(BASE / "kimera-model.json").write_text(json.dumps(model_data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

ranges = json.loads((BASE / "paintdex/ranges.json").read_text(encoding="utf-8"))["ranges"]
catalogue = []
for path in sorted((BASE / "paintdex").glob("*.json")):
    if path.name == "ranges.json":
        continue
    for paint in json.loads(path.read_text(encoding="utf-8")):
        metadata = ranges.get(paint["brand"], {}).get(paint["range"], {})
        record = {key: paint[key] for key in ["id", "name", "brand", "range", "type", "hex", "code", "metallic", "discontinued"] if key in paint}
        record["binder"] = metadata.get("binder", "unknown")
        record["delivery"] = metadata.get("format", "brush")
        catalogue.append(record)
catalogue.extend({key: value for key, value in paint.items() if key not in ["K", "S"]} for paint in paints)
assert len({paint["id"] for paint in catalogue}) == len(catalogue)
(BASE / "catalogue.json").write_text(json.dumps({"version": 1, "paints": catalogue}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
if (BASE / "sheik-mainland/source-records.json").exists():
    chief_spec = importlib.util.spec_from_file_location("chief_catalogue", ROOT / "scripts/build-chief-data.py")
    chief_module = importlib.util.module_from_spec(chief_spec)
    chief_spec.loader.exec_module(chief_module)
    chief_module.build()

combinations = [[(name, 1.0)] for name in database.masstones] + [[("cold yellow", .5), ("blue green shade", .5)], [("white", .7), ("red", .3)], [("white", .6), ("yellow oxide", .3), ("red oxide", .1)], [("white", .43), ("black", .07), ("cold yellow", .22), ("blue red shade", .28)]]
fixtures = []
for recipe in combinations:
    spectrum = model.mix([(database.get_paint(name), float(weight)) for name, weight in recipe])
    fixtures.append({"recipe": [{"id": "kimera-" + name.replace(" ", "-"), "weight": weight} for name, weight in recipe], "xyz": list(map(float, reference.Colorimetry.reflectance_to_xyz(spectrum))), "rgb": list(map(float, reference.Colorimetry.reflectance_to_rgb(spectrum))), "reflectance": spectrum.values.tolist()})
calibration = []
for name, sample in database.measurments.items():
    if sample["type"] == "mix":
        calibration.append({"recipe": [{"id": "kimera-" + key.replace(" ", "-"), "weight": weight} for key, weight in sample["components"].items()], "reflectance": sample["reflectance"].values.tolist()})
fixture_path = ROOT / "server/fixtures/paint-mixer-reference.json"
fixture_path.write_text(json.dumps({"source": model_data["source"], "fixtures": fixtures, "calibration": calibration}, separators=(",", ":")), encoding="utf-8")
example = {"format": "claudeOne.paint-measurements", "version": 1, "name": "Kimera 公开样本导入示例", "group": "example-kimera", "basis": "mass", "binder": "acrylic", "wavelengths": wavelengths.tolist(), "white": {"name": "公开样本基准白", "reflectance": database.get_paint("white")["reflectance"].values.tolist()}, "paints": []}
for name in ["cold yellow", "red", "blue green shade"]:
    sample = next(s for s in database.measurments.values() if s["type"] == "mix" and name in s["components"])
    example["paints"].append({"id": "example-kimera-" + name.replace(" ", "-"), "name": name.title(), "reflectance": database.get_paint(name)["reflectance"].values.tolist(), "tints": [{"paintMass": sample["components"][name], "whiteMass": sample["components"]["white"], "reflectance": sample["reflectance"].values.tolist()}]})
example["source"] = model_data["source"] + " (CC BY 4.0)"
(ROOT / "server/fixtures/paint-measurement-example.json").write_text(json.dumps(example, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
manifest = {str(path.relative_to(BASE)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(BASE.rglob("*")) if path.is_file() and path.name not in ["manifest.json", "README.md"] and "__pycache__" not in str(path)}
(BASE / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(f"Generated {len(catalogue)} catalogue entries, {len(paints)} calibrated paints, {len(fixtures)} reference mixtures, {len(calibration)} fitted tint samples.")
