# Push Code to GitHub

Since GitHub requires authentication, you'll need to push the code from your Mac where you have GitHub credentials configured.

## Option 1: Download and Push from Mac (Recommended)

### Step 1: Download the Project
1. Download the project from the Manus checkpoint: `manus-webdev://8b86cc75`
2. Extract the ZIP file on your Mac

### Step 2: Push to GitHub
```bash
cd vazal-ai-homepage  # or whatever folder you extracted to

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: vazal.ai with SMS login"

# Add your GitHub repository as remote
git remote add origin https://github.com/franksiereveld/DCO2_Vazal.git

# Push to GitHub
git push -u origin main
```

### Step 3: If you get authentication errors:
```bash
# Use GitHub CLI (recommended)
gh auth login

# Or use Personal Access Token
# 1. Go to https://github.com/settings/tokens
# 2. Generate new token (classic) with 'repo' scope
# 3. Use token as password when pushing
```

---

## Option 2: Direct Clone (After pushing from Mac)

Once the code is on GitHub, you can clone it anywhere:

```bash
git clone https://github.com/franksiereveld/DCO2_Vazal.git
cd DCO2_Vazal
```

---

## Next Steps

After pushing to GitHub, follow `DEPLOYMENT.md` to run the server on your Mac.
