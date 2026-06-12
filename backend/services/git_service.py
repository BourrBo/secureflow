import tempfile
import subprocess
import shutil

def clone_repo(repo_url: str):

    temp_dir = tempfile.mkdtemp()

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