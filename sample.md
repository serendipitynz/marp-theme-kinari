---
marp: true
theme: kinari
paginate: true
footer: プログラムの読み方
---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: '' -->

# プログラムの読み方

Takuya Otani · @takkyun

---

## プログラミングスキル

コードを

# 読む時間 ＞ 書く時間

**コードを読む力を身につけよう！**

---

## エディタを選ぼう

- シンタックスサポート
  - カラーリング・補完機能など
- カスタマイズ
- マルチプラットフォーム

---

## エディタを選ぼう - IDE

- JetBrains 製 IDE
  - IntelliJ IDEA, Android Studio, WebStorm
- Visual Studio

> **IDE の不利点**
> サイズが大きい・動作が重い場合がある・環境を選ぶ場合がある

---

## コードを読もう

```swift
// Fill the list with random passwords
func generatePasswords() {
  var passwords = [String]()
  let charset = configuration.charset
  while passwords.count < numberOfPassword {
    var password = ""
    while password.count < configuration.numberOfChar {
      let offset = Int(arc4random_uniform(UInt32(charset.count - 1)))
      password += String(charset[charset.index(charset.startIndex, offsetBy: offset)])
    }
    passwords.append(password)
  }
  userDefault.set(passwords, forKey: "passwordArray")
}
```

**色でテキストの種類が把握できる**

---

## 読む順番

1. 入口を探す
2. データの流れを追う
3. *わからない所は飛ばす*

---

## プログラミング言語の共通点

| 構成要素 | 例 |
|---|---|
| 制御構文・条件分岐 | `if`, `switch`, `unless` |
| 制御構文・ループ | `for`, `while`, `map` |
| 変数 | `let`, `const`, `var` |

*ひとつ言語を覚えると、他の言語を追加で覚えるのが比較的ラクになる*

---

<!-- _class: invert -->

## invert のスライド

- 紙の裏側
- `invert` クラスで地とインクが入れ替わる

---

<!-- _class: lead -->
<!-- _paginate: false -->

# Thank you!

@takkyun
