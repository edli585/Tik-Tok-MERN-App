const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');

const connectDB = require('./config/db');
const win = require('./pickWinner');

const VideoInfo = require('./schema/videoTemplate');
const VideoPref = require('./schema/prefTemplate');

const port = process.env.PORT || 5000;

//connect to database
connectDB();

let pairRecord = [];

//deleting the preferences

const app = express();

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    console.log(req.method,req.url);
    next();
});

//gets all videos from database
app.get('/getAllVideos', (req, res) => {
    VideoPref.deleteMany({ }).then((res) => console.log('Collection dropped')).catch((err) => console.log(err));
    getAllVideos()
    .then(result => {
        console.log("There are", result.length, "videos");
        res.json(result);
    })
    .catch((err) => {
        console.log("Unable to get videos:", err);
        res.status(500).send("Cannot get videos:", err);
    });
});

//insert video info into the database
app.post('/videoData', (req, res) => {
    if(!req.body) {
        console.log("Bad request");
        res.status(400).send("Bad request");
    }
    
    VideoInfo.findOne({url: req.body.url})
    .then((result) => {
        if(result !== null) res.status(200).send({msg: "Video already exists"});
        else {
            getVidCount()
            .then((result) => {
                if(result === 8) {
                    VideoInfo.find({}).sort({_id:1}).limit(1)
                    .then((vid) => {
                        VideoInfo.deleteOne(vid[0])
                        .then(() => {console.log("Successfully removed oldest video")
                        })
                        .catch((err) => {
                            console.log("Couldn't remove oldest video:", err);
                        });
                    })
                    .catch((err) => {
                        console.log(err);
                        res.status(500).send({msg: "Can't insert video " + err});
                    });
                }
                VideoInfo.create({
                    username: req.body.username,
                    url: req.body.url,
                    videoname: req.body.videoname
                }).then(() => res.status(200).send({msg: "Video Submitted!"})
                ).catch((err) => {
                    console.log(err);
                    res.status(500).send({msg: "Can't insert video " + err});
                });
            })
            .catch((err) => {
                console.log(err);
                res.status(500).send({msg: "Can't insert video " + err});
            });
        }
    })
    .catch((err) => {
        console.log(err);
        res.status(500).send({msg: "Error with database: " + err});
    });
});

//get the video that was just insert from the database
app.get('/getMostRecentVid', (req, res) => {
    if(!req.body) {
        console.log("Bad request");
        res.status(400).send("Bad request");
    }
    VideoInfo.find({}).sort({_id:-1}).limit(1)
    .then((result) => {
        res.status(200).json(result);
    })
    .catch((err) => {
        res.status(500).send("Can't find video:", err);
    })
});

//delete video from page and database and move everything else accordingly
app.post('/deleteVideo', (req, res) => {
    if(!req.body) {
        console.log("Bad request");
        res.status(400).send("Bad request");
    }
    let id = req.body._id;
    VideoInfo.findById(id).then((result) => {
        VideoInfo.deleteOne(result).then(() => {
            res.status(200);
            res.send({msg:"Successfully removed!"});
        }).catch((err) => {
            res.status(400);
            res.send("Can't remove video:", err);
        });
    })
    .catch((err) => {
        res.status(500).send("Can't delete video:", err);
    })
});



//pick two random videos to compare
app.get('/getTwoVideos', (req, res) => {
    getVidCount()
    .then((c) => {
        let pair = getPair(c);
        while(isInRecord(pair)) {
            pair = getPair(c);
        }
        let x = pair[0], y = pair[1];
        getAllVideos()
        .then((vids) => {
            let data = {
                "first": vids[x],
                "second": vids[y]
            };
            pairRecord.push(pair);
            res.json(data);
        })
        .catch((err) => {
            console.log("Error:", err);
            res.status(500).send(err);
        });
    }).catch((err) => {
        console.log("Error:", err);
        res.status(500).send(err);
    })
});


//insert the preferences
app.post('/insertPref', (req, res) => {
    if(!req.body) {
        res.status(400);
        throw new Error("Please enter a proper JSON")
    }
    VideoPref.create({
        better: req.body.better,
        worse: req.body.worse,
    }).then(() => {
        VideoPref.count()
        .then((result) => {
            if(result >= 14) 
                res.status(200).send({msg: "winner"});
            else 
                res.status(200).send({msg: "continue"});
        })
        .catch((err) => {
            console.log("Couldn't get number of preferences:", err);
            res.status(500).send(err);
        })
    }
    ).catch((err) => {
        console.log("Couldn't insert preference:", err);
        res.status(500).send(err);
    });
});

//output most preferred video
app.get('/getWinner', async (req, res) => {
    try {
        let winner = await win.computeWinner(8);
        VideoInfo.findById(winner)
        .then((result) => {
            res.json(result);
        })
        .catch((err) => {
            console.log("Error:", err);
            res.status(500).send("Couldn't get winner:", err);
        })
    }
    catch(err) {
        console.log("Error:", err);
        res.status(500).send(err);
    }
});

app.use((req, res) => {
    res.status(404);
    res.type('text');
    res.send('404 - File' + req.url + ' not found');
});

app.listen(port, () => console.log(`Server started on port ${port}`));

async function getVidCount() {
    let n = await VideoInfo.count();
    return n;
}

async function getAllVideos() {
    let vids = await VideoInfo.find();
    return vids;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function getPair(max) {
    let x = getRandomInt(max);
    let y = getRandomInt(max);
    while(x === y) y = getRandomInt(max);
    return [x, y];
}

function isInRecord(pair) {
    let x = pair[0], y = pair[1];
    for(let i = 0; i < pairRecord.length; i++) {
        let rec = pairRecord[i];
        if((x === rec[0] && y === rec[1]) || (x === rec[1] && y === rec[0])) return true;
    }
    return false;
}