#!/usr/bin/env python3
"""Dump the reference Python engine's output so the TypeScript port can be
checked against it.

    python3 scripts/model-fit-baseline.py [path/to/pkg]

The integration package (02_engine/engine.py plus 01_data/) is the reference
implementation. It is not vendored into this repository, so this script reads
it from wherever it sits on disk and writes a baseline that
tests/model-fit-parity.test.ts replays against the port. Regenerate the
baseline whenever the reference engine or the data snapshot changes; if the
port then disagrees, the port is wrong.

The data is read from lib/model-fit/data/ (this repo's copy), not from the
package, so a divergence in the copied snapshot fails the parity test too.
"""
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/pkg")
DATA = os.path.join(REPO, "lib", "model-fit", "data")
OUT = os.path.join(REPO, "tests", "fixtures", "model-fit-python-baseline.json")

sys.path.insert(0, os.path.join(PKG, "02_engine"))
from engine import Engine  # noqa: E402

# Every control the interface exposes, at settings that exercise a different
# branch each time: the burn toggle, the calibration offset in both directions,
# the usage tier, the output-price ratio override, the China-vendor filter and
# a buyer vendor exclusion.
CONFIGS = [
    {"name": "default", "kw": {}, "constraints": None},
    {"name": "heavy-no-burn-offset-up",
     "kw": {"usage": "heavy", "effort_adjust": False, "offset_pct": 15, "exclude_cn": False},
     "constraints": None},
    {"name": "light-offset-down-ratio-4",
     "kw": {"usage": "light", "offset_pct": -20, "out_multiple": 4.0},
     "constraints": None},
    {"name": "vendors-excluded", "kw": {},
     "constraints": {"excluded_vendors": ["OpenAI", "Anthropic"]}},
]

# Synthetic profiles: the invariant checks in test_engine.py use these, and they
# reach shift and overflow combinations no real role in the library happens to hit.
SYNTHETIC = {
    "all-10": [10] * 18,
    "all-50": [50] * 18,
    "all-90": [90] * 18,
    "broad-70": [70] * 8 + [10] * 10,
    "one-90": [90] + [10] * 17,
    "tier-90-narrow": [10] * 10 + [90] + [10] * 7,
}


def synth(scores):
    return {f"CAP-{i + 1:02d}": {"score": v,
                                 "critical": "Mandatory" if v >= 70 else "Desirable",
                                 "evidence_class": "D"}
            for i, v in enumerate(scores)}


def rec_summary(r):
    return {
        "pick": r["pick"]["model_id"] if r["pick"] else None,
        "live": len(r["live"]),
        "live_head": [m["model_id"] for m in r["live"][:8]],
        "live_miss_head": [m["_miss"] for m in r["live"][:8]],
        "eliminated": len(r["eliminated"]),
        "elim_head": [
            {"model": e["model"], "requirement": e["requirement"], "reason": e["reason"]}
            for e in r["eliminated"][:5]
        ],
        "unassessed": r["unassessed"],
        "deciding": r["deciding"],
        "tier": r["tier"],
        "breadth": r["breadth"],
        "shift": r["shift"],
        "consequence_shift": r["consequence_shift"],
        "breadth_shift": r["breadth_shift"],
        "confidence": r["confidence"],
        "limited_by": r["limited_by"],
    }


def main():
    with open(os.path.join(DATA, "models.json")) as f:
        models = json.load(f)
    with open(os.path.join(DATA, "roles.json")) as f:
        roles = json.load(f)
    with open(os.path.join(DATA, "axes-and-calibration.json")) as f:
        axes = json.load(f)

    out = {
        "generated_from": os.path.join(PKG, "02_engine", "engine.py"),
        "roles": len(roles),
        "models": len(models),
        "configs": [],
        "synthetic": [],
        "health": None,
    }

    for cfg in CONFIGS:
        # A fresh catalogue per config: the reference engine annotates model
        # dicts in place, so re-using one copy would leak state between runs.
        m = json.loads(json.dumps(models))
        eng = Engine(m, json.loads(json.dumps(axes["calibration"])),
                     axes["capability_names"], **cfg["kw"])
        if cfg["name"] == "default":
            out["health"] = eng.health()
        rows = {}
        for rid, role in roles.items():
            a = eng.assess(json.loads(json.dumps({**role, "role_id": rid})),
                           cfg["constraints"])
            rows[rid] = {"answer": a["answer"], "detail": rec_summary(a["detail"]),
                         "duties": a["detail"].get("duties")}
        out["configs"].append({"name": cfg["name"], "kw": cfg["kw"],
                               "constraints": cfg["constraints"], "warnings": eng.warnings,
                               "rows": rows})

    m = json.loads(json.dumps(models))
    eng = Engine(m, json.loads(json.dumps(axes["calibration"])), axes["capability_names"])
    for name, scores in SYNTHETIC.items():
        out["synthetic"].append({"name": name, "scores": scores,
                                 "recommend": rec_summary(eng.recommend(synth(scores)))})

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), sort_keys=True)
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB), "
          f"{len(roles)} roles x {len(CONFIGS)} configs")


if __name__ == "__main__":
    main()
