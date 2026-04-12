# CCTV Remote Setup Guide
**Goal:** View all rental property cameras from anywhere using your single laptop.  
**No Raspberry Pi or extra hardware needed.**

---

## How It Works

```
Property A router (OpenVPN/VPN) ──┐
Property B router (OpenVPN/VPN) ──┤──→ go2rtc on your laptop → backend → dashboard
Property C router (OpenVPN/VPN) ──┘
```

Your laptop VPNs into each property router → sees cameras as if on local Wi-Fi → go2rtc pulls all RTSP streams → you watch from anywhere.

> **Works with any router brand** — TP-Link, ASUS, Netgear, D-Link, Xiaomi, Singtel/StarHub ISP router, etc.

---

## What You Need

- [ ] Your laptop (Mac)
- [ ] Physical access to each property's router (10–15 min per property)
- [ ] USB drive or email to transfer VPN config files
- [ ] Phone as hotspot if property has no internet during setup
- [ ] Tapo app on your phone (to get camera IPs + enable RTSP)

---

## Important: Tapo Camera Requirements (From TP-Link Official Docs)

> Source: tp-link.com/us/support/faq/2680/ and tapo.com/us/faq/724/

Before anything else, each TC71 camera needs:

### 1 — Camera Account (mandatory for RTSP)
The camera account is **separate from your Tapo app login**. Without it, no third-party connection will work.

- Tapo app → tap camera → **Settings (gear icon)**
- **Advanced Settings → Camera Account**
- Create username + password (**6–32 characters each**)
- This is the credential you use for RTSP — **not** your Tapo email/password

### 2 — RTSP Must Be Enabled
TP-Link docs confirm RTSP is **off by default** on some firmware versions.

- Tapo app → camera → Settings → **Advanced Settings → RTSP** → toggle ON
- RTSP default port: **554**
- Official RTSP URL formats (from TP-Link docs):
  - High quality: `rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream1`
  - Standard quality: `rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream2`
  - Remote (via port forward): `rtsp://USERNAME:PASSWORD@WAN_IP:EXTERNAL_PORT/stream1`

### 3 — Known Limitations (TP-Link Official)
- **RTSP/ONVIF and Tapo Care cannot all run simultaneously** — if you have Tapo Care + SD card + NVR/RTSP all active, NVR/RTSP recording may be disabled
- **Two-way audio is not available** via RTSP/ONVIF — only live video
- Each camera has **limited simultaneous RTSP connections** — go2rtc handles this by pulling once and re-serving to many viewers
- ONVIF uses port **2020** (for PTZ control if needed in future)

### 4 — Security Warning (From TP-Link Docs)
> "RTSP and ONVIF are not highly secure protocols and are not recommended for long-term exposure on a public IP."

This is why we use **VPN** instead of exposing cameras directly to the internet.

---

## Part 1 — At The Property (Do This At Each House)

### Step 1 — Access Router Admin Page

1. Connect your laptop to the property Wi-Fi
2. Open browser and try these in order:

| Try this URL | Common for |
|---|---|
| `http://192.168.0.1` | TP-Link, D-Link, Huawei |
| `http://192.168.1.1` | ASUS, Netgear, Linksys |
| `http://192.168.1.254` | Some ISP routers |
| `http://10.0.0.1` | Some Singtel/StarHub |
| `http://tplinkwifi.net` | TP-Link only |
| `http://router.asus.com` | ASUS only |

3. Login — check the **sticker on the back of the router** for:
   - Admin URL
   - Default username (usually `admin`)
   - Default password (on sticker, or try `admin` / `password` / `1234`)

---

### Step 2 — Fix Camera IPs (DHCP Reservation)

> Cameras get a random IP by default — it can change after reboot and break your setup.

**In router admin — look for:** `DHCP` → `Address Reservation` / `Static Lease` / `IP Binding`

For each camera:
1. Find the camera in the DHCP client list (match by MAC address from Tapo app → Device Info)
2. Reserve / bind the camera's current IP to its MAC address permanently
3. Save

**Camera at 414 Commonwealth:**
- MAC: `B8-FB-B3-28-E5-F5`
- Reserve IP: `192.168.0.146` → permanently assigned

---

### Step 3 — Set Up Dynamic DNS (Free Hostname)

> Gives the property a stable web address even if the internet IP changes.

