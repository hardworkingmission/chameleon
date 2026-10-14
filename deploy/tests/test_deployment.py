import base64
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('sender', ROOT / 'deploy/send-deployment.py')
sender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sender)
TAG = 'a' * 40 + '-123-1'


class RequestTests(unittest.TestCase):
    def test_bundle_contains_only_release_files(self):
        request = sender.build_request('i-0123456789abcdef0', 'us-east-1', '123456789012', TAG)
        payload = request['Parameters']['commands'][3].split("'")[3]
        with tarfile.open(fileobj=io.BytesIO(base64.b64decode(payload)), mode='r:gz') as tar:
            self.assertEqual(set(tar.getnames()), {'compose.yml', 'Caddyfile', 'deploy.sh'})
            for member in tar.getmembers():
                self.assertNotIn(b'\r', tar.extractfile(member).read())
        self.assertIn(TAG, request['Parameters']['commands'][-1])

    def test_rejects_shell_metacharacters(self):
        for index, malicious in [(0, 'i-abcd; id'), (1, 'us-east-1; id'),
                                 (2, '123456789012$(id)'), (3, TAG + '; id')]:
            args = ['i-0123456789abcdef0', 'us-east-1', '123456789012', TAG]
            args[index] = malicious
            with self.assertRaises(ValueError):
                sender.build_request(*args)


@unittest.skipUnless(os.name == 'posix', 'Shell integration checks run on Linux CI')
class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / 'app'
        self.config = self.root / 'config'
        self.release = self.app / 'releases' / TAG
        self.old = self.app / 'releases' / ('b' * 40 + '-122-1')
        for directory in [self.release, self.old, self.config / 'rds', self.root / 'bin']:
            directory.mkdir(parents=True)
        (self.config / '.env').write_text('JWT_SECRET=test\n')
        (self.config / 'rds/global-bundle.pem').write_text('test certificate')
        (self.old / 'image.env').write_text('IMAGE_TAG=previous\n')
        (self.app / 'current').symlink_to(self.old)
        source = (ROOT / 'backend/scripts/deploy.sh').read_text()
        source = source.replace('/opt/chameleon', str(self.app)).replace('/etc/chameleon', str(self.config))
        self.script = self.release / 'deploy.sh'
        self.script.write_text(source)
        self.trace = self.root / 'trace'
        self.env = dict(os.environ, PATH=f"{self.root / 'bin'}:{os.environ['PATH']}",
                        TRACE=str(self.trace), NEW_RELEASE=str(self.release))
        self.fake('aws', 'echo fake-password\n')
        self.fake('docker', '''
echo "$*" >> "$TRACE"
if [[ "$1" == login ]]; then cat >/dev/null; exit 0; fi
if [[ "$*" == *"run --rm --no-deps migrate"* && "${FAIL_MIGRATION:-}" == 1 ]]; then exit 1; fi
if [[ "$*" == *"$NEW_RELEASE/compose.yml up"* && "${FAIL_HEALTH:-}" == 1 ]]; then exit 1; fi
exit 0
''')

    def fake(self, name, body):
        script = self.root / 'bin' / name
        script.write_text('#!/usr/bin/env bash\nset -eu\n' + body)
        script.chmod(0o755)

    def run_deploy(self, **overrides):
        return subprocess.run(['bash', str(self.script), str(self.release), 'us-east-1',
                               '123456789012.dkr.ecr.us-east-1.amazonaws.com', TAG],
                              env=dict(self.env, **overrides), capture_output=True, text=True)

    def test_migration_failure_does_not_replace_api(self):
        result = self.run_deploy(FAIL_MIGRATION='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(' up ', self.trace.read_text())
        self.assertEqual((self.app / 'current').resolve(), self.old)

    def test_failed_health_restores_previous_release_and_reports_failure(self):
        result = self.run_deploy(FAIL_HEALTH='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f'{self.old}/compose.yml up', self.trace.read_text())
        self.assertEqual((self.app / 'current').resolve(), self.old)

    def test_success_records_release_after_migration(self):
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        trace = self.trace.read_text()
        self.assertLess(trace.index('run --rm --no-deps migrate'), trace.index(' up '))
        self.assertEqual((self.app / 'current').resolve(), self.release)
        self.assertEqual((self.app / 'previous').resolve(), self.old)

    def test_first_deployment_does_not_record_a_nonexistent_previous_release(self):
        (self.app / 'current').unlink()
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.app / 'current').resolve(), self.release)
        self.assertFalse((self.app / 'previous').is_symlink())


if __name__ == '__main__':
    unittest.main()
