"""Exercises the full Bitbucket flow end to end at the adapter level:

    authorize -> callback (exchange_code) -> /user -> /user/workspaces
    -> /repositories/{workspace} -> repository selection (get_repository)

httpx.get / httpx.post are monkeypatched with a small fake router so no
real network calls are made and no real token/secret is ever needed.
Bitbucket response shapes are hand-built to match the documented API
(including the nested `item["workspace"]["slug"]` membership shape for
`/user/workspaces`, which is the whole point of this fix).
"""

from __future__ import annotations

import logging

import httpx
import pytest
from fastapi import HTTPException

from integrations import bitbucket

FAKE_TOKEN = "fake-access-token"


@pytest.fixture(autouse=True)
def _oauth_env(monkeypatch):
    monkeypatch.setenv("BITBUCKET_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("BITBUCKET_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("BITBUCKET_REDIRECT_URI", "https://app.example.com/oauth/bitbucket/callback")


def _json_response(status_code: int, payload: dict, request: httpx.Request | None = None) -> httpx.Response:
    return httpx.Response(status_code, json=payload, request=request)


class FakeBitbucket:
    """Routes fake GET/POST calls the way api.bitbucket.org would, for the
    handful of endpoints this adapter touches."""

    def __init__(self):
        self.get_calls: list[tuple[str, dict | None]] = []
        self.post_calls: list[tuple[str, dict]] = []

    # ---- POST (token exchange) ----
    def post(self, url, *, data=None, auth=None, headers=None, timeout=None):
        self.post_calls.append((url, data or {}))
        assert url == bitbucket.BITBUCKET_TOKEN_URL
        assert data["grant_type"] == "authorization_code"
        if data["code"] == "bad-code":
            return _json_response(400, {"error": "invalid_grant"})
        return _json_response(
            200,
            {
                "access_token": FAKE_TOKEN,
                "refresh_token": "fake-refresh-token",
                "token_type": "bearer",
                "expires_in": 7200,
                "scopes": "account repository",
            },
        )

    # ---- GET (API calls) ----
    def get(self, url, *, headers=None, params=None, timeout=None):
        self.get_calls.append((url, params))
        assert headers["Authorization"] == f"Bearer {FAKE_TOKEN}"
        path = url[len(bitbucket.BITBUCKET_API_URL):]

        if path == "/user":
            return _json_response(
                200,
                {
                    "uuid": "{user-uuid}",
                    "username": "shivam",
                    "links": {"avatar": {"href": "https://bitbucket.org/account/shivam/avatar/"}},
                },
            )

        if path == "/user/workspaces":
            # Nested membership shape -- this is the structure the fix
            # must parse via item["workspace"]["slug"], not item["slug"].
            return _json_response(
                200,
                {
                    "values": [
                        {"permission": "owner", "workspace": {"slug": "sf-workspace", "name": "SF Workspace"}},
                        {"permission": "member", "workspace": {"slug": "other-ws", "name": "Other Workspace"}},
                        # Malformed entry with no workspace slug -- must be skipped, not crash.
                        {"permission": "member", "workspace": {}},
                    ]
                },
            )

        if path == "/repositories/sf-workspace":
            return _json_response(
                200,
                {
                    "values": [
                        {
                            "uuid": "{repo-1}",
                            "full_name": "sf-workspace/secureflow",
                            "name": "secureflow",
                            "is_private": True,
                            "mainbranch": {"name": "main"},
                            "links": {
                                "html": {"href": "https://bitbucket.org/sf-workspace/secureflow"},
                                "clone": [
                                    {"name": "https", "href": "https://bitbucket.org/sf-workspace/secureflow.git"},
                                    {"name": "ssh", "href": "git@bitbucket.org:sf-workspace/secureflow.git"},
                                ],
                            },
                        }
                    ],
                    "next": None,
                },
            )

        if path == "/repositories/other-ws":
            return _json_response(200, {"values": [], "next": None})

        if path == "/repositories/sf-workspace/secureflow":
            return _json_response(
                200,
                {
                    "uuid": "{repo-1}",
                    "full_name": "sf-workspace/secureflow",
                    "name": "secureflow",
                    "is_private": True,
                    "mainbranch": {"name": "main"},
                    "links": {
                        "html": {"href": "https://bitbucket.org/sf-workspace/secureflow"},
                        "clone": [
                            {"name": "https", "href": "https://bitbucket.org/sf-workspace/secureflow.git"},
                        ],
                    },
                },
            )

        if path == "/broken":
            return _json_response(500, {"type": "error", "error": {"message": "internal server hiccup"}})

        raise AssertionError(f"unexpected path requested in test fake: {path}")


@pytest.fixture()
def fake_bb(monkeypatch):
    fake = FakeBitbucket()
    monkeypatch.setattr(bitbucket.httpx, "get", fake.get)
    monkeypatch.setattr(bitbucket.httpx, "post", fake.post)
    return fake


def test_authorize_settings_returns_client_id_and_redirect(_oauth_env=None):
    client_id, redirect_uri = bitbucket.authorize_settings()
    assert client_id == "test-client-id"
    assert redirect_uri == "https://app.example.com/oauth/bitbucket/callback"


def test_exchange_code_success(fake_bb):
    payload = bitbucket.exchange_code("good-code")
    assert payload["access_token"] == FAKE_TOKEN
    assert fake_bb.post_calls[0][1]["code"] == "good-code"


def test_exchange_code_rejected(fake_bb):
    with pytest.raises(HTTPException) as exc_info:
        bitbucket.exchange_code("bad-code")
    assert exc_info.value.status_code == 400


def test_authenticated_user(fake_bb):
    user = bitbucket.authenticated_user(FAKE_TOKEN)
    assert user == {
        "id": "{user-uuid}",
        "login": "shivam",
        "avatar_url": "https://bitbucket.org/account/shivam/avatar/",
    }


def test_list_repositories_uses_user_workspaces_and_nested_slug(fake_bb):
    repos = bitbucket.list_repositories(FAKE_TOKEN, page=1, per_page=25)

    # Confirms the discovery endpoint changed and the nested shape was parsed.
    requested_paths = [url[len(bitbucket.BITBUCKET_API_URL):] for url, _ in fake_bb.get_calls]
    assert "/user/workspaces" in requested_paths
    assert "/workspaces" not in requested_paths  # old, now-broken endpoint must not be called

    assert "/repositories/sf-workspace" in requested_paths
    assert "/repositories/other-ws" in requested_paths  # second workspace also enumerated

    # The malformed membership entry (empty workspace dict) must not blow up
    # and must not be turned into a bogus /repositories/None call.
    assert not any(p.startswith("/repositories/None") for p in requested_paths)

    assert repos == [
        {
            "id": "{repo-1}",
            "full_name": "sf-workspace/secureflow",
            "name": "secureflow",
            "private": True,
            "default_branch": "main",
            "html_url": "https://bitbucket.org/sf-workspace/secureflow",
            "clone_url": "https://bitbucket.org/sf-workspace/secureflow.git",
        }
    ]


def test_get_repository_selection(fake_bb):
    repo = bitbucket.get_repository(FAKE_TOKEN, "sf-workspace/secureflow")
    assert repo["full_name"] == "sf-workspace/secureflow"
    assert repo["clone_url"] == "https://bitbucket.org/sf-workspace/secureflow.git"


def test_get_repository_rejects_malformed_full_name(fake_bb):
    with pytest.raises(HTTPException) as exc_info:
        bitbucket.get_repository(FAKE_TOKEN, "not-a-workspace-slash-repo")
    assert exc_info.value.status_code == 400


def test_bitbucket_get_logs_upstream_failure_but_hides_body_from_caller(fake_bb, caplog):
    with caplog.at_level(logging.WARNING, logger=bitbucket.logger.name):
        with pytest.raises(HTTPException) as exc_info:
            bitbucket._bitbucket_get("/broken", FAKE_TOKEN)

    # Caller-facing exception is generic -- no upstream body/status text leaked.
    assert exc_info.value.status_code == 502
    assert "internal server hiccup" not in exc_info.value.detail
    assert FAKE_TOKEN not in exc_info.value.detail

    # Server-side log DOES capture the upstream status/body for diagnosis.
    joined_logs = "\n".join(record.message for record in caplog.records)
    assert "500" in joined_logs
    assert "internal server hiccup" in joined_logs
    # ...but the token is never written to the log.
    assert FAKE_TOKEN not in joined_logs


def test_bitbucket_get_401_maps_to_reconnect_style_error(fake_bb, monkeypatch):
    def get_401(url, *, headers=None, params=None, timeout=None):
        return _json_response(401, {"error": {"message": "Access token expired"}})

    monkeypatch.setattr(bitbucket.httpx, "get", get_401)
    with pytest.raises(HTTPException) as exc_info:
        bitbucket._bitbucket_get("/user", FAKE_TOKEN)
    assert exc_info.value.status_code == 401
