#!/usr/bin/env python3
import argparse
import re
import sys

import paramiko


def trim(value: str) -> str:
    return value.strip() if isinstance(value, str) else ""


def parse_args():
    parser = argparse.ArgumentParser(
        description="Verify or fix nginx download/runtime proxy bucket targets on the ingress host."
    )
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", required=True)
    parser.add_argument("--config-path", required=True)
    parser.add_argument("--minio-origin", required=True, help="example: http://39.106.110.149:9000")
    parser.add_argument("--downloads-bucket", required=True)
    parser.add_argument("--runtime-bucket", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--reload", action="store_true")
    return parser.parse_args()


def ssh_run(client: paramiko.SSHClient, command: str):
    stdin, stdout, stderr = client.exec_command(command, timeout=300)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def replace_bucket_targets(raw: str, minio_origin: str, downloads_bucket: str, runtime_bucket: str):
    expected_downloads = f"{minio_origin.rstrip('/')}/{downloads_bucket}/downloads/"
    expected_runtime = f"{minio_origin.rstrip('/')}/{runtime_bucket}/runtime/"

    downloads_pattern = re.compile(r"proxy_pass\s+(https?://[^;]+/downloads/);")
    runtime_pattern = re.compile(r"proxy_pass\s+(https?://[^;]+/runtime/);")

    downloads_match = downloads_pattern.search(raw)
    runtime_match = runtime_pattern.search(raw)
    current_downloads = trim(downloads_match.group(1) if downloads_match else "")
    current_runtime = trim(runtime_match.group(1) if runtime_match else "")

    updated = raw
    if current_downloads and current_downloads != expected_downloads:
      updated = updated.replace(current_downloads, expected_downloads)
    if current_runtime and current_runtime != expected_runtime:
      updated = updated.replace(current_runtime, expected_runtime)

    return {
        "current_downloads": current_downloads,
        "current_runtime": current_runtime,
        "expected_downloads": expected_downloads,
        "expected_runtime": expected_runtime,
        "updated": updated,
        "changed": updated != raw,
    }


def main():
    args = parse_args()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(args.host, username=args.user, password=args.password, timeout=20)
    sftp = client.open_sftp()
    try:
        with sftp.open(args.config_path, "r") as fh:
            raw = fh.read().decode("utf-8")

        summary = replace_bucket_targets(
            raw=raw,
            minio_origin=args.minio_origin,
            downloads_bucket=args.downloads_bucket,
            runtime_bucket=args.runtime_bucket,
        )

        print(f"config_path={args.config_path}")
        print(f"current_downloads={summary['current_downloads']}")
        print(f"expected_downloads={summary['expected_downloads']}")
        print(f"current_runtime={summary['current_runtime']}")
        print(f"expected_runtime={summary['expected_runtime']}")

        if not args.apply:
            if not summary["current_downloads"] or not summary["current_runtime"]:
                raise SystemExit("failed to locate downloads/runtime proxy_pass in nginx config")
            if summary["changed"]:
                raise SystemExit("nginx proxy bucket targets do not match expected values")
            print("nginx proxy bucket targets already match expected values")
            return

        backup_path = f"{args.config_path}.bak-auto"
        ssh_run(client, f"cp {args.config_path} {backup_path}")
        with sftp.open(args.config_path, "w") as fh:
            fh.write(summary["updated"].encode("utf-8"))
        print(f"updated_config={args.config_path}")
        print(f"backup_path={backup_path}")

        code, out, err = ssh_run(client, "nginx -t")
        sys.stdout.write(out)
        sys.stderr.write(err)
        if code != 0:
            raise SystemExit(code)

        if args.reload:
            code, out, err = ssh_run(client, "systemctl reload nginx")
            sys.stdout.write(out)
            sys.stderr.write(err)
            if code != 0:
                raise SystemExit(code)
            print("nginx_reloaded=true")
    finally:
        sftp.close()
        client.close()


if __name__ == "__main__":
    main()
