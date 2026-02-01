const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "foruselesspurpose69@gmail.com",
    pass: "apnr ypda qiae spxn",
  },
});

module.exports.sendMessage = async ({email, pass, role}) => {
  try{
    const info = await transporter.sendMail({
      from: 'foruselesspurpose69@gmail.com',
      to: email,
      subject: "Forgot Password - University Admin",
      text: `these are your credentials:
        username: ${email},
        password: ${pass},
        role: ${role}
  
  
        regards
        Bhavya Admin
      `, 
  
    });

    return true
  }catch(err){
    console.log(err.message)
    return false
  }
}