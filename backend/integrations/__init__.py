"""Optional, self-contained SecureFlow integrations feature package.

Nothing in the existing API imports this package. Deploy it as its own ASGI
service, or mount ``integrations.app.app`` behind a reverse proxy when the
team is ready to expose the feature.
"""
