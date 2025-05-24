index.js

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const User = require('../models/User');
const Message = require('../models/Message');

// 📁 Multer – ukladanie avatarov
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, req.session.user.nickname + '-avatar' + ext);
  }
});
const upload = multer({ storage });

// ====================== ROUTY ======================

// 🏠 Úvodná stránka
router.get('/', (req, res) => {
  res.render('home');
});

// ❌ Ban po kliknutí na NIE
router.post('/ban', (req, res) => {
  const banUntil = Date.now() + 24 * 60 * 60 * 1000;
  req.session.banUntil = banUntil;
  res.redirect('/');
});

// 🛠 Admin panel
router.get('/admin', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Přístup zakázán');
  }

  const users = await User.find({});
  res.render('admin', {
    users,
    userLogged: req.session.user
  });
});

// 🗑 Vymazanie používateľa
router.post('/admin/delete/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Zakázané');
  }

  const id = req.params.id;
  const userToDelete = await User.findById(id);
  if (!userToDelete) return res.send('Uživatel nenalezen');
  if (userToDelete.nickname === req.session.user.nickname) return res.send('Nemůžeš smazat sám sebe.');

  await User.findByIdAndDelete(id);
  res.redirect('/admin');
});

// 🔐 VIP prihlásenie
router.post('/vip-login', (req, res) => {
  const correctCode = '1233';
  const now = Date.now();
  const banUntil = req.session.vipBanUntil || 0;

  if (now < banUntil) {
    return res.send('Byl ti zablokován VIP přístup na 24 hodin.');
  }

  const code = req.body.vipCode?.trim();

  if (code === correctCode) {
    req.session.user = {
      nickname: 'PunisherEDNA',
      role: 'admin',
      avatar: '/uploads/default.png'
    };
    delete req.session.vipTried;
    delete req.session.vipBanUntil;
    return res.redirect('/admin');
  }

  req.session.vipTried = true;
  req.session.vipBanUntil = now + 24 * 60 * 60 * 1000;
  return res.send('Zadal jsi špatný kód. VIP přístup zablokován na 24 hodin.');
});

// 👤 Verejný profil
router.get('/user/:nickname', async (req, res) => {
  const nickname = req.params.nickname;
  const user = await User.findOne({ nickname });

  if (!user) {
    return res.status(404).render('user-not-found', { nickname });
  }

  // Ak je používateľ prihlásený, načítaj ho z DB a aktualizuj jeho favorites v session
  if (req.session.user) {
    const freshUser = await User.findOne({ nickname: req.session.user.nickname });
    req.session.user.favorites = freshUser.favorites; // sem sa zapíšu aktuálne obľúbení
  }

  res.render('user', { user, currentUser: req.session.user });
});

// 🔧 Formulár na úpravu profilu
router.get('/edit-profile', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const user = await User.findOne({ nickname: req.session.user.nickname });
  res.render('edit-profile', { user });
});

// 💾 Odoslanie úprav profilu
router.post('/edit-profile', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const user = await User.findOne({ nickname: req.session.user.nickname });

  user.name = req.body.name;
  user.age = req.body.age;
  user.country = req.body.country;
  user.email = req.body.email;
  user.about = req.body.about;

  // Nepovinné: len ak chceš umožniť zmenu role
  // user.role = req.body.role;

  user.hiddenFields = req.body.hiddenFields || []; // pole checkboxov
  user.fieldOrder = req.body.fieldOrder ? req.body.fieldOrder.split(',') : [];

  await user.save();
  res.redirect('/user/' + user.nickname);
});


const Article = require('./models/Article'); 

// 🧾 Moje príspevky – osobný feed
router.get('/my-posts', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const nickname = req.session.user.nickname;
  const posts = await Article.find({ author: nickname }).sort({ createdAt: -1 });

  res.render('my-posts', {
    user: req.session.user,
    posts
  });
});




// 🖼️ Zmena avataru
router.post('/user/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const user = await User.findOne({ nickname: req.session.user.nickname });
  if (!user) return res.send('Uživatel nenalezen.');

  user.avatar = '/uploads/' + req.file.filename;
  await user.save();

  req.session.user.avatar = user.avatar;
  res.redirect('/user/' + user.nickname);
});

// Pridať do obľúbených
router.post('/favorites/add', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const currentUser = await User.findOne({ nickname: req.session.user.nickname });
  if (!currentUser.favorites.includes(req.body.target)) {
    currentUser.favorites.push(req.body.target);
    await currentUser.save();
  }
  res.redirect('/user/' + req.body.target);
});




// Odstrániť z obľúbených
router.post('/favorites/remove', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const currentUser = await User.findOne({ nickname: req.session.user.nickname });
  currentUser.favorites = currentUser.favorites.filter(nick => nick !== req.body.target);
  await currentUser.save();
  res.redirect('/notifications');
});


// Stránka s notifikáciami
router.get('/notifications', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const currentUser = await User.findOne({ nickname: req.session.user.nickname });

  const favorites = await User.find({ nickname: { $in: currentUser.favorites } });

  // Zber aktivít – v budúcnosti články, recenzie
  const activities = [];

  for (const fav of favorites) {
    // ukážka aktivít (doplň neskôr napr. články z DB)
    activities.push({
      nickname: fav.nickname,
      type: 'Nový článek',
      title: 'Titul článku',
      time: new Date(),
    });
  }

  res.render('notifications', {
    activities,
    favorites: currentUser.favorites
  });
});



// 💬 Inbox – prijaté správy
router.get('/messages', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const messages = await Message.find({ to: req.session.user.nickname }).sort({ createdAt: -1 });
  res.render('messages', { messages, user: req.session.user });
});

// ✉️ Odoslanie správy (z profilu aj z chatu)
router.post('/messages/send', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const { to, body } = req.body;

  await Message.create({
    from: req.session.user.nickname,
    to,
    body,
    read: false // 🔥 nezabudni na read: false
  });

  res.redirect('/user/' + to);
});


// 🗨️ Konverzácia medzi používateľmi
router.get('/messages/:nickname', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const currentNick = req.session.user.nickname;
  const targetNick = req.params.nickname;

  // 🔥 Označ správy ako prečítané
  await Message.updateMany(
    { from: targetNick, to: currentNick, read: false },
    { $set: { read: true } }
  );

  const messages = await Message.find({
    $or: [
      { from: currentNick, to: targetNick },
      { from: targetNick, to: currentNick }
    ]
  }).sort({ createdAt: 1 });

  res.render('conversation', {
    user: req.session.user,
    otherUser: targetNick,
    messages
  });
});

module.exports = router;



Article.js

const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: String,
  category: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Article', articleSchema);


server.js

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const User = require('./models/User');
const Message = require('./models/Message');

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

// 🚀 Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server beží na http://localhost:${PORT}`);
});


User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String, // Jméno
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  age: Number,
  country: String,
  email: String,
  nickname: String,
  password: String,
  avatar: {
    type: String,
    default: '/uploads/default.png'
  },
  favorites: {
    type: [String],
    default: []
  },
  about: String,
  favoriteMovie: String,
  hiddenFields: {
    type: [String],
    default: []
  },
  fieldOrder: {
    type: [String],
    default: ['name', 'age', 'country', 'email', 'about', 'registrationDate']
  }
});

module.exports = mongoose.model('User', userSchema);