**TP-Link router:**
1. Advanced → Network → **Dynamic DNS**
2. Enable → Service Provider: **TP-Link** (free, no account needed)
3. Register e.g. `commonwealth414` → becomes `commonwealth414.tplinkdns.com`

**ASUS router:**
1. Advanced Settings → **WAN** → DDNS tab
2. Enable → Server: **WWW.ASUS.COM** (free)
3. Hostname: e.g. `commonwealth414` → becomes `commonwealth414.asuscomm.com`

**Netgear router:**
1. Advanced → Advanced Setup → **Dynamic DNS**
2. Enable → Service Provider: **www.no-ip.com** or **NETGEAR** (if available)

**Any brand — use DuckDNS (free, works everywhere):**
1. Go to `duckdns.org` on your phone → login with Google
2. Create a domain e.g. `commonwealth414` → get `commonwealth414.duckdns.org`
3. In router DDNS settings → select **Custom** or **DuckDNS** → paste the token from DuckDNS

**Write down your hostname** — you need it for every camera added to the dashboard.

---

### Step 4 — Enable VPN Server on the Router

Find the right section for your router brand:

**TP-Link:**
- Advanced → VPN Server → **OpenVPN** (newer) or **PPTP/L2TP** (older)

**ASUS:**
- Advanced Settings → **VPN** → VPN Server tab → OpenVPN or WireGuard

**Netgear:**
- Advanced → Advanced Setup → **VPN Service** → Enable

**D-Link:**
- Setup → **VPN Settings** → L2TP or PPTP

**Xiaomi Mi Router:**
- MiWiFi app → More → **VPN Server**

**No VPN option on router?** → Skip to "Alternative: Port Forwarding" section below.

---

#### OpenVPN Setup (Recommended — Most Secure)

1. Enable OpenVPN Server → ON
2. Settings:
   - Protocol: **UDP** (preferred, faster) or TCP
   - Port: **1194**
   - VPN Subnet/Mask: leave default (e.g. `10.8.0.0 / 255.255.255.0`)
   - Client Access: **Home Network Only** ← critical, makes cameras reachable via VPN
3. Click **Save**
4. Click **Export** → downloads a `.ovpn` file
5. Rename it clearly: `commonwealth414.ovpn` / `bedok123.ovpn`
6. Email or AirDrop it to yourself

#### WireGuard Setup (Newer Routers — Even Better)

1. Enable WireGuard Server → ON
2. Click **Add Peer** → name it `MyLaptop`
3. Download the peer config (`.conf` file) or scan the QR code with your phone
4. Email the config to yourself

#### L2TP/PPTP Setup (Older Routers — Simpler)

1. Enable L2TP (or PPTP) Server
2. Set a **VPN username** and **VPN password** (write these down)
3. No file to export — you'll enter the hostname + username + password manually on Mac

---

### Step 5 — Note Down Camera Info

Fill this in while you're at each property:

| Field | Camera 1 | Camera 2 | Camera 3 |
|-------|----------|----------|----------|
| Property | | | |
| Camera name | | | |
| Location | | | |
| IP Address | | | |
| MAC Address | | | |
| Camera acct username | | | |
| Camera acct password | | | |
| RTSP URL (local) | rtsp://USER:PASS@IP:554/stream1 | | |
| Router DDNS hostname | | | |

**Already confirmed for 414 Commonwealth:**

| Field | Value |
|-------|-------|
| Camera name | Kitchen |
| IP | `192.168.0.146` |
| MAC | `B8-FB-B3-28-E5-F5` |
| Username | `043007414commonwealth` |
| Password | `043007414commonwealth` |
| RTSP (local) | `rtsp://043007414commonwealth:043007414commonwealth@192.168.0.146:554/stream1` |

---

### Step 6 — Enable RTSP on Each Camera (While at Property)

Per TP-Link official docs — must be done before go2rtc can stream.

1. Open **Tapo app** → tap the camera
2. Tap **gear icon (Settings)** → top right
3. Go to **Advanced Settings → RTSP**
4. Toggle **Enable** → ON
5. Note the RTSP URL displayed
6. Repeat for every camera

> **If RTSP option is missing:** Settings → **Firmware Upgrade** → update, then check again.

---

### Step 7 — Test RTSP While Still at Property

Do this before leaving — confirms everything works while you're still there.

**Using VLC on your laptop** (on same Wi-Fi, no VPN needed yet):

```
VLC → Media → Open Network Stream →
rtsp://043007414commonwealth:043007414commonwealth@192.168.0.146:554/stream1
```

