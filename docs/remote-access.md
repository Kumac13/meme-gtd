# リモートアクセス設定ガイド

このガイドでは、meme-gtd WebUIにiPhoneなどの外部デバイスからアクセスする方法を説明します。

## 概要

Tailscaleを使用してローカルホストにセキュアにアクセスする方法を推奨します。

### Tailscaleを選ぶ理由

- **簡単で安全**: 追加のHTTPS設定や認証実装が不要
- **完全無料**: Tailscale無料プランで十分
- **暗号化**: すべての通信が自動的に暗号化
- **アクセス制御**: Tailscaleネットワークに参加している端末のみアクセス可能
- **実装変更不要**: 既存のコードをそのまま使用可能

## セットアップ手順

### 1. Tailscaleのインストール

#### Linuxサーバー（meme-gtdを動かすマシン）

```bash
# Tailscaleインストール
curl -fsSL https://tailscale.com/install.sh | sh

# Tailscale起動・認証（ブラウザが開いてログインを求められます）
sudo tailscale up

# 自分のTailscale IPアドレスを確認
tailscale ip -4
# 出力例: 100.123.45.67
```

このIPアドレスをメモしておいてください。iPhoneからアクセスする際に使用します。

#### iPhone

1. App StoreからTailscaleアプリをインストール
2. Linuxサーバーでログインしたのと同じアカウントでログイン
3. VPNをオンにする

### 2. サーバーの起動

meme-gtdサーバーはすでに `0.0.0.0` でリッスンする設定になっているため、追加の設定は不要です。

#### 本番環境で起動（本番データベース使用）

```bash
cd /path/to/meme-gtd
pnpm server:start
```

サーバーは `http://0.0.0.0:3000` で起動します。

#### テスト環境で起動（test.db使用）

```bash
cd /path/to/meme-gtd
pnpm server:dev
```

サーバーは `http://0.0.0.0:3001` で起動します。

### 3. Tailscale Serveの設定（推奨）

Tailscale Serveを使うと、IPアドレスではなくホスト名（例: `hirakus-mac-mini.tailff2c68.ts.net`）でHTTPSアクセスできます。

#### macOS/Linuxでの設定

```bash
# localhost:3000をTailscaleネットワークに公開
tailscale serve https / http://localhost:3000

# 設定を確認
tailscale serve status
# 出力例:
# https://hirakus-mac-mini.tailff2c68.ts.net (tailnet only)
# |-- / proxy http://localhost:3000
```

これで `https://hirakus-mac-mini.tailff2c68.ts.net` でアクセス可能になります。

#### Tailscale Serve使用時の注意点

- Web UIの `OpenAPI.ts` で `BASE: ''` と設定すると、どの環境からでも相対パスでAPIにアクセスできます
  - Mac上: `localhost:3000` → API: `localhost:3000/api/...`
  - iPhone: `https://hirakus-mac-mini.tailff2c68.ts.net` → API: `https://hirakus-mac-mini.tailff2c68.ts.net/api/...`

#### 設定の停止

```bash
# Tailscale Serveを停止
tailscale serve reset
```

### 4. アクセス方法

#### ローカルマシンからのテスト

```bash
# 本番サーバー
curl http://localhost:3000/api/memos

# テストサーバー
curl http://localhost:3001/api/memos
```

#### iPhoneからのアクセス

##### 方法1: Tailscale Serve経由（HTTPS、推奨）

Safariまたは好みのブラウザで以下のURLを開きます：

```
https://hirakus-mac-mini.tailff2c68.ts.net
```

**メリット**:
- ホスト名で覚えやすい
- HTTPSで自動暗号化
- ポート番号不要

##### 方法2: IPアドレス直接（HTTP）

```
本番環境: http://100.123.45.67:3000
テスト環境: http://100.123.45.67:3001
```

**重要**: `100.123.45.67` の部分は、手順1で確認した自分のTailscale IPアドレスに置き換えてください。

### 5. ファイアウォール設定（必要に応じて）

Linuxマシンでファイアウォールが有効な場合、Tailscaleネットワーク（100.64.0.0/10）からのアクセスを許可する必要があります。

#### ufwの場合

```bash
sudo ufw allow from 100.64.0.0/10 to any port 3000
sudo ufw allow from 100.64.0.0/10 to any port 3001
```

#### firewalldの場合

```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="100.64.0.0/10" port port="3000" protocol="tcp" accept'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="100.64.0.0/10" port port="3001" protocol="tcp" accept'
sudo firewall-cmd --reload
```

## トラブルシューティング

### iPhoneから接続できない

1. **Tailscale VPNがオンになっているか確認**
   - iPhoneのTailscaleアプリを開いて、VPNがオンになっていることを確認

2. **IPアドレスが正しいか確認**
   ```bash
   # Linuxサーバーで再度確認
   tailscale ip -4
   ```

3. **サーバーが起動しているか確認**
   ```bash
   # プロセスが動いているか確認
   ps aux | grep node

   # ポートがリッスンしているか確認
   sudo netstat -tulpn | grep 3000
   ```

4. **ファイアウォールの確認**
   ```bash
   # ufwの場合
   sudo ufw status

   # firewalldの場合
   sudo firewall-cmd --list-all
   ```

### Linuxサーバーがスリープしてアクセスできなくなる

サーバーマシンのスリープ設定を無効化するか、常時起動する小型デバイス（Raspberry Piなど）での運用を検討してください。

```bash
# スリープ無効化（systemd使用のLinux）
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

## セキュリティについて

### なぜHTTPSが不要なのか？

Tailscaleは全ての通信を自動的にWireGuardプロトコルで暗号化します。HTTPSを使用しなくても、通信は完全に保護されています。

### なぜ認証が不要なのか？

Tailscaleネットワークに参加している端末のみがアクセス可能です。自分のTailscaleアカウントに紐づいている端末以外はアクセスできません。

## 将来的な拡張オプション

もし24時間稼働させたい場合や、Linuxマシンを常時起動したくない場合は、以下のオプションを検討できます：

### GCP Compute Engine（e2-micro）+ Tailscale

- **無料枠**: 米国リージョンで月額$0（永続ディスク30GB分のみ~$2/月）
- **24時間稼働**: 常にアクセス可能
- **同じ構成**: 本ガイドと同じTailscale設定が使える

詳細は別途検討時に記載します。

## 参考リンク

- [Tailscale公式サイト](https://tailscale.com/)
- [Tailscaleドキュメント](https://tailscale.com/kb/)
