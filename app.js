const express = require("express")
    , app = express()
    , Youtube = require("youtube-api")
    , fs = require("fs")
    , readJson = require("r-json")
    , bodyParser = require("body-parser")
    , open = require("open")
    , uuid = require("uuid/v4")
    , multer = require("multer")
    , prettyBytes = require("pretty-bytes")
    ;

const CREDENTIALS = readJson(`${__dirname}/credentials.json`);

const PORT = 3000;


app.set("view engine", "ejs");
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);
app.use(bodyParser.json());


let oauth = Youtube.authenticate({
    type: "oauth"
    , client_id: CREDENTIALS.web.client_id
    , client_secret: CREDENTIALS.web.client_secret
    , redirect_url: CREDENTIALS.web.redirect_uris[0]
});

var storage = multer.diskStorage({
    destination: './',
    filename(req, file, cb) {
        const newFileName = `${uuid()}-${file.originalname}`;
        cb(null, newFileName);
    }
});
var upload = multer({
    storage: storage
}).single("videoFile");

app.get("/", (req, res) => {
    res.render("home");
})

app.post("/", upload, (req, res) => {
    var filename = req.file.filename;
    var filesize = prettyBytes(req.file.size);
    var { title, description } = req.body;
    open(oauth.generateAuthUrl({
        access_type: "offline"
        , scope: ["https://www.googleapis.com/auth/youtube.upload"]
        , state: JSON.stringify({ filename, title, description }),
    }));
})
app.get("/success", (req, res) => {
    res.render("success");
})

app.get("/oauth2callback", (req, res) => {
    res.redirect("/success");
    console.log("Trying to get the token using the following code: " + req.query.code);
    var { filename, title, description } = JSON.parse(req.query.state);
    console.log({ filename, title, description });
    oauth.getToken(req.query.code, (err, tokens) => {
        if (err) {
            console.log(err);
            return;
        }

        console.log("Got the tokens.");

        oauth.setCredentials(tokens);


        var yt = Youtube.videos.insert({
            resource: {
                // Video title and description
                snippet: {
                    title, description
                }
                , status: {
                    privacyStatus: "private"
                }
            }
            , part: "snippet,status"
            , media: {
                body: fs.createReadStream(filename)
            }
        }, (err, data) => {
            console.log(err);
            console.log("Done.");
            clearInterval(timer);
            return;
        });

        var timer = setInterval(function () {
            console.log(`${prettyBytes(yt.req.connection._bytesDispatched)} uploaded.`);
        }, 250);
    });
});

app.listen(PORT, () => {
    console.log("Server is running");
})