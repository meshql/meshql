# 06 — Integrity profile (optional)

**Status:** Draft  
**Applies to:** Compliance Level 3+

Integrity ensures the query payload cannot be tampered with independently of
authentication. It is **optional** — L1/L2 servers MAY omit it.

## Headers

| Header | Role |
|--------|------|
| `X-Mesh-Signature` | `sha256=` + lowercase hex HMAC-SHA256 |
| `X-Mesh-Token` | Opaque session / signing token from `POST /{base}/auth` |

## Signature input

The HMAC message MUST be the **exact** string value of the `X-Mesh-Query`
header (the base64 text), not the decoded JSON.

Key material comes from the login response (`signingToken` in the TS client).
Exact key derivation MAY be implementation-specific but MUST be documented by
that implementation.

## Auth routes

`POST /{base}/auth` with JSON credentials (shape is app-defined) returns at
least:

```json
{
  "signingToken": "...",
  "token": "...",
  "expiresAt": 1783237119316
}
```

`POST /{base}/logout` with `X-Mesh-Token` revokes the session.

## Failure

Invalid or missing signature when integrity is enabled → **401/403** with
`IntegrityError` JSON body ([01](./01-http-wire.md)).

## Replay

The HMAC binds the signature to the **query header** and a session token with
`expiresAt`. This profile does **not** include a per-request nonce or a signed
request timestamp.

A captured `(X-Mesh-Query, X-Mesh-Signature, X-Mesh-Token)` triple MAY be
replayed until the token expires or the session is revoked.

Servers SHOULD use short token TTLs, TLS, logout revocation, and (when the
client set is known) persisted-query allowlists. Optional per-request replay
windows are a future, additive wire extension.

## Non-goals here

Row-level / field-level authorization policies (`@meshql/access`) are
**application plugins**, not part of the wire integrity profile.
