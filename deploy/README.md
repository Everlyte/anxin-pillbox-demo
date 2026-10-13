# 腾讯云部署

访问地址：**https://42.192.40.45/**，HTTP 自动跳转 HTTPS。

部署日期：2026-10-14。Ubuntu 24.04、2 核 2 GB；Node.js 22.23.3、Caddy 2.11.7。服务器当前购买周期到 2026-11-14，持续展示需及时续费。

## 服务结构

- `/opt/anxin-pillbox`：应用仓库。
- `/opt/anxin-node/bin/node`：Node 运行时。
- `/etc/anxin/anxin.env`：环境变量和 DeepSeek 密钥，仅 root 可读（0600）。不要复制到仓库或网页目录。
- `anxin-pillbox.service`：应用，普通系统用户运行，监听 `127.0.0.1:4173`。
- `/etc/caddy/Caddyfile`：HTTPS 反向代理配置。
- `caddy.service`：对外提供 80/443，使用 Let's Encrypt 的 IP 短期证书，自动续期。续期依赖服务常驻及验证端口可达。
- 两个服务均已启用开机启动及失败重启。

腾讯云入站规则：原有 TCP 22、TCP 80、ICMP；本次经确认增加 TCP 443。4173 不对公网开放。没有配置域名。

## 查看状态和日志

```sh
sudo systemctl status anxin-pillbox caddy
sudo journalctl -u anxin-pillbox -n 50 --no-pager
sudo journalctl -u caddy -n 50 --no-pager
curl -fsS https://42.192.40.45/healthz
curl -fsS https://42.192.40.45/api/config
```

## 更新已部署代码

```sh
cd /opt/anxin-pillbox
sudo git pull --ff-only
/opt/anxin-node/bin/node --test test.mjs
sudo systemctl restart anxin-pillbox
curl -fsS https://42.192.40.45/healthz
```

先确认测试成功，再执行重启。环境变量独立于仓库，拉取代码不会覆盖密钥。

`bootstrap.sh PUBLIC_IP` 用于一台全新的 Ubuntu x86_64 服务器，会安装服务并写入配置，不用于已有其他站点的服务器。Node 下载使用官方 SHA-256 校验；Caddy 官方校验文件使用 SHA-512。GitHub 下载较慢时，可以从官方 release 下载同版本安装包，上传后按官方校验值核实，再继续安装。

## 上线验证及范围

已验证正常证书校验下首页及健康检查 200、HTTP 跳转 HTTPS、DeepSeek 真实提取、明确“早上八点”转换为 08:00、仅“每日两次”时不补造时间、缺失时间无法生成计划、`.env` 返回 404、跨站提取请求返回 403，以及 5 项状态与提取单元测试。

这是面试交互演示。传感器与灯光为模拟；提醒需要页面保持打开并启用声音；记录保存在访问者本地浏览器。每进程每天最多 100 次模型提取、最多 3 个并发；重启会重置计数，不能视为严格费用上限。
