const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const validator = require('validator');
const rateLimit = require('express-rate-limit');

// Limiter pre prihlasovanie
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minút
  max: 5, // max 5 pokusov
  message: 'Príliš veľa pokusov o prihlásenie, skúste znova neskôr.'
});

router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  const { name, login, email, password, confirmPassword, age, country, gender, bio } = req.body;
  const errors = [];

  if (!name || !login || !email || !password || !confirmPassword || !age || !country || !gender) {
    errors.push('Všetky polia sú povinné.');
  }

  if (!validator.isEmail(email)) {
    errors.push('Neplatný formát emailu.');
  }

  if (password !== confirmPassword) {
    errors.push('Heslá sa nezhodujú.');
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    errors.push('Heslo musí mať aspoň 8 znakov, veľké aj malé písmená.');
  }

  if (isNaN(age) || age < 16) {
    errors.push('Musíte mať aspoň 16 rokov.');
  }

  const existingUser = await User.findOne({ $or: [{ email }, { login }] });
  if (existingUser) {
    errors.push('Email alebo login je už použitý.');
  }

  if (errors.length > 0) {
    return res.render('register', { errors, formData: req.body });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = new User({
    name,
    login,
    email,
    password: hashedPassword,
    age,
    country,
    gender,
    bio
  });

  await newUser.save();
  res.send('Registrácia prebehla úspešne!');
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', loginLimiter, async (req, res) => {
  const { identifier, password } = req.body;

  const user = await User.findOne({ $or: [{ email: identifier }, { login: identifier }] });
  if (!user) {
    return res.render('login', { error: 'Používateľ neexistuje.' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.render('login', { error: 'Nesprávne heslo.' });
  }

  req.session.user = {
    id: user._id,
    name: user.name,
    email: user.email
  };

  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) throw err;
    res.redirect('/');
  });
});

module.exports = router;
