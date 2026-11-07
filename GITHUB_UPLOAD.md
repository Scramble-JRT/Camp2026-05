# Upload Packer to GitHub

The repository `Scramble-JRT/Camp2026-05` already exists but the connected GitHub account does not currently have push access. Ask a team organizer to grant Write permission, or create a new repository on your own account.

## Once you have write access to the team repository

1. Open Windows PowerShell in **the folder containing these files** (not in a parent folder).
2. Run:

```powershell
git init
git branch -M main
git add .
git commit -m "Initial Packer hackathon project"
git remote add origin https://github.com/Scramble-JRT/Camp2026-05.git
git push -u origin main
```

This assumes the remote repo is still empty and you have push permission.

## Creating your own repo instead

1. Visit https://github.com/new
2. Name it `packer-hackathon`. Select Private if desired, and avoid initializing with a README, .gitignore, or license.
3. Use the same commands above, replacing the remote URL with the URL GitHub displays for your new repository.

## Security

Never upload `.env`, Anthropic API keys, or a virtual environment folder. The `.gitignore` excludes them, but check `git status` before committing. The team repository is **public**.

## Running locally

```powershell
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-vision.txt
python app.py
```

Then browse to http://127.0.0.1:5000.
