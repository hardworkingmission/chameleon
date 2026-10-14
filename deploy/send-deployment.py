"""Send only deployment configuration to EC2; application secrets stay on EC2."""
import base64
import io
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tarfile
import time

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    'compose.yml': ROOT / 'deploy/compose.yml',
    'Caddyfile': ROOT / 'deploy/Caddyfile',
    'deploy.sh': ROOT / 'backend/scripts/deploy.sh',
}


def checked(value, pattern, label):
    if not re.fullmatch(pattern, value):
        raise ValueError(f'Invalid {label}')
    return value


def build_request(instance, region, account, tag, env_file='/home/admin/chameleon/backend/.env'):
    checked(instance, r'i-[a-f0-9]{8,17}', 'instance ID')
    checked(region, r'[a-z]{2}-[a-z]+-\d+', 'region')
    checked(account, r'\d{12}', 'account ID')
    checked(tag, r'[a-f0-9]{40}-\d+-\d+', 'release tag')
    if not env_file.startswith('/') or any(c in env_file for c in '\r\n\0'):
        raise ValueError('Invalid backend environment file path')
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w:gz') as tar:
        for name, source in FILES.items():
            # Normalize CRLF even when this is run from a Windows checkout.
            data = source.read_bytes().replace(b'\r\n', b'\n')
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            entry.mode = 0o600
            tar.addfile(entry, io.BytesIO(data))
    encoded = base64.b64encode(archive.getvalue()).decode('ascii')
    directory = f'/opt/chameleon/releases/{tag}'
    registry = f'{account}.dkr.ecr.{region}.amazonaws.com'
    # Identifiers are restricted above; the file path is shell-quoted.
    commands = [
        'set -eu',
        'umask 077',
        f'mkdir -p {directory}',
        f"printf '%s' '{encoded}' | base64 -d | tar -xz -C {directory}",
        f'bash {directory}/deploy.sh {directory} {region} {registry} {tag} {shlex.quote(env_file)}',
    ]
    return {
        'InstanceIds': [instance],
        'DocumentName': 'AWS-RunShellScript',
        'Comment': f'Chameleon backend {tag}',
        'TimeoutSeconds': 120,
        'Parameters': {'commands': commands, 'executionTimeout': ['1500']},
    }


def aws(*args):
    return subprocess.run(['aws', *args, '--output', 'json'], text=True,
                          capture_output=True, check=True)


def main():
    account = json.loads(aws('sts', 'get-caller-identity').stdout)['Account']
    instance = os.environ['EC2_INSTANCE_ID']
    request = build_request(instance, os.environ['AWS_REGION'], account, os.environ['IMAGE_TAG'],
                            os.environ.get('BACKEND_ENV_FILE') or '/home/admin/chameleon/backend/.env')
    response = aws('ssm', 'send-command', '--cli-input-json', json.dumps(request))
    command_id = json.loads(response.stdout)['Command']['CommandId']
    print(f'SSM command: {command_id}', flush=True)
    # SSM's default CLI waiter only waits about 100 seconds. Pulls can take longer.
    deadline = time.monotonic() + 1620
    while time.monotonic() < deadline:
        time.sleep(10)
        try:
            result = json.loads(aws('ssm', 'get-command-invocation',
                                    '--command-id', command_id, '--instance-id', instance).stdout)
        except subprocess.CalledProcessError as error:
            if 'InvocationDoesNotExist' in error.stderr:
                continue  # Run Command is eventually consistent.
            raise
        if result['Status'] in ('Pending', 'InProgress', 'Delayed', 'Cancelling'):
            continue
        print(result.get('StandardOutputContent', ''))
        print(result.get('StandardErrorContent', ''))
        if result['Status'] != 'Success':
            raise SystemExit(f"Deployment failed: {result['Status']}")
        return
    raise SystemExit(f'Timed out waiting for SSM command {command_id}; inspect it before retrying.')


def cli():
    try:
        main()
    except subprocess.CalledProcessError as error:
        # CalledProcessError otherwise prints the entire deployment payload
        # while hiding the AWS service error captured on stderr.
        detail = (error.stderr or '').strip() or 'AWS CLI returned no error details.'
        raise SystemExit(f'AWS CLI failed (exit {error.returncode}): {detail}') from None


if __name__ == '__main__':
    cli()
