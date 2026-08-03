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


# ---------------------------------------------------------------------------
# The dormant half of the engine.
#
# The shipped catalogue publishes no output price, no context window, no
# deployment or retention record and no input modalities: those five fields are
# null for all 330 models. So every specification comparison short-circuits to
# "__unknown__" and the blended-cost branch never runs. Roughly a third of the
# join is therefore never executed by the real data, and would light up
# unreviewed the day the catalogue gains those columns.
#
# This catalogue populates them. It is written into the fixture so the port
# replays the identical inputs rather than a second transcription of them.
# ---------------------------------------------------------------------------
SPEC_MODELS = [
    # Fully specified, cheap, weak. Passes low bands, fails high ones.
    {"model_id": "Budget One (non-reasoning)", "vendor": "Acme",
     "benchmarks": {"intelligence": 20.0, "gpqa": None, "briefcase": None, "reliability": 5.0},
     "cost_input_per_1m": 0.10, "cost_output_per_1m": 0.40,
     "throughput_tokens_per_sec": 250, "context_window_tokens": 16000,
     "data_handling": [], "assurance": [], "input_modalities": ["text"],
     "frontier": None},
    # Mid tier with retention control and audit logging, text and image.
    {"model_id": "Middle Two (medium effort)", "vendor": "OpenAI",
     "benchmarks": {"intelligence": 45.0, "gpqa": 90.0, "briefcase": 900,
                    "reliability": 40.5},
     "cost_input_per_1m": 2.0, "cost_output_per_1m": None,
     "throughput_tokens_per_sec": 80, "context_window_tokens": 200000,
     "data_handling": ["zero_retention_available"], "assurance": ["audit_logging"],
     "input_modalities": ["text", "image"], "frontier": None},
    # Fully controlled, expensive, every modality, reproducible output.
    {"model_id": "Fortress Three (Adaptive Reasoning, Max Effort)", "vendor": "Anthropic",
     "benchmarks": {"intelligence": 60.0, "gpqa": 93.0, "briefcase": 1600,
                    "reliability": 66.0},
     "cost_input_per_1m": 9.0, "cost_output_per_1m": 45.0,
     "throughput_tokens_per_sec": 40.0, "context_window_tokens": 500000,
     "data_handling": ["zero_retention_available", "vpc_or_private", "residency_control"],
     "assurance": ["audit_logging", "certifications", "output_reproducibility"],
     "input_modalities": ["text", "image", "audio"], "frontier": "On frontier"},
    # Strong but publishes nothing about deployment: must not be assumed either way.
    {"model_id": "Opaque Four (high)", "vendor": "Google",
     "benchmarks": {"intelligence": 55.0, "gpqa": 92.0, "briefcase": 1400,
                    "reliability": 60.0},
     "cost_input_per_1m": 4.0, "cost_output_per_1m": None,
     "throughput_tokens_per_sec": None, "context_window_tokens": None,
     "data_handling": None, "assurance": None, "input_modalities": None,
     "frontier": "On frontier"},
    # Unpriced: reported, never costed, never ranked above a priced peer.
    {"model_id": "Unpriced Five", "vendor": "Nobody",
     "benchmarks": {"intelligence": 58.0, "gpqa": None, "briefcase": None,
                    "reliability": 70.0},
     "cost_input_per_1m": None, "cost_output_per_1m": None,
     "throughput_tokens_per_sec": 10, "context_window_tokens": 4000,
     "data_handling": ["zero_retention_available"], "assurance": ["audit_logging"],
     "input_modalities": ["text"], "frontier": None},
    # A China-based vendor, to check the exclusion still bites on this catalogue.
    {"model_id": "Great Wall Six (xhigh)", "vendor": "DeepSeek",
     "benchmarks": {"intelligence": 57.0, "gpqa": 91.0, "briefcase": 1300,
                    "reliability": 55.0},
     "cost_input_per_1m": 0.5, "cost_output_per_1m": 1.0,
     "throughput_tokens_per_sec": 120, "context_window_tokens": 128000,
     "data_handling": ["zero_retention_available", "vpc_or_private"],
     "assurance": ["audit_logging", "certifications"],
     "input_modalities": ["text", "image"], "frontier": None},
]


def spec_profile(overrides, base=10):
    """A full 18-requirement profile at `base`, with named requirements raised."""
    p = {f"CAP-{i:02d}": {"score": base,
                          "critical": "Mandatory" if base >= 70 else "Desirable",
                          "evidence_class": "D"} for i in range(1, 19)}
    for cap, (score, critical) in overrides.items():
        p[cap] = {"score": score, "critical": critical, "evidence_class": "D"}
    return p


