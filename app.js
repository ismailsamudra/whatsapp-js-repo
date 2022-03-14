const { Client, LegacySessionAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors')
const { body, validationResult } = require('express-validator');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const port = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const { ok } = require('assert');
// const { ClientInfo } = require('whatsapp-web.js/src/structures');
const jsonParser = bodyParser.json()

const app = express();
const server = http.createServer(app);

const BASE_URL = './base.json';
let base;
if (fs.existsSync(BASE_URL)) {
  base = require(BASE_URL);
}
  let base_url = base.url;
  let api_key = base.token;

  let reply_server = base.url+"whatsapp/reply";
//   let cek_server = base.url+"whatsapp/cek_server"; 

  // let reply_server = "https://google.com/";
  // let cek_server = "https://google.com/"; 


app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: false
}));
app.use(cors())

const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
  res.sendFile('page.html', {
    root: __dirname
  });
});

app.get("/get_key_083136245050", (req, res) => {
  res.status(200).json({api_key});
});
app.get("/get_url_083136245050", (req, res) => {
  res.status(200).json({base_url});
});

// app.post("/base", jsonParser, [
//     body('url').notEmpty(),
//   ], async (req, res) => {
//     try {
//       fs.writeFile(BASE_URL, JSON.stringify(req.body), function (err) {
//         if (err) {
//             console.error(err);
//         }
//       });
//       res.status(200).json({
//         status: true,
//         msg: "Base Data Saving",
//         data: req.body
//       });
//     } catch (error) {
//       console.log('Write json Fail')
//     }

//   });

const client = new Client({
//   restartOnAuthFail: true,
//   puppeteer: {
//     headless: true,
//     args: [
//       '--no-sandbox',
//       '--disable-setuid-sandbox',
//       '--disable-dev-shm-usage',
//       '--disable-accelerated-2d-canvas',
//       '--no-first-run',
//       '--no-zygote',
//       '--single-process', // <- this one doesn't works in Windows
//       '--disable-gpu'
//     ],
//   },
      authStrategy: new LegacySessionAuth({
        session: sessionCfg
    })
});

let status = "NOT READY";
let qrcode_return = null;

client.initialize();

client.on('qr', (qr) => {
  qrcode_return = qr;
 // console.log('QR RECEIVED', qr);
  if(qr){
   console.log('QR RECEIVED', 'Success');
  }else{
    console.log('QR RECEIVED', 'Fail !');
  }
});

client.on('authenticated', (session) => {
  console.log('AUTHENTICATED', session);
  sessionCfg=session;
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
      if (err) {
          console.error(err);
      }
  });
});

client.on('auth_failure', msg => {
  // Fired if session restore was unsuccessfull
  console.error('AUTHENTICATION FAILURE', msg);
  status = "NOT READY";
});

client.on('ready', () => {
  status = "READY";
  console.log('READY');
});

client.on('change_battery', (batteryInfo) => {
  const { battery, plugged } = batteryInfo;
  console.log(`Battery: ${battery}% - Charging? ${plugged}`);
});

client.on('disconnected', (reason) => {
    status = "NOT READY"
//   client.destroy();
//   client.initialize();
//   if (fs.existsSync(SESSION_FILE_PATH)) {
//     fs.unlinkSync(SESSION_FILE_PATH);
//   }
  console.log('Client was logged out', reason);
});


app.get("/status", (req, res) => {
  res.status(200).json({
      status: true,
      msg: status,
      data: {}
  });
});

// app.get("/reset", (req, res) => {
//   client.destroy();
//   client.initialize();
//   res.status(200).json({
//       status: true,
//       msg: "reset success",
//       data: {}
//   });
// });

app.post("/logout", jsonParser, [
  body('token').notEmpty(),
], async (req, res) => {
    const token_auth = req.body.token;
    if(api_key == token_auth){
        status = "NOT READY"
        client.destroy();
        client.initialize();
        res.status(200).json({
            status: true,
            msg:"Berhasil Keluar",
            data:{}
          });
          if (fs.existsSync(SESSION_FILE_PATH)) {
            fs.unlinkSync(SESSION_FILE_PATH);
          }
        console.log('Client was logged out');
      }else{
        res.status(422).json({
          status: false,
          msg:"API-KEY-SALAH",
          data:{}
        });
    }
});

app.get("/qr", (req, res) => {
      res.status(200).json({
        status: true,
        msg: "mendapatkan qr",
        data: {
            qr: qrcode_return
        }
      });
});
 
// app.get("/nomor", (req, res) => {
//  let final = ['083136245050'];
//  string = 'SGVsbG8gV29ybGQh';
//  encodedString = btoa(string);
//  decodedString = atob(string);
//   res.status(200).json({
//       status: true,
//       phone: final
//   });
// });

