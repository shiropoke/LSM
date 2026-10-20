# LSM — 最小二乗法カリキュレーター

入力したデータから、最小二乗法による近似直線を求めるWebアプリです。
React・Vite・Tailwind CSSを使用しています。

- ソースコード: https://github.com/shiropoke/LSM
- 公開先: https://shiropoke.github.io/LSM/
- ソースを保存するブランチ: `main`
- 公開用ファイルを保存するブランチ: `gh-pages`

## 必要な環境

- Git
- Node.js 22系の22.12.0以降とnpm（復元時の動作確認環境: Node.js 22.17.0 / npm 10.9.2）
- GitHubへ送信するときは、このリポジトリに書き込めるアカウントのGit認証

`.nvmrc`にはNode.js 22系を指定しています。nvmを利用する場合は、`nvm install`、`nvm use`で切り替えられます。

## ローカルで確認する

ターミナルでこのフォルダへ移動して実行します。

```sh
cd /Users/shiro/Documents/ChatGPT/LSM
npm ci
npm run dev
```

ターミナルに表示されるURLを開いてください。通常は http://localhost:5173/LSM/ です。
終了するときはターミナルで `Ctrl+C` を押します。
この復元済みフォルダでは依存ライブラリをインストール済みです。
`npm ci`は、再ダウンロードしたときや依存ライブラリを変更したときに実行します。

## 編集するファイル

- `src/App.jsx`: メイン画面と計算処理
- `src/pages/StdErrorCalculator.jsx`: 標準誤差の計算画面
- `src/index.css`、`src/App.css`: スタイル
- `public/`: アイコンなどの画像
- `index.html`: ページタイトルなど
- `vite.config.js`: ビルド設定。GitHub Pagesの公開パスは `base: "/LSM/"`

## 更新をGitHubに保存する

編集後、ソースコードを`main`へ保存します。

```sh
git status
git add .
git commit -m "サイトを更新"
git push origin main
```

これでソースコードの変更履歴がGitHubに残ります。
`node_modules/`と`dist/`は`.gitignore`で除外されているため、手動で追加する必要はありません。

## サイトをデプロイする

このフォルダで実行します。

```sh
npm run deploy
```

`predeploy`が自動で`npm run build`を実行し、生成した`dist/`の内容を
`origin`（`https://github.com/shiropoke/LSM.git`）の`gh-pages`ブランチへ送信します。
送信後、GitHub Pagesの公開処理が完了すると https://shiropoke.github.io/LSM/ に反映されます。

`npm run deploy`は公開用ファイルだけを送信します。
編集したソースコードは、前の手順で別途`main`に保存してください。

公開されない場合は、[GitHub Pagesの設定画面](https://github.com/shiropoke/LSM/settings/pages)で、以下を確認してください。

- Source: **Deploy from a branch**
- Branch: **gh-pages**
- Folder: **/ (root)**

GitHubへの送信時に認証エラーが出る場合は、ターミナル側のGit認証を設定してください。
GitHubアプリやブラウザでのログインとは別に、Gitからの認証が必要です。
`Author identity unknown`が出る場合は、`git config --local user.name`と
`git config --local user.email`で、このリポジトリのコミット作成者情報を設定してください。

## 公開用ビルドだけを確認する

```sh
npm run build
npm run preview
```

通常は http://localhost:4173/LSM/ で確認できます。この操作はGitHubへ送信しません。

## 別のPCやフォルダへ復元する

```sh
git clone https://github.com/shiropoke/LSM.git
cd LSM
npm ci
```

ソースコードを`main`へ保存しておけば、この手順で同じプロジェクトを復元できます。

参考: [gh-pagesの公式ドキュメント](https://github.com/tschaub/gh-pages#command-line-utility)、
[GitHub Pagesの公開元の設定](https://docs.github.com/ja/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
