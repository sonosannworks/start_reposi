#!/usr/bin/env python3
"""Claude版のペルソナPDF(src_claude/)の内容を、build_persona_pdf.py 用のデータ(JSON)に書き出す。

基本調査の答えは、○(曲線)の中にある文字を選択肢と照らし合わせて読み取る。
使い方: python extract_claude.py 11   # data/claude_11_extracted.json を作る(元の内容そのまま)
"""
import glob
import json
import re
import sys
import unicodedata

import pdfplumber

from build_persona_pdf import BASIC, BEHAVIOR, HERE, NETAKIRI, NINCHI, SPECIAL


def norm(s):
    s = unicodedata.normalize("NFKC", s or "").replace("⻑", "長").replace("*", "＊").replace("〇", "○")
    return s.strip()


def flat(s):
    return re.sub(r"\s+", "", norm(s))


def unwrap(s):
    """表の中で折り返された行をつなぐ。項目番号・「〇〇:」・「本人:「」などで始まる行の区切りは残す。"""
    out = []
    for l in [l.strip() for l in norm(s).split("\n") if l.strip()]:
        new_item = re.match(r"^(\d-\d+|[^:「、。]{1,8}:|[^:「]{1,8}:「)", l)
        if out and not new_item:
            out[-1] += l
        else:
            out.append(l)
    return "\n".join(out)


def circled(page):
    """○で囲まれた文字と、その上下の位置。"""
    found = []
    for c in page.curves:
        chars = [ch for ch in page.chars if ch["x0"] >= c["x0"] - 1 and ch["x1"] <= c["x1"] + 1 and ch["top"] >= c["top"] - 1 and ch["bottom"] <= c["bottom"] + 1]
        chars.sort(key=lambda ch: (round(ch["top"]), ch["x0"]))
        found.append(((c["top"] + c["bottom"]) / 2, flat("".join(ch["text"] for ch in chars))))
    return found


def row_bands(page):
    """左の列(項目名)の行ごとに、上下の範囲と項目名。"""
    words = page.extract_words(keep_blank_chars=True, x_tolerance=1.5)
    starts = sorted([(w["top"], flat(w["text"])) for w in words if w["x0"] < 60])
    return starts


def read_basic(pdf):
    answers = {}
    options = {code: (choices or BEHAVIOR) for _, items in BASIC for code, _, choices in items}
    jiritsu = {}
    for page in pdf.pages[1:3]:
        starts = row_bands(page)
        circ = circled(page)
        for mid, txt in circ:
            # この○より上で一番近い行の頭(項目番号など)
            above = [s for s in starts if s[0] <= mid + 2]
            if not above:
                continue
            head = above[-1][1]
            m = re.match(r"^(\d-\d+)", head)
            if m:
                code = m.group(1)
                opt = next((o for o in options[code] if flat(o) == txt), None)
                assert opt, f"{code}: 選択肢に「{txt}」がない"
                answers.setdefault(code, []).append(opt)
            elif head.startswith("障害高齢者"):
                jiritsu["障害高齢者"] = next(o for o in NETAKIRI if flat(o) == txt)
            elif head.startswith("認知症高齢者"):
                jiritsu["認知症高齢者"] = next(o for o in NINCHI if norm(o) == txt or flat(o) == txt)
    out = {}
    for code in options:
        v = answers.get(code)
        assert v, f"{code}: ○が見つからない"
        out[code] = v if code in ("1-1", "1-2") and len(v) > 1 else v[0]
    text = norm(pdf.pages[2].extract_text())
    special = [s for s in SPECIAL if "■" + flat(s) in flat(text)]
    return out, special, jiritsu


def cells(page):
    return [[norm(c) for c in r] for t in page.extract_tables() for r in t]


def box_after(text, title, until):
    m = re.search(re.escape(title) + r"\n(.+?)\n" + until, text, re.S)
    return unwrap(m.group(1)) if m else ""


def extract(no):
    src = glob.glob(str(HERE / "src_claude" / f"ペルソナ{no}_*.pdf"))[0]
    with pdfplumber.open(src) as pdf:
        # 1ページ目: 概況調査
        rows = cells(pdf.pages[0])
        c = {r[0]: r for r in rows}
        t1 = norm(pdf.pages[0].extract_text())
        name, kana = c["対象者氏名"][1].split("\n")
        g = {"実施日時": c["実施日時"][1], "実施場所": c["実施場所"][1], "記入者氏名・所属": c["記入者氏名・所属"][1],
             "過去の認定": c["過去の認定"][1], "氏名": name, "ふりがな": kana.strip("()"), "性別": c["対象者氏名"][3],
             "年齢": c["生年月日"][3], "生年月日": c["生年月日"][1], "現住所": c["現住所"][1], "家族等連絡先": c["家族等連絡先"][1],
             "サービスの状況": box_after(t1, "現在受けているサービスの状況", r"(?:IV|Ⅳ) ")}
        for k in ("家族状況", "居住環境", "使用している機器等", "生活歴", "本人・家族の主訴"):
            g[k] = unwrap(c[k][1])
        # 2・3ページ目: 基本調査
        basic, special, jiritsu = read_basic(pdf)
        # 4ページ目: 特記事項
        tokki = {r[0].replace("\n", ""): unwrap(r[1]) for r in cells(pdf.pages[3]) if r[0]}
        # 5ページ目: 主治医意見書
        p5 = pdf.pages[4]
        t5 = norm(p5.extract_text())
        r5 = cells(p5)
        c5 = {r[0].replace("\n", ""): r for r in r5 if r[0]}
        diag = [[re.sub(r"^\d+\.\s*", "", r[0]), [x for x in r if x][-1]] for r in r5 if re.match(r"^\d+\.", r[0] or "")]   # 発症年月日は行の最後の欄
        ik = {
            "申請者": c5["申請者"][1], "診断名": diag, "安定性": c5["(2)症状としての安定性"][1],
            "経過及び治療内容": unwrap(c5["(3)経過及び治療内容"][1]),
            "特別な医療": box_after(t5, "特別な医療(過去14日間以内に受けた医療)", r"3\. "),
            "心身の状態": {k: unwrap(c5[k][1]) for k in ("(1)日常生活の自立度等", "(2)認知症の中核症状", "(3)認知症の行動・心理症状", "(4)その他の精神・神経症状", "(5)身体の状態")},
            "生活機能とサービス": {k: unwrap(c5[k][1]) for k in ("(1)移動", "(2)栄養・食生活", "(3)現在あるかまたは今後発生の可能性の高い状態とその対処方針",
                                                         "(4)サービス利用による生活機能の維持・改善の見通し", "(5)医学的管理の必要性",
                                                         "(6)サービス提供時における医学的観点からの留意事項", "(7)感染症の有無")},
            "特記すべき事項": re.sub(r"\n", "", t5.split("特記すべき事項")[-1]).strip(),
        }
    return {"概況調査": g, "基本調査": basic, "特別な医療": special, "日常生活自立度": jiritsu, "特記事項": tokki, "主治医意見書": ik}


if __name__ == "__main__":
    no = sys.argv[1]
    d = extract(no)
    p = HERE / "data" / f"claude_{no}_extracted.json"
    p.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", p.name)
