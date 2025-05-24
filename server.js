const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const User = require('./models/User');
const Message = require('./models/Message');

// ✅ nový model pre diskusie
const Discussion = require('./models/Discussion');

const app = express();

// 📦 MongoDB
mongoose.connect('mongodb://localhost:27017/moj-web', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Pripojené k MongoDB');
}).catch(err => {
  console.error('❌ Chyba MongoDB:', err);
});

// 📄 EJS, public, formuláre
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 🗝️ Session
app.use(session({
  secret: 'tajomstvo-punishera',
  resave: false,
  saveUninitialized: true
}));

// ✅ 1. Načítanie avataru zo session (aktualizované z DB)
app.use(async (req, res, next) => {
  if (req.session.user) {
    const dbUser = await User.findOne({ nickname: req.session.user.nickname });
    if (dbUser) {
      req.session.user.avatar = dbUser.avatar || '/uploads/default.png';
    }
  }
  next();
});

// ✅ 2. Spočítanie neprečítaných správ pre hornú lištu
app.use(async (req, res, next) => {
  if (req.session.user) {
    const unreadCount = await Message.countDocuments({
      to: req.session.user.nickname,
      read: false
    });
    res.locals.unreadMessages = unreadCount;
  } else {
    res.locals.unreadMessages = 0;
  }
  next();
});

// ✅ 3. Zdieľané premenné pre šablóny
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;

  const banUntil = req.session.banUntil || 0;
  res.locals.banned = Date.now() < banUntil;
  req.session.banUntil = banUntil;

  const vipBanUntil = req.session.vipBanUntil || 0;
  res.locals.vipBanned = Date.now() < vipBanUntil;
  res.locals.vipBanUntil = vipBanUntil;

  next();
});

// 📁 Routy
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
app.use('/', indexRoutes);
app.use(authRoutes);

// ✅ Diskusné routy
const discussionsRoutes = require('./routes/discussions');
app.use('/discussions', discussionsRoutes);

// 🚀 Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server beží na http://localhost:${PORT}`);
});