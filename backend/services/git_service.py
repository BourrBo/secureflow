import os
import tempfile
import subprocess
import shutil

# Anchor temp clones to a folder inside the backend itself, on the same drive
# the backend is running from. Windows' default system temp folder (usually C:)
# can differ from the drive the project lives on (e.g. D:), and several tools
# (Checkov's progress bar, among others) call os.path.relpath() internally,
# which fails with "path is on mount 'C:', start on mount 'D:'" when the two
# differ. Keeping everything on one drive avoids that entire class of bug.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_TMP_ROOT = os.path.join(_BASE_DIR, "..", "tmp_scans")
os.makedirs(_TMP_ROOT, exist_ok=True)


def clone_repo(repo_url: str):

    temp_dir = tempfile.mkdtemp(dir=_TMP_ROOT)

    subprocess.run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            repo_url,
            temp_dir
        ],
        check=True,
        text=True
    )

    return temp_dir


def cleanup_repo(repo_path: str):
    shutil.rmtree(repo_path, ignore_errors=True)