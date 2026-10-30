#!/usr/bin/env python3
"""ペルソナ01〜11のサンプル(意向・課題整理総括表・ケアプラン)を、samples_src/ のファイルで samples.js に入れる。

samples_src/persona_XX_意向.txt・persona_XX_課題整理.txt・persona_XX_ケアプラン.txt の中身を、文字を変えずに使う
(最後の改行だけ除く。_作業用/build_samples.py と同じ扱い)。12〜15 のサンプルと、samples.js のほかの部分は変えない。
ペルソナ番号とサンプルのidの対応は personas.js と同じ(01〜10 → v3-01〜v3-10、11〜15 → v2-01〜v2-05)。
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "samples_src"
SAMPLES_JS = HERE.parent.parent / "samples.js"

LABEL = {
    "01": "80歳女性・認知症初期・老老介護", "02": "76歳男性・心不全で入退院・独居(遠距離介護)",
    "03": "78歳男性・脳梗塞後の左片麻痺・福祉用具", "04": "85歳女性・大腿骨骨折の術後・日中独居",
    "05": "74歳男性・パーキンソン病の日内変動", "06": "88歳女性・認知症のBPSD・8050",
    "07": "82歳男性・COPDの在宅酸素・心房細動", "08": "90歳女性・血管性認知症・夜間の介護",
    "09": "79歳女性・末期がん・看取り", "10": "86歳男性・胃ろう・寝たきり",
}


def sample_id(no):
    n = int(no)
    return f"v3-{n:02d}" if n <= 10 else f"v2-{n - 10:02d}"


def read(no, kind):
    return (SRC / f"persona_{no}_{kind}.txt").read_text(encoding="utf-8").rstrip("\n")


def main():
    s = SAMPLES_JS.read_text(encoding="utf-8")
    head = "window.CM_SAMPLES="
    start = s.index(head) + len(head)
    end = s.index("\n];\n", start) + 2
    arr = json.loads(s[start:end])
    by_id = {e["id"]: e for e in arr}
    for n in range(1, 12):
        no = f"{n:02d}"
        d = json.loads((HERE / "data" / f"persona_{no}.json").read_text(encoding="utf-8"))
        e = by_id[sample_id(no)]
        e["name"] = d["概況調査"]["氏名"]
        e["level"] = d["認定結果"]["要介護度"]
        e["label"] = LABEL.get(no, e["label"])
        e["wish"] = read(no, "意向")
        e["issue"] = read(no, "課題整理")
        e["plan"] = read(no, "ケアプラン")
        assert e["issue"].startswith("[issue-summary-v1]") and e["plan"].startswith("[careplan-v1]"), no
        levels = set(re.findall(r"要(?:介護|支援)\d", e["issue"] + e["plan"]))
        assert levels <= {e["level"]}, f"{no}: サンプルに出てくる要介護度{levels}がPDF({e['level']})と違う"
        assert e["wish"].splitlines()[0].split(":")[1].strip("「」")[:6] in d["概況調査"]["本人・家族の主訴"].replace("「", "").replace("」", ""), f"{no}: 意向がPDFの主訴と違う"
        print(no, e["id"], e["name"], e["level"], "|", e["label"])
    new = json.dumps(arr, ensure_ascii=False, indent=0)
    SAMPLES_JS.write_text(s[:start] + new + s[end:], encoding="utf-8")


if __name__ == "__main__":
    main()
