import tempfile
import zipfile
import os
import shutil

def save_and_extract_zip(uploaded_file) -> str:
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "upload.zip")

    with open(zip_path, "wb") as f:
        shutil.copyfileobj(uploaded_file.file, f)

    extract_path = os.path.join(temp_dir, "extracted")
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_path)

    os.remove(zip_path)  # don't need the zip anymore, just the extracted code
    return extract_path

def cleanup_upload(extract_path: str):
    # reuse the same pattern as cleanup_repo, just walk up one level to remove the whole temp_dir
    parent_temp_dir = os.path.dirname(extract_path)
    shutil.rmtree(parent_temp_dir, ignore_errors=True)