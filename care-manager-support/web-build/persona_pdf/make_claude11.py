#!/usr/bin/env python3
"""ペルソナ11(山下キヨ)を、元のClaude版の内容から全ページ作り直す。

1. extract_claude.py で元のPDFの内容をデータにする
2. 直し(FIX)を入れ、認定結果を足して data/persona_11.json を作る
3. 確認: 直しを入れないデータから作ったPDFの文字が元のPDFと同じこと、
         直したPDFと元のPDFの文字の違いが、直した所だけであることを機械で比べる
使い方: python make_claude11.py            # out/ に作って確認する
        python make_claude11.py --install  # personas/ の .pdf と .js も置き換える
"""
import argparse
import difflib
from collections import Counter
import glob
import json
import re
import unicodedata

import pdfplumber

from build_persona_pdf import HERE, build_html, install, to_pdf
from extract_claude import extract

NO = "11"
BASE = {"file": "ペルソナ11_要介護1_架空事例.pdf", "js": "persona_11_yamashita_kiyo.js",
        "認定結果": {"要介護度": "要介護1", "認定日": "令和8年11月10日(テスト用)", "認定の有効期間": "令和8年12月1日〜令和9年11月30日(12か月)(テスト用)"}}

# 直し: (場所, 元の文字, 新しい文字)
FIX = [
    (("概況調査", "過去の認定"), "更新申請(前回:要支援1)", "更新申請(前回:要介護1)"),
    (("概況調査", "サービスの状況"), "介護予防・日常生活支援総合事業 通所型サービス(週1回)。", "通所介護(週1回)。"),
    (("特記事項", "第2群 生活機能"), "総合事業の通所(週1回)", "通所介護(週1回)"),
    (("主治医意見書", "安定性"), "安定", "不安定(膝の痛みの増悪により、半年以内に状態が変わる見込み)"),
    (("主治医意見書", "生活機能とサービス", "(5)医学的管理の必要性"), "(または介護予防の運動の機会)", "(または通所介護での運動の機会)"),
]


def apply_fix(d):
    for path, old, new in FIX:
        box = d
        for k in path[:-1]:
            box = box[k]
        assert box[path[-1]].count(old) == 1 if old != "安定" else box[path[-1]] == old, f"{path}: 「{old}」が見つからない"
        box[path[-1]] = box[path[-1]].replace(old, new) if old != "安定" else new
    return d


def text_of(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        t = "".join(pg.extract_text() or "" for pg in pdf.pages)
    t = unicodedata.normalize("NFKC", t).replace("⻑", "長").replace("*", "＊").replace("〇", "○")
    t = t.replace("テスト用架空事例", "")
    t = re.sub(r"認定結果\(テスト用設定\).*?(?=認定調査票)", "", re.sub(r"\s+", "", t))   # 足した認定結果の欄は比べない
    return re.sub(r"\s+", "", t)


def diff(a, b):
    """文字の違い。表の左の欄が折り返された所で読み取りの順番が入れ替わるだけの違い(同じ文字が移動しただけ)は除く。"""
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    pairs = [(a[i1:i2], b[j1:j2]) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
    removed = Counter("".join(o for o, _ in pairs))
    added = Counter("".join(n for _, n in pairs))
    moved = removed & added
    return [(o, n) for o, n in pairs if Counter(o) - moved or Counter(n) - moved or (o and n)], removed - added, added - removed


def build(d, stem):
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    h = out / f"{stem}.html"
    h.write_text(build_html(d), encoding="utf-8")
    to_pdf(h, out / f"{stem}.pdf")
    return out / f"{stem}.pdf"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--install", action="store_true")
    a = ap.parse_args()
    src = glob.glob(str(HERE / "src_claude" / f"ペルソナ{NO}_*.pdf"))[0]
    original = extract(NO)

    plain = build({**BASE, **json.loads(json.dumps(original))}, f"check_{NO}_nofix")
    _, gone, new = diff(text_of(src), text_of(plain))
    print("(a) 直しを入れずに作り直したPDF と 元のPDF: なくなった文字", dict(gone) or "なし", "/ 増えた文字", dict(new) or "なし")

    fixed = apply_fix({**BASE, **json.loads(json.dumps(original))})
    fixed["安定性の理由"] = "要介護1。膝の痛みの増悪により、半年以内に状態が変わる見込みのため「不安定」(認知症自立度は自立のまま)"
    (HERE / "data" / f"persona_{NO}.json").write_text(json.dumps(fixed, ensure_ascii=False, indent=1), encoding="utf-8")
    pdf = build(fixed, f"persona_{NO}")
    pairs, gone, new = diff(text_of(src), text_of(pdf))
    olds = Counter(re.sub(r"\s+", "", "".join(o for _, o, _ in FIX)))   # PDFの文字は空白を除いて比べている
    news = Counter(re.sub(r"\s+", "", "".join(n for _, _, n in FIX)))
    want_gone, want_new = olds - news, news - olds
    print("(b) 直したPDF と 元のPDF の文字の違いが、直しの分だけか:", gone == want_gone and new == want_new)
    for old, nw in pairs:
        print(f"    「{old}」→「{nw}」")
    if a.install:
        install(pdf, fixed)
        print("installed:", fixed["file"], fixed["js"])


if __name__ == "__main__":
    main()
