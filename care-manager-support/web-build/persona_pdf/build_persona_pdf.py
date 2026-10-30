#!/usr/bin/env python3
"""ペルソナの認定情報PDFを、Claude版(11〜15)と同じ書式で作る。

使い方(このフォルダで実行):
    python build_persona_pdf.py data/persona_01.json            # HTMLとPDFを out/ に作る
    python build_persona_pdf.py data/persona_01.json --install  # personas/ の .pdf と .js も置き換える

データ(JSON)の各値は [値, 区分, 元の内容] の形でも書ける。
区分は「読替」(元の答えを書式に合わせて読み替え)・「新規」(元になく架空の値で埋めた)・「移動」(元の内容を別の欄へ移した)・
「変更」(元の文を、ほかの値との矛盾・誤字・アプリ検証用のメモを理由に書き換えた)。
PDFには値だけを使い、区分と元の内容は報告用(report)に使う。
"""
import argparse
import base64
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PERSONAS_DIR = HERE.parent.parent / "personas"

# ---------- 基本調査(74項目)の選択肢 ----------
BASIC = [
    ("第1群 身体機能・起居動作", [
        ("1-1", "麻痺等の有無<br><small>(複数選択可)</small>", ["ない", "左上肢", "右上肢", "左下肢", "右下肢", "その他(四肢の欠損)"]),
        ("1-2", "拘縮の有無<br><small>(複数選択可)</small>", ["ない", "肩関節", "股関節", "膝関節", "その他(四肢の欠損)"]),
        ("1-3", "寝返り", ["つかまらないでできる", "何かにつかまればできる", "できない"]),
        ("1-4", "起き上がり", ["つかまらないでできる", "何かにつかまればできる", "できない"]),
        ("1-5", "座位保持", ["できる", "自分の手で支えればできる", "支えてもらえればできる", "できない"]),
        ("1-6", "両足での立位保持", ["支えなしでできる", "何か支えがあればできる", "できない"]),
        ("1-7", "歩行", ["つかまらないでできる", "何かにつかまればできる", "できない"]),
        ("1-8", "立ち上がり", ["つかまらないでできる", "何かにつかまればできる", "できない"]),
        ("1-9", "片足での立位", ["支えなしでできる", "何か支えがあればできる", "できない"]),
        ("1-10", "洗身", ["介助されていない", "一部介助", "全介助", "行っていない"]),
        ("1-11", "つめ切り", ["介助されていない", "一部介助", "全介助"]),
        ("1-12", "視力", ["普通(日常生活に支障がない)", "約1m離れた視力確認表の図が見える", "目の前に置いた視力確認表の図が見える", "ほとんど見えない", "見えているのか判断不能"]),
        ("1-13", "聴力", ["普通", "普通の声がやっと聞き取れる", "かなり大きな声なら何とか聞き取れる", "ほとんど聞えない", "聞えているのか判断不能"]),
    ]),
    ("第2群 生活機能", [
        ("2-1", "移乗", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("2-2", "移動", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("2-3", "えん下", ["できる", "見守り等", "できない"]),
        ("2-4", "食事摂取", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("2-5", "排尿", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("2-6", "排便", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("2-7", "口腔清潔", ["介助されていない", "一部介助", "全介助"]),
        ("2-8", "洗顔", ["介助されていない", "一部介助", "全介助"]),
        ("2-9", "整髪", ["介助されていない", "一部介助", "全介助"]),
        ("2-10", "上衣の着脱", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("2-11", "ズボン等の着脱", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("2-12", "外出頻度", ["週1回以上", "月1回以上", "月1回未満"]),
    ]),
    ("第3群 認知機能", [
        ("3-1", "意思の伝達", ["調査対象者が意思を他者に伝達できる", "ときどき伝達できる", "ほとんど伝達できない", "できない"]),
        ("3-2", "毎日の日課を理解", ["できる", "できない"]),
        ("3-3", "生年月日や年齢を言う", ["できる", "できない"]),
        ("3-4", "短期記憶", ["できる", "できない"]),
        ("3-5", "自分の名前を言う", ["できる", "できない"]),
        ("3-6", "今の季節を理解する", ["できる", "できない"]),
        ("3-7", "場所の理解", ["できる", "できない"]),
        ("3-8", "徘徊", ["ない", "ときどきある", "ある"]),
        ("3-9", "外出すると戻れない", ["ない", "ときどきある", "ある"]),
    ]),
    ("第4群 精神・行動障害", [
        ("4-1", "物を盗られたなどと被害的になる", None),
        ("4-2", "作話", None),
        ("4-3", "泣いたり、笑ったりして感情が不安定になる", None),
        ("4-4", "昼夜の逆転がある", None),
        ("4-5", "しつこく同じ話をする", None),
        ("4-6", "大声をだす", None),
        ("4-7", "介護に抵抗する", None),
        ("4-8", "「家に帰る」等と言い落ち着きがない", None),
        ("4-9", "一人で外に出たがり目が離せない", None),
        ("4-10", "いろいろなものを集めたり、無断でもってくる", None),
        ("4-11", "物を壊したり、衣類を破いたりする", None),
        ("4-12", "ひどい物忘れ", None),
        ("4-13", "意味もなく独り言や独り笑いをする", None),
        ("4-14", "自分勝手に行動する", None),
        ("4-15", "話がまとまらず、会話にならない", None),
    ]),
    ("第5群 社会生活への適応", [
        ("5-1", "薬の内服", ["介助されていない", "一部介助", "全介助"]),
        ("5-2", "金銭の管理", ["介助されていない", "一部介助", "全介助"]),
        ("5-3", "日常の意思決定", ["できる(特別な場合でもできる)", "特別な場合を除いてできる", "日常的に困難", "できない"]),
        ("5-4", "集団への不適応", ["ない", "ときどきある", "ある"]),
        ("5-5", "買い物", ["介助されていない", "見守り等", "一部介助", "全介助"]),
        ("5-6", "簡単な調理", ["介助されていない", "見守り等", "一部介助", "全介助"]),
    ]),
]
BEHAVIOR = ["ない", "ときどきある", "ある"]   # 第4群の選択肢
SPECIAL = ["点滴の管理", "中心静脈栄養", "透析", "ストーマ(人工肛門)の処置", "酸素療法", "レスピレーター(人工呼吸器)",
           "気管切開の処置", "疼痛の看護", "経管栄養", "モニター測定(血圧、心拍、酸素飽和度等)", "じょくそうの処置",
           "カテーテル(コンドームカテーテル、留置カテーテル、ウロストーマ等)"]
NETAKIRI = ["自立", "J1", "J2", "A1", "A2", "B1", "B2", "C1", "C2"]
NINCHI = ["自立", "Ⅰ", "Ⅱa", "Ⅱb", "Ⅲa", "Ⅲb", "Ⅳ", "M"]

CSS = """
@page { size: A4; margin: 16mm 12mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Noto Serif JP", "Yu Mincho", "MS Mincho", serif; font-size: 9.2pt; line-height: 1.42; color: #111; }
section { break-before: page; }
section:first-of-type { break-before: auto; }
h1 { position: relative; text-align: center; font-size: 15pt; font-weight: 700; letter-spacing: .35em; margin: 0 0 10px; }
.head { position: relative; }
.mark { position: fixed; top: 2px; right: 0;   /* 印刷すると全ページの右上に出る */
        font-family: "Noto Sans JP", "Yu Gothic", sans-serif; font-size: 8pt; color: #c00;
        border: 1px solid #c00; padding: 2px 6px; letter-spacing: 0; font-weight: 400; line-height: 1.3; }
h2 { font-size: 10.5pt; font-weight: 700; margin: 11px 0 4px; padding-left: 8px; border-left: 4px solid #111; line-height: 1.35; }
table { width: 100%; border-collapse: collapse; border: 1.5px solid #111; margin: 0; }
th, td { border: 1px solid #111; padding: 2.5px 6px; text-align: left; vertical-align: top; font-weight: 400; }
tr { page-break-inside: avoid; }
td.k { width: 22%; white-space: nowrap; }
td small, th small { font-size: 8pt; }
.basic td.k { width: 30%; white-space: normal; }
.basic td.grp { font-weight: 400; }
.opt { margin-right: 1.1em; white-space: nowrap; }   /* 選択肢の途中では折り返さない */
.opt.on { display: inline-block; white-space: nowrap; }
.opt.on { border: 1px solid #111; border-radius: 999px; padding: 0 5px; margin-left: -6px; margin-right: calc(1.1em - 6px); line-height: 1.25; }
.lead { font-size: 8.6pt; margin: 0 0 4px; }
.special { font-size: 8.6pt; padding: 4px 6px; border: 1.5px solid #111; }
.special span { margin-right: 1em; white-space: nowrap; display: inline-block; }
.result { width: 62%; margin: 0 0 18px; }
.result td.k { width: 40%; }
.result-title { font-size: 11pt; font-weight: 700; margin: 0 0 5px; padding-left: 8px; border-left: 4px solid #111; }
.note { font-size: 8pt; margin: 3px 0 0; color: #333; }
.ikensho td.k { width: 27%; white-space: normal; }
.ikensho td.d { width: 30%; white-space: nowrap; }
.tokki td.k { width: 24%; white-space: nowrap; }
.br { white-space: pre-line; }
"""


def v(x):
    """[値, 区分, 元] の形なら値だけを返す。"""
    return x[0] if isinstance(x, list) and len(x) >= 2 and x[1] in ("読替", "新規", "移動", "変更") else x


def esc(s):
    return html.escape(str(s))


def options(choices, picked):
    picked = picked if isinstance(picked, list) else [picked]
    return "".join(f'<span class="opt{" on" if c in picked else ""}">{esc(c)}</span>' for c in choices)


def kv_rows(rows):
    return "".join(f'<tr><td class="k">{esc(k)}</td><td class="br">{esc(v(val))}</td></tr>' for k, val in rows)


def page1_html(d):
    """1ページ目(認定結果と概況調査)。"""
    P = d["概況調査"]
    return f"""
<section>
  <p class="result-title">認定結果(テスト用設定)</p>
  <table class="result">{kv_rows(d["認定結果"].items())}</table>
  <h1>認定調査票(概況調査)</h1>
  <h2>Ⅰ 調査実施者(記入者)</h2>
  <table>{kv_rows([("実施日時", P["実施日時"]), ("実施場所", P["実施場所"]), ("記入者氏名・所属", P["記入者氏名・所属"])])}</table>
  <h2>Ⅱ 調査対象者</h2>
  <table>
    <tr><td class="k">過去の認定</td><td colspan="3">{esc(v(P["過去の認定"]))}</td></tr>
    <tr><td class="k">対象者氏名</td><td>{esc(P["氏名"])}<br><small>({esc(P["ふりがな"])})</small></td><td class="k" style="width:12%">性別</td><td>{esc(P["性別"])}</td></tr>
    <tr><td class="k">生年月日</td><td>{esc(v(P["生年月日"]))}</td><td class="k">年齢</td><td>{esc(P["年齢"])}</td></tr>
    <tr><td class="k">現住所</td><td colspan="3">{esc(v(P["現住所"]))}</td></tr>
    <tr><td class="k">家族等連絡先</td><td colspan="3">{esc(v(P["家族等連絡先"]))}</td></tr>
  </table>
  <h2>Ⅲ 現在受けているサービスの状況</h2>
  <table><tr><td class="br">{esc(v(P["サービスの状況"]))}</td></tr></table>
  <h2>Ⅳ 置かれている環境等(調査対象者の家族状況、調査対象者の居住環境、日常的に使用する機器・器械の有無等)</h2>
  <table>{kv_rows([(k, P[k]) for k in ("家族状況", "居住環境", "使用している機器等", "生活歴", "本人・家族の主訴")])}</table>
</section>"""


def doc_html(title, body):
    return f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>{esc(title)}</title>
<style>{CSS}</style></head><body><div class="mark">テスト用架空事例</div>{body}</body></html>"""


def build_html(d):
    page1 = page1_html(d)

    B = d["基本調査"]
    rows = []
    for gname, items in BASIC:
        rows.append(f'<tr><td class="grp" colspan="2">{esc(gname)}</td></tr>')
        for code, label, choices in items:
            rows.append(f'<tr><td class="k">{code} {label}</td><td>{options(choices or BEHAVIOR, v(B[code]))}</td></tr>')
    sp = d["特別な医療"]
    sp_checked = v(sp) or []
    J = d["日常生活自立度"]
    page2 = f"""
<section class="basic">
  <h1>認定調査票(基本調査)</h1>
  <p class="lead">該当する選択肢を○で囲んでいます。</p>
  <table>{''.join(rows)}</table>
  <h2>その他 過去14日間に受けた特別な医療</h2>
  <div class="special">{''.join(f'<span>{"■" if s in sp_checked else "□"}{esc(s)}</span>' for s in SPECIAL)}</div>
  <h2>日常生活自立度</h2>
  <table>
    <tr><td class="k">障害高齢者の日常生活自立度(寝たきり度)</td><td>{options(NETAKIRI, v(J["障害高齢者"]))}</td></tr>
    <tr><td class="k">認知症高齢者の日常生活自立度</td><td>{options(NINCHI, v(J["認知症高齢者"]))}</td></tr>
  </table>
</section>"""

    page3 = f"""
<section class="tokki">
  <h1>認定調査票(特記事項)</h1>
  <table>{''.join(f'<tr><td class="k">{esc(k)}</td><td class="br">{esc(chr(10).join(v(x) for x in val) if isinstance(val, list) and val and isinstance(val[0], list) else v(val))}</td></tr>' for k, val in d["特記事項"].items())}</table>
</section>"""

    I = d["主治医意見書"]
    diag = "".join(f'<tr><td colspan="2">{i+1}. {esc(v(n))}</td><td class="d">{esc(v(t))}</td></tr>' for i, (n, t) in enumerate(I["診断名"]))
    page4 = f"""
<section class="ikensho">
  <h1>主治医意見書</h1>
  <table><tr><td class="k">申請者</td><td>{esc(I["申請者"])}</td></tr></table>
  <h2>1. 傷病に関する意見</h2>
  <table>
    <tr><td colspan="2">(1)診断名</td><td class="d">発症年月日</td></tr>{diag}
    <tr><td class="k">(2)症状としての安定性</td><td colspan="2">{esc(v(I["安定性"]))}</td></tr>
    <tr><td class="k">(3)経過及び治療内容</td><td colspan="2" class="br">{esc(v(I["経過及び治療内容"]))}</td></tr>
  </table>
  <h2>2. 特別な医療(過去14日間以内に受けた医療)</h2>
  <table><tr><td>{esc(v(I["特別な医療"]))}</td></tr></table>
  <h2>3. 心身の状態に関する意見</h2>
  <table>{kv_rows(I["心身の状態"].items())}</table>
  <h2>4. 生活機能とサービスに関する意見</h2>
  <table>{kv_rows(I["生活機能とサービス"].items())}</table>
  <h2>5. 特記すべき事項</h2>
  <table><tr><td class="br">{esc(v(I["特記すべき事項"]))}</td></tr></table>
</section>"""

    return doc_html(d["file"], page1 + page2 + page3 + page4)


def to_pdf(html_path, pdf_path):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe")
        pg = b.new_page()
        pg.goto(html_path.as_uri(), wait_until="networkidle")
        pg.pdf(path=str(pdf_path), format="A4", prefer_css_page_size=True, print_background=True)
        b.close()


def install(pdf_path, d):
    """personas/ の .pdf(公開用の名前)と .js(ビューアのデータ)を置き換える。"""
    data = pdf_path.read_bytes()
    (PERSONAS_DIR / d["file"]).write_bytes(data)
    js_name = d["js"]
    key = js_name.replace(".js", ".pdf")
    b64 = base64.b64encode(data).decode("ascii")
    (PERSONAS_DIR / js_name).write_text(
        "window.cmPersonaPdf=window.cmPersonaPdf||{};\n"
        f"window.cmPersonaPdf['{key}']='{b64}';\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("--install", action="store_true")
    a = ap.parse_args()
    d = json.loads(Path(a.data).read_text(encoding="utf-8"))
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    stem = Path(a.data).stem
    h = out / f"{stem}.html"
    h.write_text(build_html(d), encoding="utf-8")
    pdf = out / f"{stem}.pdf"
    to_pdf(h, pdf)
    print("PDF:", pdf)
    if a.install:
        install(pdf, d)
        print("installed:", d["file"], d["js"])


if __name__ == "__main__":
    sys.exit(main())
