# Security

Do not post credentials, uploaded user files, or exploitable vulnerability details
in public issues. Use GitHub private vulnerability reporting if enabled on the
repository, or arrange a private reporting channel with the maintainer first.

Self-hosted deployments must configure HTTPS, strong secrets, restricted database
access, and appropriate resource limits. The project is not a sandbox for arbitrary
untrusted workloads. Review the deployment documentation before exposing it publicly.

Local temporary files are cleaned up; optional S3 archives persist until removed
by the operator. Set a retention policy appropriate for your users.