- If VLC asks for credentials → enter the **camera account** username/password (NOT Tapo login)
- Video should appear within 5 seconds
- If it works → camera is correctly configured ✓

> **Common failures (from TP-Link docs):**
> - Wrong credentials → using Tapo app login instead of camera account
> - Wrong IP → using cloud ID instead of local LAN IP
> - RTSP not enabled → go back to Step 6
> - Different subnet → laptop and camera on different Wi-Fi bands (try 2.4GHz)

---

### Repeat Steps 1–7 at Every Property

You'll leave each property with:
- [ ] VPN config file (`.ovpn` / `.conf`) — emailed to yourself
- [ ] DDNS hostname noted
- [ ] Camera IPs fixed (DHCP reservation done)
- [ ] RTSP tested and working in VLC

---

## Alternative: Port Forwarding (If Router Has No VPN)

> Use this if the router has no VPN option. Less secure — only expose while actively viewing.

Per TP-Link docs, the remote RTSP URL format is:
```
rtsp://USERNAME:PASSWORD@WAN_IP_OR_DDNS:EXTERNAL_PORT/stream1
```

**Setup per camera:**
1. Router admin → **Port Forwarding** / **Virtual Server** / **NAT Rules**
2. Add a rule for each camera (use a different external port per camera):

| Camera | External Port | Internal IP | Internal Port |
|--------|--------------|-------------|---------------|
| Kitchen (Commonwealth) | `8554` | `192.168.0.146` | `554` |
| Living Room | `8555` | `192.168.0.xxx` | `554` |
| Bedroom | `8556` | `192.168.0.xxx` | `554` |

3. The RTSP URL from outside becomes:
   ```
   rtsp://043007414commonwealth:043007414commonwealth@commonwealth414.tplinkdns.com:8554/stream1
   ```
4. Add this URL directly in CCTV Monitor dashboard → Add Camera → IP field (use the full DDNS hostname)

> **Do NOT leave port forwarding on 24/7 long-term** — TP-Link docs specifically warn against this. Use VPN when possible. Port forwarding is fine for occasional manual viewing sessions.

---

## Part 2 — On Your Laptop (Do This Once, Back Home)

### Step 8 — Install VPN Client

**For OpenVPN files (.ovpn):**
```bash
brew install --cask tunnelblick
```
Or download: https://tunnelblick.net — double-click each `.ovpn` to import.

**For WireGuard files (.conf):**
```bash
brew install --cask wireguard-tools
# Or download WireGuard from Mac App Store (free)
```
Open WireGuard app → Import tunnel from file → select `.conf`

**For L2TP (no file — manual setup):**
1. System Settings → Network → + → VPN → L2TP over IPSec
2. Server: your DDNS hostname (e.g. `bedok123.tplinkdns.com`)
3. Account name: VPN username you set on router
4. Password: VPN password you set on router
5. Shared Secret: check router admin for the IPSec shared key (often `vpn` or blank)

---

### Step 9 — Connect to All VPNs Simultaneously

1. Connect to each property VPN (Tunnelblick menu bar → connect all)
2. All can be active at the same time — each only routes its own subnet
3. Verify connectivity:

```bash
# Commonwealth 414 camera
ping 192.168.0.146

# Each property will have different subnet (192.168.0.x, 192.168.1.x, etc.)
# If pings reply — VPN is working ✓
```

---

### Step 10 — Install go2rtc

```bash
# Check your Mac chip: Apple menu → About This Mac

# Apple Silicon (M1/M2/M3/M4)
curl -L https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_mac_arm64 \
  -o /usr/local/bin/go2rtc && chmod +x /usr/local/bin/go2rtc

# Intel Mac
curl -L https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_mac_amd64 \
  -o /usr/local/bin/go2rtc && chmod +x /usr/local/bin/go2rtc

# Verify
go2rtc --version
```

---

### Step 11 — Start go2rtc From Dashboard

1. Open your rental management dashboard → **CCTV Monitor**
2. The **go2rtc status bar** appears at the top
3. Click **"Start + Apply All Cameras"** (green button)

This auto-generates the go2rtc config from all cameras in your database and starts streaming.

After adding any new camera → click **go2rtc Reload**.

---

### Step 12 — Add All Cameras to Dashboard

For each camera across all properties:

