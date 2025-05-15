const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  login: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  age: { type: Number, required: true },
  country: { type: String, required: true },
  gender: { type: String, enum: ['muž', 'žena'], required: true },
  bio: { type: String }
});

module.exports = mongoose.model('User', userSchema);
