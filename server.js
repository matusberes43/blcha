require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Session (musí byť pred middlewarem s req.session)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

// Middleware na prístup k req.session.user vo view
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const adminArticles = require('./routes/admin/articles');
app.use('/', authRoutes);
app.use('/admin', adminArticles);

app.get('/', (req, res) => {
  res.render('index');
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

