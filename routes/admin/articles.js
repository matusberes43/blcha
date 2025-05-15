
const express = require('express');
const router = express.Router();
const Article = require('../../models/Article');

// middleware for admin-only access
router.use((req, res, next) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.redirect('/');
  }
  next();
});

// GET /admin/articles
router.get('/articles', async (req, res) => {
  const articles = await Article.find().sort({ createdAt: -1 });
  res.render('admin/articles', { articles });
});

// GET /admin/articles/new
router.get('/articles/new', (req, res) => {
  res.render('admin/new');
});

// POST /admin/articles
router.post('/articles', async (req, res) => {
  const { title, subtitle, category, content, imageUrl } = req.body;
  await Article.create({
    title,
    subtitle,
    category,
    content,
    imageUrl,
    author: req.session.user._id
  });
  res.redirect('/admin/articles');
});

module.exports = router;
