const mongoose = require('mongoose');

module.exports.connectMongo = async() =>{
    mongoose.connect("mongodb://127.0.0.1:27017/universityDb")
      .then(() => console.log("DB Connected"))
      .catch(err => console.log(err))
}