const checkRegisteredNumber = async function(number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}

// Send message
app.post('/send', jsonParser, [
  body('token').notEmpty(),
  body('number').notEmpty(),
  body('message').notEmpty(),
  body('act').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });
/**/
  const token_auth = req.body.token;
  if(api_key != token_auth){
    return res.status(500).json({
      status: false,
      msg: 'Api-key Salah',
      data: {}
    });
  }
  if(status == "NOT READY"){
      return res.status(500).json({
          status: false,
          msg: 'Whatsapp is not ready',
          data: {}
      });
  }

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      msg: errors.mapped(),
      data: {}
    });
  }

  const act = req.body.act;
  if(act=='0'){
    const message = req.body.message;
    const number = phoneNumberFormatter(req.body.number);
    const isRegisteredNumber = await checkRegisteredNumber(number);
    if (!isRegisteredNumber) {
      return res.status(422).json({
        status: false,
        msg: 'not_register',
        data: {}
      });
    }
  
    client.sendMessage(number, message).then(response => {
      res.status(200).json({
        status: true,
        msg: "Terkirim",
        data: {response}
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        msg: "Gagal terkirim",
        data: {err}
      });
    });
  }else{
    const message = req.body.message;
    const number = req.body.number+'@g.us';
    client.sendMessage(number, message).then(response => {
      res.status(200).json({
        status: true,
        msg: "Terkirim",
        data: {response}
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        msg: "Gagal terkirim",
        data: {err}
      });
    });
  }

});

// Send message
app.post('/cek-nomor', jsonParser, [
  body('number').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if(status == "NOT READY"){
      return res.status(500).json({
          status: 'not',
          msg: 'Whatsapp is not ready',
          data: {}
      });
  }

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      msg: errors.mapped(),
      data: {}
    });
  }

  const number = phoneNumberFormatter(req.body.number);
  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    res.status(422).json({
      status: false,
      msg: 'not_register',
      data: {}
    });
  }else{
    res.status(200).json({
      status: true,
      msg: "is_register",
      data: {}
    });
  }
});

// Send media
app.post('/send-media', jsonParser, async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  const fileUrl = req.body.file;
  const token_auth = req.body.token;
  if(api_key != token_auth){
    return res.status(500).json({
      status: false,
      msg: 'Api-key Salah',
      data: {}
    });
  }
  // const media = MessageMedia.fromFilePath('./image-example.png');
  // const file = req.files.file;
  // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  let mimetype;
  const attachment = await axios.get(fileUrl, {
    responseType: 'arraybuffer'
  }).then(response => {
    mimetype = response.headers['content-type'];
    return response.data.toString('base64');
  });

  const media = new MessageMedia(mimetype, attachment, 'Media');

  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Send message to group
// -- Send message !groups to get all groups (id & name)
// -- So you can use that group id to send a message
// app.post('/send-group-message', [
//   body('id').notEmpty(),
//   body('message').notEmpty(),
// ], async (req, res) => {
//   const errors = validationResult(req).formatWith(({
//     msg
//   }) => {
//     return msg;
//   });

//   if (!errors.isEmpty()) {
//     return res.status(422).json({
//       status: false,
//       message: errors.mapped()
//     });
//   }

//   const chatId = req.body.id;
//   const message = req.body.message;

//   client.sendMessage(chatId, message).then(response => {
//     res.status(200).json({
//       status: true,
//       response: response
//     });
//   }).catch(err => {
//     res.status(500).json({
//       status: false,
//       response: err
//     });
//   });
// });

client.on('message', message => {
  let from = message.from;
  let msg = message.body;
  let id_pesan = message.id;

      axios
      .post(reply_server, {
      nomor: from,
      pesan: msg,
      id_pesan: id_pesan
      })
      .then(res => {
      // console.log(`statusCode: ${res.statusCode}`)
      // console.log(res)
      })
      .catch(error => {
      console.error(error)
      });

});

app.get("/getChat", async (req, res) => {
  let chats = await client.getChats();
  //console.log(chats);
  let final = [];
  for (const chat of chats) {
      let pesan = await chat.fetchMessages({limit : 50});
      let response = JSON.stringify(pesan);
      let r = JSON.parse(response);
      final.push(r);
  }
  res.status(200).json({
    status: true,
    response: final
  });
});



server.listen(port, function() {
  console.log('App running on *: ' + port);
});
/*Interval*/
// setInterval(function() {
//   axios
//   .get(cek_server, {});
//  // console.error('Server is ok !');
// },1000);
