"""Postgres persistence owned exclusively by the integrations service."""

from __future__ import annotations

import json
import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras


@contextmanager
def db():
    url = os.getenv("INTEGRATIONS_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("INTEGRATIONS_DATABASE_URL must be configured")
    connection = psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize() -> None:
    with db() as conn, conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sf_organizations (
              id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, owner_user_id TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS sf_organization_members (
              organization_id BIGINT NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
              user_id TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner','admin','security','viewer')),
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (organization_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS sf_integrations (
              id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
              provider TEXT NOT NULL CHECK (provider IN ('github','gitlab','dockerhub','ecr','ghcr')),
              name TEXT NOT NULL, encrypted_credentials TEXT NOT NULL,
              metadata JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'connected',
              created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ
            );
            CREATE TABLE IF NOT EXISTS sf_api_keys (
              id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
              name TEXT NOT NULL, key_prefix TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE,
              scopes JSONB NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              last_used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ
            );
            CREATE TABLE IF NOT EXISTS sf_oauth_states (
              state_hash TEXT PRIMARY KEY,
              organization_id BIGINT NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
              user_id TEXT NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)


def create_organization(name: str, owner_user_id: str) -> dict:
    with db() as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO sf_organizations (name, owner_user_id) VALUES (%s, %s) RETURNING *", (name, owner_user_id))
        org = dict(cur.fetchone())
        cur.execute("INSERT INTO sf_organization_members (organization_id, user_id, role) VALUES (%s, %s, 'owner')", (org["id"], owner_user_id))
        return org


def role_for(organization_id: int, user_id: str) -> str | None:
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT role FROM sf_organization_members WHERE organization_id=%s AND user_id=%s", (organization_id, user_id))
        row = cur.fetchone()
        return row["role"] if row else None


def add_member(organization_id: int, user_id: str, role: str) -> dict:
    with db() as conn, conn.cursor() as cur:
        cur.execute("""INSERT INTO sf_organization_members (organization_id,user_id,role) VALUES (%s,%s,%s)
                       ON CONFLICT (organization_id,user_id) DO UPDATE SET role=EXCLUDED.role RETURNING *""", (organization_id, user_id, role))
        return dict(cur.fetchone())


def put_integration(organization_id: int, provider: str, name: str, encrypted_credentials: str, metadata: dict, created_by: str) -> dict:
    with db() as conn, conn.cursor() as cur:
        cur.execute("""INSERT INTO sf_integrations (organization_id,provider,name,encrypted_credentials,metadata,created_by)
                       VALUES (%s,%s,%s,%s,%s,%s) RETURNING id,organization_id,provider,name,metadata,status,created_at,revoked_at""", (organization_id, provider, name, encrypted_credentials, json.dumps(metadata), created_by))
        return dict(cur.fetchone())


def list_integrations(organization_id: int) -> list[dict]:
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id,organization_id,provider,name,metadata,status,created_at,revoked_at FROM sf_integrations WHERE organization_id=%s ORDER BY created_at DESC", (organization_id,))
        return [dict(row) for row in cur.fetchall()]


def revoke_integration(organization_id: int, integration_id: int) -> bool:
    with db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE sf_integrations SET status='revoked', revoked_at=now(), encrypted_credentials='' WHERE id=%s AND organization_id=%s AND revoked_at IS NULL", (integration_id, organization_id))
        return cur.rowcount == 1


def get_active_integration(organization_id: int, integration_id: int, provider: str | tuple[str, ...] | None) -> dict | None:
    """Return one active integration, including its encrypted secret.

    ``provider`` may be a single provider name, a tuple of acceptable
    providers, or ``None`` to accept any provider.

    This is intentionally private to server-side provider adapters. Route
    responses must use ``list_integrations`` instead so secrets never leave
    the service.
    """
    provider_filter = ""
    params: tuple = (integration_id, organization_id)
    if provider is not None:
        providers = (provider,) if isinstance(provider, str) else tuple(provider)
        provider_filter = "AND provider = ANY(%s)"
        params = (integration_id, organization_id, list(providers))

    with db() as conn, conn.cursor() as cur:
        cur.execute(
            f"""SELECT id, organization_id, provider, name, encrypted_credentials, metadata
               FROM sf_integrations
               WHERE id=%s AND organization_id=%s {provider_filter}
                 AND status='connected' AND revoked_at IS NULL""",
            params,
        )
        row = cur.fetchone()
        return dict(row) if row else None


def update_integration_metadata(organization_id: int, integration_id: int, metadata: dict) -> dict | None:
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """UPDATE sf_integrations SET metadata=%s
               WHERE id=%s AND organization_id=%s AND status='connected' AND revoked_at IS NULL
               RETURNING id, organization_id, provider, name, metadata, status, created_at, revoked_at""",
            (json.dumps(metadata), integration_id, organization_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def put_oauth_state(state_hash: str, organization_id: int, user_id: str) -> None:
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO sf_oauth_states (state_hash, organization_id, user_id, expires_at)
               VALUES (%s, %s, %s, now() + interval '10 minutes')""",
            (state_hash, organization_id, user_id),
        )


def consume_oauth_state(state_hash: str) -> dict | None:
    """Consume a state exactly once, rejecting expired callbacks.

    Shared across every OAuth-based provider (GitHub, GitLab, ...) — the
    state token itself is opaque and random, so there's no need for a
    separate table per provider.
    """
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """DELETE FROM sf_oauth_states
               WHERE state_hash=%s AND expires_at > now()
               RETURNING organization_id, user_id""",
            (state_hash,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def put_api_key(organization_id: int, name: str, prefix: str, key_hash: str, scopes: list[str], created_by: str) -> dict:
    with db() as conn, conn.cursor() as cur:
        cur.execute("""INSERT INTO sf_api_keys (organization_id,name,key_prefix,key_hash,scopes,created_by)
                       VALUES (%s,%s,%s,%s,%s,%s) RETURNING id,name,key_prefix,scopes,created_at,last_used_at,revoked_at""", (organization_id, name, prefix, key_hash, json.dumps(scopes), created_by))
        return dict(cur.fetchone())


def list_api_keys(organization_id: int) -> list[dict]:
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id,name,key_prefix,scopes,created_at,last_used_at,revoked_at FROM sf_api_keys WHERE organization_id=%s ORDER BY created_at DESC", (organization_id,))
        return [dict(row) for row in cur.fetchall()]


def revoke_api_key(organization_id: int, key_id: int) -> bool:
    with db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE sf_api_keys SET revoked_at=now() WHERE id=%s AND organization_id=%s AND revoked_at IS NULL", (key_id, organization_id))
        return cur.rowcount == 1
