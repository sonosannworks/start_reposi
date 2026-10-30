#!/usr/bin/env python3
"""ペルソナ12〜15(Claude版)に「認定結果(テスト用設定)」の欄を足す。

1ページ目(概況調査)は、元のPDF(src_claude/)から表の文字を読み取り、build_persona_pdf.py と同じ書式で
認定結果の欄と一緒に作り直す(FIX に書いた直しもここで入れる)。2ページ目以降は元のPDFのまま使い、
「テスト用架空事例」の印がないページ(基本調査の続きのページ)にだけ、ほかのページと同じ位置で印を重ねる。
使い方: python add_kekka_claude.py            # out/ に作る
        python add_kekka_claude.py --install  # personas/ の .pdf と .js も置き換える
"""
import argparse
import re
import shutil
import unicodedata

import pdfplumber
from pypdf import PdfReader, PdfWriter

from build_persona_pdf import HERE, PERSONAS_DIR, doc_html, install, page1_html, to_pdf

# 調査の実施日はいずれも「令和8年10月 日」。認定日はその後、有効期間は申請の種類に合わせた(すべて新規の値)
KEKKA = {
    "12": ("ペルソナ12_要介護1_架空事例.pdf", "persona_12_kimura_shoichi.js", "要介護1", "令和8年11月5日", "令和8年10月1日〜令和9年3月31日(6か月)", "新規申請。申請日(令和8年10月1日と想定)から"),
    "13": ("ペルソナ13_要介護2_架空事例.pdf", "persona_13_nakamura_haruko.js", "要介護2", "令和8年11月6日", "令和8年10月1日〜令和9年3月31日(6か月)", "新規申請(退院前)。申請日(令和8年10月1日と想定)から"),
    "14": ("ペルソナ14_要介護3_架空事例.pdf", "persona_14_oda_shigeru.js", "要介護3", "令和8年11月9日", "令和8年10月1日〜令和9年3月31日(6か月)", "区分変更申請(前回:要介護1)。申請日(令和8年10月1日と想定)から"),
    "15": ("ペルソナ15_要介護5_架空事例.pdf", "persona_15_hayashi_tomi.js", "要介護5", "令和8年11月12日", "令和8年12月1日〜令和9年11月30日(12か月)", "更新申請(前回:要介護5)。前回の期間の翌日から"),
}

# 11 は直す所が2ページ目以降にもあるため、make_claude11.py で全ページを作り直す
FIX = {}

# 元のClaude版の印と同じ横位置・大きさ。この続きのページは表が上端から始まるため、表にかからない高さに置く
MARK = ('<div style="position:absolute;left:485.6pt;top:12pt;width:75.8pt;height:17.3pt;border:0.75pt solid #bb0000;'
        'color:#bb0000;font:8pt/15.8pt Noto Sans JP,sans-serif;text-align:center;box-sizing:border-box;">テスト用架空事例</div>')


def norm(s):
    """PDFから読んだ文字を整える(互換文字を普通の文字に。伏せ字の全角＊はそのまま)。"""
    s = unicodedata.normalize("NFKC", s or "").replace("⻑", "長").replace("*", "＊").replace("〇", "○")
    return s.strip()


def unwrap(s):
    """表の中で折り返された行をつなぐ。「本人:」「長女:」などの話し手の行の区切りは残す。"""
    lines = [l.strip() for l in s.split("\n") if l.strip()]
    out = []
    for l in lines:
        if out and not re.match(r"^[^:「]{1,8}:「", l):
            out[-1] += l
        else:
            out.append(l)
    return "\n".join(out)


def read_gaikyo(src):
    """元の1ページ目から、概況調査の各欄を読み取る。"""
    with pdfplumber.open(src) as pdf:
        page = pdf.pages[0]
        rows = [[norm(c) for c in r] for t in page.extract_tables() for r in t]
        text = norm(page.extract_text())
    cell = {r[0]: r for r in rows}
    name, kana = cell["対象者氏名"][1].split("\n")
    service = re.search(r"現在受けているサービスの状況\n(.+?)\n(?:IV|Ⅳ) ", text, re.S).group(1)   # NFKCで「Ⅲ」「Ⅳ」は「III」「IV」になる
    g = {
        "実施日時": cell["実施日時"][1], "実施場所": cell["実施場所"][1], "記入者氏名・所属": cell["記入者氏名・所属"][1],
        "過去の認定": cell["過去の認定"][1], "氏名": name, "ふりがな": kana.strip("()"), "性別": cell["対象者氏名"][3],
        "年齢": cell["生年月日"][3], "生年月日": cell["生年月日"][1], "現住所": cell["現住所"][1], "家族等連絡先": cell["家族等連絡先"][1],
        "サービスの状況": unwrap(service),
    }
    for k in ("家族状況", "居住環境", "使用している機器等", "生活歴", "本人・家族の主訴"):
        g[k] = unwrap(cell[k][1])
    return g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--install", action="store_true")
    a = ap.parse_args()
    src_dir = HERE / "src_claude"
    src_dir.mkdir(exist_ok=True)
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    for no, (fname, js, level, day, period, _) in KEKKA.items():
        src = src_dir / fname
        if not src.exists():   # 初回だけ、元のClaude版を保存しておく
            shutil.copy2(PERSONAS_DIR / fname, src)
        g = read_gaikyo(src)
        g.update(FIX.get(no, {}))
        d = {"概況調査": g, "認定結果": {"要介護度": level, "認定日": f"{day}(テスト用)", "認定の有効期間": f"{period}(テスト用)"}}
        h = out / f"page1_{no}.html"
        h.write_text(doc_html(fname, page1_html(d)), encoding="utf-8")
        p1 = out / f"page1_{no}.pdf"
        to_pdf(h, p1)
        mark_pdf = out / "mark.pdf"
        (out / "mark.html").write_text('<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>@page{size:A4;margin:0}body{margin:0}</style></head><body>'
                                       + MARK + "</body></html>", encoding="utf-8")
        to_pdf(out / "mark.html", mark_pdf)

        first = PdfReader(p1)
        assert len(first.pages) == 1, f"{no}: 1ページ目が1ページに収まらない"
        reader = PdfReader(src)
        with pdfplumber.open(src) as o:
            no_mark = [i for i, pg in enumerate(o.pages) if "架空事例" not in norm(pg.extract_text())]
        writer = PdfWriter()
        writer.add_page(first.pages[0])
        for i, page in enumerate(reader.pages[1:], start=1):
            if i in no_mark:
                page.merge_page(PdfReader(mark_pdf).pages[0])
            writer.add_page(page)
        dst = out / f"persona_{no}.pdf"
        with open(dst, "wb") as f:
            writer.write(f)
        print(no, g["氏名"], "| 過去の認定:", g["過去の認定"], "| 印を足したページ:", [i + 1 for i in no_mark], "->", dst.name)
        if a.install:
            install(dst, {"file": fname, "js": js})


if __name__ == "__main__":
    main()
