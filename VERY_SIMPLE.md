# ⚡ VERY SIMPLE INSTRUCTIONS

## Step 1: Restart VS Code
Close VS Code completely and reopen it. This makes Git available in the terminal.

---

## Step 2: After Restarting

You'll see a "Terminal" tab at the bottom of VS Code.

Click the terminal tab.

---

## Step 3: Type These Commands One at a Time

Copy/paste these commands into the terminal, press Enter after each:

```bash
git --version
```

Should show something like "git version 2.x.x"

Then:

```bash
git init
git add .
git commit -m "Add family support system"
git remote add origin https://github.com/lychwaw/bluebird-payments-pro.git
git push -u origin main
```

---

## If Git Still Not Working

You might need to manually add Git to PATH during installation.

**Or just use VS Code Git UI:**

1. Click "Source Control" icon (left sidebar, branch icon)
2. Click "+" to stage all
3. Type message
4. Click ✓ to commit
5. Click "..." then "Push"

---

## That's It!

After pushing, Vercel auto-deploys in 1-2 minutes! 🚀