def spec_cases():
    """One case per specification requirement per band, plus the awkward ones."""
    cases = []
    for cap in ("CAP-09", "CAP-13", "CAP-14", "CAP-15", "CAP-16", "CAP-17"):
        for band in BANDS_ALL:
            cases.append({
                "name": f"{cap}-mandatory-{band}",
                "role": {"role_id": f"SPEC-{cap}-{band}", "name": cap,
                         "profile": spec_profile({cap: (band, "Mandatory")}),
                         "headcount": 10},
                "kw": {}, "constraints": None,
            })
    # Every specification mandatory at once: the residency-and-assurance case
    # that eliminates most of a catalogue before capability is considered.
    cases.append({
        "name": "all-specs-at-90",
        "role": {"role_id": "SPEC-ALL-90", "name": "Everything",
                 "profile": spec_profile({c: (90, "Mandatory") for c in
                                          ("CAP-09", "CAP-13", "CAP-14", "CAP-15",
                                           "CAP-16", "CAP-17")}),
                 "headcount": 3},
        "kw": {}, "constraints": None})
    # Blended cost: two of these models publish an output price and two do not,
    # so the ranking mixes a real blend with a vendor-ratio estimate.
    cases.append({
        "name": "blended-cost-ranking",
        "role": {"role_id": "SPEC-COST", "name": "Cost",
                 "profile": spec_profile({}), "headcount": 25},
        "kw": {"usage": "heavy"}, "constraints": None})
    cases.append({
        "name": "blended-cost-ratio-override",
        "role": {"role_id": "SPEC-COST-2", "name": "Cost",
                 "profile": spec_profile({}), "headcount": 25},
        "kw": {"out_multiple": 2.0, "effort_adjust": False}, "constraints": None})
    # China-based vendors admitted, so the exclusion path is tested both ways.
    cases.append({
        "name": "cn-admitted",
        "role": {"role_id": "SPEC-CN", "name": "CN",
                 "profile": spec_profile({"CAP-01": (70, "Mandatory")}), "headcount": 4},
        "kw": {"exclude_cn": False}, "constraints": None})
    # Headcount stated as null. The reference defaults only on an absent key, so
    # a null headcount is one seat, not sixty.
    cases.append({
        "name": "headcount-null",
        "role": {"role_id": "SPEC-HC", "name": "Null headcount",
                 "profile": spec_profile({}), "headcount": None},
        "kw": {}, "constraints": None})
    cases.append({
        "name": "headcount-absent",
        "role": {"role_id": "SPEC-HC2", "name": "Absent headcount",
                 "profile": spec_profile({})},
        "kw": {}, "constraints": None})
    # The only survivor is a model with no price. The engine's own comment says
    # unpriced models "cannot be recommended, only reported" — and that holds
    # right up until one is the last model standing, at which point it is the
    # recommendation and there is no cost to show for it.
    cases.append({
        "name": "unpriced-model-is-the-only-survivor",
        "role": {"role_id": "SPEC-UNPRICED", "name": "Unpriced", "headcount": 2,
                 "profile": spec_profile({"CAP-01": (90, "Mandatory"),
                                          "CAP-11": (90, "Mandatory")})},
        "kw": {}, "constraints": None})
    # Nothing clears at all, on a role senior enough to allocate anyway.
    IMPOSSIBLE = {"CAP-01": (90, "Mandatory"), "CAP-13": (90, "Mandatory"),
                  "CAP-16": (90, "Mandatory")}
    cases.append({
        "name": "executive-fallback",
        "role": {"role_id": "SPEC-EXEC", "name": "Chief", "seniority": "Leader",
                 "authority": "Strategic", "headcount": 2,
                 "profile": spec_profile(IMPOSSIBLE)},
        "kw": {}, "constraints": None})
    # The same profile without the seniority: not supported, and that is a real
    # answer about the market rather than a failure to find one.
    cases.append({
        "name": "not-supported",
        "role": {"role_id": "SPEC-NONE", "name": "Nobody", "headcount": 9,
                 "profile": spec_profile(IMPOSSIBLE)},
        "kw": {}, "constraints": None})
    # Duty decomposition on a role that fails as a whole but is mostly doable.
    cases.append({
        "name": "duty-decomposition",
        "role": {"role_id": "SPEC-DUTY", "name": "Mixed", "headcount": 7,
                 "profile": spec_profile(IMPOSSIBLE),
                 "duties": [
                     {"duty": "Something easy", "profile": spec_profile({})},
                     {"duty": "Something regulated",
                      "profile": spec_profile({"CAP-14": (90, "Mandatory")})},
                     {"duty": "Something demanding",
                      "profile": spec_profile({"CAP-01": (90, "Mandatory")})},
                     {"duty": "Something impossible",
                      "profile": spec_profile(IMPOSSIBLE)}]},
        "kw": {}, "constraints": None})
    # Buyer constraints against this catalogue.
    cases.append({
        "name": "vendor-excluded",
        "role": {"role_id": "SPEC-EXCL", "name": "Excluded",
                 "profile": spec_profile({}), "headcount": 5},
        "kw": {}, "constraints": {"excluded_vendors": ["Anthropic", "OpenAI"]}})
    # Calibration pushed both ways against a six-model axis.
    for off in (-40, 40):
        cases.append({
            "name": f"offset-{off}",
            "role": {"role_id": f"SPEC-OFF{off}", "name": "Offset",
                     "profile": spec_profile({"CAP-01": (50, "Mandatory")}),
                     "headcount": 5},
            "kw": {"offset_pct": off}, "constraints": None})
    return cases


BANDS_ALL = [10, 30, 50, 70, 90]


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

    # The specification and cost paths the shipped catalogue cannot reach.
    out["spec"] = {"models": SPEC_MODELS, "cases": []}
    for case in spec_cases():
        sm = json.loads(json.dumps(SPEC_MODELS))
        e = Engine(sm, json.loads(json.dumps(axes["calibration"])),
                   axes["capability_names"], **case["kw"])
        a = e.assess(json.loads(json.dumps(case["role"])), case["constraints"])
        out["spec"]["cases"].append({
            "name": case["name"], "role": case["role"], "kw": case["kw"],
            "constraints": case["constraints"], "warnings": e.warnings,
            "answer": a["answer"], "detail": rec_summary(a["detail"]),
            "duties": a["detail"].get("duties"),
            "health": e.health() if case["name"] == "blended-cost-ranking" else None,
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), sort_keys=True)
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB), "
          f"{len(roles)} roles x {len(CONFIGS)} configs, "
          f"{len(out['spec']['cases'])} specification cases")


if __name__ == "__main__":
    main()
