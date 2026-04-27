部署到 GitHub Pages（自动化）

步骤概览：

1. 在 GitHub 上创建一个仓库（例如 `my-fan-dashboard`）。
2. 将本地项目推送到该仓库的 `main` 分支。GitHub Actions 会在 push 后自动运行并把站点内容发布到 `gh-pages` 分支。

示例命令（在项目根目录执行）：

```bash
# 初始化（如果尚未为仓库初始化）
git init
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/YOUR_REPO.git
git add .
git commit -m "Add site files and deploy workflow"
git branch -M main
git push -u origin main
```

发布后默认访问地址：

- https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO/

注意事项：
- 如果你使用的是 `master` 而非 `main`，工作流也会触发（两者都包含）。
- GitHub Actions 使用内置 `GITHUB_TOKEN` 将内容推送到 `gh-pages` 分支，无需额外凭证。
- 若想使用自定义域，请在仓库根目录添加 `CNAME` 文件并在 GitHub Pages 设置中配置域名。

替代方案：
- Netlify / Vercel：可直接把仓库连到它们，或使用拖放部署（Netlify）/自动构建（Vercel）。需要在其控制台中连接到 GitHub 并授权。
