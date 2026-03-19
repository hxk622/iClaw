# Admin Web

Independent OEM operations platform scaffold.

## Local development

```bash
pnpm dev:admin
```

Default URL: `http://localhost:1479`.

Bootstrap credentials:

```text
username: admin
password: admin
```

This app now uses the control-plane auth and OEM APIs. The bootstrap `admin / admin` account is auto-created by the control-plane on startup unless disabled by env.