1. CCTV Monitor → **Add Camera**
2. Fill in the details from your notes (Step 5)
3. After saving → click **go2rtc Reload**
4. Click **Test** (wifi icon) on the camera card → should show **Online**
5. Click **Stream** → live video loads within 5–10 seconds

---

## Part 3 — Keeping It Running

### Auto-start go2rtc on Boot

```bash
# Get your actual username
echo $USER

# Create launch agent (replace YOUR_USERNAME)
cat > ~/Library/LaunchAgents/com.go2rtc.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.go2rtc</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/go2rtc</string>
    <string>--config</string>
    <string>/Users/YOUR_USERNAME/.go2rtc/go2rtc.yaml</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/go2rtc.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/go2rtc.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.go2rtc.plist
```

### Auto-reconnect VPNs on Boot

- **Tunnelblick:** Right-click each VPN → Connect → "When computer starts"
- **WireGuard:** Toggle "On demand" in the WireGuard app

---

## Troubleshooting

### VPN connects but can't ping camera
- Router VPN setting **Client Access** must be set to **Home Network Only** (not internet only)
- Check the camera's IP hasn't changed — do DHCP reservation (Step 2)
- Try disabling Mac firewall temporarily: System Settings → Network → Firewall → Off

### RTSP works in VLC but not in dashboard
- VPN might not be connected when backend runs → connect VPN first, then restart backend
- Check go2rtc is running: open `http://localhost:1984` in browser
- Click **go2rtc Reload** in dashboard after connecting VPN

### go2rtc starts but stream is 404 / "not ready"
- RTSP not enabled on camera → do Step 6
- Camera account wrong → test credentials in VLC first
- Camera IP changed → check DHCP reservation (Step 2)
- VPN not connected → check Tunnelblick / WireGuard

### Router has no VPN option at all
- Use **port forwarding** (Alternative section above)
- Or check if router supports **DD-WRT / OpenWRT** firmware (adds VPN to any router)

### DDNS hostname doesn't resolve
- Wait 10 minutes after enabling
- Check router DDNS page shows "Connected" status
- Test: `nslookup yourhouse.tplinkdns.com` in terminal

### Camera shows online but video is black / frozen
- Per TP-Link docs: camera can only handle limited simultaneous streams — make sure Tapo Care cloud recording isn't also active
- Try `stream2` instead of `stream1` (lower load on camera)
- Restart camera: Tapo app → Settings → Restart

### L2TP VPN can't connect on Mac
- System Settings → Network → VPN → Options → enable **Send all traffic over VPN**: OFF
- Add shared secret: usually `vpn` or check router admin → L2TP → IPSec settings

---

## Property Checklist (Print One Per Property)

```
Property address: _______________________
Router brand/model: _______________________

ROUTER SETUP
[ ] Router admin accessed at: _________________ (IP or URL)
[ ] DHCP reservation done for each camera MAC address
[ ] DDNS hostname: _________________._____________ (e.g. .tplinkdns.com)
[ ] VPN enabled:  [ ] OpenVPN  [ ] WireGuard  [ ] L2TP  [ ] Port forward only
[ ] VPN config file exported + renamed + emailed to self
[ ] VPN tested from phone mobile data (not on property Wi-Fi)

CAMERA SETUP (repeat per camera)
[ ] Camera 1: _____________ IP: _____________ RTSP tested in VLC: [ ]
[ ] Camera 2: _____________ IP: _____________ RTSP tested in VLC: [ ]
[ ] Camera 3: _____________ IP: _____________ RTSP tested in VLC: [ ]
[ ] Camera account username: _______________________
[ ] Camera account password: _______________________
[ ] RTSP enabled in Tapo app for all cameras
[ ] Firmware up to date (Settings → Firmware Upgrade)
```

---

## Quick Reference — RTSP URL Formats

| Situation | URL Format |
|-----------|-----------|
| Same network (local) | `rtsp://USER:PASS@192.168.x.x:554/stream1` |
| Via VPN (remote, secure) | `rtsp://USER:PASS@192.168.x.x:554/stream1` (same — VPN makes it local) |
| Via port forwarding (remote) | `rtsp://USER:PASS@yourhouse.tplinkdns.com:8554/stream1` |
| Low quality / lighter | replace `stream1` with `stream2` |

> Source: TP-Link official docs — tp-link.com/us/support/faq/2680/

---

*Generated by Rental Management Platform — CCTV Module*  
*Last updated: April 2026*
