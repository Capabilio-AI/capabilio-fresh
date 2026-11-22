# Self-hosted Judge0: runbook

Goal: Run and Submit answer in about 2 seconds for every language, with no rate limit, and C# becomes judgeable. **Written from Judge0's documentation and not yet
deployed or tested by us: treat every step as unverified until `npm run judge:health` passes against your host.**

## 1. The host
- One dedicated Linux VM that runs nothing else (Judge0 runs student code in privileged containers). Start with 2 vCPU and 4 GB RAM; add workers, not features, when
  exam days need more. Any provider works (AWS EC2 or Lightsail, DigitalOcean, Hetzner, Azure). Choose a region near your students (Mumbai or Hyderabad).
- Ubuntu 22.04 LTS. Judge0 CE 1.13.1 needs **cgroup v1**: add `systemd.unified_cgroup_hierarchy=0` to `GRUB_CMDLINE_LINUX` in `/etc/default/grub`, run
  `sudo update-grub`, reboot, and confirm with `stat -fc %T /sys/fs/cgroup` (it must print `tmpfs`, not `cgroup2fs`).
- Install Docker and the Compose plugin from Docker's own apt repository.

## 2. Network: never expose it to the internet
- Port 2358 is bound to 127.0.0.1 in `docker-compose.yml`. Put the Capabilio server and Judge0 on a private network, or put a reverse proxy with TLS in front that only
  accepts requests carrying your `X-Auth-Token`, and restrict the firewall to your app's egress addresses. Vercel has no fixed egress by default: use a proxy with the token
  and rate limits, or Vercel's static IPs if your plan has them.

## 3. Start it
```
cd infra/judge0
cp judge0.conf.example judge0.conf      # replace every CHANGE_ME with a long random value (openssl rand -hex 24)
docker compose up -d db redis && sleep 10 && docker compose up -d
curl -s -H "X-Auth-Token: <your token>" http://127.0.0.1:2358/languages | head -c 400
```

## 4. Point the app at it
Set in the app's environment (Vercel project settings): `JUDGE0_URL`, `JUDGE0_TOKEN`, and `NEXT_PUBLIC_EXTRA_LANGUAGES=1` (offers Go, Rust, C# and Kotlin and
turns on C# module judging). Redeploy, then run `npm run judge:health` with the same variables: every language must be `ok` and under about 5 s.

## 5. Known limits to check
- **Use the custom image, not the stock one.** The `Dockerfile` here adds Java 21 (id 101), Python 3.12 (102), Node 20 (103) and C# on .NET 10 (104) next to Judge0's old Java 13, Python 3.8, Node 12 and Mono, and `capabilio-languages.rb` adds them to Judge0's language seed (Judge0 rebuilds its language table from the seed on every start, so a manual SQL insert would vanish at the next reboot). The app asks for these ids (`lib/code-execution/judge0.ts`); against stock Judge0 they are unknown. Build and start: `docker compose build server && docker compose up -d server worker`.
- The stock "extra" image (`judge0/judge0:1.13.1-extra`) is NOT an upgrade: it has Java 14, Python 3.7 for ML only and .NET Core 3.1. Do not use it.
- `judge0.conf` must contain `ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT=false` (see the example): with Judge0's default address-space cap, .NET fails to start with "Out of memory".
- Every download in the Dockerfile is checked against its publisher's checksum. When bumping a version, update the checksum too. .NET 8 reached end of life on 2026-11-10; .NET 10 (LTS) is supported until 2028-11.
- After any runner change run `npm run judge:health` and `npm run runner:verify`: CI compiles with its own JDK and .NET, so only these two prove what a student's Run does.
- Judge0 runs one submission per worker slot. Set `COUNT` in `judge0.conf` from the number of CPU cores, and test with a burst (for example 30 students pressing Run together).
- Back up nothing here: the database holds only submissions and can be rebuilt. Rotate `AUTHN_TOKEN` if it ever leaks.
